// Movement simulation: pure JS (THREE math only). No React, no Rapier, no DOM.
// One call to stepPlayer() = one fixed step. All state transitions are in resolveState().
import * as THREE from 'three'
import { MOVE, PLAYER, DOUBLE_JUMP } from '../config/gameConfig'
import { consumeDoubleJump, spendDoubleJumpCharge, tickDoubleJumpCharges, resetDoubleJump, onFloorContactStart, onLeaveGround, lookDirection } from './state'
import { findGrappleTarget } from './grapple'

export const STATES = Object.freeze({
  GROUNDED: 'grounded',
  AIRBORNE: 'airborne',
  SLIDING: 'sliding',
  WALL_RUNNING: 'wallRunning',
  WALL_SLIDING: 'wallSliding',
  GRAPPLING: 'grappling',
})
const S = STATES

const _wish = new THREE.Vector3()
const _eye = new THREE.Vector3()
const _look = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _target = new THREE.Vector3()
const _steer = new THREE.Vector3()

// ── helpers ──────────────────────────────────────────────────────────────────
/** Camera-relative horizontal wish direction (unit) written to out. Returns input magnitude 0..1. */
function wishDirection(ps, inp, out) {
  const s = Math.sin(ps.yaw)
  const c = Math.cos(ps.yaw)
  out.set(inp.moveX * c - inp.moveZ * s, 0, -inp.moveX * s - inp.moveZ * c)
  const len = out.length()
  if (len < 1e-4) return 0
  out.multiplyScalar(1 / len)
  return Math.min(1, len)
}

/** Accelerate toward wishSpeed along dir without ever *reducing* speed already above it (momentum is kept). */
function accelerate(vel, dir, wishSpeed, accel, dt) {
  const add = wishSpeed - (vel.x * dir.x + vel.z * dir.z)
  if (add <= 0) return
  const a = Math.min(add, accel * dt)
  vel.x += dir.x * a
  vel.z += dir.z * a
}

/** Ground movement: friction only fights velocity that isn't going where you want, so top speed is really reached. */
function groundMove(ps, c, dt) {
  const vel = ps.vel
  if (!c.wishMag) return groundFriction(vel, dt)
  const maxSpeed = (ps.sprinting ? MOVE.sprintSpeed : MOVE.walkSpeed) * c.wishMag
  const par = vel.x * _wish.x + vel.z * _wish.z
  let px = _wish.x * par
  let pz = _wish.z * par
  let qx = vel.x - px // sideways / opposing part
  let qz = vel.z - pz
  const kq = Math.max(0, 1 - MOVE.groundTurnFriction * dt)
  qx *= kq
  qz *= kq
  let npar = par
  if (par < maxSpeed) npar = Math.min(maxSpeed, par + MOVE.groundAccel * dt * (par < 0 ? 1.6 : 1))
  else npar = Math.max(maxSpeed, par - Math.max(par, MOVE.stopSpeed) * MOVE.groundOverspeedFriction * dt)
  vel.x = _wish.x * npar + qx
  vel.z = _wish.z * npar + qz
}

function groundFriction(vel, dt) {
  const sp = Math.hypot(vel.x, vel.z)
  if (sp < 1e-4) return
  const k = Math.max(0, sp - Math.max(sp, MOVE.stopSpeed) * MOVE.groundFriction * dt) / sp
  vel.x *= k
  vel.z *= k
}

/** Air steering that rotates/adds velocity but can't create speed beyond max(previous, airMaxSpeed). */
function airControl(ps, c, dt) {
  if (!c.wishMag) return
  const before = Math.hypot(ps.vel.x, ps.vel.z)
  accelerate(ps.vel, _wish, MOVE.airMaxSpeed * c.wishMag, MOVE.airAccel, dt)
  const after = Math.hypot(ps.vel.x, ps.vel.z)
  const limit = Math.max(before, MOVE.airMaxSpeed)
  if (after > limit) {
    const k = limit / after
    ps.vel.x *= k
    ps.vel.z *= k
  }
}

/** Rising = base gravity, apex = lighter (hang), falling = heavier, released jump key = heavier (variable height). */
function jumpGravityScale(ps, inp) {
  const vy = ps.vel.y
  if (vy > 0) {
    if (ps.jumpCut && !inp.jumpHeld) return MOVE.jumpCutGravityMult
    return Math.abs(vy) < MOVE.apexSpeed ? MOVE.apexGravityMult : 1
  }
  return Math.abs(vy) < MOVE.apexSpeed ? MOVE.apexGravityMult : MOVE.fallGravityMult
}

