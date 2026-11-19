import { useEffect, useRef, useState } from 'react'
import { useGame } from '../game/store'
import { player } from '../player/state'
import { DOUBLE_JUMP, CONTROLS } from '../config/gameConfig'
import doubleJumpIcon from '../assets/double-jump.png'

const overlay = { position: 'fixed', pointerEvents: 'none', fontFamily: 'ui-monospace, Menlo, monospace', color: '#fff' }

export function Hud() {
  return (
    <>
      <SpeedLines />
      <Crosshair />
      <Stats />
      <DoubleJumpCharges />
      <DebugHud />
      <LockPrompt />
    </>
  )
}

// Radial speed streaks at the screen edges that fade in with total speed (falls count too). Updates a ref straight from the
// animation frame, so there are no React re-renders. Tune with SPEED_LINES.
const SPEED_LINES = { startSpeed: 13, fullSpeed: 26, maxOpacity: 0.55 }
const STREAKS = 'repeating-conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0) 2.1deg, rgba(255,255,255,0.9) 2.4deg, rgba(255,255,255,0) 2.9deg, rgba(255,255,255,0) 4.6deg, rgba(255,255,255,0.6) 4.8deg, rgba(255,255,255,0) 5.1deg, rgba(255,255,255,0) 7.3deg)'
const CLEAR_CENTER = 'radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.25) 55%, #000 85%)'

