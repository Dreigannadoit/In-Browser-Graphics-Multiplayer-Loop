import { useEffect, useState } from 'react'
import { useGame } from '../game/store'
import { player } from '../player/state'

const overlay = { position: 'fixed', pointerEvents: 'none', fontFamily: 'ui-monospace, Menlo, monospace', color: '#fff' }

export function Hud() {
  return (
    <>
      <Crosshair />
      <Stats />
      <DebugHud />
      <LockPrompt />
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
  const color = aimed ? '#4fe3ff' : 'rgba(255,255,255,0.85)'
  const size = aimed ? 18 : 10
  return (
    <div style={{ ...overlay, left: '50%', top: '50%', width: size, height: size, transform: 'translate(-50%,-50%)',
      border: `2px solid ${color}`, borderRadius: '50%', boxShadow: aimed ? '0 0 10px #4fe3ff' : 'none', transition: 'all 80ms' }} />
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
    ['double jump', p.canDoubleJump ? 'AVAILABLE' : 'used'],
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
        <span style={{ fontSize: 13, opacity: 0.8 }}>
          WASD move · Space jump / double jump · Ctrl or C slide · E / RMB grapple · F3 debug
        </span>
      </div>
    </div>
  )
}
