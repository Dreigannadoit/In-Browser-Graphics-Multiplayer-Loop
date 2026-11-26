// Enemy simulation state + kinematics. Pure JS: no THREE, React or Rapier, so it can run headless (tests, a server later).
//
// Per fixed step the manager does:   updateEnemy(e, ctx, dt)  → brain decides (sets e.wish, e.anim, state, hits)
//                                    integrate(e, dt, out)    → desired displacement (accel + gravity)
//                                    …physics collides it…
//                                    applyMove(e, moved, dt)  → commit the collision-corrected move
import { ENEMIES } from '../config/gameConfig'

let nextId = 1

/** Weighted pick from def.locomotion, so a group of enemies doesn't run in lockstep. */
export function pickLocomotion(def, rng = Math.random) {
  const opts = def.locomotion
  const total = opts.reduce((sum, o) => sum + (o.weight ?? 1), 0)
  let r = rng() * total
  for (const o of opts) {
    r -= o.weight ?? 1
    if (r <= 0) return o
  }
  return opts[opts.length - 1]
}

/** spawn = { x, y, z (capsule centre), yaw } */
export function createEnemy(kind, def, spawn, rng = Math.random) {
  return {
    id: nextId++,
    kind,
    def,
    state: 'idle', // idle | chase | attack | dead   (see brain.js)
    stateTime: 0, // seconds in the current state
    time: 0, // seconds since spawn (world time)
    pos: { x: spawn.x, y: spawn.y, z: spawn.z }, // capsule centre
    prev: { x: spawn.x, y: spawn.y, z: spawn.z, yaw: spawn.yaw ?? 0 }, // last step's pose, for render interpolation
    vel: { x: 0, y: 0, z: 0 },
    yaw: spawn.yaw ?? 0, // facing: forward = (sin yaw, 0, cos yaw)
    health: def.health,
    grounded: false,
    speed: 0, // horizontal m/s actually achieved last step
    wish: { speed: 0, dirX: 0, dirZ: 1, accel: null }, // what the brain wants this step
    push: { x: 0, z: 0 }, // separation shove from neighbours (set by the manager), m/s
    loco: pickLocomotion(def, rng), // { clip, speed, refSpeed }
    attack: null, // { move, t, hit } while attacking
    attackReadyAt: 0,
    lastMove: -1,
    // what the renderer should play. time != null → the brain owns the clip's playhead (attacks, so the fist lands exactly on hitTime)
    anim: { key: 'idle', time: null, timeScale: 1 },
  }
}

/** Accelerate toward the wished velocity, apply gravity; writes the desired displacement for this step into `out`. */
export function integrate(e, dt, out) {
  const w = e.wish
  const targetX = w.dirX * w.speed + e.push.x
  const targetZ = w.dirZ * w.speed + e.push.z
  const maxDelta = (w.accel ?? e.def.accel) * dt
  let dx = targetX - e.vel.x
  let dz = targetZ - e.vel.z
  const len = Math.hypot(dx, dz)
  if (len > maxDelta) {
    dx = (dx / len) * maxDelta
    dz = (dz / len) * maxDelta
  }
  e.vel.x += dx
  e.vel.z += dz
  // a small constant push down while grounded keeps the controller's ground contact (and snap-to-ground) stable
  e.vel.y = e.grounded ? -0.5 : Math.max(e.vel.y - ENEMIES.gravity * dt, -ENEMIES.maxFallSpeed)
  out.x = e.vel.x * dt
  out.y = e.vel.y * dt
  out.z = e.vel.z * dt
  return out
}

/** moved = { x, y, z, grounded } as returned by the physics mover (already collision-corrected). */
export function applyMove(e, moved, dt) {
  e.pos.x += moved.x
  e.pos.y += moved.y
  e.pos.z += moved.z
  e.grounded = moved.grounded
  // velocity follows what really happened, so walls and the player's body stop the enemy instead of it winding up speed
  e.vel.x = moved.x / dt
  e.vel.z = moved.z / dt
  e.vel.y = moved.grounded ? 0 : moved.y / dt
  e.speed = Math.hypot(e.vel.x, e.vel.z)
}

/** Remember this step's pose before moving (render interpolates prev → current). */
export function savePrev(e) {
  e.prev.x = e.pos.x
  e.prev.y = e.pos.y
  e.prev.z = e.pos.z
  e.prev.yaw = e.yaw
}

export function killEnemy(e) {
  e.health = 0
  e.state = 'dead'
  e.stateTime = 0
  e.attack = null
  e.wish.speed = 0
}

/** Returns true if this hit landed (false if the enemy was already dead). */
export function damageEnemyState(e, amount) {
  if (e.state === 'dead') return false
  e.health -= amount
  if (e.health <= 0) killEnemy(e)
  return true
}

/** Soft push-apart between neighbours: writes e.push for every enemy. O(n²), fine for dozens. */
export function computeSeparation(list) {
  const { radius, speed } = ENEMIES.separation
  for (const a of list) {
    a.push.x = 0
    a.push.z = 0
    if (a.state === 'dead') continue
    for (const b of list) {
      if (a === b || b.state === 'dead') continue
      const dx = a.pos.x - b.pos.x
      const dz = a.pos.z - b.pos.z
      const d = Math.hypot(dx, dz)
      if (d >= radius) continue
      const k = ((radius - d) / radius) * speed
      if (d < 1e-4) {
        a.push.x += (a.id % 2 ? 1 : -1) * k // exactly on top of each other: split by id so they separate in opposite directions
      } else {
        a.push.x += (dx / d) * k
        a.push.z += (dz / d) * k
      }
    }
  }
}
