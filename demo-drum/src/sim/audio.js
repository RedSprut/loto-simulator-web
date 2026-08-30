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

    this.MAX_VOICES = 4;            // shared pool for ambient COLLISION chatter (may drop)
    this.activeVoices = 0;
    this.lastHitAt = 0;
    // Per-drawn-ball lifecycle sounds get their OWN voices so they are NEVER dropped by
    // the collision pool / debounce / a busy previous voice — every ball is guaranteed
    // its exit + rack sound. A generous cap only guards against a pathological runaway.
    this.eventVoices = 0;
    this.MAX_EVENT_VOICES = 16;
    this.ballSoundsPlayed = 0;      // hidden diagnostic: total guaranteed ball sounds played

    this.mech = null;               // {src, gain} once a mechanism recording exists
    this._bindContext(this.ctx);
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

    // Hidden diagnostic tap AFTER the master graph (no UI, no audible effect): an
    // AnalyserNode confirms a real, non-zero signal actually reaches the output during
    // genuine drum events. It only reads what already flows to the destination.
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;
    this.limiter.connect(this.analyser);
    // Chrome only "pulls" an AnalyserNode that reaches the destination; route it through a
    // MUTED gain to a real sink so the diagnostic reads the true signal everywhere (this
    // adds NO audible output — gain is 0 — and does not change the actual audio path).
    this._analyserSink = this.ctx.createGain();
    this._analyserSink.gain.value = 0;
    this.analyser.connect(this._analyserSink);
    this._analyserSink.connect(this.ctx.destination);
    this._peakBuf = new Uint8Array(this.analyser.fftSize);

    this.ctx.onstatechange = () => {
      if (this.ctx.state !== 'running') {
        this.enabled = false;
        this.needsUserUnlock = true;
      }
      this._emitStatus();
    };
  }

  _emitStatus() { this.onStatusChange?.(this.status()); }

  /** Hidden diagnostic: peak deviation (0..128) of the live output signal. >0 during a
   *  real drum event proves audio is actually reaching audioContext.destination. */
  peakLevel() {
    if (!this.analyser) return 0;
    try {
      this.analyser.getByteTimeDomainData(this._peakBuf);
      let peak = 0;
      for (let i = 0; i < this._peakBuf.length; i++) { const d = Math.abs(this._peakBuf[i] - 128); if (d > peak) peak = d; }
      return peak;
    } catch (e) { return 0; }
  }

  /** Hidden diagnostic snapshot (no UI): decoded buffer counts per bank + graph state. */
  diag() {
    const banks = {};
    for (const [dir, b] of Object.entries(this.banks)) banks[dir] = { ballBall: b.ballBall.length, ballWall: b.ballWall.length, exit: b.exit.length, rack: b.rack.length };
    return {
      state: this.ctx?.state, enabled: this.enabled, muted: this.muted, needsUserUnlock: this.needsUserUnlock,
      loaded: this.loaded, dir: this.dir, banks, decodeErrors: this._decodeErrors || 0,
      masterGain: this.master ? this.master.gain.value : null, activeVoices: this.activeVoices, peak: this.peakLevel(),
    };
  }

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

    const ctx = new Ctor();
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
    for (const [dir, groups] of Object.entries(manifest)) {
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
      if (!this.loaded) { try { await this._loadManifest(); } catch (e) { this.loaded = true; } }
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
      const now = this.ctx.currentTime;
      if (now - this.lastHitAt < 0.032) break;
      this.lastHitAt = now;
      const shaped = Math.pow(s, 0.75);
      const base = ballBall ? 0.045 : 0.055, range = ballBall ? 0.16 : 0.18;
      this._voice(set[(Math.random() * set.length) | 0], (base + range * shaped) * rnd(0.88, 1.0), rnd(0.94, 1.0), this.collisionBus);
      started++;
    }
  }

  _voice(buffer, gain, rate, bus = this.master) {
    if (!buffer || !this._canPlay() || this.activeVoices >= this.MAX_VOICES) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(bus);
    this.activeVoices++;
    src.onended = () => { this.activeVoices--; try { src.disconnect(); g.disconnect(); } catch (e) {} };
    try { src.start(); } catch (e) { this.activeVoices--; }
  }

  /** Dedicated voice for a GUARANTEED per-ball lifecycle sound. Unlike _voice() it is
   *  never blocked by the collision pool / debounce and always gets a FRESH source, so
   *  no ball is left silent because a previous sound was still playing. */
  _eventVoice(buffer, gain, rate, bus = this.master) {
    if (!buffer || !this._canPlay() || this.muted || this.eventVoices >= this.MAX_EVENT_VOICES) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.playbackRate.value = rate;
    const g = this.ctx.createGain(); g.gain.value = gain;
    src.connect(g); g.connect(bus);
    this.eventVoices++; this.ballSoundsPlayed++;
    src.onended = () => { this.eventVoices--; try { src.disconnect(); g.disconnect(); } catch (e) {} };
    try { src.start(); this.lastHitAt = this.ctx.currentTime; return true; } catch (e) { this.eventVoices--; return false; }
  }

  // ── GUARANTEED discrete drawn-ball sounds (bound to each ball's animation lifecycle
  //    in main.js, one-shot per ballId). Two sounds per ball: 'exit' (drops out of the
  //    drum) + 'rack' (touches the tray). Never gated by the collision pool. Same timbre
  //    and muffled level as before; falls back to the rack sample if a bank is empty. ──
  ballEvent(type) {
    const bank = this._bank();
    if (!this._canPlay() || this.muted || !bank) return false;
    const pick = (arr) => (arr && arr.length) ? arr[(Math.random() * arr.length) | 0] : null;
    if (type === 'exit') {
      const buf = pick(bank.exit) || pick(bank.ballWall) || pick(bank.rack);
      return this._eventVoice(buf, 0.5, rnd(0.98, 1.03));
    }
    if (type === 'rack') {
      const buf = pick(bank.rack) || pick(bank.exit);
      return this._eventVoice(buf, 0.8, rnd(0.98, 1.02));
    }
    return false;
  }

  /** Hidden diagnostic snapshot for the "no ball left silent" audit (no UI). */
  ballAudioDiag() { return { ballSoundsPlayed: this.ballSoundsPlayed, eventVoices: this.eventVoices }; }
  resetBallAudioCounter() { this.ballSoundsPlayed = 0; }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  reset() { if (this.started && this.mech) this._ramp(this.mech.gain.gain, 0, 0.25); }

  dispose() {
    try { if (this.mech) this.mech.src.stop(); } catch (e) {}
    this.mech = null; this.started = false; this.enabled = false;
  }
}
