/* Read-only adapters over the live ticket. No second copy of the generated set is stored. */
(function () {
  'use strict';
  const selected = new Map();
  const part = (a, count, max) => Array.isArray(a) && a.length === count && a.every(n => Number.isInteger(n) && n >= 1 && n <= max) && new Set(a).size === count;
  function identify(row, lotteryId) {
    if (!row.rowId) row.rowId = crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (!row.lotteryId) row.lotteryId = lotteryId;
    if (!row.createdAt) row.createdAt = new Date().toISOString();
    return row;
  }
  function current() {
    const lotteryId = getCurrentGameKey(), l = LOTS[lotteryId];
    return rows.map((row, index) => ({ row, index }))
      .filter(({ row }) => row && (!row.lotteryId || row.lotteryId === lotteryId) && part(row.m, l.pM, l.mB) && part(l.pBo ? row.b : [], l.pBo || 0, l.bB))
      .map(({ row, index }) => ({ ...identify(row, lotteryId), index, m: [...row.m], b: [...(row.b || [])] }));
  }
  function choose(rowId) {
    const row = current().find(r => r.rowId === rowId);
    if (row) selected.set(row.lotteryId, rowId);
    return row || null;
  }
  function find(rowId) { return current().find(r => r.rowId === rowId) || null; }
  function resolve(ids) {
    const wanted = new Set(ids);
    return current().filter(r => wanted.has(r.rowId));
  }
  // Which of the complete rows every action works on. Only row ids are kept (per lottery, on this
  // device); the rows themselves are always read from the live ticket. No entry = ALL rows, so a
  // new generation, whatever its size, starts with every generated row selected.
  const SEL_KEY = 'loto_row_selection_v1';
  let marks = {};
  try { marks = JSON.parse(localStorage.getItem(SEL_KEY) || '{}') || {}; } catch (_e) { marks = {}; }
  function selectedIds() {
    const list = current(), ids = marks[getCurrentGameKey()];
    if (!Array.isArray(ids)) return list.map(r => r.rowId);
    const wanted = new Set(ids), kept = list.filter(r => wanted.has(r.rowId)).map(r => r.rowId);
    return kept.length ? kept : list.map(r => r.rowId);
  }
  function select(ids) {
    const game = getCurrentGameKey(), list = current();
    const wanted = new Set(Array.isArray(ids) ? ids : []);
    const kept = list.filter(r => wanted.has(r.rowId)).map(r => r.rowId);
    if (!Array.isArray(ids) || !kept.length || kept.length === list.length) delete marks[game]; else marks[game] = kept;
    try { localStorage.setItem(SEL_KEY, JSON.stringify(marks)); } catch (_e) {}
    window.dispatchEvent(new CustomEvent('loto:rowselection'));
    return selectedIds();
  }
  // «Ряды готовы» on the main screen: the entry to the action centre while the ticket has rows.
  function sync() {
    const bar = document.getElementById('rows-ready');
    if (!bar) return;
    const count = current().length;
    bar.hidden = !count;
    const n = bar.querySelector('.rows-ready-n');
    if (n && n.textContent !== String(count)) n.textContent = String(count);
  }
  // A new generation: every generated row is selected again, and the entry is lit until opened.
  function fresh() {
    delete marks[getCurrentGameKey()];
    try { localStorage.setItem(SEL_KEY, JSON.stringify(marks)); } catch (_e) {}
    document.getElementById('rows-ready')?.classList.add('pro-next-glow');
  }
  let actionsPromise = null;
  function actions() {
    if (window.LotoActionCenter) return Promise.resolve(window.LotoActionCenter);
    if (!actionsPromise) {
      const copy = Promise.resolve(window.LotoI18n?.loadPart?.('court')).catch(() => null);
      actionsPromise = Promise.all([copy, window.loadRuntimeScript('action-center.js')]).then(() => {
        if (!window.LotoActionCenter) throw new Error('action_center_missing');
        return window.LotoActionCenter;
      }).catch(error => { actionsPromise = null; throw error; });
    }
    return actionsPromise;
  }
  function finish() { window.dispatchEvent(new CustomEvent('loto:workingtoolclosed')); }
  function create() {
    window.dispatchEvent(new CustomEvent('loto:workingtoolcreate'));
    window.LotoCourtUI?.close();
    window.SUP_close?.();
    window.bottomNavRoute?.('sim');
    // The modal manager restores its opener on the next frame. Move focus to the
    // generator after that restoration, when the ticket is no longer inert.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const button=document.getElementById('generate-selected-rows');
      button?.scrollIntoView({ block: 'center' });
      button?.focus({ preventScroll: true });
    }));
  }
  window.LotoWorkingSet = Object.freeze({ identify, current, choose, find, resolve, finish, create,
    selectedIds, select, sync, fresh, actions,
    selected: () => resolve(selectedIds()),
    preferred: () => {
      const id=selected.get(getCurrentGameKey());
      return id&&find(id)?id:null;
    },
    open: kind => kind === 'judge' ? window.SUP_open?.('sim', { working: true })
      : kind === 'calendar' || kind === 'history' ? actions().then(ac => ac.open(kind))
      : window.LotoCourtUI?.openHome(kind, { kind: 'working' }),
  });
  // The ticket may already be rendered (and restored) before this file runs.
  try { sync(); } catch (_e) {}
})();
