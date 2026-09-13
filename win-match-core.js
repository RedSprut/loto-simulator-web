/* Win/Match core — pure, dependency-free logic for the personal result-match system.
 *
 * WHY a separate UMD module: the matching/dedup/retention/target-draw/classification logic must
 * be unit-testable in Node (the 15-case matrix in tests/win-match.mjs) AND run in the browser/
 * native WebView. It holds NO DOM and NO app-scope references; the per-game prize rule
 * (checkPrize) and game schedule are INJECTED by the caller so this file never diverges from the
 * app's real rules. index.html owns the DOM/notification/detail UI and the localStorage bridge.
 *
 * Product-safety contract enforced here:
 *   - a row is classified played | saved | generated; only `played` may later be shown as a WIN.
 *   - a row matches ONLY the exact draw it was associated with (no retroactive/arbitrary-draw wins).
 *   - wrong game / wrong draw / already-processed draw never match.
 *   - only user-visible playable rows are stored (caller passes those; internal trials never reach here).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LotoWinMatchCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const HISTORY_KEY = 'loto_row_history_v2';
  const MATCH_KEY = 'loto_match_records_v2';
  const MAX_ROWS = 400;                 // bounded storage (generated rows are capped; saved/played kept)
  const POST_DRAW_RETAIN_DAYS = 7;      // keep a generated row >= 7 days after its processed draw
  const NO_TARGET_RETAIN_DAYS = 30;     // generated row with no known target draw
  const MS_DAY = 86400000;

  const sortNums = (a) => (Array.isArray(a) ? a.slice() : [])
    .map(Number).filter((n) => Number.isFinite(n)).sort((x, y) => x - y);

  function rowSignature(gameId, main, bonus, targetDrawDate, targetDrawId) {
    return [gameId, sortNums(main).join('-'), sortNums(bonus).join('-'), targetDrawDate || '', targetDrawId == null ? '' : targetDrawId].join('|');
  }
  let __seq = 0;
  function makeId() { return 'r' + Date.now().toString(36) + (__seq++).toString(36) + Math.random().toString(36).slice(2, 6); }

  // played > saved > generated. Only 'played' is ever presented as a monetary WIN.
  function classify(entry) {
    if (entry && entry.played) return 'played';
    if (entry && entry.saved) return 'saved';
    return 'generated';
  }

  // ── target-draw association (DST-safe, per game tz/schedule; mirrors audit-freshness) ──
  function partsInTz(date, tz) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit' }).formatToParts(date);
    const g = (t) => (p.find((x) => x.type === t) || {}).value;
    const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[g('weekday')];
    return { ymd: `${g('year')}-${g('month')}-${g('day')}`, weekday: wd, hm: `${g('hour')}:${g('minute')}` };
  }
  // The upcoming draw a row created at `now` is aimed at: the next scheduled weekday whose
  // result time has NOT yet passed today. Never returns a past date → no retroactive wins.
  function nextDrawDate(schedule, now) {
    if (!schedule || !Array.isArray(schedule.days) || !schedule.days.length) return null;
    const base = now instanceof Date ? now : new Date(now);
    for (let i = 0; i <= 14; i++) {
      const c = partsInTz(new Date(base.getTime() + i * MS_DAY), schedule.tz);
      if (!schedule.days.includes(c.weekday)) continue;
      if (i === 0 && schedule.time && c.hm >= schedule.time) continue; // today's draw already closed
      return c.ymd;
    }
    return null;
  }

  // ── record user-visible playable rows (dedup + origin) ──
  function recordRows(store, gameId, rows, origin, ctx) {
    const now = (ctx && ctx.now) || Date.now();
    const target = (ctx && ctx.targetDrawDate) || null;
    const targetDrawId = ctx && ctx.targetDrawId != null ? ctx.targetDrawId : null;
    const out = Array.isArray(store) ? store.slice() : [];
    for (const r of (rows || [])) {
      const main = sortNums(r.m || r.main || []);
      const bonus = sortNums(r.b || r.bonus || []);
      if (!main.length) continue; // not a real playable row (never store partials/internal trials)
      const sig = rowSignature(gameId, main, bonus, target, targetDrawId);
      const existing = out.find((e) => e.sig === sig);
      if (existing) {
        // dedup: keep earliest createdAt + strongest status; upgrade generic origin to a real one
        if (origin && origin.saved) existing.saved = true;
        if (origin && origin.played) existing.played = true;
        if (origin && origin.source && origin.source !== 'generator' && (!existing.source || existing.source === 'generator')) {
          existing.source = origin.source; existing.sourceLabel = origin.sourceLabel || existing.sourceLabel; existing.modelId = origin.modelId || existing.modelId;
        }
        continue;
      }
      out.unshift({
        id: makeId(), sig, gameId, main, bonus,
        createdAt: now,
        source: (origin && origin.source) || 'generator',
        sourceLabel: (origin && origin.sourceLabel) || null,
        modelId: (origin && origin.modelId) || null,
        saved: !!(origin && origin.saved),
        played: !!(origin && origin.played),
        targetDrawDate: target,
        targetDrawId,
        lastMatchedDrawDate: null,
      });
    }
    return out;
  }

  // ── retention: temp generated rows expire; saved/played survive; bounded ──
  function retentionCleanup(store, now) {
    now = now || Date.now();
    const list = Array.isArray(store) ? store.slice() : [];
    const kept = list.filter((e) => {
      if (e.played || e.saved) return true; // NEVER purge saved/played by temp cleanup
      if (e.targetDrawDate) {
        const drawTs = Date.parse(e.targetDrawDate + 'T23:59:59Z');
        if (Number.isFinite(drawTs)) return drawTs + POST_DRAW_RETAIN_DAYS * MS_DAY >= now;
      }
      return e.createdAt >= now - NO_TARGET_RETAIN_DAYS * MS_DAY;
    });
    const priority = kept.filter((e) => e.played || e.saved);
    const temp = kept.filter((e) => !(e.played || e.saved))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(0, MAX_ROWS - priority.length));
    return priority.concat(temp).sort((a, b) => b.createdAt - a.createdAt);
  }

  // ── matching (false-positive guards) ──
  function eligibleForDraw(entry, draw) {
    if (!entry || !draw) return false;
    if (entry.gameId !== draw.gameId) return false;          // wrong game never matches
    if (!entry.targetDrawDate) return false;                 // must be associated with a draw
    if (entry.targetDrawDate !== draw.date) return false;    // ONLY the exact associated draw (no stale/retroactive)
    if (entry.targetDrawId != null && draw.drawId != null && String(entry.targetDrawId) !== String(draw.drawId)) return false;
    if (entry.lastMatchedDrawDate === draw.date) return false; // already processed → no repeat
    return true;
  }
  function matchEntry(entry, draw, gameRule, checkPrizeFn) {
    if (!Array.isArray(draw.main) || !draw.main.length) return null;
    if (!Array.isArray(entry.main) || !entry.main.length) return null;
    // guard: a user row is never the official row object itself
    if (entry === draw) return null;
    const prize = checkPrizeFn(entry.main, entry.bonus || [], draw.main, draw.bonus || [], gameRule);
    if (!prize) return null;
    const mainHit = entry.main.filter((n) => draw.main.includes(n)).length;
    const bonusHit = (entry.bonus || []).filter((n) => (draw.bonus || []).includes(n)).length;
    return {
      id: 'm_' + entry.id + '_' + draw.date,
      rowId: entry.id, gameId: entry.gameId, drawDate: draw.date, drawId: draw.drawId != null ? draw.drawId : null,
      userMain: entry.main.slice(), userBonus: (entry.bonus || []).slice(),
      drawMain: draw.main.slice(), drawBonus: (draw.bonus || []).slice(),
      mainHit, bonusHit,
      tier: prize.name || null, tierKey: prize.key || null, level: prize.lvl || 0,
      kind: classify(entry),
      source: entry.source, sourceLabel: entry.sourceLabel, modelId: entry.modelId,
      createdAt: entry.createdAt, saved: !!entry.saved, played: !!entry.played,
      payout: null, payoutState: 'pending',
      notifiedAt: null,
    };
  }
  // Scans one official draw against history; MUTATES entries' lastMatchedDrawDate (dedup) and returns new matches.
  function scanDrawAgainstHistory(store, draw, gameRule, checkPrizeFn) {
    const matches = [];
    for (const e of (store || [])) {
      if (!eligibleForDraw(e, draw)) continue;
      const m = matchEntry(e, draw, gameRule, checkPrizeFn);
      e.lastMatchedDrawDate = draw.date; // processed regardless of prize → no repeat scans
      if (m) matches.push(m);
    }
    return matches;
  }

  function summarize(matches) {
    const list = matches || [];
    const played = list.filter((m) => m.kind === 'played');
    const nonplayed = list.filter((m) => m.kind !== 'played');
    return { total: list.length, playedWins: played.length, generatedMatches: nonplayed.length, played, nonplayed };
  }

  // Notification identity — stable per (game, draw, row, kind) so reload/restart never re-notifies.
  function notificationKey(m) { return [m.gameId, m.drawDate, m.rowId, m.played ? 'win' : 'match'].join('|'); }

  return {
    HISTORY_KEY, MATCH_KEY, MAX_ROWS, POST_DRAW_RETAIN_DAYS, NO_TARGET_RETAIN_DAYS,
    sortNums, rowSignature, makeId, classify, partsInTz, nextDrawDate,
    recordRows, retentionCleanup, eligibleForDraw, matchEntry, scanDrawAgainstHistory,
    summarize, notificationKey,
  };
});
