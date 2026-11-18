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
  target: { size: 1.9, ring: 1.35, opacity: 1, glow: 2.4, halo: 1, haloSize: 8 },
  near: { size: 0.9, ring: 0.8, opacity: 0.7, glow: 0.7, halo: 0.3, haloSize: 4 }, // deliberately smaller/dimmer/static: reads as "not active"
  far: { size: 0.7, ring: 0.7, opacity: 0.25, glow: 0.1, halo: 0.1, haloSize: 3 },
}

// Soft radial gradient used for the additive glow halo (a dependency-free "bloom" that only affects grapple points).
let glowTexture = null
function getGlowTexture() {
  if (glowTexture) return glowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.15)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  glowTexture = new THREE.CanvasTexture(canvas)
  return glowTexture
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
  const halo = useRef()
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

    // glow halo (billboard, additive)
    halo.current.quaternion.copy(camera.quaternion)
    halo.current.scale.setScalar(look.haloSize * THREE.MathUtils.clamp(dist * 0.05, 1, 4) * pulse * 0.5)
    halo.current.material.color.copy(color)
    halo.current.material.opacity = look.halo
  })

  return (
    <group position={point.position.toArray()}>
      <mesh ref={halo} renderOrder={997}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={getGlowTexture()}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={outline}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshBasicMaterial color={OUTLINE.color} side={THREE.BackSide} transparent opacity={OUTLINE.coreOpacity} depthWrite={false} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.35, 20, 20]} />
        <meshStandardMaterial emissiveIntensity={0.2} toneMapped={false} />
      </mesh>
      <mesh ref={ringOutline} renderOrder={998}>
        <ringGeometry args={[0.64, 0.91, 40]} />
        <meshBasicMaterial color={OUTLINE.color} transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={lock} renderOrder={1000} visible={false}>
        <ringGeometry args={[0.82, 1, 4, 1]} />
        <meshBasicMaterial color={COLORS.target} transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={ring} renderOrder={999}>
        <ringGeometry args={[0.7, 0.85, 40]} />
        <meshBasicMaterial transparent depthTest={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
