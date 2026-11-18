import * as THREE from 'three'

const _to = new THREE.Vector3()

/** Point closest to the crosshair that is in range, inside its view cone, and (optionally) visible. */
export function findGrappleTarget(origin, dir, points, phys) {
  let best = null
  let bestAngle = Infinity
  for (const p of points) {
    const s = p.settings
    _to.subVectors(p.position, origin)
    const dist = _to.length()
    if (dist > s.range || dist < 0.5) continue
    const angle = Math.acos(THREE.MathUtils.clamp(_to.dot(dir) / dist, -1, 1))
    if (angle > THREE.MathUtils.degToRad(s.coneDeg) || angle >= bestAngle) continue
    if (s.requireLineOfSight && !phys.hasLineOfSight(origin, p.position, dist, s.losTolerance)) continue
    best = p
    bestAngle = angle
  }
  return best
}
