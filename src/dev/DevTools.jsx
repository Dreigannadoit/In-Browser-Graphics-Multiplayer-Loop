// Developer tools panel. Loaded lazily and only mounted after the console password check (see devGate.js).
// No dependencies: plain React + inline styles. Press \ (backslash) to hide / show it (that also releases the mouse).
import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as THREE from 'three'
import { DOUBLE_JUMP, GAMEPLAY } from '../config/gameConfig'
import { getState, setState, useGame } from '../game/store'
import { player } from '../player/state'
import {
  TUNABLE, DEFAULTS, dev, touch, commit, getPath, setPath, resetAll, changesAsText, changedValues,
  snapshotAll, applySnapshot, listPresets, savePreset, deletePreset, loadPreset,
} from './devState'

// ── look & feel ──────────────────────────────────────────────────────────────
const C = { bg: 'rgba(12,14,28,0.95)', line: 'rgba(255,255,255,0.12)', text: '#e8ecff', dim: '#8d93b8', accent: '#7be3ff', warn: '#ffd23f', bad: '#ff6b6b', ok: '#7dff9b' }
const FONT = 'ui-monospace, Menlo, Consolas, monospace'
const inputStyle = { background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.line}`, color: C.text, borderRadius: 4, padding: '3px 6px', font: `12px ${FONT}`, minWidth: 0 }

// ── small UI pieces ──────────────────────────────────────────────────────────
function Section({ title, defaultOpen = false, children, right }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: `1px solid ${C.line}` }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', cursor: 'pointer', color: C.accent, fontWeight: 700, userSelect: 'none' }}>
        <span style={{ width: 10 }}>{open ? '▾' : '▸'}</span>
        <span style={{ flex: 1 }}>{title}</span>
        {right}
      </div>
      {open && <div style={{ padding: '0 10px 10px' }}>{children}</div>}
    </div>
  )
}

function Btn({ onClick, children, kind, style }) {
  const color = kind === 'bad' ? C.bad : kind === 'ok' ? C.ok : C.text
  return (
    <button onClick={onClick} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${C.line}`, color, borderRadius: 4, padding: '4px 8px', font: `12px ${FONT}`, cursor: 'pointer', ...style }}>
      {children}
    </button>
  )
}

function Toggle({ label, value, onChange, hint }) {
  return (
    <label title={hint} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', cursor: 'pointer' }}>
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span style={{ flex: 1 }}>{label}</span>
    </label>
  )
}

/** A toggle backed by something outside React (a dev flag): re-renders itself after changing it. */
function DevToggle({ label, get, set, hint }) {
  const [, force] = useReducer((n) => n + 1, 0)
  return <Toggle label={label} hint={hint} value={get()} onChange={(v) => { set(v); force() }} />
}

function SliderRow({ label, value, min, max, step, onChange, changed, onReset }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px 62px 16px', alignItems: 'center', gap: 6, padding: '2px 0' }}>
      <span title={label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: changed ? C.warn : C.text }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%' }} />
      <input type="number" step={step} value={Number.isFinite(value) ? Number(value.toFixed(4)) : 0} onChange={(e) => e.target.value !== '' && onChange(Number(e.target.value))} style={{ ...inputStyle, width: '100%' }} />
      {changed ? <span onClick={onReset} title="reset" style={{ cursor: 'pointer', color: C.dim }}>↺</span> : <span />}
    </div>
  )
}