function applyGravity(ps, scale, dt) {
  ps.vel.y = Math.max(ps.vel.y - MOVE.gravity * scale * dt, -MOVE.maxFallSpeed)
}

// ── jumping ──────────────────────────────────────────────────────────────────
function groundJump(ps, c) {
  ps.vel.y = MOVE.jumpSpeed // normal jump: does NOT touch canDoubleJump
  ps.jumpCut = true
  ps.jumpedAt = ps.time
  if (c.grounded) onLeaveGround(ps)
  ps.grounded = false
  c.grounded = false
  ps.coyote = 0
  ps.jumpBuffer = 0
}

function doubleJump(ps, c) {
  consumeDoubleJump(ps) // sets canDoubleJump = false immediately
  ps.vel.y = Math.max(MOVE.doubleJumpSpeed, ps.vel.y + MOVE.doubleJumpSpeed * 0.5) // always a clean lift, even from a fast fall
  ps.jumpCut = true
  ps.jumpedAt = ps.time
  if (c.wishMag > 0.1) {
    // rotate/blend the horizontal velocity toward input but never lose speed
    const target = Math.max(c.hSpeed, MOVE.doubleJumpMinSpeed)
    ps.vel.x += (_wish.x * target - ps.vel.x) * MOVE.doubleJumpRedirect
    ps.vel.z += (_wish.z * target - ps.vel.z) * MOVE.doubleJumpRedirect
    const after = Math.hypot(ps.vel.x, ps.vel.z)
    if (after > 1e-3 && after < c.hSpeed) {
      ps.vel.x *= c.hSpeed / after
      ps.vel.z *= c.hSpeed / after
    }
  }
  ps.jumpBuffer = 0
  c.doubleJumped = true
}

function wallJump(ps, c) {
  const n = (c.wall ?? ps.lastWall)?.normal
  if (!n) return
  if (DOUBLE_JUMP.wallJumpCostsCharge) spendDoubleJumpCharge(ps) // caller guarantees a charge is available
  ps.vel.x = ps.vel.x * MOVE.wallJumpKeep + n.x * MOVE.wallJumpAway
  ps.vel.z = ps.vel.z * MOVE.wallJumpKeep + n.z * MOVE.wallJumpAway
  ps.vel.y = MOVE.wallJumpUp
  ps.jumpCut = false
  ps.wallLockUntil = ps.time + MOVE.wallLockTime
  ps.wallRunExhausted = false
  ps.jumpBuffer = 0
  if (DOUBLE_JUMP.resetOnWallJump) resetDoubleJump(ps, 'wall-jump')
}

function handleJump(ps, c, inp) {
  const s = ps.state
  if (s === S.WALL_RUNNING || s === S.WALL_SLIDING) {
    if (!(inp.jumpPressed || ps.jumpBuffer > 0)) return
    if (DOUBLE_JUMP.wallJumpCostsCharge && ps.djCharges < 1) return // out of charges → no wall jump either
    wallJump(ps, c)
    return
  }
  if (ps.jumpBuffer > 0 && (c.grounded || ps.coyote > 0)) return groundJump(ps, c)
  // double jump needs a fresh press (a buffered press must not silently burn it)
  if (!inp.jumpPressed || c.grounded || !ps.canDoubleJump || ps.djCharges < 1) return // no charge → no double jump
  if (ps.time - ps.jumpedAt < MOVE.doubleJumpDelay) return // accidental double-tap right after takeoff
  // about to land? keep the press buffered so it becomes a normal jump on touchdown instead of burning the double jump
  if (ps.vel.y <= 0 && c.ground.hit && c.ground.kind === 'floor' && c.ground.gap < MOVE.doubleJumpGroundBuffer) return
  doubleJump(ps, c)
}

// ── THE state machine: all transitions are decided here ──────────────────────
function wallRunAllowed(ps, c, entering) {
  const w = c.wall
  if (!w || w.noRun || !c.runIntent) return false // Geo_NoRun → userData.noRun
  if (ps.wallRunExhausted || ps.time < ps.wallLockUntil) return false
  if (c.clearance < MOVE.wallRunMinClearance) return false
  if (entering) return c.hSpeed >= MOVE.wallRunMinSpeed && ps.vel.y <= MOVE.wallRunMaxEnterUp
  return c.hSpeed >= MOVE.wallRunMinSpeed * 0.6
}

