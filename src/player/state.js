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
    canDoubleJump: true,
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

    // grapple
    grapple: null, // { point, settings, time }
    aimedGrapple: null, // name of the point under the crosshair (HUD)

    // one-shot for the camera
    landImpact: 0,
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
  resetDoubleJump(ps, 'respawn')
}

export function lookDirection(ps, out) {
  const cp = Math.cos(ps.pitch)
  return out.set(-Math.sin(ps.yaw) * cp, Math.sin(ps.pitch), -Math.cos(ps.yaw) * cp)
}
