// In-canvas helper for the dev tools: render stats (fps, draw calls...) and the optional velocity arrow.
// Renders nothing until dev mode is unlocked.
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { player as ps } from '../player/state'
import { dev } from './devState'

export function DevProbe() {
  const on = useGame((s) => s.devUnlocked)
  return on ? <Probe /> : null
}

function Probe() {
  const { gl } = useThree()
  const acc = useRef({ t: 0, frames: 0 })
  const dir = useMemo(() => new THREE.Vector3(), [])
  const arrow = useMemo(() => {
    const a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, 0xffd23f, 0.4, 0.25)
    a.visible = false
    a.renderOrder = 999
    for (const part of [a.line, a.cone]) {
      part.material.depthTest = false
      part.frustumCulled = false
    }
    return a
  }, [])

  useFrame((_, delta) => {
    const a = acc.current
    a.t += delta
    a.frames++
    if (a.t >= 0.5) {
      dev.stats = {
        fps: Math.round(a.frames / a.t),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
      }
      a.t = 0
      a.frames = 0
    }

    const speed = ps.vel.length()
    arrow.visible = dev.flags.velocityArrow && speed > 0.1
    if (arrow.visible) {
      arrow.position.copy(ps.pos)
      arrow.setDirection(dir.copy(ps.vel).divideScalar(speed))
      arrow.setLength(Math.max(0.6, speed * 0.15), 0.4, 0.25)
    }
  })

  return <primitive object={arrow} />
}
