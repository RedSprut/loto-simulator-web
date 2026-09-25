/* Smart Start — which lottery the app opens on. Pure, dependency-free, same file on Web, PWA and
 * both Capacitor shells (UMD like win-match-core.js, so tests/smart-start.mjs runs it in Node).
 *
 * Priority (first rule that yields a game wins):
 *   1. an explicit request — ?game=<id> / a notification's n_lot / lotosimulator://game/<id>;
 *   2. the user's own behaviour — lotteries they deliberately picked, one vote per app session,
 *      decayed by age, the most recent pick weighted up (see preferred());
 *   3. regional relevance for a user with no history, from the device TIME ZONE only:
 *      USA → Powerball / Mega Millions · Canada → Lotto Max · Italy → SuperEnalotto ·
 *      Australia → Powerball AU · Norway → Lotto / Vikinglotto / Eurojackpot · Europe → Eurojackpot;
 *      a region with several games takes the one whose draw is in progress, else the next one;
 *   4. Eurojackpot.
 * The interface language is never an input: an English UI in Oslo is still Norway.
 * Schedules are INJECTED (deadlineAfter, backed by index.html nextDraw over LOTS) so this file never
 * carries a second copy of the draw calendar. Only picks the caller records count as behaviour —
 * the start-up choice itself and notification/deep-link opens are never recorded.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LotoSmartStart = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'loto_smart_start_v1';
  const DEFAULT_GAME = 'euro';
  const MAX_SESSIONS = 40;              // picks kept (one per session); older ones stop mattering anyway
  const HALF_LIFE_DAYS = 30;            // a pick from a month ago counts half
  const LATEST_BONUS = 0.5;             // the last saved choice beats a single older pick, not a habit
  const CURRENT_WINDOW_MS = 3 * 3600e3; // deadline → results: the draw is "current" for this long
  const DAY_MS = 864e5;

  const REGION_GAMES = {
    US: ['powerball', 'mega'],
    CA: ['lottomax'],
    IT: ['superenalotto'],
    AU: ['powerballau'],
    NO: ['lotto', 'viking', 'euro'],
    EU: ['euro'],
  };

  // IANA zones of the countries that change the answer (canonical names + the legacy aliases some
  // engines still report). Everything else in Europe/* is EU; anything unknown falls to rule 4.
  const US_ZONES = ('New_York Detroit Kentucky/Louisville Kentucky/Monticello Louisville Fort_Wayne Indianapolis ' +
    'Indiana/Indianapolis Indiana/Vincennes Indiana/Winamac Indiana/Marengo Indiana/Petersburg Indiana/Vevay ' +
    'Indiana/Tell_City Indiana/Knox Knox_IN Chicago Menominee North_Dakota/Center North_Dakota/New_Salem ' +
    'North_Dakota/Beulah Denver Boise Shiprock Phoenix Los_Angeles Anchorage Juneau Sitka Metlakatla Yakutat ' +
    'Nome Adak Atka Puerto_Rico St_Thomas').split(' ').map(z => 'America/' + z)
    .concat(['Pacific/Honolulu', 'Navajo', 'US/Eastern', 'US/Central', 'US/Mountain', 'US/Pacific', 'US/Alaska',
      'US/Hawaii', 'US/Arizona', 'US/Michigan', 'US/East-Indiana', 'US/Indiana-Starke', 'US/Aleutian']);
  const CA_ZONES = ('Toronto Montreal Nipigon Thunder_Bay Rainy_River Atikokan Iqaluit Pangnirtung Winnipeg Resolute ' +
    'Rankin_Inlet Regina Swift_Current Edmonton Cambridge_Bay Yellowknife Inuvik Dawson_Creek Fort_Nelson Creston ' +
    'Vancouver Whitehorse Dawson Halifax Glace_Bay Moncton Goose_Bay St_Johns Blanc-Sablon').split(' ')
    .map(z => 'America/' + z)
    .concat(['Canada/Eastern', 'Canada/Central', 'Canada/Mountain', 'Canada/Pacific', 'Canada/Atlantic',
      'Canada/Newfoundland', 'Canada/Saskatchewan', 'Canada/Yukon']);
  const ZONE_REGION = {};
  US_ZONES.forEach(z => { ZONE_REGION[z] = 'US'; });
  CA_ZONES.forEach(z => { ZONE_REGION[z] = 'CA'; });
  ['Europe/Oslo', 'Arctic/Longyearbyen', 'Atlantic/Jan_Mayen'].forEach(z => { ZONE_REGION[z] = 'NO'; });
  ZONE_REGION['Europe/Rome'] = 'IT';

  /** Region code for an IANA time zone, or null when the zone says nothing useful (UTC, Asia/…). */
  function regionForTimeZone(tz) {
    tz = String(tz || '');
    if (ZONE_REGION[tz]) return ZONE_REGION[tz];
    if (/^Australia\//.test(tz)) return 'AU';
    if (/^Europe\//.test(tz) || /^Atlantic\/(Canary|Madeira|Azores|Faroe|Faeroe|Reykjavik)$/.test(tz)) return 'EU';
    return null;
  }

  // ── behaviour ─────────────────────────────────────────────────────────────────────────────
  function load(storage) {
    try {
      const raw = storage && storage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      const picks = data && Array.isArray(data.picks) ? data.picks : [];
      return { v: 1, picks: picks.filter(p => p && typeof p.g === 'string' && Number.isFinite(p.t)) };
    } catch (e) { return { v: 1, picks: [] }; }
  }
  function save(storage, state) {
    try { storage && storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  /** One vote per session: re-picking within the same session moves that session's vote. */
  function recordPick(state, game, now, sessionId) {
    const picks = (state && state.picks ? state.picks : []).slice();
    const last = picks[picks.length - 1];
    if (last && sessionId && last.s === sessionId) picks.pop();
    picks.push({ g: String(game), t: now, s: sessionId || '' });
    return { v: 1, picks: picks.slice(-MAX_SESSIONS) };
  }
  /** The lottery the user's own picks point to, or null with no usable history. */
  function preferred(state, now, validIds) {
    const picks = (state && state.picks || []).filter(p => !validIds || validIds.indexOf(p.g) >= 0);
    if (!picks.length) return null;
    const score = {}, latestAt = {};
    picks.forEach(p => {
      const age = Math.max(0, now - p.t) / DAY_MS;
      score[p.g] = (score[p.g] || 0) + Math.pow(0.5, age / HALF_LIFE_DAYS);
      latestAt[p.g] = Math.max(latestAt[p.g] || 0, p.t);
    });
    const newest = picks.reduce((a, b) => (b.t >= a.t ? b : a));
    score[newest.g] += LATEST_BONUS;
    return Object.keys(score).sort((a, b) => (score[b] - score[a]) || (latestAt[b] - latestAt[a]))[0];
  }

  // ── region ────────────────────────────────────────────────────────────────────────────────
  /** Among a region's games: the draw in progress (deadline passed < CURRENT_WINDOW_MS ago), else
   *  the nearest upcoming deadline. deadlineAfter(id, ms) → ms of the first deadline after ms. */
  function pickBySchedule(games, now, deadlineAfter) {
    if (games.length < 2 || typeof deadlineAfter !== 'function') return games[0] || null;
    let current = null, currentAt = -Infinity, next = null, nextAt = Infinity;
    games.forEach(id => {
      let recent, upcoming;
      try { recent = +deadlineAfter(id, now - CURRENT_WINDOW_MS); upcoming = +deadlineAfter(id, now); } catch (e) { return; }
      if (Number.isFinite(recent) && recent <= now && recent > currentAt) { current = id; currentAt = recent; }
      if (Number.isFinite(upcoming) && upcoming < nextAt) { next = id; nextAt = upcoming; }
    });
    return current || next || games[0];
  }

  /**
   * opts: { ids, explicit, history, timeZone, now, deadlineAfter }
   * → { game, reason: 'explicit'|'history'|'region'|'default', region }
   */
  function resolve(opts) {
    opts = opts || {};
    const ids = Array.isArray(opts.ids) && opts.ids.length ? opts.ids : null;
    const valid = id => !!id && (!ids || ids.indexOf(id) >= 0);
    const now = Number.isFinite(opts.now) ? opts.now : Date.now();
    const fallback = valid(DEFAULT_GAME) ? DEFAULT_GAME : (ids ? ids[0] : DEFAULT_GAME);
    if (valid(opts.explicit)) return { game: opts.explicit, reason: 'explicit', region: null };
    const liked = preferred(opts.history, now, ids);
    if (valid(liked)) return { game: liked, reason: 'history', region: null };
    const region = regionForTimeZone(opts.timeZone);
    const games = region ? REGION_GAMES[region].filter(valid) : [];
    const regional = pickBySchedule(games, now, opts.deadlineAfter);
    if (valid(regional)) return { game: regional, reason: 'region', region };
    return { game: fallback, reason: 'default', region };
  }

  return {
    STORAGE_KEY, DEFAULT_GAME, MAX_SESSIONS, HALF_LIFE_DAYS, CURRENT_WINDOW_MS, REGION_GAMES,
    regionForTimeZone, load, save, recordPick, preferred, pickBySchedule, resolve,
  };
});
