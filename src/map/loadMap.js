import * as THREE from 'three'
import { GEO_TYPES } from './geoTypes'
import { PLAYER, SPAWN_FORWARD } from '../config/gameConfig'
import grappleConfig from '../config/grapple.json'

const CONTAINERS = new Set(['Map', 'Geo', 'Points', 'Triggers'])
const PICKUP_KINDS = new Set(['Health', 'Coin'])
const TRIGGER_KINDS = new Set(['KillZone', 'Checkpoint'])
const CENTER_TO_FEET = PLAYER.halfHeight + PLAYER.radius
const cache = new WeakMap() // StrictMode-safe: the scene is mutated (markers removed) exactly once

/** "Category_Type_ID" → parts. Two-part names ("Grapple_01") have no type. */
export function parseName(name) {
  const parts = name.split('_')
  return { category: parts[0], type: parts.length > 2 ? parts[1] : null, id: parts[parts.length - 1] }
}

const worldPos = (o) => o.getWorldPosition(new THREE.Vector3())
const worldQuat = (o) => o.getWorldQuaternion(new THREE.Quaternion())
const yawFromQuat = (q) => {
  const f = new THREE.Vector3(...SPAWN_FORWARD).applyQuaternion(q)
  return Math.atan2(-f.x, -f.z) // camera convention: forward = (-sin yaw, 0, -cos yaw)
}

function collectMeshes(obj) {
  const out = []
  obj.traverse((o) => o.isMesh && out.push(o))
  return out
}

/** Merge meshes into one world-space triangle soup (handles node scale/rotation/parents). */
function bakeTrimesh(meshes) {
  let vCount = 0
  let iCount = 0
  for (const m of meshes) {
    const n = m.geometry.attributes.position.count
    vCount += n
    iCount += m.geometry.index ? m.geometry.index.count : n
  }
  const vertices = new Float32Array(vCount * 3)
  const indices = new Uint32Array(iCount)
  const v = new THREE.Vector3()
  let vo = 0
  let io = 0
  for (const m of meshes) {
    const pos = m.geometry.attributes.position
    const idx = m.geometry.index
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
      vertices.set([v.x, v.y, v.z], (vo + i) * 3)
    }
    const n = idx ? idx.count : pos.count
    for (let k = 0; k < n; k++) indices[io + k] = vo + (idx ? idx.getX(k) : k)
    vo += pos.count
    io += n
  }
  return { vertices, indices }
}

/**
 * Walk the scene graph once and return structured map data.
 * Marker objects are removed from the scene after their data is extracted.
 */
export function loadMap(gltf, config = grappleConfig) {
  if (cache.has(gltf)) return cache.get(gltf)

  const scene = gltf.scene
  scene.updateMatrixWorld(true)

  const data = {
    spawns: { player: [], target: [] },
    pickups: [],
    grapplePoints: [],
    triggers: [],
    geo: [],
    scene,
  }
  const seen = new Set()
  const markers = []
  const warn = (msg) => console.warn(`[loadMap] ${msg}`)

  const handlers = {
    Geo(obj, { name, type, id }) {
      const def = GEO_TYPES[type]
      if (!def) return warn(`unknown Geo type "${type}" on "${name}" — ignored`)
      const userData = { ...(def.userData ?? {}) }
      Object.assign(obj.userData, userData) // e.g. obj.userData.noRun = true
      const meshes = collectMeshes(obj)
      meshes.forEach((m) => Object.assign(m.userData, userData))
      if (def.invisible) obj.visible = false
      data.geo.push({ name, id, type, object: obj, userData, trimesh: def.collider ? bakeTrimesh(meshes) : null })
    },

    Spawn(obj, { name, type, id }) {
      const entry = { name, id, position: worldPos(obj), quaternion: worldQuat(obj) }
      if (type === 'Player') data.spawns.player.push({ ...entry, yaw: yawFromQuat(entry.quaternion) })
      else if (type === 'Target') data.spawns.target.push(entry)
      else return warn(`unknown Spawn type "${type}" on "${name}"`)
      markers.push(obj)
    },

    Pickup(obj, { name, type, id }) {
      if (!PICKUP_KINDS.has(type)) return warn(`unknown Pickup kind "${type}" on "${name}"`)
      data.pickups.push({ name, id, kind: type, position: worldPos(obj) })
      markers.push(obj)
    },

    Grapple(obj, { name, id }) {
      const settings = { ...config.defaults, ...(config.points?.[name] ?? {}) }
      data.grapplePoints.push({ name, id, position: worldPos(obj), settings })
      markers.push(obj)
    },

    Trigger(obj, { name, type, id }) {
      if (!TRIGGER_KINDS.has(type)) return warn(`unknown Trigger kind "${type}" on "${name}"`)
      const box = new THREE.Box3().setFromObject(obj) // world AABB of the marker's own/child mesh
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      data.triggers.push({
        name,
        id,
        kind: type,
        center,
        halfExtents: size.clone().multiplyScalar(0.5),
        // where a Checkpoint respawns the player (capsule center, standing on the box floor)
        respawnPosition: new THREE.Vector3(center.x, box.min.y + CENTER_TO_FEET + 0.05, center.z),
      })
      markers.push(obj)
    },
  }

  const visit = (obj) => {
    if (obj === scene || !obj.name || CONTAINERS.has(obj.name)) {
      obj.children.slice().forEach(visit)
      return
    }
    const info = parseName(obj.name)
    const handler = handlers[info.category]
    if (!handler) {
      warn(`unknown prefix "${info.category}" on "${obj.name}"`)
      obj.children.slice().forEach(visit)
      return
    }
    if (seen.has(obj.name)) warn(`duplicate name "${obj.name}"`)
    seen.add(obj.name)
    handler(obj, { name: obj.name, ...info }) // handlers do not descend: marker children (Sphere, Cube…) are preview meshes
  }
  visit(scene)

  for (const key of Object.keys(config.points ?? {})) {
    if (!data.grapplePoints.some((g) => g.name === key)) warn(`grapple.json has "${key}" but the map has no such point`)
  }

  markers.forEach((m) => m.removeFromParent())
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = o.receiveShadow = true
    }
  })

  cache.set(gltf, data)
  return data
}
