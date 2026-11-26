// Loads the enemy FBX files (through R3F's useLoader, so it suspends and caches) and turns them into ready-to-clone assets:
//   • one normalised template (rescaled to ENEMIES.height, origin at the feet, toon material),
//   • one cleaned AnimationClip per clip key of every enemy type (root motion removed).
// Swapping FBX for a single baked GLB later only touches this file.
import { useMemo } from 'react'
import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { ENEMIES } from '../config/gameConfig'
import { makeGradientMap } from '../render/toon'
import { OUTLINE_LAYER, tagOutlineLayer } from '../render/layers'
import { stripRootMotion, boneKey } from './clips'

const TYPES = Object.entries(ENEMIES.types)
const CLIP_URLS = [...new Set(TYPES.flatMap(([, t]) => Object.values(t.clips).map((c) => c.file)))]
const URLS = [ENEMIES.model, ...CLIP_URLS] // must stay a stable array (useLoader caches on it)

// Start downloading as soon as this module is imported, so the FBX files load in parallel with the map.
if (ENEMIES.enabled) useLoader.preload(FBXLoader, URLS)

const ORIGIN_XZ = { x: 0, z: 0 } // where the clips' hips start horizontally
const warn = (msg) => console.warn(`[enemies] ${msg}`)

export function findBone(root, key) {
  let found = null
  root.traverse((o) => {
    if (!found && o.isBone && boneKey(o.name) === key) found = o
  })
  return found
}

let gradient = null
function toonMaterial(src) {
  gradient ??= makeGradientMap()
  const color = src && src.color ? src.color.clone() : new THREE.Color('#d11a1a')
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient })
}

/**
 * Mixamo exports the character in whatever units the upload was in (this one came out ~100× too big), so size is measured from
 * the skeleton instead of assumed: head-top bone to the lowest toe bone = height, scaled to ENEMIES.height.
 * Only the DIFFERENCE between those two bones is used. The clips themselves are authored with the feet on y = 0 and the hips
 * at x = z = 0, whereas the T-pose file sits at some other offset, so no position from the T-pose is used for placement.
 */
function prepareTemplate(fbx) {
  fbx.updateMatrixWorld(true)
  const head = findBone(fbx, 'HeadTop_End')
  const toes = [findBone(fbx, 'LeftToe_End'), findBone(fbx, 'RightToe_End')].filter(Boolean)
  const v = new THREE.Vector3()

  let scale = 0.01
  if (head && toes.length) {
    const headY = head.getWorldPosition(v).y
    const footY = Math.min(...toes.map((t) => t.getWorldPosition(v).y))
    const height = headY - footY
    if (Number.isFinite(height) && height > 1e-6) scale = ENEMIES.height / height
    else warn('could not measure the model height, assuming 0.01')
  } else {
    warn('HeadTop_End / Toe_End bones not found in the model FBX (are the bones named mixamorig…?). Assuming scale 0.01.')
  }

  tagOutlineLayer(fbx, OUTLINE_LAYER.enemy) // the outline pass gives enemies their own ink (OUTLINE.enemy); clones keep the tag
  fbx.traverse((o) => {
    if (!o.isSkinnedMesh) return
    o.frustumCulled = false // the bounding sphere is the bind pose's; animated limbs would pop out at screen edges
    o.castShadow = o.receiveShadow = true
    o.material = Array.isArray(o.material) ? o.material.map(toonMaterial) : toonMaterial(o.material)
  })

  return { fbx, scale }
}

function buildAssets(loaded) {
  const [modelFbx, ...clipFbx] = loaded
  const template = prepareTemplate(modelFbx)

  const clipByUrl = new Map(CLIP_URLS.map((url, i) => [url, clipFbx[i]?.animations?.[0]]))
  const types = {}
  for (const [kind, def] of TYPES) {
    const clips = {}
    for (const [key, c] of Object.entries(def.clips)) {
      const src = clipByUrl.get(c.file)
      if (!src) {
        warn(`"${kind}" clip "${key}": no animation found in ${c.file}`)
        continue
      }
      const clip = src.clone()
      clip.name = `${kind}.${key}`
      if (!c.rootMotion) stripRootMotion(clip, ORIGIN_XZ)
      clips[key] = { clip, loop: c.loop !== false }
    }
    types[kind] = { clips }
  }
  return { template, types }
}

/** Suspends until every enemy FBX is loaded, then returns { template, types: { [kind]: { clips } } }. */
export function useEnemyAssets() {
  const loaded = useLoader(FBXLoader, URLS)
  return useMemo(() => buildAssets(loaded), [loaded])
}
