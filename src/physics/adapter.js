// The ONLY file that talks to Rapier queries. movement.js sees just this interface,
// so the sim stays engine-agnostic (useful for server-side/multiplayer simulation later).
import * as THREE from 'three'
import { PLAYER, MOVE } from '../config/gameConfig'
import { classifyNormal } from './surface'
import { registry } from '../map/registry'

const CENTER_TO_FEET = PLAYER.halfHeight + PLAYER.radius
const RAY_START_ABOVE_FEET = 0.5
const WALL_DIRS = Array.from({ length: 8 }, (_, i) => [Math.cos((i / 8) * Math.PI * 2), Math.sin((i / 8) * Math.PI * 2)])
const GROUND_OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, z]) => [x * PLAYER.radius * 0.8, z * PLAYER.radius * 0.8])
const NO_GROUND = Object.freeze({ hit: false, gap: Infinity, kind: 'none', name: null, noRun: false, normal: new THREE.Vector3(0, 1, 0) })

export function createPhysicsAdapter({ world, rapier, getBody, getCollider, controller }) {
  const ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
  const solidsOnly = rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const sensorsOnly = rapier.QueryFilterFlags.EXCLUDE_SOLIDS
  const capsule = new rapier.Capsule(PLAYER.halfHeight, PLAYER.radius)
  const identity = { x: 0, y: 0, z: 0, w: 1 }
  const moved = new THREE.Vector3()

  function setRay(ox, oy, oz, dx, dy, dz) {
    ray.origin.x = ox; ray.origin.y = oy; ray.origin.z = oz
    ray.dir.x = dx; ray.dir.y = dy; ray.dir.z = dz
  }

  /** Raycast against solid colliders. Normal is flipped to face the ray origin (robust to triangle winding). */
  function cast(ox, oy, oz, dx, dy, dz, maxToi) {
    setRay(ox, oy, oz, dx, dy, dz)
    const hit = world.castRayAndGetNormal(ray, maxToi, true, solidsOnly, undefined, undefined, getBody())
    if (!hit) return null
    let { x: nx, y: ny, z: nz } = hit.normal
    if (nx * dx + ny * dy + nz * dz > 0) { nx = -nx; ny = -ny; nz = -nz }
    const info = registry.surfaces.get(hit.collider.handle)
    return {
      toi: hit.timeOfImpact ?? hit.toi,
      normal: new THREE.Vector3(nx, ny, nz),
      name: info?.name ?? 'unknown',
      noRun: !!info?.userData?.noRun,
    }
  }

  return {
    /** Highest surface under the capsule (5 downward rays). gap = meters from feet to surface. */
    probeGround(pos) {
      const feetY = pos.y - CENTER_TO_FEET
      let best = null
      for (const [ox, oz] of GROUND_OFFSETS) {
        const h = cast(pos.x + ox, feetY + RAY_START_ABOVE_FEET, pos.z + oz, 0, -1, 0, RAY_START_ABOVE_FEET + MOVE.groundProbeRange)
        if (h && (!best || h.toi < best.toi)) best = h
      }
      if (!best) return NO_GROUND
      return { hit: true, gap: best.toi - RAY_START_ABOVE_FEET, normal: best.normal, name: best.name, noRun: best.noRun, kind: classifyNormal(best.normal.y) }
    },

    /** Nearest wall-classified surface around the capsule (8 horizontal rays), or null. */
    probeWalls(pos) {
      let best = null
      const reach = PLAYER.radius + MOVE.wallProbeDistance
      for (const [dx, dz] of WALL_DIRS) {
        const h = cast(pos.x, pos.y, pos.z, dx, 0, dz, reach)
        if (!h || classifyNormal(h.normal.y) !== 'wall') continue
        if (!best || h.toi < best.toi) best = { ...h, dx, dz }
      }
      if (!best) return null
      best.normal.y = 0
      best.normal.normalize()
      best.gap = best.toi * -(best.dx * best.normal.x + best.dz * best.normal.z) - PLAYER.radius // perpendicular gap
      return best
    },

    /**
     * Ledge in front of the player along horizontal direction (dx, dz): a wall at lower-body height whose top is a
     * walkable floor with room to stand on. Returns { topY (world Y of the ledge surface), wallX, wallZ, normal } or null.
     */
    probeLedge(pos, dx, dz) {
      const feetY = pos.y - CENTER_TO_FEET
      const reach = PLAYER.radius + MOVE.mantleReach
      // 1. a wall right in front of the lower body
      const wall = cast(pos.x, feetY + MOVE.mantleMinHeight * 0.6, pos.z, dx, 0, dz, reach)
      if (!wall || classifyNormal(wall.normal.y) !== 'wall') return null
      // 2. the top of it: ray down from just past the wall face, from max grab height
      const px = pos.x + dx * (wall.toi + 0.2)
      const pz = pos.z + dz * (wall.toi + 0.2)
      const topFromY = feetY + MOVE.mantleMaxHeight + 0.05
      const top = cast(px, topFromY, pz, 0, -1, 0, topFromY - (feetY + MOVE.mantleMinHeight))
      if (!top || classifyNormal(top.normal.y) !== 'floor') return null
      const topY = topFromY - top.toi
      // 3. room to stand: nothing above the ledge, and nothing between us and it at standing height
      const standH = 2 * (PLAYER.halfHeight + PLAYER.radius)
      if (cast(px, topY + 0.05, pz, 0, 1, 0, standH - 0.05)) return null
      if (cast(pos.x, topY + 0.9, pos.z, dx, 0, dz, wall.toi + 0.2 + PLAYER.radius)) return null
      return { topY, wallX: pos.x + dx * wall.toi, wallZ: pos.z + dz * wall.toi, normal: wall.normal }
    },

    hasLineOfSight(from, to, dist, tolerance = 1) {
      setRay(from.x, from.y, from.z, (to.x - from.x) / dist, (to.y - from.y) / dist, (to.z - from.z) / dist)
      const hit = world.castRay(ray, dist, true, solidsOnly, undefined, undefined, getBody())
      return !hit || (hit.timeOfImpact ?? hit.toi) >= dist - tolerance
    },

    /** Kinematic character controller: returns the collision-corrected translation for this step. */
    move(dx, dy, dz) {
      controller.computeColliderMovement(getCollider(), { x: dx, y: dy, z: dz }, solidsOnly)
      const m = controller.computedMovement()
      return moved.set(m.x, m.y, m.z)
    },

    /** Sensor colliders (pickups/triggers) currently overlapping the player capsule. */
    overlappingSensors(pos, out) {
      out.length = 0
      world.intersectionsWithShape(pos, identity, capsule, (c) => {
        const s = registry.sensors.get(c.handle)
        if (s) out.push(s)
        return true
      }, sensorsOnly, undefined, getCollider())
      return out
    },
  }
}
