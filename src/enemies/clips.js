// Animation-clip helpers that need no THREE import (so they are unit-testable).

/**
 * Mixamo clips that aren't "In Place" move the hips forward, which would drag the model away from its physics capsule and snap it
 * back every loop. This pins the hips' X/Z to the rest pose and keeps the Y (the up/down bob), so all movement comes from the
 * game's own velocity. `restXZ` = { x, z } is where the hips are pinned horizontally (the clips start centred on 0, 0).
 * Works on anything shaped like a THREE.AnimationClip (tracks with .name and a mutable .values array).
 */
export function stripRootMotion(clip, restXZ) {
  for (const track of clip.tracks) {
    const m = /^(.+)\.position$/.exec(track.name)
    if (!m || !/Hips$/.test(m[1])) continue
    const v = track.values
    for (let i = 0; i < v.length; i += 3) {
      v[i] = restXZ.x
      v[i + 2] = restXZ.z
    }
  }
  return clip
}

/** Bone lookup that doesn't care how the loader spelled the name: "mixamorig:Hips" and "mixamorigHips" both match 'Hips'. */
export function boneKey(name) {
  return name.replace(/^mixamorig:?/, '')
}
