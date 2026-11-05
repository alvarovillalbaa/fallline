# Published gameplay and pause-HUD correction accepted

5 November 2026. [Play Fallline](https://fallline-alvaro.vercel.app).
Six authored journeys have accepted evidence across their recorded editions;
**no single six-case invocation passed**. The earlier29 mechanics/storage
cases remain separate and were not rerun.

- F01/F02 passed in [attempt2](gameplay-attempt-2.md): actual desktop controls,
  all three neutral descents, exact four-second penalties, frozen results,
  restarts and earned record restoration.
- F03 passed in [attempt3](gameplay-attempt-3.md): actual edge warning/crash
  after a tuck run-up, preserving the actual earned course record.
- F04/F05/F06 passed on the repaired edition in
  [run42020209360](https://github.com/alvarovillalbaa/fallline/actions/runs/42020209360),
  job127220763970, **11:35:35–11:38:35 UTC**. Activation
  `a2d4705f25a6aa89d051b9183b630890fb804113` checked out
  `2dbe02f2be9e3a8cb4675d4639171d81bcda9a2d` with driver SHA
  `20c1262f3cde3cd37254659fcb51696535e1a20e386de119afa52c482b07ecfa`.

The actual product correction is one `updateHud()` call when pause opens.
Physics already stopped; the prior throttled HUD could repaint once after
pause. The **unchanged** frozen-HUD assertion now passes, including held-input
clearing, explicit guide resume and restart. No game rule, timeout or assertion
was weakened. The earlier failed snapshot and both fixture corrections remain
in their original receipts; [attempt1](gameplay-attempt-1.md) has no recoverable
browser result or scoped cleanup proof.

The [final receipt](gameplay-checks.json) hard-pins both earlier result files,
decodes/verifies all112 historical streams and carries their three accepted
journeys without repetition. Eleven product/package/original-test files are
byte/mode/blob exact. The changed game module is explicitly different:
removing its single reviewed pause-HUD call reproduces the whole old
SHA/blob/bytes/mode. The current F04 test proves that change; historical results
are not relabeled as current-head executions.

Node24.21.0 / npm11.19.0 / Playwright1.64.1 / Chromium156.0.8078.4 ran one
desktop1440×1000 profile and touch-emulated390×844. Actual touch brake/tuck
changed speed; simultaneous contacts, cancellation and a second deliberate
jump passed. Canvas pixels were nonempty/varied, controls stayed reachable and
document width remained390. Root visually reviewed the retained desktop-menu
and narrow-riding JPEGs: scene, HUD and controls were coherent without visible
overlap at those captured frames.

Corrupt owned JSON recovered through a real completion/reload. A separate
Chromium `--disable-local-storage` profile actually denied reads/writes,
completed a run and truthfully kept a visit-only record. Its unrelated session
sentinel was seeded once and survived play/reload. Preservation of inaccessible
localStorage is not claimed. No valid score or internal ride state was injected.

All34 current commands exited0/reaped, with complete streams and absent groups;
all68 compressed streams were independently decoded and hash-checked. Five full
32-file guards (529,918 bytes) matched. Sixteen anonymous asset observations
(eight before/eight after) matched the repaired source served by
`dpl_3QFYZk9TY5FLmdkhK4stnhm4a1fd`. Four contexts/two browsers closed;
fifteen attributed processes disappeared with no forced signal, and owned
scratch removal passed. Critical/late errors were zero; one console warning
was counted. Temporary CI is retired after terminal execution.

This is clock-controlled functional gameplay, not physical-device, audible
sound or real-time performance evidence. Free-ride UI and full-product/portfolio
acceptance remain open. A later documentation-only publication has a separate
Git/deployment identity; these actual HTTP/browser observations stay pinned
above. No local install/build/browser/database, account, paid or model action.
