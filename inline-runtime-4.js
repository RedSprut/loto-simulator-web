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
    'body.drum3d-open{overflow:hidden}' +
    // When the PRO paywall is opened from inside the drum, lift it (and its scrim) ABOVE
    // the drum overlay (z 100000) + docked nav (z 100003) so it is actually visible; the
    // drum iframe stays alive underneath so isPro/limit can be pushed back without reload.
    'body.drum3d-paywall .pro-ov{z-index:100010}';
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
      // Faithful copy of the drawn additional balls (e.g. Norsk Lotto tilleggstall),
      // preserved separately because renderFavs() normalizes some games' rows and drops
      // a non-picked bonus from rows[].b — this keeps the drum panel showing the exact draw.
      add: (combo.additional || []).slice(),
      date: combo.date || new Date().toISOString(),
      id: combo.resultId || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    };
  }
  async function drumFavoritesSnapshot() {
    var favs = [];
    try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    var list = favs.map(function (f, i) {
      var row = (f.rows && f.rows[0]) || { m: [], b: [] };
      var extra = (row.b && row.b.length) ? row.b.slice() : ((f.add || []).slice());
      return {
        id: f.id || ('h' + i), lotteryId: APP_TO_DRUM[f.lot] || f.lot || '',
        lotteryName: f.name || '', main: (row.m || []).slice(), additional: extra,
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
    // FREE is already limited above; PRO keeps ALL combinations (no artificial cap),
    // so a PRO user's 100s of saves are never truncated.
    try { await saveFavs(drumIsPro() ? favs : favs.slice(0, 10)); } catch (e) {}
    try { await renderFavs(); } catch (e) {}
    postToDrum({ type: 'APP_SAVE_RESULT', status: 'saved' }); pushDrumFavorites();
    try { drumApplyToTopRows(combo); } catch (e) {} // #3: also add to the top working rows
  }
  async function handleDrumReplace(oldId, combo) {
    var favs = []; try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    var idx = favs.findIndex(function (f, i) { return (f.id || ('h' + i)) === oldId; });
    if (idx >= 0) favs.splice(idx, 1);
    favs.unshift(drumComboToFav(combo));
    try { await saveFavs(drumIsPro() ? favs : favs.slice(0, 10)); } catch (e) {}
    try { await renderFavs(); } catch (e) {}
    postToDrum({ type: 'APP_SAVE_RESULT', status: 'saved' }); pushDrumFavorites();
    try { drumApplyToTopRows(combo); } catch (e) {} // #3: also add to the top working rows
  }
  async function handleDrumRemove(id) {
    try {
      if (typeof customConfirm === 'function' && !(await customConfirm('Удалить из избранного?', 'Удалить', { title: 'Удалить комбинацию?' }))) {
        pushDrumFavorites();
        return;
      }
    } catch (e) {}
    var favs = []; try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    var idx = favs.findIndex(function (f, i) { return (f.id || ('h' + i)) === id; });
    if (idx >= 0) { favs.splice(idx, 1); try { await saveFavs(favs); } catch (e) {} try { await renderFavs(); } catch (e) {} }
    pushDrumFavorites();
  }
  // #3: append a saved 3D combination to the main screen's TOP working rows using the
  // app's own row model — never overwriting existing rows, deduped, capped by MAX_ROWS —
  // so it's ready the instant the user leaves the drum (no yellow apply-button press).
  // #2: open the app's EXISTING PRO paywall from inside the drum, visibly (above the
  // drum overlay), keep the pending combination, and — after the real server-authoritative
  // entitlement update — push the new isPro/limit to the iframe and save the pending once.
  var pendingDrumCombo = null;
  var drumAccessListener = null;
  function openDrumPaywall(combo) {
    pendingDrumCombo = combo || pendingDrumCombo || null;
    try {
      document.body.classList.add('drum3d-paywall'); // lift the paywall above the drum overlay
      if (!drumAccessListener) {
        drumAccessListener = function () {
          try { pushDrumFavorites(); } catch (e) {}                 // new isPro/limit → iframe, no reload
          if (pendingDrumCombo && drumIsPro()) {                    // real PRO confirmed → save the pending once
            var c = pendingDrumCombo; pendingDrumCombo = null; handleDrumSave(c);
          }
        };
        window.addEventListener('loto:accesschange', drumAccessListener);
      }
      // Clear a still-pending combo if the paywall is dismissed WITHOUT becoming PRO
      // (no duplicate, no lost save — nothing was stored). PRO path already saved+cleared it.
      var ov = document.getElementById('pro-ov');
      if (ov) {
        var mo = new MutationObserver(function () {
          if (!ov.classList.contains('show')) {
            mo.disconnect();
            document.body.classList.remove('drum3d-paywall');
            if (!drumIsPro()) pendingDrumCombo = null;
          }
        });
        mo.observe(ov, { attributes: true, attributeFilter: ['class'] });
      }
      window.LotoCommercial.openPaywall('saved_combinations');
    } catch (e) { try { console.warn('openDrumPaywall failed', e); } catch (_e) {} }
  }
  function drumApplyToTopRows(combo, quiet) {
    try {
      var appLot = DRUM_TO_APP[combo.lotteryId] || combo.lotteryId;
      if (appLot !== currentAppId()) return 'skip';        // never mix lotteries
      var m = (combo.main || []).slice(), b = (combo.additional || []).slice();
      if (!m.length) return 'skip';
      var eq = function (x, y) { return x.length === y.length && x.every(function (v, i) { return v === y[i]; }); };
      for (var i = 0; i < rows.length; i++) if (eq(rows[i].m, m) && eq(rows[i].b, b)) return 'dup'; // no duplicate row
      var idx = -1;
      for (var j = 0; j < rows.length; j++) if ((rows[j].m || []).length === 0 && (rows[j].b || []).length === 0) { idx = j; break; }
      if (idx < 0) { if (rows.length >= MAX_ROWS) return 'full'; rows.push(nr()); idx = rows.length - 1; }
      rows[idx].m = m; rows[idx].b = b; act = idx;
      renderSim();
      if (!quiet) { try { goToRows(); } catch (e) {} try { resetBanner(); } catch (e) {} }
      return 'added';
    } catch (e) { try { console.warn('drumApplyToTopRows failed', e); } catch (_e) {} return 'skip'; }
  }
  // #1: bulk-transfer selected saved combinations (one lottery) to the main screen —
  // close the drum, switch to that lottery, append each combination (in order, deduped,
  // capped by MAX_ROWS) and show a localized confirmation. No saved combos are removed.
  function drumBulkApply(lotteryId, combos, labels) {
    labels = labels || {};
    var appLot = DRUM_TO_APP[lotteryId] || lotteryId;
    try { if (appLot && appLot !== currentAppId()) selLot(appLot); } catch (e) {}
    closeDrum3D();                                          // back to the Simulator main screen
    try { clearGroupAnalysisState(); } catch (e) {}
    var applied = 0, already = 0, capped = false;
    for (var i = 0; i < (combos || []).length; i++) {
      var r = drumApplyToTopRows(combos[i], true);
      if (r === 'added') applied++;
      else if (r === 'dup') already++;                 // already on the main screen — not a duplicate row
      else if (r === 'full') { capped = true; break; }
    }
    try { goToRows(); } catch (e) {}
    try { resetBanner(); } catch (e) {}
    // Honest feedback: distinguish newly-added from already-present so the bulk button
    // is never a silent no-op after the per-save auto-apply already placed some rows.
    try {
      if (capped) showFeedback(String(labels.limitTpl || '%N%').replace('%N%', MAX_ROWS), '', '⚠️', 3400);
      else if (applied > 0 && already > 0) showFeedback(String(labels.mixedTpl || 'Добавлено %A%, уже были %B%').replace('%A%', applied).replace('%B%', already), '', '✅', 3000);
      else if (applied === 0 && already > 0) showFeedback(String(labels.allPresentTpl || 'Все выбранные комбинации уже на главном экране'), '', 'ℹ️', 3000);
      else showFeedback(String(labels.addedTpl || '%N%').replace('%N%', applied), '', '✅', 2600);
    } catch (e) {}
  }

  window.openDrum3D = function () {
    if (overlay) return;
    // The account is a full-screen modal and lifts the shared bottom navigation.
    // Always leave that modal through its normal close path before mounting the 3D
    // overlay, otherwise its body lock/stacking state can hide the navigation dock.
    var accountOverlay = document.getElementById('account-ov');
    if (accountOverlay && accountOverlay.classList.contains('show')) {
      try { if (typeof closeAccount === 'function') closeAccount(); }
      catch (e) { accountOverlay.classList.remove('show'); document.body.classList.remove('account-open'); }
    }
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
      else if (d.type === 'DRUM_OPEN_PAYWALL') { openDrumPaywall(d.combo || null); }
      // Real production engines on the exact saved rows. Close the drum overlay first so
      // the Judge/Consensus UI is visible in the host; budgets/paywall are the app's own.
      else if (d.type === 'DRUM_JUDGE_COMBINATION') {
        var jc = d.combo || {}; closeDrum3D();
        try { window.judgeGeneratedRows && window.judgeGeneratedRows([{ main: (jc.main || []).slice(), bonus: (jc.additional || []).slice() }]); } catch (err5) {}
      }
      else if (d.type === 'DRUM_CONSENSUS_COMBINATION') {
        closeDrum3D();
        try { if (typeof CONS_run === 'function') CONS_run(); } catch (err6) {}
      }
      else if (d.type === 'DRUM_BULK_APPLY') { drumBulkApply(d.lotteryId, d.combos || [], d.labels || {}); }
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
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.id === 'bn-drum3d') { e.preventDefault(); bottomNavRoute('drum3d'); }
  });
})();
