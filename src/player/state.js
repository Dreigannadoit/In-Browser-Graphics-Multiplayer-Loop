import * as THREE from 'three'
import { DOUBLE_JUMP } from '../config/gameConfig'

export function createPlayerState() {
  return {
    // kinematics (pos = capsule center)
    pos: new THREE.Vector3(),
    prevPos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    speed: 0, // horizontal m/s

    // state machine
    state: 'airborne', // grounded | airborne | sliding | wallRunning | wallSliding | grappling
    grounded: false,
    time: 0,

    // double jump (kept here so any event can reset it)
    canDoubleJump: true, // per-airtime allowance (landing / wall-run resets it) ...
    djCharges: DOUBLE_JUMP.maxCharges, // ... and this is the consumable pool behind it
    djRecharge: 0, // seconds accumulated toward the next charge
    doubleJumpResetReason: 'init',
    groundObjectName: null,
    lastGroundObjectName: null, // object we last took off from

    // contacts / debug
    surfaceType: 'none',
    surfaceName: null,
    lastWall: null,

    // timers / flags
    jumpBuffer: 0,
    coyote: 0,
    wallRunTime: 0,
    wallRunExhausted: false,
    wallLockUntil: 0,
    sprinting: false,
    slideCooldownUntil: 0,
    jumpedAt: -1, // time of last takeoff / jump (double-jump delay)
    jumpCut: false, // true while a rising jump may be shortened by releasing the key

    // grapple
    grapple: null, // { point, settings, time }
    aimedGrapple: null, // name of the point that would fire right now (HUD)
    grappleStatus: {}, // point name → 'target' | 'near' | 'far' (HUD / point colors)

    // one-shots for the camera (render side consumes + clears them)
    landImpact: 0,
    fxEvents: [], // [{ type: 'doubleJump' | 'wallJump' | ..., side: -1..1 }]
  }
}

/** Singleton for now; make it per-player when networking arrives. */
export const player = createPlayerState()

// ── Double jump: every rule lives here ───────────────────────────────────────
export function resetDoubleJump(ps, reason = 'manual') {
  ps.canDoubleJump = true
  ps.doubleJumpResetReason = reason
}
export function consumeDoubleJump(ps) {
  ps.canDoubleJump = false
  ps.djCharges = Math.max(0, ps.djCharges - 1) // from full this also starts the recharge timer at 0
}
/** Queue a camera impulse (see CAMERA.kicks). Capped so a headless sim that never renders can't grow it forever. */
export function fxPush(ps, type, side = 0) {
  if (ps.fxEvents.length < 16) ps.fxEvents.push({ type, side })
}
/** Spend one charge WITHOUT touching the per-airtime allowance (used by wall jumps). */
export function spendDoubleJumpCharge(ps) {
  ps.djCharges = Math.max(0, ps.djCharges - 1)
}
/** Advance the recharge timer by one fixed step: +1 charge every rechargeSeconds while below max. */
export function tickDoubleJumpCharges(ps, dt) {
  const { maxCharges, rechargeSeconds } = DOUBLE_JUMP
  if (ps.djCharges >= maxCharges) {
    ps.djCharges = maxCharges
    ps.djRecharge = 0
    return
  }
  ps.djRecharge += dt
  if (ps.djRecharge >= rechargeSeconds) {
    ps.djCharges += 1
    ps.djRecharge = ps.djCharges >= maxCharges ? 0 : ps.djRecharge - rechargeSeconds
  }
}
function landingQualifies(ps, surface) {
  if (DOUBLE_JUMP.resetMode === 'differentObject') return surface.name !== ps.lastGroundObjectName
  return true // 'anyFloor'
}
/** Call when a floor-classified contact begins (landing). */
export function onFloorContactStart(ps, surface) {
  if (landingQualifies(ps, surface)) resetDoubleJump(ps, `landed:${surface.name}`)
  ps.groundObjectName = surface.name
}
/** Call when the player leaves the ground (jump or walking off). */
export function onLeaveGround(ps) {
  ps.lastGroundObjectName = ps.groundObjectName
}

export function respawnPlayer(ps, point) {
  ps.pos.copy(point.position)
  ps.prevPos.copy(ps.pos)
  ps.vel.set(0, 0, 0)
  ps.yaw = point.yaw
  ps.pitch = 0
  ps.state = 'airborne'
  ps.grounded = false
  ps.groundObjectName = null
  ps.lastGroundObjectName = null
  ps.grapple = null
  ps.wallRunExhausted = false
  ps.jumpBuffer = 0
  ps.coyote = 0
  ps.sprinting = false
  ps.jumpCut = false
  ps.slideCooldownUntil = 0
  ps.fxEvents.length = 0
  resetDoubleJump(ps, 'respawn')
}

export function lookDirection(ps, out) {
  const cp = Math.cos(ps.pitch)
  return out.set(-Math.sin(ps.yaw) * cp, Math.sin(ps.pitch), -Math.cos(ps.yaw) * cp)
}