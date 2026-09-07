# Send It — Inner Ring refinement

7 September 2026 · `feature/berlin-playtest` · ruleset `berlin-dispatch-v3`

This report covers the retained Inner Ring v3 scenario. See [full Berlin](BERLIN_FULL_CITY.md) for the current default preview.

[Play the guided shift](https://generalgroovy.github.io/bike/preview/berlin/?city=inner-ring&mode=training&seed=BERLIN-1) · [Test the Berlin shift](https://generalgroovy.github.io/bike/preview/berlin/?city=inner-ring&mode=standard&seed=BERLIN-1)

## What changed and why

The main improvement is that couriers now judge whether an offer can be finished before volunteering. Previously, urgency could attract a rider to a job that was already physically late under the current routing estimate. They would lose time attempting it, miss the deadline, and leave the desk with a setback that a player could not reasonably interpret.

The new choice rule includes the actual directed route to pickup, loaded cargo speed, current traffic and a small consideration buffer. A courier rechecks the deadline before accepting. Their personality still ranks feasible work. The player broadcasts OPEN, LOCAL or PRIORITY and can offer a bonus; couriers retain the choice. An unforeseen slowdown can still spoil a trip after acceptance.

The queue now shows a finish estimate and a plain-language time cue before the player broadcasts. Busy or resting rider dependencies are marked explicitly. Full-radio feedback explains how to make room. Rider cards distinguish travel to pickup from delivery. The review explains why more attention cannot rescue an impossible deadline.

Training starts close to its first actual street route. Its guide can be collapsed. Find route includes an accepting rider's remaining path, and the geographic contract preview uses its street route without a straight pickup-to-drop-off shortcut line. Address label width is measured using the label's own font.

The sourced Inner Ring geometry, one upgrade, three couriers and three cargo families continue to define the concept. This refinement adds information and fixes a decision defect without adding a new player resource or management panel.

## Mechanical comparison

Same deterministic policy: broadcast all off-air waiting work on OPEN once per simulated second; choose faster bikes at halfway. This is deliberately simple and does not model a skilled player. The ruleset changes subsequent courier choices and therefore later random outcomes; these are whole-run comparisons, not identical job-by-job experiments.

| Seed | v2 delivered / missed | v3 delivered / missed | v2 result | v3 result |
| --- | ---: | ---: | --- | --- |
| BERLIN-1 | 24 / 12 | 28 / 8 | Success | Success |
| BERLIN-2 | 20 / 13 | 29 / 7 | Collapse | Success |
| BERLIN-3 | 24 / 12 | 28 / 8 | Success | Success |
| BERLIN-4 | 19 / 13 | 30 / 6 | Collapse | Success |
| BERLIN-5 | 26 / 10 | 31 / 5 | Success | Success |

All 60 missed jobs in the original runs were already estimated late when accepted. The refined runs had zero already-late acceptances and zero claimed-job misses; remaining misses were unclaimed work. This does not establish the best strategy, overall difficulty, or enjoyment. No delivery target, deadline formula or reputation penalty was softened for this comparison.

Reproduce with Node 24:

```sh
node tools/audit-playtest.mjs
```

## Validation

- 253 Node tests, including autonomous choice on feasible work, rejection despite priority/bonus, deadline recheck, geographic movement and replay.
- 13 Chromium desk tests, including a real-time first delivery, full shift and download, queue advice, capacity recovery, collapsible guide and seven viewport sizes from 320 to 1440 pixels.
- Nine historical prototype browser regression tests.
- A pre-refinement v2 shift still reproduces its complete original exported result. The replay CLI supports v1, v2 and v3; incompatible city IDs are rejected.
- The source city pack remains `berlin-inner-ring-v1-9016596dc03b`; its hash and geographic tests continue to pass.

Browser coverage uses desktop Chromium and viewport emulation. Physical phones, Safari, enjoyment and owner concept approval remain separate checks. Reload still loses the current in-memory shift.

## Run and assess

Open the guided link above, choose the first shift, broadcast OPEN and start the clock. Use Fit map to see the full Ring. In the standard shift, compare finish estimates, leave capacity for a useful call and withdraw a call that no longer fits. Withdrawal does not cancel a job or remove its miss penalty.

To run locally from this branch:

```sh
python -m http.server 8080
```

Open `http://localhost:8080/`. On Windows, use `npm.cmd test` for the Node suite. With Playwright 1.57.0 and Chromium installed, run `python e2e/playtest_smoke.py` and `python e2e/browser_smoke.py`. The complete setup and geographic limits are in [BERLIN_PLAYTEST.md](BERLIN_PLAYTEST.md).

## Refined implementation priorities

1. **Test comprehension and fun in Berlin.** Observe 5–8 fresh players. Can they explain why a courier passed, choose a useful call without instruction, and read their first miss? Compare deliberate radio use with the OPEN baseline; ask whether they want another shift.
2. **Tune depth inside the existing controls.** Examine whether LOCAL, PRIORITY and the three upgrades offer useful alternatives. Adjust existing preferences, traffic pressure or arrival overlap only where session evidence identifies a weak choice. Keep geography fixed.
3. **Approve the concept and map.** Have Berlin-familiar players check routes across locality boundaries and waterways. Obtain owner approval before committing to expansion. Mechanical success alone does not pass this gate.
4. **Complete mobile reliability.** Durable save/resume and process recovery come before offline packs and a compact portrait map/contract sheet. Verify full shifts on real iOS and Android devices, including interruptions and measured performance.
5. **Expand through data and scenarios.** Add variety within the current Inner Ring, then connected outer Berlin regions in a versioned pack. Build a second city only after the shared simulation and CityPack contract can support it without duplicating game logic.

This is a preview refinement, with the retained released game still served at the site root.
