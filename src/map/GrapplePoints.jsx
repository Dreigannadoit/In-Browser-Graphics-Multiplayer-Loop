import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { player } from '../player/state'

// Visual-only. Markers are stripped from the GLB, so grapple anchors are drawn here.
const COLORS = {
  target: new THREE.Color('#00ff66'), // green: closest point you can grapple to right now
  near: new THREE.Color('#ffa21a'), // amber, well apart from the green; // yellow: close, but a condition isn't met yet (range, aim cone, line of sight)
  far: new THREE.Color('#8a8f98'), // grey: nothing to do with it yet
}
const LOOK = {
  // glow = emissiveIntensity; the Bloom pass (see BLOOM in gameConfig) picks up whatever ends up above its luminance threshold.
  target: { size: 1.9, ring: 1.35, opacity: 1, glow: 3.2 },
  near: { size: 0.9, ring: 0.8, opacity: 0.7, glow: 1.8 }, // deliberately smaller/dimmer/static: reads as "not active"
  far: { size: 0.7, ring: 0.7, opacity: 0.25, glow: 0.1 },
}

const OUTLINE = { color: '#000000', coreScale: 1.14, coreOpacity: 0.55, ringOpacity: 0.45 }

export function GrapplePoints({ points }) {
  return points.map((p) => <GrapplePoint key={p.name} point={p} />)
}

function GrapplePoint({ point }) {
  const core = useRef()
  const ring = useRef()
  const ringOutline = useRef()
  const outline = useRef()
  const lock = useRef()
  const phase = useRef(Math.random() * 6)

  useFrame(({ clock, camera }) => {
    if (!core.current) return
    const dist = camera.position.distanceTo(point.position)
    const status = player.grappleStatus[point.name] ?? 'far'
    const look = LOOK[status]
    const color = COLORS[status]
    const pulse = 1 + Math.sin(clock.elapsedTime * 3 + phase.current) * (status === 'target' ? 0.12 : 0) // only the target pulses

    core.current.scale.setScalar(look.size * pulse)
    core.current.material.color.copy(color)
    core.current.material.emissive.copy(color)
    core.current.material.emissiveIntensity = look.glow

    // Billboard ring, drawn on top of geometry; grows with distance so it stays visible from far away.
    ring.current.quaternion.copy(camera.quaternion)
    ring.current.scale.setScalar(THREE.MathUtils.clamp(dist * 0.05, 1, 5) * look.ring * pulse)
    ring.current.material.color.copy(color)
    ring.current.material.opacity = look.opacity

    // outline: black hull behind the sphere, black ring behind the colored ring
    outline.current.scale.setScalar(look.size * pulse * OUTLINE.coreScale)
    ringOutline.current.quaternion.copy(camera.quaternion)
    ringOutline.current.scale.copy(ring.current.scale)
    ringOutline.current.material.opacity = OUTLINE.ringOpacity * (status === 'far' ? 0.6 : 1)

    // lock-on reticle: a spinning, shrinking diamond frame that ONLY the green target has (shape cue, not just color)
    const locked = status === 'target'
    lock.current.visible = locked
    if (locked) {
      const t = clock.elapsedTime
      lock.current.quaternion.copy(camera.quaternion)
      lock.current.rotateZ(t * 1.6)
      const base = THREE.MathUtils.clamp(dist * 0.05, 1, 5)
      lock.current.scale.setScalar(base * (1.9 + 0.25 * Math.sin(t * 6)))
    }

  })

  return (
    <group position={point.position.toArray()}>
      <mesh ref={outline}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshBasicMaterial color={OUTLINE.color} side={THREE.BackSide} transparent opacity={OUTLINE.coreOpacity} depthWrite={false} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshStandardMaterial emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={ringOutline} renderOrder={998}>
        <ringGeometry args={[0.64, 0.91, 40]} />
        <meshBasicMaterial color={OUTLINE.color} transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={lock} renderOrder={1000} visible={false}>
        <ringGeometry args={[0.82, 1, 4, 1]} />
        <meshBasicMaterial color={COLORS.target} transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring} renderOrder={999}>
        <ringGeometry args={[0.7, 0.85, 40]} />
        <meshBasicMaterial transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
