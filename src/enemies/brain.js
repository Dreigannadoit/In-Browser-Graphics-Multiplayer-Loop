// Enemy behaviours: pure JS decision-making. The manager calls updateEnemy() once per fixed step with the world dt.
// A behaviour only sets INTENT on the enemy (e.wish = where/how fast to move, e.yaw, e.anim, state) and asks `ctx` to apply
// damage, so it never touches Rapier or React.
//
//   ctx = { player: { x, y, z },                       player capsule centre
//           damagePlayer(amount, fromPos, knockback),  applies the hit
//           rng() }                                    Math.random in the game, seeded in tests
//
// Adding a kind with different combat (pistol, sniper, machine gun): write another entry in BEHAVIORS with the same
// `update(e, ctx, dt)` shape and set `ai: 'yourName'` in its ENEMIES.types entry. The idle → chase flow below can be copied
// or reused; only the "attack" part differs (a ranged one would keep its distance, aim, then fire from ctx).
import { ENEMIES } from '../config/gameConfig'

const DEG = Math.PI / 180
const TAU = Math.PI * 2

export const wrapAngle = (a) => {
  const r = (((a + Math.PI) % TAU) + TAU) % TAU
  return r - Math.PI
}

/** Rotate e.yaw toward `target` by at most rate*dt. */
export function turnToward(e, target, rate, dt) {
  const d = wrapAngle(target - e.yaw)
  const step = rate * dt
  e.yaw = wrapAngle(e.yaw + Math.max(-step, Math.min(step, d)))
}

function setState(e, state) {
  e.state = state
  e.stateTime = 0
}

function faceWish(e, speed) {
  e.wish.dirX = Math.sin(e.yaw)
  e.wish.dirZ = Math.cos(e.yaw)
  e.wish.speed = speed
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// ── melee: walk up and punch ────────────────────────────────────────────────
function pickMove(e, atk, rng) {
  const n = atk.moves.length
  let i = Math.floor(rng() * n)
  if (n > 1 && i === e.lastMove) i = (i + 1) % n // never the same punch twice in a row
  return i
}

function tryHit(e, ctx, move, dx, dz, dy, dist) {
  const atk = e.def.attack
  const facingDot = dist > 1e-4 ? (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / dist : 1
  const inArc = dist < 0.4 || facingDot >= Math.cos(atk.hitArc * DEG) // almost touching counts even if the angle is off
  if (dist <= atk.hitRange && Math.abs(dy) <= atk.hitHeight && inArc) {
    ctx.damagePlayer(move.damage ?? atk.damage ?? 0, e.pos, atk.knockback ?? 0)
    return true
  }
  return false
}

const melee = {
  update(e, ctx, dt) {
    const def = e.def
    const atk = def.attack
    const p = ctx.player
    const dx = p.x - e.pos.x
    const dz = p.z - e.pos.z
    const dy = p.y - e.pos.y
    const dist = Math.hypot(dx, dz)
    const toPlayer = Math.atan2(dx, dz)
    const anim = e.anim
    e.wish.speed = 0
    e.wish.accel = null
    anim.time = null
    anim.timeScale = 1

    switch (e.state) {
      case 'idle': {
        anim.key = 'idle'
        if (dist < ENEMIES.aggroRange) {
          turnToward(e, toPlayer, def.turnRate * 0.4, dt) // lazily watches the player while it makes up its mind
          if (e.stateTime >= def.reactionTime) setState(e, 'chase')
        }
        break
      }

      case 'chase': {
        turnToward(e, toPlayer, def.turnRate, dt)
        const err = Math.abs(wrapAngle(toPlayer - e.yaw))
        if (dist > def.stopDistance) {
          const ramp = Math.min(1, (dist - def.stopDistance) / 1.5 + 0.2) // ease off on arrival
          faceWish(e, e.loco.speed * ramp * (err > 1.2 ? 0.35 : 1)) // sharp turns slow it down; it runs the way it faces (arcs, not orbits)
        }
        if (e.wish.speed > 0.1) {
          anim.key = e.loco.clip
          anim.timeScale = clamp(Math.max(e.speed, 0.5) / e.loco.refSpeed, 0.5, 1.5) // feet follow the ground speed
        } else {
          anim.key = 'idle'
        }
        if (dist <= atk.range && Math.abs(dy) <= atk.hitHeight && e.time >= e.attackReadyAt) {
          const i = pickMove(e, atk, ctx.rng)
          e.lastMove = i
          e.attack = { move: atk.moves[i], t: 0, hit: false }
          setState(e, 'attack')
        }
        break
      }

      case 'attack': {
        const a = e.attack
        const m = a.move
        a.t += dt
        // keeps tracking the player slowly during the windup, then commits to a direction just before the fist lands
        if (a.t < m.hitTime - 0.1) turnToward(e, toPlayer, atk.windupTurnRate, dt)
        // steps into the punch over the 0.3 s before it lands
        if (a.t >= m.hitTime - 0.3 && a.t < m.hitTime && dist > def.stopDistance * 0.9) {
          faceWish(e, m.lunge / 0.3)
          e.wish.accel = 40
        }
        if (!a.hit && a.t >= m.hitTime) {
          a.hit = true
          tryHit(e, ctx, m, dx, dz, dy, dist)
        }
        anim.key = m.clip
        anim.time = a.t // the renderer plays the clip at exactly this time
        if (a.t >= m.end) {
          e.attack = null
          e.attackReadyAt = e.time + atk.cooldown
          setState(e, 'chase')
        }
        break
      }

      case 'dead':
      default: {
        anim.key = def.clips.die ? 'die' : null // null = no clip: the renderer freezes the pose and topples it
        break
      }
    }
  },
}

export const BEHAVIORS = { melee }

/** One fixed step of AI. dt = world seconds (0 is never passed: the manager skips paused steps). */
export function updateEnemy(e, ctx, dt) {
  e.time += dt
  e.stateTime += dt
  const behavior = BEHAVIORS[e.def.ai]
  if (!behavior) throw new Error(`[enemies] unknown ai "${e.def.ai}" for "${e.kind}" (known: ${Object.keys(BEHAVIORS).join(', ')})`)
  behavior.update(e, ctx, dt)
}
