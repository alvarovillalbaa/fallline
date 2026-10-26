# Fallline

Find your line. Take one more run. An original downhill snowboard browser game with carving, jumps, flags and device-local best times.

[Product contract and original brief](docs/spec.md) · [Ride module contract](docs/ride-contract.md)

The app uses native JavaScript modules and original Canvas/SVG geometry. No runtime packages, accounts, analytics, external artwork or backend are required. It is an arcade game, not real-world sports instruction.

Run `npm run check` for focused source checks and `npm test` for pure mechanics/records checks. No install is needed. Browser/dev-server checks require the applicable explicit approval; local filesystem URLs are not a reliable native-module host. Vercel validates source and serves `public/`.

Implementation, hosted publication and actual browser play have separate evidence in `docs/results/`. This initial scaffold does not establish deployment or gameplay acceptance. Respect the local Storage Guard before any install or local app build.
