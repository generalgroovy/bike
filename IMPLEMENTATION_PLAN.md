# SEND IT — Inside-Out Implementation Plan

`README.md` defines the product. This file defines the order in which the simulation should be changed and the gates every major iteration must clear.

## Principle

Build from the smallest meaningful decision outward:

```text
contract
→ radio / intervention choice
→ autonomous rider choice
→ movement through Berlin
→ delivery result
→ rider energy / position consequences
→ city pressure
→ progression / roguelike variation
→ presentation / polish
```

Do not use outer features to hide a weak inner loop.

---

## V5 objective

The Send It v5 slice is complete only when all of the following are true:

- [x] product renamed to Send It in player-facing UI/spec,
- [x] contract queue is a compact horizontal top rail,
- [x] map is the dominant surface,
- [x] rider cards expose task progress, ETA and energy,
- [x] explanations are moved from permanent panels to hover/help,
- [x] contract hover previews route on map,
- [x] rider hover highlights that rider's route/state,
- [x] selected contract has contextual decision tools,
- [x] player can respond using money, time, attention, radio or routing,
- [x] operating region expands during the run,
- [x] final geography covers the intended inner-Berlin/Ringbahn play area,
- [x] new cargo classes unlock with progression,
- [x] special contracts modify the existing logistics loop,
- [x] automated structural + behavioral gates cover the new invariants.

---

## Phase A — Atomic dispatch contract

Acceptance:

- street + number pickup,
- street + number destination,
- deadline,
- payout,
- cargo glyph,
- graph-derived route distance,
- graph-derived street sequence,
- no direct rider assignment.

Revision question:

> Can the dispatcher understand whether this deserves airtime in under two seconds?

If not, simplify card content before adding anything else.

---

## Phase B — Decision vocabulary

The game should support multiple realistic responses to the same problem.

Current actions:

1. OFF — intentionally withhold work,
2. OPEN — neutral broadcast,
3. PRIORITY — spend extra radio bandwidth,
4. LOCAL — bias toward nearby riders,
5. add bonus — spend cash to change incentives,
6. client call — spend focus to buy time,
7. rebroadcast — spend focus to regain attention,
8. detour advisory — spend focus to influence route selection around forecast/active disruption.

Quality gate:

- every action must modify simulation state,
- no action may select a rider directly,
- different resources must create different tradeoffs,
- no intervention should become universally dominant.

Next balancing telemetry:

- intervention frequency,
- intervention success rate,
- average focus held,
- average cash spent on bonuses,
- failures with unused focus,
- failures after client extension,
- jobs rescued by rebroadcast,
- distance/event exposure saved by advisory.

---

## Phase C — Rider instrument panel

Visible per rider:

- identity/color,
- personality shorthand,
- experience,
- location,
- state,
- active contract/phase,
- completion meter,
- ETA,
- energy.

Hover-only:

- personality description,
- fuller location/context,
- likely call while idle,
- break return time,
- current job detail.

Quality gate:

> A player should be able to choose whether to expose a new job by scanning the rider dock without opening another panel.

---

## Phase D — UI hierarchy

Normal-play layout:

```text
┌───────────────────────────────────────────────────────────────┐
│ SEND IT | shift | city progress | REP € SCORE FOCUS | HELP  │
├───────────────────────────────────────────────────────────────┤
│ horizontal contract rail → → → → → → → →                    │
├───────────────────────────────────────────────┬───────────────┤
│                                               │ rider cards   │
│                  BERLIN MAP                   │               │
│                                               │ goals drawer  │
│ selected-contract inspector                   │               │
└───────────────────────────────────────────────┴───────────────┘
```

Information-on-demand rule:

- permanent = live decision variable,
- hover = occasional explanation/context,
- inspector = selected-object decisions,
- help = rules/reference,
- post-shift = diagnosis/history.

Anti-flicker gate:

- persistent keyed task nodes,
- persistent keyed rider nodes,
- persistent keyed goal nodes,
- stable task ordering,
- no full live-list replacement,
- canvas animation independent from DOM cadence.

---

## Phase E — Berlin progression

### Stage 1 — Center Desk

Threshold: 0 completed.

Purpose:

- learn radio,
- learn rider personalities,
- learn address jobs,
- keep geography compact.

### Stage 2 — Inner City

Threshold: 6 completed.

Adds:

- west/east operating areas,
- larger camera bounds,
- +1 radio bandwidth,
- +1 focus capacity,
- bridge objective,
- stage-2 cargo,
- RUSH specials.

### Stage 3 — Inside the Ring

Threshold: 16 completed.

Adds:

