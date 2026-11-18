import { CAMERA } from '../config/gameConfig'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const DEG = Math.PI / 180

export const createCameraFx = () => ({ fov: CAMERA.baseFov, roll: 0, dip: 0, slide: 0, strafe: 0, bobPhase: 0, bob: 0 })

/** Pure render-side effects. Reads player state, never writes gameplay state (except consuming landImpact). */
export function updateCameraFx(fx, ps, dt) {
  // speed → FOV
  const t = clamp01((ps.speed - CAMERA.fovStartSpeed) / (CAMERA.fovFullSpeed - CAMERA.fovStartSpeed))
  fx.fov += (CAMERA.baseFov + t * CAMERA.fovBoost - fx.fov) * damp(CAMERA.fovLerp, dt)

  // roll: wall-run lean away from the wall, otherwise lean into strafing / slide turns
  let targetRoll = 0
  if (ps.state === 'wallRunning' && ps.lastWall) {
    const n = ps.lastWall.normal
    const rightDotN = n.x * Math.cos(ps.yaw) - n.z * Math.sin(ps.yaw) // n · right, right = (cos,0,-sin)
    targetRoll = -rightDotN * (CAMERA.wallRunTiltDeg * DEG) // wall on right → roll left
  } else {
    const strafeSpeed = ps.vel.x * Math.cos(ps.yaw) - ps.vel.z * Math.sin(ps.yaw) // velocity · camera right
    const k = clamp01(Math.abs(strafeSpeed) / 9) * Math.sign(strafeSpeed)
    const deg = ps.state === 'sliding' ? CAMERA.slideRollDeg : CAMERA.strafeRollDeg
    targetRoll = -k * deg * DEG // moving right → lean right (negative roll)
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

  // run bob: only while walking/sprinting on the ground
  const running = ps.state === 'grounded' && ps.speed > 1
  if (running) fx.bobPhase += ps.speed * dt * CAMERA.bobFreq * Math.PI * 2
  const bobTarget = running ? Math.sin(fx.bobPhase) * CAMERA.bobAmount * clamp01(ps.speed / 9) : 0
  fx.bob += (bobTarget - fx.bob) * damp(18, dt)

  return { eyeOffsetY: -(fx.dip + fx.slide * CAMERA.slideEyeDrop) + fx.bob }
}
