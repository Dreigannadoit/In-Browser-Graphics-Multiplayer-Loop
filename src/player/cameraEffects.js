import { CAMERA } from '../config/gameConfig'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)
const clamp01 = (x) => Math.min(1, Math.max(0, x))
const DEG = Math.PI / 180

export const createCameraFx = () => ({
  fov: CAMERA.baseFov, roll: 0, dip: 0, slide: 0, strafe: 0, bobPhase: 0, bob: 0, sway: 0, time: 0,
  kickFov: 0, kickPitch: 0, kickRoll: 0, shake: 0, step: 0,
})

/**
 * Pure render-side effects. Reads player state, never writes gameplay state (except consuming landImpact / fxEvents).
 * Returns everything the camera needs: { eyeOffsetY, eyeOffsetRight, fov, pitch, roll } — pitch/roll are OFFSETS / totals
 * for the view only; the player's real aim (ps.pitch / ps.yaw) is never modified.
 */
export function updateCameraFx(fx, ps, dt) {
  fx.time += dt

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

  // event impulses (jump / double jump / wall jump / slide / wall run / grapple)
  for (const ev of ps.fxEvents) {
    const k = CAMERA.kicks[ev.type]
    if (!k) continue
    fx.kickFov += k.fov ?? 0
    fx.kickPitch += (k.pitch ?? 0) * DEG
    // roll is signed by the event's side: wall on the right (side<0) → roll left, etc. — same convention as the wall-run tilt
    fx.kickRoll += -Math.sign(ev.side || 0) * (k.roll ?? 0) * DEG
  }
  ps.fxEvents.length = 0

  // landing: eye dips AND the view pitches down, both scaled by impact speed
  if (ps.landImpact > CAMERA.landDipMinImpact) {
    fx.dip = Math.max(fx.dip, Math.min(CAMERA.landDipMax, ps.landImpact * CAMERA.landDipPerSpeed))
    fx.kickPitch -= Math.min(CAMERA.landPitchMax, ps.landImpact * CAMERA.landPitchPerSpeed)
  }
  ps.landImpact = 0
  fx.dip *= Math.exp(-CAMERA.landDipRecover * dt)

  // step-up smoothing: the body snaps up a ledge instantly, the eye lags below it and eases back
  const SS = CAMERA.stepSmooth
  fx.step = Math.max(-SS.maxOffset, Math.min(SS.maxOffset, fx.step - ps.stepPush))
  ps.stepPush = 0
  fx.step *= Math.exp(-SS.recover * dt)

  // impulses decay back to 0
  fx.kickFov *= Math.exp(-CAMERA.fovKickRecover * dt)
  fx.kickPitch *= Math.exp(-CAMERA.pitchKickRecover * dt)
  fx.kickRoll *= Math.exp(-CAMERA.rollKickRecover * dt)

  // slide: lower the eye
  fx.slide += ((ps.state === 'sliding' ? 1 : 0) - fx.slide) * damp(12, dt)

  // run bob (vertical, once per footstep) + sway (side to side, once per stride = half the bob frequency)
  const running = ps.state === 'grounded' && ps.speed > 1
  if (running) fx.bobPhase += ps.speed * dt * CAMERA.bobFreq * Math.PI * 2
  const amp = running ? clamp01(ps.speed / 9) : 0
  fx.bob += (Math.sin(fx.bobPhase) * CAMERA.bobAmount * amp - fx.bob) * damp(18, dt)
  fx.sway += (Math.sin(fx.bobPhase * 0.5) * amp - fx.sway) * damp(14, dt) // -1..1

  // speed shake: smooth noise that fades in with speed; stronger while sliding / wall running
  const speedT = clamp01((ps.speed - CAMERA.shakeStartSpeed) / (CAMERA.shakeFullSpeed - CAMERA.shakeStartSpeed))
  const shakeTarget = speedT * (CAMERA.shakeStateMult[ps.state] ?? 1)
  fx.shake += (shakeTarget - fx.shake) * damp(6, dt)
  const T = fx.time
  const shakePitch = (Math.sin(T * 41.3) + Math.sin(T * 27.9 + 1.7) * 0.7) * 0.59 * fx.shake * CAMERA.shakeDeg * DEG
  const shakeRoll = (Math.sin(T * 33.1 + 0.6) + Math.sin(T * 21.4 + 2.9) * 0.7) * 0.59 * fx.shake * CAMERA.shakeDeg * DEG

  return {
    eyeOffsetY: -(fx.dip + fx.slide * CAMERA.slideEyeDrop) + fx.bob + fx.step,
    eyeOffsetRight: fx.sway * CAMERA.swayAmount,
    fov: fx.fov + fx.kickFov,
    pitch: fx.kickPitch + shakePitch,
    roll: fx.roll + fx.kickRoll + fx.sway * CAMERA.swayRollDeg * DEG + shakeRoll,
  }
}
