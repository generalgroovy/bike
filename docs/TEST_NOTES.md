# Send It v5 — validation notes

Current merge candidate validation is automated through GitHub Actions with:

```text
npm test
= node --check src/main.js
+ node --check src/render-map.js
+ node --check src/render-entities.js
+ node --test
```

Current green suite: **35 tests / 35 pass / 0 fail**.

Coverage includes:

- deterministic RNG and same-seed reproduction,
- 900+ node / 500+ visual-edge / 110+ street Berlin scale,
- address uniqueness/integrity,
- full graph connectivity,
- canonical Kira/Mauro/Brian/Sam/Michail/Zorro order,
- address-to-address contracts,
- district-independent cargo generation,
- direct-assignment API absence,
- OPEN/PRIORITY/LOCAL bandwidth accounting,
- radio-off riders unable to accept work,
- fatigue/break recovery,
- autonomous deliberation/claiming,
- street and bridge goals,
- route/event cost changes,
- named-street route generation,
- run-contract variation,
- multi-seed stress,
- two-minute opening survival floor,
- natural Center → Inner City progression under adaptive dispatch,
- six-rider high-load finite-state simulation,
- Send It task-rail/map/rider-dock information architecture,
- stable keyed live-DOM rules,
- canonical Ringbahn anchors,
- staged territory unlocks,
- level-gated cargo,
- RETURN follow-up generation,
- bonus/client-call/rebroadcast interventions,
- proactive detour advisory,
- finite/advancing rider task progress and ETA,
- visual-street unlock state consistent with every subdivided routing segment.

A browser-level manual acceptance pass is still valuable after merge/deployment because the current execution environment cannot fetch the feature branch into a local headless browser. The automated suite therefore treats DOM structure, browser JS parsing and simulation invariants as the pre-merge gate.
