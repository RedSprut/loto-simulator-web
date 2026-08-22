(function () {
  // App game id (body[data-game]) → drum canonical profile id (results.json key).
  // Kept in lock-step with the canonical registry by scripts/audit-drum-games.mjs.
  var APP_TO_DRUM = {
    lotto: 'lotto', viking: 'vikinglotto', euro: 'eurojackpot', powerball: 'powerball',
    mega: 'megaMillions', euromillions: 'euroMillions', superenalotto: 'superEnalotto',
    lottomax: 'lottoMax', powerballau: 'powerballAustralia'
  };
  if (Object.keys(APP_TO_DRUM).length !== 9) console.error('3D drum: expected 9 game mappings, got ' + Object.keys(APP_TO_DRUM).length);
  var DRUM_TO_APP = {}; for (var _appId in APP_TO_DRUM) DRUM_TO_APP[APP_TO_DRUM[_appId]] = _appId;

  var css = 'html.drum-overlay-open{--drum-nav-height:64px;--drum-nav-bottom:6px;--drum-nav-gap:6px}' +
    '@media (max-width:699px){html.drum-overlay-open .bnav{--nav-dock-height:64px;--nav-icon-box:32px;--nav-icon-size:30px;--nav-dice-size:31px;--nav-label-height:15px;--nav-item-gap:1px;--nav-indicator-inset-x:4px;--nav-indicator-inset-y:4px;z-index:100003;box-sizing:border-box;left:50%;right:auto;bottom:calc(env(safe-area-inset-bottom,0px) + var(--drum-nav-bottom));width:min(406px,calc(var(--nav-visual-width,100vw) - env(safe-area-inset-left,0px) - env(safe-area-inset-right,0px) - 24px));max-width:none;min-width:0;height:var(--drum-nav-height);min-height:var(--drum-nav-height);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding:4px 8px;border:1px solid color-mix(in srgb,var(--gm-hi,#fff) 42%,transparent);border-radius:999px;align-items:stretch;overflow:hidden;box-shadow:0 14px 36px rgba(0,0,0,.44);transition:none}' +
    'html.drum-overlay-open .bnav .bn{width:100%;height:100%;min-height:0;gap:var(--nav-item-gap);padding:0 3px}' +
    'html.drum-overlay-open .bnav .bn-lbl{font-size:11.5px}' +
    'html.drum-overlay-open .bnav #bn-drum3d{gap:0;padding:1px 2px 2px}' +
    'html.drum-overlay-open .bnav #bn-drum3d .bn-lbl{font-size:10.6px;line-height:1.02;text-align:center;white-space:normal;overflow-wrap:anywhere;max-width:100%}}' +
    '@media (min-width:700px){html.drum-overlay-open .bnav{z-index:100003;transition:none}}' +
    '#drum3d-overlay{position:fixed;inset:0;z-index:100000;background:#05060c;display:flex}' +
    '#drum3d-frame{flex:1;width:100%;height:100%;border:0;display:block}' +
    '#drum3d-back{position:absolute;top:calc(8px + env(safe-area-inset-top,0px));left:calc(8px + env(safe-area-inset-left,0px));z-index:100001;width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(10,12,22,.55);color:#fff;font-size:26px;line-height:1;cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}' +
    'body.drum3d-open{overflow:hidden}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var overlay = null, popHandler = null, prevActiveBn = 'bn-sim', langHandler = null;
  var msgHandler = null;
  function cssVar(n) { try { return getComputedStyle(document.body).getPropertyValue(n).trim(); } catch (e) { return ''; } }
  function currentAppId() { return document.body.getAttribute('data-game') || 'euro'; }

  // Diagnostics: window.__DRUM_INTEGRATION_DIAGNOSTICS__ (safe, read-only) so the
  // deployed build can be inspected directly — is the button present/visible, which
  // game/route is passed, is exactly one iframe alive. Also drives the settings badge.
  function drumDiag() {
    var btn = document.getElementById('btn-draw-3d');
    var r = btn ? btn.getBoundingClientRect() : null;
    var vis = !!(btn && r && r.width > 0 && r.height > 0 && getComputedStyle(btn).visibility !== 'hidden' && btn.offsetParent !== null);
    var f = document.getElementById('drum3d-frame');
    var d = {
      buildSha: document.documentElement.getAttribute('data-build') || 'dev',
      buttonFound: !!btn,
      buttonVisible: vis,
      buttonRect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
      selectedGameId: currentAppId(),
      embeddedRoute: f ? f.getAttribute('src') : null,
      overlayOpen: !!overlay,
      iframeCount: document.querySelectorAll('#drum3d-frame').length
    };
    window.__DRUM_INTEGRATION_DIAGNOSTICS__ = d;
    return d;
  }
  window.drumDiag = drumDiag;
  try { drumDiag(); } catch (e) {}

  // ── Saved-combination bridge (drum iframe → host's REAL storage) ────────────
  // The drum posts combinations; the HOST persists them through the app's existing
  // favorites store (local for a guest, account-synced for a signed-in user) and its
  // real FREE limit + PRO paywall. No second storage system, no client PRO flag.
  function postToDrum(payload) {
    var f = document.getElementById('drum3d-frame');
    if (!f || !f.contentWindow) return;
    try { f.contentWindow.postMessage(payload, location.origin); } catch (e) {}
  }
  function drumFreeLimit() {
    try { return Number((window.LotoCommercial.access.freeLimits || {}).savedCombinations) || 3; } catch (e) { return 3; }
  }
  function drumIsPro() {
    try { return window.LotoCommercial.access.accessLevel === 'pro'; } catch (e) { return false; }
  }
  function drumComboToFav(combo) {
    var appLot = DRUM_TO_APP[combo.lotteryId] || combo.lotteryId || currentAppId();
    var dateStr = ''; try { dateStr = new Date(combo.date || Date.now()).toLocaleDateString(typeof appLocale === 'function' ? appLocale() : undefined); } catch (e) {}
    return {
      name: (combo.lotteryName || '') + (dateStr ? ' · ' + dateStr : '') + ' · 3D',
      rows: [{ m: (combo.main || []).slice(), b: (combo.additional || []).slice() }],
      lot: appLot,
      source: combo.source || '3d-drum',
      resultId: combo.resultId || '',
      date: combo.date || new Date().toISOString(),
      id: combo.resultId || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    };
  }
  async function drumFavoritesSnapshot() {
    var favs = [];
    try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    var list = favs.map(function (f, i) {
      var row = (f.rows && f.rows[0]) || { m: [], b: [] };
      return {
        id: f.id || ('h' + i), lotteryId: APP_TO_DRUM[f.lot] || f.lot || '',
        lotteryName: f.name || '', main: (row.m || []).slice(), additional: (row.b || []).slice(),
        date: f.date || '', source: f.source || '', resultId: f.resultId || '',
      };
    });
    return { limit: drumFreeLimit(), isPro: drumIsPro(), list: list };
  }
  function pushDrumFavorites() {
    drumFavoritesSnapshot().then(function (snap) { postToDrum(Object.assign({ type: 'APP_FAVORITES' }, snap)); });
  }
  async function handleDrumSave(combo) {
    var favs = []; try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    if (combo.resultId && favs.some(function (f) { return f.resultId === combo.resultId; })) {
      postToDrum({ type: 'APP_SAVE_RESULT', status: 'duplicate' }); pushDrumFavorites(); return;
    }
    if (!drumIsPro() && favs.length >= drumFreeLimit()) {
      // Defence in depth — the drum pre-checks and shows replace/PRO; if it still asks
      // to save at the limit, open the app's real saved-combinations paywall.
      postToDrum({ type: 'APP_SAVE_RESULT', status: 'limit' });
      try { window.LotoCommercial.openPaywall('saved_combinations'); } catch (e) {}
      pushDrumFavorites(); return;
    }
    favs.unshift(drumComboToFav(combo));
    try { await saveFavs(favs.slice(0, 10)); } catch (e) {}
    try { await renderFavs(); } catch (e) {}
    postToDrum({ type: 'APP_SAVE_RESULT', status: 'saved' }); pushDrumFavorites();
  }
  async function handleDrumReplace(oldId, combo) {
    var favs = []; try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    var idx = favs.findIndex(function (f, i) { return (f.id || ('h' + i)) === oldId; });
    if (idx >= 0) favs.splice(idx, 1);
    favs.unshift(drumComboToFav(combo));
    try { await saveFavs(favs.slice(0, 10)); } catch (e) {}
    try { await renderFavs(); } catch (e) {}
    postToDrum({ type: 'APP_SAVE_RESULT', status: 'saved' }); pushDrumFavorites();
  }
  async function handleDrumRemove(id) {
    var favs = []; try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    var idx = favs.findIndex(function (f, i) { return (f.id || ('h' + i)) === id; });
    if (idx >= 0) { favs.splice(idx, 1); try { await saveFavs(favs); } catch (e) {} try { await renderFavs(); } catch (e) {} }
    pushDrumFavorites();
  }

  window.openDrum3D = function () {
    if (overlay) return;
    var appId = currentAppId();
    var drumId = APP_TO_DRUM[appId] || 'eurojackpot';
    var p = new URLSearchParams({ profile: drumId, embed: '1' });
    var map = { hdrA: '--hdr-a', hdrB: '--hdr-b', hdrC: '--hdr-c', glow: '--game-glow', gm: '--gm', gb: '--gb' };
    for (var k in map) { var v = cssVar(map[k]); if (v) p.set(k, v); }
    try { var L = window.LOTS && window.LOTS[appId]; if (L && (L.short || L.name)) p.set('name', L.short || L.name); } catch (e) {}
    // Pass the app's current locale so the embedded drum matches the app language.
    try { var lang = localStorage.getItem('loto_lang') || document.documentElement.lang || 'ru'; if (lang) p.set('lang', lang); } catch (e) {}
    p.set('navH', '64px'); p.set('navB', '6px'); p.set('navGap', '6px');

    // Mark the central nav item active while the overlay is open.
    var navItem = document.getElementById('bn-drum3d');
    if (navItem) { var curOn = document.querySelector('.bn.on'); prevActiveBn = curOn ? curOn.id : 'bn-sim'; document.querySelectorAll('.bn').forEach(function (x) { x.classList.remove('on'); }); navItem.classList.add('on'); }

    overlay = document.createElement('div');
    overlay.id = 'drum3d-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '3D-розыгрыш');
    var frame = document.createElement('iframe');
    frame.id = 'drum3d-frame'; frame.title = '3D-розыгрыш';
    frame.setAttribute('allow', 'autoplay; fullscreen');
    frame.src = './demo-drum/index.html?' + p.toString();
    var back = document.createElement('button');
    back.id = 'drum3d-back'; back.type = 'button'; back.textContent = '‹';
    back.setAttribute('aria-label', 'Назад');
    back.onclick = function () { history.back(); };
    overlay.appendChild(frame); overlay.appendChild(back);
    document.body.appendChild(overlay);
    document.documentElement.classList.add('drum-overlay-open');
    document.body.classList.add('drum3d-open');
    history.pushState({ drum3d: 1 }, '');        // browser/Android back closes overlay, not the app
    popHandler = function () { closeDrum3D(true); };
    window.addEventListener('popstate', popHandler);
    // Live language sync: if the user switches app language while the drum overlay is
    // open, tell the iframe to re-localize its HUD in place (no draw restart / reset).
    langHandler = function () { try { var lg = localStorage.getItem('loto_lang') || document.documentElement.lang; frame.contentWindow.postMessage({ type: 'loto:lang', lang: lg }, location.origin); } catch (e) {} };
    window.addEventListener('loto:languagechange', langHandler);
    msgHandler = function (e) {
      var d = e.data; if (!d || d.source !== 'loto-drum') return;
      if (d.type === 'DRUM_GAME_CHANGED') {
        var nextApp = DRUM_TO_APP[d.game];
        if (nextApp && nextApp !== currentAppId()) {
          try { selLot(nextApp); } catch (err) {}
          try { document.querySelectorAll('.bn').forEach(function (x) { x.classList.remove('on'); }); navItem.classList.add('on'); } catch (err2) {}
        }
        try { pushDrumFavorites(); } catch (err3) {} // new game's favorites → drum snapshot
      }
      // Saved-combination bridge → the app's REAL favorites store + PRO paywall.
      else if (d.type === 'DRUM_REQUEST_FAVORITES') { pushDrumFavorites(); }
      else if (d.type === 'DRUM_SAVE_COMBINATION') { handleDrumSave(d.combo || {}); }
      else if (d.type === 'DRUM_REPLACE_COMBINATION') { handleDrumReplace(d.oldId, d.combo || {}); }
      else if (d.type === 'DRUM_REMOVE_COMBINATION') { handleDrumRemove(d.id); }
      else if (d.type === 'DRUM_OPEN_PAYWALL') { try { window.LotoCommercial.openPaywall('saved_combinations'); } catch (err4) {} }
    };
    window.addEventListener('message', msgHandler);
    setTimeout(function () { try { back.focus(); } catch (e) {} }, 0);
    drumDiag();
  };

  window.closeDrum3D = function (fromPop) {
    if (!overlay) return;
    var f = document.getElementById('drum3d-frame');
    if (f) { try { f.src = 'about:blank'; } catch (e) {} } // stop the drum render loop + free WebGL/Rapier
    overlay.remove(); overlay = null;
    document.body.classList.remove('drum3d-open');
    document.documentElement.classList.remove('drum-overlay-open');
    if (popHandler) { window.removeEventListener('popstate', popHandler); popHandler = null; }
    if (langHandler) { window.removeEventListener('loto:languagechange', langHandler); langHandler = null; }
    if (msgHandler) { window.removeEventListener('message', msgHandler); msgHandler = null; }
    // Restore the active nav item to the page the user was on.
    try {
      document.querySelectorAll('.bn').forEach(function (x) { x.classList.remove('on'); });
      var back = document.getElementById(prevActiveBn || 'bn-sim'); if (back) back.classList.add('on');
      var focusEl = document.getElementById('bn-drum3d'); if (focusEl) focusEl.focus();
    } catch (e) {}
    if (!fromPop && history.state && history.state.drum3d) history.back();
    drumDiag();
  };
  // Keyboard access for the central nav item (Enter / Space).
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.id === 'bn-drum3d') { e.preventDefault(); openDrum3D(); }
  });
})();
