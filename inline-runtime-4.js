(function () {
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
    'html.drum-overlay-open,html.drum-overlay-open body{overflow:hidden;height:100%;min-height:0}' +
    'html.drum-overlay-open body{padding-bottom:0}' +
    'body.drum3d-paywall .pro-ov{z-index:100010}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var overlay = null, popHandler = null, prevActiveBn = 'bn-sim', langHandler = null;
  var msgHandler = null;
  function cssVar(n) { try { return getComputedStyle(document.body).getPropertyValue(n).trim(); } catch (e) { return ''; } }
  function currentAppId() { return document.body.getAttribute('data-game') || 'euro'; }

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
  function drumTicketBonus(combo, appLot) {
    var l = LOTS[appLot] || L();
    return (combo.additional || []).slice(0, drawBonusCount(l));
  }
  function drumRowWithProvenance(combo, appLot) {
    var row = { m: (combo.main || []).slice(), b: drumTicketBonus(combo, appLot) };
    try { var prov = createRowProv(row, { sourceType: 'SIMULATED_3D_DRAW', simulationId: combo.resultId || undefined }, appLot); if (prov) row.prov = prov; } catch (e) {}
    return row;
  }
  function drumComboToFav(combo) {
    var appLot = DRUM_TO_APP[combo.lotteryId] || combo.lotteryId || currentAppId();
    var dateStr = ''; try { dateStr = new Date(combo.date || Date.now()).toLocaleDateString(typeof appLocale === 'function' ? appLocale() : undefined); } catch (e) {}
    return {
      name: (combo.lotteryName || '') + (dateStr ? ' · ' + dateStr : '') + ' · 3D',
      rows: [drumRowWithProvenance(combo, appLot)],
      lot: appLot,
      source: combo.source || '3d-drum',
      resultId: combo.resultId || '',
      add: (combo.additional || []).slice(),
      date: combo.date || new Date().toISOString(),
      id: combo.resultId || ('d' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    };
  }
  function drumSourceLabel(fav, row) {
    try {
      var ui = window.LotoCourtUI;
      if (!ui || !LOTS[fav.lot]) return '';
      return ui.rowCaption(ui.provenanceOf(row, fav.lot));
    } catch (e) { return ''; }
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
        sourceLabel: drumSourceLabel(f, row),
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
      postToDrum({ type: 'APP_SAVE_RESULT', status: 'limit' });
      try { window.LotoCommercial.openPaywall('saved_combinations'); } catch (e) {}
      pushDrumFavorites(); return;
    }
    favs.unshift(drumComboToFav(combo));
    try { await saveFavs(drumIsPro() ? favs : favs.slice(0, 10)); } catch (e) {}
    try { await renderFavs(); } catch (e) {}
    appUsage('combination_saved', 'drum', { rows: 1, ref: combo.resultId });
    postToDrum({ type: 'APP_SAVE_RESULT', status: 'saved' }); pushDrumFavorites();
    try { drumApplyToTopRows(combo); } catch (e) {}  
  }
  async function handleDrumReplace(oldId, combo) {
    var favs = []; try { favs = (await loadFav()) || []; } catch (e) { favs = []; }
    var idx = favs.findIndex(function (f, i) { return (f.id || ('h' + i)) === oldId; });
    if (idx >= 0) favs.splice(idx, 1);
    favs.unshift(drumComboToFav(combo));
    try { await saveFavs(drumIsPro() ? favs : favs.slice(0, 10)); } catch (e) {}
    try { await renderFavs(); } catch (e) {}
    appUsage('combination_saved', 'drum_replace', { rows: 1, ref: combo.resultId });
    postToDrum({ type: 'APP_SAVE_RESULT', status: 'saved' }); pushDrumFavorites();
    try { drumApplyToTopRows(combo); } catch (e) {}  
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
  var pendingDrumCombo = null;
  var drumAccessListener = null;
  function openDrumPaywall(combo) {
    pendingDrumCombo = combo || pendingDrumCombo || null;
    try {
      document.body.classList.add('drum3d-paywall');  
      if (!drumAccessListener) {
        drumAccessListener = function () {
          try { pushDrumFavorites(); } catch (e) {}                  
          if (pendingDrumCombo && drumIsPro()) {                     
            var c = pendingDrumCombo; pendingDrumCombo = null; handleDrumSave(c);
          }
        };
        window.addEventListener('loto:accesschange', drumAccessListener);
      }
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
      if (appLot !== currentAppId()) return 'skip';         
      var m = (combo.main || []).slice(), b = drumTicketBonus(combo, appLot);
      if (!m.length) return 'skip';
      var eq = function (x, y) { return x.length === y.length && x.every(function (v, i) { return v === y[i]; }); };
      for (var i = 0; i < rows.length; i++) if (eq(rows[i].m, m) && eq(rows[i].b, b)) return 'dup';  
      var idx = -1;
      for (var j = 0; j < rows.length; j++) if ((rows[j].m || []).length === 0 && (rows[j].b || []).length === 0) { idx = j; break; }
      if (idx < 0) { if (rows.length >= MAX_ROWS) return 'full'; rows.push(nr()); idx = rows.length - 1; }
      rows[idx].m = m; rows[idx].b = b; act = idx;
      try { setRowProvenance(rows[idx], { sourceType: 'SIMULATED_3D_DRAW', simulationId: combo.resultId || undefined }); } catch (e) {}
      renderSim();
      if (!quiet) { try { goToRows(); } catch (e) {} try { resetBanner(); } catch (e) {} }
      return 'added';
    } catch (e) { try { console.warn('drumApplyToTopRows failed', e); } catch (_e) {} return 'skip'; }
  }
  function drumBulkApply(lotteryId, combos, labels) {
    labels = labels || {};
    var appLot = DRUM_TO_APP[lotteryId] || lotteryId;
    try { var prevLot = currentAppId(); if (appLot && appLot !== prevLot) selLot(appLot); smartStartRecord(appLot, prevLot); } catch (e) {}
    closeDrum3D();                                           
    try { clearGroupAnalysisState(); } catch (e) {}
    var applied = 0, already = 0, capped = false;
    for (var i = 0; i < (combos || []).length; i++) {
      var r = drumApplyToTopRows(combos[i], true);
      if (r === 'added') applied++;
      else if (r === 'dup') already++;                  
      else if (r === 'full') { capped = true; break; }
    }
    try { goToRows(); } catch (e) {}
    try { resetBanner(); } catch (e) {}
    try {
      if (capped) showFeedback(String(labels.limitTpl || '%N%').replace('%N%', MAX_ROWS), '', '⚠️', 3400);
      else if (applied > 0 && already > 0) showFeedback(String(labels.mixedTpl || 'Добавлено %A%, уже были %B%').replace('%A%', applied).replace('%B%', already), '', '✅', 3000);
      else if (applied === 0 && already > 0) showFeedback(String(labels.allPresentTpl || 'Все выбранные комбинации уже на главном экране'), '', 'ℹ️', 3000);
      else showFeedback(String(labels.addedTpl || '%N%').replace('%N%', applied), '', '✅', 2600);
    } catch (e) {}
  }

  window.openDrum3D = function () {
    if (overlay) return;
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
    try { var lang = (window.LotoI18n && window.LotoI18n.language) || document.documentElement.lang || (window.LotoLang && window.LotoLang.detect()) || 'en'; if (lang) p.set('lang', lang); } catch (e) {}
    p.set('navH', '64px'); p.set('navB', '6px'); p.set('navGap', '6px');

    var navItem = document.getElementById('bn-drum3d');
    if (navItem) { var curOn = document.querySelector('.bn.on'); prevActiveBn = curOn ? curOn.id : 'bn-sim'; document.querySelectorAll('.bn').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-current', 'false'); }); navItem.classList.add('on'); navItem.setAttribute('aria-current', 'page'); }

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
    history.pushState({ drum3d: 1 }, '');         
    popHandler = function () { closeDrum3D(true); };
    window.addEventListener('popstate', popHandler);
    langHandler = function () { try { var lg = (window.LotoI18n && window.LotoI18n.language) || document.documentElement.lang; frame.contentWindow.postMessage({ type: 'loto:lang', lang: lg }, location.origin); } catch (e) {} };
    window.addEventListener('loto:languagechange', langHandler);
    msgHandler = function (e) {
      var d = e.data; if (!d || d.source !== 'loto-drum') return;
      if (d.type === 'DRUM_GAME_CHANGED') {
        var nextApp = DRUM_TO_APP[d.game];
        if (nextApp && nextApp !== currentAppId()) {
          try { var prevApp = currentAppId(); selLot(nextApp); smartStartRecord(nextApp, prevApp); } catch (err) {}
          try { document.querySelectorAll('.bn').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-current', 'false'); }); navItem.classList.add('on'); navItem.setAttribute('aria-current', 'page'); } catch (err2) {}
        }
        try { pushDrumFavorites(); } catch (err3) {}  
      }
      else if (d.type === 'DRUM_REQUEST_FAVORITES') { pushDrumFavorites(); }
      else if (d.type === 'DRUM_DRAW_COMPLETE') { try { if (window.LotoTelemetry) window.LotoTelemetry.track('draw3d_complete', { props: { ref: d.drawId, ms: d.ms } }); } catch (err4) {} }
      else if (d.type === 'DRUM_SAVE_COMBINATION') { handleDrumSave(d.combo || {}); }
      else if (d.type === 'DRUM_REPLACE_COMBINATION') { handleDrumReplace(d.oldId, d.combo || {}); }
      else if (d.type === 'DRUM_REMOVE_COMBINATION') { handleDrumRemove(d.id); }
      else if (d.type === 'DRUM_OPEN_PAYWALL') { openDrumPaywall(d.combo || null); }
      else if (d.type === 'DRUM_JUDGE_COMBINATION') {
        var jc = d.combo || {}; closeDrum3D();
        try { window.judgeGeneratedRows && window.judgeGeneratedRows([{ main: (jc.main || []).slice(), bonus: drumTicketBonus(jc, DRUM_TO_APP[jc.lotteryId] || jc.lotteryId || currentAppId()) }]); } catch (err5) {}
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
    if (f) { try { f.src = 'about:blank'; } catch (e) {} }  
    overlay.remove(); overlay = null;
    document.body.classList.remove('drum3d-open');
    document.documentElement.classList.remove('drum-overlay-open');
    if (popHandler) { window.removeEventListener('popstate', popHandler); popHandler = null; }
    if (langHandler) { window.removeEventListener('loto:languagechange', langHandler); langHandler = null; }
    if (msgHandler) { window.removeEventListener('message', msgHandler); msgHandler = null; }
    try {
      document.querySelectorAll('.bn').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-current', 'false'); });
      var back = document.getElementById(prevActiveBn || 'bn-sim'); if (back) { back.classList.add('on'); back.setAttribute('aria-current', 'page'); }
      var focusEl = document.getElementById('bn-drum3d'); if (focusEl) focusEl.focus();
    } catch (e) {}
    if (!fromPop && history.state && history.state.drum3d) history.back();
    drumDiag();
  };
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.id === 'bn-drum3d') { e.preventDefault(); bottomNavRoute('drum3d'); }
  });
})();
