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
    preferred: () => {
      const id=selected.get(getCurrentGameKey());
      return id&&find(id)?id:null;
    },
    open: kind => kind === 'judge' ? window.SUP_open?.('sim', { working: true }) : window.LotoCourtUI?.openHome(kind, { kind: 'working' }),
  });
})();
