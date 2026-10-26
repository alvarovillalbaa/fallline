# Fallline product contract

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
