// Tiny external store (no dependency). HUD/pickups subscribe; the sim writes.
import { useSyncExternalStore } from 'react'
import { GAMEPLAY } from '../config/gameConfig'

let state = {
  debug: true,
  locked: false,
  health: GAMEPLAY.maxHealth,
  coins: 0,
  collected: new Set(), // pickup names
  respawnPoint: null, // { position: Vector3, yaw } — set by checkpoints
  checkpoint: null, // name of active checkpoint trigger
}
const listeners = new Set()

export const getState = () => state
export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
  listeners.forEach((l) => l())
}
export const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))
/** selector must return a primitive (or a stable reference) */
export const useGame = (selector) => useSyncExternalStore(subscribe, () => selector(state))