function resolveState(ps, c, inp) {
  const s = ps.state

  if (s === S.GRAPPLING) return c.grappleEnded ? (c.grounded ? S.GROUNDED : S.AIRBORNE) : S.GRAPPLING
  if (c.grappleStart) return S.GRAPPLING

  if (c.grounded) {
    const keep = s === S.SLIDING ? c.hSpeed > MOVE.slideEndSpeed : c.hSpeed >= MOVE.slideStartSpeed && ps.time >= ps.slideCooldownUntil
    return inp.slideHeld && keep ? S.SLIDING : S.GROUNDED
  }

  if (c.wall && ps.time >= ps.wallLockUntil) {
    if (wallRunAllowed(ps, c, s !== S.WALL_RUNNING)) return S.WALL_RUNNING
    // wall slide works on ANY wall-classified surface, including noRun
    if (c.intoWall && (ps.vel.y <= 0 || s === S.WALL_SLIDING)) return S.WALL_SLIDING
  }
  return S.AIRBORNE
}

const ENTER = {
  [S.SLIDING]: (ps, c) => {
    if (c.hSpeed < 1e-3) return
    const target = Math.max(c.hSpeed, Math.min(c.hSpeed * MOVE.slideEntryBoost, MOVE.slideMaxSpeed))
    const k = target / c.hSpeed
    ps.vel.x *= k
    ps.vel.z *= k
  },
  [S.WALL_RUNNING]: (ps) => {
    ps.wallRunTime = 0
    ps.vel.y = Math.max(ps.vel.y, MOVE.wallRunEntryLift)
    if (DOUBLE_JUMP.resetOnWallRun) resetDoubleJump(ps, 'wall-run')
  },
  [S.GRAPPLING]: (ps) => {
    ps.coyote = 0
  },
}
const EXIT = {
  [S.SLIDING]: (ps) => {
    ps.slideCooldownUntil = ps.time + MOVE.slideCooldown
  },
  [S.GRAPPLING]: (ps) => {
    ps.grapple = null // velocity is untouched → momentum carries out of the pull
    ps.wallRunExhausted = false
    if (DOUBLE_JUMP.resetOnGrapple) resetDoubleJump(ps, 'grapple')
  },
}

