/**
 * AudioManager — the isolated audio layer over the SAME Three.js + Rapier stack.
 *
 * The PHYSICAL architecture is unchanged and correct:
 *   Rapier contact-force event → real contact force → AudioManager → a sample voice.
 * What plays is a REAL RECORDED sample (a physical plastic/polymer lottery-ball hit),
 * loaded from local assets — NEVER a synthesised tone or noise burst. There is no
 * oscillator / sine / noise-crack generation anywhere in here.
 *
 * Samples are grouped into a few acoustic PROFILES (lightPlastic / softPolymer /
 * neutralLotteryBall / simulatedPhysical) and each of the 9 games is assigned a profile
 * (GAME_AUDIO_PROFILE). Ball count is NEVER a volume multiplier: many balls ⇒ Rapier
 * reports more contacts ⇒ a denser mix; fewer balls ⇒ fewer contacts ⇒ it thins out.
 *
 * If the local sample bank is empty (no assets have been added yet), EVERY play path is
 * a silent no-op — deliberately: silence is better than a bad synthesised sound. Drop
 * real CC0/licensed recordings into assets/audio/lottery/** and list them in
 * assets/audio/lottery/manifest.json (see AUDIO_SOURCES.md) and they light up with no
 * code change.
 */
import { AudioContext as ThreeAudioContext } from 'three';

/**
 * An AudioContext explicitly asked for the smallest practical output buffer.
 * three.js builds its context with `new AudioContext()` and no options, which on
 * some engines lands on a playback-sized buffer — every sound then trails its
 * physical event by that buffer. Sound here is bound to physical events, so ask
 * for the interactive profile up front. Creating (not resuming) a context needs
 * no user gesture, so this stays autoplay-safe.
 */
export function createDrumAudioContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { return new Ctor({ latencyHint: 'interactive' }); } catch (e) { return new Ctor(); }
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const rnd = (a, b) => a + Math.random() * (b - a);

// Each of the 9 games → one acoustic profile (see AUDIO_SOURCES.md for the reasoning).
export const GAME_AUDIO_PROFILE = {
  lotto: 'neutralLotteryBall', vikinglotto: 'neutralLotteryBall', eurojackpot: 'softPolymer',
  powerball: 'lightPlastic', megaMillions: 'lightPlastic', euroMillions: 'neutralLotteryBall',
  superEnalotto: 'softPolymer', lottoMax: 'simulatedPhysical', powerballAustralia: 'neutralLotteryBall',
};
const DEFAULT_PROFILE = 'neutralLotteryBall';
// Profile → asset sub-folder (real recordings live here; several profiles may share a folder).
const PROFILE_DIR = { lightPlastic: 'plastic', softPolymer: 'soft-polymer', neutralLotteryBall: 'neutral', simulatedPhysical: 'neutral' };
const AUDIO_BASE = new URL('../../assets/audio/lottery/', import.meta.url).href;

export class AudioManager {
  constructor(listener) {
    this.listener = listener;
    this.ctx = listener.context;
    this.enabled = false;
    this.loaded = false;
    this.muted = false;
    this.started = false;
    this.needsUserUnlock = true;
    this.onStatusChange = null;

    // Sample banks per asset folder: { dir: { ballBall:[AudioBuffer], ballWall, exit, rack } }.
    this.banks = {};
    this.mechBuffer = null;         // optional clean rotor/drum recording (looped, quiet)
    this.dir = PROFILE_DIR[DEFAULT_PROFILE];

    this.MAX_VOICES = 4;
    this.activeVoices = 0;
    this.lastHitAt = 0;

    // ── One timeline shared with the simulation ──────────────────────────────
    // Every sound belongs to a SIMULATION instant, not to the wall-clock moment
    // the JS happened to run. main.js advances physics on a fixed 1/60 step and
    // may run several steps inside one animation frame to catch up after a hitch;
    // `_epoch` maps that sim clock onto the audio clock so each voice is
    // scheduled at its own moment instead of every voice in the burst starting
    // at once. See `beginStep`.
    this._simTime = 0;
    this._epoch = null;      // ctx time that corresponds to simTime 0
    this._blockAt = -1;      // ctx time of the JS block the epoch was taken in
    // A catch-up burst is at most 5 steps (main.js), i.e. 83 ms of simulation; this
    // caps how far ahead of the audio clock a burst may ever schedule.
    this.MAX_AHEAD = 0.1;

    this.mech = null;               // {src, gain} once a mechanism recording exists
    this._loadPromise = null;
    this._bindContext(this.ctx);
    // Fetch and decode the samples NOW, before any gesture. decodeAudioData works
    // on a suspended context, so this costs nothing in autoplay terms and does not
    // make a sound — but it means the bank is ready when the first ball actually
    // hits something. Loading it inside the Start gesture instead left the drum
    // silent while it was already mixing: measured 268 ms on a fast desktop and
    // 2963 ms with the CPU throttled to a phone-like rate.
    this._preload();
  }

