# Send It: one Berlin desk, one geographic city

Implementation snapshot: 7 September 2026. Ruleset `berlin-dispatch-v3`; city `berlin-inner-ring-v1-9016596dc03b`. See [the refinement report](BERLIN_REFINEMENT.md) for the latest pacing and clarity changes.

[Play the current Berlin Inner Ring concept](https://generalgroovy.github.io/bike/preview/berlin/).

The simplified desk and useful depth of the broader prototype now meet in one game: three independent couriers, a shared radio, readable cargo differences, locality demand, a forecast slowdown, one upgrade and a closing review. The operating area follows the S41/S42 Ringbahn. Streets, routes, address pins and contextual map layers share one geographic coordinate system.

This is ready for concept playtesting. Automated correctness and geographic processing checks are evidence about the implementation; human comprehension, enjoyment and approval remain open.

## Play and test

Run `python -m http.server 8080` from the repository and open `http://localhost:8080/`. `index.html` and `playtest.html` open the same desk. The historical full prototype is retained at `legacy.html` for regression checks. No runtime build, map API key or third-party tile service is needed.

Choose **Play your first shift**, broadcast the first contract on OPEN, then start the clock. The map starts close to that route; the guide can be collapsed. Riders volunteer; no assignment command exists. **Map view** zooms to a locality while keeping the whole Inner Ring in operation. **Find route** frames the current street route and the accepting courier's remaining path. Mouse wheel, drag, touch pinch, zoom buttons and keyboard controls operate the map. Narrow screens have Map / Jobs / Contract navigation.

Share a starting situation using `?mode=standard&seed=BERLIN-1`. The seed recreates the opening; reproducing the played outcome also requires the recorded actions and ticks.

## The unified game

| Design aim | Current implementation |
| --- | --- |
| Simplicity | Three riders, one queue, one visible clock, three radio choices. A quick OPEN action teaches the loop. |
| Depth | Real street distances, travel to pickup, regional demand, rider preferences, fatigue, cargo handling and limited radio capacity. |
| Fun and feedback | Riders visibly volunteer; pickup/drop-off cues, clean-delivery streaks, demand pulses, one forecast event, one halfway upgrade and a causal review. |
| Mobile transfer | Shared JavaScript simulation, fixed steps, validated action vocabulary, pointer input, touch pinch, explicit pause, small-screen panel navigation and no essential hover-only controls. |

Kira favors short urgent jobs, Mauro worthwhile fees, and Brian local work. Light documents travel at normal pace. Delicate and heavy cargo slow loaded travel by 10%; heavy cargo is more tiring. OPEN and LOCAL consume one slot, PRIORITY two; a courier's acceptance releases the slot. A €5 bonus costs desk cash without increasing the client fee.

The queue now shows time to finish including pickup, with text labels for available time, a tight window, dependence on current work, or too little time. In v3, couriers decline offers whose current route estimate leaves less than 1.5 seconds to consider the call. They recheck that the trip still fits before accepting. Traffic can subsequently change; the estimate is not a guarantee. Priority and bonuses cannot extend the deadline. Withdraw an unpromising call to free the radio, while the waiting contract's deadline continues.

The first shift has two minutes of arrivals, up to one minute to close and a five-delivery target. The standard shift has eight minutes of arrivals, up to one minute to close and a 24-delivery target. Success also requires reputation above zero. Jobs left at final closing count as misses. The halfway upgrade pauses the simulation and offers one extra radio slot, lower fatigue or faster bikes.

Standard demand successively favors Mitte, Kreuzberg, Moabit and Friedrichshain. These are authored game patterns, not measured economic activity. Nearby pickup options keep the queue usable as the team spreads. The locality highlight is informational; the player influences dispatch through the radio.

The new clean-delivery streak is feedback, without another resource or spending menu. The earlier Focus, district-pressure management, scheduled jobs, return jobs and territory-growth systems remain outside this ruleset. Their implementation remains available in the historical prototype.

## Geographic representation

| Item | Shipped city pack |
| --- | --- |
| Operating boundary | OpenStreetMap S41 relation 14981, Ringbahn loop |
| Enclosed area | 87.351 km² |
| Locality intersections | 19 official ALKIS locality polygons, including small boundary slivers |
| Street sections | 6,938 clipped Detailnetz features |
| Official source addresses inside the ring | 51,240 |
| Playable sampled addresses | 7,533 in the largest mutually reachable network |
| Graph | 30,656 nodes; 32,293 route edges |
| Map context | Official locality boundaries, parks, water, vegetation and built-up land-cover polygons |
| Projection | EPSG:25833; one uniform metric coordinate system; 10 metres per game unit |
| Processing | 1 m geometry simplification; 0.1 m coordinate rounding |
| Pack size | Approximately 4.91 MB before HTTP compression |

“One-to-one” means that city geometry is neither rearranged nor stretched to suit gameplay. Locality names and boundaries, waterways, roads and address coordinates align. It does not mean a literal screen scale, a complete building/entrance survey or navigation-grade traffic rules.

True Detailnetz connection-point IDs determine street connectivity. A bridge crossing another street in the picture does not create an intersection. The graph retains traffic levels and B/R/G direction; reversing a cached route is forbidden. Motorways and private/unclassified roads are display-only. Pedestrian paths can act as push-bike links. Bicycle-specific exemptions, turn restrictions, stairs and time-dependent access are not fully represented.

Address pins retain their official coordinates. A short link to the same named street is a game access approximation, capped at 60 m and rejected where it crosses mapped water. It is not a surveyed entrance. Built-up land-cover polygons are not complete individual building footprints. Road widths are cartographic symbols. Roadworks, riders, jobs and demand are fictional; riding speed and shift time are compressed for play.

The game fails explicitly if its map pack cannot load. It does not silently swap in the old schematic map.

Sources: [Detailnetz Berlin](https://daten.berlin.de/datensaetze/detailnetz-berlin-wfs-4f2045ef), [Adressen Berlin](https://daten.berlin.de/datensaetze/adressen-berlin-wfs-634ab8ba), [ALKIS Ortsteile](https://daten.berlin.de/datensaetze/alkis-berlin-ortsteile-wfs-61bd3084), [Grünanlagen WFS](https://gdi.berlin.de/services/wfs/gruenanlagen?service=WFS&request=GetCapabilities), [ALKIS Land Cover WFS](https://gdi.berlin.de/services/wfs/lc_alkis?service=WFS&request=GetCapabilities), and [OpenStreetMap S41](https://www.openstreetmap.org/relation/14981).

Berlin source datasets use dl-de-zero-2.0. The Ringbahn source and combined geographic pack are published under ODbL 1.0. Attribution, license links, downloadable data, source URLs and hashes are available on the game's [map data page](https://generalgroovy.github.io/bike/preview/berlin/map-data.html).

## Validation and limits

- `npm test`: 253 tests pass, including ten geographic tests and the preserved historical regressions.
- `python e2e/playtest_smoke.py`: 13 Chromium tests pass. They cover a real-time first delivery, a complete standard shift, radio/bonus actions, keyboard use, region and route focus, timing advice, full-radio feedback, collapsible guidance, touch-pinch event handling, small-screen navigation, failure to load map data, background pause, cached map drawing, review download and retry.
- `python e2e/browser_smoke.py`: nine tests pass for the retained historical prototype.
- Responsive checks cover 1440, 1280, 1024, 850, 390, 360 and 320 CSS pixels: no horizontal document overflow; canvas CSS/backing sizes agree.
- A source-to-pack geographic audit checks every playable address and every street section. Maximum observed address-coordinate deviation is **0.071 m**. Maximum observed street-geometry deviation is **1.027 m**, sampled at no more than 5 m along each displayed line. These are processing errors relative to the downloaded sources, not certified survey accuracy.
- All six source hashes and the generated pack hash verify. Every playable address is reachable both from and back to the depot under the directional graph. Street geometry, source junction identity, bridge levels, one-way paths and mid-edge rerouting are tested.
- Motion conserves elapsed time when crossing multiple short geometry segments. A courier whose contract expires finishes the current street segment before listening again. Busy-rider ETA includes the remaining pickup leg, loaded delivery leg and current edge slowdowns.
- Same-implementation replays reproduce completed training and standard shifts, including radio-capacity rejections. Records reject a mismatched city version.

Automated OPEN-only baseline: training won all three tested seeds (BERLIN-1 to BERLIN-3). Standard v3 won all five tested seeds (BERLIN-1 to BERLIN-5), with 28, 29, 28, 30 and 31 deliveries. Under v2 the same policy won three of five, with 19–26 deliveries; all 60 misses were already estimated late at acceptance. In v3 there were no already-late acceptances, and 5–8 jobs per seed expired unclaimed. Run `node tools/audit-playtest.mjs` to reproduce the comparison. This is evidence of a corrected decision defect, not human enjoyment, balance across all seeds or superiority of a particular strategy.

The browser checks are Chromium tests and viewport emulation, not certification on physical phones. Full mobile work still includes durable save/resume, offline caching, operating-system interruption tests, iOS Safari/Android testing, performance and battery measurement, and a more compact portrait interaction flow. Reload currently loses the in-memory shift.

## Reproduce the map and a shift

The runtime uses the checked-in pack. To deliberately refresh it, use Node 24 and Python with `pip install -r tools/requirements-map.txt`:

```sh
node tools/import-ringbahn.mjs --output=../inner-ring-source/ringbahn-boundary.geojson
node tools/fetch-inner-ring.mjs ../inner-ring-source
python tools/build-inner-ring.py ../inner-ring-source generated
python tools/validate-inner-ring.py ../inner-ring-source generated
npm test
```

Fetching pages validates totals and duplicate IDs and stores source hashes. Building is offline and deterministic for those snapshots. The generated city ID includes the source fingerprint. Change the schema/build revision when changing processing rules; never reuse a city/ruleset identity for incompatible behavior. Do not publish a refreshed pack until its geometry, reachability, scenarios and browser checks pass.

Download a completed shift record in the review and run:

```sh
node tools/replay-playtest.mjs path/to/shift.json
```

This verifies reconstruction with the matching ruleset and city pack. The current source supports the historical v1 curated-map, v2 geographic-map and current v3 records. A saved pre-refinement v2 fixture is checked for exact replay in the test suite. This is not durable save/resume, a replay viewer or a cross-engine determinism guarantee. Records stay local; the game uploads no player telemetry.

## Implementation plan from here

| Stage | Work | Evidence to proceed |
| --- | --- | --- |
| 1. Inner Ring validation | Observe 5–8 fresh sessions; ask Berlin-familiar players to inspect several cross-river and cross-locality routes; compare OPEN-only with deliberate LOCAL/PRIORITY play | Confusion, avoidable waiting, misleading geography and repeated failure causes identified |
| 2. Tune existing choices | Adjust pickup distance, deadline overlap, demand and the effect of the forecast event; keep the current control set | At least two useful dispatch styles across varied seeds; readable reasons for setbacks |
| 3. Concept and map decision | Structured fresh-player check and owner review | Proposed aids: 8/10 explain autonomy and dispatch within 60 s; 7/10 explain a choice and setback; 6/10 voluntarily retry. Owner approves Berlin before full mobile/expansion investment |
| 4. Mobile product | Portrait map/bottom sheet, saved shifts, background/process recovery, offline packs, accessibility and gesture polish | Complete shifts on real iOS/Android devices with matching actions and measured performance |
| 5. More Berlin | Author scenarios across the existing region geometry, then add connected outer areas through a new versioned pack | Geography adds new decisions while retaining the same radio interaction |
| 6. Second city | Generalize the CityPack adapter's projection metadata and build a contrasting city's sourced graph/context; keep scenario pacing separate from geography | Port requires data and scenario configuration, with no copy of the core simulation |

The map data, simulation actions and renderer are separated now. Full mobile distribution and multi-city support remain future work; the current deliverable makes their geographic foundation concrete and testable.
