# The Berlin desk: concept playtest

Implementation snapshot: 7 September 2026. Ruleset `berlin-dispatch-v1`; city `berlin-curated-v12`.

This is a playable experiment for deciding what Send It should become. Automated correctness checks are complete for this snapshot; human comprehension, enjoyment, strategic depth, and the final Berlin map still require validation and owner approval.

## Run it

Hosted preview: <https://generalgroovy.github.io/bike/preview/berlin/playtest.html>.
Successful push-triggered CI on this branch refreshes the isolated GitHub Pages preview.

From the repository root, run `python -m http.server 8080` and open `http://localhost:8080/playtest.html`. A local HTTP server is required for browser modules. No build step or API key is needed. The playtest requests only files from its own origin. The full game remains at `index.html`.

Choose **Play your first shift**, select a contract, broadcast OPEN, and press **Start shift**. Couriers choose jobs themselves. The tutorial starts paused so reading does not consume its opening deadline.

Share an opening with `playtest.html?mode=standard&seed=BERLIN-1`. Retry uses the same seed. Actual outcomes also depend on the actions and their simulation ticks. A seed alone does not reproduce a played shift.

## What is implemented

| Element | Rules |
| --- | --- |
| People | Kira, Mauro, Brian; stable sprinter, earner, and local preferences; autonomous choice and breaks |
| Cargo | Light documents, delicate cargo, heavy groceries; existing loaded speed and fatigue effects |
| Radio | Three slots; OPEN and LOCAL cost one; PRIORITY costs two; acceptance frees the bandwidth |
| LOCAL | Existing scoring favors riders in the pickup district, with a smaller proximity benefit for some other riders |
| Bonus | Spend EUR 5 once per waiting job to increase appeal; the client payment stays unchanged |
| Resources | Reputation, cash, radio capacity; energy is visible for each rider |
| Training | Arrivals for 2 minutes, up to 1 minute to close, target 5 deliveries |
| Standard | Arrivals for 8 minutes, up to 1 minute to close, target 24 deliveries |
| Ending | Success requires target deliveries and reputation above zero; unresolved jobs count as misses |
| Rhythm | Opening, busier phase, recovery, final push, closing; one forecast roadworks event |
| Upgrade | One halfway choice: radio capacity, lower fatigue, or faster bikes; simulation stops during selection |
| Review | Delivered, missed, net earnings, top courier, main failure category, short timeline, retry and export |

District pressure, FLOW, Focus, recurring clients, demand-event processing, scheduled jobs, return jobs, district interventions, and territory expansion are excluded from this ruleset. Their update/spawn/completion wrappers are bypassed, and optional actions are disabled. The original full game retains its own rules.

The map is explicitly the bundled curated Berlin layout. It is not the unfinished native citywide runtime. A legacy starter-map defect allows routes inside street islands that cannot be reached from the depot; prototype job generation now excludes those islands. Training also restricts the address pool to a smaller reachable area. No straight-line replacement route is invented.

## Design priorities

1. **Simplicity:** one OPEN action on each queue card; other signals appear with the selected contract. Keep cards and keyboard focus stable during updates.
2. **Depth:** create tradeoffs through travel, overlapping deadlines, fatigue, geography and radio capacity. Keep the player's influence indirect.
3. **Fun:** make a first delivery easy to understand, show who volunteers, build and release tension, finish positively, and explain setbacks.
4. **Portability:** fixed simulation steps, versioned action records, pointer input, visible pause, and no essential hover-only controls. Retain JavaScript and Canvas until measurements justify a change.

## Validation at this snapshot

- `npm test`: 243 passing tests, including nine new playtest tests.
- `python e2e/browser_smoke.py`: nine passing Chromium tests for the existing game.
- `python e2e/playtest_smoke.py`: seven passing Chromium tests for the new desk.
- Browser coverage includes a real-time first delivery, radio/bonus controls, keyboard activation, keyed card identity, accelerated complete shift and record download, replay-seed retry, upgrade pause, renderer disposal, help, zoom, and a simulated background-visibility event.
- Layout checks at 1440, 1280, 1024, 850, 390, 360 and 320 CSS pixels found no document overflow and verified the canvas backing width. Desktop radio buttons stay visible at the tested desktop sizes.
- A full-game regression exposed map-focus collapse after both rails were collapsed. The map now spans the grid, and its existing browser regression checks the resulting width.
- 48 additional simulations: 12 seeds x two modes x two OPEN-only polling intervals. Training succeeded in 24/24. Standard succeeded in 11/12 with one-second polling and 10/12 with eight-second polling. Both used the speed upgrade. This is a pacing baseline, not human evidence or proof of strategic depth.

All new browser cases record uncaught errors, failed local resource requests and external requests; the passing runs recorded none. The original native game intentionally exercises missing/invalid-runtime fallback. Test evidence is written to `reports/browser/`, excluded from Git. CI now includes both browser suites.

## Record and replay

At the shift review, choose **Download shift record**. The JSON contains ruleset/city versions, seed, mode, tick count, validated actions, outcomes and a timeline. It contains no account identity and is downloaded locally; the game does not upload it.

Replay and verify a downloaded record with:

```sh
node tools/replay-playtest.mjs path/to/shift.json
```

This verifies exact reconstruction with the same implementation. It is not a durable save/resume feature, a player-facing replay viewer, or a cross-engine determinism guarantee. Intentional rule or city changes must advance their version IDs before new published records are produced.

## Next implementation slices and gates

| Order | Deliverable | Exit evidence |
| --- | --- | --- |
| 1 | Observe 5-8 fresh exploratory sessions; compare OPEN-only with deliberate LOCAL/PRIORITY play | Identify confusion, empty waiting, dominant choices and remembered courier moments |
| 2 | Tune existing arrival mix, overlaps, route lengths and radio opportunity costs | At least two useful styles on varied seeds; avoid extra controls as a substitute for depth |
| 3 | Finish the intended Berlin map and verify coordinate alignment, reachability and readable landmarks | Pickups, routes and markers agree with the map; city geography changes decisions |
| 4 | Structured fresh-player check and owner review | Proposed targets: 8/10 dispatch and explain autonomy within 60 seconds; 7/10 explain a choice and setback; 6/10 voluntarily retry |
| GATE | Owner explicitly approves the tested Berlin concept and map | Full mobile adaptation can begin |
| 5 | Portrait-first map and bottom sheet; gestures, safe areas, durable save/resume, interruption handling, offline caching | Same decisions survive real iOS/Android screens, interruptions and complete shifts |
| 6 | Validate desktop/mobile action parity and choose distribution | Device performance, battery/thermal behavior and restart reliability measured |
| 7 | More Berlin scenarios, then connected areas, then one contrasting second city | Geography changes strategy while controls and core simulation remain shared |

These small-sample thresholds are decision aids, not estimates of market demand. The broad OPEN-only win rate is specifically a reason to investigate depth before approving the concept.

## Known limits

The narrow-screen layout is a responsive fallback, not the intended mobile product. It needs a bottom-sheet flow, real touch-device testing, pinch gestures and interruption-safe persistence. Reload loses a run. Backgrounding pauses the in-memory simulation, but process termination and OS suspension are not covered by save/resume yet. No service worker, installed-app packaging, backend, analytics collection or second city is included.

The inherited rider-availability forecast remains approximate: it can underestimate the remaining work of a busy courier, and pickup estimates do not fully model event-adjusted edge time. The UI calls it an estimate, not a commitment; improve it before relying on tight arrival predictions in the approved game.

Production release, final native-map acceptance, human fun validation and full mobile approval are separate remaining decisions.