// ── per-state velocity updates ───────────────────────────────────────────────
const RUN = {
  [S.GROUNDED]: (ps, c, dt) => {
    groundMove(ps, c, dt)
    ps.vel.y = 0
  },

  [S.AIRBORNE]: (ps, c, dt, inp) => {
    applyGravity(ps, jumpGravityScale(ps, inp), dt)
    airControl(ps, c, dt)
  },

  [S.SLIDING]: (ps, c, dt) => {
    // friction: low at speed, ramps up as the slide runs out so it eases to a stop
    const rampT = Math.min(1, Math.max(0, (MOVE.slideFrictionRampFrom - c.hSpeed) / (MOVE.slideFrictionRampFrom - MOVE.slideEndSpeed)))
    const k = Math.max(0, 1 - (MOVE.slideFriction + rampT * MOVE.slideLowSpeedFriction) * dt)
    ps.vel.x *= k
    ps.vel.z *= k

    // downhill speeds you up, uphill slows you down
    const n = c.ground.normal
    if (c.ground.hit && n.y < 0.999) {
      ps.vel.x += n.x * n.y * MOVE.gravity * MOVE.slideSlopeAccel * dt
      ps.vel.z += n.z * n.y * MOVE.gravity * MOVE.slideSlopeAccel * dt
    }
    let sp = Math.hypot(ps.vel.x, ps.vel.z)
    if (sp > MOVE.slideMaxSpeed) {
      ps.vel.x *= MOVE.slideMaxSpeed / sp
      ps.vel.z *= MOVE.slideMaxSpeed / sp
      sp = MOVE.slideMaxSpeed
    }

    // steer: rotate the heading toward the input side at a capped turn rate (speed unchanged, no flips)
    if (c.wishMag && sp > 1e-3) {
      const hx = ps.vel.x / sp
      const hz = ps.vel.z / sp
      const side = hx * _wish.z - hz * _wish.x // sin(angle from heading to wish), + = wish is to the left of heading in xz
      const ang = Math.max(-1, Math.min(1, side * 2)) * MOVE.slideTurnRate * c.wishMag * dt
      const cs = Math.cos(ang)
      const sn = Math.sin(ang)
      ps.vel.x = (hx * cs - hz * sn) * sp
      ps.vel.z = (hx * sn + hz * cs) * sp
    }
    ps.vel.y = 0
  },

  [S.WALL_RUNNING]: (ps, c, dt) => {
    const n = c.wall.normal
    _tan.set(n.z, 0, -n.x) // cross(up, normal): direction along the wall
    let along = ps.vel.x * _tan.x + ps.vel.z * _tan.z
    // direction: the player's input decides (W = where the camera faces, S = back, A/D = sideways), so you can reverse mid-run.
    // Only when input is neutral do we keep going the way we were.
    const want = c.wishMag > 0.1 ? _wish.x * _tan.x + _wish.z * _tan.z : 0
    let sign
    if (Math.abs(want) > 0.25) sign = want
    else if (Math.abs(along) > 0.5) sign = along
    else sign = -Math.sin(ps.yaw) * _tan.x - Math.cos(ps.yaw) * _tan.z // fall back to look dir
    if (sign < 0) {
      _tan.negate()
      along = -along
    }
    along = Math.max(0, along) // speed we carry in the (possibly new) direction
    const base = ps.wallRunTime === 0 ? c.hSpeed : Math.max(along, c.hSpeed * 0.8)
    const speed = Math.max(base, MOVE.wallRunSpeed)
    ps.vel.x = _tan.x * speed - n.x * MOVE.wallRunStickSpeed
    ps.vel.z = _tan.z * speed - n.z * MOVE.wallRunStickSpeed
    applyGravity(ps, MOVE.wallRunGravityScale, dt)
    ps.wallRunTime += dt
    if (ps.wallRunTime >= MOVE.wallRunMaxDuration) ps.wallRunExhausted = true
  },

  [S.WALL_SLIDING]: (ps, c, dt) => {
    applyGravity(ps, 1, dt)
    if (ps.vel.y < -MOVE.wallSlideFallSpeed) {
      ps.vel.y = Math.min(-MOVE.wallSlideFallSpeed, ps.vel.y + MOVE.wallSlideDecel * dt)
    }
    airControl(ps, c, dt)
  },

  [S.GRAPPLING]: (ps, c, dt, inp) => {
    const s = ps.grapple.settings
    _target.copy(c.grappleDir).multiplyScalar(s.pullSpeed)
    // steering: input pushes the pull target sideways (perpendicular to the rope) → you curve left/right/up/down
    // while still being reeled in (pursuit curve), and keep that curved momentum on release
    if (inp.moveX !== 0 || inp.moveZ !== 0) {
      _look.set(Math.cos(ps.yaw), 0, -Math.sin(ps.yaw)) // camera right
      _tan.set(-Math.sin(ps.yaw), 0, -Math.cos(ps.yaw)) // camera forward (horizontal)
      _steer.set(0, 0, 0).addScaledVector(_look, inp.moveX).addScaledVector(_tan, inp.moveZ * 0.5)
      _steer.addScaledVector(c.grappleDir, -_steer.dot(c.grappleDir)) // remove the part along the rope
      if (_steer.lengthSq() > 1e-4) {
        _steer.normalize().multiplyScalar(s.pullSpeed * (s.steerFactor ?? 0.7) * Math.min(1, Math.hypot(inp.moveX, inp.moveZ)))
        _target.add(_steer)
      }
    }
    ps.vel.lerp(_target, Math.min(1, s.pullAccel * dt)) // blend from current velocity → momentum is kept
  },
}

