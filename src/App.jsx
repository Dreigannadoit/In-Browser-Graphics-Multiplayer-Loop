import { Suspense, useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { loadMap } from './map/loadMap'
import { GameMap } from './map/GameMap'
import { Player } from './player/Player'
import { Sun } from './map/Sun'
import { Hud } from './ui/Hud'
import { BLOOM, CAMERA, PHYSICS } from './config/gameConfig'
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
      {/* Tone mapping is handled by the <ToneMapping /> effect below (after bloom, so glow is computed in HDR). */}
      <Canvas shadows="soft" camera={{ fov: CAMERA.baseFov, near: 0.05, far: 1000 }} gl={{ toneMapping: THREE.NoToneMapping }}>
        <color attach="background" args={['#a9cdf5']} />
        <ambientLight intensity={0.7} />
        <Sun />
        <Suspense fallback={null}>
          {/* gravity is 0: the player is kinematic and applies its own gravity. Add `debug` to see colliders. */}
          <Physics gravity={[0, 0, 0]} timeStep={PHYSICS.timeStep} interpolate={false}>
            <Game url={MAP_URL} />
          </Physics>
        </Suspense>
        <EffectComposer>
          <Bloom
            mipmapBlur
            intensity={BLOOM.intensity}
            luminanceThreshold={BLOOM.threshold}
            luminanceSmoothing={BLOOM.smoothing}
            radius={BLOOM.radius}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
      <Hud />
    </>
  )
}