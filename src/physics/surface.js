import { SURFACE } from '../config/gameConfig'

/** Surface type from the contact normal's Y. Thresholds live in config. */
export function classifyNormal(ny) {
  if (ny > SURFACE.FLOOR_MIN_NY) return 'floor'
  if (Math.abs(ny) < SURFACE.WALL_MAX_ABS_NY) return 'wall'
  return 'slope'
}
export const classifySurface = (normal) => classifyNormal(normal.y)
