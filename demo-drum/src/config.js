/**
 * Central tuning for the spherical, mechanical air/gravity-mix lottery machine.
 *
 * ── Scale and time base (read before touching `physics.gravity`) ─────────────
 * The GEOMETRY fixes the length scale: a lottery ball is 0.40 units across and a
 * real one is 40 mm, so 1 unit = 10 cm — which makes the 6.0-unit chamber a
 * 600 mm sphere, exactly a professional drum. Full-scale gravity at that unit
 * choice would be 9.81 m/s² = 98.1 units/s².
 *
 * This world runs at 30 units/s² on purpose. That is not an error and not
 * "floaty": it is a Froude-similar model of the same machine — identical
 * geometry, gravity ratio γ = 30/98.1 = 0.306 — so every trajectory has the real
 * shape and only the clock is dilated by 1/√γ ≈ 1.81×. Froude similarity holds
 * ONLY while every other quantity is expressed in the same base, which is why
 *   • the air drag coefficient comes from the ball's terminal speed IN THIS BASE
 *     (air.terminalSpeed), not from a tuned constant,
 *   • the throat suction is a multiple of a ball's weight (m·g),
 *   • every rate (damping, rotor rad/s, turbulence) is per model-second.
 * Changing `gravity` on its own silently breaks that balance: it must move
 * together with air.terminalSpeed, the damping rates and the rotor speeds.
 *
 * Per-game specifics (ball counts, ranges, result layout) live in games.js —
 * this file holds only the physics/visual tunables.
 */
