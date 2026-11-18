# Parkour FPS – map loader + test character

## Install / run
```bash
npm i three @react-three/fiber @react-three/rapier   # rapier >= 1.3 (needs useBeforePhysicsStep)
mkdir -p public/maps && cp Demo.glb public/maps/
# copy ./src over your project's src/ (or merge), keep main.jsx → <App/>
npm run dev
```
Click the canvas to lock the pointer. WASD, Space (double jump in air), Ctrl/C slide, E or RMB grapple, F3 debug HUD.

## Layout
```
src/
  config/gameConfig.js   all tuning: controls, surface thresholds, movement, camera, double-jump mode
  config/grapple.json    per-point grapple settings keyed by object name (e.g. "Grapple_05")
  map/loadMap.js         loadMap(gltf) → { spawns, pickups, grapplePoints, triggers, geo, scene }
  map/geoTypes.js        Geo_<Type> table (add Slick / Bouncy / Col here)
  map/GameMap.jsx        renders scene + builds trimesh / sensor colliders
  map/registry.js        collider handle → { name, userData } lookup
  physics/surface.js     classifyNormal(): floor / wall / slope
  physics/adapter.js     only file touching Rapier queries (rays, character controller, sensors)
  player/state.js        player state + double-jump rules (reset / consume / landing check)
  player/input.js        raw events → per-step snapshot
  player/movement.js     state machine + per-state velocity (pure JS, no React/Rapier)
  player/Player.jsx      fixed-step sim hook, camera, rope, sensor handling
  player/cameraEffects.js FOV, wall-run tilt, landing dip, slide eye drop
  ui/Hud.jsx             crosshair, health/coins, debug overlay, click-to-play
```

## Notes
* Kinematic capsule + Rapier KCC, own velocity integration (deterministic, easy to sync later).
* Simulation runs in `useBeforePhysicsStep` at a fixed 60 Hz; the camera interpolates between steps.
* Double jump: `DOUBLE_JUMP.resetMode` = `'anyFloor'` | `'differentObject'`. Reset hooks: `resetDoubleJump(ps, reason)`.
* If spawn facing is mirrored, set `SPAWN_FORWARD` to `[0, 0, 1]` in the config.
* Triggers use the marker's world AABB (rotated triggers become their bounding box).
