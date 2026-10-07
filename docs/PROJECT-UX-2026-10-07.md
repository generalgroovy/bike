# Send It usability refinement — 7 October 2026

## Behavior

The desk's nominal Comfortable layout still rendered header, queue sorting and map controls at roughly 6–8 px. The default now uses readable header and control text, larger job/rider cards, both pickup and drop-off lines, and a calmer top bar. Existing compact-density preferences and rail shortcuts remain intact.

**View** groups Compact layout, Map only, shift traits/seed and area progress. Its native disclosure works by keyboard; Escape closes it and returns focus to View. Space on a disclosure toggles that disclosure without changing simulation pause.

Playback now says **Pause / Resume** and **Paused / Running · speed**. The selected running speed has pressed state; speed controls explicitly name that they also resume when paused. Onboarding's first successful broadcast still starts time, while later deliberate pauses stay paused during dispatch changes.

Radio uses one consistent resource: **slots**. Open/Local use one; Priority uses two, and a claim releases the occupied slots. Focus is separate. Dispatch tools show what they do, their cost, and an inline blocked reason: Need €5, Need 1 focus, Broadcast first, or already used. Live updates retain existing controls and focus. Autonomous rider decisions, competing-job projections, demand events, upgrades, map routing and optional Google service authority are unchanged.

## Validation

- `npm.cmd test`: 212/212 passed, including live playback labels, native disclosure keyboard activation, resource/availability feedback, deliberate pause ownership, first broadcast and deterministic rider outcomes. Evidence: `docs/evidence/ux-2026-10-07/tests.txt`.
- `git diff --check`: passed. No dependencies added.
- First test pass found one old source-string assertion expecting “contracts rail”; updated it to the new “jobs rail” wording. The complete suite then passed.
- Parent owns independent source review and actual rendered browser checks. Their findings and final evidence will be incorporated before promotion.
- Main has no browser-test harness; the separate Berlin preview has its own CI checks. Its results do not prove these runtime changes.

## Limits

Automated contracts establish behavior, not human playtest acceptance or enjoyment. Physical touch devices, live Google Maps service/API-key behavior, and audio listening have not been accepted by these checks. The optional Google attribution spacing is preserved by source review and still needs live-service review when a key is available. Reload does not save an active shift; stored preferences remain unchanged.
