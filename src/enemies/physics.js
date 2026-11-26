// The ONLY enemy file that talks to Rapier (mirrors physics/adapter.js for the player).
// Enemies are kinematic bodies with SENSOR capsules:
//   • they collide with the map and the player's (solid) capsule, because the controller queries solids only;
//   • the player's own queries ignore sensors, so enemies never block the player's movement, grapple or wall probes.
// Hits on enemies (bullets etc.) are tested against the capsule geometry in registry.js, not through Rapier.
import { ENEMIES, SURFACE } from '../config/gameConfig'

export function createEnemyMover({ world, rapier }) {
  const controller = world.createCharacterController(ENEMIES.skin)
  const floorAngle = Math.acos(SURFACE.FLOOR_MIN_NY)
  controller.setUp({ x: 0, y: 1, z: 0 })
  controller.setSlideEnabled(true)
  controller.setMaxSlopeClimbAngle(floorAngle)
  controller.setMinSlopeSlideAngle(floorAngle)
  controller.enableAutostep(ENEMIES.stepHeight, ENEMIES.stepMinWidth, false)
  controller.enableSnapToGround(ENEMIES.snapDistance)
  controller.setApplyImpulsesToDynamicBodies(false)

  const solidsOnly = rapier.QueryFilterFlags.EXCLUDE_SENSORS
  const ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 })
  const moved = { x: 0, y: 0, z: 0, grounded: false }

  return {
    /** Collision-corrected move of `collider` by `desired` {x,y,z}. Returns a reused object. */
    move(collider, desired) {
      controller.computeColliderMovement(collider, desired, solidsOnly)
      const m = controller.computedMovement()
      moved.x = m.x
      moved.y = m.y
      moved.z = m.z
      moved.grounded = controller.computedGrounded()
      return moved
    },

    /** World Y of the first solid surface straight below (x, y, z) within `range`, or null. */
    groundBelow(x, y, z, range = 12) {
      ray.origin.x = x
      ray.origin.y = y
      ray.origin.z = z
      const hit = world.castRay(ray, range, true, solidsOnly)
      return hit ? y - (hit.timeOfImpact ?? hit.toi) : null
    },

    dispose() {
      world.removeCharacterController(controller)
    },
  }
}
