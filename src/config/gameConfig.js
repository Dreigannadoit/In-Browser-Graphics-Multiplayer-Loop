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
  resetOnMantle: true, // restore the double jump when you pull up onto a ledge
  // Consumable charges: every double jump costs one charge, regardless of the reset rules above (those only decide WHEN you may
  // double jump; the charge decides IF you can). Charges refill one at a time. Respawning does not refill them.
  maxCharges: 12,
  rechargeSeconds: 1.5, // time to regain ONE charge (only ticks while below max)
}

export const MOVE = {
  gravity: 26, // while rising
  fallGravityMult: 1.3, // heavier on the way down (lower = floatier/rounder arc)
  apexGravityMult: 0.65, // slight hang near the top of a jump
  apexSpeed: 2, // |vy| below this counts as "apex"
  jumpCutGravityMult: 2.0, // extra gravity when jump is released early (variable jump height)
  maxFallSpeed: 50,

  // ground
  walkSpeed: 7,
  sprintSpeed: 11.5,
  inputSmoothing: 12, // 1/s — eases WASD input so direction changes sweep instead of snapping (0 = raw input, lower = smoother/slower)
  groundAccel: 50, // m/s² toward the wish direction
  groundTurnFriction: 9, // 1/s — kills velocity that is NOT along the wish direction (crisp direction changes)
  groundOverspeedFriction: 4, // 1/s — bleeds speed above the current max (e.g. after a slide) instead of snapping
  groundFriction: 6, // 1/s (Quake-style, only used with no input)
  stopSpeed: 3,
  groundProbeTolerance: 0.15, // feet within this of a floor → grounded
  groundProbeRange: 1.6, // how far below feet we look (also used as wall-run clearance)
  groundMaxUpVelocity: 0.5, // moving up faster than this can't be "grounded"

  // air
  airMaxSpeed: 10,
  airAccel: 30,

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
  wallSlideDecel: 24,

  // ledge mantle: airborne + pushing into a wall whose top edge is within reach → auto pull-up (rise, then step over)
  mantleMinHeight: 0.45, // ledge top must be at least this far above your feet (lower than this is a normal step / jump)
  mantleMaxHeight: 2.0, // ...and at most this far above your feet
  mantleReach: 0.35, // how far past the capsule edge the wall may be
  mantleIntoDot: 0.5, // input·(-wallNormal) needed to grab (you have to be pushing into the ledge)
  mantleMaxUpSpeed: 5, // still rising faster than this → too early to grab (a jump has to peak first)
  mantleRiseSpeed: 7.5, // m/s up the face of the wall
  mantleForwardSpeed: 5, // m/s over the lip
  mantleExitSpeed: 4.5, // horizontal speed handed back on top (never less than mantleKeepMomentum of what you came in with)
  mantleKeepMomentum: 0.7,
  mantleLock: 0.25, // after a mantle, can't start another this soon
  mantleMaxDuration: 0.9, // safety timeout — a blocked mantle gives up
}

export const CAMERA = {
  baseFov: 90,
  fovBoost: 16,
  fovStartSpeed: 8,
  fovFullSpeed: 22,
  fovLerp: 4.5,
  wallRunTiltDeg: 7,
  tiltLerp: 6,
  landDipMinImpact: 4,
  landDipPerSpeed: 0.012,
  landDipMax: 0.22,
  landDipRecover: 6.5,
  slideEyeDrop: 0.45,
  strafeRollDeg: 1.6,
  slideRollDeg: 2.5,
  bobAmount: 0.035, // vertical eye bob while running
  bobFreq: 0.62, // cycles per meter
  swayAmount: 0.03, // side-to-side eye sway while running (m), at half the bob frequency (left foot / right foot)
  swayRollDeg: 0.5, // tiny roll that follows the sway

  // speed shake: low-amplitude noise on pitch/roll that fades in with speed (scaled per state below)
  shakeDeg: 0.2,
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
    mantle: { fov: 2.5, pitch: 1.0 }, // grab: view lifts as you haul up
    mantleTop: { fov: 1.5, pitch: -1.4 }, // arrive on top: view settles down
    hit: { fov: 3, pitch: 2.2, roll: 5 }, // an enemy hit lands: view jolts back (roll is signed by which side it came from)
  },
  // Step-up smoothing: when auto-step snaps the body up/down a small ledge, the eye lags behind and catches up
  // instead of popping. Only applies on flat floors (so walking up a ramp never triggers it).
  stepSmooth: {
    minRise: 0.04, // m — smaller vertical snaps are ignored
    flatNormalY: 0.995, // floor must be this flat for a snap to count as a step (rules out slopes)
    recover: 13, // 1/s — how fast the eye catches up
    maxOffset: 0.4, // m — eye never lags more than this
  },
  fovKickRecover: 4.5,
  pitchKickRecover: 6.5,
  rollKickRecover: 5,
}

