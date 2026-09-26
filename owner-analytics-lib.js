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
  // A real calendar date only: '2026-02-30' or '2026-99-99' is rejected, not silently normalised.
  function parseYMD(s) {
    if (!s) return null; var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s)); if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var probe = new Date(Date.UTC(y, mo - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d };
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
    ZA:'ЮАР',ZM:'Замбия',ZW:'Зимбабве'
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

  // ── Owner Analytics 2.0: ranges in ANY timezone, comparisons, formatting, labels ──────────
  var ZONES = ['Europe/Oslo', 'UTC'];

  function zoneOffsetMinutes(tz, utcMs) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var parts = {};
    dtf.formatToParts(new Date(utcMs)).forEach(function (p) { parts[p.type] = p.value; });
    var asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, (+parts.hour) % 24, +parts.minute, +parts.second);
    return Math.round((asUTC - Math.floor(utcMs / 1000) * 1000) / 60000);
  }
  function zoneYMD(tz, utcMs) {
    var offset = zoneOffsetMinutes(tz, utcMs);
    var shifted = new Date(utcMs + offset * 60000);
    return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate() };
  }
  // Civil midnight in tz → UTC instant. The offset is resolved twice, so DST switches land right.
  function zoneCivilToUTC(tz, y, mo, d, h, mi) {
    var guess = Date.UTC(y, mo - 1, d, h || 0, mi || 0);
    var utc = guess - zoneOffsetMinutes(tz, guess) * 60000;
    return guess - zoneOffsetMinutes(tz, utc) * 60000;
  }
  function addDays(ymd, n) {
    var t = Date.UTC(ymd.y, ymd.m - 1, ymd.d) + n * 86400000;
    var d = new Date(t);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }
  function civilMidnight(tz, ymd) { return zoneCivilToUTC(tz, ymd.y, ymd.m, ymd.d, 0, 0); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymdText(ymd) { return ymd.y + '-' + pad2(ymd.m) + '-' + pad2(ymd.d); }
  // Today's civil date in tz as 'YYYY-MM-DD'; shiftDay moves a civil date by n days (calendar math,
  // month / year boundaries handled by Date.UTC normalisation).
  function todayYMD(tz, nowMs) { return ymdText(zoneYMD(tz || TZ, nowMs == null ? Date.now() : nowMs)); }
  function shiftDay(ymdStr, n) { var p = parseYMD(ymdStr); return p ? ymdText(addDays(p, n)) : null; }

  // Presets used by the Owner Panel. Every range is [from, to) in UTC ISO, with the bucket the
  // charts should use and the immediately preceding window of the same length for comparison.
  function range(preset, nowMs, tz, customFrom, customTo) {
    tz = tz || TZ;
    nowMs = nowMs == null ? Date.now() : nowMs;
    var today = zoneYMD(tz, nowMs);
    var startOfToday = zoneCivilToUTC(tz, today.y, today.m, today.d, 0, 0);
    var from, to, bucket = 'day';
    switch (preset) {
      case 'live': from = nowMs - 30 * 60000; to = nowMs + 60000; bucket = 'hour'; break;
      // Civil day boundaries: the next midnight is resolved through the tz database, so a DST day
      // is 23 or 25 hours long instead of a fixed 86 400 000 ms.
      case 'today': from = startOfToday; to = civilMidnight(tz, addDays(today, 1)); bucket = 'hour'; break;
      case 'yesterday': from = civilMidnight(tz, addDays(today, -1)); to = startOfToday; bucket = 'hour'; break;
      case 'day': {
        var d = parseYMD(customFrom) || today;
        from = civilMidnight(tz, d); to = civilMidnight(tz, addDays(d, 1)); bucket = 'hour';
        break;
      }
      case '7d': from = zoneCivilToUTC(tz, addDays(today, -6).y, addDays(today, -6).m, addDays(today, -6).d, 0, 0); to = startOfToday + 86400000; break;
      case '30d': from = zoneCivilToUTC(tz, addDays(today, -29).y, addDays(today, -29).m, addDays(today, -29).d, 0, 0); to = startOfToday + 86400000; break;
      case '90d': from = zoneCivilToUTC(tz, addDays(today, -89).y, addDays(today, -89).m, addDays(today, -89).d, 0, 0); to = startOfToday + 86400000; bucket = 'week'; break;
      case 'month': from = zoneCivilToUTC(tz, today.y, today.m, 1, 0, 0); to = startOfToday + 86400000; break;
      case 'lastMonth': {
        var prev = today.m === 1 ? { y: today.y - 1, m: 12 } : { y: today.y, m: today.m - 1 };
        from = zoneCivilToUTC(tz, prev.y, prev.m, 1, 0, 0);
        to = zoneCivilToUTC(tz, today.y, today.m, 1, 0, 0);
        break;
      }
      case 'all': from = Date.UTC(2026, 7, 1); to = startOfToday + 86400000; bucket = 'week'; break;
      case 'custom': {
        var a = parseYMD(customFrom), b = parseYMD(customTo);
        if (!a || !b) return range('7d', nowMs, tz);
        from = zoneCivilToUTC(tz, a.y, a.m, a.d, 0, 0);
        to = zoneCivilToUTC(tz, b.y, b.m, b.d, 0, 0) + 86400000;
        if (to - from > 120 * 86400000) bucket = 'week';
        break;
      }
      default: return range('7d', nowMs, tz);
    }
    var span = to - from;
    return {
      preset: preset, tz: tz, bucket: bucket,
      from: new Date(from).toISOString(), to: new Date(to).toISOString(),
      prev_from: new Date(from - span).toISOString(), prev_to: new Date(from).toISOString()
    };
  }

  function formatDuration(ms) {
    var seconds = Math.max(0, Math.round((+ms || 0) / 1000));
    if (seconds < 60) return seconds + ' с';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' мин ' + (seconds % 60 ? (seconds % 60) + ' с' : '');
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' ч ' + (minutes % 60 ? (minutes % 60) + ' мин' : '');
    return Math.floor(hours / 24) + ' д ' + (hours % 24 ? (hours % 24) + ' ч' : '');
  }

  function csv(columns, rows) {
    var escape = function (value) {
      if (value == null) return '';
      var text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      return /[",\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    };
    var head = columns.map(function (c) { return escape(c.title || c.key); }).join(';');
    var body = rows.map(function (row) {
      return columns.map(function (c) { return escape(typeof c.value === 'function' ? c.value(row) : row[c.key]); }).join(';');
    });
    return [head].concat(body).join('\r\n');
  }

  var CONFIDENCE_STEPS = [
    { min: 90, label: 'Доказано', tone: 'high' },
    { min: 70, label: 'Высокая уверенность', tone: 'good' },
    { min: 45, label: 'Средняя уверенность', tone: 'mid' },
    { min: 0, label: 'Низкая уверенность', tone: 'low' }
  ];
  function confidence(value) {
    var n = Math.max(0, Math.min(100, Math.round(+value || 0)));
    for (var i = 0; i < CONFIDENCE_STEPS.length; i++) {
      if (n >= CONFIDENCE_STEPS[i].min) return { value: n, label: CONFIDENCE_STEPS[i].label, tone: CONFIDENCE_STEPS[i].tone };
    }
    return { value: n, label: 'Низкая уверенность', tone: 'low' };
  }

  var KIND_RU = { verified: 'Подтверждённый человек', probable: 'Вероятный человек', unknown: 'Неизвестный посетитель' };
  var CLASS_RU = {
    human: 'Человек', probable_human: 'Вероятно человек', bot: 'Бот',
    probable_bot: 'Вероятно бот', owner_test: 'Владелец / тест', unknown: 'Не определено'
  };
  var CHANNEL_RU = {
    direct: 'Прямые переходы', organic_search: 'Поиск', paid_search: 'Платный поиск',
    organic_social: 'Соцсети', paid_social: 'Платные соцсети', referral: 'Ссылки с сайтов',
    email: 'E-mail', paid_other: 'Другая реклама', internal: 'Внутренние переходы', unknown: 'Источник неизвестен'
  };
  var EVENT_RU = {
    session_start: 'Начало сессии', app_open: 'Открытие приложения', page_view: 'Просмотр раздела',
    user_engagement: 'Активность', app_background: 'Ушёл в фон', app_foreground: 'Вернулся',
    lottery_open: 'Открыл лотерею', generator_open: 'Открыл генератор', generator_run: 'Сгенерировал ряды',
    model_selected: 'Выбрал модель', combination_saved: 'Сохранил комбинацию', rows_shared: 'Поделился рядами',
    analytics_open: 'Открыл статистику', period_analysis: 'Анализ периода', draw3d_start: '3D-тираж',
    ticket_check: 'Проверил билет', result_view: 'Смотрел результаты', history_open: 'История тиражей',
    court_open: 'Верховный судья', about_open: 'О приложении', source_info_open: 'Источники данных',
    subscription_info_open: 'О подписке', notification_center_open: 'Центр уведомлений',
    notification_open: 'Открыл уведомление', language_change: 'Сменил язык', theme_change: 'Сменил тему',
    signup: 'Регистрация', login: 'Вход', logout: 'Выход', paywall_view: 'Экран PRO',
    purchase_start: 'Начал оплату', purchase_success: 'Оплатил', restore_success: 'Восстановил покупку',
    purchase_failed: 'Оплата не прошла', purchase_cancelled: 'Отменил оплату',
    client_error: 'Ошибка в приложении'
  };
  var EVIDENCE_RU = {
    verified_account: 'Вошёл в аккаунт — личность подтверждена',
    anonymous_human_device: 'Анонимное устройство с признаками живого человека',
    same_household: 'То же домохозяйство',
    complementary_device_types: 'Разные типы устройств (телефон/компьютер/планшет)',
    never_concurrent: 'Устройства никогда не работали одновременно',
    no_human_evidence: 'Нет признаков взаимодействия человека',
    single_browser_profile: 'Один профиль браузера — другое устройство исключить нельзя',
    same_device_signal: 'Совпал технический признак устройства (с согласия)',
    same_account_same_device_profile: 'Тот же аккаунт и тот же профиль устройства',
    residential_network: 'Домашняя сеть',
    multiple_devices: 'Несколько устройств в одной сети',
    repeat_days: 'Сеть повторяется в разные дни',
    single_visit_network: 'Сеть встретилась один раз',
    'human:interactions': 'Есть действия в приложении',
    'human:engaged_10s': 'Активность дольше 10 секунд',
    'human:returning_days': 'Возвращался в разные дни',
    'human:verified_account': 'Есть вход в аккаунт',
    'human:consent_given': 'Дал согласие на аналитику',
    owner_account: 'Аккаунт владельца',
    headless_browser: 'Браузер без интерфейса (автоматизация)',
    burst_pattern: 'Слишком быстрые действия подряд',
    hosting_network: 'Сеть дата-центра',
    vpn_network: 'VPN',
    tor_exit: 'Выход из сети Tor',
    post_deploy_single_hit: 'Один заход сразу после публикации сборки'
  };
  function evidenceRu(key) {
    if (!key) return '';
    if (EVIDENCE_RU[key]) return EVIDENCE_RU[key];
    var bot = /^declared_bot:(.+)$/.exec(String(key));
    if (bot) return 'Объявленный робот: ' + bot[1];
    return String(key);
  }

  // ── Owner Analytics 2.1 (2026-09-19): KPI precision, world-map palette, continents ──────────
  // Every KPI card names how exact it is; these are the only four words used for that.
  var PRECISION_RU = { exact: 'точно', filtered: 'фильтр', consented: 'с согласием', estimate: 'оценка' };
  var TRAFFIC_RU = { human: 'Обычные визиты', suspicious: 'Подозрительный трафик', bot: 'Боты' };
  var CONTINENT_RU = {
    EU: 'Европа', AS: 'Азия', NA: 'Северная Америка', SA: 'Южная Америка',
    AF: 'Африка', OC: 'Океания', AN: 'Антарктида'
  };
  var CONTINENT_ORDER = ['EU', 'AS', 'NA', 'SA', 'AF', 'OC', 'AN'];
  // Soft sequential blues (the restored «Голубая» character: calm, no acid tones). Index 0 = no data.
  // Index 0 = «no data» (the map draws such a country under glass and never uses this colour for a
  // value); 1..7 = the sequential ramp. The first active step must already read as «coloured» next
  // to the glass fill, so the ramp starts saturated instead of one tint away from white.
  var BLUE_LIGHT = ['#dde6ee', '#b7d2f1', '#90bae9', '#6aa1df', '#4a87d5', '#2f6dcb', '#1d4ed8', '#173ba6'];
  var BLUE_DARK = ['#26364a', '#2c5384', '#336ba6', '#3f85c6', '#569de1', '#78b6ee', '#9dccf6', '#c3ddfa'];
  // Log scale: one dominant country must not flatten every other one into the palest tone.
  function choroplethColor(value, max, theme) {
    var scale = theme === 'dark' ? BLUE_DARK : BLUE_LIGHT;
    var v = +value || 0, m = +max || 0;
    if (v <= 0 || m <= 0) return scale[0];
    var t = Math.min(1, Math.log1p(v) / Math.log1p(Math.max(m, v)));
    var steps = scale.length - 1;
    var idx = 1 + Math.min(steps - 1, Math.floor(t * steps));
    return scale[idx];
  }
  function flagEmoji(iso) {
    var code = String(iso || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || code === 'ZZ') return '';
    return String.fromCodePoint(0x1F1E6 + code.charCodeAt(0) - 65, 0x1F1E6 + code.charCodeAt(1) - 65);
  }
  // What a KPI card prints. null → «Нет данных» (or «Недостаточно данных» when the metric exists but
  // the sample is too small); a real 0 stays «0»; an unanswered backend never becomes a 0.
  function kpiText(value, opts) {
    opts = opts || {};
    if (opts.unavailable) return { text: 'Нет данных', state: 'none' };
    if (value == null) return opts.insufficient ? { text: 'Недостаточно данных', state: 'insufficient' } : { text: 'Нет данных', state: 'none' };
    var n = +value;
    if (!isFinite(n)) return { text: 'Нет данных', state: 'none' };
    return { text: n.toLocaleString('ru-RU'), state: 'ok' };
  }

  // ── Owner Panel calendar + Owner Notification Center (2026-09-20) ────────────────────────────
  // One day in the report timezone: [from, to) in UTC ISO, hour buckets, previous civil day for
  // the comparison. Any date of any month / year; DST-safe because both midnights come from the tz db.
  function dayRange(ymdStr, tz) {
    tz = tz || TZ;
    var d = parseYMD(ymdStr) || zoneYMD(tz, Date.now());
    var from = civilMidnight(tz, d), to = civilMidnight(tz, addDays(d, 1));
    var prevFrom = civilMidnight(tz, addDays(d, -1));
    return { preset: 'day', day: ymdText(d), tz: tz, bucket: 'hour', from: new Date(from).toISOString(), to: new Date(to).toISOString(),
      prev_from: new Date(prevFrom).toISOString(), prev_to: new Date(from).toISOString(), hours: Math.round((to - from) / 3600000) };
  }
  // Absolute and relative change. The percentage exists only when the base is a real positive
  // number: against 0 there is no honest "%", so pct is null and the card shows the absolute delta.
  function delta(current, previous) {
    var cur = current == null ? null : +current, prev = previous == null ? null : +previous;
    if (cur == null || !isFinite(cur) || prev == null || !isFinite(prev)) return null;
    var abs = cur - prev;
    var pct = prev > 0 ? (abs / prev) * 100 : null;
    return { abs: Math.round(abs * 100) / 100, pct: pct == null ? null : Math.round(pct * 10) / 10, dir: abs > 0 ? 'up' : abs < 0 ? 'down' : 'stable' };
  }
  // '#owner?d=2026-09-20&s=day&b=commerce&c=NO' ↔ { d, s, b, c }. Unknown keys are dropped, values are
  // reduced to the safe alphabet the server also uses, so a pushed link can never inject markup.
  var LINK_KEYS = ['d', 's', 'b', 'c', 'cat', 'f', 'p', 'n'];
  function parseOwnerLink(hash) {
    var text = String(hash || '');
    if (text.indexOf('#owner') !== 0) return null;
    var out = {};
    var query = text.indexOf('?') >= 0 ? text.slice(text.indexOf('?') + 1) : '';
    query.split('&').forEach(function (pair) {
      if (!pair) return;
      var idx = pair.indexOf('=');
      var key = decodeURIComponent(idx >= 0 ? pair.slice(0, idx) : pair);
      var value = idx >= 0 ? decodeURIComponent(pair.slice(idx + 1)) : '';
      if (LINK_KEYS.indexOf(key) < 0) return;
      value = value.replace(/[^A-Za-z0-9_.:-]/g, '');
      if (key === 'd' && !parseYMD(value)) return;
      if (value) out[key] = value;
    });
    return out;
  }
  function buildOwnerLink(parts) {
    var query = LINK_KEYS.filter(function (k) { return parts && parts[k]; })
      .map(function (k) { return k + '=' + encodeURIComponent(String(parts[k]).replace(/[^A-Za-z0-9_.:-]/g, '')); });
    return '#owner' + (query.length ? '?' + query.join('&') : '');
  }
  var CATEGORY_RU = {
    visit: 'Визит', new_user: 'Новый пользователь', returning_user: 'Вернувшийся пользователь', registration: 'Регистрация',
    new_country: 'Новая страна', purchase: 'Покупка PRO', renewal: 'Продление PRO', cancellation: 'Отмена подписки',
    refund: 'Возврат', payment_failure: 'Сбой оплаты', system: 'Системное событие', daily_summary: 'Итоги дня'
  };
  var CATEGORY_ICON = {
    visit: '👣', new_user: '✨', returning_user: '🔁', registration: '🪪', new_country: '🌍', purchase: '💎', renewal: '♻️',
    cancellation: '⛔', refund: '↩️', payment_failure: '⚠️', system: '🛠️', daily_summary: '📊'
  };
  var SEVERITY_RU = { info: 'Информация', important: 'Важное', critical: 'Критично' };
  var MODE_RU = {
    all: ['Все события', 'Push о каждом событии: визиты, пользователи, регистрации, покупки, сбои, итоги дня.'],
    important: ['Только важное', 'Push о регистрациях, новых странах, покупках, продлениях, отменах, возвратах, сбоях и итогах дня. Визиты и пользователи — только в центре.'],
    digest: ['Дайджест', 'Push только «Итоги дня» и критичные сбои. Всё остальное копится в центре уведомлений.'],
    custom: ['Свой набор', 'Для каждой категории отдельно: показывать в центре и/или присылать push.']
  };
  var STATUS_RU = { guest: 'Гость', free: 'FREE', pro: 'PRO', lifetime: 'PRO Lifetime', expired: 'PRO истёк', owner: 'Владелец', signed_in: 'С аккаунтом' };
  var FEED_KIND_RU = { event: 'Событие', commerce: 'Платёж', account: 'Аккаунт', visits: 'Визиты' };
  var COMMERCE_RU = {
    checkout_open: 'Открыл оплату', checkout_failed: 'Оплата не удалась', checkout_cancelled: 'Оплата отменена',
    purchase_success: 'Покупка PRO', renewal: 'Продление', cancellation: 'Отмена подписки', uncancellation: 'Отмена отозвана',
    expiration: 'Подписка истекла', refund: 'Возврат', payment_failed: 'Проблема с оплатой', plan_change: 'Смена тарифа',
    transfer: 'Перенос покупки', billing_test: 'Тест RevenueCat', billing_webhook_failed: 'Сбой вебхука платежей', restore_success: 'Восстановление',
    // every other RevenueCat event type the ledger may file (billing_<type>): named, never shown raw
    billing_invoice_issuance: 'Счёт выставлен', billing_subscription_paused: 'Подписка приостановлена',
    billing_subscription_extended: 'Подписка продлена магазином', billing_temporary_entitlement_grant: 'Временный доступ (магазин)',
    billing_virtual_currency_transaction: 'Виртуальная валюта', billing_refund_reversed: 'Возврат отменён'
  };
  // What a ledger row IS (server field `kind`): only paid rows are sales.
  var COMMERCE_KIND_RU = { paid: 'Оплачено', promo: 'Промо-доступ', sandbox: 'Sandbox / Test Store', trial: 'Пробный период', zero: 'Без оплаты' };
  function formatMoney(amount, currency) {
    var n = +amount;
    if (!isFinite(n)) return '—';
    try { return n.toLocaleString('ru-RU', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }); }
    catch (e) { return n.toLocaleString('ru-RU') + ' ' + (currency || ''); }
  }
  // Money by currency, never summed across currencies: [{currency, amount}] → «4,99 € · 99,00 kr».
  // Rows without an amount are skipped (unknown is unknown, not zero).
  function moneyList(rows, key) {
    var k = key || 'amount';
    var parts = (Array.isArray(rows) ? rows : []).filter(function (r) { return r && r.currency && r[k] != null && isFinite(+r[k]); })
      .map(function (r) { return formatMoney(r[k], r.currency); });
    return parts.join(' · ');
  }
  // «≈ 5,68 $ по курсу RevenueCat» — the only cross-currency figure, always named as an estimate.
  function usdEstimate(value) {
    var n = +value;
    if (value == null || !isFinite(n)) return '';
    return '≈ ' + formatMoney(n, 'USD') + ' по курсу RevenueCat';
  }
  // Net of one ledger row: exact when the server computed it, «нет данных» otherwise — never 0 by default.
  function netText(row) {
    if (!row) return 'нет данных';
    if (row.net != null && row.currency && isFinite(+row.net)) return formatMoney(row.net, row.currency);
    return 'нет данных';
  }
  function deductionText(row) {
    if (!row || row.price == null || row.net == null || !row.currency) return '';
    var d = +row.price - +row.net;
    if (!isFinite(d)) return '';
    var shares = [];
    if (row.commission_pct != null && isFinite(+row.commission_pct)) shares.push('комиссия ' + Math.round(+row.commission_pct * 1000) / 10 + '%');
    if (row.tax_pct != null && isFinite(+row.tax_pct)) shares.push('налог ' + Math.round(+row.tax_pct * 1000) / 10 + '%');
    return formatMoney(d, row.currency) + (shares.length ? ' (' + shares.join(' + ') + ')' : '');
  }

  return {
    osloRange: osloRange, forecast: forecast, pctChange: pctChange,
    COUNTRY_RU: COUNTRY_RU, countryNameRu: countryNameRu, countryList: countryList,
    range: range, ZONES: ZONES, formatDuration: formatDuration, csv: csv, confidence: confidence,
    KIND_RU: KIND_RU, CLASS_RU: CLASS_RU, CHANNEL_RU: CHANNEL_RU, EVENT_RU: EVENT_RU,
    EVIDENCE_RU: EVIDENCE_RU, evidenceRu: evidenceRu,
    PRECISION_RU: PRECISION_RU, TRAFFIC_RU: TRAFFIC_RU, CONTINENT_RU: CONTINENT_RU, CONTINENT_ORDER: CONTINENT_ORDER,
    BLUE_LIGHT: BLUE_LIGHT, BLUE_DARK: BLUE_DARK, choroplethColor: choroplethColor, flagEmoji: flagEmoji, kpiText: kpiText,
    dayRange: dayRange, todayYMD: todayYMD, shiftDay: shiftDay, delta: delta, parseOwnerLink: parseOwnerLink, buildOwnerLink: buildOwnerLink,
    CATEGORY_RU: CATEGORY_RU, CATEGORY_ICON: CATEGORY_ICON, SEVERITY_RU: SEVERITY_RU, MODE_RU: MODE_RU, STATUS_RU: STATUS_RU,
    FEED_KIND_RU: FEED_KIND_RU, COMMERCE_RU: COMMERCE_RU, COMMERCE_KIND_RU: COMMERCE_KIND_RU, formatMoney: formatMoney,
    moneyList: moneyList, usdEstimate: usdEstimate, netText: netText, deductionText: deductionText,
    _zoneOffsetMinutes: zoneOffsetMinutes, _zoneCivilToUTC: zoneCivilToUTC, _zoneYMD: zoneYMD,
    _osloCivilToUTC: osloCivilToUTC, _osloYMD: osloYMD, _osloOffsetMinutes: osloOffsetMinutes
  };
});
