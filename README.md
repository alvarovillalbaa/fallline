# Fallline

Last updated: 2026-11-15

Find your line. Take one more run. An original downhill snowboard browser game with carving, jumps, flags and device-local best times.

[Play Fallline](https://fallline-alvaro.vercel.app) · [Source](https://github.com/alvarovillalbaa/fallline) · [Product contract and original brief](docs/spec.md) · [Ride module contract](docs/ride-contract.md)

The app uses native JavaScript modules and original Canvas/SVG geometry. No runtime packages, accounts, analytics, external artwork or backend are required. It is an arcade game, not real-world sports instruction.

Run `npm run check` for focused source checks and `npm test` for pure mechanics/records checks. No install is needed. Browser/dev-server checks require the applicable explicit approval; local filesystem URLs are not a reliable native-module host. Vercel validates source and serves `public/`.

The current local edition generates terrain, gates, obstacles and ramps from a seed in six map environments. Levels can be saved and replayed exactly. Completing a new course unlocks a harder level, up to 50, with faster starts, narrower gates, more obstacles and stronger crosswinds. Hold X or the touch Spin control in the air; full rotations score on landing. Missing a flag still adds four seconds. Course records belong to the exact seed and level; free rides and crashes do not advance the campaign. Old course records are retained separately from generated-level records.

The game fills the screen, with a map picker and saved-level selector inside the game menu. [V5 native acceptance](docs/results/2026/11-15/generated-v5/result.md) passes six fresh desktop/narrow journeys, including six earned 9/9-gate map finishes, level7/replay/records, keyboard/multitouch spins, pause/crash/free entry and a real storage-denied course. Both browsers close normally. The37 Node cases and48 control-only courses remain separately carried through exact source/runtime identities. Publication and public H01/retirement identities are tracked in that receipt; historical hosted acceptance below describes the earlier edition.

[Six gameplay journeys have accepted evidence](docs/results/2026/11-05/gameplay-checks.md) across their recorded editions: desktop controls, three descents, crash/records, pause/resume, touch emulation and storage recovery/denial. Pausing now immediately paints the already-frozen state; the unchanged pause assertion passed on that repair. Earlier failures and edition boundaries remain explicit, and the [29 earlier mechanics/storage checks](docs/results/2026/10-26/source-checks.md) were not rerun.

[Two additional free-ride journeys passed](docs/results/2026/11-07/free-ride-attempt-1.md) on desktop and narrow touch emulation: beyond the course finish, pause/resume/restart, crash logs and both menu exits, with a genuinely earned course record unchanged after reload. Those two ran separately from the earlier six. Physical-device, audible sound and real-time performance acceptance remain open. Respect Storage Guard before any install or local build.