export const GAMEPLAY = { maxHealth: 100, healthPickupAmount: 25 }

// ─────────────────────────────────────────────────────────────────────────────
// Enemies. Global settings first, then one entry per enemy kind in `types` (src/enemies/*).
// Distances in metres, times in seconds of WORLD time (they slow down with dev.timeScale / future Superhot time scale).
//
// To add a kind (melee, pistol, sniper, machinegun…): copy `unarmed`, point `clips` at its FBX files, give it its own `ai`
// behaviour (src/enemies/brain.js → BEHAVIORS) and, if it carries one, a `weapon` (see the comment on `weapon` below).
// Map markers pick the kind from their name:  Spawn_Enemy_<Kind>_<ID>  e.g. Spawn_Enemy_Unarmed_01  (kind is case-insensitive).
// ─────────────────────────────────────────────────────────────────────────────
export const ENEMIES = {
  enabled: true,
  model: '/enemies/superhot_enemy_t_pose.fbx', // skeleton + mesh every enemy is built from (the clips only reuse its bone names)
  height: 1.8, // the model is rescaled to this height, whatever units the FBX was exported in
  modelYawOffset: 0, // radians. Enemies running/punching backwards? set Math.PI
  crossfade: 0.18, // seconds to blend between clips
  aggroRange: 90, // idle enemies start chasing when the player is this close
  gravity: 26,
  maxFallSpeed: 50,
  fallDespawnBelow: 40, // an enemy this far below the lowest point of the map is removed
  corpseTime: 4, // seconds before a dead enemy disappears
  // kinematic character controller (same idea as PLAYER)
  skin: 0.02,
  stepHeight: 0.3,
  stepMinWidth: 0.15,
  snapDistance: 0.25,
  // enemies shove each other apart so a crowd doesn't stack into one body
  separation: { radius: 1.0, speed: 2.5 },
  // Map has no Spawn_Enemy_* markers? 'targets' = use the Spawn_Target_* markers as stand-ins, 'none' = spawn nothing
  fallbackSpawn: 'targets',

  types: {
    unarmed: {
      ai: 'melee', // behaviour preset (src/enemies/brain.js)
      health: 100,
      capsule: { radius: PLAYER.radius, halfHeight: PLAYER.halfHeight }, // collision shape, 1.8 m like the player
      reactionTime: 0.4, // standing guard for this long before the first charge
      accel: 30, // m/s²
      turnRate: 9, // rad/s while chasing
      stopDistance: 1.0, // stops this far (centre to centre) from the player instead of walking into them

      // Picked once per enemy (weighted), so a group doesn't move in lockstep.
      // speed = real m/s. refSpeed = the m/s the clip was animated at (measured from the FBX): speed/refSpeed sets the clip speed,
      // which keeps the feet from sliding. Both clips had root motion in them; it is removed at load, movement comes from here.
      locomotion: [
        { clip: 'run', speed: 5.4, refSpeed: 5.9, weight: 3 },
        { clip: 'jog', speed: 3.4, refSpeed: 2.6, weight: 1 },
      ],

      attack: {
        range: 1.6, // starts a punch when the player is this close (centre to centre, horizontal)
        cooldown: 0.6, // pause after a combo before the next one
        windupTurnRate: 4, // rad/s the enemy can still track the player during the windup (dodging works because this is low)
        hitRange: 1.9, // the punch connects if the player is within this at hitTime...
        hitArc: 75, // ...and within this many degrees of where the enemy faces (half-angle)...
        hitHeight: 1.4, // ...and within this vertical distance (centre to centre)
        knockback: 5, // m/s shove on the player
        // One of these is picked per attack (never the same twice in a row).
        // hitTime = seconds into the clip when the fist lands (measured from the animation), end = seconds when the clip is cut off
        // (the originals keep recovering for another second), lunge = metres the enemy steps forward into the punch.
        moves: [
          { clip: 'punch1', hitTime: 0.43, end: 1.05, lunge: 0.45, damage: 10 }, // boxing1: lead hand
          { clip: 'punch2', hitTime: 0.62, end: 1.3, lunge: 0.45, damage: 14 }, // boxing2: hook
        ],
      },

      // key → FBX. loop:false = play once. rootMotion:true keeps the clip's own hip travel (default strips it).
      clips: {
        idle: { file: '/enemies/unarmed/superhot_enemy_boxing0.fbx' }, // boxing guard, bobbing
        run: { file: '/enemies/unarmed/superhot_enemy_running.fbx' },
        jog: { file: '/enemies/unarmed/superhot_enemy_jogging.fbx' },
        punch1: { file: '/enemies/unarmed/superhot_enemy_boxing1.fbx', loop: false },
        punch2: { file: '/enemies/unarmed/superhot_enemy_boxing2.fbx', loop: false },
        // die: { file: '/enemies/unarmed/…_death.fbx', loop: false }, // no death clip yet: dead enemies topple over procedurally
      },

      // Held item, attached to a bone. Example for later (units are metres, bone-local axes, tune by eye):
      // weapon: { bone: 'RightHand', create: () => new THREE.Mesh(/* … */), position: [0, 0.1, 0], rotation: [0, 0, 0] },
      weapon: null,
    },

    // melee:      { ai: 'melee',   … clips in /enemies/melee/   (idle, running, standing_attack_horizontal), weapon: katana }
    // pistol:     { ai: 'ranged',  … clips in /enemies/pistol/  (idle, running, shooting_in_place),          weapon: pistol }
    // sniper:     { ai: 'ranged',  … long aggro/attack range, stays put and aims }
    // machinegun: { ai: 'ranged',  … short bursts, fast fire rate }
  },
}

