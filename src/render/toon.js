// Toon (cel) shading: swap the map's PBR materials for MeshToonMaterial with a stepped light ramp.
// Keeps each material's colour, texture, emissive and transparency, so the map looks the same but banded.
// Conversion happens once at load; refreshToon() re-applies TOON (ramp values, saturation, on/off) live for the dev tools.
import * as THREE from 'three'
import { TOON } from '../config/gameConfig'

function writeSteps(tex, steps) {
  const data = tex.image.data
  const n = data.length / 4
  for (let i = 0; i < n; i++) {
    const v = steps[Math.min(i, steps.length - 1)]
    const b = Math.round(Math.min(1, Math.max(0, v)) * 255)
    data.set([b, b, b, 255], i * 4)
  }
  tex.needsUpdate = true
}

/** N-step grey ramp as a 1-D nearest-filtered texture (darkest step first). */
export function makeGradientMap(steps = TOON.steps) {
  const n = steps.length
  const tex = new THREE.DataTexture(new Uint8Array(n * 4), n, 1, THREE.RGBAFormat)
  tex.minFilter = tex.magFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  writeSteps(tex, steps)
  return tex
}

const converted = new WeakSet()
const toonMaterials = new Set() // every MeshToonMaterial we created
const meshRecords = [] // { mesh, orig, toon } so toon can be switched on/off live
let gradientTex = null

function applySaturation(m) {
  const base = m.userData.baseColor
  if (!base) return
  m.color.copy(base)
  if (TOON.saturation !== 1) {
    const hsl = { h: 0, s: 0, l: 0 }
    m.color.getHSL(hsl)
    m.color.setHSL(hsl.h, Math.min(1, hsl.s * TOON.saturation), hsl.l) // push colours toward saturated "paint" tones
  }
}

function toToon(src, gradientMap) {
  if (src.isMeshToonMaterial || !src.isMeshStandardMaterial) return src
  const m = new THREE.MeshToonMaterial({
    color: src.color,
    map: src.map,
    emissive: src.emissive,
    emissiveMap: src.emissiveMap,
    emissiveIntensity: src.emissiveIntensity,
    alphaMap: src.alphaMap,
    transparent: src.transparent,
    opacity: src.opacity,
    side: src.side,
    vertexColors: src.vertexColors,
    gradientMap,
  })
  m.name = src.name
  m.userData = { ...src.userData, baseColor: src.color.clone() }
  applySaturation(m)
  toonMaterials.add(m)
  return m
}

/** Convert every mesh material under `root` (once). Original materials are kept so TOON.enabled can be flipped live. */
export function applyToon(root) {
  if (converted.has(root)) return
  converted.add(root)
  gradientTex = makeGradientMap()
  const cache = new Map() // share converted materials between meshes
  root.traverse((o) => {
    if (!o.isMesh) return
    const swap = (mat) => {
      if (!cache.has(mat)) cache.set(mat, toToon(mat, gradientTex))
      return cache.get(mat)
    }
    const orig = o.material
    const toon = Array.isArray(orig) ? orig.map(swap) : swap(orig)
    meshRecords.push({ mesh: o, orig, toon })
    o.material = TOON.enabled ? toon : orig
  })
}

/** Re-apply the TOON config to the already-loaded map (ramp values, saturation, enabled). Cheap enough to call on every slider tick. */
export function refreshToon() {
  if (gradientTex) writeSteps(gradientTex, TOON.steps)
  toonMaterials.forEach(applySaturation)
  for (const r of meshRecords) {
    const want = TOON.enabled ? r.toon : r.orig
    if (r.mesh.material !== want) r.mesh.material = want
  }
}
