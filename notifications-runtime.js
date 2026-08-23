/*
 * LotoNotifications — ONE shared notification-preferences + subscription runtime for
 * every surface (iOS/APNs, Android/FCM, Web Push). There is deliberately no per-platform
 * settings product: the UI, the preference model and the backend registry are identical;
 * only the transport differs and is chosen by feature detection, never by user-agent.
 *
 * Support is decided by capability probing (Capacitor plugin presence on native; Service
 * Worker + PushManager + Notification + secure context on web). A light iOS signal is used
 * ONLY to choose between "not supported in this browser" and "add to Home Screen" copy — it
 * never gates the feature.
 *
 * Sender credentials (APNs key, FCM service account, VAPID PRIVATE key) live server-side
 * only. The client holds at most the PUBLIC VAPID key (safe by design) and never sends push.
 */
(function () {
  'use strict';

  var PHASE = {
    NOT_SUPPORTED: 'NOT_SUPPORTED',
    NOT_REQUESTED: 'NOT_REQUESTED',
    GRANTED: 'GRANTED',
    DENIED: 'DENIED',
    REGISTERING: 'REGISTERING',
    ACTIVE: 'ACTIVE',
    ERROR: 'ERROR',
    NEEDS_INSTALL: 'NEEDS_INSTALL' // iOS web tab: push only after Add to Home Screen
  };
  // Shared deep-link destinations (mirrored in the service worker). Keep in sync.
  var DESTINATIONS = {
    draw_result: 'analytics',
    draw_results: 'analytics',
    jackpot_updated: 'simulator',
    jackpot_update: 'simulator',
    jackpot_updates: 'simulator',
    prize_breakdown: 'analytics',
    saved_ticket_result: 'check',
    saved_ticket_results: 'check',
    deadline_reminder: 'simulator',
    deadline_reminders: 'simulator',
    upcoming_draw: 'simulator',
    system_message: 'simulator'
  };
  var CATEGORIES = ['draw_results', 'jackpot_updates', 'deadline_reminders', 'saved_ticket_results', 'prize_breakdown'];
  var INSTALL_KEY = 'loto_push_installation_v1';
  var LEGACY_WIN_KEY = 'loto_notify'; // old local-only win alert flag we absorb

  var listeners = [];
  var state = {
    phase: PHASE.NOT_REQUESTED,
    permission: 'default',
    supported: false,
    transport: null,       // 'apns' | 'fcm' | 'webpush'
    platform: 'web',       // 'ios' | 'android' | 'web'
    installationId: '',
    error: '',
    prefs: defaultPrefs(),
    ready: false
  };

  function defaultPrefs() {
    return {
      enabled: false, draw_results: true, jackpot_updates: true, prize_breakdown: true,
      deadline_reminders: false, saved_ticket_results: true,
      selected_lotteries: [], locale: 'en', timezone: 'UTC'
    };
  }

  // ── environment ────────────────────────────────────────────────────────────────────
  function cap() { return window.Capacitor || null; }
  function isNative() {
    var c = cap();
    if (c && (c.isNativePlatform ? c.isNativePlatform() : c.isNative)) return true;
    return !!(window.LotoNativeBilling && window.LotoNativeBilling.isNative);
  }
  function nativePlatform() { var c = cap(); return (window.LotoNativeBilling && window.LotoNativeBilling.platform) || (c && c.getPlatform && c.getPlatform()) || 'web'; }
  function pushPlugin() { var c = cap(); return (c && c.Plugins && c.Plugins.PushNotifications) || null; }
  function looksIOS() { return /iP(hone|ad|od)/.test(navigator.platform || '') || (/\bMac/.test(navigator.platform || '') && navigator.maxTouchPoints > 1); }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  }
  function webPushCapable() {
    return typeof window.isSecureContext !== 'undefined' && window.isSecureContext &&
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function config() { return window.LOTO_COMMERCIAL_CONFIG || {}; }
  function vapidPublicKey() { return config().webPushVapidPublicKey || ''; }

  function installationId() {
    var id = '';
    try { id = localStorage.getItem(INSTALL_KEY) || ''; } catch (e) {}
    if (!id || id.length < 8) {
      id = (crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2));
      try { localStorage.setItem(INSTALL_KEY, id); } catch (e) {}
    }
    return id;
  }

  // ── backend (single endpoint: register-push) ─────────────────────────────────────────
  function endpoint() { return String(config().supabaseUrl || '').replace(/\/$/, '') + '/functions/v1/register-push'; }
  async function token() {
    try { var s = window.LotoAuth && window.LotoAuth.ready ? await window.LotoAuth.getSession() : null; return s && s.access_token || ''; }
    catch (e) { return ''; }
  }
  async function ensureSession() {
    try {
      if (window.LotoAuth && window.LotoAuth.ready) { var s = await window.LotoAuth.getSession(); if (s && s.access_token) return s; return await window.LotoAuth.ensureAnonymous(); }
    } catch (e) {}
    return null;
  }
  async function backend(payload) {
    var cfg = config();
    if (!cfg.supabaseUrl || !cfg.supabasePublishableKey) throw new Error('backend_not_configured');
    await ensureSession();
    var at = await token();
    var headers = { apikey: cfg.supabasePublishableKey, 'content-type': 'application/json' };
    if (at) headers.Authorization = 'Bearer ' + at;
    var res = await fetch(endpoint(), { method: 'POST', headers: headers, body: JSON.stringify(payload || {}), cache: 'no-store' });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) { var e = new Error(data.error || ('HTTP ' + res.status)); e.status = res.status; throw e; }
    // Track whether the server can actually deliver on this platform's transport, so the UI
    // can stay fail-closed (never claim ACTIVE for a transport the backend can't send on).
    if (data && data.readiness) state.readiness = data.readiness;
    state.backendAccepted = true;
    return data;
  }

  // ── state plumbing ───────────────────────────────────────────────────────────────────
  function emit() { listeners.forEach(function (cb) { try { cb(getState()); } catch (e) {} }); }
  function getState() {
    return {
      phase: state.phase, permission: state.permission, supported: state.supported,
      transport: state.transport, platform: state.platform, error: state.error,
      prefs: JSON.parse(JSON.stringify(state.prefs)), ready: state.ready,
      transportReady: transportReady(), readiness: state.readiness || null,
      iosNeedsInstall: state.phase === PHASE.NEEDS_INSTALL
    };
  }
  function setPhase(p, err) { state.phase = p; state.error = err || ''; emit(); }

  // Is the server actually able to deliver on THIS platform's transport?
  function transportReady() {
    var r = state.readiness; if (!r) return false;
    if (state.transport === 'webpush') return !!r.webPushAvailable;
    if (state.transport === 'apns') return !!r.apnsAvailable;
    if (state.transport === 'fcm') return !!r.fcmAvailable;
    return false;
  }

  // Derive the truthful phase. ACTIVE requires: OS permission granted + a registered
  // subscription + the backend accepted it + the server transport is actually configured.
  // Anything short of that is GRANTED/neutral — we never fake "notifications active".
  function reconcilePhase() {
    if (!state.supported) { state.phase = state.needsInstall ? PHASE.NEEDS_INSTALL : PHASE.NOT_SUPPORTED; return; }
    if (state.permission === 'denied') { state.phase = PHASE.DENIED; return; }
    if (state.permission === 'granted') {
      var live = state.prefs.enabled && state.subscribed && state.backendAccepted && transportReady();
      state.phase = live ? PHASE.ACTIVE : PHASE.GRANTED;
      return;
    }
    state.phase = PHASE.NOT_REQUESTED;
  }

  // ── capability + current permission ─────────────────────────────────────────────────
  async function detect() {
    if (isNative()) {
      var plat = nativePlatform();
      state.platform = plat === 'ios' ? 'ios' : (plat === 'android' ? 'android' : 'web');
      state.transport = state.platform === 'ios' ? 'apns' : (state.platform === 'android' ? 'fcm' : null);
      var plugin = pushPlugin();
      state.supported = !!plugin && (state.platform === 'ios' || state.platform === 'android');
      state.needsInstall = false;
      if (state.supported) {
        try { var perm = await plugin.checkPermissions(); state.permission = mapNativePerm(perm && perm.receive); }
        catch (e) { state.permission = 'default'; }
      }
    } else {
      state.platform = 'web';
      state.transport = 'webpush';
      state.supported = webPushCapable();
      // iOS Safari tab cannot subscribe; installing to Home Screen unlocks it (iOS 16.4+).
      state.needsInstall = !state.supported && looksIOS() && !isStandalone();
      state.permission = ('Notification' in window) ? Notification.permission : 'denied';
    }
    reconcilePhase();
  }
  function mapNativePerm(v) { return v === 'granted' ? 'granted' : (v === 'denied' ? 'denied' : 'default'); }

  // Re-read the REAL OS permission (it may have changed in system settings).
  async function refreshPermission() {
    await detect();
    // If OS permission was revoked outside the app, drop enabled so UI can't show ON.
    if (state.permission === 'denied' && state.prefs.enabled) { state.prefs.enabled = false; }
    emit();
    return getState();
  }

  // ── preferences ──────────────────────────────────────────────────────────────────────
  async function loadPrefs() {
    try {
      var r = await backend({ locale: (document.documentElement.lang || 'en').slice(0, 2), timezone: guessTz() });
      if (r && r.preferences) applyPrefs(r.preferences);
    } catch (e) { /* offline / anon race — keep defaults, UI still renders */ }
    // Absorb the legacy local-only "win alert" flag once, if the user had it on.
    try { if (localStorage.getItem(LEGACY_WIN_KEY) === '1' && !state.prefs.saved_ticket_results) { state.prefs.saved_ticket_results = true; } } catch (e) {}
  }
  function applyPrefs(p) {
    var d = defaultPrefs();
    state.prefs = {
      enabled: !!p.enabled, draw_results: bool(p.draw_results, d.draw_results),
      jackpot_updates: bool(p.jackpot_updates, d.jackpot_updates),
      prize_breakdown: bool(p.prize_breakdown, d.prize_breakdown),
      deadline_reminders: bool(p.deadline_reminders, d.deadline_reminders),
      saved_ticket_results: bool(p.saved_ticket_results, d.saved_ticket_results),
      selected_lotteries: Array.isArray(p.selected_lotteries) ? p.selected_lotteries.slice(0, 32) : [],
      locale: p.locale || d.locale, timezone: p.timezone || d.timezone
    };
  }
  function bool(v, fallback) { return typeof v === 'boolean' ? v : fallback; }
  function guessTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } }

  async function savePrefs() {
    try {
      var r = await backend({ preferences: state.prefs, locale: state.prefs.locale, timezone: state.prefs.timezone });
      if (r && r.preferences) applyPrefs(r.preferences);
    } catch (e) { state.error = 'save_failed'; }
    reconcilePhase(); emit();
  }

  // ── permission request + subscription registration ───────────────────────────────────
  async function requestAndRegister() {
    if (!state.supported) { reconcilePhase(); emit(); return getState(); }
    setPhase(PHASE.REGISTERING);
    try {
      if (isNative()) await registerNative();
      else await registerWeb();
    } catch (e) {
      setPhase(PHASE.ERROR, 'register_failed');
      return getState();
    }
    await detect();
    if (state.permission === 'granted') { state.prefs.enabled = true; await savePrefs(); }
    reconcilePhase(); emit();
    return getState();
  }

  async function registerWeb() {
    var perm = await Notification.requestPermission();
    state.permission = perm;
    if (perm !== 'granted') return;
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.getSubscription();
    if (!sub) {
      var vapid = vapidPublicKey();
      var opts = { userVisibleOnly: true };
      if (vapid) opts.applicationServerKey = urlBase64ToUint8Array(vapid);
      sub = await reg.pushManager.subscribe(opts);
    }
    var json = sub.toJSON();
    await backend({
      installationId: installationId(), platform: 'web', transport: 'webpush',
      endpoint: json.endpoint, keys: { p256dh: json.keys && json.keys.p256dh, auth: json.keys && json.keys.auth },
      enabled: true, locale: (document.documentElement.lang || 'en').slice(0, 2)
    });
    state.subscribed = true;
  }

  async function registerNative() {
    var plugin = pushPlugin();
    if (!plugin) throw new Error('no_plugin');
    var perm = await plugin.checkPermissions();
    if (mapNativePerm(perm && perm.receive) !== 'granted') { perm = await plugin.requestPermissions(); }
    state.permission = mapNativePerm(perm && perm.receive);
    if (state.permission !== 'granted') return;
    // Android: ensure the single shared "lottery_updates" channel exists (localized name).
    if (state.platform === 'android' && plugin.createChannel) {
      try {
        await plugin.createChannel({
          id: 'lottery_updates',
          name: (window.LOTO_CHANNEL_NAME || 'Обновления лотерей'),
          description: '',
          importance: 4, visibility: 1
        });
      } catch (e) {}
    }
    // Native token arrives asynchronously via the 'registration' listener (see attachNative()).
    await plugin.register();
    state.subscribed = true; // provisional; confirmed when the token upserts server-side
  }

  var nativeAttached = false;
  function attachNative() {
    var plugin = pushPlugin();
    if (!plugin || nativeAttached) return;
    nativeAttached = true;
    plugin.addListener('registration', function (t) {
      var tok = t && t.value; if (!tok) return;
      backend({
        installationId: installationId(), platform: state.platform,
        transport: state.transport, token: tok, enabled: state.prefs.enabled !== false,
        locale: (document.documentElement.lang || 'en').slice(0, 2)
      }).then(function () { state.subscribed = true; reconcilePhase(); emit(); }).catch(function () {});
    });
    plugin.addListener('registrationError', function () { setPhase(PHASE.ERROR, 'registration_error'); });
    plugin.addListener('pushNotificationReceived', function (n) { window.dispatchEvent(new CustomEvent('loto-push-received', { detail: n })); });
    plugin.addListener('pushNotificationActionPerformed', function (a) {
      var data = (a && a.notification && a.notification.data) || {};
      routeDeepLink(data);
    });
  }

  // ── deep links ───────────────────────────────────────────────────────────────────────
  function routeDeepLink(data) {
    var type = data && data.notificationType;
    var destination = (data && data.destination) || DESTINATIONS[type] || 'simulator';
    window.dispatchEvent(new CustomEvent('loto-push-open', {
      detail: { destination: destination, lotteryId: data && data.lotteryId, drawId: data && (data.drawId || data.date), notificationType: type }
    }));
  }

  // ── public actions ───────────────────────────────────────────────────────────────────
  async function enableMaster() { return requestAndRegister(); }
  async function disableMaster() {
    state.prefs.enabled = false;
    await savePrefs();
    // Keep the subscription row (fast re-enable); sender honours prefs.enabled=false.
    reconcilePhase(); emit(); return getState();
  }
  async function setCategory(key, value) {
    if (CATEGORIES.indexOf(key) < 0) return getState();
    state.prefs[key] = !!value; await savePrefs(); return getState();
  }
  async function setSelectedLotteries(ids) {
    state.prefs.selected_lotteries = Array.isArray(ids) ? ids.map(String).slice(0, 32) : [];
    await savePrefs(); return getState();
  }
  // Opt-in saved-ticket watch sync. Saved tickets live only on this device, so when the
  // user turns on saved_ticket_results we register a minimal server-side watch set; turning
  // it off (or having no tickets) clears them. The server never sees tickets otherwise.
  async function syncWatches(watches, enabled) {
    try { await backend({ action: 'sync-watches', watches: Array.isArray(watches) ? watches : [], enabled: enabled !== false }); }
    catch (e) { state.error = 'watch_sync_failed'; }
    return getState();
  }
  // On explicit account change: drop this device's token so it never follows the old user.
  async function onLogout() {
    try { await backend({ action: 'unregister', installationId: installationId() }); } catch (e) {}
    state.subscribed = false; state.prefs = defaultPrefs(); reconcilePhase(); emit();
  }
  function openAppSettings() {
    var app = cap() && cap().Plugins && cap().Plugins.App;
    // Capacitor has no direct "open app settings" core API; native layer may expose one.
    if (cap() && cap().Plugins && cap().Plugins.NativeSettings && cap().Plugins.NativeSettings.open) {
      cap().Plugins.NativeSettings.open({ optionAndroid: 'application_details', optionIOS: 'app' }).catch(function () {});
      return true;
    }
    return false;
  }

  // ── init ─────────────────────────────────────────────────────────────────────────────
  var initialized = false;
  async function init() {
    if (initialized) return getState();
    initialized = true;
    installationId();
    await detect();
    if (isNative()) attachNative();
    await loadPrefs();
    // OS may have changed permission since last run — reconcile so UI never lies.
    if (state.permission === 'denied') state.prefs.enabled = false;
    state.ready = true;
    reconcilePhase(); emit();
    return getState();
  }

  // Re-read permission whenever the app returns to foreground / Settings opens.
  window.addEventListener('focus', function () { if (initialized) refreshPermission(); });
  document.addEventListener('visibilitychange', function () { if (initialized && !document.hidden) refreshPermission(); });

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  window.LotoNotifications = {
    PHASE: PHASE, DESTINATIONS: DESTINATIONS, CATEGORIES: CATEGORIES,
    init: init, getState: getState,
    onChange: function (cb) { if (typeof cb === 'function') { listeners.push(cb); if (state.ready) cb(getState()); } return function () { listeners = listeners.filter(function (x) { return x !== cb; }); }; },
    enableMaster: enableMaster, disableMaster: disableMaster,
    setCategory: setCategory, setSelectedLotteries: setSelectedLotteries, syncWatches: syncWatches,
    refreshPermission: refreshPermission, openAppSettings: openAppSettings, onLogout: onLogout,
    _routeDeepLink: routeDeepLink
  };
})();
