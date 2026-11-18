import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { player } from '../player/state'

// Visual-only. Markers are stripped from the GLB, so grapple anchors are drawn here.
// Colors are multiplied above 1.0 so the Bloom pass (luminanceThreshold = 1) picks them up.
const COLORS = {
  aimed: new THREE.Color('#ffffff'), // under the crosshair: will fire
  ready: new THREE.Color('#4fe3ff'), // in range
  far: new THREE.Color('#ff9f43'), // out of range
}
const GLOW = { aimed: 4, ready: 2.5, far: 1.4 }
const OUTLINE_OPACITY = 0.55 // "faint" black outline

export function GrapplePoints({ points }) {
  return points.map((p) => <GrapplePoint key={p.name} point={p} />)
}

function GrapplePoint({ point }) {
  const core = useRef()
  const halo = useRef() // billboard group: ring + ring outline
  const ringMat = useRef()
  const phase = useRef(Math.random() * 6)

  useFrame(({ clock, camera }) => {
    if (!core.current) return
    const dist = camera.position.distanceTo(point.position)
    const aimed = player.aimedGrapple === point.name
    const inRange = dist <= point.settings.range
    const key = aimed ? 'aimed' : inRange ? 'ready' : 'far'
    const pulse = 1 + Math.sin(clock.elapsedTime * 3 + phase.current) * 0.12

    core.current.scale.setScalar((aimed ? 1.6 : 1) * pulse)
    core.current.material.color.copy(COLORS[key]).multiplyScalar(GLOW[key])

    halo.current.quaternion.copy(camera.quaternion)
    halo.current.scale.setScalar(THREE.MathUtils.clamp(dist * 0.05, 1, 5) * (aimed ? 1.3 : 1) * pulse)
    ringMat.current.color.copy(COLORS[key]).multiplyScalar(GLOW[key])
    ringMat.current.opacity = aimed ? 1 : inRange ? 0.85 : 0.4
  })

  return (
    <group position={point.position.toArray()}>
      {/* core + inverted-hull black outline */}
      <mesh ref={core}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshBasicMaterial toneMapped={false} />
      </mesh>
      <mesh scale={1.22}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshBasicMaterial color="black" side={THREE.BackSide} transparent opacity={OUTLINE_OPACITY} depthWrite={false} />
      </mesh>

      {/* always-on-top ring with a wider black ring behind it as its outline */}
      <group ref={halo}>
        <mesh renderOrder={998}>
          <ringGeometry args={[0.64, 0.93, 48]} />
          <meshBasicMaterial color="black" transparent opacity={OUTLINE_OPACITY} depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh renderOrder={999}>
          <ringGeometry args={[0.7, 0.86, 48]} />
          <meshBasicMaterial ref={ringMat} toneMapped={false} transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}
