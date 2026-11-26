// Tiny pub/sub for game-level events (no dependency). Used so systems don't have to import each other:
//   playerDied → <Player/> emits it after respawning; <Enemies/> listens and resets the arena.
const handlers = new Map() // type → Set<fn>

/** Subscribe. Returns an unsubscribe function (handy as a useEffect cleanup). */
export function on(type, fn) {
  if (!handlers.has(type)) handlers.set(type, new Set())
  handlers.get(type).add(fn)
  return () => handlers.get(type)?.delete(fn)
}

export function emit(type, payload) {
  handlers.get(type)?.forEach((fn) => fn(payload))
}