// ── the step ─────────────────────────────────────────────────────────────────
export function stepPlayer(ps, inp, dt, phys, level) {
  ps.time += dt
  tickDoubleJumpCharges(ps, dt)
  ps.prevPos.copy(ps.pos)
  ps.jumpBuffer = inp.jumpPressed ? MOVE.jumpBuffer : Math.max(0, ps.jumpBuffer - dt)
  ps.coyote = Math.max(0, ps.coyote - dt)

  // 1. sense
  const ground = phys.probeGround(ps.pos)
  const wall = phys.probeWalls(ps.pos)
  if (wall) ps.lastWall = wall
  const hSpeed = Math.hypot(ps.vel.x, ps.vel.z)
  const wishMag = wishDirection(ps, inp, _wish)
  const grounded =
    ground.hit && ground.kind === 'floor' && ground.gap <= MOVE.groundProbeTolerance && ps.vel.y <= MOVE.groundMaxUpVelocity

  // sprint: hold while moving forward on the ground; momentum carries it through jumps (it only affects ground speed)
  if (grounded) ps.sprinting = inp.sprintHeld && inp.moveZ > 0 && ps.state !== S.SLIDING
  else if (!inp.sprintHeld) ps.sprinting = false

  // 2. floor-contact events (landing / takeoff)
  if (grounded && !ps.grounded) {
    ps.landImpact = Math.max(0, -ps.vel.y)
    ps.jumpCut = false
    ps.vel.y = 0
    ps.wallRunExhausted = false
    onFloorContactStart(ps, { name: ground.name, normal: ground.normal }) // → double-jump reset rule
  } else if (!grounded && ps.grounded) {
    onLeaveGround(ps)
    ps.coyote = MOVE.coyoteTime
    if (ps.time - ps.jumpedAt > 0.05) ps.jumpedAt = ps.time // walked off a ledge: start the double-jump delay now
  }
  ps.grounded = grounded
  if (grounded) ps.groundObjectName = ground.name

  ps.surfaceType = grounded ? 'floor' : wall ? 'wall' : ground.hit && ground.gap < 0.3 ? ground.kind : 'none'
  ps.surfaceName = grounded ? ground.name : wall ? wall.name : ground.hit && ground.gap < 0.3 ? ground.name : null

  const c = {
    grounded, ground, wall, hSpeed, wishMag,
    clearance: ground.hit ? ground.gap : Infinity,
    intoWall: false, runIntent: false,
    grappleStart: false, grappleEnded: false, grappleDir: null,
  }
  if (wall) {
    c.intoWall = wishMag > 0.1 && -(_wish.x * wall.normal.x + _wish.z * wall.normal.z) > MOVE.wallIntoDot
    c.runIntent = c.intoWall || inp.moveZ !== 0 || (ps.state === S.WALL_RUNNING && wishMag > 0.1) // toward the wall, along it, or (already running) any steering — so you can reverse
  }

  // 3. grapple fire / cancel
  _eye.set(ps.pos.x, ps.pos.y + PLAYER.eyeAboveCenter, ps.pos.z)
  if (ps.state === S.GRAPPLING) {
    ps.grapple.time += dt
  } else if (inp.grapplePressed) {
    const point = findGrappleTarget(_eye, lookDirection(ps, _look), level.grapplePoints, phys)
    if (point) {
      ps.grapple = { point, settings: point.settings, time: 0 }
      c.grappleStart = true
    }
  }
  if (ps.grapple) {
    _dir.subVectors(ps.grapple.point.position, _eye)
    const dist = _dir.length()
    c.grappleDir = _dir.normalize()
    if (ps.state === S.GRAPPLING) {
      c.grappleEnded =
        dist < ps.grapple.settings.releaseDistance ||
        ps.grapple.time > ps.grapple.settings.maxDuration ||
        inp.jumpPressed ||
        (!inp.grappleHeld && ps.grapple.time > MOVE.grappleMinHold) // hold-to-grapple: letting go releases immediately
      if (inp.jumpPressed) ps.jumpBuffer = 0 // the jump press only cancels the pull
    }
  }

  // 4. jump actions, then state transition, then per-state velocity
  if (ps.state !== S.GRAPPLING && !c.grappleStart) handleJump(ps, c, inp)
  const next = resolveState(ps, c, inp)
  if (next !== ps.state) {
    EXIT[ps.state]?.(ps, c)
    ps.state = next
    ENTER[next]?.(ps, c)
  }
  RUN[ps.state](ps, c, dt, inp)

  // 5. move through the world (kinematic character controller resolves collisions)
  const dx = ps.vel.x * dt
  const dy = ps.vel.y * dt
  const dz = ps.vel.z * dt
  const mv = phys.move(dx, dy, dz)
  ps.pos.add(mv)

  // 6. velocity correction from what we hit (so momentum slides along surfaces instead of stalling)
  if (wall && wall.gap < 0.06) {
    const vn = ps.vel.x * wall.normal.x + ps.vel.z * wall.normal.z
    if (vn < 0) {
      ps.vel.x -= wall.normal.x * vn
      ps.vel.z -= wall.normal.z * vn
    }
  }
  if (ground.hit && ground.kind === 'slope' && ground.gap < 0.1) {
    const vn = ps.vel.dot(ground.normal)
    if (vn < 0) ps.vel.addScaledVector(ground.normal, -vn) // steep slope: slide down under gravity
  }
  if (dy > 1e-4 && mv.y < dy - 1e-3) ps.vel.y = Math.min(ps.vel.y, mv.y / dt) // bonked a ceiling
  const dLen = Math.hypot(dx, dz)
  if (dLen > 1e-4 && Math.hypot(mv.x, mv.z) < dLen * 0.5 && !wall) {
    ps.vel.x = mv.x / dt // ran into something the probes didn't classify
    ps.vel.z = mv.z / dt
  }
  ps.speed = Math.hypot(ps.vel.x, ps.vel.z)
}