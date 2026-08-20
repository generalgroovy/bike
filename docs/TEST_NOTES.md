# Send It v5 — validation notes

Current merge-candidate validation is automated through GitHub Actions with `npm test`.

The gate includes browser/controller syntax checks for the main renderer/UI modules, the Ringbahn/Berlin import and candidate-build CLIs, the candidate shadow-comparison CLI, then the complete Node test corpus.

Current green implementation suite: **121 tests / 121 pass / 0 fail**.

Coverage includes:

- deterministic RNG and same-seed reproduction,
- 900+ node / 500+ visual-edge / 110+ street Berlin scale,
- address uniqueness/integrity and graph connectivity,
- canonical Kira/Mauro/Brian/Sam/Michail/Zorro roster,
- address-to-address contracts and district-independent cargo,
- direct-assignment API absence,
- OPEN/PRIORITY/LOCAL/OFF bandwidth accounting,
- autonomous deliberation/claiming,
- radio-off breaks and recovery,
- personality niche and anti-dominance tests,
- staged territory unlocks and 6 → 30 expansion pacing,
- adaptive dispatcher reaching the full Ring under meaningful pressure,
- expansion operating doctrine choices and distinct existing-system effects,
- browser-only doctrine pause plus compact AREA-chip doctrine memory,
- cargo handling speed/fatigue differences,
- RUSH/RETURN and scheduled-window contract behavior,
- bonus/client-call/rebroadcast interventions,
- route/rain/demand event generation,
- route preparation vs client buffering,
- capacity planning vs surge pay,
- demand-surge district map feedback,
- rider task progress and ETA,
- future rider availability forecasts that cannot pre-assign work,
- read-only Dispatch Insight and qualitative channel comparison,
- attention-first queue sorting with persistent keyed cards,
- strategic Cargo Racks / Local Repeater / Event Feed / Relief Roster effects,
- causal critical timeline,
- deterministic run telemetry,
- six-rider high-load finite-state simulation,
- Send It task-rail/map/rider-dock information architecture,
- stable keyed live-DOM rules,
- visual-street unlock state consistent with routing subdivisions,
- Ringbahn polygon import/stitch validation,
- official Berlin WFS capability/feature request construction,
- exact address schema normalization,
- official street-number-first address attachment,
- canonical street-name matching,
- explicit geometric fallback diagnostics and fallback-share quality gate,
- Detailnetz from/to node topology overriding harmless coordinate drift,
- candidate graph connectivity/address coverage gates,
- shadow comparison of official candidate vs curated runtime for recognizable street overlap, route-scale distortion and import quality.

CI does **not** call Berlin WFS or OSM endpoints; geographic importer tests use local fixture data so network availability cannot make the game build flaky. Runtime remains static/offline/deterministic.

A real browser acceptance pass is still valuable because the current execution environment cannot render the feature branch in a local headless browser. Automated checks therefore cover source parsing, UI structure/read-only boundaries, deterministic simulation and data-pipeline invariants; actual rendered spacing, hover feel and human scanning speed remain manual acceptance items.