// Post-processing bloom (@react-three/postprocessing). Scene renders in linear HDR, so only pixels brighter than
// `threshold` glow: emissive materials with emissiveIntensity > ~1 bloom, ordinary lit surfaces and the sky don't.
export const BLOOM = {
  intensity: 1.1,
  threshold: 0.9, // luminance where glow starts
  smoothing: 0.25, // soft knee above the threshold, so dimmer emissives glow a little
  radius: 0.75, // mip-blur spread
}

// Cartoon look. LOOK = the overall palette/atmosphere, TOON = stepped (cel) lighting on the map, OUTLINE = ink lines + shadow tint
// drawn as a post effect (see render/OutlineEffect.js). Toon materials are applied once when the map loads (reload to see TOON changes).
export const LOOK = {
  // Gradient sky dome. `horizon` is also the fog colour, so distant geometry melts into the sky instead of ending in a hard dark edge.
  sky: { top: '#4f9bff', horizon: '#cfe9ff', ground: '#9fc4ee', bands: 0 }, // bands: 0 = smooth, 5 = hard painted stripes
  fog: { near: 45, far: 240 }, // metres
  sun: { intensity: 2.3 },
  hemi: { sky: '#e4f2ff', ground: '#9a86e0', intensity: 1.0 }, // soft fill: sky-blue from above, violet bounce from below
  toneMapping: 'NEUTRAL', // keeps colours saturated (ACES_FILMIC greys and darkens them). Falls back to ACES_FILMIC if unavailable
}

export const TOON = {
  enabled: true,
  steps: [0.58, 0.82, 1.0], // light ramp, darkest -> brightest. Closer values = softer; [0.5, 1.0] for a hard 2-tone
  saturation: 1.0, // 1 = untouched map colours
}

export const OUTLINE = {
  enabled: true,
  color: '#1b1226', // ink colour (a dark purple reads warmer than pure black)
  strength: 1, // 0..1 how solid the ink is
  // Line thickness follows distance: `width` pixels at widthRefDist metres, thicker when closer (never more than maxWidth),
  // thinner when farther (never less than minWidth; below that the ink fades instead). widthFalloff is how fast it changes:
  // 1 = true perspective (twice as far = half as thick), 0.5 = gentler, 0 = same thickness at every distance.
  width: 5, // pixels at widthRefDist
  maxWidth: 12, // pixels: thickest line, right up close
  minWidth: 2, // pixels: thinnest line at long range (min 1)
  widthRefDist: 10, // metres at which a line is exactly `width` pixels (shared by all kinds)
  widthFalloff: 0.7,
  threshold: 0.012, // how bent a surface must be to get a line; lower = more lines (creases), higher = silhouettes only
  fadeStart: 45, // metres: lines start to fade out...
  fadeEnd: 140, // ...and vanish (stops far geometry turning into noise)
  // Shadow tint: raises near-black pixels to a deep colour instead of pure black (the map's dark panels become navy, not holes).
  shadowColor: '#2b2a7a',
  shadowLift: 0.6, // 0 = off
  shadowRange: 0.12, // linear brightness below which the tint applies

  // The values above style MAP GEOMETRY (big flat surfaces). Enemies and grapple points get their own ink, because a line tuned for
  // walls turns a small low-poly character into a black blob (every facet crease inked, thin limbs swallowed) and stacks with the
  // grapple spheres' own black hull. width/maxWidth/minWidth are pixels (same distance rule as above), threshold is how bent a surface must be to get a line (higher = only
  // silhouettes and overlaps), enabled:false = no ink at all for that kind.
  enemy: { enabled: true, color: '#2a0610', strength: 1, width: 2, maxWidth: 6, minWidth: 1, threshold: 0.04 },
  point: { enabled: true, color: '#05060f', strength: 0.8, width: 2, maxWidth: 4, minWidth: 1, threshold: 0.03 },
}