- remaining inner-city areas,
- full Ringbahn-oriented map extent,
- Ring station labels,
- +1 radio bandwidth,
- +1 focus capacity,
- cross-area objective,
- stage-3 cargo,
- RETURN specials.

Quality gate:

- expansion must increase spatial choices rather than only spawn count,
- camera transition must reveal more city rather than teleport gameplay,
- early run must remain readable,
- newly unlocked cargo must use existing dispatch logic.

---

## Phase F — Berlin precision

Current tier: hand-compressed gameplay map using real street names and broad relative topology.

Current automated floors:

- 900+ nodes,
- 600+ address nodes,
- 500+ visual edges,
- 110+ street names,
- 27+ Ringbahn station anchors,
- graph connected.

### Next precision tier — official static import

Build-time workflow:

1. fetch official Berlin `Detailnetz Berlin` WFS,
2. fetch `Adressen Berlin` WFS,
3. define Ringbahn-interior playable polygon/bounding region,
4. normalize source CRS to build coordinates,
5. retain bike-relevant connected street geometry,
6. simplify polylines with documented tolerance,
7. associate official address points with retained graph edges,
8. retain strategic water/parks/landmarks separately,
9. emit static generated module/JSON,
10. record source date/license/import script version,
11. commit generated output,
12. keep runtime network-free.

Acceptance:

- source records reproducible,
- official address labels are not procedurally invented in imported tier,
- graph remains performant on GitHub Pages,
- same game seed remains deterministic,
- map still reads as a game rather than a GIS dump.

---

## Phase G — Progression/cargo variation

Current unlock classes:

Stage 1:
- Food
- Parcel
- Docs
- Grocery

Stage 2:
- Fragile
- Flowers
- Keys
- Medical

Stage 3:
- Catering
- Cold-chain

Specials:
- RUSH
- RETURN

Design restriction:

> A new delivery type should create a different dispatch decision through urgency, value, geography, rider preference or follow-up consequences. Do not add types that are only new colors/names.

---

## Phase H — Events

Current event lifecycle:

```text
forecast
→ optional pre-emptive advisory
→ active slowdown
→ rider re-routing
→ clear
```

Next event candidates must stay realistic and legible, for example:

- large event venue release,
- severe rain cell crossing part of city,
- bridge closure rather than generic slowdown,
- transit outage that increases courier demand in an area,
- temporary client cluster/event catering wave.

Events need:

- forecast,
- location,
- clear effect,
- at least two possible counterplays,
- deterministic seed behavior.

---

## Phase I — Automated revision loop

For every substantial slice:

```text
1. state hypothesis
2. implement smallest coherent change
3. syntax check browser entry/render sources
4. run unit/invariant tests
5. run deterministic behavior simulations
6. inspect first failure
7. fix root cause
8. rerun full suite
9. review diff for unnecessary complexity
10. update README if an invariant changed
11. merge only when green
```

Current v5 gates include:

- Ringbahn anchors,
- street/address density,
- connectivity,
- seeded reproduction,
- initial-area gating,
- expansion at 6/16 jobs,
- full-ring district exposure,
- cargo unlock gating,
- RETURN follow-up,
- bonus/client-call/rebroadcast behavior,
- proactive detour advisory,
- rider progress/ETA,
- 2-minute opening survival floor,
- six-rider high-load simulation,
- existing autonomy/radio/break/event tests.

---

## Phase J — Manual browser acceptance

After automated green:

### 30-second comprehension

A new player should identify without reading README:

- contracts live across top,
- addresses and deadline,
- radio buttons,
- current riders,
- task and energy bars,
- reputation loss condition,
- help access.

### Interaction

Verify:

- contract hover previews route,
- rider hover highlights route,
- tool hover explains cost/effect,
- selecting a job pins inspector,
- inspector buttons visibly disable when unavailable,
- horizontal task rail does not jump/reorder,
- wheel zoom centers on pointer,
- FIT targets current unlocked territory,
- expansion visibly zooms out,
- help drawer pauses and restores previous pause state.

### Visual charm

Verify:

- streets read as a map before labels become dense,
- rider colors are persistent and recognizable,
- special jobs are distinctive without flashing,
- Ringbahn is an orientation frame, not visual noise,
- locked geography creates curiosity without distracting from active territory.

---

## Highest-value next slices after v5

1. Official Berlin street/address import pipeline.
2. Browser playtest + pacing telemetry across 100 deterministic seeds.
3. Personality balance scenarios with competing calls.
4. More nuanced event counterplay.
5. Better post-shift timeline showing the exact collapse sequence.
6. Persistent lightweight progression only if it preserves short self-contained runs.
7. No second city until Berlin is consistently fun and legible.
