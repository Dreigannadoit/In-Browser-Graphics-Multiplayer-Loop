import * as THREE from 'three'

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
