import { Suspense, useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadMap } from './map/loadMap'
import { GameMap } from './map/GameMap'
import { Player } from './player/Player'
import { Hud } from './ui/Hud'
import { CAMERA, PHYSICS } from './config/gameConfig'

const MAP_URL = '/maps/Demo.glb' // put the file in public/maps/

function Game({ url }) {
  const gltf = useLoader(GLTFLoader, url)
  const map = useMemo(() => loadMap(gltf), [gltf])
  return (
    <>
      <GameMap map={map} />
      <Player map={map} />
    </>
  )
}

export default function App() {
  return (
    <>
      <Canvas camera={{ fov: CAMERA.baseFov, near: 0.05, far: 1000 }}>
        <color attach="background" args={['#a9cdf5']} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[40, 80, 30]} intensity={1.8} />
        <Suspense fallback={null}>
          {/* gravity is 0: the player is kinematic and applies its own gravity. Add `debug` to see colliders. */}
          <Physics gravity={[0, 0, 0]} timeStep={PHYSICS.timeStep} interpolate={false}>
            <Game url={MAP_URL} />
          </Physics>
        </Suspense>
        {/* Only things brighter than 1.0 bloom (grapple points); the rest of the scene is unaffected. */}
        <EffectComposer>
          <Bloom intensity={1.2} luminanceThreshold={1} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      </Canvas>
      <Hud />
    </>
  )
}
