// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for tuning. Units: meters, seconds, radians (…Deg = degrees).
// ─────────────────────────────────────────────────────────────────────────────

export const CONTROLS = {
  forward: ['KeyW'],
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['Space'],
  slide: ['ControlLeft', 'ControlRight', 'KeyC'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  grapple: ['KeyE'],
  grappleMouseButton: 2, // right mouse
  debugToggle: ['F3', 'Backquote'],
  mouseSensitivity: 0.0022, // radians per pixel
}

// Fixed simulation step. Player is simulated in useBeforePhysicsStep at this rate.
export const PHYSICS = { timeStep: 1 / 60 }

// Capsule: total height = 2*halfHeight + 2*radius = 1.8 m. Body origin = capsule center.
export const PLAYER = {
  radius: 0.35,
  halfHeight: 0.55,
  eyeAboveCenter: 0.7, // eye = 1.6 m above feet
  skin: 0.02, // KCC contact offset
  stepHeight: 0.3, // auto-step up small ledges
  stepMinWidth: 0.15,
  snapDistance: 0.25, // stick to ground on downhill
  maxPitchDeg: 88,
}

// Surface classification from the contact normal (never from object names).
export const SURFACE = {
  FLOOR_MIN_NY: 0.7, // normal.y >  0.7        → floor
  WALL_MAX_ABS_NY: 0.3, // |normal.y| < 0.3    → wall
  // everything else                           → slope
}

// If a spawn marker's facing looks mirrored in-game, flip this to [0, 0, 1].
export const SPAWN_FORWARD = [0, 0, -1]

export const DOUBLE_JUMP = {
  // 'anyFloor'        → landing on any floor-classified surface resets it
  // 'differentObject' → landing object must differ from the object last taken off from
  resetMode: 'anyFloor',
  resetOnGrapple: false, // hooks for later; flip to true to restore on grapple release
  resetOnWallJump: false,
  wallJumpCostsCharge: true, // a wall jump spends one charge and is blocked at 0 charges (doesn't touch the per-airtime allowance)
  resetOnWallRun: true, // restore the double jump when a wall run starts
  // Consumable charges: every double jump costs one charge, regardless of the reset rules above (those only decide WHEN you may
  // double jump; the charge decides IF you can). Charges refill one at a time. Respawning does not refill them.
  maxCharges: 7,
  rechargeSeconds: 1.5, // time to regain ONE charge (only ticks while below max)
}

export const MOVE = {
  gravity: 26, // while rising
  fallGravityMult: 1.45, // heavier on the way down → snappy, less floaty
  apexGravityMult: 0.65, // slight hang near the top of a jump
  apexSpeed: 2, // |vy| below this counts as "apex"
  jumpCutGravityMult: 2.6, // extra gravity when jump is released early (variable jump height)
  maxFallSpeed: 50,

  // ground
  walkSpeed: 7,
  sprintSpeed: 11.5,
  groundAccel: 70, // m/s² toward the wish direction
  groundTurnFriction: 16, // 1/s — kills velocity that is NOT along the wish direction (crisp direction changes)
  groundOverspeedFriction: 4, // 1/s — bleeds speed above the current max (e.g. after a slide) instead of snapping
  groundFriction: 9, // 1/s (Quake-style, only used with no input)
  stopSpeed: 3,
  groundProbeTolerance: 0.15, // feet within this of a floor → grounded
  groundProbeRange: 1.6, // how far below feet we look (also used as wall-run clearance)
  groundMaxUpVelocity: 0.5, // moving up faster than this can't be "grounded"

  // air
  airMaxSpeed: 10,
  airAccel: 42,

  // jumping
  jumpSpeed: 9.5,
  doubleJumpSpeed: 8.8,
  doubleJumpRedirect: 0.5, // 0..1 blend of horizontal velocity toward input
  doubleJumpMinSpeed: 6,
  doubleJumpDelay: 0.18, // can't double jump this soon after leaving the ground / first jump
  doubleJumpGroundBuffer: 0.7, // falling & this close to the ground → the press is saved as a landing jump instead
  coyoteTime: 0.14,
  jumpBuffer: 0.16,
  slideJumpBoost: 1.1, // multiplier on horizontal speed when you jump out of a slide (rewards slide → jump chains)
  slideJumpMaxSpeed: 18, // ...but never pushes you past this (a boost still never *reduces* speed you already had)
  doubleJumpBurst: 2.2, // m/s added along your input direction on a double jump (feels like a thrust, not just a hop)
  doubleJumpBurstCap: 14, // burst can't take horizontal speed above max(this, speed you already had)

  // floor slide
  slideStartSpeed: 5.5,
  slideEndSpeed: 3,
  slideEntryBoost: 1.1,
  slideCooldown: 0.5, // after a slide ends, can't start another (stops speed-farming)
  slideMaxSpeed: 17,
  slideFriction: 0.8, // 1/s at high speed — low on purpose
  slideLowSpeedFriction: 5, // extra friction ramped in as speed drops → slide eases out
  slideFrictionRampFrom: 8, // speed at which the ramp begins
  slideTurnRate: 1.8, // rad/s the slide direction can bend
  slideSlopeAccel: 1.0, // multiplier on gravity-along-slope (downhill speeds you up)

  grappleMinHold: 0.05, // a tap shorter than one or two sim steps still registers

  // wall run
  wallProbeDistance: 0.25, // beyond capsule radius
  wallIntoDot: 0.25, // input·(-normal) needed for "pressing toward wall"
  wallRunMinSpeed: 5.5,
  wallRunSpeed: 9,
  wallRunAccel: 3.5, // m/s² gained while running along a wall → long runs build speed
  wallRunMaxSpeed: 13, // (speed you carried in above this is kept, never cut)
  wallRunGravityScale: 0.12,
  wallRunMaxDuration: 1.8,
  wallRunStickSpeed: 2,
  wallRunEntryLift: 1.0,
  wallRunMaxEnterUp: 12,
  wallRunMinClearance: 1.0, // must be this high above the floor to start/keep running
  wallJumpAway: 7.5,
  wallJumpUp: 9,
  wallJumpKeep: 0.8,
  wallLockTime: 0.3, // after a wall jump, wall states are disabled this long

  // wall slide
  wallSlideFallSpeed: 2.5,
  wallSlideDecel: 40,
}

export const CAMERA = {
  baseFov: 90,
  fovBoost: 16,
  fovStartSpeed: 8,
  fovFullSpeed: 22,
  fovLerp: 6,
  wallRunTiltDeg: 7,
  tiltLerp: 8,
  landDipMinImpact: 4,
  landDipPerSpeed: 0.012,
  landDipMax: 0.22,
  landDipRecover: 9,
  slideEyeDrop: 0.45,
  strafeRollDeg: 1.6,
  slideRollDeg: 2.5,
  bobAmount: 0.035, // vertical eye bob while running
  bobFreq: 0.62, // cycles per meter
  swayAmount: 0.03, // side-to-side eye sway while running (m), at half the bob frequency (left foot / right foot)
  swayRollDeg: 0.5, // tiny roll that follows the sway

  // speed shake: low-amplitude noise on pitch/roll that fades in with speed (scaled per state below)
  shakeDeg: 0.28,
  shakeStartSpeed: 9,
  shakeFullSpeed: 22,
  shakeStateMult: { grounded: 0.35, airborne: 0.8, sliding: 1.3, wallRunning: 1.4, wallSliding: 0.6, grappling: 1.1 },

  // landing also kicks the view down (pitch only — your aim, ps.pitch, is never touched)
  landPitchPerSpeed: 0.0032, // radians per m/s of impact
  landPitchMax: 0.05,

  // one-shot impulses, fired by movement events and decaying back to 0. fov = degrees added, pitch = degrees (+ = look up),
  // roll = degrees, signed by which side the event happened on (wall jump rolls you the way you push off).
  kicks: {
    jump: { fov: 1.5, pitch: 0.4 },
    doubleJump: { fov: 7, pitch: 1.1 },
    wallJump: { fov: 4.5, pitch: 0.8, roll: 4 },
    slide: { fov: 3.5, pitch: -0.6 },
    wallRun: { fov: 3, pitch: 0, roll: 2 },
    grapple: { fov: 7, pitch: 0.8 },
  },
  fovKickRecover: 6,
  pitchKickRecover: 9,
  rollKickRecover: 7,
}

export const GAMEPLAY = { maxHealth: 100, healthPickupAmount: 25 }

// Post-processing bloom (@react-three/postprocessing). Scene renders in linear HDR, so only pixels brighter than
// `threshold` glow: emissive materials with emissiveIntensity > ~1 bloom, ordinary lit surfaces and the sky don't.
export const BLOOM = {
  intensity: 1.1,
  threshold: 0.9, // luminance where glow starts
  smoothing: 0.25, // soft knee above the threshold, so dimmer emissives glow a little
  radius: 0.75, // mip-blur spread
}