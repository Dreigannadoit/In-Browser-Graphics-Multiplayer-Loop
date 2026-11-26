// Damage the player takes. One entry point so health, knockback and camera feedback stay in the same place
// (a bullet, a punch and a fall can all call this).
import { setState } from './store'
import { player as ps, fxPush } from '../player/state'
import { dev } from '../dev/devState'

/**
 * @param amount     health to remove
 * @param from       {x, z} world position of the attacker (used for knockback and which side the camera jolts toward)
 * @param knockback  horizontal m/s added to the player's velocity, away from `from`
 */
export function damagePlayer(amount, from = null, knockback = 0) {
  if (amount <= 0 || dev.god) return
  setState((s) => ({ health: Math.max(0, s.health - amount) }))
  if (!from) return fxPush(ps, 'hit', 0)

  let dx = ps.pos.x - from.x
  let dz = ps.pos.z - from.z
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  if (knockback) {
    ps.vel.x += dx * knockback
    ps.vel.z += dz * knockback
  }
  // dx,dz points attacker → player; camera right = (cos yaw, 0, -sin yaw). Attacker on the right → negative side (see CAMERA.kicks)
  const alongRight = dx * Math.cos(ps.yaw) - dz * Math.sin(ps.yaw)
  fxPush(ps, 'hit', alongRight < 0 ? -1 : 1)
}
