# Generated levels: local implementation

Source request: [GEN-3659](https://app.notion.com/p/418a1ee8bd0680c99343ea23eb42d0dd), read in full on 14 November 2026. Local base: `90a7233c528f4b0bf08e1f8c2bcf9ff21cb62599`. These changes are uncommitted and unpublished.

## Implemented behavior

- Six biome environments generate their terrain phase, gates, obstacles and ramps from versioned seed/level identities. There are no authored scene-coordinate arrays. A new seed changes the course; replay reconstructs the same world even after cache eviction.
- Course levels progress from 1 through 50 after first completion, increasing starting speed from 19 to 28 m/s, slope, gust strength, precision and obstacle density. A navigable corridor follows the gate-to-gate racing line. Free riding retains bounded range-based generation with more obstacles and ramps.
- Gusts change lateral velocity, including stronger airborne drift, and appear in the HUD. Hold X / touch Spin while airborne to rotate the rider. Full rotations score only on a collision-free landing. Earlier landed points remain after a later crash.
- The browser retains up to 80 selected levels, 80 completion identities and 100 valid records. New runs and saved-level replay are reachable in the fullscreen game menu. Completed levels reveal a next-challenge action; replay cannot farm progression. Existing v1 settings/records remain in the same storage key and are not compared with generated-level times. Writes require an exact readback.
- Fullscreen mountain, compact in-game map picker, saved-level selection and touch Spin replace the website-style entry. Pause, restart, input clearing, sound intent and storage-failure paths remain.

## Verification actually run

Runtime: Node `v26.8.2`. The package still declares Node 24; no Node 24 or hosted-runtime result is claimed.

- `npm test`: **37 passed, zero failed/skipped/cancelled** in the final run. The eight new T2 checks use authored seeds/controls and in-memory storage, with no browser, database, network or service call. Existing relevant ride and record checks were also run because their inputs/behavior changed.
- The generated-course check completed **48 control-only journeys**: six maps × two seeds × levels 1, 12, 25 and 50. Every course finished through all its flags without modifying simulation state to bypass obstacles. This is finite sample evidence, not a proof for every seed or human playability.
- Additional checks cover deterministic reconstruction after cache eviction, map/seed variation, malformed IDs and save bounds, difficulty changes, physical wind drift, no grounded trick farming, landing-only scoring, collision-before-landing, serialized save/reload, replay idempotence, free/crashed/partial-run rejection, and silent write failure.
- `npm run check`: passed syntax/import checks for all five native modules, 60 unique HTML IDs and referenced public assets.
- `git diff --check`: passed after the final source edits.

## Failures and corrections retained

The first local run passed 25/29. Two expectations described the removed three-scene/save shape; the free-world bound reflected the old lower object density; the twelve-second tuck comparison reached the same newly generated collision rather than measuring unobstructed motion. Expectations were updated to the requested six-map/progression schema and the new explicit bounded density; acceleration now compares the unobstructed six-second opening and still requires tuck/brake travel differences.

The next run passed 34/36. It exposed a generated tree intruding on the gate-to-gate route for `v2-glacier-42-25`: obstacle clearance followed a curved source line while pilots followed chords between gates. The generator now reserves the actual gate-to-gate corridor. High Ridge also has a materially steeper slope than Alpine. The unchanged control-only completion assertions then passed. A later review added the collision-before-projected-landing regression and prevented incomplete generated finishes from producing a record. Final progression spans all 50 levels; the expanded journey check includes level 50.

## Remaining proof and constraints

No browser/dev server, build, dependency installation, commit, push, deployment or CI change was performed. Storage Guard returned **2.4 GiB free / 34.0 GiB required**, exit 2. The workspace instructions also exclude unsolicited broad frontend/browser checks. Current CSS, map selection, touch input, responsive layout and end-to-end persistence still need actual browser qualification. Historical hosted gameplay receipts cover their original edition only. The public deployment remains unchanged; the entire portfolio goal remains open.
