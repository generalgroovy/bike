# Send It: deliberate dispatch

Baseline: `44ec511`, clean `main`, fetched 6 October 2026. Candidate branch: `codex/send-it-dispatch-clarity`.

## Journey and evidence

Select a contract, compare signals, broadcast, observe the autonomous rider and delivery outcome. The existing inspector had no broadcast controls; comparisons lived in hover text. Its attraction rankings ignored other live calls. First-dispatch onboarding resumed time before the learner reached a broadcast. Existing compact styles reduced inspector text to 6–8 px and limited its height to 154 px.

## Bounded improvement

- Put three clearly named broadcasts, their radio costs and competition-aware estimates in the selected contract.
- Keep first-dispatch planning paused until a valid broadcast, while preserving explicit pause/resume ownership.
- Keep route/outlook detail available under a disclosure, and make the primary decision readable and keyboard/touch operable.
- Preserve rider autonomy, deterministic outcomes, existing strategic systems and storage preferences.

## Acceptance criteria

Forecasts consume no random numbers or simulation actions, react immediately to competing calls and explain uncertainty. Capacity reflects replacing the current signal. Expired/claimed jobs reject stale actions. A rejected broadcast never resumes onboarding; manually paused games stay paused. Primary actions fit a readable responsive inspector; extended information remains available. Existing model and UI tests pass, with meaningful new regression tests and a browser smoke check where available.

## Verification

- `npm test`: **211/211 passed**, including syntax checks. Ten new behavioral regressions cover radio replacement cost, rejected/expired/missing/finished commands, explicit pause ownership, comparison against competing calls, same-tick invalidation, weak/tied preferences, deterministic autonomous outcomes, reusable accessible controls, feasible guide openings and empty fallback. One old source-contract assertion was updated to follow the shared command wrapper; its original direct-call expectation failed on the first suite run.
- CUA browser smoke at **1280 × 720** and **390 × 844**: guide selected feasible D1 for `SEND-IT-QUALITY`, planning stayed paused, Enter on Local broadcast started the clock, explicit Pause survived a signal switch and opening/closing Help, and Riders & route expanded/collapsed. No app errors or warnings appeared in captured logs. Browser viewport and temporary tabs were restored/closed; preview server stopped.
- Browser iteration found and fixed inherited hidden-state rules exposing false “Rider committed” badges and an empty event, phone toolbar/rail overlap, and an old rider-panel offset. Final phone content width was **375 px within a 390 px viewport**, with the toolbar, queue, map and riders in order.
- Parent review found the coach behind map controls and an old task tooltip on the selected contract. Both were fixed and rechecked: coach top **86 px**, map toolbar bottom **68 px**, tooltip hidden after selection. On phones the guide yields to an open contract so they do not overlap.
- Self-review and parent model/command review completed. Read-only forecasts preserve simulation RNG, deliveries, riders and dispatch history in a paired deterministic run. Existing storage keys and simulation commands remain authoritative; no new save format.
- Candidate branch now runs the existing test workflow. Publication, live Google basemap, physical touch devices and learner playtests are **not verified** in this candidate. Parent owns CI acceptance and release. Main and preview branches remain separate.

Evidence: [test log](evidence/quality-2026-10-06/tests.txt), [desktop](evidence/quality-2026-10-06/desktop-dispatch.png), [phone planning](evidence/quality-2026-10-06/phone-planning.png), [phone live dispatch](evidence/quality-2026-10-06/phone-dispatch.png).

## What remains

The forecasts deliberately ignore random variation and future events; “may choose” is not a promise. The existing compact expert layout remains dense. Long-term balance, sensory/audio quality and novice comprehension need human playtesting. This release improves the actual decision loop without claiming the game has reached a final quality ceiling.
