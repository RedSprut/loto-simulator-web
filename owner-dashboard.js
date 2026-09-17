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
    { id: 'quality', label: 'Качество данных' }
  ];
  var PRESETS = [
    ['live', 'Live · 30 минут'], ['today', 'Сегодня'], ['yesterday', 'Вчера'], ['7d', '7 дней'],
    ['30d', '30 дней'], ['90d', '90 дней'], ['month', 'Текущий месяц'], ['lastMonth', 'Прошлый месяц'],
    ['all', 'Всё время'], ['custom', 'Период…']
  ];
  var MAP_MODES = [
    ['people', 'Реальные люди'], ['households', 'Домохозяйства'], ['sessions', 'Сессии'],
    ['devices', 'Устройства'], ['bots', 'Боты'], ['all', 'Весь трафик']
  ];
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
    funnels: 'Воронка по людям: на каждом шаге считается число людей, которые его достигли в выбранном периоде.',
    retention: 'Когорты по дню первого визита. D1/D7/D30 — вернулся ли человек ровно на 1-й, 7-й и 30-й день.',
    quality: 'Качество приёма: сколько событий принято, сколько отклонено и почему. Здесь же свежесть данных и распределение уверенности идентификации.'
  };

  var state = {
    section: 'overview',
    preset: '7d',
    tz: 'Europe/Oslo',
    custom: { from: '', to: '' },
    filters: { platform: 'all', country: 'all', lottery: 'all' },
    toggles: { owner: false, bots: false, unknown: true },
    compare: true,
    page: 0,
    peopleKind: 'all',
    mapMode: 'people',
    heatmap: false,
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
      throw error;
    }
    return body;
  }
  async function isOwner() {
    try { var r = await api({ probe: true }); return r && r.owner === true; } catch (e) { return false; }
  }
  function currentRange() {
    var r = LIB.range ? LIB.range(state.preset, Date.now(), state.tz, state.custom.from, state.custom.to) : null;
    return r || { from: new Date(Date.now() - 7 * 86400000).toISOString(), to: new Date().toISOString(), bucket: 'day', tz: state.tz };
  }
  function params(extra) {
    var range = currentRange();
    var payload = {
      from: range.from, to: range.to, tz: range.tz, bucket: range.bucket,
      platform: state.filters.platform, country: state.filters.country, lottery: state.filters.lottery,
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
        return '<tr' + (row.__click ? ' class="ow-click" data-row="' + index + '"' : '') + '>' +
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
  function lineChart(series, keys, titles) {
    if (!series || series.length < 2) return '<div class="ow-empty">Для графика нужно минимум две точки</div>';
    var width = 720, height = 190, padLeft = 42, padBottom = 26, padTop = 12;
    var max = 0;
    series.forEach(function (point) { keys.forEach(function (key) { max = Math.max(max, +point[key] || 0); }); });
    max = max || 1;
    var stepX = (width - padLeft - 10) / Math.max(1, series.length - 1);
    var colors = ['#a5316b', '#5ad19a', '#f2c14e'];
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
    try { return W.matchMedia && W.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function ensureStyles() {
    if (D.getElementById('ow-style')) return;
    var css = [
      '#ow-ov{position:fixed;inset:0;z-index:1300;display:none;background:var(--ow-bg);color:var(--ow-tx);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden}',
      '#ow-ov.show{display:flex;flex-direction:column}',
      '#ow-ov[data-ow-theme="dark"]{--ow-bg:#0e0710;--ow-card:#1a0e16;--ow-card2:#160c13;--ow-tx:#f3e9ef;--ow-sub:#b79aac;--ow-bd:#33202e;--ow-accent:#a5316b;--ow-up:#5ad19a;--ow-down:#f2789a;--ow-chip:#241420}',
      '#ow-ov[data-ow-theme="light"]{--ow-bg:#f6eef2;--ow-card:#ffffff;--ow-card2:#fbf4f8;--ow-tx:#25141d;--ow-sub:#6f5563;--ow-bd:#e7d3de;--ow-accent:#b3255f;--ow-up:#1a7f4b;--ow-down:#c2185b;--ow-chip:#f3e3ea}',
      '#ow-ov .ow-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--ow-bd);background:var(--ow-card);min-width:0}',
      '#ow-ov .ow-title{font-weight:800;font-size:16px;margin-right:auto;min-width:0;flex:1 1 140px}',
      '#ow-ov .ow-btn{min-height:34px;padding:6px 12px;border-radius:10px;border:1px solid var(--ow-bd);background:var(--ow-card2);color:inherit;font:inherit;font-weight:700;cursor:pointer}',
      '#ow-ov .ow-btn[disabled]{opacity:.6;cursor:progress}',
      '#ow-ov .ow-btn-primary{background:var(--ow-accent);border-color:var(--ow-accent);color:#fff}',
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
      '#ow-ov .ow-card-h{display:flex;align-items:center;gap:6px;color:var(--ow-sub);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}',
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
      '#ow-ov .ow-map-note{color:var(--ow-sub);font-size:12px;margin-top:6px}',
      '#ow-ov .ow-pop{position:fixed;inset:auto 12px 12px 12px;max-width:560px;margin:0 auto;background:var(--ow-card);border:1px solid var(--ow-bd);border-radius:14px;padding:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);z-index:20}',
      '#ow-ov .ow-pop h3{margin:0 0 6px;font-size:14px}',
      '#ow-ov .ow-pop p{margin:0;color:var(--ow-sub);font-size:13px}',
      '#ow-ov .ow-sheet{position:fixed;inset:0;background:rgba(8,4,8,.55);display:flex;align-items:flex-end;justify-content:center;z-index:30}',
      '#ow-ov .ow-sheet-in{background:var(--ow-card);border-radius:16px 16px 0 0;width:min(760px,100%);max-height:88vh;overflow:auto;padding:14px}',
      '@media (min-width:720px){#ow-ov .ow-sheet{align-items:center}#ow-ov .ow-sheet-in{border-radius:16px}}',
      '#ow-ov .ow-jr{display:grid;grid-template-columns:64px 1fr;gap:8px;padding:5px 0;border-bottom:1px solid var(--ow-bd);font-size:13px}',
      '#ow-ov .ow-jr b{font-variant-numeric:tabular-nums;color:var(--ow-sub);font-weight:700}',
      '#ow-ov .ow-deny{padding:30px;text-align:center}'
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
        '<button class="ow-btn" id="ow-theme" type="button">Тема</button>' +
        '<button class="ow-btn" id="ow-export" type="button">Экспорт</button>' +
        '<button class="ow-btn ow-btn-primary" id="ow-refresh" type="button">Обновить</button>' +
      '</div>' +
      '<div class="ow-controls">' +
        '<label>Период <select id="ow-preset"></select></label>' +
        '<span id="ow-custom" hidden><input type="date" id="ow-from"> — <input type="date" id="ow-to"></span>' +
        '<label>Часовой пояс <select id="ow-tz"></select></label>' +
        '<label>Платформа <select id="ow-platform"><option value="all">Все</option><option value="web">Веб</option><option value="ios">iOS</option><option value="android">Android</option></select></label>' +
        '<label>Лотерея <select id="ow-lottery"><option value="all">Все</option></select></label>' +
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

    var presetSelect = ovEl.querySelector('#ow-preset');
    presetSelect.innerHTML = PRESETS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === state.preset ? ' selected' : '') + '>' + esc(p[1]) + '</option>'; }).join('');
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
  async function show(section, extra) {
    state.section = section;
    ovEl.querySelectorAll('.ow-tab').forEach(function (tab) {
      tab.setAttribute('aria-selected', String(tab.getAttribute('data-section') === section));
    });
    stopLive();
    await load(section, extra);
    render();
    if (section === 'live') startLive();
    if (section === 'map') mountMap();
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
      await load(state.section);
      render();
      if (state.section === 'map') { await mountMap(true); }
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

  function renderError(error, retry) {
    var host = ovEl.querySelector('#ow-section');
    var box = D.createElement('div');
    box.className = 'ow-err';
    box.innerHTML = '<span>Ошибка: ' + esc((error && error.message) || 'неизвестно') + '</span>';
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
  async function mountMap(force) {
    var host = ovEl.querySelector('#ow-mapbox');
    if (!host || mapLoading) return;
    var data = (state.data.map && state.data.map.data) || { points: [], live: [] };
    if (mapApi && !force) { mapApi.setData(data.points, data.live); mapApi.setMode(state.mapMode); mapApi.resize(); return; }
    mapLoading = true;
    setHourglass(true, 'Загрузка карты…');
    try {
      if (mapApi) { mapApi.destroy(); mapApi = null; }
      var module = await import('./owner-map.js');
      mapApi = await module.createMap({
        container: host,
        theme: ovEl.getAttribute('data-ow-theme'),
        onPick: function (props, coords, live) {
          openPopup(live ? 'Активность сейчас' : place(props),
            live
              ? esc(place(props)) + ' · событий за 15 минут: ' + num(props.events)
              : 'Люди: ' + num(props.people) + ' · Домохозяйства: ' + num(props.households) +
                ' · Устройства: ' + num(props.devices) + ' · Сессии: ' + num(props.sessions) +
                '<br>Новые: ' + num(props.new_people) + ' · Вернувшиеся: ' + num(props.returning_people) +
                ' · Боты: ' + num(props.bots) + '<br>Точность: ' + esc(props.resolution === 'city' ? 'город' : props.resolution === 'region' ? 'регион' : 'страна'));
        }
      });
      mapApi.setData(data.points, data.live);
      mapApi.setMode(state.mapMode);
      mapApi.setHeatmap(state.heatmap);
      mapApi.fit();
    } catch (error) {
      var box = ovEl.querySelector('#ow-mapbox');
      if (box) box.innerHTML = '<div class="ow-empty">Карта не загрузилась: ' + esc(error.message || 'ошибка') + '</div>';
    } finally {
      mapLoading = false;
      setHourglass(false);
    }
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
  function renderOverview(data) {
    var people = data.people || {}, structure = data.structure || {}, excluded = data.excluded || {};
    var engagement = data.engagement || {}, geography = data.geography || {}, live = data.live || {};
    var previous = data.previous || null;
    return '<div class="ow-cards">' +
      card('Оценка живой аудитории', num(people.estimated_min) + '–' + num(people.estimated_max), 'подтверждённые + вероятные … + каждое устройство отдельно', 'estimated') +
      card('Подтверждённые люди', num(people.verified), 'вошли в аккаунт', 'verified', previous ? null : null) +
      card('Вероятные люди', num(people.probable), 'анонимные, сгруппированы по нижней границе', 'probable') +
      card('Неизвестные посетители', num(people.unknown_visitors), 'нет признаков взаимодействия', 'unknown') +
      card('Новые', num(people.new), 'впервые в этом периоде') +
      card('Вернувшиеся', num(people.returning), 'были и раньше') +
      card('Активны сейчас', num(live.active_now), 'события за 5 минут', 'live') +
      card('Домохозяйства', num(structure.households), 'одна домашняя сеть', 'households') +
      card('Устройства', num(structure.devices), num(structure.shared_devices) + ' общих (несколько аккаунтов)', 'devices') +
      card('Профили браузера', num(structure.browser_profiles), 'установки и профили', 'profiles') +
      card('Сессии', num(structure.sessions), 'таймаут 30 минут', 'sessions', previous ? deltaOf(structure.sessions, previous.sessions) : null) +
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

  function renderLive(data) {
    var rows = (data.stream || []).map(function (row) {
      return Object.assign({}, row, { __click: false });
    });
    return '<div class="ow-cards">' +
      card('Активны сейчас', num(data.active_now), 'события за 5 минут', 'live') +
      card('События за час', num(data.events_last_hour)) +
      card('Обновление', 'каждые 15 с', 'пока открыт раздел') +
    '</div>' +
    '<div class="ow-block"><div class="ow-block-h">Живая активность (30 минут)</div>' +
      table([
        { title: 'Время', key: 'at', html: function (r) { return esc(clockText(r.at)); } },
        { title: 'Событие', key: 'event', html: function (r) { return esc(label(LIB.EVENT_RU, r.event)); } },
        { title: 'Лотерея', key: 'lottery', html: function (r) { return esc(r.lottery || '—'); } },
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Устройство', key: 'device', html: function (r) { return esc([r.browser, r.os, r.device].filter(Boolean).join(' / ')); } },
        { title: 'Кто', key: 'kind', html: function (r) { return esc(label(LIB.KIND_RU, r.kind) + (r.owner_test ? ' · владелец' : '')); } }
      ], rows, 'За последние 30 минут событий не было') + '</div>';
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
    return '<div class="ow-block"><div class="ow-block-h">Карта' + how('geo') +
      '<select id="ow-mapmode" style="margin-left:auto">' + MAP_MODES.map(function (m) {
        return '<option value="' + m[0] + '"' + (m[0] === state.mapMode ? ' selected' : '') + '>' + esc(m[1]) + '</option>';
      }).join('') + '</select>' +
      '<label class="ow-toggle" style="margin-left:8px"><input type="checkbox" id="ow-heat"' + (state.heatmap ? ' checked' : '') + '> Тепловая карта</label>' +
      '<button class="ow-btn" id="ow-fit" type="button" style="margin-left:8px">Показать всё</button></div>' +
      '<div class="ow-map" id="ow-mapbox"></div>' +
      '<div class="ow-map-note">Точки — центры городов или регионов (не адреса). Активных точек: ' + num((data.points || []).length) +
        ' · только страна: ' + num((data.country_only || []).length) + ' · активны сейчас: ' + num((data.live || []).length) +
        ' · ' + esc(data.attribution || '') + '</div></div>' +
      table([
        { title: 'Место', key: 'city', html: function (r) { return esc(place(r)); } },
        { title: 'Людей', key: 'people', numeric: true }, { title: 'Домохозяйств', key: 'households', numeric: true },
        { title: 'Устройств', key: 'devices', numeric: true }, { title: 'Сессий', key: 'sessions', numeric: true },
        { title: 'Новых', key: 'new_people', numeric: true }, { title: 'Вернувшихся', key: 'returning_people', numeric: true },
        { title: 'Точность', key: 'resolution' }
      ], data.points, 'Нет точек: гео пока определяется только до страны');
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

  var RENDERERS = {
    overview: renderOverview, live: renderLive, people: renderPeople, households: renderHouseholds,
    devices: renderDevices, sessions: renderSessions, acquisition: renderAcquisition, geography: renderGeography,
    map: renderMap, games: renderGames, features: renderFeatures, funnels: renderFunnels,
    retention: renderRetention, bots: renderBots, quality: renderQuality
  };

  function render() {
    var host = ovEl.querySelector('#ow-section');
    var response = state.data[state.section];
    if (state.error) { host.innerHTML = ''; renderError(state.error, reload); return; }
    if (!response) { host.innerHTML = '<div class="ow-empty">Нет данных</div>'; return; }
    var renderer = RENDERERS[state.section];
    host.innerHTML = renderer ? renderer(response.data || {}) : '<div class="ow-empty">Раздел недоступен</div>';
    var range = response.range || {};
    if (!state.lastRefresh) {
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
      if (mapApi) mapApi.setTheme(next);
    });
    ovEl.querySelector('#ow-tabs').addEventListener('click', function (event) {
      var tab = event.target.closest('[data-section]');
      if (!tab) return;
      state.page = 0;
      show(tab.getAttribute('data-section'));
    });
    ovEl.querySelector('#ow-preset').addEventListener('change', function (event) {
      state.preset = event.target.value;
      ovEl.querySelector('#ow-custom').hidden = state.preset !== 'custom';
      if (state.preset !== 'custom' || (state.custom.from && state.custom.to)) { state.data = {}; state.page = 0; reload(); }
    });
    ovEl.querySelector('#ow-from').addEventListener('change', function (event) {
      state.custom.from = event.target.value;
      if (state.custom.to) { state.data = {}; reload(); }
    });
    ovEl.querySelector('#ow-to').addEventListener('change', function (event) {
      state.custom.to = event.target.value;
      if (state.custom.from) { state.data = {}; reload(); }
    });
    ovEl.querySelector('#ow-tz').addEventListener('change', function (event) { state.tz = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-platform').addEventListener('change', function (event) { state.filters.platform = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-lottery').addEventListener('change', function (event) { state.filters.lottery = event.target.value; state.data = {}; reload(); });
    ovEl.querySelector('#ow-compare').addEventListener('change', function (event) { state.compare = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-owner').addEventListener('change', function (event) { state.toggles.owner = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-bots').addEventListener('change', function (event) { state.toggles.bots = event.target.checked; state.data = {}; reload(); });
    ovEl.querySelector('#ow-unknown').addEventListener('change', function (event) { state.toggles.unknown = event.target.checked; state.data = {}; reload(); });

    ovEl.querySelector('#ow-content').addEventListener('click', function (event) {
      var howButton = event.target.closest('[data-how]');
      if (howButton) { openPopup('Как считается', esc(HOW[howButton.getAttribute('data-how')] || '')); return; }
      var pageButton = event.target.closest('[data-page]');
      if (pageButton) {
        state.page = Math.max(0, state.page + (pageButton.getAttribute('data-page') === 'next' ? 1 : -1));
        state.data[state.section] = null;
        show(state.section, { limit: 50, offset: state.page * 50, kind: state.peopleKind !== 'all' ? state.peopleKind : undefined });
        return;
      }
      var row = event.target.closest('tr.ow-click');
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
      if (event.target.id === 'ow-mapmode') { state.mapMode = event.target.value; if (mapApi) mapApi.setMode(state.mapMode); }
      if (event.target.id === 'ow-heat') { state.heatmap = event.target.checked; if (mapApi) mapApi.setHeatmap(state.heatmap); }
    });
    ovEl.querySelector('#ow-content').addEventListener('click', function (event) {
      if (event.target.id === 'ow-fit' && mapApi) mapApi.fit();
    });
    D.addEventListener('keydown', function (event) {
      if (!ovEl || !ovEl.classList.contains('show')) return;
      if (event.key === 'Escape') {
        if (ovEl.querySelector('#ow-sheet')) ovEl.querySelector('#ow-sheet').remove();
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
    ovEl.classList.add('show');
    D.documentElement.style.overflow = 'hidden';
    var owner = await isOwner();
    if (!owner) {
      ovEl.querySelector('#ow-section').innerHTML = '<div class="ow-deny"><h2>Доступ только для владельца</h2>' +
        '<p>Эта панель доступна только аккаунту владельца проекта.</p></div>';
      return;
    }
    await show(state.section);
  }
  function close() {
    if (!ovEl) return;
    ovEl.classList.remove('show');
    D.documentElement.style.overflow = '';
    stopLive();
    closePopup();
    if (mapApi) { mapApi.destroy(); mapApi = null; }
    if (location.hash === '#owner') {
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

  W.LotoOwnerDashboard = { open: open, close: close, revealAccountEntry: revealAccountEntry };
  W.addEventListener('hashchange', function () { if (location.hash === '#owner') open(false); });
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
    if (location.hash === '#owner') open(false);
    revealAccountEntry();
    wrapOpenAccount();
    var tries = 0;
    var timer = setInterval(function () { wrapOpenAccount(); if (++tries >= 6) clearInterval(timer); }, 800);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
