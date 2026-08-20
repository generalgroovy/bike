# BIKE — Inside-Out Implementation Plan

This file records the implementation order and quality gates. `README.md` is the product/design specification; this document is the execution plan.

## Principle

Build from the atomic decision outward:

```text
address job
→ radio choice
→ autonomous rider choice
→ movement
→ completion/failure
→ pressure
→ roguelike variation
→ map presentation
→ polish
```

Do not add outer systems to compensate for a weak inner loop.

---

## Phase A — Core contract identity

Status: implemented in the current overhaul branch.

Acceptance criteria:

- [x] Every normal job has pickup street + number.
- [x] Every normal job has dropoff street + number.
- [x] Pickup/dropoff are graph nodes, not cosmetic labels.
- [x] Route length derives from street graph.
- [x] Deadline/reward derive from route/cargo/run modifiers.
- [x] Player cannot assign rider directly.
- [x] Radio state is explicit and bandwidth-limited.

Revision questions:

- Can a player understand a job card in under 2 seconds?
- Does every field affect a real decision?
- Can any field be removed without losing strategy?

---

## Phase B — Berlin as gameplay board

Status: implemented at gameplay-abstraction fidelity.

Current work:

- [x] Replace sparse landmark graph with dense district grids.
- [x] Add 45+ real named streets.
- [x] Preserve district relative positions.
- [x] Add arterials crossing district grids.
- [x] Keep Spree / canal / parks as orientation anchors.
- [x] Add named bridge metadata.
- [x] Separate visual road blocks from address/routing subdivision.
- [x] Add progressive street-label reveal with zoom.

Quality gate:

- map must read as a city at overview scale,
- map must become street-legible when zoomed,
- local streets must not hide jobs/riders,
- route paths must remain connected across districts.

### Precision Tier 2 — official static import

Next major geography task after gameplay tuning.

Goal:

1. Query Berlin Open Data `Detailnetz Berlin` WFS offline during development.
2. Query `Adressen Berlin` WFS for the chosen playable bounding box.
3. Normalize source coordinates to game-local coordinates.
4. Keep only bike-relevant connected streets/ways.
5. Simplify geometry with a documented tolerance.
6. Associate official address points with the nearest retained street edge.
7. Write a static generated module/data file.
8. Commit generated output so runtime stays deterministic/offline.
9. Record dataset date, source endpoint and license in generated metadata.

Acceptance gate:

- no runtime network call,
- same seed remains replayable,
- address labels in imported tier are actual source records,
- importer output can be regenerated from documented commands,
- routing graph remains manageable on GitHub Pages.

---

## Phase C — Rider autonomy

Status: implemented and retained from earlier versions.

- [x] personality preference weights,
- [x] experience levels,
- [x] deliberation delay,
- [x] decision noise,
- [x] visible likely/active consideration,
- [x] fatigue,
- [x] autonomous breaks,
- [x] radio-off state,
- [x] inability to hear/claim while radio-off.

Next tuning pass:

- measure how often each personality wins competing calls,
- ensure no personality dominates all seeds,
- ensure rookie randomness feels human rather than arbitrary,
- ensure breaks create planning pressure without frequent total team blackout.

---

## Phase D — Pacing

Status: rebuilt; needs playtest tuning after CI.

Current shape:

```text
0–2m   learn shift modifier + riders
2–6m   radio conflicts begin
6–12m  events + fatigue interact
12m+   system complexity drives collapse
```

Parameters to tune together:

- spawn interval,
- burst probability,
- deadline scale,
- reputation penalties,
- fatigue rate,
- break duration,
- radio bandwidth,
- initial job count,
- upgrade cadence.

Rule: do not tune one parameter in isolation if it simply shifts pressure somewhere else.

Instrumentation candidates:

- jobs created/minute,
- average call delay,
- average pickup distance,
- radio utilization,
- percent uncalled failures,
- percent unclaimed failures,
- percent claimed-late failures,
- rider utilization,
- simultaneous breaks,
- run duration.

---

## Phase E — Roguelike variation

Status: expanded in current overhaul.

Current variation dimensions:

- [x] seeded rider personalities/experience,
- [x] run trait,
- [x] contract profile,
- [x] job stream,
- [x] goals,
- [x] events,
- [x] upgrades.

Design restriction:

