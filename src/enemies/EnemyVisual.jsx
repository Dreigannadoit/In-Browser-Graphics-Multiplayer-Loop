import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js'
import { ENEMIES, PHYSICS } from '../config/gameConfig'
import { clock } from '../game/clock'
import { findBone } from './assets'
import { OUTLINE_LAYER, tagOutlineLayer } from '../render/layers'

const wrap = (a) => ((((a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI
const clamp01 = (x) => Math.min(1, Math.max(0, x))

/** Hold-in-hand item from def.weapon (see ENEMIES.types.unarmed.weapon). Units are metres; the bone chain is scaled, so undo that. */
function attachWeapon(root, weapon, scale) {
  const bone = findBone(root, weapon.bone)
  if (!bone) return console.warn(`[enemies] weapon bone "${weapon.bone}" not found`)
  const obj = weapon.create()
  tagOutlineLayer(obj, OUTLINE_LAYER.enemy)
  obj.scale.multiplyScalar(1 / scale)
  if (weapon.position) obj.position.set(...weapon.position).multiplyScalar(1 / scale)
  if (weapon.rotation) obj.rotation.set(...weapon.rotation)
  bone.add(obj)
}

/** Clone of the template + a mixer with one action per clip. Everything geometry/material is shared between enemies. */
function createRig(assets, sim) {
  const { template } = assets
  const clips = assets.types[sim.kind].clips
  const s = template.scale

  const root = SkeletonUtils.clone(template.fbx)
  const holder = new THREE.Group() // scales the FBX's units down to metres (the clips already stand on y = 0, centred on x = z = 0)
  holder.scale.setScalar(s)
  holder.add(root)
  if (sim.def.weapon) attachWeapon(root, sim.def.weapon, s)

  const mixer = new THREE.AnimationMixer(root)
  const actions = {}
  for (const [key, { clip, loop }] of Object.entries(clips)) {
    const a = mixer.clipAction(clip)
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    a.clampWhenFinished = true
    actions[key] = a
  }

  let current = null // key of the action that is fading in / playing
  return {
    holder,
    hasClip: (key) => !!actions[key],
    /** dt = world seconds for the animation (frame delta × clock.scale). */
    update(anim, dt) {
      if (anim.key && actions[anim.key] && anim.key !== current) {
        const next = actions[anim.key]
        next.reset().setEffectiveWeight(1).play()
        if (current) actions[current].crossFadeTo(next, ENEMIES.crossfade, false)
        current = anim.key
      }
      const act = current && actions[current]
      if (act) {
        if (anim.time != null) {
          act.setEffectiveTimeScale(0) // the brain owns the playhead (attacks): the fist lands exactly on its hitTime
          act.time = Math.min(anim.time, act.getClip().duration)
        } else {
          act.setEffectiveTimeScale(anim.timeScale)
        }
      }
      mixer.update(anim.key === null ? 0 : dt) // key === null: dead without a death clip, freeze the pose
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
    },
  }
}

/** Renders one enemy: interpolated between fixed steps, animated from sim.anim. Owns no gameplay state. */
export function EnemyVisual({ sim, assets, lastStep }) {
  const group = useRef(null)
  const fall = useRef(null)
  const rig = useMemo(() => createRig(assets, sim), [assets, sim])
  useEffect(() => () => rig.dispose(), [rig])
  const { halfHeight, radius } = sim.def.capsule
  const centerToFeet = halfHeight + radius

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const alpha = clamp01((performance.now() - lastStep.current) / (PHYSICS.timeStep * 1000))
    const { prev, pos } = sim
    g.position.set(
      prev.x + (pos.x - prev.x) * alpha,
      prev.y + (pos.y - prev.y) * alpha - centerToFeet,
      prev.z + (pos.z - prev.z) * alpha,
    )
    g.rotation.y = prev.yaw + wrap(sim.yaw - prev.yaw) * alpha + ENEMIES.modelYawOffset

    rig.update(sim.anim, Math.min(delta, 0.05) * clock.scale)

    // dead and no death clip: topple backwards over half a second (world time), then lie there
    if (fall.current) {
      const dead = sim.state === 'dead' && !rig.hasClip('die')
      const t = dead ? clamp01(sim.stateTime / 0.5) : 0
      fall.current.rotation.x = -(t * t) * (Math.PI / 2)
    }
  })

  return (
    <group ref={group}>
      <group ref={fall}>
        <primitive object={rig.holder} />
      </group>
    </group>
  )
}
