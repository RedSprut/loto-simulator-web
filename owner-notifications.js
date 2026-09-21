/* Lotto Simulator — Owner Notification Center (the owner-only bell, INSIDE the Owner Panel).
 *
 * This is not a second header bell. The public header carries exactly one bell — the user's
 * lottery Notification Center (notification-center.js) — and knows nothing about owner events.
 * This centre is a part of the Owner Panel: owner-dashboard.js fetches this file when the panel
 * opens, mounts the bell into the panel header and calls start() / stop() with the panel. While
 * the panel is closed there is no owner listener, timer, request or DOM on the page at all, so
 * owner analytics traffic — however heavy — cannot reach the main simulator's main thread.
 *
 * Every read/write goes through the owner-analytics Edge Function → owner_notification* RPCs, each
 * of which re-checks public.is_owner(auth.uid()) — a non-owner who loads this file by hand gets 403
 * and an empty bell. OWNER is the app_owners allow-list, not PRO Lifetime.
 *
 * What it does:
 *   • badge + list of owner events (visits, new / returning users, registrations, new countries,
 *     purchases / renewals / cancellations / refunds, payment failures, system failures, daily
 *     summaries) — the same rows that are pushed to the owner's devices;
 *   • read / unread state per owner ACCOUNT (notification_user_state) → synchronised between devices;
 *   • settings: mode (all / important / digest / custom), independent category switches for the
 *     centre and for push, push / in-app masters, a self-test push;
 *   • deep links: every card opens the Owner Panel on its day / block / country.
 * Russian only, owner only, no personal data (payloads carry country, platform, language, plan,
 * store, amounts and 8-character pseudonyms — never e-mail, IP or device ids).
 */
