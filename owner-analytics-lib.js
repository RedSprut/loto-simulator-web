/* Owner Analytics — shared pure logic (Oslo date ranges + deterministic forecast).
 * Runs in the browser (window.LotoOwnerLib) AND in Node (module.exports) so the dashboard and the
 * unit tests exercise the SAME code. No dependencies. All ranges are [inclusive, exclusive) and
 * expressed as UTC ISO strings; calendar math is done on the Europe/Oslo civil calendar with DST
 * handled via Intl (the browser/Node tz database), never a hard-coded offset.
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = lib;
  if (typeof window !== 'undefined') window.LotoOwnerLib = lib;
})(this, function () {
  var TZ = 'Europe/Oslo';

  // Oslo wall-clock offset (minutes east of UTC) at a given UTC instant.
  function osloOffsetMinutes(utcMs) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    var p = {};
    dtf.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    var asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour === '24' ? '00' : p.hour), +p.minute, +p.second);
    return (asUTC - utcMs) / 60000;
  }
  // Convert an Oslo civil datetime to the correct UTC instant (DST-aware, boundary-refined).
  function osloCivilToUTC(y, mo, d, h, mi) {
    var guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
    var off = osloOffsetMinutes(guess);
    var utc = guess - off * 60000;
    var off2 = osloOffsetMinutes(utc);
    if (off2 !== off) utc = guess - off2 * 60000;
    return new Date(utc);
  }
  // Oslo civil Y-M-D of a UTC instant.
  function osloYMD(utcMs) {
    var dtf = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    var p = {}; dtf.formatToParts(new Date(utcMs)).forEach(function (x) { p[x.type] = x.value; });
    return { y: +p.year, m: +p.month, d: +p.day };
  }
  function iso(dt) { return new Date(dt).toISOString(); }
  function addDaysCivil(ymd, n) {
    var t = Date.UTC(ymd.y, ymd.m - 1, ymd.d + n);
    var d = new Date(t); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  function startUTC(ymd) { return osloCivilToUTC(ymd.y, ymd.m, ymd.d, 0, 0); }

  // Build [from,to) + comparable previous [prevFrom,prevTo) for a preset, in UTC ISO.
  function osloRange(preset, nowMs, customFrom, customTo) {
    nowMs = nowMs == null ? Date.now() : nowMs;
    var today = osloYMD(nowMs);
    var startToday = startUTC(today);
    var startTomorrow = startUTC(addDaysCivil(today, 1));
    var r = { from: null, to: null, prevFrom: null, prevTo: null, bucket: 'day' };

    function span(fromYmd, toYmd, bucket) {
      var f = startUTC(fromYmd), t = startUTC(toYmd);
      var len = t.getTime() - f.getTime();
      r.from = iso(f); r.to = iso(t);
      r.prevFrom = iso(new Date(f.getTime() - len)); r.prevTo = iso(f);
      r.bucket = bucket || 'day';
    }

    switch (preset) {
      case 'today': span(today, addDaysCivil(today, 1), 'day'); break;
      case 'yesterday': span(addDaysCivil(today, -1), today, 'day'); break;
      case '7d': span(addDaysCivil(today, -6), addDaysCivil(today, 1), 'day'); break;
      case '30d': span(addDaysCivil(today, -29), addDaysCivil(today, 1), 'day'); break;
      case 'month': {
        var m0 = { y: today.y, m: today.m, d: 1 };
        var mN = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
        span(m0, mN, 'day'); break;
      }
      case 'lastMonth': {
        var lm = today.m === 1 ? { y: today.y - 1, m: 12, d: 1 } : { y: today.y, m: today.m - 1, d: 1 };
        var lmN = { y: today.y, m: today.m, d: 1 };
        span(lm, lmN, 'day'); break;
      }
      case 'year': span({ y: today.y, m: 1, d: 1 }, { y: today.y + 1, m: 1, d: 1 }, 'month'); break;
      case 'all': {
        r.from = iso(Date.UTC(2026, 0, 1)); r.to = iso(startTomorrow);
        r.prevFrom = null; r.prevTo = null; r.bucket = 'month'; break;
      }
      case 'custom': {
        var cf = parseYMD(customFrom), ct = parseYMD(customTo);
        if (!cf || !ct) { span(today, addDaysCivil(today, 1), 'day'); break; }
        var toEx = addDaysCivil(ct, 1); // inclusive end date → exclusive next day
        var f2 = startUTC(cf), t2 = startUTC(toEx);
        var len2 = t2.getTime() - f2.getTime();
        var days = Math.round(len2 / 86400000);
        r.from = iso(f2); r.to = iso(t2);
        r.prevFrom = iso(new Date(f2.getTime() - len2)); r.prevTo = iso(f2);
        r.bucket = days > 92 ? 'month' : (days > 31 ? 'week' : 'day');
        break;
      }
      default: span(today, addDaysCivil(today, 1), 'day');
    }
    return r;
  }
  function parseYMD(s) {
    if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3] };
  }

  // ── Deterministic forecast: Holt's linear (level+trend) exponential smoothing. ──
  // series: array of numbers (chronological). Returns { enough, method, points:[{value,lo,hi}], ... }.
  function forecast(series, horizon, opts) {
    opts = opts || {};
    var alpha = opts.alpha == null ? 0.5 : opts.alpha;
    var beta = opts.beta == null ? 0.3 : opts.beta;
    var s = (series || []).map(Number).filter(function (x) { return isFinite(x); });
    horizon = horizon || 12;
    if (s.length < 4) return { enough: false, method: 'insufficient', reason: 'Недостаточно данных для надёжного прогноза', points: [] };

    var level = s[0], trend = s[1] - s[0], resid = [];
    for (var i = 1; i < s.length; i++) {
      var pred = level + trend;
      resid.push(s[i] - pred);
      var newLevel = alpha * s[i] + (1 - alpha) * (level + trend);
      trend = beta * (newLevel - level) + (1 - beta) * trend;
      level = newLevel;
    }
    // residual standard deviation → symmetric ~95% interval, widening with horizon.
    var mean = resid.reduce(function (a, b) { return a + b; }, 0) / (resid.length || 1);
    var variance = resid.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (resid.length || 1);
    var sd = Math.sqrt(variance);
    var points = [];
    for (var h = 1; h <= horizon; h++) {
      var v = level + trend * h;
      var band = 1.96 * sd * Math.sqrt(h);
      points.push({ h: h, value: Math.max(0, v), lo: Math.max(0, v - band), hi: Math.max(0, v + band) });
    }
    return { enough: true, method: 'holt', alpha: alpha, beta: beta, level: level, trend: trend, sd: sd, points: points };
  }

  function pctChange(cur, prev) {
    cur = +cur || 0; prev = +prev || 0;
    if (prev === 0) return cur === 0 ? { pct: 0, dir: 'stable' } : { pct: null, dir: 'up' };
    var p = (cur - prev) / prev * 100;
    return { pct: p, dir: p > 0.5 ? 'up' : (p < -0.5 ? 'down' : 'stable') };
  }

  // ── ISO 3166-1 alpha-2 → Russian country name (full list). ──
  var COUNTRY_RU = {
    AD:'Андорра',AE:'ОАЭ',AF:'Афганистан',AG:'Антигуа и Барбуда',AI:'Ангилья',AL:'Албания',AM:'Армения',AO:'Ангола',AQ:'Антарктида',AR:'Аргентина',AS:'Американское Самоа',AT:'Австрия',AU:'Австралия',AW:'Аруба',AX:'Аландские острова',AZ:'Азербайджан',
    BA:'Босния и Герцеговина',BB:'Барбадос',BD:'Бангладеш',BE:'Бельгия',BF:'Буркина-Фасо',BG:'Болгария',BH:'Бахрейн',BI:'Бурунди',BJ:'Бенин',BL:'Сен-Бартелеми',BM:'Бермуды',BN:'Бруней',BO:'Боливия',BQ:'Бонэйр',BR:'Бразилия',BS:'Багамы',BT:'Бутан',BV:'Остров Буве',BW:'Ботсвана',BY:'Беларусь',BZ:'Белиз',
    CA:'Канада',CC:'Кокосовые острова',CD:'ДР Конго',CF:'ЦАР',CG:'Конго',CH:'Швейцария',CI:'Кот-д’Ивуар',CK:'Острова Кука',CL:'Чили',CM:'Камерун',CN:'Китай',CO:'Колумбия',CR:'Коста-Рика',CU:'Куба',CV:'Кабо-Верде',CW:'Кюрасао',CX:'Остров Рождества',CY:'Кипр',CZ:'Чехия',
    DE:'Германия',DJ:'Джибути',DK:'Дания',DM:'Доминика',DO:'Доминиканская Республика',DZ:'Алжир',
    EC:'Эквадор',EE:'Эстония',EG:'Египет',EH:'Западная Сахара',ER:'Эритрея',ES:'Испания',ET:'Эфиопия',
    FI:'Финляндия',FJ:'Фиджи',FK:'Фолклендские острова',FM:'Микронезия',FO:'Фарерские острова',FR:'Франция',
    GA:'Габон',GB:'Великобритания',GD:'Гренада',GE:'Грузия',GF:'Французская Гвиана',GG:'Гернси',GH:'Гана',GI:'Гибралтар',GL:'Гренландия',GM:'Гамбия',GN:'Гвинея',GP:'Гваделупа',GQ:'Экваториальная Гвинея',GR:'Греция',GS:'Южная Георгия',GT:'Гватемала',GU:'Гуам',GW:'Гвинея-Бисау',GY:'Гайана',
    HK:'Гонконг',HM:'Острова Херд и Макдональд',HN:'Гондурас',HR:'Хорватия',HT:'Гаити',HU:'Венгрия',
    ID:'Индонезия',IE:'Ирландия',IL:'Израиль',IM:'Остров Мэн',IN:'Индия',IO:'Британская территория в Индийском океане',IQ:'Ирак',IR:'Иран',IS:'Исландия',IT:'Италия',
    JE:'Джерси',JM:'Ямайка',JO:'Иордания',JP:'Япония',
    KE:'Кения',KG:'Киргизия',KH:'Камбоджа',KI:'Кирибати',KM:'Коморы',KN:'Сент-Китс и Невис',KP:'КНДР',KR:'Республика Корея',KW:'Кувейт',KY:'Каймановы острова',KZ:'Казахстан',
    LA:'Лаос',LB:'Ливан',LC:'Сент-Люсия',LI:'Лихтенштейн',LK:'Шри-Ланка',LR:'Либерия',LS:'Лесото',LT:'Литва',LU:'Люксембург',LV:'Латвия',LY:'Ливия',
    MA:'Марокко',MC:'Монако',MD:'Молдова',ME:'Черногория',MF:'Сен-Мартен',MG:'Мадагаскар',MH:'Маршалловы Острова',MK:'Северная Македония',ML:'Мали',MM:'Мьянма',MN:'Монголия',MO:'Макао',MP:'Северные Марианские острова',MQ:'Мартиника',MR:'Мавритания',MS:'Монтсеррат',MT:'Мальта',MU:'Маврикий',MV:'Мальдивы',MW:'Малави',MX:'Мексика',MY:'Малайзия',MZ:'Мозамбик',
    NA:'Намибия',NC:'Новая Каледония',NE:'Нигер',NF:'Остров Норфолк',NG:'Нигерия',NI:'Никарагуа',NL:'Нидерланды',NO:'Норвегия',NP:'Непал',NR:'Науру',NU:'Ниуэ',NZ:'Новая Зеландия',
    OM:'Оман',
    PA:'Панама',PE:'Перу',PF:'Французская Полинезия',PG:'Папуа — Новая Гвинея',PH:'Филиппины',PK:'Пакистан',PL:'Польша',PM:'Сен-Пьер и Микелон',PN:'Питкэрн',PR:'Пуэрто-Рико',PS:'Палестина',PT:'Португалия',PW:'Палау',PY:'Парагвай',
    QA:'Катар',
    RE:'Реюньон',RO:'Румыния',RS:'Сербия',RU:'Россия',RW:'Руанда',
    SA:'Саудовская Аравия',SB:'Соломоновы Острова',SC:'Сейшелы',SD:'Судан',SE:'Швеция',SG:'Сингапур',SH:'Остров Святой Елены',SI:'Словения',SJ:'Шпицберген и Ян-Майен',SK:'Словакия',SL:'Сьерра-Леоне',SM:'Сан-Марино',SN:'Сенегал',SO:'Сомали',SR:'Суринам',SS:'Южный Судан',ST:'Сан-Томе и Принсипи',SV:'Сальвадор',SX:'Синт-Мартен',SY:'Сирия',SZ:'Эсватини',
    TC:'Тёркс и Кайкос',TD:'Чад',TF:'Французские Южные территории',TG:'Того',TH:'Таиланд',TJ:'Таджикистан',TK:'Токелау',TL:'Восточный Тимор',TM:'Туркменистан',TN:'Тунис',TO:'Тонга',TR:'Турция',TT:'Тринидад и Тобаго',TV:'Тувалу',TW:'Тайвань',TZ:'Танзания',
    UA:'Украина',UG:'Уганда',UM:'Внешние малые острова США',US:'США',UY:'Уругвай',UZ:'Узбекистан',
    VA:'Ватикан',VC:'Сент-Винсент и Гренадины',VE:'Венесуэла',VG:'Британские Виргинские острова',VI:'Виргинские острова США',VN:'Вьетнам',VU:'Вануату',
    WF:'Уоллис и Футуна',WS:'Самоа',
    YE:'Йемен',YT:'Майотта',
    ZA:'ЮАР',ZM:'Замбия',ZW:'Зимбабве',XK:'Косово'
  };
  function countryNameRu(iso) {
    if (!iso) return 'Не определено';
    var code = String(iso).toUpperCase();
    return COUNTRY_RU[code] || code;
  }
  function countryList() {
    return Object.keys(COUNTRY_RU).sort(function (a, b) { return COUNTRY_RU[a].localeCompare(COUNTRY_RU[b], 'ru'); })
      .map(function (c) { return { code: c, name: COUNTRY_RU[c] }; });
  }

  return {
    osloRange: osloRange, forecast: forecast, pctChange: pctChange,
    COUNTRY_RU: COUNTRY_RU, countryNameRu: countryNameRu, countryList: countryList,
    _osloCivilToUTC: osloCivilToUTC, _osloYMD: osloYMD, _osloOffsetMinutes: osloOffsetMinutes
  };
});