  /** Start (or join) the one sample-bank load. Safe to call before any gesture. */
  _preload() {
    if (!this._loadPromise) {
      this._loadPromise = this._loadManifest().catch(() => { this.loaded = true; });
    }
    return this._loadPromise;
  }

  _bindContext(ctx) {
    this.ctx = ctx;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;

    this.collisionBus = this.ctx.createGain();
    this.collisionBus.gain.value = 0.38;
    this.collisionLowpass = this.ctx.createBiquadFilter();
    this.collisionLowpass.type = 'lowpass';
    this.collisionLowpass.frequency.value = 720;
    this.collisionLowpass.Q.value = 0.55;
    this.collisionBus.connect(this.collisionLowpass);
    this.collisionLowpass.connect(this.master);

    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 16;
    this.limiter.attack.value = 0.004;
    this.limiter.release.value = 0.18;
    this.master.connect(this.limiter);
    this.limiter.connect(this.listener.getInput());

    this.ctx.onstatechange = () => {
      if (this.ctx.state !== 'running') {
        this.enabled = false;
        this.needsUserUnlock = true;
      }
      this._emitStatus();
    };
  }

  _emitStatus() { this.onStatusChange?.(this.status()); }

  status() {
    const running = this.ctx?.state === 'running' && !this.needsUserUnlock;
    return { state: this.ctx?.state || 'closed', running, muted: this.muted, soundOn: running && !this.muted };
  }

  _replaceClosedContext() {
    if (this.ctx?.state !== 'closed') return;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;

    try { if (this.mech) this.mech.src.stop(); } catch (e) {}
    this.mech = null;
    this.started = false;
    this.loaded = false;
    this.banks = {};
    this.mechBuffer = null;
    this.activeVoices = 0;
    this._loadPromise = null;
    this._epoch = null;
    this._blockAt = -1;

    const ctx = createDrumAudioContext() || new Ctor();
    ThreeAudioContext.setContext(ctx);
    this.listener.context = ctx;
    try { this.listener.gain?.disconnect(); } catch (e) {}
    this.listener.gain = ctx.createGain();
    this.listener.gain.connect(ctx.destination);
    this.listener.filter = null;
    this._bindContext(ctx);
  }

  // ── Asset loading (real recordings only; silent if none present) ────────────
  async _loadManifest() {
    let manifest = null;
    try {
      const res = await fetch(AUDIO_BASE + 'manifest.json', { cache: 'force-cache' });
      if (res.ok) manifest = await res.json();
    } catch (e) { manifest = null; } // no assets bundled yet ⇒ stay silent
    if (!manifest) { this.loaded = true; return; }
    const load = async (rel) => {
      // Try the listed format first (OGG — decodes on Chrome/Android/desktop Chrome),
      // then a lossless WAV fallback transcoded from the SAME source. Safari / iOS /
      // WKWebView (iOS Capacitor) CANNOT decodeAudioData OGG Vorbis — without a fallback
      // the banks decode to empty and the drum is silent even though the .ogg returns 200.
      const candidates = [rel];
      if (/\.ogg$/i.test(rel)) candidates.push(rel.replace(/\.ogg$/i, '.wav'));
      for (const c of candidates) {
        try {
          const r = await fetch(AUDIO_BASE + c, { cache: 'force-cache' });
          if (!r.ok) continue;
          const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
          if (buf) return buf;
        } catch (e) { this._decodeErrors = (this._decodeErrors || 0) + 1; /* unsupported format → try the next candidate */ }
      }
      return null;
    };
    const loadList = async (arr) => (await Promise.all((arr || []).map((f) => load(f)))).filter(Boolean);
    // Serve the CURRENT game's folder next, every time round — `_bank()` becomes
    // usable the moment its four lists are decoded, so the drum is audible without
    // waiting for the other profiles. Re-checking `this.dir` on each iteration (as
    // opposed to sorting once) means a setGame() that lands while the manifest is
    // still in flight still gets its own samples first. The quiet mechanism loop
    // goes last; nothing waits on it.
    const pending = new Map(Object.entries(manifest));
    while (pending.size) {
      const dir = pending.has(this.dir) ? this.dir
        : ([...pending.keys()].find((k) => k !== 'mechanism') ?? pending.keys().next().value);
      const groups = pending.get(dir);
      pending.delete(dir);
      if (dir === 'mechanism') { const b = await loadList(groups); this.mechBuffer = b[0] || null; continue; }
      this.banks[dir] = {
        ballBall: await loadList(groups.ballBall),
        ballWall: await loadList(groups.ballWall),
        exit: await loadList(groups.exit),
        rack: await loadList(groups.rack),
      };
    }
    this.loaded = true;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  // iOS Safari/Chrome only truly start an AudioContext that was created before any
  // user gesture if, INSIDE that gesture, we both resume() it AND play a buffer.
  // This runs synchronously (before any await) so it counts as gesture-driven.
  _unlockIOS() {
    this._replaceClosedContext();
    try {
      this.ctx.resume?.();
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.ctx.destination); s.start(0);
    } catch (e) { /* ignore */ }
  }

