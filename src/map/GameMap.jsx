import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody, TrimeshCollider, CuboidCollider, BallCollider } from '@react-three/rapier'
import { registry, registerCollider } from './registry'
import { useGame } from '../game/store'
import { GrapplePoints } from './GrapplePoints'

/** Renders the loaded scene (markers already stripped) and builds all colliders from map data. */
export function GameMap({ map }) {
  return (
    <>
      <primitive object={map.scene} />

      {/* Static world: one fixed body, one trimesh collider per Geo object (vertices are world-space). */}
      <RigidBody type="fixed" colliders={false}>
        {map.geo.filter((g) => g.trimesh).map((g) => (
          <GeoCollider key={g.name} geo={g} />
        ))}
      </RigidBody>

      <GrapplePoints points={map.grapplePoints} />

      {map.pickups.map((p) => (
        <Pickup key={p.name} pickup={p} />
      ))}
      {map.triggers.map((t) => (
        <TriggerVolume key={t.name} trigger={t} />
      ))}
    </>
  )
}

function GeoCollider({ geo }) {
  const ref = useMemo(
    () => registerCollider(registry.surfaces, { name: geo.name, type: geo.type, userData: geo.userData }),
    [geo],
  )
  return <TrimeshCollider ref={ref} args={[geo.trimesh.vertices, geo.trimesh.indices]} />
}

function TriggerVolume({ trigger }) {
  const ref = useMemo(() => registerCollider(registry.sensors, { type: 'trigger', ...trigger }), [trigger])
  return (
    <RigidBody type="fixed" colliders={false} position={trigger.center.toArray()}>
      <CuboidCollider ref={ref} sensor args={trigger.halfExtents.toArray()} />
    </RigidBody>
  )
}

function Pickup({ pickup }) {
  const collected = useGame((s) => s.collected.has(pickup.name))
  const ref = useMemo(() => registerCollider(registry.sensors, { type: 'pickup', ...pickup }), [pickup])
  const spin = useRef()
  useFrame((_, dt) => {
    if (spin.current) spin.current.rotation.y += dt * 2
  })
  if (collected) return null // unmounting removes the sensor collider too
  return (
    <RigidBody type="fixed" colliders={false} position={pickup.position.toArray()}>
      <BallCollider ref={ref} sensor args={[0.7]} />
      <group ref={spin}>
        {pickup.kind === 'Health' ? (
          <mesh>
            <sphereGeometry args={[0.35, 20, 20]} />
            <meshStandardMaterial color="#ff4d5e" emissive="#aa1020" emissiveIntensity={0.8} />
          </mesh>
        ) : (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 0.07, 28]} />
            <meshStandardMaterial color="#ffd23f" emissive="#b38600" emissiveIntensity={0.8} metalness={0.6} roughness={0.3} />
          </mesh>
        )}
      </group>
    </RigidBody>
  )
}
