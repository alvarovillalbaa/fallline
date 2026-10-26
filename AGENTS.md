# Fallline

An original downhill snowboard browser game. `docs/spec.md` owns source scope and choices; `docs/ride-contract.md` owns module boundaries.

- `public/src/ride.js` owns terrain, runs, world objects, physics, collisions and timing. Rendering reads that model; it never awards flags or moves the rider.
- Use native JavaScript modules and original procedural Canvas/SVG geometry. No runtime dependencies, external art, tracking, backend, accounts, paid resources or CI workflow is needed.
- Preserve keyboard and touch input, pause/resume/restart, focus states, instructions, optional user-enabled sound, stable camera and interruption handling. Clear held input on pause/blur/hide and avoid simulation catch-up after a hidden tab.
- Jumps must affect collision clearance; brake, tuck and steering must affect motion. Flags are processed once at their crossing plane. Device-local best times accept only completed course runs and must not promise persistence if storage fails.
- Use `apply_patch` and preserve unrelated work. The active user goal authorizes a separate personal GitHub repo and Vercel publication. Browser checks need explicit owner approval under the supplied AGENTS.md section 7.
- Run targeted source/mechanics checks and `git diff --check`. Respect Storage Guard: no local install, environment or app build after its failed preflight. Small source/check work and hosted static validation remain separate.
- Persist bounded evidence in `docs/results/`. A pure mechanics test, a hosted build and actual browser play prove different things. Do not claim native/store release, real-world sports instruction or completed browser acceptance from source checks.
