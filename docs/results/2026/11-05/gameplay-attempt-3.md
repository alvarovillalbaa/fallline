# Crash journey passed; pause HUD was stale

5 November 2026. [Run42018708772](https://github.com/alvarovillalbaa/fallline/actions/runs/42018708772),
job127215667692, failed11:24:31–11:27:37 UTC. Activation `f2f3889388c68f7924d4ac5c74ddf77ad20d812e`
checked out `9dfed1a5522697befb870c023ee76e1de34146ca`, driver SHA
`2a2f1888f6f068524cf7863b491d204180bf19251a6cbb76bc0636d961709e95`.

The [receipt](gameplay-attempt-3.json) carries F01/F02 from their pinned
earlier source without repetition. **F03 passed** using one actual earned
Meadow record, a ten-second tuck run-up and9.6 seconds of right+tuck input.
The actual edge warning/crash appeared and the earned records stayed unchanged.
Its forty-second bound and all crash assertions were retained.

F04 failed its unchanged frozen-HUD assertion. Both readings were `paused`,
time00:00.2/speed35/in-air, but the next-flag distance changed138→137m and
progress0.193878%→0.237496%. F05/F06 were unrun. Source review shows that
pause changes mode without synchronously updating the last throttled HUD;
the next paused frame paints the already-final ride state. This is stale
display evidence, not proof that physics continues while paused.

The correction adds one `updateHud()` call immediately after entering pause.
The freeze assertion, game rules, inputs and timeout stay unchanged. The next
run will execute only F04–F06. Historical F01/F02/F03 remain pinned to their
own editions; do not call the changed game module byte-identical. Eleven
other product/package/original-test files stay exact; the whole changed game
module must normalize to its old hash by removing only this reviewed call.

All28 commands exited/reaped with complete streams and absent original groups.
Four full30-file guards remained exact (419,427 bytes). Eight pre-browser
assets matched; the post-browser phase was not reached. One context/browser
closed; late critical errors and warnings were zero. Owned browser processes
disappeared without signals and scratch cleanup passed. Full raw streams,
earlier failed/cancelled attempts and their distinct cleanup limits remain.
