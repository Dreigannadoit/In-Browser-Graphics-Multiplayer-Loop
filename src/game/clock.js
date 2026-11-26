// World clock: everything that should obey pause / slow-motion (enemies now; bullets, pickups… later) reads this instead of
// raw frame time. <Player/> writes it once per fixed step, right after it asks the dev tools how much time to simulate.
// A Superhot-style "time moves when you move" scale would be computed in that one place and the rest follows.
import { PHYSICS } from '../config/gameConfig'

export const clock = {
  dt: PHYSICS.timeStep, // seconds the world advances this fixed step (0 = paused)
  scale: 1, // dt / PHYSICS.timeStep: 1 normal, 0.2 slow-mo, 0 paused. Render-side animation multiplies its frame delta by this.
}
