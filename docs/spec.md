# Fallline product contract

Last updated: 2026-11-14

## Current iteration

The [14 November portfolio request](https://app.notion.com/p/418a1ee8bd0680c99343ea23eb42d0dd) supersedes the three-authored-descent choice below. It requires generated maps, saved levels, increasing difficulty, a faster opening, additional obstacles, gusts and trick opportunities, and a game-first entry screen. The earlier brief and release choices remain historical context.

The local implementation uses six biome definitions and a deterministic v2 seed/level generator. No coordinates come from an authored course scene. Course geometry has a navigable corridor between gates; density increases outside it. Level one starts at 19 m/s, rather than the original 10 m/s. Levels increase through 50 after first completion, with bounded speeds, stronger trajectory-changing gusts, tighter gates and more obstacles/ramps. X / touch Spin adds visible airborne rotation; complete rotations earn points on landing. A replay of an already completed level does not repeatedly advance the campaign. Course records are keyed by the full generated identity.

The browser stores up to 80 level identities and completion identities and 100 valid records. Generation IDs encode map, seed and level, allowing exact reconstruction without storing full worlds. Old v1 record entries remain preserved; they are not compared with generated maps. Readback must match a write before the UI reports successful storage. The fullscreen game menu owns map selection, generation and saved-level replay; existing pause, input-reset, sound and failure paths remain.

Source and mechanics verification are in [the current receipt](results/2026/11-14/generated-levels.md). Visual/touch/browser qualification and publication are still pending for this edition.

## Original source and release choices

Source: [Alvaro's personal project queue](https://app.notion.com/p/311a1ee8bd06805caa21c5306dd315ac), freshly fetched on 26 October 2026. The complete New-list entry says exactly **“(game) descenso en snowboard”**. It has no platform qualifier or prerequisite. Adjacent entries explicitly identify macOS/iOS; no such qualifier attaches here. The parent's three omitted embeds belong to unrelated agent projects, so this is a bounded source finding rather than an exhaustive project audit.

The source requirement is a playable downhill snowboard game. The user delegated creating each project in its own personal `alvarovillalbaa` GitHub repository and publishing to Vercel and/or Supabase as needed. Current owner repository names/descriptions and bounded non-vendor SIDE searches found no corresponding snowboard implementation.

Implementation choices:

- Name: Fallline. An original browser arcade game with a projected 3D alpine world, original geometry and no external art or account requirement.
- Carve left/right, brake, tuck and jump. Slope, drag, turning, airtime and obstacle clearance change the actual ride, not only the animation. This is a game, not snowboarding instruction or a scientific sports simulation.
- Three authored descents with flags, rocks, trees and optional ramps; a free-ride mode without a course finish. Display live speed, elapsed time, progress and flag results.
- A missed flag adds four seconds to the course time. Keep the best completed adjusted time per run on the current device. Jumps/airtime are ride statistics rather than a farmable points counter.
- Support keyboard and narrow-screen touch controls, visible pause/resume/restart, interruption handling and a stable-camera option. Sound is optional and starts only after user action.
- Handle corrupt/unavailable local storage, maintain truthful record messages and keep scores local. No database, credentials or backend provisioning is necessary.

Acceptance must separately establish deterministic mechanics, reachable runs, truthful records, hosted publication and actual desktop/mobile play. Browser approval is still required; the older Driftwing/Dearweek approvals do not automatically cover this new game.
