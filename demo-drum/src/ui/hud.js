/**
 * Heads-up UI (Russian). The machine is the hero: a primary button (bottom
 * centre), a data-driven results row (top centre, one labelled group per pool),
 * and a compact settings gear (bottom right) with a temporary game-profile
 * selector + quality + reset. Diagnostic meters appear only with ?debug=1.
 * The HUD owns no simulation logic — it reads state and emits intents.
 */
import { State } from '../sim/draw.js';
import { GAME_PROFILES } from '../games.js';
import { t, onLocaleChange } from '../i18n/index.js';
import { gameChipStyles } from './chips.js';

export class HUD {
  constructor(root, handlers, { debug = false, profileKey = '' } = {}) {
    this.h = handlers; // {onStart, onReset, onQuality, onProfile}
    this.root = root;
    this.debug = debug;
    this.groups = {}; // poolId → {ballsEl}
    this._build(profileKey);
  }

  _build(profileKey) {
    // Themed game-name header (per-game gradient), safe-area aware, above the results.
    this.gameHead = document.createElement('div');
    this.gameHead.className = 'dd-gamehead';
    this.gameHead.setAttribute('role', 'heading');
    this.gameHead.setAttribute('aria-level', '1');

    this.results = document.createElement('div');
    this.results.className = 'dd-results';

    this.startBtn = document.createElement('button');
    this.startBtn.className = 'dd-primary';
    this.startBtn.onclick = () => { if (!this.startBtn.disabled) this.h.onStart?.(); };

    this.setBtn = document.createElement('button');
    this.setBtn.className = 'dd-gear';
    this.setBtn.textContent = '⚙️'; // full gear emoji: crisp, filled, balanced with the speaker

    // Sound toggle — FOUR unambiguous states driven by the REAL AudioContext, not
    // just a stored preference (see _syncSoundButton): off / on / playing / blocked.
    this._sound = { muted: false, running: false };
    this._soundPlaying = false;
    this._soundState = 'blocked';
    this.muteBtn = document.createElement('button');
    this.muteBtn.className = 'dd-mute';
    this.muteBtn.type = 'button';
    this.muteBtn.textContent = '🔊'; // the original speaker glyph; state = CSS class only
    this.muteBtn.onclick = () => {
      // Semantics depend on the current honest state:
      //  • off      → unmute + request a gesture unlock (turn sound on)
      //  • blocked  → request a gesture unlock (browser hasn't allowed audio yet)
      //  • on/play  → mute
      const st = this._soundState;
      if (st === 'off') { this.setMuted(false); this.h.onMute?.(false); this.h.onUnlock?.(); }
      else if (st === 'blocked') { this.h.onUnlock?.(); }
      else { this.setMuted(true); this.h.onMute?.(true); }
    };
    this._syncSoundButton();

    this.panel = document.createElement('div');
    this.panel.className = 'dd-panel hidden';
    const profileOptions = Object.entries(GAME_PROFILES)
      .map(([k, p]) => `<option value="${k}"${k === profileKey ? ' selected' : ''}>${p.label}</option>`).join('');
    // Labels use data-i18n so _applyStrings() can re-localize the whole panel
    // live (host language change) without rebuilding the selects or losing state.
    this.panel.innerHTML = `
      <div class="dd-panel__head">
        <h3 data-i18n="settings.title"></h3>
        <button class="dd-close" type="button" data-close><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6 18 18M18 6 6 18"/></svg></button>
      </div>
      <div class="dd-panel__content">
        <label class="dd-row"><span data-i18n="settings.game"></span>
          <select data-profile>${profileOptions}</select>
        </label>
        <label class="dd-row"><span data-i18n="settings.quality"></span>
          <select data-q>
            <option value="auto" data-i18n="q.auto"></option>
            <option value="ultra" data-i18n="q.ultra"></option>
            <option value="high" data-i18n="q.high"></option>
            <option value="medium" data-i18n="q.medium"></option>
            <option value="low" data-i18n="q.low"></option>
          </select>
        </label>
        <button class="dd-reset" data-reset data-i18n="settings.reset"></button>
        <p class="dd-note" data-i18n="settings.note"></p>
      </div>
    `;
    this.setBtn.onclick = () => this._togglePanel();
    this.panel.querySelector('[data-close]').onclick = () => this._closePanel();
    // Game change: apply the profile + theme FIRST, then close the panel — the user
    // sees the game/colours change and the panel dismiss itself in one action.
    this.panel.querySelector('[data-profile]').onchange = (e) => { this.h.onProfile?.(e.target.value); this._closePanel(); };
    this.panel.querySelector('[data-q]').onchange = (e) => this.h.onQuality?.(e.target.value);
    this.panel.querySelector('[data-reset]').onclick = () => { this._closePanel(); this.h.onReset?.(); };

    this.root.append(this.gameHead, this.results, this.startBtn, this.muteBtn, this.setBtn, this.panel);
    this.root.addEventListener('pointerdown', () => this.h.onUserGesture?.(), { capture: true });

    // Localize every static string now, and re-localize live when the host app
    // changes language (postMessage → setLocale → onLocaleChange).
    this._applyStrings();
    this._unlisten = onLocaleChange(() => this._applyStrings());

    // Keep the result chips fitting one line as the viewport changes.
    const onResize = () => this._sizeChips();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    if (this.debug) {
      this.meters = document.createElement('div');
      this.meters.className = 'dd-meters';
      this.fpsEl = document.createElement('span');
      this.physEl = document.createElement('span');
      this.stateEl = document.createElement('span');
      this.actEl = document.createElement('span');
      this.meters.append(this.fpsEl, this.physEl, this.stateEl, this.actEl);
      this.counts = document.createElement('pre');
      this.counts.className = 'dd-counts';
      this.root.append(this.meters, this.counts);
    }
  }

