# Fallline

Find your line. Take one more run. An original downhill snowboard browser game with carving, jumps, flags and device-local best times.

[Play Fallline](https://fallline-alvaro.vercel.app) · [Source](https://github.com/alvarovillalbaa/fallline) · [Product contract and original brief](docs/spec.md) · [Ride module contract](docs/ride-contract.md)

The app uses native JavaScript modules and original Canvas/SVG geometry. No runtime packages, accounts, analytics, external artwork or backend are required. It is an arcade game, not real-world sports instruction.

Run `npm run check` for focused source checks and `npm test` for pure mechanics/records checks. No install is needed. Browser/dev-server checks require the applicable explicit approval; local filesystem URLs are not a reliable native-module host. Vercel validates source and serves `public/`.

Three descents offer carving, braking, tuck, jumps, ramps, trees and flags. Missing a flag adds four seconds. Only completed course runs can improve a device-local best adjusted time; free rides and crashes do not. Keyboard and touch controls, interruption-aware pause/resume, optional sound and a stable camera are included.

[Six gameplay journeys have accepted evidence](docs/results/2026/11-05/gameplay-checks.md) across their recorded editions: desktop controls, three descents, crash/records, pause/resume, touch emulation and storage recovery/denial. Pausing now immediately paints the already-frozen state; the unchanged pause assertion passed on that repair. Earlier failures and edition boundaries remain explicit, and the [29 earlier mechanics/storage checks](docs/results/2026/10-26/source-checks.md) were not rerun.

[Two additional free-ride journeys passed](docs/results/2026/11-07/free-ride-attempt-1.md) on desktop and narrow touch emulation: beyond the course finish, pause/resume/restart, crash logs and both menu exits, with a genuinely earned course record unchanged after reload. Those two ran separately from the earlier six. Physical-device, audible sound and real-time performance acceptance remain open. Respect Storage Guard before any install or local build.