Variation should modify the same core decisions rather than add disconnected minigames.

Strong modifiers:

- more/less radio bandwidth,
- shorter/longer average trips,
- different cargo mix,
- different spawn tempo,
- different fatigue pressure,
- different street speed structure.

Weak modifiers to avoid:

- cosmetic-only numerical bonuses,
- random penalties with no forecast/counterplay,
- district stereotypes tied to cargo.

---

## Phase F — GUI clarity and charm

Status: overhauled; validate in browser after merge candidate.

### Classification system

Jobs:

- cargo glyph/color,
- ID,
- exact pickup address,
- exact dropoff address,
- deadline,
- approximate trip length,
- payout,
- current radio channel.

Riders:

- stable color,
- name,
- personality,
- experience,
- location,
- current intention/action,
- fatigue,
- radio/break state.

Map:

- jobs and riders above geography,
- selected address labels only when useful,
- routes above roads,
- disruptions above roads but below entities,
- progressive street labels.

### Anti-flicker gate

- keyed job/rider/goal DOM nodes,
- no live panel `innerHTML` reconstruction,
- stable timer widths,
- stable scroll gutter,
- no CSS blinking animation for core state,
- canvas animation separated from DOM cadence.

---

## Phase G — Performance

Status: structural optimization implemented.

- [x] cached node map,
- [x] cached edge map,
- [x] cached adjacency graph index,
- [x] A* + binary heap,
- [x] separate visual edges from routing/address edges,
- [x] fixed simulation timestep,
- [x] canvas render loop separate from DOM loop.

Next profiler gate:

- test 6 riders + 30 active jobs,
- test maximum zoom,
- test long run with repeated events/reroutes,
- ensure path scoring does not create frame hitches.

Possible future optimization only if profiling requires it:

- pickup route-cost cache keyed by rider node + job pickup + event version,
- route cache invalidated when bike lanes/events change,
- spatial index for click hit-testing.

Do not add caches before profiling shows need.

---

## Phase H — Automated revision loop

Every substantial slice follows:

```text
1. state hypothesis
2. implement smallest coherent change
3. run syntax/tests
4. run deterministic stress seeds
5. inspect failures
6. repair root cause
7. rerun full suite
8. review diff for unrelated complexity
9. update docs if invariant changed
10. merge only when green
```

### Current overhaul automated checks

The core suite is intended to cover:

- deterministic RNG,
- street density,
- address integrity,
- address uniqueness,
- graph connectivity,
- seeded reproduction,
- exact rider roster,
- address-to-address contracts,
- district-independent cargo,
- absence of direct assignment,
- radio accounting,
- radio-off behavior,
- break recovery,
- autonomous claiming,
- street goals,
- bridge goals,
- road-event cost change,
- named-street routes,
- run-contract variation,
- multi-seed long-run finite-state stress.

---

## Phase I — Manual browser acceptance

After automated tests are green, verify:

### First 30 seconds

- player sees one-sentence objective,
- player can identify pickup vs destination,
- player understands OPEN / PRIORITY / LOCAL,
- player understands they do not choose rider,
- controls overlay is discoverable.

### Map

- wheel zooms around cursor,
- drag pans without accidental selection,
- reset works,
- secondary streets appear only when useful,
- selected job address labels remain readable,
- break rider is unmistakably grey/off-radio.

### Pressure

- first minute is readable,
- radio choices become meaningful before difficulty spikes,
- no unavoidable collapse from simultaneous breaks,
- road events are forecast with enough time to react.

### Charm

- riders feel like distinct people,
- Berlin feels learnable,
- route lines make the city feel alive,
- job cards are compact but not sterile,
- state changes feel deliberate rather than noisy.

---

## Next highest-value slices after this overhaul

Ordered by expected impact:

1. **Official address/street import pipeline** for higher geographic precision.
2. **Pacing telemetry + balance pass** using deterministic seed batches.
3. **Rider personality differentiation pass** based on competing-call scenarios.
4. **Selected-job route leg summary** showing 2–4 key streets without exposing exact utility.
5. **Better street-event placement** using arterial/bridge importance.
6. **Run-history comparison** for same-seed retry learning.
7. **Additional city only after Berlin is excellent.**

The project should not add another city until Berlin's core run is consistently readable, strategically varied and fun.
