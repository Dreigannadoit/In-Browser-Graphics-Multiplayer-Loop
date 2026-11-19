import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { player as ps } from '../player/state'

// Shadow-casting sun that follows the player, so the shadow map's resolution is spent
// around the player instead of being stretched across the whole map.
const OFFSET = new THREE.Vector3(40, 80, 30) // direction the light comes from
const EXTENT = 45 // half-size (m) of the shadowed area around the player
const MAP_SIZE = 4096 // lower to 2048 if performance suffers

export function Sun() {
  const light = useRef()
  const target = useMemo(() => new THREE.Object3D(), [])

  useFrame(() => {
    if (!light.current) return
    target.position.copy(ps.pos)
    light.current.position.copy(ps.pos).add(OFFSET)
    target.updateMatrixWorld()
  })

  return (
    <>
      <directionalLight
        ref={light}
        target={target}
        position={[40, 80, 30]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[MAP_SIZE, MAP_SIZE]}
        shadow-camera-left={-EXTENT}
        shadow-camera-right={EXTENT}
        shadow-camera-top={EXTENT}
        shadow-camera-bottom={-EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
      />
      <primitive object={target} />
    </>
  )
}