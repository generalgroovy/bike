# SEND IT — Inside-Out Implementation Plan

`README.md` is the authoritative product/design specification. This file records implementation order, completed slices and the next gates.

## Principle

Build outward from one meaningful dispatch decision:

```text
contract
→ radio / intervention choice
→ autonomous rider choice
→ movement through Berlin
→ delivery result
→ rider energy / future availability
→ city pressure / events
→ progression / roguelike variation
→ review / telemetry
→ visual polish
```

Do not add outer systems to hide a weak inner loop.

---

## V5 invariant

The player controls **information and operating resources**, never a rider directly.

There must be no direct:

```text
rider → job
```

The player can instead change:

- whether a job is audible,
- radio channel strength/locality,
- payout,
- negotiated deadline,
- attention through rebroadcast,
- event preparation/routing information,
- longer-term desk capability through upgrades.

Tests explicitly guard against direct assignment and pre-assignment through future rider forecasting.

---

## Phase A — Contract readability

Status: implemented and tested.

Every contract exposes:

- street + house number pickup,
- street + house number destination,
- deadline,
- payout,
- cargo identity,
- graph-derived distance,
- graph-derived street sequence,
- radio state,
- optional RUSH / RETURN / event tag.

Normal-play cards stay compact; route detail, handling effects and likely riders are disclosed on hover/inspection.

Quality question:

> Can the dispatcher decide whether this deserves airtime in roughly two seconds?

---

## Phase B — Decision vocabulary

Status: implemented and tested.

Core radio:

1. OFF — withhold work,
2. OPEN — neutral call,
3. PRIORITY — stronger call for 2 bandwidth,
4. LOCAL — favor nearby/same-area riders.

Contextual tools:

5. +€ Bonus — money changes incentives,
6. Client Call — focus buys time,
7. Rebroadcast — focus refreshes attention,
8. Event Response — focus pre-briefs/detours routes or buffers/staggers demand surges.

Quality gates:

- every action mutates real simulation state,
- no action selects a rider,
- money/time/attention/routing solve different problems,
- no action is universally dominant.

---

## Phase C — Riders as autonomous operating capacity

Status: implemented and balance-tested.

Roster order:

```text
Kira → Mauro → Brian → Sam → Michail → Zorro
```

Rider state includes:

- personality,
- experience,
- street/location,
- deliberation,
- active task/phase,
- task progress,
- ETA,
- fatigue/energy,
- autonomous break / radio-off state.

Personality niches:

- Sprinter — close + urgent,
- Earner — unusually profitable,
- Guardian — critical/medical,
- Local — same-area/nearby,
- Tourer — long city runs,
- Steady — balanced generalist.

Automated gates reject a generic job stream dominated overwhelmingly by one archetype.

### Future availability

Implemented:

- selected contract can show riders available **NOW**,
- busy/break riders can be shown as future availability estimates,
- busy/break riders remain unable to claim work early,
- no reservation or pre-assignment is introduced.

This creates a real dispatch choice between broadcasting now, waiting, buying time or changing incentive.

---

## Phase D — Cargo semantics

Status: implemented and tested.

Cargo is not merely icon/deadline variation. Loaded movement affects speed and fatigue.

Examples:

- documents/keys: light,
- grocery: heavy,
- flowers/fragile: careful slower handling,
- catering: strongest load/fatigue penalty,
- cold-chain: moderate protected-load penalty,
- medical: critical but light.

Cargo Racks can reduce load penalties without erasing cargo identity.

---

## Phase E — Berlin progression

### Stage 1 — Center Desk

Threshold: **0 completed**.

Purpose:

- learn radio,
- learn riders,
- learn address contracts,
- keep geography compact.

### Stage 2 — Inner City

Threshold: **6 completed**.

Adds:

- west/east operating corridors,
- larger camera bounds,
- radio/focus capacity,
- bridge objective,
- stage-2 cargo,
- special contracts.

### Stage 3 — Inside the Ring

Threshold: **30 completed**.

Adds:

- remaining Ringbahn-interior operating areas,
- full Ring-oriented extent,
- Ring station labels,
- additional radio/focus capacity,
- cross-area objective,
- stage-3 cargo.

The previous 16-delivery threshold was removed after automated pacing showed a competent dispatcher could reveal the entire city in roughly two minutes. The 30-delivery threshold makes full Ring operation a mid-run transition.

Automated pacing gates require:

