# Send It usability refinement — 7 October 2026

## Behavior

The desk's nominal Comfortable layout still rendered header, queue sorting and map controls at roughly 6–8 px. The default now uses readable header and control text, larger job/rider cards, both pickup and drop-off lines, and a calmer top bar. Existing compact-density preferences and rail shortcuts remain intact.

**View** groups Compact layout, Map only, Sort jobs, shift traits/seed and area progress. Its native disclosure works by keyboard; Escape closes it and returns focus to View. Space on a disclosure toggles that disclosure without changing simulation pause.

Playback now says **Pause / Resume** and **Paused / Running · speed**. The selected running speed has pressed state; speed controls explicitly name that they also resume when paused. Onboarding's first successful broadcast still starts time, while later deliberate pauses stay paused during dispatch changes.

Radio uses one consistent resource: **slots**. Open/Local use one; Priority uses two, and a claim releases the occupied slots. Focus is separate. Dispatch tools show what they do, their cost, and an inline blocked reason: Need €5, Need 1 focus, Broadcast first, or already used. Live updates retain existing controls and focus. Autonomous rider decisions, competing-job projections, demand events, upgrades, map routing and optional Google service authority are unchanged.

## Validation

- `npm.cmd test`: 212/212 passed, including live playback labels, native disclosure keyboard activation, resource/availability feedback, deliberate pause ownership, first broadcast and deterministic rider outcomes. Evidence: `docs/evidence/ux-2026-10-07/tests.txt`.
- `git diff --check`: passed. No dependencies added.
- Final runtime CI: [Test 37606941551](https://github.com/generalgroovy/bike/actions/runs/37606941551) passed at `42905d05e5c09249597ea672df54cff3f6f1c18f`: 212 behavior tests plus real Chromium checks at all four viewports. Downloaded geometry and screenshots are retained in `docs/evidence/ux-2026-10-07/browser/`.
- First test pass found one old source-string assertion expecting “contracts rail”; updated it to the new “jobs rail” wording. The complete suite then passed.
- Independent Fighter source review: no blockers; 20 focused dispatch, playback, keyboard, help and stability tests passed. Independently checked cost predicates, retained controls, pause ownership, View Escape and native summary Space.
- Independent Arena cross-review: no additional blockers; 27 focused dispatch, feasibility, playback, keyboard and UI-contract tests passed. Verified existing shift/city nodes are moved intact and the tool reasons match model predicates.
- Parent performed actual browser checks at desktop, 390 px and 320 px phones, and 844×420 landscape; concrete findings and corrections are recorded below. Promotion remains a separate parent gate.
- Added `tools/check-browser.py` to the existing Test workflow. Actual Chromium checks cover all loaded styles together, header/action/map geometry, unwanted pseudo-labels, rider text size, View keyboard behavior and bounds, stored density, and first-dispatch inspector actionability at 1366×900, 390×844, 320×740 and 844×420. Screenshots and JSON geometry are retained as CI artifacts. The separate Berlin preview still has independent checks.

## Rendered review and repair

The parent’s browser review caught failures that source review and behavior tests did not establish: the older `:root` variable overrode the intended header size; old icon-only pseudo-labels and widths survived; rider child labels remained tiny; phone map overlays covered onboarding and inspector content. Corrections target those composed-style causes. Primary decisions now take foreground priority, secondary overlays return after closing the inspector, and Sort jobs moved into View so the phone queue does not reserve a tall sorting column.

Root browser behavior checks passed first Open auto-start, explicit Pause followed by Local remaining paused, Help preserving paused/running state, View Space/Escape, and compact switching. Corrected desktop measured 56 px header, full nonduplicated labels and 11 px rider task labels. Phone checks at 390 px accepted clear guidance and unobscured inspector actions; 320 px retained internal inspector scrolling and no document overflow (305 px document within a 320 px viewport). Compact preference persisted through actual reload. Landscape View with Sort jobs open fit from y=56 to 316; selecting Highest payout reordered D2 first. The old tablet `top:172px` offset was removed so the rider rail starts at y=56 with three cards reachable. Close targets were enlarged to 44 px. The final coach rule gives guidance the same unobscured priority at every width. Root accepted the final runtime in rendered checks, including 44×44 close targets, full 56 px desktop header, phone foreground inspector and bounded landscape View; 390 px document width was 375 px with no horizontal overflow.

The additional source review passed through runtime `42905d0`, with 31 focused tests and inspection of the moved sorting controls, overlay priority, CSS resets, and actual Chromium regression coverage. One intermediate CI run (`37606777987`) failed because its role locator attempted to inspect a button inside a closed disclosure; the test was corrected to inspect the stored pressed attribute without requiring visibility. The subsequent run `37606841446` passed that interaction and persistence check.

## Limits

Automated contracts establish behavior, not human playtest acceptance or enjoyment. Physical touch devices, live Google Maps service/API-key behavior, and audio listening have not been accepted by these checks. The optional Google attribution spacing is preserved by source review and still needs live-service review when a key is available. Reload does not save an active shift; stored preferences remain unchanged.