  async resume() {
    this._unlockIOS();
    this._replaceClosedContext();
    try { if (this.ctx.state !== 'running') await this.ctx.resume(); } catch (e) { /* ignore */ }
    this._replaceClosedContext();
    try { if (this.ctx.state !== 'running') await this.ctx.resume(); } catch (e) { /* ignore */ }

    const running = this.ctx.state === 'running';
    this.needsUserUnlock = !running;
    this.enabled = running;
    if (running) {
      if (!this.loaded) { try { await this._preload(); } catch (e) { this.loaded = true; } }
      if (!this.started) { this._buildMech(); this.started = true; }
      this._ramp(this.master.gain, this.muted ? 0 : 1.0, 0.12);
    } else {
      this._ramp(this.master.gain, 0, 0.04);
    }
    this._emitStatus();
    return this.status();
  }

  async pause() {
    try { if (this.ctx?.state === 'running') await this.ctx.suspend(); } catch (e) { /* browser lifecycle may already suspend it */ }
    this._emitStatus();
    return this.status();
  }

  markNeedsUserUnlock() {
    this.needsUserUnlock = true;
    this.enabled = false;
    this._ramp(this.master.gain, 0, 0.05);
    this._emitStatus();
  }

  _buildMech() {
    if (!this.mechBuffer) { this.mech = null; return; } // no synth fallback — stays silent
    const src = this.ctx.createBufferSource(); src.buffer = this.mechBuffer; src.loop = true;
    const gain = this.ctx.createGain(); gain.gain.value = 0;
    src.connect(gain); gain.connect(this.master); src.start();
    this.mech = { src, gain };
  }

  /** Assign the acoustic profile for the current game (called on profile load). */
  setGame(gameId) {
    const profile = GAME_AUDIO_PROFILE[gameId] || DEFAULT_PROFILE;
    this.dir = PROFILE_DIR[profile] || PROFILE_DIR[DEFAULT_PROFILE];
    this._preload();   // no-op once running; makes the very first setGame start it
  }

  _bank() { return this.banks[this.dir] || null; }

  setMuted(m) {
    this.muted = m;
    if (this.enabled && this.ctx.state === 'running' && !this.needsUserUnlock) this._ramp(this.master.gain, m ? 0 : 1.0, 0.08);
    this._emitStatus();
  }

