/**
 * Turbulent air-mix field + per-ball anti-stall corrections.
 *
 * The rotor mechanically STRIKES balls; the blower keeps the whole sphere volume
 * alive (central updraft + edge downdraft + swirl + 3D-noise turbulence) AND
 * guarantees that no individual ball is left out: each ball carries a motion
 * tracker, and if it has been still / stuck on the bottom / hanging on top /
 * pinned to the wall for too long, the air AT THAT BALL is locally boosted to
 * carry it back into the flow. Corrections are position/state based and identical
 * for every ball — never by number, never a scripted path.
 *
 * ── How the air acts on a ball ───────────────────────────────────────────────
 * The blower is modelled as an air VELOCITY field u(x,t), and a ball feels it the
 * only way a ball can feel moving air — through aerodynamic drag:
 *
 *     a = dragK · |u − v| · (u − v),   dragK = |g| / terminalSpeed²
 *
 * Three things follow, and all three are the physically right behaviour:
 *   • a ball already travelling with the flow is barely pushed (it is being
 *     carried, not rammed), while a ball crossing the flow is pushed hard;
 *   • nothing can be accelerated past the local air speed, so the updraft cannot
 *     run a ball away — the speed clamp in Balls.clampSpeeds stops being part of
 *     the model and goes back to being a safety net;
 *   • the same law is the balls' air resistance everywhere, including outside the
 *     jet, so there is no second, made-up drag term to keep consistent.
 *
 * The previous model added a fixed force per ball regardless of the ball's own
 * velocity: an updraft that pushed a ball already rising at 14 u/s exactly as
 * hard as one sitting still.
 */
import { BALL_MASS, CONFIG } from '../config.js';
import { makeNoise3 } from '../util/prng.js';

export class AirMix {
  constructor() {
    this.noise = makeNoise3();
    this.t = 0;
  }

  /**
   * @param {Array} items active ball items ({body, tracker})
   * @param {number} dt
   * @param {number} flowScale global blower throttle (eased while capturing)
   * @param {boolean} draining true once the throat gate is open
   */
  apply(items, dt, flowScale = 1, draining = false) {
    this.t += dt;
    const A = CONFIG.air;
    const R = CONFIG.drum.radius;
    const coneR = A.coneR * R;
    const span = A.topY + R;
    const ns = A.turbScale;
    const tt = this.t * A.turbTime;
    const C = CONFIG.capture;
    // Fixed by the ball's terminal speed — not a free tuning knob (see config.js).
    const dragK = Math.abs(CONFIG.physics.gravity) / (A.terminalSpeed * A.terminalSpeed);

    for (const it of items) {
      const body = it.body, k = it.tracker;
      const p = body.translation();
      const hr = Math.hypot(p.x, p.z) || 1e-4;

      // While the throat gate is open the air LEAVES through the bottom-centre
      // outlet, so the updraft there collapses — the chamber cannot be blowing
      // hard straight up its own open drain. Without this the blower (plus the
      // bottom anti-stall gust) simply holds balls out of the drain and the pick
      // never happens: velocities superpose and drag is quadratic in their sum,
      // so two moderate boosts add up to several times a ball's weight.
      // Smooth, so a ball drifting into the drain is never kicked at a boundary.
      const drain = draining
        ? Math.max(0, Math.min(1, (C.drainR - hr) / (C.drainR * 0.5)))
          * Math.max(0, Math.min(1, (C.drainY - p.y) / (R * 0.25)))
        : 0;
      const open = 1 - drain;

      // Base flow: central updraft → edge downdraft, tapering with height.
      let cone = 1 - (hr / coneR) * (hr / coneR);
      if (cone < -A.edgeDown) cone = -A.edgeDown;
      const heightTaper = Math.max(0, Math.min(1, (A.topY - p.y) / span));
      let ux = 0, uy = A.jet * cone * heightTaper * flowScale * open, uz = 0;

      // Swirl (reduced for balls pinned to the wall so they can peel off).
      const swirl = k.wall > A.wallT ? A.swirl * 0.2 : A.swirl;
      ux += (-p.z / hr) * swirl;
      uz += (p.x / hr) * swirl;

      // Steady inward flow that grows toward the wall — keeps balls cycling
      // through the volume instead of hugging the surface.
      const radial = Math.hypot(p.x, p.y, p.z) || 1e-4;
      if (radial > R * 0.6) {
        const inward = A.edgeInward * ((radial - R * 0.6) / (R * 0.4));
        ux += (-p.x / radial) * inward; uy += (-p.y / radial) * inward; uz += (-p.z / radial) * inward;
      }

      // Turbulence — chaotic, spatially coherent, independent per ball.
      const nx = this.noise(p.x * ns + tt, p.y * ns, p.z * ns);
      const ny = this.noise(p.x * ns, p.y * ns + tt, p.z * ns);
      const nz = this.noise(p.x * ns, p.y * ns, p.z * ns + tt);
      ux += nx * A.turb; uy += ny * A.turb * 0.8; uz += nz * A.turb;

      // ── Per-ball anti-stall corrections: a local gust, not a teleporting kick ──
      if (k.bottom > A.bottomT) { const g = A.bottomKick * open; uy += g; ux += nx * g; uz += nz * g; }
      if (k.top > A.topT) { uy -= A.topPush; }                       // let gravity bring it down
      if (k.wall > A.wallT) { ux += (-p.x / hr) * A.wallPull; uz += (-p.z / hr) * A.wallPull; } // inward jet
      if (k.still > A.stillT) { uy += A.stillKick; ux += nx * A.stillKick * 1.5; uz += nz * A.stillKick * 1.5; }

      // Quadratic drag toward the local air velocity.
      const v = body.linvel();
      const rx = ux - v.x, ry = uy - v.y, rz = uz - v.z;
      const c = dragK * Math.hypot(rx, ry, rz) * BALL_MASS;
      body.addForce({ x: c * rx, y: c * ry, z: c * rz }, true);
    }
  }
}
