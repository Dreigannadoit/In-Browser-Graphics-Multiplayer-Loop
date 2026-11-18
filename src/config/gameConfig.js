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
  resetOnWallRun: true, // restore the double jump when a wall run starts
}

export const MOVE = {
  gravity: 28,
  maxFallSpeed: 50,

  // ground
  groundMaxSpeed: 9,
  groundAccel: 80, // m/s²
  groundFriction: 9, // 1/s (Quake-style, scaled by max(speed, stopSpeed))
  stopSpeed: 3,
  groundProbeTolerance: 0.15, // feet within this of a floor → grounded
  groundProbeRange: 1.6, // how far below feet we look (also used as wall-run clearance)
  groundMaxUpVelocity: 0.5, // moving up faster than this can't be "grounded"

  // air
  airMaxSpeed: 9,
  airAccel: 26,

  // jumping
  jumpSpeed: 9.5, // ≈1.6 m apex
  doubleJumpSpeed: 8.5,
  doubleJumpRedirect: 0.6, // 0..1 blend of horizontal velocity toward input
  doubleJumpMinSpeed: 6,
  coyoteTime: 0.1,
  jumpBuffer: 0.12,

  // floor slide
  slideStartSpeed: 6,
  slideEndSpeed: 3.5,
  slideEntryBoost: 1.12,
  slideMaxSpeed: 17,
  slideFriction: 0.9, // 1/s — low on purpose
  slideSteer: 3,

  // wall run
  wallProbeDistance: 0.25, // beyond capsule radius
  wallIntoDot: 0.25, // input·(-normal) needed for "pressing toward wall"
  wallRunMinSpeed: 5.5,
  wallRunSpeed: 9,
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
  fovStartSpeed: 9,
  fovFullSpeed: 22,
  fovLerp: 6,
  wallRunTiltDeg: 7,
  tiltLerp: 8,
  landDipMinImpact: 4,
  landDipPerSpeed: 0.012,
  landDipMax: 0.22,
  landDipRecover: 9,
  slideEyeDrop: 0.45,
}

export const GAMEPLAY = { maxHealth: 100, healthPickupAmount: 25 }