export const CONFIG = {
  // The top-UI number is revealed ONLY after the physical ball has fully settled
  // in its rack slot (BALL_EXIT complete): in-rack, parked, no residual linear or
  // angular motion, and turned so its number faces the viewer. The camera keeps
  // following the ball until this whole predicate holds — the number never appears
  // before the physical ball has come to a complete, readable stop.
  reveal: { facingDot: 0.985, maxWait: 3.2, hold: 0.35, settleLinThresh: 0.06, settleAngThresh: 0.25 },

  draw: {
    startupSeconds: 1.0,  // rotor spins up (mixer already running)
    mixSeconds: 2.6,      // mixing window before each capture (rotor never stops)
    captureTimeout: 5.0,  // escalate the throat suction if nobody has dropped yet
    displaySeconds: 1.4,  // brief hold on the winner — the rest keep mixing
    reloadSeconds: 1.6,   // separate bonus pool swap (rotor keeps spinning)
    stoppingSeconds: 3.0, // rotor coasts down (sweeping balls off) before final settling
  },

  // FINAL_SETTLING: with every artificial force off, wait until all remaining
  // balls are at rest in the bottom of the sphere (physical condition, not timer).
  settle: {
    linThresh: 0.15,      // m/s below which a ball counts as "still"
    angThresh: 0.3,       // rad/s
    hold: 0.5,            // seconds a ball must stay still to be "settled"
    suspendYFrac: 0.15,   // above y = R·this after settling = genuinely floating (a resting pile stays below)
    // During settling, make balls behave like heavy sand: almost no bounce (kills
    // trimesh trampolining), a little more grip, moderate damping — so they roll
    // down and rest at the bottom. Still only gravity + friction + damping.
    // Smooth analytic wall (containSphere) takes over here, so we can use real
    // damping/friction to bleed off energy: balls spiral down and rest at the
    // bottom instead of orbiting the sphere forever.
    restitution: 0.1,
    friction: 0.35,
    damping: 2.4,
    maxSeconds: 15,       // safety cap so the state can never hang forever
  },

  ball: {
    radius: 0.2,
    density: 1.0,
    restitution: 0.55,    // lively bounces so contacts scatter, not clump
    friction: 0.16,       // enough to spin balls on tangential contact…
    // Real air resistance is the quadratic drag in sim/airmix.js (it acts in still
    // air too, not only inside the jet). This is only a small residual so balls
    // still bleed speed in STOPPING, where the blower is off.
    linearDamping: 0.05,
    angularDamping: 0.035, // low so SPIN persists (decoupled from linear drag)
    // Safety nets, not part of the model: with a stable wall and velocity-relative
    // drag nothing should ever reach these (tests/3d-physics.mjs asserts that).
    // They used to be load-bearing, and both sat INSIDE the drum's own physics:
    // a free fall down the chamber reaches √(2·30·5.5) ≈ 18 u/s, so 14 clipped
    // ordinary falls; and rolling without slipping at 7 u/s needs ω = v/r = 35
    // rad/s, so 40 fought the very rolling the wall friction now produces.
    maxLinSpeed: 22,      // > the fastest possible free fall inside the chamber
    maxAngSpeed: 105,     // > maxLinSpeed / radius, so rolling is never clipped
    segments: [40, 28],
    // Colour sets referenced by a pool's `colorSet`.
    colorSets: {
      multicolor: [0xf2c14e, 0xe85d75, 0x4f78d6, 0x2db39d, 0x8d66c9, 0xf28c3c],
      'bonus-red': [0xe23b4e],
      'bonus-gold': [0xf1c34a],
    },
  },

  drum: {
    radius: 3.0,
    glassOuter: 3.14,
    visSegments: 64,
    latRings: 36,         // finer physics tessellation so balls don't wedge in facet creases
    lonSegs: 54,
    throatRadius: 0.34,
    gateY: -2.86,
    equatorScaleX: 1.06,
  },

  // Light, precise internal rotor: a thin shaft carrying thin radial arms tipped
  // with small soft pushers that dip into the ball bed. Pushers are staggered in
  // depth and tilt so contacts scatter balls in 3D instead of one flat ring.
  rotor: {
    shaftRadius: 0.05,
    shaftSpanFrac: 0.9,    // shaft length = 2R × frac
    hubRadius: 0.2,
    armCount: 6,
    armRadius: 0.045,
    armInner: 0.3,
    wallGap: 0.14,         // gap between pusher TIP and the inner wall (< ball dia)
    pusherRadius: 0.12,
    pusherHalf: 0.17,
    // Per-pusher depth (X, fraction of shaft half-length) + tilt (deg).
    pusherLayout: [
      { depth: -0.62, tilt: -12 },
      { depth: 0.55, tilt: 10 },
      { depth: -0.28, tilt: 15 },
      { depth: 0.33, tilt: -9 },
      { depth: -0.5, tilt: 7 },
      { depth: 0.46, tilt: -14 },
    ],
    // Small secondary mixer near the back. It spins on the SAME strictly-horizontal
    // axis as the primary (X), just offset and counter-rotating, so — like the
    // primary — every arm rides a fixed vertical circle and never leans/tilts
    // sideways. (Its mesh and collider come from one kinematic body, so they always
    // share the exact same transform.)
    secondary: {
      axis: [1, 0, 0],
      center: [0.0, 0.15, -0.7],
      armCount: 3,
      armRadius: 0.04,
      radiusFrac: 0.5,     // of drum radius
      pusherRadius: 0.1,
      pusherHalf: 0.13,
    },
    speedIdle: 0.0,
    speedStartup: 1.2,
    speedArm: 0.6,         // slowing so the bed can settle
    speedCapture: 0.0,     // stopped: let a ball settle and drop through the throat
    accel: 4.0,            // damp rate toward the target speed
    // MIXING speed phases (primary, secondary), looped, blended via damp. The two
    // are intentionally out of sync (and reverse) so no steady ring forms.
    mixPhases: [
      { duration: 1.6, primary: 2.4, secondary: -1.2 },
      { duration: 1.3, primary: 2.9, secondary: 1.0 },
      { duration: 1.8, primary: 2.1, secondary: -1.5 },
      { duration: 1.4, primary: 2.7, secondary: 1.3 },
    ],
  },

  // Turbulent air-mix field (see sim/airmix.js): a central updraft + edge
  // downdraft + swirl + 3D-noise turbulence that keeps the whole sphere volume
  // alive.
  //
  // The blower is modelled the way a blower actually works: as an air VELOCITY
  // field u(x,t) in units/s. A ball feels it only through aerodynamic drag,
  //     a = dragK · |u − v| · (u − v),
  // so a ball already travelling with the flow is barely pushed, a ball moving
  // against it is pushed hard, and nothing can be accelerated past the local air
  // speed. (The previous model added a fixed force regardless of the ball's own
  // velocity — an updraft that pushes a ball rising at 14 u/s exactly as hard as
  // one at rest. That is what made `ball.maxLinSpeed` load-bearing.)
  //
  // dragK is NOT a free knob: it is fixed by `terminalSpeed`, and the same drag
  // law is the balls' only air resistance, in the flow and out of it.
  air: {
    // Terminal speed of a 40 mm lottery ball in still air is ≈ 8.6 m/s; carried
    // into this scale (1 u = 10 cm) and time base (1.81× dilated) that is 48 u/s.
    // dragK = |gravity| / terminalSpeed² ⇒ 0.0130 per unit.
    terminalSpeed: 48,
    // Flow speeds. `jet` ≈ 15 m/s at real scale — an ordinary air-mix blower, and
    // the speed at which drag on a stationary ball is ≈ 3× its weight.
    jet: 102,       // peak central updraft speed (lofts balls up through the whole volume)
    coneR: 1.0,     // horizontal radius fraction where updraft → 0 (then downdraft)
    edgeDown: 0.12, // small downdraft near the walls (don't pin balls to the lower wall)
    // Height falloff of the jet. A ball hovers where the updraft equals its
    // terminal speed, so this is what sets how high the fountain reaches: at
    // jet 102 and topY 6.0 the flow crosses 48 u/s around y ≈ +1.6, and balls
    // coast to a stop there and fall back — no ceiling slamming, no hard cap.
    topY: 6.0,
    swirl: 11,      // minimal so balls aren't centrifuged onto the wall
    edgeInward: 50, // steady inward flow that grows toward the wall (anti wall-hug)
    turb: 58,       // strong turbulence so every ball is constantly buffeted (air machine)
    turbScale: 0.85,
    turbTime: 0.9,
    // Per-ball anti-stall corrections. Same mechanism as everything else — a
    // LOCAL boost of the air velocity at that ball, not an impulse teleport — so
    // a stalled ball is picked up by the flow and then rides it like any other.
    bottomKick: 74, bottomT: 0.35,   // stuck low → strong local updraft + scatter
    topPush: 62, topT: 0.4,          // hanging high → local downdraft, let gravity return it
    wallPull: 85, wallT: 0.4,        // pinned to wall → hard inward jet, cut its swirl
    stillKick: 57, stillT: 0.3,      // barely moving → firm local gust back into the flow
    // Throttle the blower while capturing so a ball still settles to the throat
    // cleanly and the draw stays fair. This scales the flow SPEED, so the force
    // it produces falls off with its square.
    captureFlowScale: 0.62,
  },

  // Localized suction at the throat during CAPTURING: pulls whatever ball wanders
  // into the bottom-centre drain down and out, WITHOUT stopping the mixer. Applied
  // to every ball in the zone equally — never by number.
  capture: { drainR: 0.6, drainY: -1.6, down: 2.2, inward: 1.2, escalate: 1.8 },

  exit: {
    tube: [
      [0.0, -3.05, 0.35],
      [0.0, -2.75, 1.15],
      [0.0, -2.35, 1.95],
      [0.0, -2.35, 2.70],
    ],
    tubeRadius: 0.28,
    chute: [
      [0.0, -2.42, 2.70],
      [0.0, -2.60, 3.30],
      [0.0, -2.74, 3.95],
      [0.0, -2.80, 4.55],
    ],
    chuteHalfWidth: 0.30,
    // Front accumulator rack (linear guide, built dynamically per profile).
    rack: {
      y: -2.74,
      z: 4.9,
      ballGap: 0.18,       // gap between adjacent balls in a group
      groupGap: 0.55,      // extra gap between result groups (main | bonus)
      slotDepth: 0.05,     // shallow seat (≈ 0.25 × ball radius)
      sepHeight: 0.11,     // small divider height
    },
  },

  physics: {
    gravity: -30,        // see the scale/time-base note at the top of this file
    subSteps: 2,
    maxDt: 1 / 45,
    // Rapier's internal length tolerances (allowed penetration, speculative-contact
    // prediction distance, …) are expressed for a "1 unit = 1 metre" world. This
    // scene has 10 units per metre, so without this every tolerance is 10× tighter
    // than Rapier intends — a 0.1 mm allowed error and a 0.2 mm prediction distance
    // for balls crossing whole millimetres per sub-step, which is how they reached
    // 8 mm into the glass shell before a contact was generated.
    lengthUnit: 10,
  },

  // Smooth analytic spherical wall. It engages a hair before the faceted trimesh,
  // so balls glide on a perfect sphere and never catch on a facet crease — this is
  // the real drum boundary, for mixing and settling alike.
  //
  // It is solved at the VELOCITY level (see Balls.applyWall), not as a penalty
  // spring/damper. A penalty wall is unconditionally unstable at this mass and
  // timestep: the old k=600 / damp=24 pair gave an explicit damping gain of
  // damp/m·dt ≈ 12, and the wall's measured restitution was ~12× — every touch
  // threw the ball back an order of magnitude faster than it arrived, and
  // `clampSpeeds` clipped the result. The drum ran on that energy.
  wall: {
    margin: 0.06,
    restitution: 0.28,     // the glass shell, combined with the ball's own by Rapier's Average rule
    restitutionSlop: 0.6,  // below this impact speed the wall is dead — a resting ball cannot buzz
    friction: 0.35,        // the glass shell: this is what makes balls ROLL on the wall instead of sliding
    bias: 0.25,            // fraction of any residual penetration removed per frame
    maxCorrection: 2.0,    // cap on that recovery speed (units/s) so a deep hit is never ejected
  },

  // Near-static frontal camera. No orbiting, no side views — only a tiny zoom and
  // a downward target dip while a ball exits.
  camera: {
    fov: 40,
    near: 0.1,
    far: 200,
    // Only two shots: a fixed frontal MAIN for the whole draw, and a small zoom
    // toward the outlet used ONLY while the drawn ball travels to its slot.
    shots: {
      MAIN:     { pos: [0, 0.2, 12.5], target: [0, -0.4, 0] },
      BALL_EXIT:{ pos: [0, -0.1, 11.8], target: [0, -1.25, 1.8] }, // ~5.6% closer
    },
  },

  quality: {
    presets: {
      ultra:  { dpr: 1.75, shadow: 2048, bloom: true, msaa: 4, env: 512, ballSeg: [44, 30] },
      high:   { dpr: 1.6,  shadow: 1536, bloom: true, msaa: 2, env: 256, ballSeg: [40, 28] },
      medium: { dpr: 1.35, shadow: 1024, bloom: true, msaa: 0, env: 256, ballSeg: [32, 22] },
      low:    { dpr: 1.15, shadow: 0,    bloom: false, msaa: 0, env: 128, ballSeg: [24, 16] },
    },
    order: ['ultra', 'high', 'medium', 'low'],
    downgradeBelowFps: 42,
    upgradeAboveFps: 57,
    sampleSeconds: 2.5,
  },

  colors: {
    backgroundTop: 0x0a1122,
    backgroundBottom: 0x05070f,
    floor: 0x0d1220,
    silver: 0xb9c2d0,
    graphite: 0x181d29,
    gold: 0xcaa85f,
    coolLight: 0x7ea4ff,
    warmLight: 0xffd98a,
  },
};

/**
 * Mass of one lottery ball, in world units — every ball is the same solid sphere
 * collider, so this is exactly what Rapier computes for it. Hoisted because the
 * air drag and the wall contact both need it for every ball every frame, and
 * `body.mass()` is a call across the WASM boundary.
 */
export const BALL_MASS = (4 / 3) * Math.PI * CONFIG.ball.radius ** 3 * CONFIG.ball.density;
