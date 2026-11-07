# Free-ride browser checks — prepared, not executed

7 November 2026. The [brief](../spec.md) requires free riding without a course
finish. The existing [UI](../../public/src/game.js) already provides free start,
pause/resume, free restart, distance HUD and crash log. This packet adds evidence
for that behavior; it changes no product module or mechanic. Parent authorization
covers these two new authored public browser journeys. Activation remains held
for root review and immutable source/deployment pins.

The [six accepted journeys](../results/2026/11-05/gameplay-checks.md) remain at
their original editions. Their final JSON is pinned at SHA256
`19a558eb4f0713da98a9f6924f631d2dcee90c1b6d30fdf8fe6db401e4c2729f`,
source `2dbe02f2be9e3a8cb4675d4639171d81bcda9a2d`. The new runner references that
ledger and checks all eight product resources, package/deployment configuration
and both original pure-test files against its native vectors. It does not rerun
F01–F06 or the 29 pure cases, carry them as current results, or claim one eight-case
invocation. The six original browser callback bodies remain byte-exact.

| ID | Literal identity |
| --- | --- |
| F07 | desktop free ride passes the course end and preserves earned records across its lifecycle |
| F08 | narrow touch free ride passes the course end and preserves earned records across its lifecycle |

Each identity owns a fresh Chromium context: 1440×1000 desktop keyboard/buttons
or 390×844 touch-emulated buttons/actual CDP touch contacts. Each first completes
Meadow through ordinary UI/neutral input and earns its own real 6/8 course record.
This necessary precondition belongs to the new journey, not a repetition of the
old three-course F02 case. No valid score is seeded. The full app save is captured
as UTF8 bytes and compared unchanged after each free lifecycle phase and reload.

The free button must show the free tag, distance, free flags/penalty and hidden
course progress rail. A bounded authored line uses ordinary jump inputs at
visible HUD checkpoints 0.26/0.44/0.62/0.80/0.98 km, with 200ms progression and a
200ms approach before each 100ms jump press. Those inputs are authored from the
source world layout; the browser never imports physics, reads private ride state,
injects scores, changes objects or retries a failed line. A real crash before the
distance proof fails the case. The display must pass 1.12km while still riding,
beyond Meadow’s displayed 1.1km course finish. Canvas pixels must remain varied.
HUD/rail assertions do not independently prove absence of every rendered flag.

Both profiles then freeze HUD on pause, explicitly resume, restart at zero while
retaining free mode, and leave through the pause menu. New free rides deliberately
carve into a real crash; the result must be the frozen FREE-RIDE LOG with distance,
unadjusted time, free flags and truthful course-record exclusion. Ride again must
remain free; a further real crash exercises the result-menu exit. Reload must
restore the exact earned-save bytes and visible personal best. These are fixed
steps, not retries for acceptance.

The [existing driver](../../tests/browser/gameplay.mjs) adds only F07/F08 and a
shared helper. The [existing controller](../../scripts/run-browser-gameplay.mjs)
uses explicit `--free-ride`, exact repository/public push/QA branch, SHA-pinned
driver and two literal IDs. Its old mode and historical pins remain separate.
It reuses the established lifecycle, full HEAD/index/native source guards,
eight before/after anonymous served-asset comparisons and independent owned
browser-process cleanup. Network remains only eight exact own-origin GET/HEAD
paths; all other requests, credentials and WebSockets fail. Late browser/network
errors and unfinished operations remain fatal.

The [inactive workflow](free-ride-checks.workflow.yml.example) has one public
Ubuntu 24.04 job, Node 24.21.0, existing Playwright 1.64.1/Chromium tooling, no new app
dependency and no app build. The work/cleanup/browser bounds remain 1020/90/540s
inside 20 minutes, with full browser-window admission and existing stream/report
caps. HOME, tooling, cache, browser profiles and report-generation files for the
new mode stay under one owned 0700 scratch root. Original streams retain byte/hash
and compressed payload metadata; failure and cleanup evidence must be preserved.
Root verifies the actual deployment metadata pin; served bytes establish the
eight exact product inputs, not the deployment pin alone.

No local runtime, test, install, build, server or browser was used to prepare this
packet. Static syntax, source equivalence, link and whitespace checks are the only
preparation checks. Actual two-case acceptance remains pending. Clock-controlled
RAF is not real-time performance, touch emulation is not a physical device, and
this scope establishes neither audible sound nor native/store/full-product proof.
There are no accounts, private user data, backend, payment or model/provider calls.
