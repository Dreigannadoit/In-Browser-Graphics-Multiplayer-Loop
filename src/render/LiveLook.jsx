// Renders the scene background, fog and fill light, and keeps them plus the post effects (outline, bloom) in sync with the config.
// It only does work when dev.version changes (the dev tools bump it), so it costs nothing during normal play.
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { LOOK, OUTLINE, BLOOM } from '../config/gameConfig'
import { dev, fxRefs } from '../dev/devState'

export function LiveLook() {
  const bg = useRef()
  const fog = useRef()
  const hemi = useRef()
  const seen = useRef(-1)

  useFrame(() => {
    if (seen.current === dev.version) return
    seen.current = dev.version

    bg.current?.set(LOOK.sky.horizon)
    if (fog.current) {
      fog.current.color.set(LOOK.sky.horizon)
      fog.current.near = dev.flags.fog ? LOOK.fog.near : 1e6
      fog.current.far = dev.flags.fog ? LOOK.fog.far : 2e6
    }
    if (hemi.current) {
      hemi.current.color.set(LOOK.hemi.sky)
      hemi.current.groundColor.set(LOOK.hemi.ground)
      hemi.current.intensity = LOOK.hemi.intensity
    }

    const o = fxRefs.outline?.uniforms
    if (o) {
      o.get('uLineColor').value.set(OUTLINE.color)
      o.get('uStrength').value = OUTLINE.enabled ? OUTLINE.strength : 0
      o.get('uWidth').value = OUTLINE.width
      o.get('uWidthRef').value = OUTLINE.widthRefDist
      o.get('uMinWidth').value = Math.max(1, OUTLINE.minWidth)
      o.get('uThreshold').value = OUTLINE.threshold
      o.get('uFade').value.set(OUTLINE.fadeStart, OUTLINE.fadeEnd)
      o.get('uShadowColor').value.set(OUTLINE.shadowColor)
      o.get('uShadowLift').value = OUTLINE.shadowLift
      o.get('uShadowRange').value = OUTLINE.shadowRange
    }
    const b = fxRefs.bloom
    if (b) {
      b.intensity = dev.flags.bloom ? BLOOM.intensity : 0
      if (b.luminanceMaterial) {
        b.luminanceMaterial.threshold = BLOOM.threshold
        b.luminanceMaterial.smoothing = BLOOM.smoothing
      }
      if (b.mipmapBlurPass) b.mipmapBlurPass.radius = BLOOM.radius
    }
  })

  return (
    <>
      <color ref={bg} attach="background" args={[LOOK.sky.horizon]} />
      <fog ref={fog} attach="fog" args={[LOOK.sky.horizon, LOOK.fog.near, LOOK.fog.far]} />
      <hemisphereLight ref={hemi} args={[LOOK.hemi.sky, LOOK.hemi.ground, LOOK.hemi.intensity]} />
    </>
  )
}