// ── tunable config rows (auto-generated from the config objects) ─────────────
const RANGES = {
  'OUTLINE.strength': [0, 1, 0.01], 'OUTLINE.width': [1, 16, 1], 'OUTLINE.maxWidth': [1, 24, 1], 'OUTLINE.widthFalloff': [0, 1.5, 0.05], 'OUTLINE.minWidth': [1, 8, 1], 'OUTLINE.widthRefDist': [1, 100, 0.5], 'OUTLINE.threshold': [0.002, 0.1, 0.001],
  'OUTLINE.enemy.strength': [0, 1, 0.01], 'OUTLINE.enemy.width': [1, 16, 1], 'OUTLINE.enemy.maxWidth': [1, 24, 1], 'OUTLINE.enemy.minWidth': [1, 8, 1], 'OUTLINE.enemy.threshold': [0.002, 0.2, 0.002],
  'OUTLINE.point.strength': [0, 1, 0.01], 'OUTLINE.point.width': [1, 16, 1], 'OUTLINE.point.maxWidth': [1, 24, 1], 'OUTLINE.point.minWidth': [1, 8, 1], 'OUTLINE.point.threshold': [0.002, 0.2, 0.002],
  'OUTLINE.fadeStart': [0, 300, 1], 'OUTLINE.fadeEnd': [10, 500, 1], 'OUTLINE.shadowLift': [0, 2, 0.01], 'OUTLINE.shadowRange': [0.01, 0.5, 0.005],
  'TOON.saturation': [0, 2, 0.01], 'TOON.steps': [0, 1.5, 0.01],
  'BLOOM.intensity': [0, 4, 0.05], 'BLOOM.threshold': [0, 2, 0.01], 'BLOOM.smoothing': [0, 1, 0.01], 'BLOOM.radius': [0, 1, 0.01],
  'LOOK.sky.bands': [0, 10, 1], 'LOOK.fog.near': [0, 500, 1], 'LOOK.fog.far': [10, 1000, 5], 'LOOK.sun.intensity': [0, 6, 0.05], 'LOOK.hemi.intensity': [0, 3, 0.01],
  'DOUBLE_JUMP.maxCharges': [1, 30, 1], 'CAMERA.baseFov': [40, 140, 1], 'GAMEPLAY.maxHealth': [1, 500, 1],
}
const SELECTS = { 'DOUBLE_JUMP.resetMode': ['anyFloor', 'differentObject'] }

function rangeFor(path, def) {
  const key = path.filter((k) => !/^\d+$/.test(k)).join('.') // TOON.steps.0 → TOON.steps
  if (RANGES[key]) return RANGES[key]
  const a = Math.abs(def)
  if (a === 0) return [-5, 5, 0.01]
  const step = a >= 100 ? 1 : a >= 10 ? 0.1 : a >= 1 ? 0.05 : a >= 0.1 ? 0.005 : 0.001
  return [def < 0 ? -a * 3 : 0, a * 3, step]
}

function leaves(obj, path, out = []) {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v && typeof v === 'object') leaves(v, [...path, k], out)
    else out.push([...path, k])
  }
  return out
}

function TunableRow({ path }) {
  const [, force] = useReducer((n) => n + 1, 0)
  const cur = getPath(TUNABLE, path)
  const def = getPath(DEFAULTS, path)
  const label = path.slice(1).join('.')
  const set = (v) => {
    setPath(TUNABLE, path, v)
    commit()
    force()
  }
  const changed = cur !== def
  const reset = () => set(def)

  if (typeof cur === 'boolean') {
    return <Toggle label={<span style={{ color: changed ? C.warn : C.text }}>{label}</span>} value={cur} onChange={set} />
  }
  if (typeof cur === 'number') {
    const [min, max, step] = rangeFor(path, def)
    return <SliderRow label={label} value={cur} min={Math.min(min, cur)} max={Math.max(max, cur)} step={step} onChange={set} changed={changed} onReset={reset} />
  }
  if (typeof cur === 'string') {
    const opts = SELECTS[path.join('.')]
    if (/^#[0-9a-f]{6}$/i.test(cur)) {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px 62px 16px', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <span style={{ color: changed ? C.warn : C.text }}>{label}</span>
          <input type="color" value={cur} onChange={(e) => set(e.target.value)} style={{ width: '100%', height: 22, padding: 0, border: 'none', background: 'none' }} />
          <input type="text" value={cur} onChange={(e) => /^#[0-9a-f]{6}$/i.test(e.target.value) && set(e.target.value)} style={{ ...inputStyle, width: '100%' }} />
          {changed ? <span onClick={reset} style={{ cursor: 'pointer', color: C.dim }}>↺</span> : <span />}
        </div>
      )
    }
    if (opts) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
          <span style={{ flex: 1, color: changed ? C.warn : C.text }}>{label}</span>
          <select value={cur} onChange={(e) => set(e.target.value)} style={inputStyle}>
            {opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      )
    }
  }
  return null // other strings (e.g. tone-mapping name) aren't live-editable
}

function TunableGroup({ name, filter = '', defaultOpen = false }) {
  const rows = useMemo(() => leaves(TUNABLE[name], [name]), [name])
  const f = filter.trim().toLowerCase()
  const shown = f ? rows.filter((p) => p.join('.').toLowerCase().includes(f)) : rows
  if (f && !shown.length) return null
  return (
    <Section title={`${name}${f ? ` (${shown.length})` : ''}`} defaultOpen={defaultOpen || !!f}>
      {shown.map((p) => <TunableRow key={p.join('.')} path={p} />)}
    </Section>
  )
}

