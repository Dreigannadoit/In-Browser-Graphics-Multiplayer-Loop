// Developer-tools state. Small and UI-free so game code (Player, Sun, LiveLook) can import it cheaply.
// Everything here is inert until dev mode is unlocked (see devGate.js): the flags default to "off / normal".
import { MOVE, CAMERA, DOUBLE_JUMP, GAMEPLAY, LOOK, TOON, OUTLINE, BLOOM } from '../config/gameConfig'
import { refreshToon } from '../render/toon'

/** Config groups the panel can tune live (they're plain mutable objects that the game reads every frame). */
export const TUNABLE = { MOVE, CAMERA, DOUBLE_JUMP, GAMEPLAY, LOOK, TOON, OUTLINE, BLOOM }

const clone = (o) => JSON.parse(JSON.stringify(o))
/** Pristine copy taken at startup, before anything can touch it. Used for "reset" and for diffing. */
export const DEFAULTS = clone(TUNABLE)

export const dev = {
  version: 0, // bumped whenever a look value changes; LiveLook re-applies when it sees a new number
  god: false, // ignore kill zones, keep health full
  noclip: false, // fly through everything
  noclipSpeed: 14,
  infiniteCharges: false,
  grappleToAnything: false, // grapple onto any solid surface under the crosshair (not just map grapple points)
  timeScale: 1,
  paused: false,
  stepRequests: 0, // "advance one frame" presses while paused
  pendingTeleport: null, // { position: Vector3, yaw } — consumed by the player's sim step
  map: null, // loaded map data (set by <Player/>)
  slots: [null, null, null], // saved positions { x, y, z, yaw }
  flags: { bloom: true, fog: true, shadows: true, velocityArrow: false },
  stats: { fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0 }, // written by <DevProbe/>
}

/** Live post-effect instances, so sliders can update uniforms instead of rebuilding shaders. Set from App.jsx. */
export const fxRefs = { outline: null, bloom: null }

export const touch = () => {
  dev.version++
}

/** Seconds to simulate this fixed step: 0 = skip (paused), otherwise base * timeScale. */
export function simDt(base) {
  if (dev.stepRequests > 0) {
    dev.stepRequests--
    return base
  }
  if (dev.paused) return 0
  return base * dev.timeScale
}

export function resetCheats() {
  dev.god = false
  dev.noclip = false
  dev.infiniteCharges = false
  dev.grappleToAnything = false
  dev.timeScale = 1
  dev.paused = false
  dev.stepRequests = 0
  dev.pendingTeleport = null
  dev.flags.bloom = dev.flags.fog = dev.flags.shadows = true
  dev.flags.velocityArrow = false
}

// ── config tuning helpers ────────────────────────────────────────────────────
export const getPath = (root, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), root)
export function setPath(root, path, value) {
  const parent = getPath(root, path.slice(0, -1))
  if (parent) parent[path[path.length - 1]] = value
}

function deepAssign(target, src) {
  for (const k of Object.keys(src)) {
    const v = src[k]
    if (v && typeof v === 'object') {
      if (target[k] && typeof target[k] === 'object') deepAssign(target[k], v)
      else target[k] = clone(v)
    } else target[k] = v
  }
}

/** Call after changing any tunable value so rendering picks it up. */
export function commit() {
  refreshToon()
  touch()
}

export function resetAll() {
  for (const g of Object.keys(TUNABLE)) deepAssign(TUNABLE[g], DEFAULTS[g])
  commit()
}
export const snapshotAll = () => clone(TUNABLE)
export function applySnapshot(snap) {
  for (const g of Object.keys(snap)) if (TUNABLE[g]) deepAssign(TUNABLE[g], snap[g])
  commit()
}

function walk(cur, def, path, out) {
  if (cur && typeof cur === 'object') for (const k of Object.keys(cur)) walk(cur[k], def?.[k], [...path, k], out)
  else if (cur !== def) out.push({ path, cur, def })
}
export function changedValues() {
  const out = []
  for (const g of Object.keys(TUNABLE)) walk(TUNABLE[g], DEFAULTS[g], [g], out)
  return out
}
const fmt = (v) => (typeof v === 'string' ? `'${v}'` : String(v))
/** Paste-able list of everything you changed, with the old value, so you can copy it into gameConfig.js. */
export function changesAsText() {
  const rows = changedValues()
  if (!rows.length) return '// no changes from the defaults in gameConfig.js'
  return rows.map((r) => `${r.path.join('.')} = ${fmt(r.cur)} // was ${fmt(r.def)}`).join('\n')
}

// ── presets (browser localStorage) ───────────────────────────────────────────
const PRESET_KEY = 'devtools.presets.v1'
export function listPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESET_KEY) || '{}')
  } catch {
    return {}
  }
}
function writePresets(p) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(p))
  } catch {
    /* storage blocked: presets just won't persist */
  }
}
export function savePreset(name) {
  writePresets({ ...listPresets(), [name]: snapshotAll() })
}
export function deletePreset(name) {
  const p = listPresets()
  delete p[name]
  writePresets(p)
}
export function loadPreset(name) {
  const snap = listPresets()[name]
  if (snap) applySnapshot(snap)
}
