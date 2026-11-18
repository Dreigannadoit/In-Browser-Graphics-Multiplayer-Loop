import { Suspense, useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadMap } from './map/loadMap'
import { GameMap } from './map/GameMap'
import { Player } from './player/Player'
import { Hud } from './ui/Hud'
import { CAMERA, PHYSICS } from './config/gameConfig'
import "./App.css"

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
      </Canvas>
      <Hud />
    </>
  )
}
