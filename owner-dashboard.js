/* Lotto Simulator — Owner Analytics 2.0 («Панель владельца»).
 *
 * Entry: the «Панель владельца» button in Личный кабинет, revealed ONLY after a server-side owner
 * probe (am_i_owner). Every read goes through the owner-analytics Edge Function, which re-verifies
 * the JWT and calls SECURITY DEFINER RPCs that check public.is_owner(auth.uid()) again → a non-owner
 * gets 403 and no data. Russian only, owner only, real data only.
 *
 * What it shows is the DERIVED identity model, not raw event guesswork:
 *   verified people (accounts) · probable people (anonymous human device groups, lower bound) ·
 *   unknown visitors · an estimated audience RANGE · households · devices · browser profiles ·
 *   sessions, with owner/test and bots excluded by default and counted separately.
 * Each card carries a «Как считается» note, and every probabilistic number carries its confidence.
 *
 * 2026-09-19: the restored calm BLUE theme (tokens from the original «Голубая» palette), a KPI block
 * that names the precision of every number (точно · фильтр · с согласием · оценка), identifier-free
 * visit counters (people / suspicious / bots per country), exact account and purchase metrics from the
 * auth + entitlement tables, and a country choropleth with hover, whole-territory selection, continent
 * view and a scrollable country card. Still Russian only, owner only, real data only.
 */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.LotoOwnerDashboard) return;

  var CFG = (W.LOTO_COMMERCIAL_CONFIG || {});
  var BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  var APIKEY = String(CFG.supabasePublishableKey || '');
  var LIB = W.LotoOwnerLib || {};
  var THEME_KEY = 'ow_theme_v2';

  var SECTIONS = [
    { id: 'day', label: 'День' },
    { id: 'overview', label: 'Обзор' },
    { id: 'live', label: 'Live' },
    { id: 'people', label: 'Люди' },
    { id: 'households', label: 'Домохозяйства' },
    { id: 'devices', label: 'Устройства' },
    { id: 'sessions', label: 'Сессии' },
    { id: 'acquisition', label: 'Источники' },
    { id: 'geography', label: 'География' },
    { id: 'map', label: 'Карта' },
    { id: 'games', label: 'Игры' },
    { id: 'features', label: 'Функции' },
    { id: 'funnels', label: 'Воронки' },
    { id: 'retention', label: 'Удержание' },
    { id: 'bots', label: 'Боты и QA' },
    { id: 'consent', label: 'Согласия' },
    { id: 'quality', label: 'Качество данных' }
  ];
  var PRESETS = [
    ['day', 'День по календарю'], ['live', 'Live · 30 минут'], ['today', 'Сегодня'], ['yesterday', 'Вчера'], ['7d', '7 дней'],
    ['30d', '30 дней'], ['90d', '90 дней'], ['month', 'Текущий месяц'], ['lastMonth', 'Прошлый месяц'],
    ['all', 'Всё время'], ['custom', 'Период…']
  ];
  // Choropleth metrics: every one is a column of the `countries` report rows.
  var MAP_METRICS = [
    ['visits_human', 'Обычные визиты'], ['visitors', 'Посетители с согласием'], ['registered', 'Зарегистрированные'],
    ['buyers', 'Покупатели'], ['households', 'Домохозяйства (оценка)'], ['consent_accepted', 'Согласились на аналитику'],
    ['visits_suspicious', 'Подозрительный трафик'], ['visits_bot', 'Боты']
  ];
  var AUDIENCES = [['all', 'Все'], ['guest', 'Гостевые визиты'], ['registered', 'Авторизованные визиты']];
  var HOW = {
    verified: 'Люди с подтверждённой личностью: вошли в аккаунт. Один аккаунт = один человек, сколько бы устройств он ни использовал. Владелец исключён.',
    probable: 'Анонимные устройства с признаками живого человека, сгруппированные внутри одного домохозяйства по нижней границе: в группу попадают только устройства разных типов, которые никогда не работали одновременно. Это оценка, а не доказанная личность.',
    unknown: 'Анонимные устройства без признаков взаимодействия: один заход без действий. Они не называются людьми и считаются отдельно.',
    estimated: 'Диапазон. Нижняя граница — подтверждённые люди плюс вероятные, которых нельзя объяснить вторым устройством уже известного человека. Верхняя — подтверждённые плюс каждое анонимное устройство отдельно плюс неизвестные посетители.',
    households: 'Домохозяйство — это устройства, которые регулярно выходят из одной домашней сети. Мобильные операторы, CGNAT, VPN и дата-центры домохозяйством не считаются, поэтому сотни людей за одним адресом не склеиваются.',
    devices: 'Физические устройства. Профили браузера объединяются в одно устройство только при сильном доказательстве: совпал технический признак (с отдельного согласия) или тот же аккаунт на идентичном профиле устройства, и сессии не перекрывались.',
    profiles: 'Профиль браузера или установка приложения. Это самый нижний уровень: очистка данных браузера создаёт новый профиль.',
    sessions: 'Сессия обрывается после 30 минут без активности. Перезагрузка страницы сессию не начинает; брошенная вкладка не превращается в многодневную сессию.',
    active: 'Активное время: сумма отчётов о вовлечённости (страница видима и человек взаимодействовал). Для старых данных без таких отчётов время оценивается по интервалам между действиями и помечается как оценка.',
    excluded: 'Владелец и тестовые заходы определяются по аккаунту владельца и по профилям, когда-либо связанным с ним. Боты — по объявленным краулерам, браузерам без интерфейса, сериям мгновенных действий, сетям дата-центров и одиночным заходам сразу после публикации сборки.',
    channels: 'Источник берётся из перехода: домен-источник и метки кампании. Если источника нет (старые данные или возврат в уже открытой вкладке) — «Источник неизвестен». Ничего не домысливается.',
    geo: 'Местоположение определяется по IP на сервере и хранится грубо: страна, регион, город и координаты центра города. Сам IP не сохраняется. Точный адрес не показывается никогда.',
    live: 'Активны сейчас: профили с событиями за последние 5 минут.',
    newPeople: 'Новые: первый визит за всё время попал внутрь выбранного периода.',
    returningPeople: 'Вернувшиеся: человек был известен ДО начала периода и снова заходил внутри него.',
    returnedAnotherDay: 'Приходили в разные дни: человек был активен минимум в два разных календарных дня внутри периода (по выбранному часовому поясу). Новый человек тоже может сюда попасть.',
    repeatSessions: 'Повторные сессии: сколько сессий сверх первой пришлось на людей в этом периоде.',
    consent: 'Долю согласившихся от ВСЕХ посетителей измерить нельзя: до решения не сохраняется ничего, поэтому закрывшие баннер следов не оставляют. Показаны решения, доля согласий среди них и доля данных, собранных с согласием.',
    funnels: 'Воронка по людям: на каждом шаге считается число людей, которые его достигли в выбранном периоде.',
    retention: 'Когорты по дню первого визита. D1/D7/D30 — вернулся ли человек ровно на 1-й, 7-й и 30-й день.',
    quality: 'Качество приёма: сколько событий принято, сколько отклонено и почему. Здесь же свежесть данных и распределение уверенности идентификации.',
    visitsHuman: 'Обычные визиты — визиты без обнаруженных признаков автоматизации (не доказательство живого человека): по одному на загрузку страницы или запуск приложения, независимо от согласия. Сервер считает их как обезличенные счётчики по стране и платформе — без идентификаторов, поэтому «уникальных посетителей» из них вывести нельзя. Автоматизация, headless-браузеры, сети дата-центров, VPN и Tor считаются отдельно.',
    guests: 'Гостевые визиты — визиты без входа в аккаунт (по счётчикам). Кто именно заходил, сервер не знает и не записывает.',
    authorizedVisits: 'Авторизованные визиты — загрузки страницы и запуски приложения, в которых был проверенный вход в аккаунт (по обезличенным счётчикам; какой именно аккаунт, не записывается). Это ВИЗИТЫ, а не люди: один человек за день даёт столько визитов, сколько раз открыл приложение. Число людей за ними — «Точные активные аккаунты» в блоке «Кто это был».',
    registered: 'Точное число: аккаунты в базе авторизации без анонимных сессий. Не зависит от согласия на аналитику и от фильтров трафика. Владелец учтён и показан отдельно.',
    levels: 'FREE / PRO / Lifetime — из серверной таблицы прав доступа (entitlements). PRO — активная платная подписка; Lifetime — бессрочный доступ владельца; истёкшие показаны отдельно. Клиентский флаг isPro не используется никогда.',
    buyers: 'Покупатели — аккаунты с оплаченным правом доступа от магазина (Apple, Google, Paddle, Stripe, RevenueCat) в production. Клиентское событие «оплатил» доказательством не считается. Продления появятся после подключения журнала платёжных событий.',
    conversion: 'Оценка: новые регистрации за период ÷ обычные визиты за период; покупатели ÷ все аккаунты. Показывается только при достаточной выборке (≥ 20 визитов, ≥ 10 аккаунтов), иначе — «Недостаточно данных».',
    traffic: 'Боты — объявленные краулеры. Подозрительный трафик — headless-браузеры, сети дата-центров, VPN, Tor и всплески запросов с одной сети. Ни одна страна не удаляется вручную: видно, какой это трафик.',
    consented: 'Посетители с согласием — люди из данных, собранных после «Принять»: подтверждённые аккаунты и вероятные анонимные люди. Это часть всех посетителей, а не все посетители.',
    countryMap: 'Страна определяется сервером по сети запроса — это страна посещения, а не гражданство или место жительства; VPN и Tor показаны отдельно. Хранится только счётчик. Аккаунты и покупатели привязаны к стране только если их устройства согласились на аналитику; остальные — «не определено».',
    // 2026-09-20: the calendar day report
    dayBounds: 'Границы дня — календарные сутки в часовом поясе отчёта (по умолчанию Europe/Oslo): от полуночи до полуночи, в день перевода часов — 23 или 25 часов. Исходные метки времени хранятся в UTC и не меняются; день только выбирает окно.',
    dayCompare: 'Сравнение: предыдущий день, тот же день недели неделей раньше и среднее дневных значений за 7 предыдущих дней. Процент показан только когда база больше нуля; для уникальных счётчиков среднее за 7 дней — это среднее по дням, а не уникальные за неделю.',
    dayPeople: 'Люди — посетители с согласием на аналитику: подтверждённые аккаунты, вероятные и неизвестные анонимные устройства (каждое анонимное устройство считается отдельно). Новые — первый визит в истории попал в этот день; вернувшиеся — были известны раньше. Это не все посетители: без согласия остаются только счётчики визитов.',
    dayEntities: 'Аккаунты, устройства, сессии и домохозяйства — четыре разные величины: один человек может иметь несколько устройств, несколько сессий за день и делить домашнюю сеть с другими. IP-адрес никогда не считается человеком.',
    dayStatuses: 'Статусы активных за день аккаунтов — из серверной таблицы прав доступа: FREE, PRO (активная платная подписка), PRO Lifetime, PRO истёк/отменён. Гости — устройства без входа в аккаунт. Владелец и тестовые аккаунты считаются отдельно и в эти цифры не входят даже при включённом переключателе.',
    dayRegistrations: 'Регистрации — аккаунты, созданные в этот день (точно, из базы авторизации, без анонимных сессий и без владельца). Анонимная сессия, ставшая аккаунтом, считается по дате создания её записи.',
    dayLanguages: 'Язык интерфейса — из событий с согласием (locale приложения). Страна — из счётчиков визитов (сервер, по сети) и сессий с согласием. Это две независимые величины: язык не выводится из страны и наоборот.',
    dayCommerce: 'Покупки, продления, отмены, возвраты, сбои оплаты, тариф (1/3/6/12 мес.), магазин и выручка — из журнала событий магазина (вебхук RevenueCat), записанного с момента подключения этого журнала. У исторических покупок без цены выручка не выдумывается: они показаны как «без суммы». Checkout started/failed — клиентские события экрана оплаты.',
    dayFeatures: 'Функции — все события приложения за день: сколько раз произошло и сколько уникальных пользователей (аккаунт, человек или устройство) их совершили. Периодические отчёты об активности не показываются.',
    daySystem: 'Сбои за день: отклонённые и невалидные события приёма, ошибки разбора аналитики, недоставленные push, ошибки в приложении у пользователей и системные уведомления владельца.',
    identity: 'Шесть разных величин, которые не складываются друг в друга. Точные аккаунты — один auth-аккаунт = один пользователь, сколько бы визитов, сессий и устройств у него ни было (владелец отдельно). Оценка уникальных гостей — гостевые профили с согласием (одна стабильная анонимная идентичность) плюс дневные ключи гостей без согласия: HMAC суток, сети, браузера, ОС, устройства, платформы и языка; 50 загрузок одного такого гостя за день — 1 гость и 50 визитов, на следующий день — новый ключ. IP не хранится, ключ не считается доказанным человеком и не является аккаунтом; ключи, за которыми в тот же день был вход в аккаунт, исключены. Визиты, сессии, устройства и домохозяйства — отдельные метрики.',
    liveFeed: 'Лента — реальные события сегодня (по часовому поясу отчёта): действия пользователей с согласием, платежи магазина, новые аккаунты и обезличенные счётчики визитов по часам. Показаны только страна, платформа, язык, лотерея/функция, статус и 8-значный псевдоним; e-mail, IP и идентификаторы устройств не существуют в этих данных. Владелец и боты скрыты, пока не включены переключатели.'
  };

  var state = {
    section: 'overview',
    preset: 'day',
    day: LIB.todayYMD ? LIB.todayYMD('Europe/Oslo') : '',
    block: null,
    tz: 'Europe/Oslo',
    custom: { from: '', to: '' },
    filters: { platform: 'all', country: 'all', lottery: 'all', audience: 'all' },
    toggles: { owner: false, bots: false, unknown: true },
    compare: true,
    page: 0,
    peopleKind: 'all',
    mapMetric: 'visits_human',
    continent: 'all',
    selectedCountry: null,
    kpiError: null,
    busy: false,
    refreshing: false,
    lastRefresh: null,
    data: {},
    error: null
  };
  var ovEl = null, mapApi = null, livePoll = null, hourglassTimer = null, mapLoading = false;

  // ── api ────────────────────────────────────────────────────────────────────────────────────
  async function api(payload) {
    var session = null;
    try { if (W.LotoAuth && W.LotoAuth.getSession) session = await W.LotoAuth.getSession(); } catch (e) {}
    var headers = { 'Content-Type': 'application/json', 'apikey': APIKEY };
    if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    var response = await fetch(BASE + '/functions/v1/owner-analytics', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    var body = null;
    try { body = await response.json(); } catch (e) {}
    if (!response.ok) {
      var error = new Error((body && (body.error || body.detail)) || ('HTTP ' + response.status));
      error.status = response.status;
      error.code = body && body.code ? String(body.code) : '';
      throw error;
    }
    return body;
  }
  async function isOwner() {
    try { var r = await api({ probe: true }); return r && r.owner === true; } catch (e) { return false; }
  }
  function currentRange() {
    if (state.preset === 'day' && LIB.dayRange) return LIB.dayRange(state.day, state.tz);
    var r = LIB.range ? LIB.range(state.preset, Date.now(), state.tz, state.custom.from, state.custom.to) : null;
    return r || { from: new Date(Date.now() - 7 * 86400000).toISOString(), to: new Date().toISOString(), bucket: 'day', tz: state.tz };
  }
  function params(extra) {
    var range = currentRange();
    var payload = {
      from: range.from, to: range.to, tz: range.tz, bucket: range.bucket,
      platform: state.filters.platform, country: state.filters.country, lottery: state.filters.lottery,
      audience: state.filters.audience,
      include_owner: state.toggles.owner, include_bots: state.toggles.bots, include_unknown: state.toggles.unknown
    };
    if (state.compare && range.prev_from) { payload.prev_from = range.prev_from; payload.prev_to = range.prev_to; }
    return Object.assign(payload, extra || {});
  }

  // ── formatting ─────────────────────────────────────────────────────────────────────────────
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function num(value) { var n = +value || 0; return n.toLocaleString('ru-RU'); }
  function dur(ms) { return LIB.formatDuration ? LIB.formatDuration(ms) : Math.round((+ms || 0) / 1000) + ' с'; }
  function pctText(part, total) { return total ? Math.round((part / total) * 100) + '%' : '—'; }
  function timeText(value) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('ru-RU', { timeZone: state.tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(value); }
  }
  function clockText(value) {
    try { return new Date(value).toLocaleTimeString('ru-RU', { timeZone: state.tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch (e) { return ''; }
  }
  function label(map, key) { return (map && map[key]) || key || '—'; }
  function place(row) {
    var parts = [];
    if (row.city) parts.push(row.city);
    if (row.region && row.region !== row.city) parts.push(row.region);
    if (row.country) parts.push(LIB.countryNameRu ? LIB.countryNameRu(row.country) : row.country);
    return parts.length ? parts.join(' · ') : 'Место не определено';
  }
  function confidenceChip(value, evidence) {
    var c = LIB.confidence ? LIB.confidence(value) : { value: value, label: '', tone: 'mid' };
    var tip = (evidence || []).map(function (e) { return LIB.evidenceRu ? LIB.evidenceRu(e) : e; }).join(' · ');
    return '<span class="ow-conf ow-conf-' + c.tone + '" title="' + esc(c.label + (tip ? ': ' + tip : '')) + '">' + c.value + '</span>';
  }
  function how(key) {
    return '<button class="ow-how" type="button" data-how="' + esc(key) + '" aria-label="Как считается">i</button>';
  }
  function card(title, value, sub, howKey, delta) {
    return '<div class="ow-card">' +
      '<div class="ow-card-h"><span>' + esc(title) + '</span>' + (howKey ? how(howKey) : '') + '</div>' +
      '<div class="ow-card-v">' + value + '</div>' +
      (delta ? '<div class="ow-card-d ' + delta.dir + '">' + delta.text + '</div>' : '') +
      (sub ? '<div class="ow-card-s">' + sub + '</div>' : '') + '</div>';
  }
  function deltaOf(current, previous) {
    if (previous == null || previous === 0) return null;
    var change = LIB.pctChange ? LIB.pctChange(current, previous) : null;
    if (!change) return null;
    var arrow = change.dir === 'up' ? '▲' : change.dir === 'down' ? '▼' : '■';
    return { dir: change.dir, text: arrow + ' ' + Math.abs(Math.round(change.pct)) + '% к прошлому периоду (' + num(previous) + ')' };
  }
  function table(columns, rows, empty) {
    if (!rows || !rows.length) return '<div class="ow-empty">' + esc(empty || 'Нет данных за период') + '</div>';
    return '<div class="ow-tw"><table class="ow-t"><thead><tr>' +
      columns.map(function (c) { return '<th' + (c.numeric ? ' class="num"' : '') + '>' + esc(c.title) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (row, index) {
        var cls = (row.__click ? 'ow-click ' : '') + (row.__class || '');
        return '<tr' + (cls.trim() ? ' class="' + esc(cls.trim()) + '"' : '') + (row.__click ? ' data-row="' + index + '"' : '') + '>' +
          columns.map(function (c) { return '<td' + (c.numeric ? ' class="num"' : '') + '>' + (c.html ? c.html(row) : esc(row[c.key])) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function barList(entries, labels, howKey, title) {
    var rows = Object.keys(entries || {}).map(function (key) { return { key: key, value: +entries[key] || 0 }; })
      .sort(function (a, b) { return b.value - a.value; });
    var max = rows.reduce(function (m, r) { return Math.max(m, r.value); }, 0);
    if (!rows.length) return '<div class="ow-empty">Нет данных за период</div>';
    return '<div class="ow-block"><div class="ow-block-h">' + esc(title || '') + (howKey ? how(howKey) : '') + '</div>' +
      rows.map(function (row) {
        return '<div class="ow-bar"><span class="ow-bar-l">' + esc(label(labels, row.key)) + '</span>' +
          '<span class="ow-bar-t"><i style="width:' + (max ? Math.max(2, Math.round((row.value / max) * 100)) : 0) + '%"></i></span>' +
          '<span class="ow-bar-v">' + num(row.value) + '</span></div>';
      }).join('') + '</div>';
  }
  function chartColors() {
    return (ovEl && ovEl.getAttribute('data-ow-theme') === 'dark')
      ? ['#6fb7ff', '#5eead4', '#c4b5fd']
      : ['#1d4ed8', '#0891b2', '#7c3aed'];
  }
  function lineChart(series, keys, titles) {
    if (!series || series.length < 2) return '<div class="ow-empty">Для графика нужно минимум две точки</div>';
    var width = 720, height = 190, padLeft = 42, padBottom = 26, padTop = 12;
    var max = 0;
    series.forEach(function (point) { keys.forEach(function (key) { max = Math.max(max, +point[key] || 0); }); });
    max = max || 1;
    var stepX = (width - padLeft - 10) / Math.max(1, series.length - 1);
    var colors = chartColors();
    var paths = keys.map(function (key, index) {
      var d = series.map(function (point, i) {
        var x = padLeft + i * stepX;
        var y = padTop + (height - padTop - padBottom) * (1 - (+point[key] || 0) / max);
        return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }).join(' ');
      return '<path d="' + d + '" fill="none" stroke="' + colors[index % colors.length] + '" stroke-width="2.2" stroke-linejoin="round"/>';
    }).join('');
    var ticks = [0, 0.5, 1].map(function (fraction) {
      var y = padTop + (height - padTop - padBottom) * (1 - fraction);
      return '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (width - 10) + '" y2="' + y + '" class="ow-grid"/>' +
        '<text x="6" y="' + (y + 4) + '" class="ow-axis">' + num(Math.round(max * fraction)) + '</text>';
    }).join('');
    var labels = series.map(function (point, i) {
      if (series.length > 8 && i % Math.ceil(series.length / 8) !== 0) return '';
      var x = padLeft + i * stepX;
      return '<text x="' + x + '" y="' + (height - 8) + '" class="ow-axis" text-anchor="middle">' + esc(String(point.bucket).slice(5)) + '</text>';
    }).join('');
    var legend = keys.map(function (key, index) {
      return '<span><i style="background:' + colors[index % colors.length] + '"></i>' + esc(titles[index]) + '</span>';
    }).join('');
    return '<div class="ow-chart"><svg viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="none" role="img" aria-label="График">' +
      ticks + paths + labels + '</svg><div class="ow-legend">' + legend + '</div></div>';
  }

  // ── styles ─────────────────────────────────────────────────────────────────────────────────
  function resolveTheme() {
    var stored = null;
    try { stored = W.localStorage.getItem(THEME_KEY); } catch (e) {}
    if (stored === 'light' || stored === 'dark') return stored;
    try { if (D.body && D.body.classList.contains('dark')) return 'dark'; } catch (e) {}
    try { return W.matchMedia && W.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function ensureStyles() {
    if (D.getElementById('ow-style')) return;
    var css = [
      '#ow-ov{position:fixed;inset:0;z-index:1300;display:none;background:var(--ow-bg);color:var(--ow-tx);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '#ow-ov.show{display:flex;flex-direction:column}',
      // «Голубая» — the original soft light-blue palette of the owner analytics (commit 6235a66), restored.
      '#ow-ov[data-ow-theme="light"]{--ow-bg:#e8f2fc;--ow-card:#ffffff;--ow-card2:#d7e9fb;--ow-tx:#0d2540;--ow-sub:#3f6690;--ow-bd:#bcd7f2;--ow-accent:#1d4ed8;--ow-up:#0f7a4d;--ow-down:#c62a5a;--ow-chip:#e3effc}',
      // Night variant of the same character: deep blue surfaces, luminous blue accent.
      '#ow-ov[data-ow-theme="dark"]{--ow-bg:#0b1624;--ow-card:#12223a;--ow-card2:#0f1c30;--ow-tx:#e6f0fb;--ow-sub:#8fb0d6;--ow-bd:#22405f;--ow-accent:#4f8ff7;--ow-up:#5ad19a;--ow-down:#f2789a;--ow-chip:#183050}',
      '#ow-ov .ow-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--ow-bd);background:var(--ow-card);min-width:0}',
      '#ow-ov .ow-title{font-weight:800;font-size:16px;margin-right:auto;min-width:0;flex:1 1 140px}',
      '#ow-ov .ow-btn{min-height:34px;padding:6px 12px;border-radius:10px;border:1px solid var(--ow-bd);background:var(--ow-card2);color:inherit;font:inherit;font-weight:700;cursor:pointer}',
      '#ow-ov .ow-btn[disabled]{opacity:.6;cursor:progress}',
      '#ow-ov .ow-btn-primary{background:var(--ow-accent);border-color:var(--ow-accent);color:#fff}',
      // The owner bell inside the panel header (the public header has no owner bell at all).
      '#ow-ov .ow-bell{position:relative;padding:6px 10px;line-height:1}',
      '#ow-ov .ow-bell .ow-bell-ico{font-size:16px}',
      '#ow-ov .ow-bell.has-unread{border-color:var(--ow-accent);box-shadow:0 0 0 1px var(--ow-accent) inset}',
      '#ow-ov .ow-bell-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:var(--ow-accent);color:#fff;font-size:11px;font-weight:800;line-height:18px;text-align:center}',
      '#ow-ov .ow-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--ow-bd);background:var(--ow-card2)}',
      '#ow-ov select,#ow-ov input[type="date"]{min-height:32px;padding:4px 8px;border-radius:9px;border:1px solid var(--ow-bd);background:var(--ow-card);color:inherit;font:inherit}',
      '#ow-ov .ow-toggle{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:9px;border:1px solid var(--ow-bd);background:var(--ow-card);cursor:pointer}',
      '#ow-ov .ow-tabs{display:flex;gap:6px;overflow-x:auto;padding:8px 14px;border-bottom:1px solid var(--ow-bd);background:var(--ow-card)}',
      '#ow-ov .ow-tab{white-space:nowrap;padding:6px 12px;border-radius:999px;border:1px solid var(--ow-bd);background:var(--ow-card2);cursor:pointer;font-weight:700;color:inherit;font:inherit}',
      '#ow-ov .ow-tab[aria-selected="true"]{background:var(--ow-accent);border-color:var(--ow-accent);color:#fff}',
      '#ow-ov .ow-body{flex:1;overflow:auto;padding:14px;position:relative;min-width:0}',
      '#ow-ov .ow-controls{min-width:0}#ow-ov .ow-controls label{max-width:100%;min-width:0}',
      '#ow-ov select,#ow-ov input[type="date"]{max-width:100%}',
      '#ow-ov .ow-tabs{min-width:0;max-width:100%}',
      '#ow-ov .ow-cards,#ow-ov .ow-block,#ow-ov .ow-chart{min-width:0}',
      '@media (max-width:719px){#ow-ov .ow-status{flex:1 1 100%;margin-left:0;text-align:left}#ow-ov .ow-top .ow-btn{flex:1 1 auto}}',
      '#ow-ov .ow-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}',
      '#ow-ov .ow-card{background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:12px}',
      '#ow-ov .ow-card-h{display:flex;align-items:center;gap:6px;color:var(--ow-sub);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;flex-wrap:wrap}',
      // Long uppercase titles («Зарегистрированные») must wrap inside a narrow card, never push the info button out of it.
      '#ow-ov .ow-card-h > span:first-child{min-width:0;flex:1 1 auto;overflow-wrap:anywhere}',
      '#ow-ov .ow-card-v{font-size:26px;font-weight:800;margin-top:6px;overflow-wrap:anywhere}',
      '#ow-ov .ow-card-s{color:var(--ow-sub);font-size:12px;margin-top:4px}',
      '#ow-ov .ow-card-d{font-size:12px;font-weight:700;margin-top:4px}',
      '#ow-ov .ow-card-d.up{color:var(--ow-up)}#ow-ov .ow-card-d.down{color:var(--ow-down)}#ow-ov .ow-card-d.stable{color:var(--ow-sub)}',
      '#ow-ov .ow-how{width:18px;height:18px;border-radius:50%;border:1px solid var(--ow-bd);background:var(--ow-chip);color:var(--ow-sub);font:700 11px/1 system-ui;cursor:pointer;flex:0 0 auto}',
      '#ow-ov .ow-block{background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:12px;margin-top:12px}',
      '#ow-ov .ow-block-h{display:flex;align-items:center;gap:6px;font-weight:800;margin-bottom:8px}',
      '#ow-ov .ow-bar{display:grid;grid-template-columns:minmax(120px,1fr) 2fr auto;gap:8px;align-items:center;margin:4px 0}',
      '#ow-ov .ow-bar-t{height:10px;border-radius:6px;background:var(--ow-chip);overflow:hidden}',
      '#ow-ov .ow-bar-t i{display:block;height:100%;background:var(--ow-accent)}',
      '#ow-ov .ow-bar-v{font-weight:700;min-width:54px;text-align:right}',
      '#ow-ov .ow-tw{overflow:auto;max-width:100%}',
      '#ow-ov table.ow-t{width:100%;border-collapse:collapse;font-size:13px}',
      '#ow-ov table.ow-t th,#ow-ov table.ow-t td{padding:7px 8px;border-bottom:1px solid var(--ow-bd);text-align:left;white-space:nowrap}',
      '#ow-ov table.ow-t th{color:var(--ow-sub);font-size:11px;text-transform:uppercase;letter-spacing:.03em;position:sticky;top:0;background:var(--ow-card)}',
      '#ow-ov table.ow-t td.num,#ow-ov table.ow-t th.num{text-align:right;font-variant-numeric:tabular-nums}',
      '#ow-ov tr.ow-click{cursor:pointer}#ow-ov tr.ow-click:hover{background:var(--ow-card2)}',
      '#ow-ov .ow-empty{color:var(--ow-sub);padding:14px;text-align:center}',
      '#ow-ov .ow-conf{display:inline-block;min-width:30px;padding:1px 6px;border-radius:7px;font-weight:800;font-size:12px;text-align:center}',
      '#ow-ov .ow-conf-high{background:rgba(90,209,154,.22);color:var(--ow-up)}',
      '#ow-ov .ow-conf-good{background:rgba(90,209,154,.14);color:var(--ow-up)}',
      '#ow-ov .ow-conf-mid{background:rgba(242,193,78,.22);color:#a8730b}',
      '#ow-ov .ow-conf-low{background:rgba(242,120,154,.2);color:var(--ow-down)}',
      '#ow-ov .ow-chart{background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:10px;margin-top:12px}',
      '#ow-ov .ow-chart svg{width:100%;height:190px}',
      '#ow-ov .ow-grid{stroke:var(--ow-bd);stroke-width:1}',
      '#ow-ov text.ow-axis{fill:var(--ow-sub);font-size:10px}',
      '#ow-ov .ow-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--ow-sub);font-size:12px;margin-top:6px}',
      '#ow-ov .ow-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}',
      '#ow-ov .ow-load{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:8px;background:color-mix(in srgb,var(--ow-bg) 78%,transparent);z-index:5}',
      '#ow-ov .ow-load.show{display:flex}',
      '#ow-ov .ow-hg{font-size:34px;line-height:1}',
      '#ow-ov .ow-stages{color:var(--ow-sub);font-size:12px;text-align:center;max-width:280px}',
      '#ow-ov .ow-status{color:var(--ow-sub);font-size:12px;margin-left:auto;text-align:right}',
      '#ow-ov .ow-err{background:rgba(242,120,154,.14);border:1px solid var(--ow-down);border-radius:12px;padding:10px;margin-top:10px;display:flex;gap:10px;align-items:center}',
      '#ow-ov .ow-map{height:min(70vh,560px);border-radius:14px;overflow:hidden;border:1px solid var(--ow-bd);margin-top:10px;background:var(--ow-card2)}',
      // A phone shows the whole world in a short, wide box instead of a tall box with a tiny world in it.
      '@media (max-width:719px){#ow-ov .ow-map{height:min(48vh,340px)}}',
      '#ow-ov .ow-map-note{color:var(--ow-sub);font-size:12px;margin-top:6px}',
      '#ow-ov .ow-pop{position:fixed;inset:auto 12px 12px 12px;max-width:560px;margin:0 auto;background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);z-index:20}',
      '#ow-ov .ow-pop h3{margin:0 0 6px;font-size:14px}',
      '#ow-ov .ow-pop p{margin:0;color:var(--ow-sub);font-size:13px}',
      '#ow-ov .ow-sheet{position:fixed;inset:0;background:rgba(8,4,8,.55);display:flex;align-items:flex-end;justify-content:center;z-index:30}',
      '#ow-ov .ow-sheet-in{background:var(--ow-card);border-radius:16px 16px 0 0;width:min(760px,100%);max-height:88vh;overflow:auto;padding:14px}',
      '@media (min-width:720px){#ow-ov .ow-sheet{align-items:center}#ow-ov .ow-sheet-in{border-radius:16px}}',
      '#ow-ov .ow-jr{display:grid;grid-template-columns:64px 1fr;gap:8px;padding:5px 0;border-bottom:1px solid var(--ow-bd);font-size:13px}',
      '#ow-ov .ow-jr b{font-variant-numeric:tabular-nums;color:var(--ow-sub);font-weight:700}',
      '#ow-ov .ow-deny{padding:30px;text-align:center}',
      // KPI precision tags, empty states, map legend / tooltip / country card
      '#ow-ov .ow-tag{display:inline-block;margin-left:auto;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:800;text-transform:none;letter-spacing:0;background:var(--ow-chip);color:var(--ow-sub);white-space:nowrap}',
      '#ow-ov .ow-tag-exact{color:var(--ow-up)}#ow-ov .ow-tag-estimate{color:#a8730b}',
      '#ow-ov .ow-kpi-none{font-size:15px;font-weight:700;color:var(--ow-sub);margin-top:10px}',
      '#ow-ov .ow-kpi-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px}',
      '#ow-ov .ow-kpi-h h2{font-size:15px;margin:0 8px 0 0}',
      '#ow-ov .ow-legend-scale{display:flex;align-items:center;gap:4px;margin-top:8px;color:var(--ow-sub);font-size:12px;flex-wrap:wrap}',
      '#ow-ov .ow-legend-scale i{display:inline-block;width:22px;height:12px;border-radius:3px;border:1px solid var(--ow-bd)}',
      '#ow-ov .ow-map{position:relative}',
      '#ow-ov .ow-map-tip{position:absolute;left:0;top:0;pointer-events:none;background:var(--ow-card);color:var(--ow-tx);border:1px solid var(--ow-bd);border-radius:10px;padding:6px 9px;font-size:12px;line-height:1.4;box-shadow:0 8px 24px rgba(13,37,64,.18);z-index:4;max-width:240px}',
      '#ow-ov .ow-map-tip[hidden]{display:none}',
      '#ow-ov .ow-block-h{flex-wrap:wrap}#ow-ov .ow-block-h select{max-width:46vw}',
      '#ow-ov .ow-country-h{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:800;margin-bottom:8px;flex-wrap:wrap}',
      '#ow-ov .ow-country-h .ow-flag{font-size:28px;line-height:1}',
      '#ow-ov .ow-country-h code{font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--ow-chip);padding:3px 6px;border-radius:6px}',
      '#ow-ov .ow-sheet-in .ow-cards{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}',
      // 2026-09-20: calendar bar, chips, comparison deltas, day header, LIVE feed
      '#ow-ov .ow-daybar{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap}',
      '#ow-ov .ow-daybar[hidden]{display:none}',
      '#ow-ov .ow-chip{min-height:32px;padding:4px 11px;border-radius:999px;border:1px solid var(--ow-bd);background:var(--ow-card);color:inherit;font:inherit;font-weight:700;cursor:pointer}',
      '#ow-ov .ow-chip[aria-pressed="true"]{background:var(--ow-accent);border-color:var(--ow-accent);color:#fff}',
      '#ow-ov .ow-daynav{min-width:34px;padding:4px 8px}',
      '#ow-ov .ow-dayhead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 10px}',
      '#ow-ov .ow-dayhead h2{margin:0;font-size:20px}',
      '#ow-ov .ow-dayhead .ow-card-s{font-size:13px}',
      '#ow-ov .ow-cmp{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;font-size:11.5px;color:var(--ow-sub);line-height:1.35}',
      '#ow-ov .ow-cmp b{font-weight:800}',
      '#ow-ov .ow-cmp .up{color:var(--ow-up)}#ow-ov .ow-cmp .down{color:var(--ow-down)}',
      '#ow-ov .ow-block[id^="ow-b-"]{scroll-margin-top:12px}',
      '#ow-ov .ow-block.ow-focus{outline:2px solid var(--ow-accent);outline-offset:2px}',
      '#ow-ov .ow-anchors{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
      '#ow-ov .ow-anchors a{color:var(--ow-accent);text-decoration:none;font-size:12px;font-weight:700;padding:3px 9px;border:1px solid var(--ow-bd);border-radius:999px;background:var(--ow-card)}',
      '#ow-ov .ow-status-chip{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:800;background:var(--ow-chip);color:var(--ow-sub);white-space:nowrap}',
      '#ow-ov .ow-status-pro,#ow-ov .ow-status-lifetime{background:rgba(90,209,154,.2);color:var(--ow-up)}',
      '#ow-ov .ow-status-owner{background:rgba(242,193,78,.25);color:#a8730b}',
      '#ow-ov .ow-status-expired{background:rgba(242,120,154,.18);color:var(--ow-down)}',
      '#ow-ov .ow-feed-commerce td{background:rgba(90,209,154,.08)}',
      '#ow-ov .ow-feed-account td{background:rgba(79,143,247,.09)}',
      '#ow-ov .ow-feed-visits td{color:var(--ow-sub)}',
      '#ow-ov .ow-live-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ow-up);margin-right:6px;animation:ow-pulse 1.6s ease-in-out infinite}',
      '@keyframes ow-pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '@media(prefers-reduced-motion:reduce){#ow-ov .ow-live-dot{animation:none}}'
    ].join('\n');
    var style = D.createElement('style');
    style.id = 'ow-style';
    style.textContent = css;
    (D.head || D.documentElement).appendChild(style);
  }

  // ── shell ──────────────────────────────────────────────────────────────────────────────────
  function build() {
    if (ovEl) return ovEl;
    ensureStyles();
    ovEl = D.createElement('div');
    ovEl.id = 'ow-ov';
    ovEl.setAttribute('data-i18n-ignore', '');
    ovEl.setAttribute('data-ow-theme', resolveTheme());
    ovEl.innerHTML =
      '<div class="ow-top">' +
        '<button class="ow-btn" id="ow-back" type="button">‹ Назад</button>' +
        '<span class="ow-title">Аналитика — реальная аудитория</span>' +
        // The owner analytics bell lives HERE, inside the owner panel — never in the public header.
        // owner-notifications.js reveals it after the server owner probe and owns its badge.
        '<button class="ow-btn ow-bell" id="owner-bell-btn" type="button" hidden aria-label="Уведомления владельца">' +
          '<span class="ow-bell-ico" aria-hidden="true">🔔</span>' +
          '<span class="ow-bell-badge" id="owner-bell-badge" hidden aria-hidden="true">0</span></button>' +
        '<button class="ow-btn" id="ow-theme" type="button">Тема</button>' +
        '<button class="ow-btn" id="ow-export" type="button">Экспорт</button>' +
        '<button class="ow-btn ow-btn-primary" id="ow-refresh" type="button">Обновить</button>' +
      '</div>' +
      '<div class="ow-controls">' +
        '<label>Период <select id="ow-preset"></select></label>' +
        '<span id="ow-daybar" class="ow-daybar" role="group" aria-label="Календарь">' +
          '<button class="ow-chip" type="button" data-day="0">Сегодня</button>' +
          '<button class="ow-chip" type="button" data-day="-1">Вчера</button>' +
          '<button class="ow-chip" type="button" data-day="-2">Позавчера</button>' +
          '<button class="ow-btn ow-daynav" type="button" id="ow-day-prev" aria-label="Предыдущий день">‹</button>' +
          '<input type="date" id="ow-day" aria-label="Дата" max="2099-12-31" min="2026-01-01">' +
          '<button class="ow-btn ow-daynav" type="button" id="ow-day-next" aria-label="Следующий день">›</button>' +
        '</span>' +
        '<span id="ow-custom" hidden><input type="date" id="ow-from"> — <input type="date" id="ow-to"></span>' +
        '<label>Часовой пояс <select id="ow-tz"></select></label>' +
        '<label>Платформа <select id="ow-platform"><option value="all">Все</option><option value="web">Веб</option><option value="ios">iOS</option><option value="android">Android</option></select></label>' +
        '<label>Лотерея <select id="ow-lottery"><option value="all">Все</option></select></label>' +
        '<label>Аудитория <select id="ow-audience">' + AUDIENCES.map(function (a) { return '<option value="' + a[0] + '">' + esc(a[1]) + '</option>'; }).join('') + '</select></label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-compare" checked> Сравнить с прошлым периодом</label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-owner"> Включить владельца / тесты</label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-bots"> Включить ботов</label>' +
        '<label class="ow-toggle"><input type="checkbox" id="ow-unknown" checked> Включить неизвестных</label>' +
        '<span class="ow-status" id="ow-status"></span>' +
      '</div>' +
      '<div class="ow-tabs" id="ow-tabs" role="tablist"></div>' +
      '<div class="ow-body" id="ow-content">' +
        '<div class="ow-load" id="ow-load"><div class="ow-hg" id="ow-hg">⏳</div><div class="ow-stages" id="ow-stages">Загрузка…</div></div>' +
        '<div id="ow-section"></div>' +
      '</div>';
    D.body.appendChild(ovEl);
    // The panel is a body-level "-ov" overlay built lazily, so the shell's modal manager has to be
    // told about it: __lotoClose routes an external close (another modal opening, Escape, native
    // back) through the REAL close(), which releases the scroll lock and stops the live poll, the
    // map and the owner notification centre. Without this the manager stripped .show behind our
    // back and the page stayed locked with the panel's timers running.
    ovEl.__lotoClose = function (reason) {
      // Escape closes the notification centre first (it is nested inside this panel), the panel next.
      try {
        if (reason === 'escape' && W.LotoOwnerNotifications && W.LotoOwnerNotifications._state().open) {
          W.LotoOwnerNotifications.close();
          return;
        }
      } catch (e) {}
      close();
    };
    try { if (W.LotoModals && W.LotoModals.register) W.LotoModals.register(ovEl); } catch (e) {}

    var presetSelect = ovEl.querySelector('#ow-preset');
    presetSelect.innerHTML = PRESETS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === state.preset ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('');
    syncControls();
    var zones = (LIB.ZONES || ['Europe/Oslo', 'UTC']).slice();
    try {
      var local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (local && zones.indexOf(local) < 0) zones.push(local);
    } catch (e) {}
    ovEl.querySelector('#ow-tz').innerHTML = zones.map(function (z) { return '<option value="' + esc(z) + '"' + (z === state.tz ? ' selected' : '') + '>' + esc(z) + '</option>'; }).join('');
    ovEl.querySelector('#ow-tabs').innerHTML = SECTIONS.map(function (s) {
      return '<button class="ow-tab" role="tab" data-section="' + s.id + '" aria-selected="' + (s.id === state.section) + '">' + esc(s.label) + '</button>';
    }).join('');
    wire();
    return ovEl;
  }

  function setHourglass(on, message) {
    var load = ovEl.querySelector('#ow-load');
    var stages = ovEl.querySelector('#ow-stages');
    if (message) stages.textContent = message;
    load.classList.toggle('show', !!on);
    if (on && !hourglassTimer) {
      var flip = false;
      hourglassTimer = setInterval(function () {
        flip = !flip;
        var hg = ovEl.querySelector('#ow-hg');
        if (hg) hg.textContent = flip ? '⌛' : '⏳';
      }, 520);
    }
    if (!on && hourglassTimer) { clearInterval(hourglassTimer); hourglassTimer = null; }
  }
  function setStatus(text) { var el = ovEl.querySelector('#ow-status'); if (el) el.innerHTML = text; }

  // ── data loading ───────────────────────────────────────────────────────────────────────────
  async function load(section, extra) {
    if (state.busy) return null;                        // never two requests for the same view
    state.busy = true;
    state.error = null;
    setHourglass(true, 'Загрузка раздела…');
    try {
      var response = await api({ section: section, params: params(extra) });
      state.data[section] = response;
      return response;
    } catch (error) {
      state.error = error;
      return null;
    } finally {
      state.busy = false;
      setHourglass(false);
    }
  }
  // Overview = its own section + the KPI block; the map = the batch of country rows. Each request
  // fails on its own: a KPI failure never hides the overview, and vice versa.
  async function loadMany(sections, extra) {
    if (state.busy) return null;
    state.busy = true;
    state.error = null;
    state.kpiError = null;
    setHourglass(true, 'Загрузка раздела…');
    try {
      var settled = await Promise.allSettled(sections.map(function (name) { return api({ section: name, params: params(extra) }); }));
      settled.forEach(function (outcome, index) {
        var name = sections[index];
        if (outcome.status === 'fulfilled') { state.data[name] = outcome.value; return; }
        state.data[name] = null;
        if (name === 'kpi') state.kpiError = outcome.reason;
        else state.error = outcome.reason;
      });
      return settled;
    } finally {
      state.busy = false;
      setHourglass(false);
    }
  }
  async function show(section, extra) {
    state.section = section;
    ovEl.querySelectorAll('.ow-tab').forEach(function (tab) {
      tab.setAttribute('aria-selected', String(tab.getAttribute('data-section') === section));
    });
    stopLive();
    if (section === 'overview') await loadMany(['overview', 'kpi'], extra);
    else if (section === 'map') { await loadMany(['countries'], extra); state.data.map = state.data.countries; }
    else await load(section, extra);
    render();
    if (section === 'live') startLive();
    if (section === 'map') mountMap();
    focusBlock();
  }
  // Deep links (#owner?d=…&s=day&b=commerce) land on a block of the day report.
  function focusBlock() {
    if (!state.block) return;
    var block = state.block;
    state.block = null;
    var el = ovEl.querySelector('#ow-b-' + block.replace(/[^a-z_]/g, ''));
    if (!el) return;
    try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    el.classList.add('ow-focus');
    setTimeout(function () { el.classList.remove('ow-focus'); }, 2600);
  }
  // Keep the calendar bar, the preset select and the date input in step with the state.
  function syncControls() {
    if (!ovEl) return;
    var preset = ovEl.querySelector('#ow-preset'); if (preset) preset.value = state.preset;
    var bar = ovEl.querySelector('#ow-daybar'); if (bar) bar.hidden = state.preset !== 'day';
    var custom = ovEl.querySelector('#ow-custom'); if (custom) custom.hidden = state.preset !== 'custom';
    var input = ovEl.querySelector('#ow-day'); if (input && state.day) input.value = state.day;
    var today = LIB.todayYMD ? LIB.todayYMD(state.tz) : '';
    var next = ovEl.querySelector('#ow-day-next'); if (next) next.disabled = !!today && state.day >= today;
    ovEl.querySelectorAll('.ow-chip[data-day]').forEach(function (chip) {
      var target = LIB.shiftDay ? LIB.shiftDay(today, +chip.getAttribute('data-day')) : null;
      chip.setAttribute('aria-pressed', String(state.preset === 'day' && !!target && target === state.day));
    });
    var tz = ovEl.querySelector('#ow-tz'); if (tz) tz.value = state.tz;
  }
  function setDay(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
    state.preset = 'day';
    state.day = ymd;
    state.data = {};
    state.page = 0;
    syncControls();
    reload();
  }
  function reload() { return show(state.section); }

  // ── refresh with real stages ───────────────────────────────────────────────────────────────
  async function refresh() {
    if (state.refreshing) return;
    state.refreshing = true;
    var button = ovEl.querySelector('#ow-refresh');
    button.disabled = true;
    button.textContent = 'Обновление…';
    setHourglass(true, 'Получение свежих событий…');
    try {
      var result = await api({ refresh: true });
      var run = (result && result.refresh && result.refresh.run) || {};
      var stages = run.stage_ms || {};
      var order = [['sessions', 'Сессии'], ['profiles', 'Профили'], ['devices', 'Устройства'], ['households', 'Домохозяйства'], ['people', 'Люди'], ['summaries', 'Сводки']];
      setHourglass(true, order.filter(function (s) { return stages[s[0]] != null; })
        .map(function (s) { return s[1] + ' ✓ ' + stages[s[0]] + ' мс'; }).join(' · ') || 'Идентификация…');
      state.data = {};
      state.busy = false;
      if (mapApi) { mapApi.destroy(); mapApi = null; }
      await show(state.section);
      var added = [];
      if (result.refresh.new_events) added.push('+' + num(result.refresh.new_events) + ' событий');
      if (result.refresh.new_sessions) added.push('+' + num(result.refresh.new_sessions) + ' сессий');
      state.lastRefresh = new Date();
      setStatus('Обновлено ' + clockText(state.lastRefresh) + (added.length ? ' · ' + added.join(' · ') : '') +
        (run.events_scanned != null ? ' · обработано ' + num(run.events_scanned) : ''));
    } catch (error) {
      setStatus('<span style="color:var(--ow-down)">Не удалось обновить: ' + esc(error.message || 'ошибка') + '</span>');
      renderError(error, refresh);
    } finally {
      setHourglass(false);
      button.disabled = false;
      button.textContent = 'Обновить';
      state.refreshing = false;
    }
  }

  // The owner gets a sentence and a code that says which part failed; the details stay in the logs.
  var ERROR_TEXT = {
    REPORT_COMPARE_FAILED: 'Не удалось посчитать сравнение с прошлым периодом.',
    REPORT_SECTION_FAILED: 'Не удалось загрузить этот раздел.',
    REPORT_QUERY_FAILED: 'Не удалось загрузить отчёт.',
    REPORT_TIMEOUT: 'Отчёт считался слишком долго. Попробуйте более короткий период.'
  };
  function errorText(error) {
    var code = error && error.code;
    if (code && ERROR_TEXT[code]) return ERROR_TEXT[code] + ' Код: ' + code;
    if (error && error.status === 403) return 'Нет доступа к панели владельца.';
    if (error && /Failed to fetch|NetworkError|load failed/i.test(error.message || '')) return 'Нет связи с сервером. Проверьте соединение.';
    return 'Ошибка: ' + ((error && error.message) || 'неизвестно');
  }

  function renderError(error, retry) {
    var host = ovEl.querySelector('#ow-section');
    var box = D.createElement('div');
    box.className = 'ow-err';
    box.innerHTML = '<span>' + esc(errorText(error)) + '</span>';
    var button = D.createElement('button');
    button.className = 'ow-btn';
    button.type = 'button';
    button.textContent = 'Повторить';
    button.addEventListener('click', function () { box.remove(); (retry || reload)(); });
    box.appendChild(button);
    host.prepend(box);
  }

  // ── live ───────────────────────────────────────────────────────────────────────────────────
  function startLive() {
    stopLive();
    livePoll = setInterval(async function () {
      if (state.section !== 'live' || D.hidden || state.busy || state.refreshing) return;
      await load('live');
      if (state.section === 'live') render();
    }, 15000);
  }
  function stopLive() { if (livePoll) { clearInterval(livePoll); livePoll = null; } }

  // ── map ────────────────────────────────────────────────────────────────────────────────────
  function countryRows() {
    var response = state.data.countries;
    return (response && response.data && Array.isArray(response.data.rows)) ? response.data.rows : [];
  }
  function worldMeta(iso) {
    try { return (mapApi && mapApi.world && mapApi.world.meta[iso]) || null; } catch (e) { return null; }
  }
  function countryName(iso) {
    if (!iso || iso === 'ZZ') return 'Не определено';
    var fromCatalog = LIB.countryNameRu ? LIB.countryNameRu(iso) : iso;
    if (fromCatalog !== iso) return fromCatalog;
    var meta = worldMeta(iso);
    return (meta && (meta.ru || meta.n)) || iso;
  }
  // «территория Норвегии» for a dependency drawn as its own feature (SJ → NO, GF → FR, TK → NZ).
  function parentNote(iso) {
    var meta = worldMeta(iso);
    return meta && meta.parent ? 'территория: ' + countryName(meta.parent) : '';
  }
  function continentOf(iso) {
    try { return (mapApi && mapApi.world && mapApi.world.meta[iso] && mapApi.world.meta[iso].c) || null; } catch (e) { return null; }
  }
  function metricLabel(metric) {
    for (var i = 0; i < MAP_METRICS.length; i++) if (MAP_METRICS[i][0] === metric) return MAP_METRICS[i][1];
    return metric;
  }
  // Compact tooltip: the selected metric first, then the three anchors — each figure exactly once.
  function hoverHtml(iso, metric) {
    var row = countryRows().filter(function (r) { return r.country === iso; })[0] || {};
    var lines = [[metric, metricLabel(metric)], ['visits_human', 'Обычные визиты'], ['registered', 'Аккаунты'], ['buyers', 'Покупатели']];
    var seen = {};
    var parent = parentNote(iso);
    return '<b>' + esc((LIB.flagEmoji ? LIB.flagEmoji(iso) + ' ' : '') + countryName(iso)) + '</b>' + (parent ? '<br><i>' + esc(parent) + '</i>' : '') +
      lines.filter(function (l) { if (seen[l[0]]) return false; seen[l[0]] = true; return true; })
        .map(function (l, i) { return '<br>' + esc(l[1]) + ': ' + (i === 0 ? '<b>' + num(row[l[0]]) + '</b>' : num(row[l[0]])); }).join('');
  }
  async function mountMap(force) {
    var host = ovEl.querySelector('#ow-mapbox');
    if (!host || mapLoading) return;
    var rows = countryRows();
    if (mapApi && !force && mapApi.map && mapApi.map.getContainer() === host) {
      mapApi.setData(rows, state.mapMetric); mapApi.setContinent(state.continent); mapApi.select(state.selectedCountry); mapApi.resize(); return;
    }
    mapLoading = true;
    setHourglass(true, 'Загрузка карты…');
    try {
      if (mapApi) { mapApi.destroy(); mapApi = null; }
      // Versioned like every other runtime script: an unversioned dynamic import could be served from
      // the HTTP cache (max-age 600) or the service worker's stale-while-revalidate for a while after a deploy.
      var rev = '';
      try { rev = D.documentElement.getAttribute('data-build') || ''; } catch (e) {}
      var module = await import('./owner-map.js' + (rev ? '?v=' + encodeURIComponent(rev) : ''));
      mapApi = await module.createMap({
        container: host,
        theme: ovEl.getAttribute('data-ow-theme'),
        colorFor: function (value, max, theme) { return LIB.choroplethColor ? LIB.choroplethColor(value, max, theme) : (value > 0 ? '#5591db' : '#dde6ee'); },
        onHover: hoverHtml,
        onSelect: function (iso) { state.selectedCountry = iso; openCountry(iso); }
      });
      mapApi.setData(rows, state.mapMetric);
      if (state.continent !== 'all') mapApi.setContinent(state.continent); else mapApi.fit();
      if (state.selectedCountry) mapApi.select(state.selectedCountry);
    } catch (error) {
      var box = ovEl.querySelector('#ow-mapbox');
      if (box) box.innerHTML = '<div class="ow-empty">Карта не загрузилась: ' + esc(error.message || 'ошибка') + '</div>';
    } finally {
      mapLoading = false;
      setHourglass(false);
    }
  }

  // The country card: everything the owner may know about one country, nothing about one person.
  // Raw IP addresses and e-mails do not exist in this data and are never shown.
  var countryLoading = false;
  async function openCountry(iso) {
    if (!iso || countryLoading) return;
    countryLoading = true;
    state.selectedCountry = iso;
    if (mapApi) mapApi.select(iso);
    setHourglass(true, 'Загрузка страны…');
    var response = null;
    try { response = await api({ section: 'country', params: params({ country: iso }) }); }
    catch (error) { countryLoading = false; setHourglass(false); openPopup('Ошибка', esc(errorText(error))); return; }
    countryLoading = false;
    setHourglass(false);
    var data = response.data || {};
    var sum = data.summary || {};
    var visits = data.visits_available !== false;
    var kv = function (value, opts) { var k = LIB.kpiText ? LIB.kpiText(value, opts) : { text: num(value), state: 'ok' }; return k.state === 'ok' ? k.text : '<span class="ow-kpi-none">' + esc(k.text) + '</span>'; };
    var v = function (key) { return visits ? kv(sum[key] == null ? 0 : sum[key]) : kv(null, { unavailable: true }); };
    var human = +sum.visits_human || 0, regNew = +sum.registered_new || 0;
    var conversion = visits && human >= 20 ? (Math.round((regNew / human) * 10000) / 100) + '%' : kv(null, { insufficient: true });
    var netLabels = { isp: 'Домашний провайдер', mobile: 'Мобильный оператор', hosting: 'Дата-центр', vpn: 'VPN', tor: 'Tor', education: 'Учебная сеть', business: 'Корпоративная', unknown: 'Не определено' };
    var old = ovEl.querySelector('#ow-sheet'); if (old) old.remove();
    var sheet = D.createElement('div');
    sheet.className = 'ow-sheet';
    sheet.id = 'ow-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', countryName(iso));
    sheet.innerHTML = '<div class="ow-sheet-in">' +
      '<div class="ow-country-h"><span class="ow-flag">' + esc(LIB.flagEmoji ? LIB.flagEmoji(iso) : '') + '</span><span>' + esc(countryName(iso)) + '</span>' +
        '<code>' + esc(iso) + '</code>' + (continentOf(iso) ? '<span class="ow-tag">' + esc(label(LIB.CONTINENT_RU, continentOf(iso))) + '</span>' : '') +
        (parentNote(iso) ? '<span class="ow-tag">' + esc(parentNote(iso)) + '</span>' : '') +
        how('countryMap') + '</div>' +
      '<div class="ow-cards">' +
        card('Обычные визиты', v('visits_human'), 'без обнаруженных признаков автоматизации', 'visitsHuman') +
        card('Гостевые визиты', v('visits_guest'), 'визиты без входа в аккаунт', 'guests') +
        card('Авторизованные визиты', v('visits_signed_in'), 'визиты с входом в аккаунт · это визиты, не люди', 'authorizedVisits') +
        card('Зарегистрированные', kv(sum.registered), 'точно · новых за период: ' + num(sum.registered_new), 'registered') +
        card('FREE', kv(sum.free), 'точно', 'levels') +
        card('PRO', kv(sum.pro), 'активная подписка', 'levels') +
        card('Lifetime', kv(sum.lifetime), 'бессрочный доступ', 'levels') +
        card('Покупатели', kv(sum.buyers), 'покупок за период: ' + num(sum.purchases), 'buyers') +
        card('Домохозяйства', kv(sum.households), 'оценка · с согласием', 'households') +
        card('Посетители с согласием', kv(sum.visitors), num(sum.guests) + ' гостевых профилей', 'consented') +
        card('Web', v('web'), 'обычные визиты') + card('iOS', v('ios'), 'обычные визиты') + card('Android', v('android'), 'обычные визиты') +
        card('Согласились', kv(sum.consent_accepted), 'решений за период', 'consent') +
        card('Отклонили', kv(sum.consent_declined), 'решений за период', 'consent') +
        card('Боты', v('visits_bot'), 'объявленные краулеры', 'traffic') +
        card('Подозрительный трафик', v('visits_suspicious'), 'VPN / Tor / дата-центры: ' + (visits ? num(sum.visits_proxy) : '—'), 'traffic') +
        card('Конверсия в регистрацию', conversion, 'оценка · регистрации ÷ обычные визиты', 'conversion') +
      '</div>' +
      (visits ? lineChart(data.timeseries || [], ['human', 'suspicious', 'bot'], ['Обычные', 'Подозрительный', 'Боты']) : '<div class="ow-empty">Счётчики визитов ещё не накоплены</div>') +
      lineChart(data.visitors_timeseries || [], ['visitors', 'sessions'], ['Посетители с согласием', 'Сессии']) +
      barList(data.platforms, { web: 'Веб', ios: 'iOS', android: 'Android' }, null, 'Платформы (все визиты)') +
      barList(data.network_types, netLabels, 'traffic', 'Тип сети') +
      '<div class="ow-block"><div class="ow-block-h">Лотереи</div>' +
        table([{ title: 'Лотерея', key: 'lottery' }, { title: 'Сессий', key: 'sessions', numeric: true }], data.top_lotteries, 'Нет данных с согласием') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">Функции</div>' +
        table([{ title: 'Функция', key: 'feature', html: function (r) { return esc(label(LIB.EVENT_RU, r.feature)); } }, { title: 'Сессий', key: 'sessions', numeric: true }], data.top_features, 'Нет данных с согласием') + '</div>' +
      lineChart(data.consent_timeseries || [], ['accepted', 'declined'], ['Согласились', 'Отклонили']) +
      '<button class="ow-btn ow-btn-primary" id="ow-sheet-close" type="button" style="margin-top:10px">Закрыть</button></div>';
    ovEl.appendChild(sheet);
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet || event.target.id === 'ow-sheet-close') { sheet.remove(); state.selectedCountry = null; if (mapApi) mapApi.select(null); }
    });
    try { sheet.querySelector('#ow-sheet-close').focus({ preventScroll: true }); } catch (e) {}
  }

  function openPopup(title, html) {
    closePopup();
    var pop = D.createElement('div');
    pop.className = 'ow-pop';
    pop.id = 'ow-pop';
    pop.innerHTML = '<h3>' + esc(title) + '</h3><p>' + html + '</p>';
    var close = D.createElement('button');
    close.className = 'ow-btn';
    close.type = 'button';
    close.textContent = 'Закрыть';
    close.style.marginTop = '8px';
    close.addEventListener('click', closePopup);
    pop.appendChild(close);
    ovEl.appendChild(pop);
  }
  function closePopup() { var pop = ovEl.querySelector('#ow-pop'); if (pop) pop.remove(); }

  // ── person sheet ───────────────────────────────────────────────────────────────────────────
  async function openPerson(personId) {
    setHourglass(true, 'Загрузка карточки…');
    var response = null;
    try { response = await api({ section: 'person', params: params({ person: personId }) }); }
    catch (error) { setHourglass(false); openPopup('Ошибка', esc(error.message || 'не удалось загрузить')); return; }
    setHourglass(false);
    var data = response.data || {};
    var person = data.person || {};
    var sheet = D.createElement('div');
    sheet.className = 'ow-sheet';
    sheet.id = 'ow-sheet';
    sheet.innerHTML = '<div class="ow-sheet-in">' +
      '<div class="ow-block-h">' + esc(label(LIB.KIND_RU, person.kind)) + ' · ' + esc(String(person.person_id || '').slice(0, 8)) +
        ' ' + confidenceChip(person.confidence, person.evidence) + '</div>' +
      '<div class="ow-cards">' +
        card('Первый визит', esc(timeText(person.first_seen))) +
        card('Последний визит', esc(timeText(person.last_seen))) +
        card('Сессии', num(person.sessions)) +
        card('Активное время', esc(dur(person.active_ms))) +
        card('Устройства', num(person.devices)) +
        card('Место', esc(place(person))) +
      '</div>' +
      '<div class="ow-block"><div class="ow-block-h">Устройства</div>' +
        table([
          { title: 'ID', key: 'short' },
          { title: 'Тип', key: 'kind', html: function (r) { return esc(r.kind || '—'); } },
          { title: 'ОС', key: 'os' },
          { title: 'Браузеры', key: 'browsers', html: function (r) { return esc((r.browsers || []).join(', ')); } },
          { title: 'Профилей', key: 'profiles', numeric: true },
          { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } }
        ], data.devices || [], 'Нет устройств') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">Сессии</div>' +
        table([
          { title: 'Начало', key: 'started_at', html: function (r) { return esc(timeText(r.started_at)); } },
          { title: 'Длит.', key: 'duration_ms', html: function (r) { return esc(dur(r.duration_ms)); }, numeric: true },
          { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)) + (r.active_source === 'estimated' ? ' <span class="ow-conf ow-conf-mid" title="Оценка по интервалам между действиями">оц.</span>' : ''); }, numeric: true },
          { title: 'События', key: 'events', numeric: true },
          { title: 'Вход', key: 'entry' },
          { title: 'Источник', key: 'channel', html: function (r) { return esc(label(LIB.CHANNEL_RU, r.channel)); } },
          { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
          { title: 'Устройство', key: 'device', html: function (r) { return esc([r.device, r.os, r.browser].filter(Boolean).join(' · ')); } }
        ], data.sessions || [], 'Нет сессий') + '</div>' +
      '<div class="ow-block"><div class="ow-block-h">Путь</div>' +
        ((data.journey || []).length
          ? (data.journey || []).map(function (step) {
            return '<div class="ow-jr"><b>' + esc(clockText(step.at).slice(0, 5)) + '</b><span>' +
              esc(label(LIB.EVENT_RU, step.event)) +
              (step.lottery ? ' · ' + esc(step.lottery) : '') +
              (step.model ? ' · модель ' + esc(step.model) : '') +
              (step.props && step.props.rows ? ' · ' + num(step.props.rows) + ' ряд.' : '') +
              '</span></div>';
          }).join('')
          : '<div class="ow-empty">Нет событий</div>') +
      '</div>' +
      '<button class="ow-btn ow-btn-primary" id="ow-sheet-close" type="button" style="margin-top:10px">Закрыть</button></div>';
    ovEl.appendChild(sheet);
    sheet.addEventListener('click', function (event) {
      if (event.target === sheet || event.target.id === 'ow-sheet-close') sheet.remove();
    });
  }

  // ── sections ───────────────────────────────────────────────────────────────────────────────
  // KPI card: value text or an honest empty state, a precision tag and a «how» note.
  function kcard(title, value, sub, howKey, precision, opts) {
    var k = LIB.kpiText ? LIB.kpiText(value, opts) : { text: num(value), state: 'ok' };
    var text = k.state === 'ok' ? k.text + (opts && opts.suffix ? opts.suffix : '') : '<span class="ow-kpi-none">' + esc(k.text) + '</span>';
    var tag = precision ? '<span class="ow-tag ow-tag-' + esc(precision) + '">' + esc(label(LIB.PRECISION_RU, precision)) + '</span>' : '';
    return '<div class="ow-card ow-kpi" data-kpi="' + esc(title) + '">' +
      '<div class="ow-card-h"><span>' + esc(title) + '</span>' + (howKey ? how(howKey) : '') + tag + '</div>' +
      '<div class="ow-card-v">' + text + '</div>' +
      (sub ? '<div class="ow-card-s">' + sub + '</div>' : '') + '</div>';
  }
  function renderKpi() {
    var response = state.data.kpi;
    var head = '<div class="ow-kpi-h"><h2>Ключевые показатели</h2>' +
      ['exact', 'filtered', 'consented', 'estimate'].map(function (p) { return '<span class="ow-tag ow-tag-' + p + '">' + esc(LIB.PRECISION_RU ? LIB.PRECISION_RU[p] : p) + '</span>'; }).join('') + '</div>';
    if (!response) {
      return '<div class="ow-block" id="ow-kpi">' + head +
        '<div class="ow-err"><span>' + esc(state.kpiError ? errorText(state.kpiError) : 'Нет данных') + '</span>' +
        '<button class="ow-btn" type="button" data-kpi-retry>Повторить</button></div></div>';
    }
    var d = response.data || {};
    var a = d.accounts || {}, t = d.traffic || {}, c = d.consented || {}, cs = d.consent || {}, cv = d.conversion || {};
    var levels = a.levels || {};
    var tv = function (key) { return t.available ? (t[key] == null ? 0 : t[key]) : null; };
    var un = { unavailable: !t.available };
    var pct = function (value) { return value == null ? null : value; };
    return '<div class="ow-block" id="ow-kpi">' + head + '<div class="ow-cards">' +
      kcard('Обычные визиты', tv('human'), t.available ? num(t.visits) + ' всего · ' + pctText(t.human, t.visits) + ' без обнаруженных признаков автоматизации' : 'счётчики ещё не накоплены', 'visitsHuman', 'filtered', un) +
      kcard('Гостевые визиты', tv('guest'), 'визиты без входа в аккаунт', 'guests', 'filtered', un) +
      kcard('Авторизованные визиты', tv('signed_in'), 'визиты с входом в аккаунт · это визиты, не люди', 'authorizedVisits', 'filtered', un) +
      kcard('Зарегистрированные аккаунты', a.registered_total, '+' + num(a.registered_new) + ' за период · владелец: ' + num(a.owners) + ' · анонимных сессий: ' + num(a.anonymous_accounts), 'registered', 'exact') +
      kcard('Новые регистрации', a.registered_new, 'за выбранный период', 'registered', 'exact') +
      kcard('FREE', levels.free, 'без активной подписки', 'levels', 'exact') +
      kcard('PRO', levels.pro, 'истёкших: ' + num(levels.expired) + ' · пробных: ' + num(a.trials_active), 'levels', 'exact') +
      kcard('Lifetime', levels.lifetime, 'бессрочный доступ', 'levels', 'exact') +
      kcard('Покупатели', a.paying_customers, 'подписок активно: ' + num(a.active_subscriptions) + ' · тестовых аккаунтов: ' + num(a.test_accounts), 'buyers', 'exact') +
      kcard('Покупки за период', a.purchases, 'продления: ' + (a.renewals == null ? 'нет данных' : num(a.renewals)), 'buyers', 'exact') +
      kcard('Конверсия в регистрацию', pct(cv.signup_rate_pct), 'регистрации ÷ обычные визиты · нужно ≥ ' + num(cv.min_visits) + ' визитов', 'conversion', 'estimate', { insufficient: true, suffix: '%' }) +
      kcard('Конверсия в покупку', pct(cv.purchase_rate_pct), 'покупатели ÷ аккаунты · нужно ≥ ' + num(cv.min_registered) + ' аккаунтов', 'conversion', 'estimate', { insufficient: true, suffix: '%' }) +
      kcard('Посетители с согласием', c.visitors, num(c.guest_profiles) + ' гостевых профилей · ' + num(c.registered_profiles) + ' с аккаунтом · ' + num(c.unknown_visitors) + ' без признаков', 'consented', 'consented') +
      kcard('Домохозяйства', c.households, 'по домашним сетям согласившихся', 'households', 'estimate') +
      kcard('Боты', tv('bot'), 'объявленные краулеры', 'traffic', 'filtered', un) +
      kcard('Подозрительный трафик', tv('suspicious'), 'headless, дата-центры, VPN, Tor, всплески', 'traffic', 'filtered', un) +
      kcard('Согласия', cs.accepted, 'отклонили: ' + num(cs.declined) + ' · стран известно: ' + num(cs.countries_known), 'consent', 'exact') +
    '</div>' +
    (t.available ? lineChart(t.timeseries || [], ['human', 'suspicious', 'bot'], ['Обычные', 'Подозрительный', 'Боты']) : '') +
    (t.available ? barList(t.by_platform, { web: 'Веб', ios: 'iOS', android: 'Android' }, 'visitsHuman', 'Обычные визиты по платформам') : '') +
    (t.available ? barList(t.by_consent, { accepted: 'Согласились', declined: 'Отклонили', undecided: 'Ещё не решили' }, 'consent', 'Обычные визиты по состоянию согласия') : '') +
    '</div>';
  }

  function renderOverview(data) {
    var people = data.people || {}, structure = data.structure || {}, excluded = data.excluded || {};
    var engagement = data.engagement || {}, geography = data.geography || {}, live = data.live || {};
    var previous = data.previous || null;
    return renderKpi() + '<div class="ow-cards" style="margin-top:12px">' +
      card('Оценка живой аудитории', num(people.estimated_min) + '–' + num(people.estimated_max), 'подтверждённые + вероятные … + каждое устройство отдельно', 'estimated') +
      card('Подтверждённые люди', num(people.verified), 'вошли в аккаунт', 'verified', previous ? null : null) +
      card('Вероятные люди', num(people.probable), 'анонимные, сгруппированы по нижней границе', 'probable') +
      card('Неизвестные посетители', num(people.unknown_visitors), 'нет признаков взаимодействия', 'unknown') +
      card('Новые', num(people.new), 'первый визит внутри периода', 'newPeople') +
      card('Вернувшиеся', num(people.returning), 'были известны до периода', 'returningPeople') +
      card('Приходили в разные дни', num(people.returned_another_day), 'активны в 2+ календарных дня', 'returnedAnotherDay') +
      card('Дней активности в среднем', String(people.active_days_avg == null ? '—' : people.active_days_avg), 'на человека за период') +
      card('Активны сейчас', num(live.active_now), 'события за 5 минут', 'live') +
      card('Домохозяйства', num(structure.households), 'одна домашняя сеть', 'households') +
      card('Устройства', num(structure.devices), num(structure.shared_devices) + ' общих (несколько аккаунтов)', 'devices') +
      card('Профили браузера', num(structure.browser_profiles), 'установки и профили', 'profiles') +
      card('Сессии', num(structure.sessions), 'таймаут 30 минут', 'sessions', previous ? deltaOf(structure.sessions, previous.sessions) : null) +
      card('Повторные сессии', num(structure.repeat_sessions), 'сверх первой на человека', 'repeatSessions') +
      card('События', num(structure.events), previous ? '' : '', null, previous ? deltaOf(structure.events, previous.events) : null) +
      card('Активное время в среднем', dur(engagement.avg_active_ms), num(engagement.measured_sessions) + ' измерено / ' + num(engagement.estimated_sessions) + ' оценка', 'active') +
      card('Вовлечённые сессии', num(engagement.engaged_sessions), pctText(engagement.engaged_sessions, structure.sessions) + ' от всех') +
      card('Исключено: владелец и тесты', num(excluded.owner_test_profiles) + ' проф. / ' + num(excluded.owner_test_sessions) + ' сес.', 'не входят в аудиторию', 'excluded') +
      card('Исключено: боты', num(excluded.bot_profiles) + ' проф. / ' + num(excluded.bot_sessions) + ' сес.', 'краулеры и автоматизация', 'excluded') +
      card('Страны · регионы · города', num(geography.countries) + ' · ' + num(geography.regions) + ' · ' + num(geography.cities), num(geography.unknown_sessions) + ' сессий без гео', 'geo') +
    '</div>' +
    lineChart(data.timeseries || [], ['people', 'sessions'], ['Люди', 'Сессии']) +
    barList(data.people_by_channel, LIB.CHANNEL_RU, 'channels', 'Люди по первому источнику') +
    barList(data.channels, LIB.CHANNEL_RU, 'channels', 'Сессии по последнему источнику') +
    '<div class="ow-block"><div class="ow-block-h">Свежесть данных</div>' +
      '<div class="ow-bar"><span class="ow-bar-l">Последнее событие</span><span>' + esc(timeText((data.freshness || {}).latest_event)) + '</span><span></span></div>' +
      '<div class="ow-bar"><span class="ow-bar-l">Последний разбор</span><span>' + esc(timeText((data.freshness || {}).latest_resolution)) + '</span><span></span></div>' +
    '</div>';
  }

  // ── LIVE: today's aggregates + the chronological feed (v4). The older `stream` shape is still
  // rendered when a backend answers with it, so nothing breaks during a rollout.
  function statusChip(status) {
    var key = String(status || 'guest');
    return '<span class="ow-status-chip ow-status-' + esc(key) + '">' + esc(label(LIB.STATUS_RU, key)) + '</span>';
  }
  function feedRows(data) {
    if (Array.isArray(data.feed)) return data.feed;
    return (data.stream || []).map(function (row) {
      return { at: row.at, kind: 'event', name: row.event, lottery: row.lottery, page: row.page, platform: row.platform, country: row.country,
        device: row.device, status: row.owner_test ? 'owner' : (row.kind === 'verified' ? 'free' : 'guest'), who: row.person, class: row.class };
    });
  }
  function feedWhat(row) {
    if (row.kind === 'commerce') {
      var money = row.price != null && row.currency ? ' · ' + (LIB.formatMoney ? LIB.formatMoney(row.price, row.currency) : row.price + ' ' + row.currency) : '';
      return esc(label(LIB.COMMERCE_RU, row.name)) + (row.plan ? ' · ' + esc(row.plan) + ' мес.' : '') + money + (row.reason ? ' · ' + esc(row.reason) : '');
    }
    if (row.kind === 'account') return 'Новый аккаунт' + (row.platform ? ' · ' + esc(row.platform) : '');
    if (row.kind === 'visits') {
      return 'Визиты за час: ' + num(row.count) + ' · ' + esc(label(LIB.TRAFFIC_RU, row.name)) +
        (row.consent ? ' · ' + esc({ accepted: 'с согласием', declined: 'отклонили', undecided: 'без решения' }[row.consent] || row.consent) : '');
    }
    var what = esc(label(LIB.EVENT_RU, row.name));
    if (row.lottery) what += ' · ' + esc(row.lottery);
    if (row.model) what += ' · модель ' + esc(row.model);
    if (row.rows) what += ' · ' + num(row.rows) + ' ряд.';
    if (row.context && row.name === 'client_error') what += ' · ' + esc(row.context);
    return what;
  }
  function renderLive(data) {
    var s = data.today_scalars || {};
    var rows = feedRows(data).map(function (row) { return Object.assign({}, row, { __click: false, __class: 'ow-feed-' + (row.kind || 'event') }); });
    var revenue = LIB.kpiText ? LIB.kpiText(s.revenue_usd) : { text: num(s.revenue_usd), state: 'ok' };
    var cards = '<div class="ow-cards">' +
      card('Активны сейчас', '<span class="ow-live-dot" aria-hidden="true"></span>' + num(data.active_now), 'события за 5 минут · за 15 минут: ' + num(data.active_15m), 'live') +
      card('Точные аккаунты сегодня', num(s.exact_accounts), 'один аккаунт = один пользователь', 'identity') +
      card('Оценка уникальных гостей', num(s.estimated_unique_guests), 'с согласием: ' + num(s.guest_profiles_consented) + ' · дневных ключей: ' + num(s.guest_keys_daily), 'identity') +
      card('Люди с согласием сегодня', num(s.people), 'новых: ' + num(s.new_people) + ' · вернувшихся: ' + num(s.returning_people), 'dayPeople') +
      card('Визиты сегодня', data.visits_available === false ? '—' : num(s.visits_human), 'обычные · за последний час: ' + num(data.visits_last_hour), 'visitsHuman') +
      card('Регистрации сегодня', num(s.registrations), 'точно', 'dayRegistrations') +
      card('Страны сегодня', num(s.countries), 'по визитам и сессиям', 'dayLanguages') +
      card('Новые PRO сегодня', num(s.purchases), 'продлений: ' + num(s.renewals) + ' · сбоев оплаты: ' + num(s.payment_failures), 'dayCommerce') +
      card('Выручка сегодня', revenue.state === 'ok' ? revenue.text + ' USD' : '<span class="ow-kpi-none">' + esc(revenue.text) + '</span>', 'по данным магазина', 'dayCommerce') +
      card('Owner-уведомления', num(data.unread_owner_notifications), 'непрочитанных', 'liveFeed') +
      card('Обновление', 'каждые 15 с', 'пока открыт раздел · ' + esc(data.today || '')) +
    '</div>';
    var host = ovEl && ovEl.querySelector('#ow-section');
    var scroll = host ? host.scrollTop : 0;
    var html = cards +
      '<div class="ow-block" id="ow-b-feed"><div class="ow-block-h">Живая активность сегодня' + how('liveFeed') + '<span class="ow-tag" style="margin-left:auto">' + num(rows.length) + ' записей</span></div>' +
      table([
        { title: 'Время', key: 'at', html: function (r) { return esc(clockText(r.at)); } },
        { title: 'Что', key: 'kind', html: function (r) { return '<span class="ow-tag">' + esc(label(LIB.FEED_KIND_RU, r.kind)) + '</span>'; } },
        { title: 'Событие', key: 'name', html: feedWhat },
        { title: 'Статус', key: 'status', html: function (r) { return statusChip(r.status); } },
        { title: 'Платформа', key: 'platform', html: function (r) { return esc(label({ web: 'Веб', ios: 'iOS', android: 'Android' }, r.platform)); } },
        { title: 'Язык', key: 'locale', html: function (r) { return esc(r.locale || '—'); } },
        { title: 'Страна', key: 'country', html: function (r) { return esc(r.country ? (LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + countryName(r.country) : '—'); } },
        { title: 'Устройство', key: 'device', html: function (r) { return esc(r.device || (r.network ? label({ isp: 'провайдер', mobile: 'мобильная', hosting: 'дата-центр', vpn: 'VPN', tor: 'Tor' }, r.network) : '—')); } },
        { title: 'Кто', key: 'who', html: function (r) { return '<code>' + esc(r.who || '—') + '</code>'; } }
      ], rows, 'Сегодня событий ещё не было') + '</div>';
    if (host) setTimeout(function () { try { host.scrollTop = scroll; } catch (e) {} }, 0);
    return html;
  }

  // ── День: the calendar day report ──────────────────────────────────────────────────────────
  var WEEKDAYS_RU = ['', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  function dayTitle(ymd) {
    try {
      var p = ymd.split('-');
      return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('ru-RU', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return ymd; }
  }
  function cmpLine(key, compare, opts) {
    opts = opts || {};
    var cur = compare && compare.__current ? compare.__current[key] : null;
    if (cur == null || !LIB.delta) return '';
    var parts = [];
    var one = function (title, block) {
      if (!block || !block.scalars || block.scalars[key] == null) return;
      var d = LIB.delta(cur, block.scalars[key]);
      if (!d) return;
      var value = opts.money ? (LIB.formatMoney ? LIB.formatMoney(block.scalars[key], 'USD') : block.scalars[key]) : num(block.scalars[key]);
      var sign = d.abs > 0 ? '+' : '';
      var change = d.pct == null ? (d.abs === 0 ? '±0' : sign + num(d.abs)) : sign + num(d.abs) + ' · ' + sign + num(d.pct) + '%';
      parts.push('<span>' + esc(title) + ' <b>' + esc(String(value)) + '</b> <span class="' + d.dir + '">' + esc(change) + '</span></span>');
    };
    one('вчера', compare.prev_day);
    one('нед. назад', compare.same_weekday);
    one('ср. 7 дн.', compare.avg7);
    return parts.length ? '<div class="ow-cmp">' + parts.join('') + '</div>' : '';
  }
  // A day card: the value, its precision tag, the «how» note and the three comparisons.
  function dayCard(title, key, sub, howKey, precision, compare, opts) {
    opts = opts || {};
    var scalars = (compare && compare.__current) || {};
    var value = scalars[key];
    var text;
    if (opts.money) { var k = LIB.kpiText ? LIB.kpiText(value) : { text: num(value), state: 'ok' }; text = k.state === 'ok' ? esc(LIB.formatMoney ? LIB.formatMoney(value, 'USD') : k.text) : '<span class="ow-kpi-none">' + esc(k.text) + '</span>'; }
    else if (opts.unavailable) text = '<span class="ow-kpi-none">Нет данных</span>';
    else text = num(value);
    var tag = precision ? '<span class="ow-tag ow-tag-' + esc(precision) + '">' + esc(label(LIB.PRECISION_RU, precision)) + '</span>' : '';
    return '<div class="ow-card ow-kpi" data-kpi="' + esc(title) + '">' +
      '<div class="ow-card-h"><span>' + esc(title) + '</span>' + (howKey ? how(howKey) : '') + tag + '</div>' +
      '<div class="ow-card-v">' + text + '</div>' +
      (sub ? '<div class="ow-card-s">' + sub + '</div>' : '') +
      (opts.unavailable ? '' : cmpLine(key, compare, opts)) + '</div>';
  }
  function block(id, title, howKey, inner, extraHead) {
    return '<div class="ow-block" id="ow-b-' + id + '"><div class="ow-block-h">' + esc(title) + (howKey ? how(howKey) : '') + (extraHead || '') + '</div>' + inner + '</div>';
  }
  function renderDay(data) {
    var s = data.scalars || {};
    var compare = Object.assign({ __current: s }, data.compare || {});
    var visits = data.visits_available !== false;
    var un = { unavailable: !visits };
    var v = data.visits || {}, platforms = data.platforms || {}, accounts = data.accounts || {}, commerce = data.commerce || {}, system = data.system || {}, excluded = data.excluded || {};
    var netLabels = { isp: 'Домашний провайдер', mobile: 'Мобильный оператор', hosting: 'Дата-центр', vpn: 'VPN', tor: 'Tor', education: 'Учебная сеть', business: 'Корпоративная', unknown: 'Не определено' };
    var anchors = [['identity', 'Кто это был'], ['visits', 'Визиты'], ['people', 'Аудитория'], ['accounts', 'Аккаунты'], ['platforms', 'Платформы'], ['countries', 'Страны и языки'], ['lotteries', 'Лотереи'], ['features', 'Функции'], ['funnel', 'Воронка'], ['commerce', 'Платежи'], ['system', 'Сбои']];
    var head = '<div class="ow-dayhead"><h2>' + esc(dayTitle(data.day || state.day)) + '</h2>' +
      '<span class="ow-card-s">' + esc(WEEKDAYS_RU[data.weekday] || '') + (data.is_today ? ' · сегодня (день ещё идёт)' : '') + ' · ' + esc(String(data.hours_in_day || 24)) + ' ч · ' + esc(state.tz) + '</span>' + how('dayBounds') + how('dayCompare') + '</div>' +
      '<div class="ow-anchors">' + anchors.map(function (a) { return '<a href="#ow-b-' + a[0] + '" data-block="' + a[0] + '">' + esc(a[1]) + '</a>'; }).join('') + '</div>';

    var visitsBlock = block('visits', 'Визиты (счётчики без идентификаторов)', 'visitsHuman',
      '<div class="ow-cards">' +
        dayCard('Обычные визиты', 'visits_human', visits ? num(s.visits_total) + ' всего · ' + pctText(s.visits_human, s.visits_total) + ' без признаков автоматизации' : 'счётчики ещё не накоплены', 'visitsHuman', 'filtered', compare, un) +
        dayCard('Гостевые визиты', 'visits_guest', 'визиты без входа в аккаунт', 'guests', 'filtered', compare, un) +
        dayCard('Авторизованные визиты', 'visits_signed_in', 'визиты с входом · это визиты, не люди', 'authorizedVisits', 'filtered', compare, un) +
        dayCard('Подозрительный трафик', 'visits_suspicious', 'headless, дата-центры, VPN, Tor, всплески', 'traffic', 'filtered', compare, un) +
        dayCard('Боты', 'visits_bot', 'объявленные краулеры', 'traffic', 'filtered', compare, un) +
      '</div>' +
      (visits ? lineChart(v.hourly || [], ['human', 'suspicious', 'bot'], ['Обычные', 'Подозрительный', 'Боты']) : '') +
      (visits ? barList(v.by_platform, { web: 'Веб', ios: 'iOS', android: 'Android' }, null, 'Обычные визиты по платформам') : '') +
      (visits ? barList(v.by_consent, { accepted: 'Согласились', declined: 'Отклонили', undecided: 'Ещё не решили' }, 'consent', 'Обычные визиты по состоянию согласия') : '') +
      (visits ? barList(v.by_network, netLabels, 'traffic', 'Все визиты по типу сети') : ''));

    var identityBlock = block('identity', 'Кто это был: аккаунты · гости · визиты · сессии · устройства · домохозяйства', 'identity',
      '<div class="ow-cards">' +
        dayCard('Точные активные аккаунты', 'exact_accounts', 'один аккаунт = один пользователь · владелец отдельно · авторизованных визитов: ' + num(s.visits_signed_in), 'identity', 'exact', compare) +
        dayCard('Оценка уникальных гостей', 'estimated_unique_guests', 'профилей с согласием: ' + num(s.guest_profiles_consented) + ' · дневных ключей: ' + num(s.guest_keys_daily) + (s.guest_keys_linked ? ' · связано с аккаунтом и исключено: ' + num(s.guest_keys_linked) : ''), 'identity', 'estimate', compare) +
        dayCard('Визиты', 'visits_human', 'обычные · загрузки страницы, не люди', 'visitsHuman', 'filtered', compare, un) +
        dayCard('Сессии', 'sessions', 'с согласием · таймаут 30 минут', 'sessions', 'consented', compare) +
        dayCard('Устройства', 'devices', 'с согласием · ' + num(s.profiles) + ' профилей/установок', 'devices', 'consented', compare) +
        dayCard('Домохозяйства (оценка)', 'households', 'по домашним сетям согласившихся', 'households', 'estimate', compare) +
      '</div>' +
      (data.identity && data.identity.guest_keys_by_platform ? barList(data.identity.guest_keys_by_platform, { web: 'Веб', ios: 'iOS', android: 'Android' }, 'identity', 'Дневные ключи гостей по платформам') : '') +
      '<div class="ow-card-s" style="margin-top:6px">' + esc((data.identity && data.identity.note) || '') + '</div>');

    var peopleBlock = block('people', 'Аудитория с согласием', 'dayPeople',
      '<div class="ow-cards">' +
        dayCard('Уникальные пользователи', 'people', 'с признаками человека: ' + num(s.people_human), 'dayPeople', 'consented', compare) +
        dayCard('Новые', 'new_people', 'первый визит в истории — в этот день', 'newPeople', 'consented', compare) +
        dayCard('Вернувшиеся', 'returning_people', 'были известны до этого дня', 'returningPeople', 'consented', compare) +
        dayCard('Аккаунты активны', 'accounts_active', 'вошли в аккаунт в этот день (без владельца)', 'dayEntities', 'exact', compare) +
        dayCard('Устройства', 'devices', num(s.profiles) + ' профилей/установок', 'dayEntities', 'consented', compare) +
        dayCard('Сессии', 'sessions', num(s.engaged_sessions) + ' вовлечённых · ' + num(s.events) + ' событий', 'sessions', 'consented', compare) +
        dayCard('Домохозяйства (оценка)', 'households', 'по домашним сетям', 'households', 'estimate', compare) +
        dayCard('Гости', 'guests', 'устройства без входа в аккаунт', 'dayStatuses', 'consented', compare) +
      '</div>' +
      lineChart(data.sessions_hourly || [], ['sessions', 'people'], ['Сессии', 'Люди']));

    var levels = accounts.levels_active || {};
    var accountsBlock = block('accounts', 'Аккаунты и статусы', 'dayStatuses',
      '<div class="ow-cards">' +
        dayCard('Регистрации', 'registrations', 'аккаунтов всего сейчас: ' + num(accounts.registered_total_now), 'dayRegistrations', 'exact', compare) +
        dayCard('FREE активны', 'free_active', 'вошли в этот день', 'dayStatuses', 'exact', compare) +
        dayCard('PRO активны', 'pro_active', 'активная платная подписка', 'dayStatuses', 'exact', compare) +
        dayCard('PRO Lifetime активны', 'lifetime_active', 'бессрочный доступ (не владелец)', 'dayStatuses', 'exact', compare) +
        dayCard('PRO истёк / отменён', 'expired_active', 'заходили с истёкшей подпиской', 'dayStatuses', 'exact', compare) +
        card('Владелец / тест (отдельно)', num(excluded.owner_sessions) + ' сес. · ' + num(excluded.owner_profiles) + ' проф.', 'аккаунтов владельца активно: ' + num(excluded.owner_accounts_active) + ' · регистраций владельца: ' + num(s.registrations_owner) + ' · не входят в цифры выше', 'excluded') +
        card('Исключено: боты', num(excluded.bot_sessions) + ' сес.', 'краулеры и автоматизация', 'excluded') +
      '</div>' +
      (Object.keys(levels).length ? barList(levels, LIB.STATUS_RU, 'dayStatuses', 'Активные аккаунты по статусу') : ''));

    var platformsBlock = block('platforms', 'Платформы и устройства', 'devices',
      '<div class="ow-cards">' +
        dayCard('Web', 'web', 'сессий', 'devices', 'consented', compare) +
        dayCard('iOS', 'ios', 'сессий', 'devices', 'consented', compare) +
        dayCard('Android', 'android', 'сессий', 'devices', 'consented', compare) +
        dayCard('Телефоны', 'mobile', 'устройств', 'devices', 'consented', compare) +
        dayCard('Компьютеры', 'desktop', 'устройств', 'devices', 'consented', compare) +
        dayCard('Планшеты', 'tablet', 'устройств', 'devices', 'consented', compare) +
      '</div>' +
      barList(platforms.os, null, null, 'Операционные системы (устройства)'));

    var countriesBlock = block('countries', 'Страны и языки интерфейса', 'dayLanguages',
      '<div class="ow-cards">' +
        dayCard('Страны', 'countries', 'по визитам и сессиям, без ботов', 'countryMap', 'filtered', compare) +
        card('Языки интерфейса', num((data.languages || []).length), 'разных locale за день', 'dayLanguages') +
      '</div>' +
      '<div class="ow-block-h" style="margin-top:8px">Страны</div>' +
      table([
        { title: 'Страна', key: 'country', html: function (r) { return esc((LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + countryName(r.country)) + (r.is_new ? ' <span class="ow-tag ow-tag-exact">новая</span>' : ''); } },
        { title: 'Обычные визиты', key: 'visits_human', html: function (r) { return visits ? num(r.visits_human) : '—'; }, numeric: true },
        { title: 'Подозр.', key: 'visits_suspicious', html: function (r) { return visits ? num(r.visits_suspicious) : '—'; }, numeric: true },
        { title: 'Боты', key: 'visits_bot', html: function (r) { return visits ? num(r.visits_bot) : '—'; }, numeric: true },
        { title: 'Люди (с согласием)', key: 'people', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Аккаунтов', key: 'accounts', numeric: true }
      ], data.countries, 'В этот день визитов не было') +
      '<div class="ow-block-h" style="margin-top:12px">Языки интерфейса</div>' +
      table([
        { title: 'Язык', key: 'locale' }, { title: 'Людей', key: 'people', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.languages, 'Нет данных с согласием'));

    var lotteriesBlock = block('lotteries', 'Лотереи', 'funnels',
      table([
        { title: 'Лотерея', key: 'lottery' }, { title: 'Людей', key: 'people', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Событий', key: 'events', numeric: true }, { title: 'Генераций', key: 'generator_runs', numeric: true }, { title: '3D', key: 'draw3d', numeric: true }
      ], data.lotteries, 'В этот день лотереи не открывали'));

    var featuresBlock = block('features', 'Функции: события и уникальные пользователи', 'dayFeatures',
      table([
        { title: 'Функция', key: 'feature', html: function (r) { return esc(label(LIB.EVENT_RU, r.feature)); } },
        { title: 'Событий', key: 'events', numeric: true }, { title: 'Уникальных пользователей', key: 'users', numeric: true }
      ], data.features, 'Событий с согласием не было') +
      barList(data.pages, { sim: 'Симулятор', ana: 'Статистика', privacy: 'Политика', terms: 'Условия' }, null, 'Разделы (просмотры)'));

    var steps = data.funnel || [];
    var first = steps.length ? (+steps[0].value || 0) : 0;
    var stepTitles = { visits: 'Обычные визиты', people: 'Люди с согласием', signup: 'Регистрации', paywall: 'Увидели PRO', checkout: 'Начали оплату', purchase: 'Купили PRO' };
    var funnelBlock = block('funnel', 'Регистрации и конверсия в PRO', 'conversion',
      steps.map(function (step) {
        var value = +step.value || 0;
        return '<div class="ow-bar"><span class="ow-bar-l">' + esc(stepTitles[step.step] || step.step) + ' <span class="ow-tag ow-tag-' + esc(step.precision) + '">' + esc(label(LIB.PRECISION_RU, step.precision)) + '</span></span>' +
          '<span class="ow-bar-t"><i style="width:' + (first ? Math.max(1, Math.round((value / first) * 100)) : 0) + '%"></i></span>' +
          '<span class="ow-bar-v">' + num(value) + ' · ' + pctText(value, first) + '</span></div>';
      }).join('') +
      '<div class="ow-card-s" style="margin-top:6px">Ступени с разной точностью не складываются в одну воронку буквально: визиты — счётчики, люди — только с согласием, регистрации и покупки — точные записи.</div>');

    var byCurrency = (commerce.revenue_by_currency || []).map(function (r) { return (LIB.formatMoney ? LIB.formatMoney(r.amount, r.currency) : r.amount + ' ' + r.currency) + ' (' + num(r.n) + ')'; }).join(' · ');
    var commerceBlock = block('commerce', 'Платежи и подписки', 'dayCommerce',
      '<div class="ow-cards">' +
        dayCard('Checkout начат', 'checkout_started', 'клиент открыл оплату · по телеметрии: ' + num((commerce.telemetry || {}).purchase_start), 'dayCommerce', 'exact', compare) +
        dayCard('Checkout не удался', 'checkout_failed', 'отменено пользователем: ' + num(s.checkout_cancelled), 'dayCommerce', 'exact', compare) +
        dayCard('Покупки PRO', 'purchases', 'подтверждено магазином', 'dayCommerce', 'exact', compare) +
        dayCard('Продления', 'renewals', 'подтверждено магазином', 'dayCommerce', 'exact', compare) +
        dayCard('Отмены', 'cancellations', 'истекло: ' + num(s.expirations), 'dayCommerce', 'exact', compare) +
        dayCard('Возвраты', 'refunds', commerce.refund_usd != null ? 'на сумму ' + esc(LIB.formatMoney ? LIB.formatMoney(commerce.refund_usd, 'USD') : commerce.refund_usd) : 'сумма неизвестна', 'dayCommerce', 'exact', compare) +
        dayCard('Сбои оплаты', 'payment_failures', 'магазин + клиент', 'dayCommerce', 'exact', compare) +
        dayCard('Выручка (USD)', 'revenue_usd', num(s.revenue_known) + ' событий с суммой · ' + num(s.revenue_unknown) + ' без суммы' + (byCurrency ? '<br>' + esc(byCurrency) : ''), 'dayCommerce', 'exact', compare, { money: true }) +
      '</div>' +
      barList(commerce.by_plan, { 1: '1 месяц', 3: '3 месяца', 6: '6 месяцев', 12: '12 месяцев', unknown: 'Тариф не определён' }, 'dayCommerce', 'Тариф (покупки и продления)') +
      barList(commerce.by_store, { apple: 'App Store', google: 'Google Play', paddle: 'Paddle (веб)', stripe: 'Stripe', revenuecat: 'RevenueCat', web: 'Веб', ios: 'iOS', android: 'Android', unknown: 'Не определено' }, 'dayCommerce', 'Платформа покупки') +
      '<div class="ow-block-h" style="margin-top:12px">События магазина</div>' +
      table([
        { title: 'Время', key: 'at', html: function (r) { return esc(clockText(r.at)); } },
        { title: 'Событие', key: 'name', html: function (r) { return esc(label(LIB.COMMERCE_RU, r.name)); } },
        { title: 'Тариф', key: 'plan', html: function (r) { return r.plan ? esc(r.plan) + ' мес.' : '—'; } },
        { title: 'Магазин', key: 'store', html: function (r) { return esc(r.store || '—'); } },
        { title: 'Сумма', key: 'price', html: function (r) { return r.price != null && r.currency ? esc(LIB.formatMoney ? LIB.formatMoney(r.price, r.currency) : r.price + ' ' + r.currency) : '<span class="ow-card-s">без суммы</span>'; }, numeric: true },
        { title: 'USD', key: 'price_usd', html: function (r) { return r.price_usd != null ? num(r.price_usd) : '—'; }, numeric: true },
        { title: 'Статус', key: 'status', html: function (r) { return statusChip(r.status); } },
        { title: 'Страна', key: 'country', html: function (r) { return esc(r.country ? countryName(r.country) : '—'); } },
        { title: 'Причина', key: 'reason', html: function (r) { return esc(r.reason || '—'); } }
      ], commerce.events, 'Событий магазина в этот день не было') +
      '<div class="ow-card-s" style="margin-top:6px">' + esc(commerce.note || '') + '</div>');

    var ingest = {};
    (system.ingest || []).forEach(function (row) { ingest[row.outcome + ': ' + (row.reason || '—')] = row.events; });
    var systemBlock = block('system', 'Сбои и системные события', 'daySystem',
      '<div class="ow-cards">' +
        dayCard('Отклонено приёмом', 'ingest_rejected', 'событий rejected + invalid', 'quality', 'exact', compare) +
        dayCard('Ошибки разбора', 'resolve_errors', 'запусков analytics_resolve со статусом error', 'quality', 'exact', compare) +
        dayCard('Push не доставлен', 'push_failed', 'отправлено: ' + num((system.push || {}).sent), 'daySystem', 'exact', compare) +
        card('Ошибки в приложении', num(system.client_errors), 'client_error у пользователей', 'daySystem') +
      '</div>' +
      barList(ingest, null, 'quality', 'Приём событий') +
      '<div class="ow-block-h" style="margin-top:12px">Ошибки разбора</div>' +
      table([
        { title: 'Когда', key: 'at', html: function (r) { return esc(clockText(r.at)); } }, { title: 'Причина', key: 'trigger' }, { title: 'Ошибка', key: 'error' }
      ], system.resolution_errors, 'Ошибок разбора не было') +
      '<div class="ow-block-h" style="margin-top:12px">Системные уведомления владельца</div>' +
      table([
        { title: 'Когда', key: 'at', html: function (r) { return esc(clockText(r.at)); } }, { title: 'Заголовок', key: 'title' }, { title: 'Детали', key: 'body' }
      ], system.notifications, 'Системных уведомлений не было'));

    return head + identityBlock + visitsBlock + peopleBlock + accountsBlock + platformsBlock + countriesBlock + lotteriesBlock + featuresBlock + funnelBlock + commerceBlock + systemBlock;
  }

  function renderPeople(data) {
    var rows = (data.rows || []).map(function (row) { return Object.assign({}, row, { __click: true }); });
    return '<div class="ow-block"><div class="ow-block-h">Люди: ' + num(data.total) + how('estimated') +
      '<select id="ow-kind" style="margin-left:auto">' +
        ['all', 'verified', 'probable', 'unknown'].map(function (kind) {
          return '<option value="' + kind + '"' + (kind === state.peopleKind ? ' selected' : '') + '>' +
            esc(kind === 'all' ? 'Все категории' : label(LIB.KIND_RU, kind)) + '</option>';
        }).join('') + '</select></div>' +
      table([
        { title: 'ID', key: 'short' },
        { title: 'Категория', key: 'kind', html: function (r) { return esc(label(LIB.KIND_RU, r.kind)); } },
        { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Устройств', key: 'devices', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)); }, numeric: true },
        { title: 'Источник', key: 'channel', html: function (r) { return esc(label(LIB.CHANNEL_RU, r.channel)); } },
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Первый визит', key: 'first_seen', html: function (r) { return esc(timeText(r.first_seen)) + (r.is_new ? ' · новый' : ''); } },
        { title: 'Последний', key: 'last_seen', html: function (r) { return esc(timeText(r.last_seen)); } },
        { title: 'Дом', key: 'household' }
      ], rows, 'Нет людей за период') +
      pager(data.total) + '</div>';
  }

  function pager(total) {
    var size = 50;
    if (!total || total <= size) return '';
    var pages = Math.ceil(total / size);
    return '<div class="ow-bar" style="margin-top:8px"><span class="ow-bar-l">Страница ' + (state.page + 1) + ' из ' + pages + '</span>' +
      '<span><button class="ow-btn" type="button" data-page="prev"' + (state.page ? '' : ' disabled') + '>Назад</button> ' +
      '<button class="ow-btn" type="button" data-page="next"' + (state.page + 1 < pages ? '' : ' disabled') + '>Вперёд</button></span><span></span></div>';
  }

  function renderHouseholds(data) {
    return '<div class="ow-block"><div class="ow-block-h">Домохозяйства: ' + num(data.total) + how('households') + '</div>' +
      table([
        { title: 'ID', key: 'short' },
        { title: 'Людей (оценка)', key: 'people_min', html: function (r) { return num(r.people_min) + '–' + num(r.people_max); }, numeric: true },
        { title: 'Подтверждённых', key: 'verified_people', numeric: true },
        { title: 'Вероятных', key: 'probable_people', numeric: true },
        { title: 'Устройств', key: 'devices', numeric: true },
        { title: 'Профилей', key: 'profiles', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } },
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Владелец', key: 'owner_household', html: function (r) { return r.owner_household ? 'да' : '—'; } },
        { title: 'Последний визит', key: 'last_seen', html: function (r) { return esc(timeText(r.last_seen)); } }
      ], data.rows, 'Домохозяйства не определены: нужны повторные визиты из домашней сети') + '</div>';
  }

  function renderDevices(data) {
    return '<div class="ow-cards">' +
      card('Типы', Object.keys(data.by_kind || {}).map(function (k) { return esc(k) + ': ' + num(data.by_kind[k]); }).join('<br>') || '—', '', 'devices') +
      card('ОС', Object.keys(data.by_os || {}).slice(0, 6).map(function (k) { return esc(k) + ': ' + num(data.by_os[k]); }).join('<br>') || '—') +
      card('Браузеры', Object.keys(data.by_browser || {}).slice(0, 6).map(function (k) { return esc(k) + ': ' + num(data.by_browser[k]); }).join('<br>') || '—') +
      card('Платформы', Object.keys(data.by_platform || {}).map(function (k) { return esc(k) + ': ' + num(data.by_platform[k]); }).join('<br>') || '—') +
      card('Экраны', Object.keys(data.by_screen || {}).map(function (k) { return esc(k) + ': ' + num(data.by_screen[k]); }).join('<br>') || '—') +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Устройства' + how('devices') + '</div>' +
      table([
        { title: 'ID', key: 'short' },
        { title: 'Тип', key: 'kind' },
        { title: 'ОС', key: 'os' },
        { title: 'Браузеры', key: 'browsers', html: function (r) { return esc((r.browsers || []).join(', ')); } },
        { title: 'Профилей', key: 'profiles', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)); }, numeric: true },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Общее', key: 'shared', html: function (r) { return r.shared ? 'да (несколько аккаунтов)' : '—'; } },
        { title: 'Уверенность', key: 'confidence', html: function (r) { return confidenceChip(r.confidence, r.evidence); } },
        { title: 'Дом', key: 'household' }
      ], data.rows, 'Нет устройств за период') + '</div>';
  }

  function renderSessions(data) {
    return '<div class="ow-cards">' +
      card('Сессии', num(data.total), 'таймаут 30 минут', 'sessions') +
      card('События на сессию', String(data.distribution && data.distribution.events_per_session || 0)) +
    '</div>' +
    barList((data.distribution || {}).duration_buckets, null, 'sessions', 'Длительность сессий') +
    '<div class="ow-block"><div class="ow-block-h">Сессии</div>' +
      table([
        { title: 'Начало', key: 'started_at', html: function (r) { return esc(timeText(r.started_at)); } },
        { title: 'Длит.', key: 'duration_ms', html: function (r) { return esc(dur(r.duration_ms)); }, numeric: true },
        { title: 'Активно', key: 'active_ms', html: function (r) { return esc(dur(r.active_ms)) + (r.active_source === 'estimated' ? ' оц.' : ''); }, numeric: true },
        { title: 'События', key: 'events', numeric: true },
        { title: 'Действия', key: 'interactions', numeric: true },
        { title: 'Вход', key: 'entry' },
        { title: 'Выход', key: 'exit' },
        { title: 'Источник', key: 'channel', html: function (r) { return esc(label(LIB.CHANNEL_RU, r.channel)); } },
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Устройство', key: 'device', html: function (r) { return esc([r.browser, r.os, r.device].filter(Boolean).join(' / ')); } },
        { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Человек', key: 'person' }
      ], data.rows, 'Нет сессий за период') +
      pager(data.total) + '</div>';
  }

  function renderAcquisition(data) {
    var coverage = data.coverage || {};
    return '<div class="ow-cards">' +
      card('Сессии с источником', num(coverage.sessions_with_source), '', 'channels') +
      card('Источник неизвестен', num(coverage.sessions_unknown_source), esc(coverage.note || '')) +
    '</div>' +
    barList(data.first_touch, LIB.CHANNEL_RU, 'channels', 'Первый источник (люди)') +
    barList(data.last_touch, LIB.CHANNEL_RU, 'channels', 'Последний источник (сессии)') +
    barList(data.search_engines, null, null, 'Поисковые системы') +
    barList(data.social, null, null, 'Соцсети') +
    barList(data.ai_assistants, null, null, 'ИИ-ассистенты') +
    '<div class="ow-block"><div class="ow-block-h">Сайты-источники</div>' +
      table([{ title: 'Домен', key: 'domain' }, { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'Людей', key: 'people', numeric: true }],
        data.referrers, 'Переходов по ссылкам не было') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Кампании (UTM)</div>' +
      table([
        { title: 'Источник', key: 'source' }, { title: 'Канал', key: 'medium' }, { title: 'Кампания', key: 'campaign' },
        { title: 'Содержание', key: 'content' }, { title: 'Ключ', key: 'term' },
        { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'Людей', key: 'people', numeric: true }
      ], data.campaigns, 'Меток кампаний не было') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Страницы входа</div>' +
      table([{ title: 'Страница', key: 'page' }, { title: 'Сессий', key: 'sessions', numeric: true }], data.landing_pages, 'Нет данных') + '</div>';
  }

  function renderGeography(data) {
    return '<div class="ow-block"><div class="ow-block-h">Страны' + how('geo') + '</div>' +
      table([
        { title: 'Страна', key: 'country', html: function (r) { return esc(LIB.countryNameRu ? LIB.countryNameRu(r.country) : r.country); } },
        { title: 'Людей', key: 'people', numeric: true }, { title: 'Домохозяйств', key: 'households', numeric: true },
        { title: 'Устройств', key: 'devices', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Новых', key: 'new_people', numeric: true }
      ], data.countries, 'Нет данных') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Регионы</div>' +
      table([
        { title: 'Страна', key: 'country', html: function (r) { return esc(LIB.countryNameRu ? LIB.countryNameRu(r.country) : r.country); } },
        { title: 'Регион', key: 'region' }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'Домохозяйств', key: 'households', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.regions, 'Регион не определён: нужен city-уровень GeoIP') + '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Города</div>' +
      table([
        { title: 'Город', key: 'city' }, { title: 'Регион', key: 'region' },
        { title: 'Страна', key: 'country', html: function (r) { return esc(LIB.countryNameRu ? LIB.countryNameRu(r.country) : r.country); } },
        { title: 'Людей', key: 'people', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.cities, 'Город не определён') + '</div>' +
    barList(data.resolution, { city: 'До города', region: 'До региона', country: 'До страны', none: 'Не определено' }, 'geo', 'Точность определения') +
    barList(data.network_types, { isp: 'Домашний провайдер', mobile: 'Мобильный оператор', hosting: 'Дата-центр', vpn: 'VPN', tor: 'Tor', education: 'Учебная сеть', business: 'Корпоративная', unknown: 'Не определено' }, null, 'Тип сети');
  }

  function renderMap(data) {
    var rows = (data.rows || []).map(function (row) { return Object.assign({}, row, { __click: true }); });
    var totals = data.totals || {};
    var visits = data.visits_available !== false;
    var theme = ovEl.getAttribute('data-ow-theme');
    var scale = (theme === 'dark' ? LIB.BLUE_DARK : LIB.BLUE_LIGHT) || [];
    var legend = '<div class="ow-legend-scale"><span>Нет данных</span><i style="background:' + esc(scale[0] || '#dde6ee') + '"></i><span>меньше</span>' +
      scale.slice(1).map(function (c) { return '<i style="background:' + esc(c) + '"></i>'; }).join('') + '<span>больше · ' + esc(metricLabel(state.mapMetric)) + '</span></div>';
    var cell = function (key) { return function (r) { return visits ? num(r[key]) : '—'; }; };
    return '<div class="ow-block"><div class="ow-block-h">Карта' + how('countryMap') +
      '<select id="ow-mapmetric" aria-label="Показатель карты" style="margin-left:auto">' + MAP_METRICS.map(function (m) {
        return '<option value="' + m[0] + '"' + (m[0] === state.mapMetric ? ' selected' : '') + '>' + esc(m[1]) + '</option>';
      }).join('') + '</select>' +
      '<select id="ow-continent" aria-label="Континент">' + [['all', 'Весь мир']].concat((LIB.CONTINENT_ORDER || []).map(function (c) { return [c, LIB.CONTINENT_RU[c]]; })).map(function (c) {
        return '<option value="' + c[0] + '"' + (c[0] === state.continent ? ' selected' : '') + '>' + esc(c[1]) + '</option>';
      }).join('') + '</select>' +
      '<button class="ow-btn" id="ow-fit" type="button">Показать всё</button></div>' +
      '<div class="ow-map" id="ow-mapbox"></div>' + legend +
      '<div class="ow-map-note">Наведите на страну — подсветится вся её территория; нажмите — откроется карточка. ' +
        (visits ? 'Обычные визиты: ' + num(totals.visits_human) + ' · подозрительных: ' + num(totals.visits_suspicious) + ' · ботов: ' + num(totals.visits_bot) + ' · стран: ' + num(totals.countries)
          : 'Счётчики визитов ещё не накоплены — карта показывает данные, собранные с согласием') +
        ' · аккаунтов со страной: ' + num(totals.registered) + ' · покупателей: ' + num(totals.buyers) + '<br>' + esc(data.note || '') + '</div></div>' +
      '<div class="ow-block"><div class="ow-block-h">Страны</div>' +
      table([
        { title: 'Страна', key: 'country', html: function (r) { return esc((LIB.flagEmoji ? LIB.flagEmoji(r.country) + ' ' : '') + countryName(r.country)) + ' <span class="ow-card-s" style="display:inline">' + esc(r.country) + '</span>'; } },
        { title: 'Обычные визиты', key: 'visits_human', html: cell('visits_human'), numeric: true },
        { title: 'Гости', key: 'visits_guest', html: cell('visits_guest'), numeric: true },
        { title: 'Подозр.', key: 'visits_suspicious', html: cell('visits_suspicious'), numeric: true },
        { title: 'Боты', key: 'visits_bot', html: cell('visits_bot'), numeric: true },
        { title: 'С согласием', key: 'visitors', numeric: true },
        { title: 'Аккаунты', key: 'registered', numeric: true },
        { title: 'FREE / PRO / Lifetime', key: 'free', html: function (r) { return num(r.free) + ' / ' + num(r.pro) + ' / ' + num(r.lifetime); }, numeric: true },
        { title: 'Покупатели', key: 'buyers', numeric: true },
        { title: 'Дом. (оценка)', key: 'households', numeric: true },
        { title: 'Web / iOS / Android', key: 'web', html: function (r) { return visits ? num(r.web) + ' / ' + num(r.ios) + ' / ' + num(r.android) : '—'; }, numeric: true },
        { title: 'Согласия да / нет', key: 'consent_accepted', html: function (r) { return num(r.consent_accepted) + ' / ' + num(r.consent_declined); }, numeric: true }
      ], rows, 'Нет данных за период') + '</div>';
  }

  function renderGames(data) {
    return '<div class="ow-block"><div class="ow-block-h">Лотереи</div>' +
      table([
        { title: 'Лотерея', key: 'lottery' }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'Открытий', key: 'opens', numeric: true },
        { title: 'Генераций', key: 'generator_runs', numeric: true }, { title: 'Сохранений', key: 'saved', numeric: true },
        { title: 'Статистика', key: 'statistics_opens', numeric: true }, { title: '3D', key: 'draw3d', numeric: true },
        { title: 'Проверок билета', key: 'ticket_checks', numeric: true },
        { title: 'Вернувшихся', key: 'returning_people', numeric: true },
        { title: 'Ср. активность', key: 'avg_active_ms', html: function (r) { return esc(dur(r.avg_active_ms)); }, numeric: true }
      ], data.rows, 'Нет активности по лотереям') + '</div>' +
      barList(data.models, null, null, 'Использованные модели');
  }

  function renderFeatures(data) {
    return '<div class="ow-block"><div class="ow-block-h">Функции</div>' +
      table([
        { title: 'Функция', key: 'feature', html: function (r) { return esc(label(LIB.EVENT_RU, r.feature)); } },
        { title: 'Событий', key: 'events', numeric: true }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'Сессий', key: 'sessions', numeric: true }
      ], data.rows, 'Нет событий') + '</div>' +
      barList(data.pages, { sim: 'Симулятор', ana: 'Статистика', privacy: 'Политика', terms: 'Условия' }, null, 'Разделы');
  }

  function renderFunnels(data) {
    var steps = data.steps || [];
    var first = steps.length ? (steps[0].people || 0) : 0;
    var titles = { landing: 'Зашли', game: 'Открыли лотерею', generator_open: 'Открыли генератор', generate: 'Сгенерировали', save: 'Сохранили', signup: 'Зарегистрировались', paywall: 'Увидели PRO', checkout: 'Начали оплату', purchase: 'Оплатили' };
    return '<div class="ow-block"><div class="ow-block-h">Воронка по людям' + how('funnels') + '</div>' +
      steps.map(function (step) {
        var value = step.people || 0;
        return '<div class="ow-bar"><span class="ow-bar-l">' + esc(titles[step.step] || step.step) + '</span>' +
          '<span class="ow-bar-t"><i style="width:' + (first ? Math.max(1, Math.round((value / first) * 100)) : 0) + '%"></i></span>' +
          '<span class="ow-bar-v">' + num(value) + ' · ' + pctText(value, first) + '</span></div>' +
          (step.note ? '<div class="ow-card-s">' + esc(step.note) + '</div>' : '');
      }).join('') + '</div>';
  }

  function renderRetention(data) {
    var summary = data.summary || {};
    return '<div class="ow-cards">' +
      card('Новые люди', num(summary.new), '', 'retention') +
      card('Вернувшиеся', num(summary.returning)) +
      card('Были в 2+ дня', num(summary.multi_day)) +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Когорты' + how('retention') + '</div>' +
      table([
        { title: 'Когорта', key: 'cohort' }, { title: 'Людей', key: 'people', numeric: true },
        { title: 'D1', key: 'd1', html: function (r) { return num(r.d1) + ' · ' + pctText(r.d1, r.people); }, numeric: true },
        { title: 'D7', key: 'd7', html: function (r) { return num(r.d7) + ' · ' + pctText(r.d7, r.people); }, numeric: true },
        { title: 'D30', key: 'd30', html: function (r) { return num(r.d30) + ' · ' + pctText(r.d30, r.people); }, numeric: true }
      ], data.cohorts, 'Пока нет когорт') + '</div>';
  }

  function renderBots(data) {
    var evidence = {};
    Object.keys(data.evidence || {}).forEach(function (key) {
      evidence[LIB.evidenceRu ? LIB.evidenceRu(key) : key] = data.evidence[key];
    });
    return '<div class="ow-cards">' +
      card('Владелец и тесты', num((data.owner_test || {}).profiles) + ' проф.', num((data.owner_test || {}).sessions) + ' сессий', 'excluded') +
      card('Классы трафика', Object.keys(data.classes || {}).map(function (k) { return esc(label(LIB.CLASS_RU, k)) + ': ' + num(data.classes[k]); }).join('<br>') || '—', '', 'excluded') +
    '</div>' +
    barList(evidence, null, 'excluded', 'Признаки, по которым принято решение') +
    '<div class="ow-block"><div class="ow-block-h">Профили с признаками автоматизации</div>' +
      table([
        { title: 'ID', key: 'short' }, { title: 'Класс', key: 'class', html: function (r) { return esc(label(LIB.CLASS_RU, r.class)); } },
        { title: 'Оценка', key: 'bot_score', numeric: true },
        { title: 'Признаки', key: 'evidence', html: function (r) { return esc((r.evidence || []).map(function (e) { return LIB.evidenceRu ? LIB.evidenceRu(e) : e; }).join(' · ')); } },
        { title: 'Сессий', key: 'sessions', numeric: true }, { title: 'События', key: 'events', numeric: true },
        { title: 'Действия', key: 'interactions', numeric: true },
        { title: 'Страна', key: 'country', html: function (r) { return esc(r.country ? (LIB.countryNameRu ? LIB.countryNameRu(r.country) : r.country) : '—'); } },
        { title: 'Браузер', key: 'browser' }, { title: 'Первый', key: 'first_seen', html: function (r) { return esc(timeText(r.first_seen)); } }
      ], data.rows, 'Ботов и тестов за период не найдено') + '</div>';
  }

  function renderQuality(data) {
    var events = data.events || {}, freshness = data.freshness || {}, consent = data.consent || {};
    var ingest = {};
    (data.ingest || []).forEach(function (row) { ingest[row.outcome + ': ' + (row.reason || '—')] = row.events; });
    return '<div class="ow-cards">' +
      card('События за период', num(events.total), num(events.v2) + ' новый формат / ' + num(events.v1_legacy) + ' старый', 'quality') +
      card('Без гео', num(events.missing_geo), pctText(events.missing_geo, events.total) + ' от всех', 'geo') +
      card('С городом', num(events.city_level), pctText(events.city_level, events.total) + ' от всех') +
      card('Начало сессии без источника', num(events.missing_acquisition), 'остаётся «неизвестно»', 'channels') +
      card('С признаком устройства', num(events.with_device_signal), 'только с отдельным согласием') +
      card('Согласия', num(consent.accepted) + ' да / ' + num(consent.declined) + ' нет', num(consent.device_recognition) + ' с распознаванием устройства') +
      card('Задержка разбора', Math.round((freshness.watermark_lag_seconds || 0) / 60) + ' мин', 'разбор идёт каждые 5 минут') +
      card('Последнее событие', esc(timeText(freshness.latest_event))) +
    '</div>' +
    barList(ingest, null, 'quality', 'Приём событий') +
    barList(data.identity_confidence, null, null, 'Распределение уверенности идентификации') +
    barList(freshness.geo_source_mix, null, null, 'Источник геоданных') +
    '<div class="ow-block"><div class="ow-block-h">Запуски разбора</div>' +
      table([
        { title: 'Когда', key: 'at', html: function (r) { return esc(timeText(r.at)); } },
        { title: 'Статус', key: 'status' }, { title: 'Причина', key: 'trigger' },
        { title: 'События', key: 'events', numeric: true }, { title: 'Сессии', key: 'sessions', numeric: true },
        { title: 'Этапы (мс)', key: 'stage_ms', html: function (r) { return esc(Object.keys(r.stage_ms || {}).map(function (k) { return k + ':' + r.stage_ms[k]; }).join(' ')); } },
        { title: 'Ошибка', key: 'error', html: function (r) { return esc(r.error || '—'); } }
      ], data.resolution_runs, 'Разбор ещё не запускался') + '</div>';
  }

  function renderConsent(data) {
    var decisions = data.decisions || {}, coverage = data.analytics_coverage || {}, device = data.device_recognition || {};
    var acceptRate = data.accept_rate == null ? '—' : data.accept_rate + '%';
    return '<div class="ow-cards">' +
      card('Решений о согласии', num(decisions.total), 'за выбранный период', 'consent') +
      card('Согласились на аналитику', num(decisions.accepted), 'доля среди решений: ' + esc(acceptRate)) +
      card('Только необходимое', num(decisions.only_necessary), 'отказ от необязательной статистики') +
      card('Включили «Повторные посещения»', num(decisions.device_recognition), num(device.profiles_with_signal) + ' профилей с признаком') +
      card('Данные с согласием', num(coverage.events_consented), num(coverage.events_legacy) + ' событий собрано до внедрения согласия') +
      card('Профили с согласием', num(coverage.consented_profiles), num(coverage.legacy_profiles) + ' старых профилей') +
      card('Охват от всех посетителей', 'нельзя измерить', 'см. пояснение ниже', 'consent') +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Почему нет процента охвата</div>' +
      '<div class="ow-card-s">' + esc(coverage.note || '') + '</div></div>' +
    barList(data.by_source, { banner: 'Баннер', settings: 'Настройки', privacy_page: 'Страница политики' }, null, 'Где принято решение') +
    barList(data.by_platform, { web: 'Веб', ios: 'iOS', android: 'Android', unknown: 'Не указано' }, null, 'Платформа') +
    barList(data.by_policy, null, null, 'Версия политики') +
    lineChart(data.timeseries || [], ['accepted', 'only_necessary'], ['Согласились', 'Только необходимое']);
  }

  var RENDERERS = {
    day: renderDay, overview: renderOverview, live: renderLive, people: renderPeople, households: renderHouseholds,
    devices: renderDevices, sessions: renderSessions, acquisition: renderAcquisition, geography: renderGeography,
    map: renderMap, games: renderGames, features: renderFeatures, funnels: renderFunnels,
    retention: renderRetention, bots: renderBots, consent: renderConsent, quality: renderQuality
  };

  function render() {
    var host = ovEl.querySelector('#ow-section');
    var response = state.data[state.section];
    if (state.error) { host.innerHTML = ''; renderError(state.error, reload); return; }
    if (!response) { host.innerHTML = '<div class="ow-empty">Нет данных</div>'; return; }
    var renderer = RENDERERS[state.section];
    host.innerHTML = renderer ? renderer(response.data || {}) : '<div class="ow-empty">Раздел недоступен</div>';
    var range = response.range || {};
    if (!state.lastRefresh && state.preset === 'day') {
      setStatus('День ' + esc(state.day) + ' · ' + esc(range.tz || state.tz) + (state.filters.country !== 'all' ? ' · страна ' + esc(state.filters.country) : '') +
        (response.ms != null ? ' · ' + response.ms + ' мс' : ''));
    } else if (!state.lastRefresh) {
      setStatus('Период ' + esc(String(range.from || '').slice(0, 16).replace('T', ' ')) + ' — ' +
        esc(String(range.to || '').slice(0, 16).replace('T', ' ')) + ' · ' + esc(range.tz || '') +
        (response.ms != null ? ' · ' + response.ms + ' мс' : ''));
    }
  }

  // ── export ─────────────────────────────────────────────────────────────────────────────────
  function exportCurrent() {
    var response = state.data[state.section];
    if (!response) return;
    var data = response.data || {};
    var rows = Array.isArray(data.rows) ? data.rows : (Array.isArray(data.points) ? data.points : (Array.isArray(data.countries) ? data.countries : null));
    var name = 'loto-analytics-' + state.section + '-' + new Date().toISOString().slice(0, 10);
    var blob, filename;
    if (rows && rows.length && LIB.csv) {
      var columns = Object.keys(rows[0]).filter(function (key) { return key.indexOf('__') !== 0; }).map(function (key) { return { key: key, title: key }; });
      blob = new Blob(['﻿' + LIB.csv(columns, rows)], { type: 'text/csv;charset=utf-8' });
      filename = name + '.csv';
    } else {
      blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
      filename = name + '.json';
    }
    var url = URL.createObjectURL(blob);
    var link = D.createElement('a');
    link.href = url;
    link.download = filename;
    D.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ── wiring ─────────────────────────────────────────────────────────────────────────────────
  function wire() {
    ovEl.querySelector('#ow-back').addEventListener('click', close);
    ovEl.querySelector('#ow-refresh').addEventListener('click', refresh);
    ovEl.querySelector('#ow-export').addEventListener('click', exportCurrent);
    ovEl.querySelector('#ow-theme').addEventListener('click', function () {
      var next = ovEl.getAttribute('data-ow-theme') === 'dark' ? 'light' : 'dark';
      ovEl.setAttribute('data-ow-theme', next);
      try { W.localStorage.setItem(THEME_KEY, next); } catch (e) {}
      // render() rebuilds the section markup, which replaces #ow-mapbox: the map must be re-mounted
      // into the new element (a theme swap on the orphaned map instance would leave an empty box).
      if (state.data[state.section]) render();
      if (state.section === 'map') mountMap(true);
    });
    ovEl.querySelector('#ow-tabs').addEventListener('click', function (event) {
      var tab = event.target.closest('[data-section]');
      if (!tab) return;
      state.page = 0;
      show(tab.getAttribute('data-section'));
    });
    ovEl.querySelector('#ow-preset').addEventListener('change', function (event) {
      state.preset = event.target.value;
      if (state.preset === 'day' && !state.day && LIB.todayYMD) state.day = LIB.todayYMD(state.tz);
      syncControls();
      if (state.preset !== 'custom' || (state.custom.from && state.custom.to)) { state.data = {}; state.page = 0; reload(); }
    });
    // Calendar: quick chips (today / yesterday / day before), one-day arrows, any date of any year.
    ovEl.querySelector('#ow-daybar').addEventListener('click', function (event) {
      var chip = event.target.closest('.ow-chip[data-day]');
      if (chip && LIB.todayYMD && LIB.shiftDay) { setDay(LIB.shiftDay(LIB.todayYMD(state.tz), +chip.getAttribute('data-day'))); return; }
      var nav = event.target.closest('#ow-day-prev, #ow-day-next');
      if (nav && LIB.shiftDay) setDay(LIB.shiftDay(state.day || LIB.todayYMD(state.tz), nav.id === 'ow-day-prev' ? -1 : 1));
    });
    ovEl.querySelector('#ow-day').addEventListener('change', function (event) { if (event.target.value) setDay(event.target.value); });
    ovEl.querySelector('#ow-from').addEventListener('change', function (event) {
      state.custom.from = event.target.value;
      if (state.custom.to) { state.data = {}; reload(); }
    });
    ovEl.querySelector('#ow-to').addEventListener('change', function (event) {
      state.custom.to = event.target.value;
      if (state.custom.from) { state.data = {}; reload(); }
    });
    ovEl.querySelector('#ow-tz').addEventListener('change', function (event) { state.tz = event.target.value; state.data = {}; syncControls(); reload(); });
    ovEl.querySelector('#ow-platform').addEventListener('change', function (event) { state.filters.platform = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-lottery').addEventListener('change', function (event) { state.filters.lottery = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-audience').addEventListener('change', function (event) { state.filters.audience = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-compare').addEventListener('change', function (event) { state.compare = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-owner').addEventListener('change', function (event) { state.toggles.owner = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-bots').addEventListener('change', function (event) { state.toggles.bots = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-unknown').addEventListener('change', function (event) { state.toggles.unknown = event.target.checked; state.data = {}; reload(); });

    ovEl.querySelector('#ow-content').addEventListener('click', function (event) {
      var anchor = event.target.closest('.ow-anchors a[data-block]');
      if (anchor) { event.preventDefault(); state.block = anchor.getAttribute('data-block'); focusBlock(); return; }
      var howButton = event.target.closest('[data-how]');
      if (howButton) { openPopup('Как считается', esc(HOW[howButton.getAttribute('data-how')] || '')); return; }
      var pageButton = event.target.closest('[data-page]');
      if (pageButton) {
        state.page = Math.max(0, state.page + (pageButton.getAttribute('data-page') === 'next' ? 1 : -1));
        state.data[state.section] = null;
        show(state.section, { limit: 50, offset: state.page * 50, kind: state.peopleKind !== 'all' ? state.peopleKind : undefined });
        return;
      }
      if (event.target.closest('[data-kpi-retry]')) { state.data.kpi = null; show('overview'); return; }
      var row = event.target.closest('tr.ow-click');
      if (row && state.section === 'map') {
        var country = countryRows()[+row.getAttribute('data-row')];
        if (country) { openCountry(country.country); if (mapApi) mapApi.focus(country.country); }
        return;
      }
      if (row && state.section === 'people') {
        var response = state.data.people;
        var person = response && response.data && response.data.rows && response.data.rows[+row.getAttribute('data-row')];
        if (person) openPerson(person.person);
      }
    });
    ovEl.querySelector('#ow-content').addEventListener('change', function (event) {
      if (event.target.id === 'ow-kind') {
        state.peopleKind = event.target.value;
        state.page = 0;
        state.data.people = null;
        show('people', { kind: state.peopleKind !== 'all' ? state.peopleKind : undefined });
      }
      if (event.target.id === 'ow-mapmetric') {
        state.mapMetric = event.target.value;
        if (mapApi) mapApi.setMetric(state.mapMetric);
        var legend = ovEl.querySelector('.ow-legend-scale span:last-child');
        if (legend) legend.textContent = 'больше · ' + metricLabel(state.mapMetric);
      }
      if (event.target.id === 'ow-continent') { state.continent = event.target.value; if (mapApi) mapApi.setContinent(state.continent); }
    });
    ovEl.querySelector('#ow-content').addEventListener('click', function (event) {
      if (event.target.id === 'ow-fit' && mapApi) { state.continent = 'all'; var sel = ovEl.querySelector('#ow-continent'); if (sel) sel.value = 'all'; mapApi.setContinent('all'); }
    });
    D.addEventListener('keydown', function (event) {
      if (!ovEl || !ovEl.classList.contains('show')) return;
      if (event.key === 'Escape') {
        if (ovEl.querySelector('#ow-sheet')) { ovEl.querySelector('#ow-sheet').remove(); state.selectedCountry = null; if (mapApi) mapApi.select(null); }
        else if (ovEl.querySelector('#ow-pop')) closePopup();
        else close();
      }
    });
  }

  function fillLotteries() {
    try {
      var select = ovEl.querySelector('#ow-lottery');
      var keys = Object.values(W.LOTO_APP_LOTTERY_KEYS || {});
      if (!keys.length || select.options.length > 1) return;
      select.innerHTML = '<option value="all">Все</option>' + keys.sort().map(function (key) {
        return '<option value="' + esc(key) + '">' + esc(key) + '</option>';
      }).join('');
    } catch (e) {}
  }

  // ── open / close ───────────────────────────────────────────────────────────────────────────
  var fromAccount = false;
  async function open(viaAccount) {
    fromAccount = !!viaAccount;
    build();
    fillLotteries();
    syncControls();
    ovEl.classList.add('show');
    D.documentElement.style.overflow = 'hidden';
    var owner = await isOwner();
    if (!owner) {
      ovEl.querySelector('#ow-section').innerHTML = '<div class="ow-deny"><h2>Доступ только для владельца</h2>' +
        '<p>Эта панель доступна только аккаунту владельца проекта.</p></div>';
      return;
    }
    startOwnerNotifications();
    await show(state.section);
  }
  // The Owner Notification Center is part of THIS panel, not of the public page: it is fetched on
  // the first open and started/stopped with the panel, so no owner query, listener or timer can
  // run while the panel is closed.
  var notifPromise = null;
  function startOwnerNotifications() {
    if (W.LotoOwnerNotifications) { W.LotoOwnerNotifications.start(); return; }
    if (!notifPromise) {
      var load = (typeof W.LotoLoadRuntimeScript === 'function')
        ? W.LotoLoadRuntimeScript('owner-notifications.js')
        : Promise.reject(new Error('no_loader'));
      notifPromise = load.catch(function (error) { notifPromise = null; throw error; });
    }
    notifPromise.then(function () {
      if (W.LotoOwnerNotifications && ovEl && ovEl.classList.contains('show')) W.LotoOwnerNotifications.start();
    }).catch(function () { /* the bell simply stays hidden; the report itself is unaffected */ });
  }
  function stopOwnerNotifications() {
    try { if (W.LotoOwnerNotifications) W.LotoOwnerNotifications.stop(); } catch (e) {}
  }
  function close() {
    if (!ovEl) return;
    ovEl.classList.remove('show');
    D.documentElement.style.overflow = '';
    stopLive();
    stopOwnerNotifications();
    closePopup();
    if (mapApi) { mapApi.destroy(); mapApi = null; }
    if (location.hash.indexOf('#owner') === 0) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; }
    }
    if (fromAccount) { fromAccount = false; try { if (typeof W.openAccount === 'function') W.openAccount(); } catch (e) {} }
  }

  // Reveal the «Панель владельца» button in Личный кабинет — ONLY after a server owner probe.
  function revealAccountEntry() {
    (async function () {
      try {
        if (!(W.LotoAuth && W.LotoAuth.getSession)) return;
        var session = await W.LotoAuth.getSession();
        var button = D.getElementById('acc-owner-btn');
        if (!session || !session.user || session.user.is_anonymous) { if (button) button.hidden = true; return; }
        var owner = await isOwner();
        if (!button) return;
        if (!button.textContent) button.textContent = 'Панель владельца';
        button.hidden = !owner;
        if (owner && !button.__wired) {
          button.__wired = true;
          button.addEventListener('click', function () {
            try { if (typeof W.closeAccount === 'function') W.closeAccount(); } catch (e) {}
            open(true);
          });
        }
      } catch (e) {}
    })();
  }

  // ── deep links: #owner?d=YYYY-MM-DD&s=<section>&b=<block>&c=<country> ─────────────────────
  // Every owner notification (push and in-app) carries such a link; opening it lands on that day,
  // that section and that block with the country filter applied. Unknown values fall back safely.
  function applyLink(link) {
    if (!link) return;
    if (link.d) { state.preset = 'day'; state.day = link.d; }
    if (link.c && /^[A-Z]{2}$/.test(link.c)) { state.filters.country = link.c; state.selectedCountry = link.c; }
    else if (link.c === 'all') state.filters.country = 'all';
    var section = link.s;
    var known = SECTIONS.some(function (x) { return x.id === section; });
    state.section = known ? section : (link.d || link.b ? 'day' : state.section);
    state.block = link.b || null;
    state.data = {};
    state.page = 0;
  }
  async function openLink(hash) {
    var link = LIB.parseOwnerLink ? LIB.parseOwnerLink(hash) : null;
    if (link === null) link = {};
    applyLink(link);
    if (ovEl && ovEl.classList.contains('show')) { syncControls(); await show(state.section); return; }
    await open(false);
  }
  // _map / _state: read-only accessors for the browser tests (the panel is owner-only; this grants nothing).
  W.LotoOwnerDashboard = { open: open, close: close, openLink: openLink, revealAccountEntry: revealAccountEntry,
    _map: function () { return mapApi; }, _state: function () { return JSON.parse(JSON.stringify(state, function (k, v) { return k === 'data' ? undefined : v; })); } };
  W.addEventListener('hashchange', function () { if (location.hash.indexOf('#owner') === 0) openLink(location.hash); });
  try { W.addEventListener('loto:accesschange', revealAccountEntry); } catch (e) {}
  function wrapOpenAccount() {
    try {
      var orig = W.openAccount;
      if (typeof orig === 'function' && !orig.__owWrapped) {
        var wrapped = function () { var result = orig.apply(this, arguments); try { revealAccountEntry(); } catch (e) {} return result; };
        wrapped.__owWrapped = true;
        W.openAccount = wrapped;
      }
    } catch (e) {}
  }
  function boot() {
    if (location.hash.indexOf('#owner') === 0) openLink(location.hash);
    revealAccountEntry();
    wrapOpenAccount();
    var tries = 0;
    var timer = setInterval(function () { wrapOpenAccount(); if (++tries >= 6) clearInterval(timer); }, 800);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
