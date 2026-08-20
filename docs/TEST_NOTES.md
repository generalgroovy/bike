# Send It v5 — validation notes

Current merge-candidate validation is automated through GitHub Actions with:

```text
npm test
= node --check src/main.js
+ node --check src/render-map.js
+ node --check src/render-entities.js
+ node --check src/ui-outlook.js
+ node --check src/ui-telemetry.js
+ node --check tools/import-berlin.mjs
+ node --test
```

Current green implementation suite before the final documentation-only reconciliation: **71 tests / 71 pass / 0 fail**.

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
- cargo handling speed/fatigue differences,
- RUSH/RETURN contract behavior,
- bonus/client-call/rebroadcast interventions,
- route/rain/demand event generation and counterplay,
- demand-surge district map feedback,
- rider task progress and ETA,
- future rider availability forecasts that cannot pre-assign work,
- strategic Cargo Racks / Local Repeater / Event Feed / Relief Roster effects,
- causal critical timeline,
- deterministic run telemetry,
- six-rider high-load finite-state simulation,
- Send It task-rail/map/rider-dock information architecture,
- stable keyed live-DOM rules,
- browser-source syntax checks,
- visual-street unlock state consistent with routing subdivisions,
- official Berlin WFS importer URL construction, feature discovery, geometry simplification, projection, address normalization and deterministic output sorting.

CI does **not** call Berlin WFS endpoints; importer tests use local fixture data so network availability cannot make the game build flaky.

A browser-level manual acceptance pass is still valuable because the current execution environment cannot render the feature branch in a local headless browser. The automated suite therefore treats browser JS parsing, DOM architecture and simulation invariants as the pre-merge gate.
