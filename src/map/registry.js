// Collider handle → gameplay data. Filled by <GameMap/>, read by the physics adapter.
export const registry = {
  surfaces: new Map(), // handle → { name, type, userData }   (solid Geo colliders)
  sensors: new Map(), // handle → { type:'pickup'|'trigger', ... }
}

/** Returns a ref callback that registers/unregisters a Rapier collider. Memoize it. */
export function registerCollider(table, data) {
  let handle = null
  return (collider) => {
    if (collider) {
      handle = collider.handle
      table.set(handle, data)
    } else if (handle !== null) {
      table.delete(handle)
      handle = null
    }
  }
}