  /** (Re)localize every static string. Safe to call any time (initial build and
   *  on live host-language change). Re-applies the current phase button text and
   *  the result-group labels of the current profile so nothing stays stale. */
  _applyStrings() {
    this.setBtn.setAttribute('aria-label', t('aria.settings'));
    const cl = this.panel.querySelector('[data-close]'); if (cl) cl.setAttribute('aria-label', t('settings.close'));
    this.panel.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    this._syncSoundButton();
    this.setPhase(this._state ?? State.IDLE, this._winner);
    if (this._profile) this._relabelGroups(this._profile);
  }

  // Settings panel open/close — one visible panel, X (or Escape / browser Back)
  // closes it without changing the game, and selecting a game auto-closes it.
  _togglePanel() { if (this.panel.classList.contains('hidden')) this._openPanel(); else this._closePanel(); }
  _openPanel() {
    this.panel.classList.remove('hidden');
    // Android hardware Back / browser Back closes the panel BEFORE the whole overlay.
    try { history.pushState({ ddPanel: 1 }, ''); } catch (e) {}
    this._pop = () => { if (!this.panel.classList.contains('hidden')) this._closePanel(true); };
    window.addEventListener('popstate', this._pop);
    this._esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); this._closePanel(); } };
    document.addEventListener('keydown', this._esc);
    const c = this.panel.querySelector('[data-close]'); if (c) setTimeout(() => { try { c.focus(); } catch (e) {} }, 0);
  }
  _closePanel(fromPop) {
    if (this.panel.classList.contains('hidden')) return;
    this.panel.classList.add('hidden');
    if (this._esc) { document.removeEventListener('keydown', this._esc); this._esc = null; }
    if (this._pop) {
      window.removeEventListener('popstate', this._pop); this._pop = null;
      if (!fromPop) { try { if (history.state && history.state.ddPanel) history.back(); } catch (e) {} }
    }
    try { this.setBtn.focus(); } catch (e) {}
  }

  /** Refresh only the result-group label text for a profile (no DOM rebuild). */
  _relabelGroups(profile) {
    profile.resultLayout.groups.forEach((g) => {
      const grp = this.groups[g.pool];
      if (grp?.labelEl) grp.labelEl.textContent = t(g.labelKey);
    });
  }

  /** Detach the locale listener (called if the HUD is ever torn down). */
  destroy() { this._unlisten?.(); }

  setMuted(muted) {
    this._sound.muted = !!muted;
    this._syncSoundButton();
  }

  /** Real audio status from the AudioManager (ctx state + mute), incl. statechange. */
  setSoundStatus(status) {
    this._sound = { muted: !!status?.muted, running: !!status?.running };
    this._syncSoundButton();
  }

  /** One gentle, non-blocking "sound is off" hint at the top (aria-live=polite),
   *  shown at most once per 3D session on the first draw while sound is still off.
   *  It never dims the screen, blocks the draw, or covers the header/nav/safe-area. */
  showSoundOffHint() {
    if (this._soundHint) this._soundHint.remove();
    const el = document.createElement('div');
    el.className = 'dd-soundhint';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.textContent = t('sound.offHint');
    this.root.appendChild(el);
    this._soundHint = el;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(this._soundHintTimer);
    this._soundHintTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { if (el === this._soundHint) { el.remove(); this._soundHint = null; } }, 320);
    }, 4500);
  }

  /** Whether a sound is ACTUALLY being produced right now (drives the pulse). */
  setSoundActivity(playing) {
    const p = !!playing;
    if (p === this._soundPlaying) return;
    this._soundPlaying = p;
    if (this._soundState === 'on' || this._soundState === 'playing') this._syncSoundButton();
  }

  /** Resolve the honest four-state button from the real AudioContext + mute + activity.
   *   off      — muted by the user (crossed speaker, red slash, dimmed)
   *   blocked  — not muted but the ctx isn't running yet (needs a gesture)
   *   on       — not muted and the ctx is genuinely running (accent, waves)
   *   playing  — on AND a sound is being produced this instant (waves pulse) */
  _syncSoundButton() {
    const { muted, running } = this._sound;
    let state;
    if (muted) state = 'off';
    else if (running) state = this._soundPlaying ? 'playing' : 'on';
    else state = 'blocked';
    this._soundState = state;

    const btn = this.muteBtn;
    btn.classList.toggle('is-off', state === 'off');
    btn.classList.toggle('is-blocked', state === 'blocked');
    btn.classList.toggle('is-on', state === 'on' || state === 'playing');
    btn.classList.toggle('is-playing', state === 'playing');
    // aria-pressed = "is sound currently on?" — true only for a genuinely running ctx.
    btn.setAttribute('aria-pressed', String(state === 'on' || state === 'playing'));
    const label = state === 'off' ? t('sound.enable')
      : state === 'blocked' ? t('sound.allow')
        : t('sound.on');
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  /** Per-pool ball-conservation counter (debug only). Turns red if math breaks. */
  setCounts(poolCounts) {
    if (!this.debug || !this.counts) return;
    let bad = false;
    const lines = poolCounts.map((c) => {
      if (!c.valid) bad = true;
      return `${c.poolId.toUpperCase()}: initial ${c.initial}  inside ${c.inside}  transit ${c.transit}  rack ${c.rack}  removed ${c.removed}  total ${c.total}  valid ${c.valid ? 'yes' : 'NO'}`;
    });
    this.counts.textContent = lines.join('\n');
    this.counts.dataset.bad = bad ? '1' : '0';
  }

  /** Set the game name shown in the themed header. */
  setGameName(name) { if (this.gameHead) this.gameHead.textContent = name || ''; }

  /** Rebuild the results row for a profile: main group on its own single line,
   *  each bonus group stacked BELOW on its own line (hidden until it has balls). */
  buildLayout(profile) {
    this._profile = profile;
    this.results.innerHTML = '';
    this.groups = {};
    this.mainCount = profile.resultLayout.groups[0]?.slotCount || 6;
    profile.resultLayout.groups.forEach((g, i) => {
      const wrap = document.createElement('div');
      wrap.className = `dd-result-group${i > 0 ? ' bonus empty' : ''}`;
      wrap.dataset.pool = g.pool;
      const label = document.createElement('div');
      label.className = 'dd-result-group__label';
      label.textContent = t(g.labelKey);     // labelKey → active locale (never raw text)
      const balls = document.createElement('div');
      balls.className = 'dd-result-group__balls';
      wrap.append(label, balls);
      this.results.appendChild(wrap);
      this.groups[g.pool] = { wrap, ballsEl: balls, labelEl: label, bonus: i > 0 };
    });
    this._sizeChips();
  }

  /** Fill chips; bonus rows stay hidden until they actually have a ball. */
  setResults(resultsByPool) {
    const styles = gameChipStyles();
    for (const [poolId, group] of Object.entries(this.groups)) {
      group.ballsEl.innerHTML = '';
      const vals = resultsByPool[poolId] || [];
      const st = group.bonus ? styles.bonus : styles.main;
      for (const v of vals) {
        const chip = document.createElement('div');
        chip.className = `dd-chip pop${group.bonus ? ' bonus' : ''}`;
        chip.textContent = v;
        chip.style.background = st.bg; chip.style.color = st.fg;
        group.ballsEl.appendChild(chip);
      }
      if (group.bonus) group.wrap.classList.toggle('empty', vals.length === 0);
    }
  }

  /** Sort each result group ascending, animating chips to their new spots (FLIP).
   *  Only the top UI reorders — the physical rack keeps the real draw order. */
  sortResults(animate = true) {
    for (const group of Object.values(this.groups)) {
      const el = group.ballsEl;
      const chips = [...el.children];
      if (chips.length < 2) continue;
      const firstLeft = animate ? new Map(chips.map((c) => [c, c.getBoundingClientRect().left])) : null;
      chips.sort((a, b) => Number(a.textContent) - Number(b.textContent));
      for (const c of chips) el.appendChild(c); // reorder the DOM (final = sorted)
      if (!animate) continue;
      for (const c of chips) { // invert: offset each chip back to where it was
        const dx = firstLeft.get(c) - c.getBoundingClientRect().left;
        c.style.transition = 'none';
        c.style.transform = `translateX(${dx}px)`;
      }
      requestAnimationFrame(() => {
        for (const c of chips) {
          c.style.transition = 'transform 620ms cubic-bezier(.4,0,.2,1)';
          c.style.transform = 'translateX(0)';
        }
      });
    }
  }

  /** Size the result chips so the main group always fits on ONE line. */
  _sizeChips() {
    const vw = Math.min(window.visualViewport?.width || window.innerWidth, 660);
    const n = Math.max(this.mainCount || 6, 1);
    const size = Math.max(20, Math.min(40, (vw - 40 - (n - 1) * 7) / n));
    this.results.style.setProperty('--chip', `${size.toFixed(1)}px`);
  }

  setPhase(state, winner) {
    this._state = state; this._winner = winner;   // remembered so _applyStrings() can re-localize live
    const b = this.startBtn;
    switch (state) {
      case State.IDLE: b.textContent = t('action.start'); b.disabled = false; break;
      case State.STARTUP:
      case State.MIXING:
      case State.RELOAD: b.textContent = t('status.mixing'); b.disabled = true; break;
      case State.ARMING:
      case State.CAPTURING: b.textContent = t('status.selecting'); b.disabled = true; break;
      case State.TRANSIT:
      case State.DISPLAY:
      case State.STOPPING:
      case State.FINAL_SETTLING: b.textContent = winner != null ? t('status.ball', winner) : t('status.selecting'); b.disabled = true; break;
      case State.COMPLETE: b.textContent = t('action.new'); b.disabled = false; break;
      default: break;
    }
  }

  setMeters(fps, bodies, state, activity) {
    if (!this.debug) return;
    this.fpsEl.textContent = `${Math.round(fps)} FPS`;
    this.fpsEl.dataset.warn = fps < 40 ? '1' : '0';
    this.physEl.textContent = `${bodies} balls`;
    this.stateEl.textContent = String(state).toUpperCase();
    this.actEl.textContent = `mix ${Math.round(activity * 100)}%`;
    this.actEl.dataset.warn = state === State.MIXING && activity < 0.55 ? '1' : '0';
  }
}