- readable two-minute opening,
- natural first expansion,
- competent full-Ring reachability,
- nontrivial queue pressure,
- survival under six-rider/high-job load.

---

## Phase F — City events and counterplay

Status: implemented and tested.

Route events:

- roadworks,
- demonstration,
- bridge squeeze,
- heavy rain cell.

Demand events:

- venue release,
- transit outage.

Every event must have:

```text
forecast
→ spatial cue
→ pressure
→ meaningful response
→ clear end
```

Route counterplay:

- PRE-BRIEF before activation,
- DETOUR while active.

Demand counterplay:

- CAPACITY PLAN before activation,
- STAGGER CLIENTS while active.

Demand events visibly mark the affected operating area on the map.

---

## Phase G — Strategic roguelike upgrades

Status: expanded and tested.

Baseline upgrades remain tied to existing systems: riders, radio, deadlines, speed, bike corridors, fatigue, focus and reputation.

Strategic upgrades now include:

- **Cargo Racks** — reduce heavy/delicate load penalties,
- **Local Repeater** — strengthen same-area LOCAL attraction,
- **Event Feed** — earlier event forecasts,
- **Relief Roster** — shorter future autonomous breaks.

Rule:

> An upgrade should create an operating style, not just inflate a score number.

---

## Phase H — GUI hierarchy

Status: implemented; live-browser acceptance remains.

Normal play:

```text
compact command bar
horizontal task rail → → →
large Berlin map        | rider dock
selected-job inspector  | goals
```

Information placement:

- permanent = current decision variable,
- hover = occasional explanation/context,
- inspector = selected-contract actions,
- help = rules/reference,
- post-shift = diagnosis/history.

Anti-flicker gates:

- persistent keyed contract nodes,
- persistent keyed rider nodes,
- persistent keyed goal nodes,
- stable contract ordering,
- no full live-list rebuild,
- canvas animation independent from DOM update cadence.

---

## Phase I — Post-shift learning and telemetry

Status: implemented and tested.

Critical Timeline retains causal events rather than raw chatter:

- expansion,
- event forecast/start/response,
- demand burst,
- rider break/return,
- radio blocked,
- intervention,
- failure,
- collapse.

Run telemetry derives deterministic comparable measures:

- delivered/minute,
- average call delay,
- average acceptance delay,
- average delivery time,
- peak queue,
- peak radio,
- event preparations,
- expansion timing,
- failure mix.

This is the basis for future human-run balance work.

---

## Phase J — Berlin precision

### Current runtime tier

Hand-compressed gameplay map using real street names and broad recognizable topology.

Automated floors:

- 900+ graph nodes,
- 600+ address nodes,
- 500+ visual road blocks,
- 110+ street names,
- 27+ Ringbahn anchors,
- connected routing graph.

### Official-data importer foundation

Status: implemented and tested, **not yet runtime authority**.

`tools/import-berlin.mjs` + `tools/berlin-import-lib.mjs` currently provide:

- Detailnetz Berlin WFS endpoint,
- Adressen Berlin WFS endpoint,
- WFS capabilities discovery,
- GeoJSON GetFeature request construction,
- configurable bbox,
- deterministic line simplification,
- projection into game coordinates,
- address normalization,
- stable sorting,
- static JSON output metadata.

CI uses local fixture data; it never depends on Berlin's network services.

### Next precision slice

1. replace rough bbox with documented S41/S42 interior polygon,
2. pin exact official source schemas,
3. join address points to retained street geometry,
4. construct connected bike-usable topology,
5. preserve intersection/bridge semantics during simplification,
6. emit compact static generated data,
7. compare imported and curated readability,
8. switch authority only when the imported candidate clears all gameplay gates.

Runtime must remain offline and deterministic.

---

## Current automated gate

Current green implementation gate before documentation-only reconciliation:

```text
71 tests
71 pass
0 fail
```

Plus syntax checks for browser entry/render modules, Rider Outlook/telemetry UI and the Berlin importer CLI.

See `docs/TEST_NOTES.md` for coverage.

---

## Next executable work

1. integrate imported official data into a **candidate** Ring polygon/topology build,
2. run real browser acceptance at multiple desktop aspect ratios,
3. collect human-run telemetry and tune pacing/personality/intervention economics,
4. add restrained motion/audio feedback only where it improves state recognition,
5. deepen contract chains only when they preserve the same indirect radio loop,
6. keep Berlin as the benchmark; do not add a second city yet.