(function () {
  'use strict';
  var W = window, D = document;
  if (W.LotoOwnerNotifications) return;

  var CFG = (W.LOTO_COMMERCIAL_CONFIG || {});
  var BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  var APIKEY = String(CFG.supabasePublishableKey || '');
  var LIB = W.LotoOwnerLib || {};
  var POLL_MS = 60000;
  var PAGE = 60;
  // A burst of analytics events must not grow the DOM without bound: the centre keeps at most this
  // many cards in memory/DOM and pages further back on demand. The unread COUNT is always the
  // server's own count over the full history, so nothing is lost by capping the rendered list.
  var MAX_ROWS = 300;
  // Owner pushes can arrive many per minute during a traffic burst. Each one only marks the badge
  // dirty; the actual request is coalesced into one call per REFRESH_DEBOUNCE_MS window.
  var REFRESH_DEBOUNCE_MS = 4000;

  var state = { unread: 0, rows: [], prefs: null, open: false, filter: 'all', unreadOnly: false, view: 'list', busy: false, error: null, lastSync: null, more: true };
  var panel = null, pollTimer = null, wired = false;
  var running = false, refreshTimer = null, refreshPending = false, refreshInFlight = false;

  // ── api ────────────────────────────────────────────────────────────────────────────────────
  async function api(payload) {
    var session = null;
    try { if (W.LotoAuth && W.LotoAuth.getSession) session = await W.LotoAuth.getSession(); } catch (e) {}
    if (!session || !session.access_token || !BASE) throw new Error('unauthorized');
    var response = await fetch(BASE + '/functions/v1/owner-analytics', {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: APIKEY, Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify(payload)
    });
    var body = null;
    try { body = await response.json(); } catch (e) {}
    if (!response.ok) { var error = new Error((body && (body.error || body.detail)) || ('HTTP ' + response.status)); error.status = response.status; throw error; }
    return body;
  }
  var notif = function (op, extra) { return api({ notifications: Object.assign({ op: op }, extra || {}) }); };

  // ── formatting ─────────────────────────────────────────────────────────────────────────────
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function num(value) { return (+value || 0).toLocaleString('ru-RU'); }
  function when(value) {
    if (!value) return '';
    try {
      var d = new Date(value), now = new Date();
      var sameDay = d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Oslo' }) === now.toLocaleDateString('ru-RU', { timeZone: 'Europe/Oslo' });
      return d.toLocaleString('ru-RU', sameDay ? { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' } : { timeZone: 'Europe/Oslo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return String(value); }
  }
  function catLabel(cat) { return (LIB.CATEGORY_RU && LIB.CATEGORY_RU[cat]) || cat || '—'; }
  function catIcon(cat) { return (LIB.CATEGORY_ICON && LIB.CATEGORY_ICON[cat]) || '•'; }
  function countryName(iso) { return LIB.countryNameRu ? LIB.countryNameRu(iso) : iso; }
  function flag(iso) { return LIB.flagEmoji ? LIB.flagEmoji(iso) : ''; }
  // The server body uses ISO codes (a push must stay short); the centre expands them.
  function prettyBody(row) {
    var body = String(row.body || '');
    var data = row.data || {};
    if (data.country && /^[A-Z]{2}$/.test(data.country)) body = body.replace(new RegExp('(^|· )' + data.country + '(?= ·|$)'), '$1' + (flag(data.country) + ' ' + countryName(data.country)).trim());
    return body;
  }

  // ── styles ─────────────────────────────────────────────────────────────────────────────────
  function ensureStyles() {
    if (D.getElementById('own-style')) return;
    var css = [
      '#own-center{position:fixed;inset:0;z-index:1250;display:none;background:rgba(8,14,26,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}',
      '#own-center.show{display:flex;align-items:flex-start;justify-content:flex-end}',
      '#own-center .own-panel{width:min(520px,100%);height:100%;max-height:100dvh;display:flex;flex-direction:column;background:#e8f2fc;color:#0d2540;font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:-18px 0 50px rgba(0,0,0,.35)}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-panel{background:#0b1624;color:#e6f0fb}',
      '#own-center .own-top{display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top)) 14px 10px;border-bottom:1px solid rgba(29,78,216,.18);background:#fff}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-top{background:#12223a;border-color:#22405f}',
      '#own-center .own-title{font-weight:800;font-size:16px;margin-right:auto}',
      '#own-center .own-btn{min-height:34px;padding:6px 12px;border-radius:10px;border:1px solid #bcd7f2;background:#d7e9fb;color:inherit;font:inherit;font-weight:700;cursor:pointer}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-btn{background:#0f1c30;border-color:#22405f}',
      '#own-center .own-btn[disabled]{opacity:.6;cursor:progress}',
      '#own-center .own-btn-primary{background:#1d4ed8;border-color:#1d4ed8;color:#fff}',
      '#own-center .own-filters{display:flex;gap:6px;overflow-x:auto;padding:8px 14px;border-bottom:1px solid rgba(29,78,216,.18)}',
      '#own-center .own-chip{white-space:nowrap;padding:5px 11px;border-radius:999px;border:1px solid #bcd7f2;background:#fff;color:inherit;font:inherit;font-weight:700;cursor:pointer;font-size:12.5px}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-chip{background:#12223a;border-color:#22405f}',
      '#own-center .own-chip[aria-pressed="true"]{background:#1d4ed8;border-color:#1d4ed8;color:#fff}',
      '#own-center .own-body{flex:1;overflow:auto;padding:10px 14px 24px}',
      '#own-center .own-card{display:grid;grid-template-columns:34px 1fr auto;gap:10px;padding:10px 12px;border-radius:14px;border:1px solid #bcd7f2;background:#fff;margin-bottom:8px;cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-card{background:#12223a;border-color:#22405f}',
      '#own-center .own-card.unread{border-color:#4f8ff7;box-shadow:inset 3px 0 0 #4f8ff7}',
      '#own-center .own-card .own-ico{font-size:22px;line-height:1.2;text-align:center}',
      '#own-center .own-card h4{margin:0 0 2px;font-size:14px}',
      '#own-center .own-card p{margin:0;color:#3f6690;font-size:13px}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-card p{color:#8fb0d6}',
      '#own-center .own-card .own-meta{color:#3f6690;font-size:11px;margin-top:4px;display:flex;gap:6px;flex-wrap:wrap}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-card .own-meta{color:#8fb0d6}',
      '#own-center .own-sev{display:inline-block;padding:0 6px;border-radius:999px;font-size:10px;font-weight:800;background:#e3effc}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-sev{background:#183050}',
      '#own-center .own-sev-critical{color:#c62a5a}#own-center .own-sev-important{color:#a8730b}',
      '#own-center .own-mark{align-self:start;width:28px;height:28px;border-radius:50%;border:1px solid #bcd7f2;background:transparent;color:inherit;cursor:pointer;font-size:13px}',
      '#own-center .own-empty{color:#3f6690;text-align:center;padding:24px 10px}',
      '#own-center .own-err{background:rgba(242,120,154,.14);border:1px solid #c62a5a;border-radius:12px;padding:10px;margin:8px 0}',
      '#own-center .own-sec{background:#fff;border:1px solid #bcd7f2;border-radius:14px;padding:12px;margin-bottom:10px}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-sec{background:#12223a;border-color:#22405f}',
      '#own-center .own-sec h3{margin:0 0 8px;font-size:14px}',
      '#own-center .own-mode{display:grid;gap:6px}',
      '#own-center .own-mode label{display:grid;grid-template-columns:20px 1fr;gap:8px;align-items:start;padding:8px;border-radius:10px;border:1px solid #bcd7f2;cursor:pointer}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-mode label{border-color:#22405f}',
      '#own-center .own-mode label[data-on="true"]{border-color:#1d4ed8;background:rgba(29,78,216,.08)}',
      '#own-center .own-mode small{display:block;color:#3f6690;font-weight:400}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-mode small{color:#8fb0d6}',
      '#own-center table.own-t{width:100%;border-collapse:collapse;font-size:13px}',
      '#own-center table.own-t th,#own-center table.own-t td{padding:6px 4px;border-bottom:1px solid rgba(29,78,216,.14);text-align:left}',
      '#own-center table.own-t th{font-size:11px;text-transform:uppercase;color:#3f6690;letter-spacing:.03em}',
      '#own-center table.own-t td.c{text-align:center}',
      '#own-center .own-note{color:#3f6690;font-size:12px;margin-top:6px}',
      '#ow-ov[data-ow-theme="dark"] #own-center .own-note{color:#8fb0d6}',
      '#own-center .own-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0}',
      '#own-center .own-panel{max-width:100vw;overflow-x:hidden}',
      '#own-center .own-body{overflow-x:hidden;overflow-wrap:anywhere}',
      '#own-center .own-top{flex-wrap:wrap}#own-center .own-title{flex:1 1 160px;min-width:0}',
      '@media (max-width:719px){#own-center .own-panel{width:100%}#own-center .own-title{flex:1 1 100%}}'
    ].join('\n');
    var style = D.createElement('style');
    style.id = 'own-style';
    style.textContent = css;
    (D.head || D.documentElement).appendChild(style);
  }

  // ── bell + badge ───────────────────────────────────────────────────────────────────────────
  // The bell button is part of the Owner Panel header markup (owner-dashboard.js), never of the
  // public header — a non-owner page has no such element at all.
  function bell() { return D.getElementById('owner-bell-btn'); }
  function host() { return D.getElementById('ow-ov'); }
  function updateBadge(n) {
    state.unread = Math.max(0, +n || 0);
    var badge = D.getElementById('owner-bell-badge');
    if (badge) { badge.textContent = state.unread > 99 ? '99+' : String(state.unread); badge.hidden = state.unread === 0; }
    var b = bell();
    if (b) {
      b.classList.toggle('has-unread', state.unread > 0);
      b.setAttribute('aria-label', 'Уведомления владельца' + (state.unread ? ' · ' + num(state.unread) + ' непрочитанных' : ''));
      b.title = b.getAttribute('aria-label');
    }
  }
  function reveal() {
    var b = bell();
    if (!b) return;
    b.hidden = false;
    // The panel markup labels the button; refresh it here so a bell revealed with unread messages
    // already carries the count in its accessible name instead of waiting for the next sync.
    updateBadge(state.unread);
    if (!b.__ownWired) { b.__ownWired = true; b.addEventListener('click', function () { toggle(); }); }
  }
  function conceal() { var b = bell(); if (b) { b.hidden = true; } updateBadge(0); }

  // ── data ───────────────────────────────────────────────────────────────────────────────────
  async function refreshUnread() {
    if (!running) return;
    try { var r = await notif('unread'); updateBadge(r.unread); state.error = null; }
    catch (e) { if (e.status === 403) conceal(); }
  }
  // One request per burst. Any number of owner pushes/events inside the window collapse into a
  // single badge refresh (plus one list refresh when the centre is actually on screen), so a spike
  // in visitor activity cannot turn into a spike of requests or renders.
  function scheduleRefresh() {
    if (!running) return;
    refreshPending = true;
    if (refreshTimer) return;
    refreshTimer = setTimeout(async function () {
      refreshTimer = null;
      if (!running || !refreshPending || refreshInFlight) return;
      refreshPending = false; refreshInFlight = true;
      try { await refreshUnread(); if (state.open && state.view === 'list') await loadList(false); }
      finally { refreshInFlight = false; if (refreshPending) scheduleRefresh(); }
    }, REFRESH_DEBOUNCE_MS);
  }
  // Identical deliveries (a push echo, an overlapping poll, a page that re-lists) must not produce
  // duplicate cards: rows are keyed by the event id, newest kept, and the list stays bounded.
  function mergeRows(existing, incoming, append) {
    var seen = Object.create(null), out = [];
    (append ? existing.concat(incoming) : incoming.concat(existing)).forEach(function (row) {
      if (!row || !row.id || seen[row.id]) return;
      seen[row.id] = true; out.push(row);
    });
    return out.slice(0, MAX_ROWS);
  }
  async function loadList(more) {
    if (state.busy || !running) return;
    state.busy = true; state.error = null; render();
    try {
      var params = { limit: PAGE };
      if (state.filter !== 'all') params.category = state.filter;
      if (state.unreadOnly) params.unread_only = true;
      if (more && state.rows.length) params.before = state.rows[state.rows.length - 1].created_at;
      var r = await notif('list', { params: params });
      var rows = Array.isArray(r.rows) ? r.rows : [];
      state.rows = more ? mergeRows(state.rows, rows, true) : mergeRows([], rows, true);
      state.more = rows.length >= PAGE && state.rows.length < MAX_ROWS;
      state.lastSync = new Date();
      updateBadge(r.unread);
    } catch (e) {
      state.error = e;
      if (e.status === 403) conceal();
    } finally { state.busy = false; render(); }
  }
  async function loadPrefs() {
    try { var r = await notif('prefs_get'); state.prefs = r.prefs || null; }
    catch (e) { state.error = e; }
    render();
  }
  async function savePrefs(patch) {
    if (!state.prefs) return;
    var next = Object.assign({}, state.prefs, patch || {});
    state.busy = true; render();
    try { var r = await notif('prefs_set', { prefs: { mode: next.mode, categories: next.categories, push_enabled: next.push_enabled, in_app_enabled: next.in_app_enabled, digest_hour: next.digest_hour, tz: next.tz } }); state.prefs = r.prefs || next; }
    catch (e) { state.error = e; }
    finally { state.busy = false; render(); refreshUnread(); }
  }
  async function markRead(ids, read) {
    if (!ids || !ids.length) return;
    state.rows.forEach(function (row) { if (ids.indexOf(row.id) >= 0) row.read = read !== false; });
    updateBadge(state.rows.filter(function (r) { return !r.read; }).length);
    render();
    try { await notif('mark', { ids: ids, read: read !== false }); } catch (e) {}
    refreshUnread();
  }
  async function markAll() {
    state.rows.forEach(function (row) { row.read = true; });
    updateBadge(0); render();
    try { await notif('mark_all'); } catch (e) {}
    refreshUnread();
  }
  async function testPush() {
    state.busy = true; render();
    try {
      var r = await notif('test');
      var sweep = r.sweep || {};
      state.testResult = 'Тестовое уведомление создано' + (sweep.eligible ? ' · устройств: ' + num(sweep.eligible) + ' · отправлено: ' + num(sweep.sent) : ' · push-устройств владельца пока нет: включите уведомления на этом устройстве');
    } catch (e) { state.testResult = 'Не удалось отправить тест: ' + (e.message || 'ошибка'); }
    finally { state.busy = false; render(); loadList(false); }
  }

  // ── deep link → Owner Panel ────────────────────────────────────────────────────────────────
  async function openLink(link) {
    var target = String(link || '#owner');
    if (target.indexOf('#owner') !== 0) target = '#owner';
    close();
    try {
      var dash = W.LotoOwnerDashboard;
      if (!dash && typeof W.loadOwnerDashboard === 'function') dash = await W.loadOwnerDashboard();
      if (dash && dash.openLink) { await dash.openLink(target); return; }
    } catch (e) {}
    try { location.hash = target; } catch (e) {}
  }

  // ── panel ──────────────────────────────────────────────────────────────────────────────────
  function build() {
    if (panel) return panel;
    ensureStyles();
    panel = D.createElement('div');
    panel.id = 'own-center';
    panel.setAttribute('data-i18n-ignore', '');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Уведомления владельца');
    panel.innerHTML = '<div class="own-panel">' +
      '<div class="own-top"><span class="own-title">Уведомления владельца</span>' +
        '<button class="own-btn" type="button" id="own-view" aria-pressed="false">Настройки</button>' +
        '<button class="own-btn" type="button" id="own-readall">Прочитать все</button>' +
        '<button class="own-btn own-btn-primary" type="button" id="own-close" aria-label="Закрыть">✕</button></div>' +
      '<div class="own-filters" id="own-filters"></div>' +
      '<div class="own-body" id="own-body"></div></div>';
    // Mounted INSIDE the Owner Panel, never at body level. That keeps it out of the shell modal
    // manager's body-level "-ov" invariant entirely (it is neither body-level nor "-ov" named), and
    // it disappears together with the panel — it cannot be left running behind a closed panel.
    (host() || D.body).appendChild(panel);
    panel.addEventListener('click', function (event) {
      if (event.target === panel) { close(); return; }
      var t = event.target;
      if (t.closest('#own-close')) { close(); return; }
      if (t.closest('#own-readall')) { markAll(); return; }
      if (t.closest('#own-view')) { state.view = state.view === 'list' ? 'settings' : 'list'; if (state.view === 'settings' && !state.prefs) loadPrefs(); render(); return; }
      var chip = t.closest('.own-chip[data-filter]');
      if (chip) { var f = chip.getAttribute('data-filter'); if (f === '__unread') state.unreadOnly = !state.unreadOnly; else state.filter = f; loadList(false); return; }
      var mark = t.closest('.own-mark[data-id]');
      if (mark) { event.stopPropagation(); var id = mark.getAttribute('data-id'); var row = state.rows.filter(function (r) { return r.id === id; })[0]; markRead([id], !(row && row.read)); return; }
      var more = t.closest('#own-more');
      if (more) { loadList(true); return; }
      var card = t.closest('.own-card[data-id]');
      if (card) { var cid = card.getAttribute('data-id'); var crow = state.rows.filter(function (r) { return r.id === cid; })[0]; if (crow && !crow.read) markRead([cid], true); openLink(crow && crow.deep_link); return; }
      var test = t.closest('#own-test');
      if (test) { testPush(); return; }
      var modeLabel = t.closest('.own-mode label[data-mode]');
      if (modeLabel && state.prefs) { savePrefs({ mode: modeLabel.getAttribute('data-mode') }); return; }
    });
    panel.addEventListener('change', function (event) {
      var t = event.target;
      if (!state.prefs) return;
      if (t.matches('[data-cat][data-channel]')) {
        var cats = Object.assign({}, state.prefs.categories || {});
        var cat = t.getAttribute('data-cat'), channel = t.getAttribute('data-channel');
        var current = Object.assign({ in_app: true, push: true }, cats[cat] || {});
        current[channel] = t.checked;
        cats[cat] = current;
        savePrefs({ categories: cats, mode: state.prefs.mode });
      } else if (t.id === 'own-push-master') savePrefs({ push_enabled: t.checked });
      else if (t.id === 'own-inapp-master') savePrefs({ in_app_enabled: t.checked });
      else if (t.id === 'own-digest-hour') savePrefs({ digest_hour: +t.value });
    });
    D.addEventListener('keydown', function (event) { if (event.key === 'Escape' && state.open) close(); });
    return panel;
  }

  function renderFilters() {
    var cats = (LIB.CATEGORY_RU ? Object.keys(LIB.CATEGORY_RU) : []);
    var html = '<button class="own-chip" type="button" data-filter="all" aria-pressed="' + (state.filter === 'all') + '">Все</button>' +
      '<button class="own-chip" type="button" data-filter="__unread" aria-pressed="' + state.unreadOnly + '">Непрочитанные</button>' +
      cats.map(function (c) { return '<button class="own-chip" type="button" data-filter="' + esc(c) + '" aria-pressed="' + (state.filter === c) + '">' + esc(catIcon(c) + ' ' + catLabel(c)) + '</button>'; }).join('');
    panel.querySelector('#own-filters').innerHTML = html;
    panel.querySelector('#own-filters').hidden = state.view !== 'list';
  }
  function renderList() {
    var body = panel.querySelector('#own-body');
    var html = '';
    if (state.error) html += '<div class="own-err">' + esc(state.error.status === 403 ? 'Нет доступа: центр доступен только владельцу.' : 'Не удалось загрузить уведомления: ' + (state.error.message || 'ошибка')) + '</div>';
    if (!state.rows.length && !state.busy && !state.error) html += '<div class="own-empty">Уведомлений пока нет. Каждый визит, новый пользователь, регистрация, покупка или сбой появится здесь и придёт push-уведомлением по вашим настройкам.</div>';
    html += state.rows.map(function (row) {
      var data = row.data || {};
      var meta = [when(row.occurred_at || row.created_at), catLabel(row.category)];
      if (data.platform) meta.push({ web: 'Веб', ios: 'iOS', android: 'Android' }[data.platform] || data.platform);
      return '<button class="own-card' + (row.read ? '' : ' unread') + '" type="button" data-id="' + esc(row.id) + '" title="Открыть панель владельца: ' + esc(row.deep_link || '') + '">' +
        '<span class="own-ico" aria-hidden="true">' + esc(catIcon(row.category)) + '</span>' +
        '<span><h4>' + esc(row.title || catLabel(row.category)) + '</h4><p>' + esc(prettyBody(row)) + '</p>' +
          '<span class="own-meta">' + meta.map(esc).join(' · ') + ' <span class="own-sev own-sev-' + esc(row.severity) + '">' + esc((LIB.SEVERITY_RU && LIB.SEVERITY_RU[row.severity]) || row.severity || '') + '</span>' + (row.day ? ' · ' + esc(row.day) : '') + '</span></span>' +
        '<span class="own-mark" role="button" tabindex="0" data-id="' + esc(row.id) + '" aria-label="' + (row.read ? 'Отметить непрочитанным' : 'Отметить прочитанным') + '">' + (row.read ? '↺' : '✓') + '</span></button>';
    }).join('');
    if (state.busy) html += '<div class="own-empty">Загрузка…</div>';
    else if (state.rows.length && state.more) html += '<button class="own-btn" type="button" id="own-more" style="width:100%">Показать ещё</button>';
    if (state.lastSync) html += '<div class="own-note" style="text-align:center">Обновлено ' + esc(when(state.lastSync)) + ' · Europe/Oslo</div>';
    body.innerHTML = html;
  }
  function renderSettings() {
    var body = panel.querySelector('#own-body');
    var p = state.prefs;
    if (!p) { body.innerHTML = state.error ? '<div class="own-err">' + esc(state.error.message || 'ошибка') + '</div>' : '<div class="own-empty">Загрузка настроек…</div>'; return; }
    var cats = Array.isArray(p.all_categories) ? p.all_categories : Object.keys(LIB.CATEGORY_RU || {});
    var modes = ['all', 'important', 'digest', 'custom'];
    var html = '<div class="own-sec"><h3>Частота push-уведомлений</h3><div class="own-mode">' +
      modes.map(function (m) {
        var t = (LIB.MODE_RU && LIB.MODE_RU[m]) || [m, ''];
        return '<label data-mode="' + m + '" data-on="' + (p.mode === m) + '"><input type="radio" name="own-mode" value="' + m + '"' + (p.mode === m ? ' checked' : '') + '><span><b>' + esc(t[0]) + '</b><small>' + esc(t[1]) + '</small></span></label>';
      }).join('') + '</div>' +
      '<div class="own-note">Сейчас: <b>' + esc(((LIB.MODE_RU || {})[p.mode] || [p.mode])[0]) + '</b>. Режим «Все события» включён для владельца по умолчанию; частоту можно уменьшить в любой момент — центр уведомлений при этом продолжает собирать всё, что включено ниже.</div></div>' +
      '<div class="own-sec"><h3>Каналы</h3>' +
      '<div class="own-row"><span>Push на мои устройства<br><small class="own-note">устройств с push: ' + num(p.push_devices) + (p.push_devices ? '' : ' — включите уведомления в Личном кабинете → Уведомления, чтобы получать push и сюда') + '</small></span><input type="checkbox" id="own-push-master"' + (p.push_enabled !== false ? ' checked' : '') + '></div>' +
      '<div class="own-row"><span>Показывать в центре уведомлений</span><input type="checkbox" id="own-inapp-master"' + (p.in_app_enabled !== false ? ' checked' : '') + '></div>' +
      '<div class="own-row"><span>Час «Итогов дня» (Europe/Oslo)</span><select id="own-digest-hour">' + Array.from({ length: 24 }, function (_, h) { return '<option value="' + h + '"' + (h === +p.digest_hour ? ' selected' : '') + '>' + (h < 10 ? '0' : '') + h + ':00</option>'; }).join('') + '</select></div></div>' +
      '<div class="own-sec"><h3>Категории</h3><table class="own-t"><thead><tr><th>Событие</th><th>Важность</th><th class="c">В центре</th><th class="c">Push</th></tr></thead><tbody>' +
      cats.map(function (c) {
        var cur = Object.assign({ in_app: true, push: true }, (p.categories || {})[c] || {});
        var sev = (p.severity || {})[c] || 'info';
        return '<tr><td>' + esc(catIcon(c) + ' ' + catLabel(c)) + '</td><td><span class="own-sev own-sev-' + esc(sev) + '">' + esc((LIB.SEVERITY_RU || {})[sev] || sev) + '</span></td>' +
          '<td class="c"><input type="checkbox" data-cat="' + esc(c) + '" data-channel="in_app"' + (cur.in_app !== false ? ' checked' : '') + ' aria-label="В центре: ' + esc(catLabel(c)) + '"></td>' +
          '<td class="c"><input type="checkbox" data-cat="' + esc(c) + '" data-channel="push"' + (cur.push !== false ? ' checked' : '') + ' aria-label="Push: ' + esc(catLabel(c)) + '"></td></tr>';
      }).join('') + '</tbody></table>' +
      '<div class="own-note">Переключатели категорий действуют в любом режиме; режим дополнительно фильтрует push по важности. «Только важное» — важные и критичные; «Дайджест» — итоги дня и критичные сбои.</div></div>' +
      '<div class="own-sec"><h3>Проверка</h3><button class="own-btn" type="button" id="own-test"' + (state.busy ? ' disabled' : '') + '>Отправить тестовое уведомление</button>' +
      (state.testResult ? '<div class="own-note">' + esc(state.testResult) + '</div>' : '') +
      '<div class="own-note">Настройки, прочитанное и счётчик синхронизируются между всеми устройствами, где вы вошли как владелец. Push не содержит e-mail, IP, идентификаторов устройств и аккаунтов.</div></div>';
    body.innerHTML = html;
  }
  function render() {
    if (!panel || !state.open) return;
    renderFilters();
    var viewBtn = panel.querySelector('#own-view');
    viewBtn.textContent = state.view === 'list' ? 'Настройки' : 'Уведомления';
    viewBtn.setAttribute('aria-pressed', String(state.view === 'settings'));
    panel.querySelector('#own-readall').hidden = state.view !== 'list';
    if (state.view === 'list') renderList(); else renderSettings();
  }
  function open() {
    build();
    state.open = true;
    panel.classList.add('show');
    render();
    loadList(false);
    if (!state.prefs) loadPrefs();
    try { if (W.LotoTelemetry && W.LotoTelemetry.track) W.LotoTelemetry.track('notification_center_open', { props: { context: 'owner' } }); } catch (e) {}
  }
  function close() { if (!panel) return; state.open = false; panel.classList.remove('show'); }
  function toggle() { if (state.open) close(); else open(); }

  // ── push receipts: refresh, never render into the user's centre ────────────────────────────
  function isOwnerPush(data) {
    var d = data && (data.data || data) || {};
    return d.notificationType === 'owner_event' || d.eventType === 'owner_event' || d.destination === 'owner';
  }
  // A raw owner event never drives a render of its own: it only marks the badge dirty and the
  // debounced refresher does one request for the whole burst.
  function onOwnerPush() { scheduleRefresh(); }
  // The listeners are installed once and are inert while the centre is stopped (running === false),
  // so opening and closing the Owner Panel any number of times can never accumulate subscriptions.
  function wireEvents() {
    if (wired) return;
    wired = true;
    try {
      if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', function (e) {
        if (!running) return;
        var d = e.data || {};
        if (d.type === 'LOTO_PUSH_RECEIVED' && isOwnerPush(d.data)) onOwnerPush();
        if (d.type === 'LOTO_PUSH_OPEN' && isOwnerPush(d.data)) { onOwnerPush(); openLink(d.data.deepLink || d.data.deeplink); }
      });
    } catch (e) {}
    W.addEventListener('loto-push-received', function (e) { if (running && isOwnerPush(e.detail)) onOwnerPush(); });
    // Routed by the user notification centre / index.html when a push, a cold start or a native tap
    // carries destination = owner.
    W.addEventListener('loto-owner-open', function (e) { if (!running) return; var d = e.detail || {}; onOwnerPush(); openLink(d.deepLink || d.deeplink || d.link); });
    D.addEventListener('visibilitychange', function () { if (running && !D.hidden) scheduleRefresh(); });
  }

  // ── lifecycle: owned by the Owner Panel ────────────────────────────────────────────────────
  // start() is called when the panel opens, stop() when it closes (including a close forced by the
  // shell's modal manager). Between them nothing owner-related runs.
  var probed = null;
  async function start() {
    if (running) return;
    running = true;
    try {
      if (!(W.LotoAuth && W.LotoAuth.getSession)) { conceal(); running = false; return; }
      var session = await W.LotoAuth.getSession();
      if (!session || !session.user || session.user.is_anonymous) { conceal(); running = false; return; }
      if (probed !== session.user.id) {
        var probe = await api({ probe: true });
        if (!probe || probe.owner !== true) { conceal(); running = false; return; }
        probed = session.user.id;
      }
      if (!running) return;                       // the panel closed while the probe was in flight
      reveal();
      wireEvents();
      await refreshUnread();
      if (running && !pollTimer) pollTimer = setInterval(function () { if (running && !D.hidden) scheduleRefresh(); }, POLL_MS);
    } catch (e) { conceal(); running = false; }
  }
  function stop() {
    running = false;
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    refreshPending = false;
    close();
  }

  W.LotoOwnerNotifications = { start: start, stop: stop, open: open, close: close, toggle: toggle, openLink: openLink,
    refresh: function () { return loadList(false); },
    _state: function () { return state; }, _running: function () { return running; } };
})();
