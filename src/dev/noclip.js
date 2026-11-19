// Free-fly movement for dev mode: look direction + WASD, Space = up, slide key = down, sprint = faster.
import * as THREE from 'three'
import { lookDirection } from '../player/state'
import { dev } from './devState'

const _f = new THREE.Vector3()
const _r = new THREE.Vector3()
const _v = new THREE.Vector3()

export function noclipStep(ps, inp, dt) {
  ps.prevPos.copy(ps.pos)
  lookDirection(ps, _f)
  _r.set(Math.cos(ps.yaw), 0, -Math.sin(ps.yaw))
  _v.set(0, 0, 0).addScaledVector(_f, inp.moveZ).addScaledVector(_r, inp.moveX)
  if (inp.jumpHeld) _v.y += 1
  if (inp.slideHeld) _v.y -= 1
  if (_v.lengthSq() > 0) _v.normalize()
  ps.pos.addScaledVector(_v, dev.noclipSpeed * (inp.sprintHeld ? 2.5 : 1) * dt)
  ps.vel.set(0, 0, 0)
  ps.speed = 0
  ps.state = 'airborne'
  ps.grounded = false
  ps.grapple = null
  ps.mantle = null
  ps.time += dt
}