// ── polling helpers ──────────────────────────────────────────────────────────
function useTicker(ms = 100) {
  const [, tick] = useReducer((n) => n + 1, 0)
  useEffect(() => {
    const id = setInterval(tick, ms)
    return () => clearInterval(id)
  }, [ms])
}

/** Event log + speed samples, collected whether or not their tab is open. */
function useTelemetry() {
  const log = useRef([])
  const samples = useRef({ speed: new Float32Array(300), vy: new Float32Array(300), i: 0 })
  useEffect(() => {
    let id
    const prev = { state: player.state, dj: player.djCharges, coins: getState().coins, health: getState().health, cp: getState().checkpoint }
    const push = (m) => {
      log.current.unshift(`${(performance.now() / 1000).toFixed(1)}s  ${m}`)
      if (log.current.length > 40) log.current.pop()
    }
    const loop = () => {
      const s = samples.current
      s.speed[s.i % 300] = player.speed
      s.vy[s.i % 300] = player.vel.y
      s.i++
      if (player.state !== prev.state) { push(`${prev.state} → ${player.state}`); prev.state = player.state }
      if (player.djCharges < prev.dj) push(`double-jump charge used (${player.djCharges}/${DOUBLE_JUMP.maxCharges})`)
      prev.dj = player.djCharges
      const g = getState()
      if (g.coins !== prev.coins) { push(`coins ${prev.coins} → ${g.coins}`); prev.coins = g.coins }
      if (g.health !== prev.health) { push(`health ${prev.health} → ${g.health}`); prev.health = g.health }
      if (g.checkpoint !== prev.cp) { push(`checkpoint ${g.checkpoint ?? 'none'}`); prev.cp = g.checkpoint }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
  return { log, samples }
}

function Graph({ samples }) {
  const ref = useRef(null)
  useEffect(() => {
    let id
    const draw = () => {
      const c = ref.current
      if (c) {
        const g = c.getContext('2d')
        const { width: W, height: H } = c
        const s = samples.current
        const N = s.speed.length
        g.clearRect(0, 0, W, H)
        g.fillStyle = 'rgba(255,255,255,0.05)'
        g.fillRect(0, 0, W, H)
        g.strokeStyle = 'rgba(255,255,255,0.2)'
        g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke()
        const plot = (arr, color, centered) => {
          g.strokeStyle = color
          g.beginPath()
          for (let k = 0; k < N; k++) {
            const v = arr[(s.i + k) % N]
            const x = (k / (N - 1)) * W
            const y = centered ? H / 2 - (v / 30) * (H / 2) : H - (v / 30) * H
            k ? g.lineTo(x, y) : g.moveTo(x, y)
          }
          g.stroke()
        }
        plot(s.speed, C.accent, false)
        plot(s.vy, '#ffb347', true)
      }
      id = requestAnimationFrame(draw)
    }
    id = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(id)
  }, [samples])
  return <canvas ref={ref} width={300} height={90} style={{ width: '100%', height: 90, display: 'block' }} />
}

// ── tabs ─────────────────────────────────────────────────────────────────────
function LookTab() {
  return (
    <>
      <Section title="Quick switches" defaultOpen>
        <DevToggle label="Bloom" get={() => dev.flags.bloom} set={(v) => { dev.flags.bloom = v; touch() }} />
        <DevToggle label="Fog" get={() => dev.flags.fog} set={(v) => { dev.flags.fog = v; touch() }} />
        <DevToggle label="Shadows" get={() => dev.flags.shadows} set={(v) => { dev.flags.shadows = v; touch() }} />
        <div style={{ color: C.dim, marginTop: 4 }}>Toon and outline switches are the "enabled" rows below.</div>
      </Section>
      {['LOOK', 'TOON', 'OUTLINE', 'BLOOM'].map((g) => <TunableGroup key={g} name={g} defaultOpen={g === 'LOOK'} />)}
    </>
  )
}

function MovementTab() {
  const [q, setQ] = useState('')
  return (
    <>
      <div style={{ padding: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter… (e.g. grav, slide, wall)" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
        <div style={{ color: C.dim, marginTop: 6 }}>Changes apply instantly. Orange rows differ from gameConfig.js; ↺ resets one.</div>
      </div>
      {['MOVE', 'DOUBLE_JUMP', 'CAMERA', 'GAMEPLAY'].map((g) => <TunableGroup key={g} name={g} filter={q} defaultOpen={g === 'MOVE'} />)}
    </>
  )
}

function teleportTargets() {
  const m = dev.map
  if (!m) return []
  const t = []
  m.spawns.player.forEach((s) => t.push({ label: `Spawn  ${s.name}`, position: s.position, yaw: s.yaw }))
  m.triggers.filter((x) => x.kind === 'Checkpoint').forEach((c) => t.push({ label: `Checkpoint  ${c.name}`, position: c.respawnPosition, yaw: player.yaw }))
  m.pickups.forEach((p) => t.push({ label: `${p.kind}  ${p.name}`, position: p.position, yaw: player.yaw }))
  m.grapplePoints.forEach((g) => t.push({ label: `Grapple  ${g.name} (3 m below)`, position: g.position.clone().add(new THREE.Vector3(0, -3, 0)), yaw: player.yaw }))
  return t
}
const teleportTo = (x, y, z, yaw = player.yaw) => { dev.pendingTeleport = { position: new THREE.Vector3(x, y, z), yaw } }

function PlayerTab() {
  useTicker(100)
  const [, force] = useReducer((n) => n + 1, 0)
  const targets = useMemo(teleportTargets, [])
  const [pick, setPick] = useState(0)
  const [xyz, setXyz] = useState(['0', '5', '0'])
  const p = player.pos

  return (
    <>
      <Section title="Cheats" defaultOpen>
        <DevToggle label="God mode (ignore kill zones, full health)" get={() => dev.god} set={(v) => (dev.god = v)} />
        <DevToggle label="Noclip / fly (WASD + look, Space up, slide-key down, Shift faster)" get={() => dev.noclip} set={(v) => (dev.noclip = v)} />
        <DevToggle label="Infinite double-jump charges" get={() => dev.infiniteCharges} set={(v) => (dev.infiniteCharges = v)} />
        <DevToggle label="Grapple to anything (any surface you look at, uses grapple.json defaults)" get={() => dev.grappleToAnything} set={(v) => (dev.grappleToAnything = v)} />
        <SliderRow label="noclip speed (m/s)" value={dev.noclipSpeed} min={2} max={80} step={1} onChange={(v) => { dev.noclipSpeed = v; force() }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          <Btn onClick={() => setState({ health: GAMEPLAY.maxHealth })}>Refill health</Btn>
          <Btn onClick={() => { player.djCharges = DOUBLE_JUMP.maxCharges; player.djRecharge = 0 }}>Refill charges</Btn>
        </div>
      </Section>

      <Section title="Time" defaultOpen>
        <SliderRow label="time scale" value={dev.timeScale} min={0.05} max={2} step={0.05} onChange={(v) => { dev.timeScale = v; force() }} changed={dev.timeScale !== 1} onReset={() => { dev.timeScale = 1; force() }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <DevToggle label="Pause" get={() => dev.paused} set={(v) => (dev.paused = v)} />
          <Btn onClick={() => { dev.stepRequests++ }}>Step 1 frame</Btn>
        </div>
        <div style={{ color: C.dim, marginTop: 4 }}>Slow-motion scales the simulation step; the camera still renders in real time.</div>
      </Section>

      <Section title="Teleport" defaultOpen>
        {targets.length ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={pick} onChange={(e) => setPick(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }}>
              {targets.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
            </select>
            <Btn onClick={() => { const t = targets[pick]; if (t) dev.pendingTeleport = { position: t.position.clone(), yaw: t.yaw } }}>Go</Btn>
          </div>
        ) : <div style={{ color: C.dim }}>Map still loading…</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, marginTop: 8 }}>
          {xyz.map((v, i) => <input key={i} value={v} onChange={(e) => setXyz(xyz.map((o, j) => (j === i ? e.target.value : o)))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />)}
          <Btn onClick={() => { const [x, y, z] = xyz.map(Number); if ([x, y, z].every(Number.isFinite)) teleportTo(x, y, z) }}>Go</Btn>
        </div>
        <div style={{ marginTop: 4 }}><Btn onClick={() => setXyz([p.x, p.y, p.z].map((n) => n.toFixed(2)))}>Use my position</Btn></div>

        <div style={{ marginTop: 10, color: C.dim }}>Saved positions</div>
        {dev.slots.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 0' }}>
            <span style={{ width: 52 }}>slot {i + 1}</span>
            <Btn onClick={() => { dev.slots[i] = { x: p.x, y: p.y, z: p.z, yaw: player.yaw }; force() }}>Save</Btn>
            <Btn onClick={() => { const q = dev.slots[i]; if (q) teleportTo(q.x, q.y, q.z, q.yaw) }}>{s ? 'Return' : '—'}</Btn>
            <span style={{ color: C.dim, fontSize: 11 }}>{s ? `${s.x.toFixed(1)}, ${s.y.toFixed(1)}, ${s.z.toFixed(1)}` : 'empty'}</span>
          </div>
        ))}
      </Section>

      <Section title="Live readout" defaultOpen>
        <div style={{ lineHeight: 1.6 }}>
          <div>pos  {p.x.toFixed(2)}, {p.y.toFixed(2)}, {p.z.toFixed(2)}</div>
          <div>vel  {player.vel.x.toFixed(1)}, {player.vel.y.toFixed(1)}, {player.vel.z.toFixed(1)}</div>
          <div>speed {player.speed.toFixed(1)} m/s   state {player.state}</div>
          <div>charges {player.djCharges}/{DOUBLE_JUMP.maxCharges}   yaw {((player.yaw * 180) / Math.PI).toFixed(0)}°</div>
        </div>
      </Section>
    </>
  )
}

function MapObjects() {
  const [, force] = useReducer((n) => n + 1, 0)
  const [q, setQ] = useState('')
  const items = useMemo(() => {
    const out = []
    dev.map?.scene.traverse((o) => { if (o.isMesh && o.name && out.length < 600) out.push(o) })
    return out
  }, [])
  const f = q.trim().toLowerCase()
  const shown = (f ? items.filter((o) => o.name.toLowerCase().includes(f)) : items).slice(0, 60)
  return (
    <>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter objects…" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <Btn onClick={() => { items.forEach((o) => (o.visible = true)); force() }}>Show all</Btn>
      </div>
      {shown.map((o) => <Toggle key={o.uuid} label={o.name} value={o.visible} onChange={(v) => { o.visible = v; force() }} />)}
      <div style={{ color: C.dim, marginTop: 4 }}>Visual only: colliders stay. Showing {shown.length} of {items.length}.</div>
    </>
  )
}

function DebugTab({ telemetry }) {
  useTicker(250)
  const hud = useGame((s) => s.debug)
  const colliders = useGame((s) => s.devColliders)
  const st = dev.stats
  return (
    <>
      <Section title="Overlays" defaultOpen>
        <Toggle label="Physics colliders" value={colliders} onChange={(v) => setState({ devColliders: v })} />
        <Toggle label="Debug text (F3)" value={hud} onChange={(v) => setState({ debug: v })} />
        <DevToggle label="Velocity arrow" get={() => dev.flags.velocityArrow} set={(v) => (dev.flags.velocityArrow = v)} />
      </Section>
      <Section title="Render stats" defaultOpen>
        <div style={{ lineHeight: 1.6 }}>
          <div>fps {st.fps}</div>
          <div>draw calls {st.calls}   triangles {st.triangles.toLocaleString()}</div>
          <div>geometries {st.geometries}   textures {st.textures}</div>
          <div style={{ color: C.dim }}>Calls/triangles are for the last pass drawn (approximate with post-processing).</div>
        </div>
      </Section>
      <Section title="Speed graph" defaultOpen>
        <Graph samples={telemetry.samples} />
        <div style={{ color: C.dim, marginTop: 4 }}><span style={{ color: C.accent }}>■</span> speed 0–30 m/s   <span style={{ color: '#ffb347' }}>■</span> vertical ±30 m/s   (~5 s)</div>
      </Section>
      <Section title="Event log" defaultOpen>
        <div style={{ maxHeight: 180, overflow: 'auto', lineHeight: 1.5, fontSize: 11 }}>
          {telemetry.log.current.length ? telemetry.log.current.map((l, i) => <div key={i}>{l}</div>) : <span style={{ color: C.dim }}>Nothing yet. Move around.</span>}
        </div>
      </Section>
      <Section title="Map objects">
        <MapObjects />
      </Section>
    </>
  )
}

function PresetsTab() {
  const [, force] = useReducer((n) => n + 1, 0)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [json, setJson] = useState('')
  const presets = listPresets()
  const flash = (m) => { setNote(m); setTimeout(() => setNote(''), 2500) }
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); flash(msg) } catch { flash('Copy blocked by the browser. Check the console.'); console.log(text) }
  }
  const nChanged = changedValues().length
  return (
    <>
      <Section title="Your changes" defaultOpen>
        <div style={{ color: C.dim, marginBottom: 6 }}>{nChanged} value(s) differ from gameConfig.js. Copy the list and paste the new values into the config file to keep them.</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Btn kind="ok" onClick={() => copy(changesAsText(), 'Copied changed values')}>Copy changed values</Btn>
          <Btn kind="bad" onClick={() => { resetAll(); force(); flash('Everything reset') }}>Reset everything</Btn>
        </div>
      </Section>
      <Section title="Saved presets" defaultOpen>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="preset name (e.g. floaty)" style={{ ...inputStyle, flex: 1 }} />
          <Btn onClick={() => { if (name.trim()) { savePreset(name.trim()); setName(''); force() } }}>Save</Btn>
        </div>
        {Object.keys(presets).map((n) => (
          <div key={n} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}>
            <span style={{ flex: 1 }}>{n}</span>
            <Btn onClick={() => { loadPreset(n); force(); flash(`Loaded "${n}"`) }}>Load</Btn>
            <Btn kind="bad" onClick={() => { deletePreset(n); force() }}>✕</Btn>
          </div>
        ))}
        {!Object.keys(presets).length && <div style={{ color: C.dim, marginTop: 6 }}>None yet. Presets live in this browser only.</div>}
      </Section>
      <Section title="Export / import (JSON)">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <Btn onClick={() => copy(JSON.stringify(snapshotAll(), null, 2), 'Copied all values as JSON')}>Copy all as JSON</Btn>
          <Btn onClick={() => { try { applySnapshot(JSON.parse(json)); force(); flash('Imported') } catch { flash('That JSON is not valid') } }}>Apply pasted JSON</Btn>
        </div>
        <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={5} placeholder="paste exported JSON here" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
      </Section>
      {note && <div style={{ padding: '6px 10px', color: C.ok }}>{note}</div>}
    </>
  )
}

// ── shell ────────────────────────────────────────────────────────────────────
const TABS = ['Look', 'Movement', 'Player', 'Debug', 'Presets']

export default function DevTools() {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState('Look')
  const telemetry = useTelemetry()

  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Backslash') return
      e.preventDefault()
      setOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (open && document.pointerLockElement) document.exitPointerLock() // free the mouse so the panel is clickable
  }, [open])

  if (!open) {
    return (
      <div onClick={() => setOpen(true)} style={{ position: 'fixed', top: 8, right: 8, zIndex: 1000, padding: '4px 10px', borderRadius: 4, background: C.bg, color: C.accent, font: `700 11px ${FONT}`, cursor: 'pointer' }}>
        DEV ▸ (\)
      </div>
    )
  }

  // keep typing in the panel from reaching the game's key handlers; \ still toggles
  const guard = (e) => {
    if (e.type === 'keydown' && e.code === 'Backslash') { e.preventDefault(); setOpen(false) }
    e.stopPropagation()
  }

  return (
    <div onKeyDown={guard} onKeyUp={guard} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 360, zIndex: 1000, background: C.bg, color: C.text, font: `12px ${FONT}`, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${C.line}`, backdropFilter: 'blur(6px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 8 }}>
        <strong style={{ color: C.accent, flex: 1 }}>DEV TOOLS</strong>
        <span style={{ color: C.dim }}>\ hides</span>
        <Btn onClick={() => setOpen(false)}>✕</Btn>
      </div>
      <div style={{ display: 'flex', gap: 2, padding: '0 6px 6px' }}>
        {TABS.map((t) => (
          <div key={t} onClick={() => setTab(t)} style={{ flex: 1, textAlign: 'center', padding: '5px 0', cursor: 'pointer', borderRadius: 4, background: tab === t ? 'rgba(123,227,255,0.18)' : 'transparent', color: tab === t ? C.accent : C.dim }}>
            {t}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>
        {tab === 'Look' && <LookTab />}
        {tab === 'Movement' && <MovementTab />}
        {tab === 'Player' && <PlayerTab />}
        {tab === 'Debug' && <DebugTab telemetry={telemetry} />}
        {tab === 'Presets' && <PresetsTab />}
      </div>
    </div>
  )
}
