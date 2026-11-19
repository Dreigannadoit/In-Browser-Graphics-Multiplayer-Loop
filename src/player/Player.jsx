import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { RigidBody, CapsuleCollider, useRapier, useBeforePhysicsStep } from '@react-three/rapier'
import { CONTROLS, PHYSICS, PLAYER, SURFACE, GAMEPLAY, DOUBLE_JUMP } from '../config/gameConfig'
import { createPhysicsAdapter } from '../physics/adapter'
import { player as ps, respawnPlayer, lookDirection } from './state'
import { input } from './input'
import { stepPlayer } from './movement'
import { findGrappleTarget } from './grapple'
import { createCameraFx, updateCameraFx } from './cameraEffects'
import { getState, setState } from '../game/store'
import { dev, simDt } from '../dev/devState'
import { noclipStep } from '../dev/noclip'

const FALLBACK_SPAWN = { position: new THREE.Vector3(0, 2, 0), yaw: 0 }
const randomSpawn = (spawns) => {
  if (!spawns.length) {
    console.warn('[Player] map has no Spawn_Player_* — using origin')
    return FALLBACK_SPAWN
  }
  const s = spawns[Math.floor(Math.random() * spawns.length)]
  return { position: s.position.clone(), yaw: s.yaw }
}

export function Player({ map }) {
  const rbRef = useRef(null)
  const bodyRef = useRef(null)
  const physRef = useRef(null)
  const { world, rapier } = useRapier()
  const { camera, gl } = useThree()
  const level = useMemo(() => ({ grapplePoints: map.grapplePoints, spawns: map.spawns.player }), [map])
  const initial = useMemo(() => randomSpawn(level.spawns), [level])

  const fx = useMemo(createCameraFx, [])
  const renderPos = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => ({ eye: new THREE.Vector3(), look: new THREE.Vector3(), right: new THREE.Vector3(), a: new THREE.Vector3() }), [])
  const lastStepTime = useRef(performance.now())
  const hits = useRef([])
  const rope = useMemo(() => {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: '#7be3ff' }),
    )
    line.frustumCulled = false
    line.visible = false
    return line
  }, [])

  // setup: input, character controller, initial spawn
  useEffect(() => {
    camera.rotation.order = 'YXZ'
    const detach = input.attach(gl.domElement)

    const controller = world.createCharacterController(PLAYER.skin)
    const floorAngle = Math.acos(SURFACE.FLOOR_MIN_NY)
    controller.setUp({ x: 0, y: 1, z: 0 })
    controller.setSlideEnabled(true)
    controller.setMaxSlopeClimbAngle(floorAngle) // steeper than a "floor" → not walkable
    controller.setMinSlopeSlideAngle(floorAngle)
    controller.enableAutostep(PLAYER.stepHeight, PLAYER.stepMinWidth, false)
    controller.enableSnapToGround(PLAYER.snapDistance)
    controller.setApplyImpulsesToDynamicBodies(false)

    physRef.current = createPhysicsAdapter({
      world,
      rapier,
      getBody: () => rbRef.current,
      getCollider: () => rbRef.current.collider(0),
      controller,
    })
    dev.map = map // lets the dev tools list spawns / checkpoints / pickups for teleporting
    respawnPlayer(ps, initial)
    setState({ respawnPoint: null, checkpoint: null, health: GAMEPLAY.maxHealth, coins: 0, collected: new Set() })

    return () => {
      if (dev.map === map) dev.map = null
      detach()
      world.removeCharacterController(controller)
      physRef.current = null
    }
  }, [world, rapier, camera, gl, initial, map])

  const respawn = () => {
    respawnPlayer(ps, getState().respawnPoint ?? randomSpawn(level.spawns))
    rbRef.current.setNextKinematicTranslation(ps.pos)
  }

  function handleSensor(s) {
    if (s.type === 'pickup') {
      if (getState().collected.has(s.name)) return
      setState((st) => {
        const collected = new Set(st.collected).add(s.name)
        return s.kind === 'Health'
          ? { collected, health: Math.min(GAMEPLAY.maxHealth, st.health + GAMEPLAY.healthPickupAmount) }
          : { collected, coins: st.coins + 1 }
      })
    } else if (s.kind === 'KillZone') {
      if (!dev.god) respawn()
    } else if (s.kind === 'Checkpoint' && getState().checkpoint !== s.name) {
      setState({ checkpoint: s.name, respawnPoint: { position: s.respawnPosition.clone(), yaw: ps.yaw } })
    }
  }

  // ── fixed-step simulation (runs right before each Rapier step) ──
  useBeforePhysicsStep(() => {
    const rb = rbRef.current
    const phys = physRef.current
    if (!rb || !phys) return
    lastStepTime.current = performance.now()

    // dev tools: queued teleport, pause / slow-motion, cheats. All of this is a no-op unless dev mode is unlocked.
    if (dev.pendingTeleport) {
      respawnPlayer(ps, dev.pendingTeleport)
      rb.setNextKinematicTranslation(ps.pos)
      dev.pendingTeleport = null
      return // the physics step that follows moves the collider there before the next sim step
    }
    const dt = simDt(PHYSICS.timeStep)
    if (dt === 0) return // paused
    if (dev.infiniteCharges) ps.djCharges = DOUBLE_JUMP.maxCharges
    if (dev.god && getState().health < GAMEPLAY.maxHealth) setState({ health: GAMEPLAY.maxHealth })
    if (dev.noclip) {
      noclipStep(ps, input.snapshot(), dt)
      rb.setNextKinematicTranslation(ps.pos)
      return
    }

    stepPlayer(ps, input.snapshot(), dt, phys, level)
    rb.setNextKinematicTranslation(ps.pos)

    for (const s of [...phys.overlappingSensors(ps.pos, hits.current)]) handleSensor(s)
  })

  // ── render frame: look, interpolation, camera effects, crosshair aim, rope ──
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const { dx, dy } = input.takeLook()
    const maxPitch = (PLAYER.maxPitchDeg * Math.PI) / 180
    ps.yaw -= dx * CONTROLS.mouseSensitivity
    ps.pitch = THREE.MathUtils.clamp(ps.pitch - dy * CONTROLS.mouseSensitivity, -maxPitch, maxPitch)

    const alpha = THREE.MathUtils.clamp((performance.now() - lastStepTime.current) / (PHYSICS.timeStep * 1000), 0, 1)
    renderPos.lerpVectors(ps.prevPos, ps.pos, alpha)

    if (bodyRef.current) bodyRef.current.position.copy(renderPos) // shadow caster follows the smoothed position

    const cam = updateCameraFx(fx, ps, dt)
    // eye sways along camera-right (right = (cos yaw, 0, -sin yaw)); view pitch/roll include kicks + shake, ps.pitch stays pure aim
    camera.position.set(
      renderPos.x + Math.cos(ps.yaw) * cam.eyeOffsetRight,
      renderPos.y + PLAYER.eyeAboveCenter + cam.eyeOffsetY,
      renderPos.z - Math.sin(ps.yaw) * cam.eyeOffsetRight,
    )
    camera.rotation.set(THREE.MathUtils.clamp(ps.pitch + cam.pitch, -maxPitch, maxPitch), ps.yaw, cam.roll)
    if (Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov
      camera.updateProjectionMatrix()
    }

    // crosshair: which grapple point would fire right now?
    const phys = physRef.current
    if (phys) {
      tmp.eye.set(renderPos.x, renderPos.y + PLAYER.eyeAboveCenter, renderPos.z)
      const hit = findGrappleTarget(tmp.eye, lookDirection(ps, tmp.look), level.grapplePoints, phys, ps.grappleStatus)
      ps.aimedGrapple = hit ? hit.name : null
      if (ps.state === 'grappling' && ps.grapple) ps.grappleStatus[ps.grapple.point.name] = 'target' // the point we're attached to stays green
    }

    // rope
    const g = ps.state === 'grappling' ? ps.grapple : null
    rope.visible = !!g
    if (g) {
      tmp.right.set(Math.cos(ps.yaw), 0, -Math.sin(ps.yaw))
      tmp.a.copy(camera.position).addScaledVector(tmp.right, 0.3).addScaledVector(lookDirection(ps, tmp.look), 0.5)
      tmp.a.y -= 0.25
      const p = rope.geometry.attributes.position
      p.setXYZ(0, tmp.a.x, tmp.a.y, tmp.a.z)
      p.setXYZ(1, g.point.position.x, g.point.position.y, g.point.position.z)
      p.needsUpdate = true
    }
  })

  return (
    <>
      <RigidBody ref={rbRef} type="kinematicPosition" colliders={false} position={initial.position.toArray()}>
        <CapsuleCollider args={[PLAYER.halfHeight, PLAYER.radius]} />
      </RigidBody>
      {/* Invisible body: writes no colour/depth (so it never blocks the first-person camera) but still casts a shadow. */}
      <group ref={bodyRef}>
        <mesh castShadow>
          <capsuleGeometry args={[PLAYER.radius, PLAYER.halfHeight * 2, 8, 16]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      </group>
      <primitive object={rope} />
    </>
  )
}