// Three.js layers used by the outline pass to tell surface types apart. Layer 0 (everything) is what the camera normally draws;
// objects ALSO enable one of these, so they still render normally and the outline effect can render just them to an ID buffer.
export const OUTLINE_LAYER = { enemy: 2, point: 3 }

/** Mark `root` and everything under it as belonging to an outline layer (layers are per object, not inherited by children). */
export function tagOutlineLayer(root, layer) {
  root.traverse((o) => o.layers.enable(layer))
}
