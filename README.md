# Fallline

Find your line. Take one more run. An original downhill snowboard browser game with carving, jumps, flags and device-local best times.

[Play Fallline](https://fallline-alvaro.vercel.app) · [Source](https://github.com/alvarovillalbaa/fallline) · [Product contract and original brief](docs/spec.md) · [Ride module contract](docs/ride-contract.md)

The app uses native JavaScript modules and original Canvas/SVG geometry. No runtime packages, accounts, analytics, external artwork or backend are required. It is an arcade game, not real-world sports instruction.

Run `npm run check` for focused source checks and `npm test` for pure mechanics/records checks. No install is needed. Browser/dev-server checks require the applicable explicit approval; local filesystem URLs are not a reliable native-module host. Vercel validates source and serves `public/`.

Three descents offer carving, braking, tuck, jumps, ramps, trees and flags. Missing a flag adds four seconds. Only completed course runs can improve a device-local best adjusted time; free rides and crashes do not. Keyboard and touch controls, interruption-aware pause/resume, optional sound and a stable camera are included.

[29 focused checks passed](docs/results/2026/10-26/source-checks.md), and [the production release is published](docs/results/2026/10-26/publication.md). Actual desktop/mobile browser play remains pending explicit approval. These are separate proof boundaries. Respect the local Storage Guard before any install or local app build.