function SpeedLines() {
  const ref = useRef(null)
  useEffect(() => {
    let id
    let smooth = 0
    let last = performance.now()
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const v = player.vel
      const speed = Math.hypot(v.x, v.y, v.z)
      const target = Math.min(1, Math.max(0, (speed - SPEED_LINES.startSpeed) / (SPEED_LINES.fullSpeed - SPEED_LINES.startSpeed)))
      smooth += (target - smooth) * (1 - Math.exp(-5 * dt))
      if (ref.current) ref.current.style.opacity = String(smooth * SPEED_LINES.maxOpacity)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <>
      <style>{`@keyframes sl-flicker { 0% { transform: rotate(0deg) scale(1.15) } 25% { transform: rotate(3.1deg) scale(1.2) } 50% { transform: rotate(-1.7deg) scale(1.15) } 75% { transform: rotate(2.4deg) scale(1.22) } 100% { transform: rotate(0deg) scale(1.15) } }`}</style>
      <div ref={ref} style={{ ...overlay, inset: 0, overflow: 'hidden', opacity: 0, mixBlendMode: 'screen', WebkitMaskImage: CLEAR_CENTER, maskImage: CLEAR_CENTER }}>
        <div style={{ position: 'absolute', inset: '-20%', background: STREAKS, animation: 'sl-flicker 0.5s steps(4, end) infinite' }} />
      </div>
    </>
  )
}

function Crosshair() {
  const [aimed, setAimed] = useState(null)
  useEffect(() => {
    let id
    const loop = () => {
      setAimed((prev) => (prev === player.aimedGrapple ? prev : player.aimedGrapple))
      id = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(id)
  }, [])
  const color = aimed ? '#00ff66' : 'rgba(255,255,255,0.85)'
  const size = aimed ? 18 : 10
  return (
    <div style={{ ...overlay, left: '50%', top: '50%', width: size, height: size, transform: 'translate(-50%,-50%)',
      border: `2px solid ${color}`, borderRadius: '50%', boxShadow: aimed ? '0 0 10px #00ff66' : 'none', transition: 'all 80ms' }} />
  )
}

function Stats() {
  const health = useGame((s) => s.health)
  const coins = useGame((s) => s.coins)
  return (
    <div style={{ ...overlay, left: 16, bottom: 16, fontSize: 18, textShadow: '0 1px 3px #000' }}>
      ❤ {health} &nbsp; ● {coins}
    </div>
  )
}

// Bottom-right double-jump ability, styled after a hero-shooter ability slot (vertical stack):
//   charge-count badge → ability icon → bracketed recharge bar → keybind cap.
// The badge shows charges left; the bar fills as the NEXT charge recharges (full + bright at max charges).
// The icon dims while you can't air-jump right now (already used this airtime, or 0 charges).
// Swap `src/assets/double-jump.png` for final art — it's used as a mask, so only its silhouette matters (it renders white).
const SLOT = { accent: '#7ea6ff', accentDim: 'rgba(126,166,255,0.28)', danger: '#ff6b6b', ink: '#12121c', paper: '#ecebf3' }

function keyLabel(code) {
  if (code === 'Space') return 'SPACE'
  return code.replace(/^Key/, '').replace(/^Digit/, '').toUpperCase()
}

function DoubleJumpCharges() {
  const { maxCharges, rechargeSeconds } = DOUBLE_JUMP
  const [snap, setSnap] = useState({ charges: maxCharges, progress: 0, secs: 0, ready: true })
  useEffect(() => {
    let id
    const loop = () => {
      const charges = player.djCharges
      const full = charges >= maxCharges
      const progress = full ? 1 : Math.round((player.djRecharge / rechargeSeconds) * 100) / 100 // 1% steps → a few re-renders per second
      const secs = full ? 0 : Math.ceil(rechargeSeconds - player.djRecharge)
      const ready = player.canDoubleJump && charges > 0
      setSnap((prev) =>
        prev.charges === charges && prev.progress === progress && prev.secs === secs && prev.ready === ready ? prev : { charges, progress, secs, ready },
      )
      id = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(id)
  }, [maxCharges, rechargeSeconds])

  const { charges, progress, secs, ready } = snap
  const empty = charges === 0
  const recharging = charges < maxCharges
  const iconMask = `url(${doubleJumpIcon}) center / contain no-repeat`

  return (
    <div style={{ ...overlay, right: 24, bottom: 24, width: 92, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 8px 8px',
      borderRadius: 8, background: 'linear-gradient(180deg, rgba(14,16,32,0.02), rgba(14,16,32,0.05))'}}>
      {/* charge badge */}
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: empty ? '#3a2a30' : SLOT.paper, color: empty ? SLOT.danger : SLOT.ink,
        display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', fontWeight: 800, fontSize: 17, lineHeight: 1,
        boxShadow: `0 0 0 2px rgba(255,255,255,0.22), 0 0 0 4px rgba(10,10,20,0.6)`, transition: 'background 120ms, color 120ms' }}>
        {charges}
      </div>

      {/* ability icon (white silhouette) */}
      <div style={{ position: 'relative', width: 48, height: 40, marginTop: 4 }}>
        <div style={{ position: 'absolute', inset: 0, background: '#fff', WebkitMask: iconMask, mask: iconMask,
          opacity: ready ? 1 : 0.35, filter: ready ? `drop-shadow(0 0 6px ${SLOT.accent})` : 'none', transition: 'opacity 120ms' }} />
      </div>

      {/* bracketed recharge bar */}
      <div style={{ position: 'relative', width: '100%', height: 7, boxSizing: 'border-box', borderLeft: `2px solid ${SLOT.accent}`, borderRight: `2px solid ${SLOT.accent}`,
        borderBottom: `2px solid ${SLOT.accentDim}`, borderRadius: '0 0 2px 2px', opacity: recharging ? 1 : 0.9 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: -2, height: 2, background: SLOT.accent, transformOrigin: 'left',
          transform: `scaleX(${progress})`, boxShadow: `0 0 6px ${SLOT.accent}` }} />
      </div>

      {/* keybind cap + recharge countdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <div style={{ padding: '2px 6px', borderRadius: 4, background: SLOT.paper, color: SLOT.ink, fontFamily: 'system-ui, sans-serif', fontWeight: 800,
          fontSize: 10, letterSpacing: 0.5, boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25)' }}>
          {keyLabel(CONTROLS.jump[0])}
        </div>
        {recharging && <span style={{ fontSize: 11, fontWeight: 700, color: empty ? SLOT.danger : '#fff', textShadow: '0 1px 2px #000' }}>{secs}s</span>}
      </div>
    </div>
  )
}

// Debug overlay: delete this component (and its line in <Hud/>) to remove it. F3 / ` toggles it.
function DebugHud() {
  const visible = useGame((s) => s.debug)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 100)
    return () => clearInterval(id)
  }, [])
  if (!visible) return null
  const p = player
  const rows = [
    ['state', p.state],
    ['speed', `${p.speed.toFixed(1)} m/s`],
    // needs BOTH: the per-airtime allowance (resets on landing / wall run) AND at least one consumable charge
    ['double jump', p.djCharges < 1 ? 'NO CHARGES' : p.canDoubleJump ? 'AVAILABLE' : 'used (airtime)'],
    ['dj charges', `${p.djCharges}/${DOUBLE_JUMP.maxCharges}`],
    ['surface', `${p.surfaceType}${p.surfaceName ? ` (${p.surfaceName})` : ''}`],
    ['last ground obj', p.lastGroundObjectName ?? '—'],
  ]
  return (
    <div style={{ ...overlay, left: 12, top: 12, padding: '8px 10px', fontSize: 12, lineHeight: 1.5, background: 'rgba(0,0,0,0.55)', borderRadius: 6 }}>
      {rows.map(([k, v]) => (
        <div key={k}><span style={{ opacity: 0.6 }}>{k}: </span>{v}</div>
      ))}
    </div>
  )
}

function LockPrompt() {
  const locked = useGame((s) => s.locked)
  if (locked) return null
  return (
    <div style={{ ...overlay, inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.45)', fontSize: 20, textAlign: 'center' }}>
      <div>
        Click to play<br />
      </div>
    </div>
  )
}