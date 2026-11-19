import * as THREE from 'three'
import grappleConfig from '../config/grapple.json'
import { dev } from '../dev/devState'

const _to = new THREE.Vector3()

/** How far past a point's range it still counts as "near" (yellow) for the HUD. */
export const NEAR_RANGE_MULT = 1.3

/**
 * Point closest to the crosshair that is in range, inside its view cone, and (optionally) visible.
 * If `status` (a plain object) is passed it is filled with name → 'target' | 'near' | 'far' for the HUD:
 *   target = the one point that would fire right now
 *   near   = close (within range × NEAR_RANGE_MULT) but not the target (out of range / outside cone / blocked / a better point exists)
 *   far    = anything else
 */
export function findGrappleTarget(origin, dir, points, phys, status) {
  let best = null
  let bestAngle = Infinity
  for (const p of points) {
    const s = p.settings
    _to.subVectors(p.position, origin)
    const dist = _to.length()
    if (status) status[p.name] = dist <= s.range * NEAR_RANGE_MULT ? 'near' : 'far'
    if (dist > s.range || dist < 0.5) continue
    const angle = Math.acos(THREE.MathUtils.clamp(_to.dot(dir) / dist, -1, 1))
    if (angle > THREE.MathUtils.degToRad(s.coneDeg) || angle >= bestAngle) continue
    if (s.requireLineOfSight && !phys.hasLineOfSight(origin, p.position, dist, s.losTolerance)) continue
    best = p
    bestAngle = angle
  }
  if (status && best) status[best.name] = 'target'
  return best
}

/** Name of the temporary anchor made by "grapple to anything" (see dev.grappleToAnything). */
export const FREE_ANCHOR = '__free__'

/**
 * Dev option: grapple onto whatever solid surface the crosshair is on. Returns a throwaway point shaped like a map grapple
 * point ({ name, position, settings }) using the grapple.json defaults (range, speed...), or null if nothing is in range.
 */
export function findFreeGrappleTarget(origin, dir, phys) {
  const settings = { ...grappleConfig.defaults }
  const hit = phys.raycast(origin, dir, settings.range)
  if (!hit || hit.toi < 0.5) return null
  // sit a hair off the surface so the rope/pull aims at open air, not inside the wall
  const position = hit.point.addScaledVector(hit.normal, 0.1)
  return { name: FREE_ANCHOR, position, settings }
}

/** Map point if one is targeted, otherwise (only when the dev toggle is on) whatever the crosshair hits. */
export function findAnyGrappleTarget(origin, dir, points, phys, status) {
  const point = findGrappleTarget(origin, dir, points, phys, status)
  if (point || !dev.grappleToAnything) return point
  return findFreeGrappleTarget(origin, dir, phys)
}
