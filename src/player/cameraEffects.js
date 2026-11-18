import { CAMERA } from '../config/gameConfig'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)
const clamp01 = (x) => Math.min(1, Math.max(0, x))

export const createCameraFx = () => ({ fov: CAMERA.baseFov, roll: 0, dip: 0, slide: 0 })

/** Pure render-side effects. Reads player state, never writes gameplay state (except consuming landImpact). */
export function updateCameraFx(fx, ps, dt) {
  // speed → FOV
  const t = clamp01((ps.speed - CAMERA.fovStartSpeed) / (CAMERA.fovFullSpeed - CAMERA.fovStartSpeed))
  fx.fov += (CAMERA.baseFov + t * CAMERA.fovBoost - fx.fov) * damp(CAMERA.fovLerp, dt)

  // wall-run tilt: lean away from the wall
  let targetRoll = 0
  if (ps.state === 'wallRunning' && ps.lastWall) {
    const n = ps.lastWall.normal
    const rightDotN = n.x * Math.cos(ps.yaw) - n.z * Math.sin(ps.yaw) // n · right, right = (cos,0,-sin)
    targetRoll = -rightDotN * ((CAMERA.wallRunTiltDeg * Math.PI) / 180) // wall on right → roll left
  }
  fx.roll += (targetRoll - fx.roll) * damp(CAMERA.tiltLerp, dt)

  // landing dip
  if (ps.landImpact > CAMERA.landDipMinImpact) {
    fx.dip = Math.max(fx.dip, Math.min(CAMERA.landDipMax, ps.landImpact * CAMERA.landDipPerSpeed))
  }
  ps.landImpact = 0
  fx.dip *= Math.exp(-CAMERA.landDipRecover * dt)

  // slide: lower the eye
  fx.slide += ((ps.state === 'sliding' ? 1 : 0) - fx.slide) * damp(12, dt)

  return { eyeOffsetY: -(fx.dip + fx.slide * CAMERA.slideEyeDrop) }
}
