/**
 * Host combination store — the PRODUCTION adapter.
 *
 * The drum runs as a same-origin iframe inside the main Loto Simulator. It must NOT
 * keep its own localStorage list (that would be a second, incompatible store). Instead
 * this adapter is a thin bridge to the host app's real saved-combinations storage
 * (local for a guest, account-synced for a signed-in user) and its real PRO paywall.
 *
 * It exposes the SAME synchronous interface the save-prompt already depends on
 * (limit / isPro / list / count / canAdd / add / replace / remove / openPaywall), backed
 * by a cached snapshot the host pushes over postMessage (APP_FAVORITES). Mutations post a
 * message to the host, which is authoritative: the host enforces the real FREE limit,
 * dedupes, writes to the real store and pushes a fresh snapshot back.
 *
 * Protocol (drum → host): DRUM_REQUEST_FAVORITES, DRUM_SAVE_COMBINATION{combo},
 *   DRUM_REPLACE_COMBINATION{oldId,combo}, DRUM_REMOVE_COMBINATION{id}, DRUM_OPEN_PAYWALL.
 * Protocol (host → drum): APP_FAVORITES{limit,isPro,list:[{id,lotteryId,lotteryName,
 *   main[],additional[],date,source,resultId}]}, APP_SAVE_RESULT{status}.
 */
export function createHostCombinationStore({ post, defaultLimit = 3 } = {}) {
  // Cached, host-authoritative snapshot. Starts empty; the host pushes the real one
  // on drum open and after every change.
  let snap = { limit: defaultLimit, isPro: false, list: [] };
  let changeCb = null;
  let resultCb = null;

  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'APP_FAVORITES') {
      snap = {
        limit: Number.isFinite(d.limit) ? d.limit : defaultLimit,
        isPro: !!d.isPro,
        list: Array.isArray(d.list) ? d.list : [],
      };
      changeCb && changeCb(snap);
    } else if (d.type === 'APP_SAVE_RESULT') {
      resultCb && resultCb(d.status || 'saved');
    }
  });

  // Ask the host for the current snapshot right away (and again is cheap/idempotent).
  post('DRUM_REQUEST_FAVORITES');

  return {
    get limit() { return snap.limit; },
    isPro() { return snap.isPro; },
    list() { return snap.list; },
    count() { return snap.list.length; },
    canAdd() { return snap.isPro || snap.list.length < snap.limit; },
    add(combo) { post('DRUM_SAVE_COMBINATION', { combo }); return { ok: true, pending: true }; },
    replace(oldId, combo) { post('DRUM_REPLACE_COMBINATION', { oldId, combo }); return { ok: true, pending: true }; },
    remove(id) { post('DRUM_REMOVE_COMBINATION', { id }); },
    openPaywall(combo) { post('DRUM_OPEN_PAYWALL', combo ? { combo } : {}); },
    // Real production engines, run by the host on the exact saved rows (per-feature
    // server-authoritative budgets + paywall live in the host — never re-implemented here).
    judge(combo) { post('DRUM_JUDGE_COMBINATION', { combo }); },
    consensus(combo) { post('DRUM_CONSENSUS_COMBINATION', { combo }); },
    // Bulk transfer of selected saved combinations to the main screen's top rows.
    bulkApply(lotteryId, combos, labels) { post('DRUM_BULK_APPLY', { lotteryId, combos, labels }); },
    /** Notified when the host pushes a fresh snapshot (list/limit/isPro changed). */
    onChange(fn) { changeCb = fn; },
    /** Notified with the host's authoritative result of a save/replace attempt. */
    onResult(fn) { resultCb = fn; },
  };
}
