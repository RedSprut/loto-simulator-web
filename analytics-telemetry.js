/* Loto Simulator — first-party telemetry client (Web + iOS + Android).
 *
 * ONE implementation for all three platforms: the native apps bundle this same web build via
 * Capacitor, and the platform is detected at runtime (Capacitor.getPlatform → ios/android, else
 * web). Events are queued in localStorage (offline-safe), de-duplicated by a client event_id,
 * batched and POSTed to the analytics-ingest Edge Function, retried on failure. It never throws
 * into the app: every path is guarded so a telemetry hiccup can never affect the product UI.
 *
 * Privacy: no email/name/birthday/IP/precise geo. Only a random install id (per install), a random
 * session id (per session), coarse locale + a coarse region HINT (from locale) the server may use
 * only if it has no better geo header. user_id is NEVER sent from here — the server stamps it from
 * the verified JWT when a session is attached.
 */
(function () {
  'use strict';
  var W = window;
  if (W.LotoTelemetry) return;

  var CFG = (W.LOTO_COMMERCIAL_CONFIG || {});
  var BASE = String(CFG.supabaseUrl || '').replace(/\/+$/, '');
  var APIKEY = String(CFG.supabasePublishableKey || '');
  var ENABLED = !!(BASE && APIKEY);           // no backend config → silently no-op (local builds)
  var ENDPOINT = BASE + '/functions/v1/analytics-ingest';
  var QUEUE_KEY = 'loto_evq';
  var INSTALL_KEY = 'loto_install_id';
  var SESSION_KEY = 'loto_session_id';
  var AUTHED_ONCE_KEY = 'loto_authed_once';
  var MAX_QUEUE = 200, MAX_BATCH = 50;
  var flushTimer = null, sending = false, nextRetryAt = 0, lastAuthedUser = null;

  function uuid() {
    try { if (W.crypto && W.crypto.randomUUID) return W.crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  function lsGet(k) { try { return W.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { W.localStorage.setItem(k, v); } catch (e) {} }
  function ssGet(k) { try { return W.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { W.sessionStorage.setItem(k, v); } catch (e) {} }

  var installId = (function () { var v = lsGet(INSTALL_KEY); if (!v) { v = uuid(); lsSet(INSTALL_KEY, v); } return v; })();
  var sessionId = (function () { var v = ssGet(SESSION_KEY); return v; })(); // null if new session (set in init)

  function platform() {
    try {
      if (W.Capacitor && W.Capacitor.getPlatform) {
        var p = W.Capacitor.getPlatform();
        if (p === 'ios' || p === 'android') return p;
      }
      if (W.Capacitor && W.Capacitor.isNativePlatform && W.Capacitor.isNativePlatform()) return 'ios';
    } catch (e) {}
    return 'web';
  }
  function accessLevel() {
    try { return (W.LotoCommercial && W.LotoCommercial.access && W.LotoCommercial.access.accessLevel === 'pro') ? 'pro' : 'free'; }
    catch (e) { return 'free'; }
  }
  function locale() {
    try { return (document.documentElement.lang || (navigator.language || 'en')).slice(0, 5); } catch (e) { return 'en'; }
  }
  function region() { // coarse ISO-2 hint from locale region subtag, e.g. en-GB → GB. Not IP.
    try {
      var l = navigator.language || '';
      var m = l.split('-')[1];
      if (m && /^[A-Za-z]{2}$/.test(m)) return m.toUpperCase();
    } catch (e) {}
    return null;
  }
  var buildEl = document.documentElement;
  var appVersion = (buildEl.getAttribute('data-build') || 'dev');
  var appBuild = (buildEl.getAttribute('data-build-ts') || '');

  // App internal lottery key (e.g. 'euro') → canonical id (e.g. 'eurojackpot'). Kept in lockstep
  // with the app registry via window.LOTO_APP_LOTTERY_KEYS (exposed by index.html).
  function canonicalLottery(appKey) {
    if (!appKey) return null;
    try {
      var map = W.LOTO_APP_LOTTERY_KEYS || {};
      return map[appKey] || null; // unknown → null (server also validates; never a bad bucket)
    } catch (e) { return null; }
  }
  var currentLottery = null; // canonical id of the last-opened lottery this session

  function readQueue() { try { var a = JSON.parse(lsGet(QUEUE_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function writeQueue(a) { try { lsSet(QUEUE_KEY, JSON.stringify(a.slice(-MAX_QUEUE))); } catch (e) {} }

  function track(type, props) {
    try {
      if (!ENABLED) return;
      props = props || {};
      var lot = props.lottery ? canonicalLottery(props.lottery) : currentLottery;
      var ev = {
        event_id: uuid(),
        event_type: type,
        platform: platform(),
        lottery_id: lot || null,
        access_level: accessLevel(),
        model_id: props.model || null,
        app_version: appVersion,
        app_build: appBuild,
        locale: locale(),
        session_id: sessionId || installId, // fallback: never null
        install_id: installId,
        event_ts: new Date().toISOString()
      };
      var q = readQueue();
      q.push(ev);
      writeQueue(q);
      scheduleFlush(1200);
    } catch (e) { /* telemetry must never break the app */ }
  }

  function scheduleFlush(delay) {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, delay || 0);
  }

  async function currentToken() {
    try {
      if (W.LotoAuth && W.LotoAuth.getSession) {
        var s = await W.LotoAuth.getSession();
        if (s && s.access_token && s.user && !s.user.is_anonymous) return s.access_token;
      }
    } catch (e) {}
    return null;
  }

  async function flush() {
    if (!ENABLED || sending) return;
    if (Date.now() < nextRetryAt) { scheduleFlush(nextRetryAt - Date.now()); return; }
    var q = readQueue();
    if (!q.length) return;
    sending = true;
    var batch = q.slice(0, MAX_BATCH);
    try {
      var headers = { 'Content-Type': 'application/json', 'apikey': APIKEY };
      var token = await currentToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var resp = await fetch(ENDPOINT, {
        method: 'POST', headers: headers, keepalive: true,
        body: JSON.stringify({ install_id: installId, region: region(), events: batch })
      });
      if (resp && resp.ok) {
        var ids = {}; batch.forEach(function (e) { ids[e.event_id] = 1; });
        writeQueue(readQueue().filter(function (e) { return !ids[e.event_id]; }));
        nextRetryAt = 0;
        sending = false;
        if (readQueue().length) scheduleFlush(300); // drain remaining batches
      } else {
        throw new Error('http ' + (resp && resp.status));
      }
    } catch (e) {
      nextRetryAt = Date.now() + 30000; // back off 30s; queue is preserved (offline-safe)
      sending = false;
    }
  }

  // ── Wrap existing GLOBAL functions (wrappers call originals; zero logic change) ──
  function wrap(name, before) {
    try {
      var orig = W[name];
      if (typeof orig !== 'function' || orig.__lotoWrapped) return false;
      var wrapped = function () {
        try { before.apply(null, arguments); } catch (e) {}
        return orig.apply(this, arguments);
      };
      wrapped.__lotoWrapped = true;
      W[name] = wrapped;
      return true;
    } catch (e) { return false; }
  }

  function installWraps() {
    wrap('selLot', function (id) { var c = canonicalLottery(id); if (c) currentLottery = c; track('lottery_open', { lottery: id }); });
    wrap('selAlgo', function (id) { track('model_selected', { model: id }); });
    wrap('generateSelectedRows', function () { track('generator_run', {}); });
    wrap('generateCombos', function () { track('generator_run', { model: (function () { try { return W.sgAlgo || null; } catch (e) { return null; } })() }); });
    wrap('checkTicket', function () { track('ticket_check', {}); });
    wrap('openOfficialResults', function () { track('result_view', {}); });
    wrap('openDrum3D', function () { track('draw3d_start', {}); });
    wrap('IF_setWin', function () { track('period_analysis', {}); });
    wrap('IF_setRange', function () { track('period_analysis', {}); });
    wrap('selPage', function (p) { if (p === 'ana') track('analytics_open', {}); });
    // Commercial surface (methods live on the LotoCommercial object).
    try {
      var C = W.LotoCommercial;
      if (C) {
        wrapObj(C, 'openPaywall', function () { track('paywall_view', {}); });
        wrapObj(C, 'purchase', function () { W.__lotoPurchaseIntent = 'purchase'; track('purchase_start', {}); });
        wrapObj(C, 'restorePurchase', function () { W.__lotoPurchaseIntent = 'restore'; });
      }
    } catch (e) {}
  }
  function wrapObj(obj, name, before) {
    try {
      var orig = obj[name];
      if (typeof orig !== 'function' || orig.__lotoWrapped) return;
      var wrapped = function () { try { before.apply(null, arguments); } catch (e) {} return orig.apply(this, arguments); };
      wrapped.__lotoWrapped = true; obj[name] = wrapped;
    } catch (e) {}
  }

  // ── Auth + purchase completion via the access-change bus ──
  function onAccessChange() {
    try {
      var lvl = accessLevel();
      // purchase/restore completion: level became pro right after an intent this session
      if (lvl === 'pro' && W.__lotoPurchaseIntent) {
        track(W.__lotoPurchaseIntent === 'restore' ? 'restore_success' : 'purchase_success', {});
        W.__lotoPurchaseIntent = null;
      }
    } catch (e) {}
    // login/signup detection (coarse, install-scoped heuristic; documented)
    (async function () {
      try {
        if (!(W.LotoAuth && W.LotoAuth.getSession)) return;
        var s = await W.LotoAuth.getSession();
        var uid = (s && s.user && !s.user.is_anonymous) ? s.user.id : null;
        if (uid && uid !== lastAuthedUser) {
          lastAuthedUser = uid;
          if (!lsGet(AUTHED_ONCE_KEY)) { lsSet(AUTHED_ONCE_KEY, '1'); track('signup', {}); }
          else track('login', {});
        }
      } catch (e) {}
    })();
  }

  function init() {
    if (!ENABLED) return;
    if (!sessionId) { sessionId = uuid(); ssSet(SESSION_KEY, sessionId); track('session_start', {}); }
    track('app_open', {});
    installWraps();
    // Re-attempt wraps shortly after load in case some globals are defined later in the bundle.
    var tries = 0; var iv = setInterval(function () { installWraps(); if (++tries >= 6) clearInterval(iv); }, 800);
    try { W.addEventListener('loto:accesschange', onAccessChange); } catch (e) {}
    try { onAccessChange(); } catch (e) {}
    try {
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
      W.addEventListener('pagehide', function () { flush(); });
    } catch (e) {}
    scheduleFlush(1500);
  }

  W.LotoTelemetry = { track: track, flush: flush, _installId: installId };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
