import { Suspense, lazy, useMemo } from 'react'
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
import { useGame } from './game/store'
import { BLOOM, CAMERA, LOOK, OUTLINE, PHYSICS } from './config/gameConfig'
import { Outline } from './render/OutlineEffect'
import { Sky } from './render/Sky'
import { LiveLook } from './render/LiveLook'
import { DevProbe } from './dev/DevProbe'
import { fxRefs, touch } from './dev/devState'
import "./App.css"

// Tone mapper by name (see LOOK.toneMapping); older `postprocessing` builds lack NEUTRAL, so fall back to ACES.
const TONE_MAPPING = ToneMappingMode[LOOK.toneMapping] ?? ToneMappingMode.ACES_FILMIC

// Developer tools: a separate chunk, only downloaded after the console password check passes (see dev/devGate.js).
const DevTools = lazy(() => import('./dev/DevTools'))
function DevMount() {
  const on = useGame((s) => s.devUnlocked)
  if (!on) return null
  return (
    <Suspense fallback={null}>
      <DevTools />
    </Suspense>
  )
}
// <Physics> with the dev tools' "show colliders" switch.
function DevPhysics({ children }) {
  const debug = useGame((s) => s.devColliders)
  return (
    <Physics gravity={[0, 0, 0]} timeStep={PHYSICS.timeStep} interpolate={false} debug={debug}>
      {children}
    </Physics>
  )
}

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
        {/* background, fog and fill light live in LiveLook so the dev tools can tune them */}
        <LiveLook />
        <Sky />
        <Sun />
        <DevProbe />
        <Suspense fallback={null}>
          {/* gravity is 0: the player is kinematic and applies its own gravity. Add `debug` to see colliders. */}
          <DevPhysics>
            <Game url={MAP_URL} />
          </DevPhysics>
        </Suspense>
        <EffectComposer>
          {/* Ink lines first (on the raw scene), then bloom so glowing pickups aren't outlined into mud, then tone mapping. */}
          {/* Always mounted: with OUTLINE.enabled off it only draws the shadow tint (strength 0 = no lines). */}
          <Outline
            ref={(e) => {
              fxRefs.outline = e
              touch()
            }}
            lineColor={OUTLINE.color}
            lineStrength={OUTLINE.enabled ? OUTLINE.strength : 0}
            lineWidth={OUTLINE.width}
            widthRefDist={OUTLINE.widthRefDist}
            minWidth={OUTLINE.minWidth}
            edgeThreshold={OUTLINE.threshold}
            fadeStart={OUTLINE.fadeStart}
            fadeEnd={OUTLINE.fadeEnd}
            shadowColor={OUTLINE.shadowColor}
            shadowLift={OUTLINE.shadowLift}
            shadowRange={OUTLINE.shadowRange}
          />
          <Bloom
            ref={(e) => {
              fxRefs.bloom = e
              touch()
            }}
            mipmapBlur
            intensity={BLOOM.intensity}
            luminanceThreshold={BLOOM.threshold}
            luminanceSmoothing={BLOOM.smoothing}
            radius={BLOOM.radius}
          />
          <ToneMapping mode={TONE_MAPPING} />
        </EffectComposer>
      </Canvas>
      <Hud />
      <DevMount />
    </>
  )
}