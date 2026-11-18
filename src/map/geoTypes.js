// Second name part of Geo_<Type>_<ID>. Add a key here to support a new type —
// loader and renderer need no other change. `userData` is copied onto the object
// and onto the collider's registry entry, where the movement code can read it.
export const GEO_TYPES = {
  Solid: { collider: true },
  NoRun: { collider: true, userData: { noRun: true } },
  Deco: { collider: false },

  // Later:
  // Slick:  { collider: true, userData: { friction: 0.05 } },
  // Bouncy: { collider: true, userData: { bounce: 14 } },
  // Col:    { collider: true, invisible: true }, // pair with a Geo_Deco_ visual
}
