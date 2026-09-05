/* Loto Simulator — Owner Dashboard («Панель владельца»).
 *
 * Only entry that matters: the «Панель владельца» button in the user's Личный кабинет, revealed
 * ONLY after a server-side owner probe (am_i_owner). Every render calls owner-analytics, which
 * re-verifies the JWT and checks public.is_owner server-side → non-owner gets 403 and no data.
 * owner_lifetime / PRO are NOT owner. Russian only. Light / Dark / System theme (persisted).
 * One web bundle → identical on Web + iOS + Android; the backend returns unified Total/Web/iOS/
 * Android analytics regardless of the device the owner logs in from. Real data only.
 */
(function () {
  'use strict';
  var W = window;
  if (W.LotoOwnerDashboard) return;

  var CFG = (W.LOTO_COMMERCIAL_CONFIG || {});
  var BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  var APIKEY = String(CFG.supabasePublishableKey || '');
  var LIB = W.LotoOwnerLib;
  var LOTTERIES = [
    ['lotto', 'Lotto (NO)'], ['vikinglotto', 'Vikinglotto'], ['eurojackpot', 'EuroJackpot'],
    ['powerball', 'Powerball'], ['megaMillions', 'Mega Millions'], ['euroMillions', 'EuroMillions'],
    ['superEnalotto', 'SuperEnalotto'], ['lottoMax', 'Lotto Max'], ['powerballAustralia', 'Powerball AU']
  ];
  var LOT_LABEL = {}; LOTTERIES.forEach(function (x) { LOT_LABEL[x[0]] = x[1]; });
  var PLATFORM_LABEL = { web: 'Веб', ios: 'iOS', android: 'Android' };
  var PRESET_LABEL = {
    today: 'Сегодня', yesterday: 'Вчера', '7d': '7 дней', '30d': '30 дней',
    month: 'Текущий месяц', lastMonth: 'Прошлый месяц', year: 'Текущий год', all: 'Весь период', custom: 'Период'
  };
  var METRICS = [
    ['users', 'Пользователи'], ['sessions', 'Сессии'], ['registrations', 'Регистрации'],
    ['proSessions', 'PRO-сессии'], ['purchases', 'Покупки'], ['conversion', 'Конверсия %']
  ];
  var state = {
    preset: 'today', from: '', to: '', platform: 'all', lottery: 'all', country: 'all',
    countryScope: 'withdata', countrySearch: '', metric: 'users', busy: false, data: null, fromAccount: false
  };
  var built = false, ovEl = null;
  var themePref = (function () { try { return W.localStorage.getItem('ow_theme') || 'system'; } catch (e) { return 'system'; } })();

  function resolveTheme() {
    if (themePref === 'light' || themePref === 'dark') return themePref;
    try { return W.matchMedia && W.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; } catch (e) { return 'dark'; }
  }
  function palette() {
    var t = resolveTheme();
    if (t === 'light') return { grid: '#d9c7d3', axis: '#9a8391', label: '#8a7280', s1: '#b3255f', s2: '#2f6ff2', s3: '#e0912a', fc: '#c98a12' };
    return { grid: '#3d2233', axis: '#7d6675', label: '#b79aac', s1: '#e2699e', s2: '#6fb7ff', s3: '#f5c451', fc: '#f5c451' };
  }

  async function api(payload) {
    var s = null;
    try { if (W.LotoAuth && W.LotoAuth.getSession) s = await W.LotoAuth.getSession(); } catch (e) {}
    var headers = { 'Content-Type': 'application/json', 'apikey': APIKEY };
    if (s && s.access_token) headers['Authorization'] = 'Bearer ' + s.access_token;
    var resp = await fetch(BASE + '/functions/v1/owner-analytics', { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    var body = null; try { body = await resp.json(); } catch (e) {}
    return { status: resp.status, body: body };
  }
  async function isOwner() {
    try { var r = await api({ probe: true }); return r.status === 200 && r.body && r.body.owner === true; } catch (e) { return false; }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(n) { n = +n || 0; return n.toLocaleString('ru-RU'); }
  function pct(v) { if (v == null) return '—'; return (v > 0 ? '+' : '') + v.toFixed(0) + '%'; }
  function arrow(dir) { return dir === 'up' ? '▲' : (dir === 'down' ? '▼' : '■'); }
  function cName(iso) { return LIB.countryNameRu(iso); }

  function ensureStyles() {
    if (document.getElementById('ow-style')) return;
    var css = document.createElement('style'); css.id = 'ow-style';
    css.textContent = [
      // Theme tokens
      '#ow-ov{--bg:#0e0710;--card:#1a0e16;--card2:#160c13;--tx:#f3e9ef;--sub:#b79aac;--sub2:#9c8391;--bd:#33202e;--bd2:#3d2233;--accent:#7a2450;--accent2:#a5316b;--up:#5ad19a;--down:#f2789a;--stickb:#160c13}',
      '#ow-ov[data-ow-theme="light"]{--bg:#f6eef2;--card:#ffffff;--card2:#fbf4f8;--tx:#25141d;--sub:#6f5563;--sub2:#8a7280;--bd:#e7d3de;--bd2:#d9c1cf;--accent:#b3255f;--accent2:#8f1b4b;--up:#1a7f4b;--down:#c62a5a;--stickb:#fbf4f8}',
      '#ow-ov{position:fixed;inset:0;z-index:2147483000;background:var(--bg);color:var(--tx);overflow:auto;-webkit-overflow-scrolling:touch;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:none}',
      '#ow-ov.show{display:block}', '#ow-ov *{box-sizing:border-box}',
      '.ow-wrap{max-width:1180px;margin:0 auto;padding:14px 14px calc(28px + env(safe-area-inset-bottom))}',
      '.ow-top{position:sticky;top:0;z-index:5;background:var(--bg);padding:10px 0 8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.ow-title{font-size:18px;font-weight:800;margin-right:auto}',
      '.ow-x{background:var(--card);border:1px solid var(--bd2);color:var(--tx);border-radius:10px;padding:8px 12px;font-size:14px;cursor:pointer}',
      '.ow-x.pri{background:var(--accent);border-color:var(--accent2);color:#fff}',
      '.ow-seg{display:inline-flex;border:1px solid var(--bd2);border-radius:10px;overflow:hidden}',
      '.ow-seg button{background:var(--card);border:0;color:var(--sub);padding:7px 10px;font-size:12.5px;cursor:pointer}',
      '.ow-seg button.on{background:var(--accent);color:#fff}',
      '.ow-filters{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}',
      '.ow-filters select,.ow-filters input{background:var(--card);border:1px solid var(--bd2);color:var(--tx);border-radius:10px;padding:8px 10px;font-size:13px;max-width:100%}',
      '.ow-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px}',
      '.ow-card{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:12px 13px}',
      '.ow-k{font-size:12px;color:var(--sub);margin-bottom:3px}', '.ow-v{font-size:22px;font-weight:800;line-height:1.1}',
      '.ow-d{font-size:12px;margin-top:3px}', '.ow-up{color:var(--up)}.ow-down{color:var(--down)}.ow-stable{color:var(--sub)}',
      '.ow-sec{margin:18px 0 8px;font-size:15px;font-weight:800;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.ow-platcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
      '.ow-tablewrap{overflow-x:auto;border:1px solid var(--bd);border-radius:12px}',
      '.ow-table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:680px}',
      '.ow-table th,.ow-table td{padding:8px 10px;text-align:right;border-bottom:1px solid var(--bd);white-space:nowrap}',
      '.ow-table th:first-child,.ow-table td:first-child{text-align:left;position:sticky;left:0;background:var(--stickb)}',
      '.ow-table thead th{color:var(--sub);font-weight:700;background:var(--stickb);position:sticky;top:0}',
      '.ow-chart{background:var(--card2);border:1px solid var(--bd);border-radius:12px;padding:10px;overflow-x:auto}',
      '.ow-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--sub);margin:6px 2px 0}',
      '.ow-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle}',
      '.ow-note{font-size:12px;color:var(--sub2);margin-top:6px}',
      '.ow-empty{padding:22px 10px;text-align:center;color:var(--sub)}',
      '.ow-deny{max-width:420px;margin:16vh auto;text-align:center;padding:24px}', '.ow-deny h2{font-size:20px;margin:0 0 8px}',
      '.ow-bar{height:9px;background:var(--bd);border-radius:6px;overflow:hidden}', '.ow-bar>i{display:block;height:100%;background:linear-gradient(90deg,var(--accent2),var(--accent))}',
      '@media(max-width:520px){.ow-v{font-size:19px}.ow-title{font-size:16px}}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function build() {
    if (built) return;
    ensureStyles();
    ovEl = document.createElement('div'); ovEl.id = 'ow-ov';
    ovEl.setAttribute('role', 'dialog'); ovEl.setAttribute('aria-label', 'Панель владельца');
    ovEl.dataset.owTheme = resolveTheme();
    document.body.appendChild(ovEl);
    try { W.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (themePref === 'system') { ovEl.dataset.owTheme = resolveTheme(); if (state.data) render(); } }); } catch (e) {}
    built = true;
  }

  function opt(v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }

  function filtersHtml() {
    var presets = Object.keys(PRESET_LABEL).map(function (k) { return opt(k, PRESET_LABEL[k], state.preset); }).join('');
    var plats = ['all', 'web', 'ios', 'android'].map(function (p) { return opt(p, p === 'all' ? 'Все платформы' : PLATFORM_LABEL[p], state.platform); }).join('');
    var lots = ['all'].concat(LOTTERIES.map(function (l) { return l[0]; })).map(function (l) { return opt(l, l === 'all' ? 'Все лотереи' : LOT_LABEL[l], state.lottery); }).join('');
    var countryOpts = opt('all', 'Все страны', state.country) + opt('__none__', 'Не определено', state.country) +
      LIB.countryList().map(function (c) { return opt(c.code, c.name, state.country); }).join('');
    var custom = state.preset === 'custom'
      ? '<input type="date" id="ow-from" value="' + esc(state.from) + '"><input type="date" id="ow-to" value="' + esc(state.to) + '">' : '';
    var themeSeg = '<span class="ow-seg" id="ow-theme">' +
      ['light', 'dark', 'system'].map(function (t) { return '<button data-t="' + t + '" class="' + (themePref === t ? 'on' : '') + '">' + ({ light: 'Светлая', dark: 'Тёмная', system: 'Системная' }[t]) + '</button>'; }).join('') + '</span>';
    return '<div class="ow-filters"><select id="ow-preset">' + presets + '</select>' + custom +
      '<select id="ow-platform">' + plats + '</select><select id="ow-lottery">' + lots + '</select>' +
      '<select id="ow-country">' + countryOpts + '</select>' + themeSeg + '</div>';
  }

  function card(k, v, delta) {
    var d = delta ? '<div class="ow-d ow-' + delta.dir + '">' + arrow(delta.dir) + ' ' + pct(delta.pct) + '</div>' : '';
    return '<div class="ow-card"><div class="ow-k">' + esc(k) + '</div><div class="ow-v">' + v + '</div>' + d + '</div>';
  }

  function svgLine(series, keys, colors, pal) {
    var w = 640, h = 160, pad = 28;
    var pts = series.filter(function (p) { return keys.some(function (k) { return p[k] != null; }); });
    if (pts.length < 1) return '<div class="ow-empty">Нет данных за период</div>';
    if (pts.length === 1) {
      var only = pts[0];
      return '<div class="ow-empty">Одна точка данных: ' + keys.map(function (k) { return num(only[k]); }).join(' / ') + ' — недостаточно для линии, показываем значение.</div>';
    }
    var max = 1; pts.forEach(function (p) { keys.forEach(function (k) { if (p[k] != null) max = Math.max(max, +p[k] || 0); }); });
    var n = pts.length;
    var X = function (i) { return pad + i * (w - pad * 2) / (n - 1); };
    var Y = function (v) { return h - pad - ((+v || 0) / max) * (h - pad * 2); };
    var paths = keys.map(function (k, ki) {
      var seg = [], started = false, d = '';
      pts.forEach(function (p, i) { if (p[k] == null) { started = false; return; } d += (started ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p[k]).toFixed(1) + ' '; started = true; });
      return '<path d="' + d + '" fill="none" stroke="' + colors[ki] + '" stroke-width="2"/>';
    }).join('');
    var dots = keys.map(function (k, ki) { return pts.map(function (p, i) { return p[k] == null ? '' : '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(p[k]).toFixed(1) + '" r="2.1" fill="' + colors[ki] + '"/>'; }).join(''); }).join('');
    var axis = '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="' + pal.grid + '"/>' +
      '<text x="' + pad + '" y="14" fill="' + pal.axis + '" font-size="10">макс ' + num(max) + '</text>';
    var step = Math.ceil(n / 6), labels = '';
    pts.forEach(function (p, i) { if (i % step === 0 || i === n - 1) labels += '<text x="' + X(i).toFixed(1) + '" y="' + (h - 8) + '" fill="' + pal.axis + '" font-size="9" text-anchor="middle">' + esc((p.bucket || '').slice(5)) + '</text>'; });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="xMidYMid meet">' + axis + paths + dots + labels + '</svg>';
  }
  function legend(items) { return '<div class="ow-legend">' + items.map(function (it) { return '<span><i style="background:' + it[1] + '"></i>' + esc(it[0]) + '</span>'; }).join('') + '</div>'; }

  function metricSeries(ts, metric) {
    return ts.map(function (p) {
      var v;
      if (metric === 'conversion') v = p.users ? (p.purchases / p.users * 100) : 0;
      else v = p[metric];
      return { bucket: p.bucket, val: (v == null ? null : v) };
    });
  }

  function render() {
    var d = state.data, pal = palette();
    ovEl.dataset.owTheme = resolveTheme();
    var head = '<div class="ow-top"><div class="ow-title">Панель владельца</div>' +
      '<button class="ow-x" id="ow-refresh">Обновить</button><button class="ow-x pri" id="ow-close">Закрыть</button></div>';
    if (!d) { ovEl.innerHTML = '<div class="ow-wrap">' + head + filtersHtml() + '<div class="ow-empty">Загрузка…</div></div>'; wire(); return; }
    var s = d.summary || {}, prev = d.previous || {};
    var conv = (s.users ? (s.confirmedPurchases / s.users * 100) : 0);
    var summary = '<div class="ow-sec">' + esc(PRESET_LABEL[state.preset]) + ' · Europe/Oslo</div><div class="ow-grid">' +
      card('Пользователи', num(s.users), LIB.pctChange(s.users, prev.users)) +
      card('Новые', num(s.newUsers)) +
      card('Сессии', num(s.sessions), LIB.pctChange(s.sessions, prev.sessions)) +
      card('Регистрации', num(s.registrations), LIB.pctChange(s.registrations, prev.registrations)) +
      card('FREE', num(s.freeSessions)) + card('PRO', num(s.proSessions), LIB.pctChange(s.proSessions, prev.proSessions)) +
      card('Покупки', num(s.confirmedPurchases), LIB.pctChange(s.confirmedPurchases, prev.confirmedPurchases)) +
      card('Выручка', d.revenue && d.revenue.grossRevenue != null ? num(d.revenue.grossRevenue) : 'Нет данных') +
      card('Конверсия', conv.toFixed(2) + '%') + '</div>';

    var p = d.platforms || {};
    var plat = '<div class="ow-sec">Платформы</div><div class="ow-platcards">' +
      ['web', 'ios', 'android'].map(function (k) { var pv = p[k] || {}; return '<div class="ow-card"><div class="ow-k">' + PLATFORM_LABEL[k] + '</div><div class="ow-v">' + num(pv.sessions) + '</div><div class="ow-d ow-stable">' + num(pv.users) + ' польз. · ' + num(pv.registrations) + ' рег.</div></div>'; }).join('') +
      '<div class="ow-card"><div class="ow-k">Всего</div><div class="ow-v">' + num(s.sessions) + '</div><div class="ow-d ow-stable">' + num(s.users) + ' польз.</div></div></div>';

    // Динамика with metric selector
    var ms = metricSeries(d.timeseries || [], state.metric).map(function (x) { return { bucket: x.bucket, val: x.val }; });
    var metricSel = '<select id="ow-metric">' + METRICS.map(function (m) { return opt(m[0], m[1], state.metric); }).join('') + '</select>';
    var chart = '<div class="ow-sec">Динамика ' + metricSel + '</div><div class="ow-chart">' + svgLine(ms, ['val'], [pal.s1], pal) + '</div>' +
      legend([[METRICS.filter(function (m) { return m[0] === state.metric; })[0][1], pal.s1]]);

    // 9 lotteries
    var lots = (d.lotteries || []); var totalSess = lots.reduce(function (a, b) { return a + (b.sessions || 0); }, 0) || 1;
    var lotRows = LOTTERIES.map(function (L) {
      var row = {}; for (var i = 0; i < lots.length; i++) if (lots[i].lottery === L[0]) { row = lots[i]; break; }
      var share = ((row.sessions || 0) / totalSess * 100), cv = (row.users ? 0 : 0);
      return '<tr><td>' + esc(L[1]) + '</td><td>' + num(row.users) + '</td><td>' + num(row.sessions) + '</td><td>' + num(row.opens) +
        '</td><td>' + num(row.generatorRuns) + '</td><td>' + num(row.analyticsOpens) + '</td><td>' + num(row.periodAnalysis) +
        '</td><td>' + num(row.draw3d) + '</td><td>' + num(row.ticketChecks) + '</td><td>' + num(row.resultViews) +
        '</td><td>' + num(row.freeSessions) + '</td><td>' + num(row.proSessions) + '</td><td>' + num(row.paywallViews) + '</td><td>' + share.toFixed(1) + '%</td></tr>';
    }).join('');
    var lotTable = '<div class="ow-sec">Лотереи (9)</div><div class="ow-tablewrap"><table class="ow-table"><thead><tr>' +
      ['Лотерея', 'Польз.', 'Сессии', 'Открытий', 'Генераций', 'Аналитика', 'Периоды', '3D', 'Проверок', 'Результаты', 'FREE', 'PRO', 'Paywall', 'Доля'].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + lotRows + '</tbody></table></div>';

    var models = d.models || {};
    var modelRows = Object.keys(models).sort(function (a, b) { return models[b] - models[a]; }).map(function (m) { return '<tr><td>' + esc(m) + '</td><td>' + num(models[m]) + '</td></tr>'; }).join('') || '<tr><td colspan="2" style="text-align:center;color:var(--sub)">Нет данных</td></tr>';
    var modelTable = '<div class="ow-sec">Модели генератора</div><div class="ow-tablewrap"><table class="ow-table" style="min-width:320px"><thead><tr><th>Модель</th><th>Использований</th></tr></thead><tbody>' + modelRows + '</tbody></table></div>';

    // Countries — expanded, RU names, «Не определено», with-data/all toggle + search
    var apiCountries = (d.countries || []);
    var byCode = {}; apiCountries.forEach(function (c) { byCode[c.country || ''] = c; });
    var rowsSource;
    if (state.countryScope === 'all') {
      rowsSource = [{ country: '' }].concat(LIB.countryList().map(function (c) { return { country: c.code }; }))
        .map(function (base) { return byCode[base.country] || base; });
    } else { rowsSource = apiCountries.slice(); }
    var q = state.countrySearch.trim().toLowerCase();
    if (q) rowsSource = rowsSource.filter(function (c) { return cName(c.country).toLowerCase().indexOf(q) >= 0 || String(c.country).toLowerCase().indexOf(q) >= 0; });
    rowsSource.sort(function (a, b) { return (b.sessions || 0) - (a.sessions || 0) || cName(a.country).localeCompare(cName(b.country), 'ru'); });
    var maxC = apiCountries.reduce(function (a, b) { return Math.max(a, b.sessions || 0); }, 1);
    var cRows = rowsSource.map(function (c) {
      var users = c.users || 0, purch = c.purchases || 0, cvp = users ? (purch / users * 100) : 0;
      return '<tr><td>' + esc(cName(c.country)) + '</td><td>' + num(users) + '</td><td>' + num(c.sessions) + '</td><td>' + num(c.registrations) +
        '</td><td>' + num(c.freeSessions) + '</td><td>' + num(c.proSessions) + '</td><td>' + num(purch) +
        '</td><td>' + (purch ? num(purch) : 'Нет данных') + '</td><td>' + cvp.toFixed(1) + '%</td><td>' + esc(LOT_LABEL[c.topLottery] || (c.topLottery || '—')) +
        '</td><td>' + num(c.web) + '/' + num(c.ios) + '/' + num(c.android) + '</td>' +
        '<td style="width:110px"><div class="ow-bar"><i style="width:' + Math.round((c.sessions || 0) / maxC * 100) + '%"></i></div></td></tr>';
    }).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--sub)">Нет данных</td></tr>';
    var scopeSeg = '<span class="ow-seg" id="ow-cscope"><button data-s="withdata" class="' + (state.countryScope === 'withdata' ? 'on' : '') + '">С данными</button><button data-s="all" class="' + (state.countryScope === 'all' ? 'on' : '') + '">Все страны</button></span>';
    var cTable = '<div class="ow-sec">Страны ' + scopeSeg + '<input id="ow-csearch" placeholder="Поиск страны…" value="' + esc(state.countrySearch) + '" style="background:var(--card);border:1px solid var(--bd2);color:var(--tx);border-radius:8px;padding:6px 9px;font-size:12.5px"></div>' +
      '<div class="ow-tablewrap"><table class="ow-table"><thead><tr>' +
      ['Страна', 'Польз.', 'Сессии', 'Рег.', 'FREE', 'PRO', 'Покупки', 'Выручка', 'Конв.', 'Топ-лотерея', 'Веб/iOS/And', ''].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + cRows + '</tbody></table></div>';

    // Revenue
    var rv = d.revenue || {}; var byPlan = rv.byPlan || {};
    var planRows = ['loto_pro_m1', 'loto_pro_m3', 'loto_pro_m6', 'loto_pro_m12'].map(function (pid) { var label = { loto_pro_m1: '1 мес', loto_pro_m3: '3 мес', loto_pro_m6: '6 мес', loto_pro_m12: '12 мес' }[pid]; return '<tr><td>' + label + '</td><td>' + num(byPlan[pid] || 0) + '</td></tr>'; }).join('');
    var revenue = '<div class="ow-sec">Продажи и выручка</div><div class="ow-grid">' +
      card('Подтв. покупки', num(rv.confirmedPurchases)) + card('Активные PRO', num(rv.activePaidSubscriptions)) +
      card('Продления', num(rv.renewals)) + card('Отмены', num(rv.cancellations)) +
      card('Возвраты', num(rv.refunds)) + card('Истёкшие', num(rv.expirations)) +
      card('Выручка', rv.grossRevenue != null ? num(rv.grossRevenue) : 'Нет данных') + '</div>' +
      '<div class="ow-tablewrap"><table class="ow-table" style="min-width:320px"><thead><tr><th>План</th><th>Активных</th></tr></thead><tbody>' + planRows + '</tbody></table></div>' +
      '<div class="ow-note">' + esc(rv.note || '') + '</div>';

    var f = d.funnel || {};
    var funnel = '<div class="ow-sec">Воронка</div><div class="ow-grid">' +
      card('Пользователи', num(f.users)) + card('Регистрации', num(f.signups)) + card('Paywall', num(f.paywallViews)) +
      card('purchase_start', num(f.purchaseStart)) + card('Подтв. покупки', num(f.confirmedPurchases)) + '</div>';

    // Forecast
    var hist = (d.history || []); var usersSeries = hist.map(function (m) { return +m.users || 0; });
    var fc = LIB.forecast(usersSeries, 12); var forecastHtml;
    if (!fc.enough) { forecastHtml = '<div class="ow-sec">Прогноз</div><div class="ow-card"><div class="ow-note">' + esc(fc.reason) + '</div></div>'; }
    else {
      var fcCards = [1, 3, 6, 12].map(function (h) { var pt = fc.points[h - 1]; return '<div class="ow-card"><div class="ow-k">' + h + ' мес</div><div class="ow-v">' + num(Math.round(pt.value)) + '</div><div class="ow-d ow-stable">' + num(Math.round(pt.lo)) + '–' + num(Math.round(pt.hi)) + '</div></div>'; }).join('');
      var merged = hist.map(function (m) { return { bucket: m.month, users: +m.users || 0, forecast: null }; });
      fc.points.forEach(function (pt) { merged.push({ bucket: '+' + pt.h, users: null, forecast: Math.round(pt.value) }); });
      forecastHtml = '<div class="ow-sec">Прогноз (пользователи)</div><div class="ow-grid">' + fcCards + '</div><div class="ow-chart">' +
        svgLine(merged, ['users', 'forecast'], [pal.s1, pal.fc], pal) + '</div>' + legend([['Факт', pal.s1], ['Прогноз', pal.fc]]) +
        '<div class="ow-note">Модель: экспоненциальное сглаживание Хольта (тренд), интервал ~95%. Детерминированно, без выдуманных чисел.</div>';
    }

    ovEl.innerHTML = '<div class="ow-wrap">' + head + filtersHtml() + summary + plat + chart + lotTable + modelTable + cTable + revenue + funnel + forecastHtml +
      '<div class="ow-note">Время сервера: ' + esc((d.serverTime || '').slice(0, 19)) + ' UTC · агрегация в Europe/Oslo · единое ядро Web+iOS+Android</div></div>';
    wire();
  }

  function wire() {
    function on(id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
    on('ow-close', 'click', close); on('ow-refresh', 'click', load);
    on('ow-preset', 'change', function (e) { state.preset = e.target.value; if (state.preset === 'custom' && !state.from) { var t = new Date(); state.to = t.toISOString().slice(0, 10); state.from = new Date(t.getTime() - 6 * 864e5).toISOString().slice(0, 10); } load(); });
    on('ow-from', 'change', function (e) { state.from = e.target.value; load(); });
    on('ow-to', 'change', function (e) { state.to = e.target.value; load(); });
    on('ow-platform', 'change', function (e) { state.platform = e.target.value; load(); });
    on('ow-lottery', 'change', function (e) { state.lottery = e.target.value; load(); });
    on('ow-country', 'change', function (e) { state.country = e.target.value; load(); });
    on('ow-metric', 'change', function (e) { state.metric = e.target.value; render(); });
    var seg = document.getElementById('ow-theme'); if (seg) seg.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { themePref = b.getAttribute('data-t'); try { W.localStorage.setItem('ow_theme', themePref); } catch (e) {} render(); }); });
    var cs = document.getElementById('ow-cscope'); if (cs) cs.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { state.countryScope = b.getAttribute('data-s'); render(); }); });
    var csr = document.getElementById('ow-csearch'); if (csr) csr.addEventListener('input', function (e) { state.countrySearch = e.target.value; var pos = e.target.selectionStart; render(); var el = document.getElementById('ow-csearch'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} } });
  }

  async function load() {
    if (state.busy) return; state.busy = true;
    try {
      var r = LIB.osloRange(state.preset, Date.now(), state.from, state.to);
      var params = { from: r.from, to: r.to, prev_from: r.prevFrom, prev_to: r.prevTo, bucket: r.bucket, platform: state.platform, lottery: state.lottery, country: state.country };
      if (!state.data) render();
      var resp = await api({ params: params });
      if (resp.status === 403) { denied(); return; }
      if (resp.status !== 200 || !resp.body) { ovEl.innerHTML = '<div class="ow-wrap"><div class="ow-empty">Ошибка загрузки (' + resp.status + ')</div><button class="ow-x" id="ow-close">Закрыть</button></div>'; wire(); return; }
      state.data = resp.body; render();
    } catch (e) { ovEl.innerHTML = '<div class="ow-wrap"><div class="ow-empty">Сеть недоступна</div><button class="ow-x" id="ow-close">Закрыть</button></div>'; wire(); }
    finally { state.busy = false; }
  }

  function denied() { ovEl.innerHTML = '<div class="ow-deny"><h2>Доступ только для владельца</h2><p style="color:var(--sub)">Эта панель доступна исключительно учётной записи владельца проекта.</p><button class="ow-x pri" id="ow-close">Закрыть</button></div>'; wire(); }

  async function open(fromAccount) {
    build(); state.fromAccount = !!fromAccount;
    ovEl.classList.add('show'); document.documentElement.style.overflow = 'hidden';
    var owner = await isOwner();
    if (!owner) { denied(); return; }
    state.data = null; load();
  }
  function close() {
    if (ovEl) ovEl.classList.remove('show'); document.documentElement.style.overflow = '';
    if (location.hash === '#owner') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } }
    if (state.fromAccount) { state.fromAccount = false; try { if (typeof W.openAccount === 'function') W.openAccount(); } catch (e) {} }
  }

  // Reveal the «Панель владельца» button in Личный кабинет — ONLY after a server owner-probe.
  function revealAccountEntry() {
    (async function () {
      try {
        if (!(W.LotoAuth && W.LotoAuth.getSession)) return;
        var s = await W.LotoAuth.getSession();
        if (!s || !s.user || s.user.is_anonymous) { var bx = document.getElementById('acc-owner-btn'); if (bx) bx.hidden = true; return; }
        var ok = await isOwner();
        var btn = document.getElementById('acc-owner-btn');
        if (!btn) return;
        if (!btn.textContent) btn.textContent = 'Панель владельца'; // label set from JS (owner-only, RU)
        btn.hidden = !ok;
        if (ok && !btn.__wired) { btn.__wired = true; btn.addEventListener('click', function () { try { if (typeof W.closeAccount === 'function') W.closeAccount(); } catch (e) {} open(true); }); }
      } catch (e) {}
    })();
  }

  W.LotoOwnerDashboard = { open: open, close: close, revealAccountEntry: revealAccountEntry };
  W.addEventListener('hashchange', function () { if (location.hash === '#owner') open(false); });
  try { W.addEventListener('loto:accesschange', revealAccountEntry); } catch (e) {}
  // Re-probe whenever the account panel opens, so the owner button state is always fresh.
  function wrapOpenAccount() {
    try {
      var orig = W.openAccount;
      if (typeof orig === 'function' && !orig.__owWrapped) {
        var wrapped = function () { var r = orig.apply(this, arguments); try { revealAccountEntry(); } catch (e) {} return r; };
        wrapped.__owWrapped = true; W.openAccount = wrapped;
      }
    } catch (e) {}
  }
  function boot() { if (location.hash === '#owner') open(false); revealAccountEntry(); wrapOpenAccount(); var n = 0, iv = setInterval(function () { wrapOpenAccount(); if (++n >= 6) clearInterval(iv); }, 800); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
