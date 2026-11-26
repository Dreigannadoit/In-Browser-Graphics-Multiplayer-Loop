# Parkour FPS – map loader + test character

## Install / run
```bash
npm i three @react-three/fiber @react-three/rapier @react-three/postprocessing postprocessing   # rapier >= 1.3 (needs useBeforePhysicsStep)
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

## Enemies (src/enemies)
```
config/gameConfig.js   ENEMIES: global settings + one entry per enemy kind (stats, clips, attack moves, weapon slot)
enemies/Enemies.jsx    manager: spawns from map markers, fixed-step sim before each Rapier step, renders every enemy
enemies/brain.js       pure AI behaviours (BEHAVIORS.melee now; add 'ranged' later). Sets intent only, never touches Rapier
enemies/sim.js         enemy state + kinematics (accel, gravity, separation). Pure JS
enemies/physics.js     the only enemy file that talks to Rapier (character controller, ground ray)
enemies/assets.js      loads the FBX files, measures + rescales the model, strips root motion from the clips
enemies/EnemyVisual.jsx  skinned clone + AnimationMixer, interpolated between fixed steps
enemies/registry.js    live list, damageEnemy(), raycastEnemies() for future weapons
game/clock.js          world dt / scale (pause + slow-motion); Player writes it, enemies read it
game/combat.js         damagePlayer() (health, knockback, camera jolt)
game/events.js         tiny pub/sub ('playerDied' resets the arena)
```
* Map markers: `Spawn_Enemy_<Kind>_<ID>` (e.g. `Spawn_Enemy_Unarmed_01`). With none in the map, the `Spawn_Target_*` markers are used as stand-ins.
* Assets live in `public/enemies/` (`superhot_enemy_t_pose.fbx` + one folder per kind).
* Dev console (dev builds): `__enemies.spawn('unarmed')` spawns one 8 m ahead, `__enemies.killAll()`, `__enemies.list()`.
* Adding a kind: new entry in `ENEMIES.types` (copy `unarmed`), copy its FBX files into `public/enemies/<kind>/`, and if it fights differently add a behaviour to `BEHAVIORS` in brain.js and set `ai`.
* Everything simulated reads `clock.dt`, so the dev tools' pause / time-scale slow enemies too; a Superhot time scale only needs to set `clock.dt` / `clock.scale` in Player.jsx.
