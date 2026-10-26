# Ride module contract

Native ESM throughout. Coordinates: x is right, z is horizontal distance downhill, y is world height. Terrain descends as z increases; y can be negative. Time is seconds, speed is metres/second, heading/lean are radians. The board follows shared terrain while grounded.

`public/src/ride.js` exports:

```js
RUNS
getRun(id) // safe fallback to first run
createRide(runId, mode = 'course') // status 'riding'
stepRide(state, { turn, brake, tuck, jump }, dt) // immutable next state
terrainHeight(run, x, z, mode = 'course')
getWorld(run, zMin, zMax, mode = 'course') // { flags, obstacles, ramps }
rampHeight(ramp, x, z) // authoritative height above base snow; zero outside
```

Run shape:

```js
{
 id, name, subtitle, difficulty, description,
 length, halfWidth, slope, startSpeed,
 colors: { sky, horizon, snow, shadow, pine, accent },
 flags: [{ id, x, z, width }], // width is the complete opening between poles
 obstacles: [{ id, type: 'tree' | 'rock', x, z, radius, height }],
 ramps: [{ id, x, z, width, length, height }]
}
```

State shape:

```js
{
 runId, mode, status, // 'riding' | 'finished' | 'crashed'
 x, y, z, vx, vy, vz, speed, heading, lean, onGround,
 time, flagIndex, passed, missed, airTime, jumps, adjustedTime,
 lastEvent: null // or { id, type, text }, monotonically increasing per ride
}
```

Controls: `turn` -1 left/+1 right; `brake`, `tuck`, `jump` booleans. Jump is held input: the model must latch it so holding it does not auto-jump on each landing. Tuck reduces drag, braking slows the board, turning carves across the slope with a speed trade-off. Grounded and airborne movement must remain finite and frame-partition stable with bounded fixed substeps. A giant/invalid frame delay must not fast-forward a whole run.

`terrainHeight` is the base snow surface and excludes ramps. The board surface adds the maximum applicable `rampHeight` from `getWorld`; this shared helper defines the ramp's linear rise from z to z+length and its lateral opening. Rendering uses that same helper for ramp geometry. The board's y is its base/sole height, not the rider's head. Leaving a ramp tip can launch the board; do not duplicate its surface formula in the renderer.

Flags are scored once at an interpolated z crossing; misses add exactly four seconds. `adjustedTime = time + missed * 4` and final times freeze on a terminal state. Obstacles use continuous movement/clearance checks so a fast frame cannot tunnel through a tree and a high-enough jump can clear a low rock. Shared terrain and objects must agree with rendering. Free ride skips authored flags/finish and uses deterministic bounded-range world generation, not an ever-growing object array.

Events are `flag`, `miss`, `jump`, `land`, `finish`, `crash`; readable text accompanies a new numeric id. Extra internal remainder/latch fields are allowed. Terrain edges must be shown and warned about; do not silently teleport the rider back into bounds.

`public/src/renderer.js` exports `createRenderer(canvas)` returning `resize(width,height,pixelRatio)`, `render(state,run,{steadyCamera,preview=false})` and `destroy()`. Import `terrainHeight` and `getWorld`; project original snow/trees/rocks/flags/rider geometry through Canvas 2D. No state mutation, physics or independent collision objects belong in the renderer. Free ride must not show unscored course flags. Show the next flag distinctly and keep the rider visible in portrait.

Root owns HTML/CSS, `game.js`, records and optional audio. Message root before changing this interface. Source/mechanics checks do not establish browser appearance, controls or performance.
