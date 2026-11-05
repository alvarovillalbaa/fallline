# Published gameplay checks

Current status: the [accepted result](../results/2026/11-05/gameplay-checks.md)
owns the six-journey ledger, pause-HUD correction, exact editions and cleanup.
The authored plan and intermediate status below are preserved historical
context, not a new execution request. The temporary workflow is retired.

5 November 2026. The [initial cancelled run](../results/2026/11-05/gameplay-attempt-1.md)
has no accepted browser receipt. The replacement
[run 42016760768](https://github.com/alvarovillalbaa/fallline/actions/runs/42016760768),
job `127209104068`, accepted F01/F02, including all three actual course finishes
and record reload, then failed F03: held-right input was still riding after its
40-second bound. F04–F06 were UNRUN. Source, served-asset and owned cleanup
guards passed; no late critical browser error was reported. Those outcomes are
retained, not relabelled by this fixture repair.

[Run 42018708772](https://github.com/alvarovillalbaa/fallline/actions/runs/42018708772),
job `127215667692`, then accepted F03: it earned one real Meadow record, took
the ten-second tuck run-up and reached the edge crash after 9.6 seconds of
right/tuck input, with the warning observed and earned records unchanged.
F04 failed its unchanged paused-HUD equality assertion: mode, displayed time
and speed stayed paused, but the next-flag distance/progress changed on the next
paused frame. F05/F06 were UNRUN. Late critical browser errors were zero and
source, served-asset and owned cleanup guards passed. Root identified the
display defect: pause did not refresh the final ride state into the HUD until
a later animation frame. The application repair refreshes HUD immediately
after entering paused mode; it does not relax the freeze assertion or add a
test wait. A new published application edition and actual F04 result are
required before acceptance. Root retains historical proof and the exact
one-line edition difference separately.

The owner's standing “approve everything”,
“you choose”, “keep going” and “do all the work” authorizes this scoped public
CI browser packet and necessary temporary workflow/publication. It resolves the
older new-game browser-approval wording in the repository. It does not authorize
paid resources, accounts, provider/model calls, unrelated configuration or a
physical-device claim. The [product brief](../spec.md) and
[ride boundary](../ride-contract.md) remain authoritative.

The selected baseline is `a4d910d6c5f7de562671df97e1947156475324f5`.
Production metadata identifies `dpl_BcRo1QPuz4r74feAP4FgYEhqM2Nv` at that source
and the canonical `https://fallline-alvaro.vercel.app` alias. Provider READY is
separate from the actual gameplay evidence proposed here. Root owns immutable
source pinning, before/after identity checks for the eight public resources
(HTML, CSS, favicon and five modules), temporary CI and later receipts.
The [older publication](../results/2026/10-26/publication.md) and
[29 source/mechanics checks](../results/2026/10-26/source-checks.md) stay historical;
this packet does not rerun that pure suite or relabel it browser acceptance.

## Exact six journeys

The [custom Node driver](../../tests/browser/gameplay.mjs) uses CI-only
`playwright@1.64.1` and its Chromium. No application dependency or package
manifest is changed. Literal identities are:

| ID | Title |
| --- | --- |
| F01 | desktop menu guide and keyboard controls affect the ride |
| F02 | three neutral descents finish with exact penalties frozen results and reloaded records |
| F03 | an intentional edge crash preserves the earned course record |
| F04 | pause guide restart and resume clear held keyboard input |
| F05 | narrow touch holds multitouch cancellation and jump affect gameplay |
| F06 | corrupt and disabled storage keep play available with honest record notices |

F01–F04 share one fresh desktop context at 1440×1000. They exercise actual menu
selection, native guide modality/Escape, camera preference and keyboard jump,
brake, tuck, left/right carving, pause, resume and restart. HUD speed and next
flag offset must demonstrate actual effects. Holding jump must return to snow
without repeating. Pause/guide time must freeze; previously held keyboard input
must remain cleared after explicit resume. Sound stays off; audibility is not
tested.

F02 reaches real neutral-input finishes for all three authored courses. The
center line avoids their off-center obstacles. Expected passed/missed counts
are Meadow 6/2, Pines 2/8 and Ridge 2/10. The driver checks the actual persisted
record, `adjustedTime = time + missed × 4`, displayed flags/raw/adjusted times,
frozen result text, real restart and record restoration after reload. F03 then
uses those **actually earned** records, deliberately carves past the edge,
observes the warning/crash and requires the records to remain unchanged. No
valid score is seeded or substituted. Shared context is an explicit proof
dependency rather than independent-case isolation. F03 now uses ten seconds of
real tuck input before holding right **and tuck** for at most the same 40-second
carve bound. The warning, edge-crash, result and unchanged-record assertions
remain required. The failed browser outcome did not retain a final HUD; a later
focused model diagnostic corroborated a held-right stall near the edge, without
proving the exact browser cause. No application physics or collision is changed.

For the current remaining acceptance, set exactly
`FALLLINE_GAMEPLAY_CASE_IDS=F04,F05,F06`. That result contains only these three
actual cases and executes neither F01/F02 nor F03 or its earned-record setup.
The earlier exact four-case selection `F03,F04,F05,F06` remains available;
omitting the variable retains the original six-case execution. All other
supplied selections are rejected. Previously accepted cases are absent from a
new selected result array; their proof must be pinned separately to the actual
prior runs. No accepted result is fabricated or carried into the driver's JSON.
If a fresh F03 context lacks a Meadow record, it earns exactly one real neutral
Meadow finish using the existing assertions before returning to the menu for
the crash journey. This is its necessary precondition, not a replay of F02's
three-course journey. F03 records that setup, run-up and final public HUD before
the crash assertions. F04–F06 bodies are unchanged in both selection repairs.

F05 uses a fresh 390×844 context with `hasTouch:true` and `isMobile:true`.
Actual `Input.dispatchTouchEvent` contacts use visible button centers and stable
IDs. Touch brake/tuck affect HUD speed; two simultaneous carve contacts show
held state, cancellation clears held controls, and a held jump lands without
auto-jumping. Release is sampled by actual neutral physics frames before a new
press must produce a second real jump.
End/cancel events have an empty contact list. This is Chromium touch emulation,
not physical hardware, mobile Safari, IME or real-world sports evidence.

F06 uses two fresh storage profiles. The first seeds only authored invalid
`fallline.v1` JSON and an unrelated localStorage sentinel before app boot.
Play remains available, an actual completed course can replace that corrupt
save, reload restores the earned record and the unrelated key stays unchanged.
The second launches genuine Chromium `--disable-local-storage` and must observe
failed native reads/writes before claiming storage denial. If the flag is
ignored, the case fails; no API shim is substituted. It completes a real run,
requires visit-only record wording and no retained record after reload, while
an unrelated **sessionStorage** sentinel remains. Preservation of inaccessible
localStorage in that profile is not observable and is not claimed. The
[Chromium switch source](https://github.com/chromium/chromium/blob/main/content/public/common/content_switches.cc)
declares the disable flag; the actual runtime observation is still mandatory.

## Browser clock, rendering and boundaries

Playwright's clock is installed before navigation and paused after the game is
ready. `clock.runFor` advances actual requestAnimationFrame callbacks in chunks
at most 1,000 ms, with 900,000 ms aggregate virtual time and 160,000 ms per
neutral descent. No `fastForward`, application-state injection, teleport,
record replacement, synthetic completion or network fulfillment is used.
The game's bounded physics substeps and its real 0.1-second frame-delay ceiling
remain unchanged. This is a clock-controlled functional profile, not measured
real-time frame rate, responsiveness or simulation-performance evidence.

Desktop and narrow checks require nonempty, varied actual Canvas2D pixel
samples, no horizontal document overflow, usable visible button bounds and no
error overlay. Up to two optional real viewport JPEGs (desktop menu and narrow
riding, quality 30) may retain visual evidence. Combined image bytes are capped
at 70,000; oversized images are explicitly omitted. They are not resized or
postprocessed, and pixel statistics are not a substitute for visual review.

Every request is denied except GET/HEAD to the eight exact own-origin resource
paths, without queries, cookies or Authorization. WebSockets are blocked and
counted as failures. Real responses continue unchanged. Console errors,
page errors, observed unhandled rejections and failed same-origin requests
remain failures, including events observed during teardown. Diagnostics retain
bounded sanitized messages/hashes; no full response bodies, private URL queries
or application-private state is dumped. There is no account, backend, audio
device, provider/model, external art, user-data or native/store interaction.

## Execution and receipt contract

Root prepares one public Ubuntu 24.04 job with a 20-minute ceiling, Node 24.21
and the separate pinned CI-only browser installation. The application itself
needs no install/build. Run the driver only in that owned CI scope:

```sh
node tests/browser/gameplay.mjs
```

Required environment: `CI=true`, fixed canonical `FALLLINE_GAMEPLAY_ORIGIN`
and absolute `FALLLINE_PLAYWRIGHT_ROOT` whose `node_modules/playwright` version
is exactly 1.64.1. Root controls browser downloads, temporary storage and
source/served-asset manifests. The driver has a 12-minute work deadline,
bounded clock RPCs/actions, 15-second context/browser-close observations and a
two-second final stdout deadline. Root independently bounds the entire process
tree and verifies owned browser processes and filesystem cleanup; the driver
does not kill an unproven process or recursively delete browser directories.

One line, `FALLLINE_GAMEPLAY_RESULT=<JSON>`, is capped at 128 KiB. It includes
schema version, actual browser version, origin, only the selected exact identities and
accepted flags, bounded observations/failure stages, errors, virtual time,
network/error counts and cleanup. A first failure may leave later cases UNRUN;
missing/failed cases cannot be accepted. Every observed context/browser must
close in `finally`, late event checks complete after closure and pending
operations remain a failure. Driver success requires every selected case accepted, no
critical errors and verified cleanup plus the independent root controller.
Overall six-journey closure also requires the separately pinned earlier proof:
F01/F02 for the four-case selection, and F01/F02/F03 for the three-case selection.
The application edition difference remains explicit rather than implying all
six cases ran against the pause-HUD repair.

No local browser launch, test execution, game import, installation or build is
part of authoring. Syntax, source/link checks and `git diff --check` are allowed.
Actual failure or success must be preserved in later dated owning receipts.
