/* Loto Simulator — Owner Dashboard («Панель владельца»).
 *
 * The ONLY way in is a server-side owner check: every render calls the owner-analytics Edge
 * Function, which re-verifies the JWT and checks public.is_owner server-side. A non-owner (FREE,
 * PRO, Lifetime, forged flag) gets 403 → the dashboard shows «Доступ только для владельца» and no
 * data. The entry point is revealed only after a server probe returns owner:true; there is no
 * client email/PRO/localStorage gate. Russian only, mobile-first + desktop, real data only.
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
  var state = { preset: 'today', from: '', to: '', platform: 'all', lottery: 'all', country: 'all', busy: false, data: null };
  var built = false, ovEl = null;

  async function api(payload) {
    var s = null;
    try { if (W.LotoAuth && W.LotoAuth.getSession) s = await W.LotoAuth.getSession(); } catch (e) {}
    var headers = { 'Content-Type': 'application/json', 'apikey': APIKEY };
    if (s && s.access_token) headers['Authorization'] = 'Bearer ' + s.access_token;
    var resp = await fetch(BASE + '/functions/v1/owner-analytics', {
      method: 'POST', headers: headers, body: JSON.stringify(payload)
    });
    var body = null; try { body = await resp.json(); } catch (e) {}
    return { status: resp.status, body: body };
  }

  async function isOwner() {
    try { var r = await api({ probe: true }); return r.status === 200 && r.body && r.body.owner === true; }
    catch (e) { return false; }
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function num(n) { n = +n || 0; return n.toLocaleString('ru-RU'); }
  function pct(v) { if (v == null) return '—'; return (v > 0 ? '+' : '') + v.toFixed(0) + '%'; }
  function arrow(dir) { return dir === 'up' ? '▲' : (dir === 'down' ? '▼' : '■'); }

  function ensureStyles() {
    if (document.getElementById('ow-style')) return;
    var css = document.createElement('style'); css.id = 'ow-style';
    css.textContent = [
      '#ow-ov{position:fixed;inset:0;z-index:2147483000;background:#0e0710;color:#f3e9ef;overflow:auto;-webkit-overflow-scrolling:touch;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:none}',
      '#ow-ov.show{display:block}',
      '#ow-ov *{box-sizing:border-box}',
      '.ow-wrap{max-width:1180px;margin:0 auto;padding:14px 14px calc(28px + env(safe-area-inset-bottom));}',
      '.ow-top{position:sticky;top:0;z-index:5;background:linear-gradient(#0e0710,#0e0710f0);padding:10px 0 8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.ow-title{font-size:18px;font-weight:800;margin-right:auto}',
      '.ow-x{background:#2a1622;border:1px solid #3d2233;color:#f3e9ef;border-radius:10px;padding:8px 12px;font-size:14px;cursor:pointer}',
      '.ow-filters{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 14px}',
      '.ow-filters select,.ow-filters input[type=date]{background:#1c0f18;border:1px solid #3d2233;color:#f3e9ef;border-radius:10px;padding:8px 10px;font-size:13px;max-width:100%}',
      '.ow-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}',
      '.ow-chip{background:#1c0f18;border:1px solid #3d2233;color:#cdbcc7;border-radius:999px;padding:6px 12px;font-size:12.5px;cursor:pointer;white-space:nowrap}',
      '.ow-chip.on{background:#7a2450;border-color:#a5316b;color:#fff}',
      '.ow-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:16px}',
      '.ow-card{background:#1a0e16;border:1px solid #33202e;border-radius:14px;padding:12px 13px}',
      '.ow-k{font-size:12px;color:#b79aac;margin-bottom:3px}',
      '.ow-v{font-size:22px;font-weight:800;line-height:1.1}',
      '.ow-d{font-size:12px;margin-top:3px}',
      '.ow-up{color:#5ad19a}.ow-down{color:#f2789a}.ow-stable{color:#b79aac}',
      '.ow-sec{margin:18px 0 8px;font-size:15px;font-weight:800;color:#f3e9ef}',
      '.ow-platcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
      '.ow-tablewrap{overflow-x:auto;border:1px solid #33202e;border-radius:12px}',
      '.ow-table{width:100%;border-collapse:collapse;font-size:12.5px;min-width:640px}',
      '.ow-table th,.ow-table td{padding:8px 10px;text-align:right;border-bottom:1px solid #2a1826;white-space:nowrap}',
      '.ow-table th:first-child,.ow-table td:first-child{text-align:left;position:sticky;left:0;background:#160c13}',
      '.ow-table thead th{color:#b79aac;font-weight:700;background:#160c13;position:sticky;top:0}',
      '.ow-chart{background:#160c13;border:1px solid #33202e;border-radius:12px;padding:10px;overflow-x:auto}',
      '.ow-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#b79aac;margin:6px 2px 0}',
      '.ow-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:middle}',
      '.ow-note{font-size:12px;color:#9c8391;margin-top:6px}',
      '.ow-empty{padding:30px 10px;text-align:center;color:#b79aac}',
      '.ow-deny{max-width:420px;margin:16vh auto;text-align:center;padding:24px}',
      '.ow-deny h2{font-size:20px;margin:0 0 8px}',
      '.ow-bar{height:9px;background:#2a1826;border-radius:6px;overflow:hidden}',
      '.ow-bar>i{display:block;height:100%;background:linear-gradient(90deg,#a5316b,#e2699e)}',
      '@media(max-width:520px){.ow-v{font-size:19px}.ow-title{font-size:16px}}'
    ].join('\n');
    document.head.appendChild(css);
  }

  function build() {
    if (built) return;
    ensureStyles();
    ovEl = document.createElement('div');
    ovEl.id = 'ow-ov';
    ovEl.setAttribute('role', 'dialog');
    ovEl.setAttribute('aria-label', 'Панель владельца');
    document.body.appendChild(ovEl);
    built = true;
  }

  function filtersHtml() {
    function opt(v, label, cur) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; }
    var presets = Object.keys(PRESET_LABEL).map(function (k) { return opt(k, PRESET_LABEL[k], state.preset); }).join('');
    var plats = ['all', 'web', 'ios', 'android'].map(function (p) { return opt(p, p === 'all' ? 'Все платформы' : PLATFORM_LABEL[p], state.platform); }).join('');
    var lots = ['all'].concat(LOTTERIES.map(function (l) { return l[0]; })).map(function (l) { return opt(l, l === 'all' ? 'Все лотереи' : LOT_LABEL[l], state.lottery); }).join('');
    var countries = ['all'];
    if (state.data && state.data.countries) state.data.countries.forEach(function (c) { if (countries.indexOf(c.country) < 0) countries.push(c.country); });
    var countryOpts = countries.map(function (c) { return opt(c, c === 'all' ? 'Все страны' : c, state.country); }).join('');
    var custom = state.preset === 'custom'
      ? '<input type="date" id="ow-from" value="' + esc(state.from) + '"><input type="date" id="ow-to" value="' + esc(state.to) + '">'
      : '';
    return '<div class="ow-filters">' +
      '<select id="ow-preset">' + presets + '</select>' + custom +
      '<select id="ow-platform">' + plats + '</select>' +
      '<select id="ow-lottery">' + lots + '</select>' +
      '<select id="ow-country">' + countryOpts + '</select>' +
      '</div>';
  }

  function card(k, v, delta) {
    var d = '';
    if (delta) d = '<div class="ow-d ow-' + delta.dir + '">' + arrow(delta.dir) + ' ' + pct(delta.pct) + '</div>';
    return '<div class="ow-card"><div class="ow-k">' + esc(k) + '</div><div class="ow-v">' + v + '</div>' + d + '</div>';
  }

  function svgLine(series, keys, colors, w, h) {
    w = w || 620; h = h || 150; var pad = 26;
    if (!series.length) return '<div class="ow-empty">Нет данных за период</div>';
    var max = 1;
    series.forEach(function (p) { keys.forEach(function (k) { max = Math.max(max, +p[k] || 0); }); });
    var n = series.length;
    var x = function (i) { return pad + (n <= 1 ? 0 : (i * (w - pad * 2) / (n - 1))); };
    var y = function (v) { return h - pad - ((+v || 0) / max) * (h - pad * 2); };
    var paths = keys.map(function (k, ki) {
      var d = series.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[k]).toFixed(1); }).join(' ');
      return '<path d="' + d + '" fill="none" stroke="' + colors[ki] + '" stroke-width="2"/>';
    }).join('');
    var dots = keys.map(function (k, ki) {
      return series.map(function (p, i) { return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p[k]).toFixed(1) + '" r="2.2" fill="' + colors[ki] + '"/>'; }).join('');
    }).join('');
    var axis = '<line x1="' + pad + '" y1="' + (h - pad) + '" x2="' + (w - pad) + '" y2="' + (h - pad) + '" stroke="#3d2233"/>' +
      '<text x="' + pad + '" y="14" fill="#b79aac" font-size="10">макс ' + num(max) + '</text>';
    var labels = '';
    var step = Math.ceil(n / 6);
    series.forEach(function (p, i) { if (i % step === 0 || i === n - 1) labels += '<text x="' + x(i).toFixed(1) + '" y="' + (h - 8) + '" fill="#7d6675" font-size="9" text-anchor="middle">' + esc((p.bucket || '').slice(5)) + '</text>'; });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="xMidYMid meet">' + axis + paths + dots + labels + '</svg>';
  }

  function legend(items) {
    return '<div class="ow-legend">' + items.map(function (it) { return '<span><i style="background:' + it[1] + '"></i>' + esc(it[0]) + '</span>'; }).join('') + '</div>';
  }

  function render() {
    var d = state.data;
    var head = '<div class="ow-top"><div class="ow-title">Панель владельца</div>' +
      '<button class="ow-x" id="ow-refresh">Обновить</button><button class="ow-x" id="ow-close">Закрыть</button></div>';
    if (!d) { ovEl.innerHTML = '<div class="ow-wrap">' + head + filtersHtml() + '<div class="ow-empty">Загрузка…</div></div>'; wire(); return; }
    var s = d.summary || {}, prev = d.previous || {};
    var dUsers = LIB.pctChange(s.users, prev.users), dSess = LIB.pctChange(s.sessions, prev.sessions),
      dReg = LIB.pctChange(s.registrations, prev.registrations), dBuy = LIB.pctChange(s.confirmedPurchases, prev.confirmedPurchases);
    var conv = (s.users ? (s.confirmedPurchases / s.users * 100) : 0);

    var summary = '<div class="ow-sec">' + esc(PRESET_LABEL[state.preset]) + ' · Europe/Oslo</div><div class="ow-grid">' +
      card('Пользователи', num(s.users), dUsers) +
      card('Новые', num(s.newUsers)) +
      card('Сессии', num(s.sessions), dSess) +
      card('Регистрации', num(s.registrations), dReg) +
      card('FREE', num(s.freeSessions)) +
      card('PRO', num(s.proSessions)) +
      card('Покупки', num(s.confirmedPurchases), dBuy) +
      card('Выручка', d.revenue && d.revenue.grossRevenue != null ? num(d.revenue.grossRevenue) : '—') +
      card('Конверсия', conv.toFixed(2) + '%') +
      '</div>';

    var p = d.platforms || {};
    var plat = '<div class="ow-sec">Платформы</div><div class="ow-platcards">' +
      ['web', 'ios', 'android'].map(function (k) {
        var pv = p[k] || {};
        return '<div class="ow-card"><div class="ow-k">' + PLATFORM_LABEL[k] + '</div><div class="ow-v">' + num(pv.sessions) + '</div>' +
          '<div class="ow-d ow-stable">' + num(pv.users) + ' польз. · ' + num(pv.registrations) + ' рег.</div></div>';
      }).join('') +
      '<div class="ow-card"><div class="ow-k">Всего</div><div class="ow-v">' + num(s.sessions) + '</div><div class="ow-d ow-stable">' + num(s.users) + ' польз.</div></div>' +
      '</div>';

    var lots = (d.lotteries || []).slice().sort(function (a, b) { return (b.sessions || 0) - (a.sessions || 0); });
    var totalSess = lots.reduce(function (a, b) { return a + (b.sessions || 0); }, 0) || 1;
    var lotRows = LOTTERIES.map(function (L) {
      var row = null; for (var i = 0; i < lots.length; i++) if (lots[i].lottery === L[0]) { row = lots[i]; break; }
      row = row || {};
      var share = ((row.sessions || 0) / totalSess * 100);
      return '<tr><td>' + esc(L[1]) + '</td><td>' + num(row.users) + '</td><td>' + num(row.sessions) + '</td><td>' + num(row.opens) +
        '</td><td>' + num(row.generatorRuns) + '</td><td>' + num(row.analyticsOpens) + '</td><td>' + num(row.periodAnalysis) +
        '</td><td>' + num(row.draw3d) + '</td><td>' + num(row.ticketChecks) + '</td><td>' + num(row.resultViews) +
        '</td><td>' + num(row.freeSessions) + '</td><td>' + num(row.proSessions) + '</td><td>' + num(row.paywallViews) +
        '</td><td>' + share.toFixed(1) + '%</td></tr>';
    }).join('');
    var lotTable = '<div class="ow-sec">Лотереи (9)</div><div class="ow-tablewrap"><table class="ow-table"><thead><tr>' +
      ['Лотерея', 'Польз.', 'Сессии', 'Открытий', 'Генераций', 'Аналитика', 'Периоды', '3D', 'Проверок', 'Результаты', 'FREE', 'PRO', 'Paywall', 'Доля'].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + lotRows + '</tbody></table></div>';

    var models = d.models || {};
    var modelRows = Object.keys(models).sort(function (a, b) { return models[b] - models[a]; }).map(function (m) {
      return '<tr><td>' + esc(m) + '</td><td>' + num(models[m]) + '</td></tr>';
    }).join('') || '<tr><td colspan="2" style="text-align:center;color:#b79aac">Нет данных</td></tr>';
    var modelTable = '<div class="ow-sec">Модели генератора</div><div class="ow-tablewrap"><table class="ow-table"><thead><tr><th>Модель</th><th>Использований</th></tr></thead><tbody>' + modelRows + '</tbody></table></div>';

    var countries = (d.countries || []);
    var maxC = countries.reduce(function (a, b) { return Math.max(a, b.sessions || 0); }, 1);
    var cRows = countries.map(function (c) {
      return '<tr><td>' + esc(c.country || '??') + '</td><td>' + num(c.users) + '</td><td>' + num(c.sessions) +
        '</td><td>' + num(c.registrations) + '</td><td>' + num(c.proSessions) + '</td><td>' + esc(LOT_LABEL[c.topLottery] || c.topLottery || '—') +
        '</td><td>' + num(c.web) + '/' + num(c.ios) + '/' + num(c.android) + '</td>' +
        '<td style="width:120px"><div class="ow-bar"><i style="width:' + Math.round((c.sessions || 0) / maxC * 100) + '%"></i></div></td></tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:#b79aac">Нет данных</td></tr>';
    var cTable = '<div class="ow-sec">Страны</div><div class="ow-tablewrap"><table class="ow-table"><thead><tr>' +
      ['Страна', 'Польз.', 'Сессии', 'Рег.', 'PRO', 'Топ-лотерея', 'Веб/iOS/And', ''].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + cRows + '</tbody></table></div>';

    var ts = d.timeseries || [];
    var chart = '<div class="ow-sec">Динамика</div><div class="ow-chart">' +
      svgLine(ts, ['users', 'sessions'], ['#e2699e', '#6fb7ff']) + '</div>' +
      legend([['Пользователи', '#e2699e'], ['Сессии', '#6fb7ff']]);

    var rv = d.revenue || {};
    var byPlan = rv.byPlan || {};
    var planRows = ['loto_pro_m1', 'loto_pro_m3', 'loto_pro_m6', 'loto_pro_m12'].map(function (pid) {
      var label = { loto_pro_m1: '1 мес', loto_pro_m3: '3 мес', loto_pro_m6: '6 мес', loto_pro_m12: '12 мес' }[pid];
      return '<tr><td>' + label + '</td><td>' + num(byPlan[pid] || 0) + '</td></tr>';
    }).join('');
    var revenue = '<div class="ow-sec">Продажи и выручка</div><div class="ow-grid">' +
      card('Подтв. покупки', num(rv.confirmedPurchases)) +
      card('Активные PRO', num(rv.activePaidSubscriptions)) +
      card('Возвраты', num(rv.refunds)) +
      card('Выручка', rv.grossRevenue != null ? num(rv.grossRevenue) : '«нет данных»') +
      '</div><div class="ow-tablewrap"><table class="ow-table"><thead><tr><th>План</th><th>Активных</th></tr></thead><tbody>' + planRows + '</tbody></table></div>' +
      '<div class="ow-note">' + esc(rv.note || '') + '</div>';

    var f = d.funnel || {};
    var funnel = '<div class="ow-sec">Воронка</div><div class="ow-grid">' +
      card('Пользователи', num(f.users)) + card('Регистрации', num(f.signups)) + card('Paywall', num(f.paywallViews)) +
      card('purchase_start', num(f.purchaseStart)) + card('Подтв. покупки', num(f.confirmedPurchases)) + '</div>';

    // Forecast from monthly history (users).
    var hist = (d.history || []);
    var usersSeries = hist.map(function (m) { return +m.users || 0; });
    var fc = LIB.forecast(usersSeries, 12);
    var forecastHtml;
    if (!fc.enough) {
      forecastHtml = '<div class="ow-sec">Прогноз</div><div class="ow-card"><div class="ow-note">' + esc(fc.reason) + '</div></div>';
    } else {
      var pick = [1, 3, 6, 12];
      var fcCards = pick.map(function (h) {
        var pt = fc.points[h - 1];
        return card(h + ' мес', num(Math.round(pt.value)), null) .replace('</div></div>', '</div><div class="ow-d ow-stable">' + num(Math.round(pt.lo)) + '–' + num(Math.round(pt.hi)) + '</div></div>');
      }).join('');
      // actual + forecast chart
      var merged = hist.map(function (m, i) { return { bucket: m.month, users: +m.users || 0, forecast: null }; });
      var lastVal = usersSeries[usersSeries.length - 1];
      fc.points.forEach(function (pt) { merged.push({ bucket: '+' + pt.h, users: null, forecast: Math.round(pt.value), lo: Math.round(pt.lo), hi: Math.round(pt.hi) }); });
      forecastHtml = '<div class="ow-sec">Прогноз (пользователи)</div><div class="ow-grid">' + fcCards + '</div>' +
        '<div class="ow-chart">' + svgLine(merged.filter(function (m) { return m.users != null || m.forecast != null; }), ['users', 'forecast'], ['#e2699e', '#f5c451']) + '</div>' +
        legend([['Факт', '#e2699e'], ['Прогноз', '#f5c451']]) +
        '<div class="ow-note">Модель: экспоненциальное сглаживание Хольта (тренд), интервал ~95%. Детерминированно, без выдуманных чисел.</div>';
    }

    ovEl.innerHTML = '<div class="ow-wrap">' + head + filtersHtml() + summary + plat + chart + lotTable + modelTable + cTable + revenue + funnel + forecastHtml +
      '<div class="ow-note">Время сервера: ' + esc((d.serverTime || '').slice(0, 19)) + ' UTC · агрегация в Europe/Oslo</div></div>';
    wire();
  }

  function wire() {
    function on(id, ev, fn) { var el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
    on('ow-close', 'click', close);
    on('ow-refresh', 'click', load);
    on('ow-preset', 'change', function (e) { state.preset = e.target.value; if (state.preset === 'custom' && !state.from) { var t = new Date(); state.to = t.toISOString().slice(0, 10); state.from = new Date(t.getTime() - 6 * 864e5).toISOString().slice(0, 10); } load(); });
    on('ow-from', 'change', function (e) { state.from = e.target.value; load(); });
    on('ow-to', 'change', function (e) { state.to = e.target.value; load(); });
    on('ow-platform', 'change', function (e) { state.platform = e.target.value; load(); });
    on('ow-lottery', 'change', function (e) { state.lottery = e.target.value; load(); });
    on('ow-country', 'change', function (e) { state.country = e.target.value; load(); });
  }

  async function load() {
    if (state.busy) return; state.busy = true;
    try {
      var r = LIB.osloRange(state.preset, Date.now(), state.from, state.to);
      var params = { from: r.from, to: r.to, prev_from: r.prevFrom, prev_to: r.prevTo, bucket: r.bucket, platform: state.platform, lottery: state.lottery, country: state.country };
      if (!state.data) render(); // show loading
      var resp = await api({ params: params });
      if (resp.status === 403) { denied(); return; }
      if (resp.status !== 200 || !resp.body) { ovEl.innerHTML = '<div class="ow-wrap"><div class="ow-empty">Ошибка загрузки (' + resp.status + ')</div><button class="ow-x" id="ow-close">Закрыть</button></div>'; wire(); return; }
      state.data = resp.body; render();
    } catch (e) {
      ovEl.innerHTML = '<div class="ow-wrap"><div class="ow-empty">Сеть недоступна</div><button class="ow-x" id="ow-close">Закрыть</button></div>'; wire();
    } finally { state.busy = false; }
  }

  function denied() {
    ovEl.innerHTML = '<div class="ow-deny"><h2>Доступ только для владельца</h2><p style="color:#b79aac">Эта панель доступна исключительно учётной записи владельца проекта.</p><button class="ow-x" id="ow-close">Закрыть</button></div>';
    wire();
  }

  async function open() {
    build();
    ovEl.classList.add('show');
    document.documentElement.style.overflow = 'hidden';
    var owner = await isOwner();
    if (!owner) { denied(); return; }
    state.data = null; load();
  }
  function close() {
    if (ovEl) ovEl.classList.remove('show');
    document.documentElement.style.overflow = '';
    if (location.hash === '#owner') { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { location.hash = ''; } }
  }

  // Entry points: (1) #owner hash; (2) a discreet entry injected ONLY after a server owner-probe.
  function maybeInjectEntry() {
    (async function () {
      try {
        if (!(W.LotoAuth && W.LotoAuth.getSession)) return;
        var s = await W.LotoAuth.getSession();
        if (!s || !s.user || s.user.is_anonymous) return;   // never probe for anonymous
        if (!await isOwner()) return;                        // server says not owner → nothing
        if (document.getElementById('ow-entry')) return;
        var host = document.getElementById('acc-actions') || document.getElementById('account-ov') || document.body;
        var b = document.createElement('button');
        b.id = 'ow-entry'; b.className = 'ow-x'; b.textContent = 'Панель владельца';
        b.style.cssText = 'position:fixed;left:10px;bottom:calc(10px + env(safe-area-inset-bottom));z-index:2147482000;opacity:.85';
        b.addEventListener('click', open);
        (host === document.body ? document.body : host).appendChild(b);
      } catch (e) {}
    })();
  }

  W.LotoOwnerDashboard = { open: open, close: close };
  function initHash() { if (location.hash === '#owner') open(); }
  W.addEventListener('hashchange', function () { if (location.hash === '#owner') open(); });
  try { W.addEventListener('loto:accesschange', maybeInjectEntry); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initHash(); maybeInjectEntry(); }, { once: true });
  else { initHash(); maybeInjectEntry(); }
})();
