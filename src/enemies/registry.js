// The live enemy list + the API other systems use (player weapons, dev tools).
// Everything here is plain data/functions: enemies are sim objects from sim.js, not React components.
import { damageEnemyState, killEnemy } from './sim'

export const enemyRegistry = {
  list: [], // every enemy currently in the world (written by <Enemies/>)
  spawn: null, // (kind, {x,z}?) → enemy | null   (set by <Enemies/>)
}

export function damageEnemy(id, amount) {
  const e = enemyRegistry.list.find((x) => x.id === id)
  return e ? damageEnemyState(e, amount) : false
}

export function killAllEnemies() {
  for (const e of enemyRegistry.list) killEnemy(e)
}

// ── hit tests ───────────────────────────────────────────────────────────────
// Ray vs the enemy's capsule (vertical axis, radius from its def). Closest-points-between-segments, so it's exact for the
// cylinder part and slightly generous on the end caps: right for bullets, which don't need to be pixel-perfect.
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z

function segmentSegment(p1, d1, p2, d2) {
  // closest points of segment p1 + s*d1 (s in 0..1) and p2 + t*d2 (t in 0..1); returns { s, t, dist2 }
  const r = { x: p1.x - p2.x, y: p1.y - p2.y, z: p1.z - p2.z }
  const a = dot(d1, d1)
  const e = dot(d2, d2)
  const f = dot(d2, r)
  const c = dot(d1, r)
  const b = dot(d1, d2)
  const denom = a * e - b * b
  let s = denom > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / denom)) : 0
  let t = (b * s + f) / e
  if (t < 0) {
    t = 0
    s = Math.min(1, Math.max(0, -c / a))
  } else if (t > 1) {
    t = 1
    s = Math.min(1, Math.max(0, (b - c) / a))
  }
  const dx = r.x + d1.x * s - d2.x * t
  const dy = r.y + d1.y * s - d2.y * t
  const dz = r.z + d1.z * s - d2.z * t
  return { s, t, dist2: dx * dx + dy * dy + dz * dz }
}

/**
 * First living enemy hit by the ray, or null. origin/dir are {x,y,z}, dir must be unit length.
 * Returns { enemy, distance, point:{x,y,z} }. Walls are NOT considered (cast your own ray against the map and compare distances).
 */
export function raycastEnemies(origin, dir, maxDist, list = enemyRegistry.list) {
  let best = null
  const rayVec = { x: dir.x * maxDist, y: dir.y * maxDist, z: dir.z * maxDist }
  for (const e of list) {
    if (e.state === 'dead') continue
    const { radius, halfHeight } = e.def.capsule
    const axis = { x: 0, y: halfHeight * 2, z: 0 } // bottom → top of the capsule's inner segment
    const bottom = { x: e.pos.x, y: e.pos.y - halfHeight, z: e.pos.z }
    const { s, dist2 } = segmentSegment(origin, rayVec, bottom, axis)
    if (dist2 > radius * radius) continue
    const distance = Math.max(0, s * maxDist - Math.sqrt(radius * radius - dist2))
    if (!best || distance < best.distance) {
      best = {
        enemy: e,
        distance,
        point: { x: origin.x + dir.x * distance, y: origin.y + dir.y * distance, z: origin.z + dir.z * distance },
      }
    }
  }
  return best
}
