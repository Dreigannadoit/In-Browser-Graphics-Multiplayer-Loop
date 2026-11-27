import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { RigidBody, CapsuleCollider, useRapier, useBeforePhysicsStep } from '@react-three/rapier'
import { ENEMIES } from '../config/gameConfig'
import { clock } from '../game/clock'
import { on } from '../game/events'
import { damagePlayer } from '../game/combat'
import { player as ps } from '../player/state'
import { createEnemy, integrate, applyMove, savePrev, computeSeparation } from './sim'
import { updateEnemy } from './brain'
import { createEnemyMover } from './physics'
import { useEnemyAssets } from './assets'
import { EnemyVisual } from './EnemyVisual'
import { enemyRegistry, killAllEnemies } from './registry'

/**
 * Owns every enemy: spawning from the map's markers, the fixed-step simulation (right before each Rapier step, like <Player/>),
 * and rendering. Mount it inside <Physics> and a <Suspense> (it waits for the FBX files without blocking the map).
 *
 * Dev console helpers (dev builds only):  __enemies.spawn('unarmed')   __enemies.killAll()   __enemies.list()
 */

export function Enemies({ map }) {
  const assets = useEnemyAssets()
  const { world, rapier } = useRapier()
  const [list, setList] = useState([])
  const listRef = useRef([]) // the same array the registry exposes; sim objects are mutated in place, React only sees add/remove
  const bodies = useRef(new Map()) // enemy id → Rapier rigid body
  const mover = useRef(null)
  const warmup = useRef(0) // physics steps seen so far
  const spawned = useRef(false)
  const lastStep = useRef(performance.now())
  const ctx = useMemo(() => ({ player: { x: 0, y: 0, z: 0 }, damagePlayer, rng: Math.random }), [])
  const desired = useMemo(() => ({ x: 0, y: 0, z: 0 }), [])
  const killY = useMemo(() => {
    map.scene.updateMatrixWorld(true)
    return new THREE.Box3().setFromObject(map.scene).min.y - ENEMIES.fallDespawnBelow
  }, [map])

  const commit = useCallback((next) => {
    listRef.current = next
    enemyRegistry.list = next
    setList(next)
  }, [])

  /** Drops the enemy onto the floor under (x, y, z). The marker can sit anywhere above it. */
  const makeEnemy = useCallback((kind, x, y, z, yaw) => {
    const def = ENEMIES.types[kind]
    if (!def) {
      console.warn(`[Enemies] unknown enemy kind "${kind}" (known: ${Object.keys(ENEMIES.types).join(', ')})`)
      return null
    }
    const floor = mover.current.groundBelow(x, y + 0.6, z, 14)
    if (floor == null) {
      console.warn(`[Enemies] no floor under the ${kind} spawn at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}), skipped`)
      return null
    }
    const centerY = floor + def.capsule.halfHeight + def.capsule.radius + 0.02
    return createEnemy(kind, def, { x, y: centerY, z, yaw })
  }, [])

  const spawnAll = useCallback(() => {
    const player0 = map.spawns.player[0]
    const facePlayer = (p) => (player0 ? Math.atan2(player0.position.x - p.x, player0.position.z - p.z) : 0)
    const points = map.spawns.enemies.map((s) => ({ kind: s.kind, pos: s.position, yaw: s.yaw }))
    if (!points.length && ENEMIES.fallbackSpawn === 'targets' && map.spawns.target.length) {
      console.warn('[Enemies] no Spawn_Enemy_* markers in the map: using the Spawn_Target_* markers as unarmed enemy spawns')
      for (const s of map.spawns.target) points.push({ kind: 'unarmed', pos: s.position, yaw: facePlayer(s.position) })
    }
    return points.map((pt) => makeEnemy(pt.kind, pt.pos.x, pt.pos.y, pt.pos.z, pt.yaw)).filter(Boolean)
  }, [map, makeEnemy])

  // setup: character controller, dev helpers, arena reset when the player dies
  useEffect(() => {
    mover.current = createEnemyMover({ world, rapier })
    enemyRegistry.spawn = (kind = 'unarmed', at = null) => {
      // default: 8 m in front of where the player is looking
      const x = at?.x ?? ps.pos.x - Math.sin(ps.yaw) * 8
      const z = at?.z ?? ps.pos.z - Math.cos(ps.yaw) * 8
      const e = makeEnemy(kind, x, at?.y ?? ps.pos.y, z, Math.atan2(ps.pos.x - x, ps.pos.z - z))
      if (e) commit([...listRef.current, e])
      return e
    }
    if (import.meta.env.DEV) {
      window.__enemies = { spawn: (...a) => enemyRegistry.spawn(...a), list: () => enemyRegistry.list, killAll: killAllEnemies }
    }
    const off = on('playerDied', () => {
      if (spawned.current) commit(spawnAll())
    })
    return () => {
      off()
      mover.current?.dispose()
      mover.current = null
      enemyRegistry.spawn = null
      enemyRegistry.list = []
      listRef.current = []
      bodies.current.clear()
      spawned.current = false
      warmup.current = 0
      if (import.meta.env.DEV) delete window.__enemies
    }
  }, [world, rapier, makeEnemy, spawnAll, commit])

  // ── fixed-step simulation (runs right before each Rapier step) ──
  useBeforePhysicsStep(() => {
    const m = mover.current
    if (!m) return
    lastStep.current = performance.now()

    // Spawn after a few steps: Rapier's scene queries only see the map's colliders once the world has stepped.
    if (!spawned.current) {
      if (++warmup.current < 3) return
      spawned.current = true
      commit(spawnAll())
      return
    }

    const dt = clock.dt // world seconds this step (0 = paused, <1 step = slow motion), written by <Player/>
    const current = listRef.current
    if (dt <= 0) {
      for (const e of current) savePrev(e) // nothing moves, so render interpolation must not replay the last step
      return
    }

    ctx.player.x = ps.pos.x
    ctx.player.y = ps.pos.y
    ctx.player.z = ps.pos.z
    computeSeparation(current)

    let gone = null
    for (const e of current) {
      savePrev(e)
      const rb = bodies.current.get(e.id)
      if (!rb) continue // its React component hasn't mounted yet
      updateEnemy(e, ctx, dt)
      integrate(e, dt, desired)
      applyMove(e, m.move(rb.collider(0), desired), dt)
      rb.setNextKinematicTranslation(e.pos)
      if (e.pos.y < killY || (e.state === 'dead' && e.stateTime > ENEMIES.corpseTime)) (gone ??= []).push(e)
    }
    if (gone) commit(current.filter((e) => !gone.includes(e)))
  })

  return (
    <>
      {list.map((e) => (
        <Enemy key={e.id} sim={e} assets={assets} bodies={bodies} lastStep={lastStep} />
      ))}
    </>
  )
}

function Enemy({ sim, assets, bodies, lastStep }) {
  const ref = useCallback(
    (rb) => {
      if (rb) bodies.current.set(sim.id, rb)
      else bodies.current.delete(sim.id)
    },
    [sim, bodies],
  )
  const start = useMemo(() => [sim.pos.x, sim.pos.y, sim.pos.z], [sim])
  const { halfHeight, radius } = sim.def.capsule
  return (
    <>
      {/* sensor: collides with the map and the player's solid capsule (via the controller), but never blocks the player */}
      <RigidBody ref={ref} type="kinematicPosition" colliders={false} position={start}>
        <CapsuleCollider args={[halfHeight, radius]} sensor />
      </RigidBody>
      <EnemyVisual sim={sim} assets={assets} lastStep={lastStep} />
    </>
  )
}
