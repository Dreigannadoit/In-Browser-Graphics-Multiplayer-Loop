import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { player } from '../player/state'

// Visual-only. Markers are stripped from the GLB, so grapple anchors are drawn here.
const COLORS = {
  aimed: new THREE.Color('#ffffff'), // under the crosshair: will fire
  ready: new THREE.Color('#4fe3ff'), // in range
  far: new THREE.Color('#ff9f43'), // out of range
}

export function GrapplePoints({ points }) {
  return points.map((p) => <GrapplePoint key={p.name} point={p} />)
}

function GrapplePoint({ point }) {
  const core = useRef()
  const ring = useRef()
  const phase = useRef(Math.random() * 6)

  useFrame(({ clock, camera }) => {
    if (!core.current) return
    const dist = camera.position.distanceTo(point.position)
    const aimed = player.aimedGrapple === point.name
    const inRange = dist <= point.settings.range
    const color = aimed ? COLORS.aimed : inRange ? COLORS.ready : COLORS.far
    const pulse = 1 + Math.sin(clock.elapsedTime * 3 + phase.current) * 0.12

    core.current.scale.setScalar((aimed ? 1.6 : 1) * pulse)
    core.current.material.color.copy(color)
    core.current.material.emissive.copy(color)

    // Billboard ring, drawn on top of geometry; grows with distance so it stays visible from far away.
    ring.current.quaternion.copy(camera.quaternion)
    ring.current.scale.setScalar(THREE.MathUtils.clamp(dist * 0.05, 1, 5) * (aimed ? 1.3 : 1) * pulse)
    ring.current.material.color.copy(color)
    ring.current.material.opacity = aimed ? 1 : inRange ? 0.8 : 0.35
  })

  return (
    <group position={point.position.toArray()}>
      <mesh ref={core}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshStandardMaterial emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={ring} renderOrder={999}>
        <ringGeometry args={[0.7, 0.85, 40]} />
        <meshBasicMaterial transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