  _ramp(param, to, time) {
    if (!param || !this.ctx || this.ctx.state === 'closed') return;
    const now = this.ctx.currentTime;
    try { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); param.linearRampToValueAtTime(to, now + time); }
    catch (e) { param.value = to; }
  }

  _canPlay() { return this.enabled && !this.needsUserUnlock && this.ctx.state === 'running'; }

  /**
   * Announce the simulation instant the next audio calls belong to. main.js calls
   * this once per fixed physics step, BEFORE the step's contacts and ball events.
   *
   * Why this exists: the render loop advances physics in fixed 1/60 steps and runs
   * up to five of them inside a single animation frame to catch up after a frame
   * hitch. `ctx.currentTime` does not advance inside that JS block, so without a
   * mapping every sound produced by the burst starts at the same instant — the
   * whole burst collapses, and the 32 ms spacing test below throws most of it away
   * (measured: 54–60 % of contact batches produced no voice at all, and per-voice
   * desync reached 81 ms under load). Anchoring the sim clock to the audio clock
   * lets the later steps of a burst schedule into the near future, where they keep
   * their real spacing.
   *
   * The anchor is re-taken on every new JS block — `ctx.currentTime` only advances
   * between animation frames, so a changed clock means a new frame — and the epoch
   * is then exactly `now - simTime`. In the steady state (one step per frame) that
   * makes `_when()` return `ctx.currentTime`, i.e. the behaviour this replaced,
   * with NO latency added. Only the extra steps of a catch-up burst map forward,
   * and only as far as the burst itself is long.
   */
  beginStep(simTime) {
    this._simTime = simTime;
    if (!this.ctx || this.ctx.state === 'closed') return;
    const now = this.ctx.currentTime;
    if (this._epoch === null || now !== this._blockAt) { this._epoch = now - simTime; this._blockAt = now; }
  }

  /** The audio-clock time for the simulation instant currently being stepped. */
  _when() {
    const now = this.ctx.currentTime;
    if (this._epoch === null) return now;
    const t = this._epoch + this._simTime;
    return t < now ? now : (t > now + this.MAX_AHEAD ? now + this.MAX_AHEAD : t);
  }

  /** Read-only: is a sound ACTUALLY being produced this instant? Drives the sound
   *  button's "playing" pulse. Never influences what/whether anything plays. */
  isPlaying() {
    if (!this._canPlay() || this.muted) return false;
    if (this.activeVoices > 0) return true;                                   // a collision/rack voice is live
    if (this.ctx.currentTime - this.lastHitAt < 0.12) return true;            // a hit fired a moment ago
    return !!(this.mech && this.mech.gain.gain.value > 0.005);               // the mechanism loop is audible
  }

  // ── Per-frame drive (mechanism from the real rotor; rolling omitted until a
  //    dedicated rolling recording exists — no synthesised roll). ─────────────
  update(dt, { mechIntensity = 0 } = {}) {
    if (!this._canPlay() || !this.started || !this.mech) return;
    this._ramp(this.mech.gain.gain, 0.06 * clamp(mechIntensity, 0, 1), 0.15); // quiet, never dominant
  }

  // ── Collisions from Rapier contact-force events ─────────────────────────────
  handleContacts(contacts, ballColliders) {
    const bank = this._bank();
    if (!this._canPlay() || this.muted || !bank || !contacts || contacts.length === 0) return;
    contacts.sort((a, b) => b.max - a.max);
    const MAX_PER_FRAME = 2;
    let started = 0;
    for (const c of contacts) {
      if (started >= MAX_PER_FRAME || this.activeVoices >= this.MAX_VOICES) break;
      // Map the Rapier contact force to loudness. The denominator sets how quickly
      // typical impacts reach full level; a smaller one keeps ordinary tumbling
      // clearly audible (the old /100 left everyday hits near -18 dBFS ≈ inaudible
      // on a phone). Force STILL drives gain — this is only a level calibration.
      const s = clamp((c.max - 10) / 90, 0, 1);
      if (s < 0.08) continue;
      const ballBall = ballColliders && ballColliders.has(c.c1) && ballColliders.has(c.c2);
      const set = ballBall ? bank.ballBall : (bank.ballWall.length ? bank.ballWall : bank.ballBall);
      if (!set || !set.length) { started++; continue; }
      // Space hits on the SCHEDULED timeline. Comparing against ctx.currentTime
      // discarded whole catch-up steps, because that clock is frozen for the
      // duration of the JS block that runs them.
      const when = this._when();
      if (when - this.lastHitAt < 0.032) break;
      this.lastHitAt = when;
      const shaped = Math.pow(s, 0.75);
      const base = ballBall ? 0.045 : 0.055, range = ballBall ? 0.16 : 0.18;
      this._voice(set[(Math.random() * set.length) | 0], (base + range * shaped) * rnd(0.88, 1.0), rnd(0.94, 1.0), this.collisionBus);
      started++;
    }
  }

  /** `guaranteed` marks a RESULT-BALL one-shot (rack / stop). Those two are the only
   *  sounds the user is promised for every drawn ball, so the shared collision voice
   *  budget may never refuse them — MAX_VOICES is a ceiling for the tumbling mix, not
   *  for the draw's own land/settle. A guaranteed voice still counts towards
   *  `activeVoices`, so collision density backs off exactly as it did before. */
  _voice(buffer, gain, rate, bus = this.master, guaranteed = false) {
    if (!buffer || !this._canPlay()) return;
    if (!guaranteed && this.activeVoices >= this.MAX_VOICES) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(bus);
    this.activeVoices++;
    src.onended = () => { this.activeVoices--; try { src.disconnect(); g.disconnect(); } catch (e) {} };
    // Start at the SIMULATION instant this sound belongs to (never in the past).
    try { src.start(this._when()); } catch (e) { this.activeVoices--; }
  }

  // ── Discrete drawn-ball events (bound to real lifecycle/physics in main.js) ──
  ballEvent(type) {
    const bank = this._bank();
    if (!this._canPlay() || this.muted || !bank) return;
    if (type === 'exit') return; // no added falling/exit sound for now
    else if (type === 'rack' && bank.rack.length) this._voice(bank.rack[(Math.random() * bank.rack.length) | 0], 0.8, rnd(0.98, 1.02), this.master, true);
    else if (type === 'stop' && bank.rack.length) this._voice(bank.rack[0], 0.4, rnd(1.0, 1.04), this.master, true);
  }

  // Integration shim: main.js calls this on warm-up. The Demo has no ball-sound counter,
  // so this is a harmless no-op kept only so the existing call site needs no change.
  resetBallAudioCounter() {}

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  reset() { if (this.started && this.mech) this._ramp(this.mech.gain.gain, 0, 0.25); }

  dispose() {
    try { if (this.mech) this.mech.src.stop(); } catch (e) {}
    this.mech = null; this.started = false; this.enabled = false;
  }
}
