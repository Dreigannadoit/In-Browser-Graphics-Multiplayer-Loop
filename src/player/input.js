// Input layer: raw events → per-step snapshot. Knows nothing about movement or rendering.
import { CONTROLS } from '../config/gameConfig'
import { setState } from '../game/store'

const keys = new Set()
const edges = { jump: false, grapple: false } // consumed by the sim step
const look = { dx: 0, dy: 0 } // consumed by the render frame
let mouseGrapple = false
let el = null

const has = (action) => CONTROLS[action].some((k) => keys.has(k))
const isGameKey = (code) =>
  ['forward', 'back', 'left', 'right', 'jump', 'slide', 'grapple'].some((a) => CONTROLS[a].includes(code))
const isLocked = () => document.pointerLockElement === el

function onKeyDown(e) {
  if (CONTROLS.debugToggle.includes(e.code)) {
    if (!e.repeat) setState((s) => ({ debug: !s.debug }))
    e.preventDefault()
    return
  }
  if (isLocked() && isGameKey(e.code)) e.preventDefault()
  if (e.repeat) return
  keys.add(e.code)
  if (CONTROLS.jump.includes(e.code)) edges.jump = true
  if (CONTROLS.grapple.includes(e.code)) edges.grapple = true
}
const onKeyUp = (e) => keys.delete(e.code)

function onMouseDown(e) {
  if (!isLocked()) return
  if (e.button === CONTROLS.grappleMouseButton) {
    edges.grapple = true
    mouseGrapple = true
  }
}
function onMouseUp(e) {
  if (e.button === CONTROLS.grappleMouseButton) mouseGrapple = false
}
function onMouseMove(e) {
  if (!isLocked()) return
  look.dx += e.movementX
  look.dy += e.movementY
}
function onLockChange() {
  const locked = isLocked()
  setState({ locked })
  if (!locked) {
    keys.clear()
    mouseGrapple = false
  }
}
function onClick() {
  if (!isLocked()) el.requestPointerLock()
}
const onContextMenu = (e) => e.preventDefault()

export const input = {
  attach(element) {
    el = element
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onLockChange)
    el.addEventListener('click', onClick)
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onLockChange)
      el.removeEventListener('click', onClick)
      el.removeEventListener('contextmenu', onContextMenu)
    }
  },

  /** Called once per fixed sim step. Clears one-shot edges. */
  snapshot() {
    const snap = {
      moveX: (has('right') ? 1 : 0) - (has('left') ? 1 : 0),
      moveZ: (has('forward') ? 1 : 0) - (has('back') ? 1 : 0),
      jumpHeld: has('jump'),
      slideHeld: has('slide'),
      grappleHeld: has('grapple') || mouseGrapple,
      jumpPressed: edges.jump,
      grapplePressed: edges.grapple,
    }
    edges.jump = edges.grapple = false
    return snap
  },

  /** Called once per rendered frame; mouse look is applied immediately for low latency. */
  takeLook() {
    const out = { dx: look.dx, dy: look.dy }
    look.dx = look.dy = 0
    return out
  },
}
