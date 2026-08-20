# BIKE — Berlin Dispatch Roguelike

BIKE is a browser strategy game about **indirectly coordinating autonomous bicycle couriers through a shared radio**.

> The dispatcher chooses what work is worth broadcasting. Riders choose the jobs themselves.

Play: `https://generalgroovy.github.io/bike/`

This README is the **authoritative design + implementation specification**. Reproducing the game should be possible from this document plus the source code and tests.

---

## 1. Product identity

BIKE should feel like a compact combination of:

- spatial logistics puzzle,
- autonomous-agent management,
- Berlin map learning,
- real-time pressure management,
- short roguelike runs.

It must **not** become:

- a direct unit-control game,
- a generic delivery tycoon,
- a GIS viewer,
- a spreadsheet optimizer,
- a deep character RPG.

The central fantasy is sitting at a courier radio desk while imperfect humans move through a city you gradually learn.

---

## 2. Non-negotiable core rule

The player never performs:

```text
rider → job
```

The player performs:

```text
job appears at an address
→ decide whether it deserves radio attention
→ choose radio channel
→ autonomous riders evaluate all live calls
→ one rider commits
→ observe outcome
→ adapt next call
```

No future feature may bypass this by adding a hidden or explicit direct-assignment button.

---

## 3. Core gameplay loop

Every few seconds a delivery contract appears:

```text
D12 · MEDICAL · 0:51 · €27
P  Oranienstraße 37
D  Kantstraße 82
3.8 km
```

The dispatcher must answer four questions:

1. **Should this job go on the radio now?**
2. **Which radio channel should carry it?**
3. **Which free rider is likely to want it?**
4. **What work should remain uncalled so the radio stays useful?**

Then the player watches what actually happens.

Successful deliveries earn score/cash/reputation and advance run goals. Missed deadlines reduce reputation. At `0 REP`, the shift ends and Dispatch Review explains the collapse.

---

## 4. Berlin is the board

The city is not decorative background. Street topology is one of the main game systems.

### Current shipped fidelity

The current static Berlin model contains:

- central/western/eastern inner-city district relationships,
- the Spree and Landwehr Canal,
- major parks,
- major landmarks,
- named bridges,
- 45+ real street names,
- hundreds of connected road segments,
- a dense grid of intersections,
- addressable service points inserted along street segments.

Examples represented in the model include:

- Kurfürstendamm
- Kantstraße
- Bismarckstraße
- Straße des 17. Juni
- Invalidenstraße
- Müllerstraße
- Torstraße
- Unter den Linden
- Friedrichstraße
- Schönhauser Allee
- Prenzlauer Allee
- Karl-Marx-Allee
- Frankfurter Allee
- Warschauer Straße
- Oranienstraße
- Skalitzer Straße
- Mehringdamm
- Kottbusser Damm
- Sonnenallee
- Karl-Marx-Straße
- Hermannstraße
- Tempelhofer Damm

### Data references

The reproducibility reference is Berlin Open Data:

- `Detailnetz Berlin - [WFS]`
  - `https://daten.berlin.de/datensaetze/detailnetz-berlin-wfs-4f2045ef`
  - detailed Berlin traffic street network, nodes, street sections, bridges/tunnels
- `Adressen Berlin - [WFS]`
  - `https://daten.berlin.de/datensaetze/adressen-berlin-wfs-634ab8ba`
  - official Berlin address points with coordinates, street, house number and postcode
- license: Datenlizenz Deutschland – Zero – Version 2.0

### Fidelity rule

The runtime game must never depend on a map provider, API key, commercial tiles, or live internet request.

The shipped city is therefore a **deterministic gameplay abstraction**, generated from curated real street structure.

Current house numbers are deterministic, street-consistent gameplay numbers. They are **not claimed to be an authoritative copy of every current Berlin parcel**.

The next precision tier is an offline build/import step that samples the official address WFS and commits a normalized static address subset. See `IMPLEMENTATION_PLAN.md`.

---

## 5. Dense street generation

`src/berlin.js` builds the static game graph in stages.

### 5.1 District grids

Each district defines real named horizontal/vertical street families at approximate relative positions.

Conceptually:

```text
Kantstraße ─────┬─────┬─────┬─────
                │     │     │
Hardenbergstr. ─┼─────┼─────┼─────
                │     │     │
Kurfürstendamm ─┼─────┼─────┼─────
                │     │     │
              Leibniz  Fasanen ...
```

This produces a much more realistic gridlike road network than the original sparse landmark graph.

### 5.2 Cross-district arterials

Important long corridors connect district grids and preserve Berlin's recognizable macro-layout.

### 5.3 Bridges

Named bridge segments receive `bridgeId` metadata, currently including:

- Moltkebrücke
- Jannowitzbrücke
- Oberbaumbrücke

This lets routes, objectives and disruptions reason about actual crossings.

### 5.4 Address subdivision

Every base road block is subdivided with address nodes:

```text
intersection A
   │
   ├── Street 17
   │
   ├── Street 18
   │
intersection B
```

Delivery endpoints are selected **only from address nodes**, never generic district nodes.

The visible road remains one clean block while routing can stop at either address.

---

## 6. Address contract model

Every generated delivery stores stable explicit fields:

```js
{
  id,
  type,
  pickupId,
  dropoffId,
  pickupAddress,
  dropoffAddress,
  pickupPostcode,
  dropoffPostcode,
  pickupDistrict,
  dropoffDistrict,
  plannedDistance,
  plannedStreets,
  deadlineAt,
  reward,
  status,
  channel,
  courierId
}
```

A job is therefore understandable without knowing internal graph IDs.

Good UI:

```text
P  Oranienstraße 37
D  Kantstraße 82
```

Bad UI:

```text
local-kreuzberg-2 → node-46
```

---

## 7. Cargo classes

Cargo category is independent of district identity.

| Glyph | Type | Gameplay character |
|---|---|---|
| ▲ | Food | frequent, relatively short window |
| ● | Parcel | common, forgiving |
| ■ | Documents | medium urgency / better pay |
| ✚ | Medical | uncommon, urgent, high penalty/reward |
| ⬢ | Grocery | forgiving, steady |
| ◆ | Fragile | valuable, moderately urgent |

Kreuzberg is not a “food district”; Mitte is not a “documents district”. Geography matters because of travel, not stereotypes.

---

## 8. Radio system

Radio bandwidth is the player's central resource.

### OPEN

- cost: `1`
- neutral broadcast
- every listening rider considers it normally

### PRIORITY

- cost: `2`
- adds a strong attraction bonus
- still not an order

### LOCAL

- cost: `1`
- favors riders already near/in the pickup area
- distant riders receive a penalty

### OFF

- removes the job from the choice set
- frees radio bandwidth

The player should regularly choose to leave some jobs uncalled.

If broadcasting everything is optimal, the design is broken.

---

## 9. Rider model

Canonical roster order:

1. Kira
2. Mauro
3. Brian
4. Sam
5. Michail
6. Zorro

The shift starts with the first three. Extra Rider upgrades add the next name in order.

### Personality

A personality changes job utility weights.

- Sprinter — close + urgent work
- Earner — payout
- Guardian — urgent/medical work
- Local — close/familiar pickups
- Tourer — longer city runs
- Steady — balanced

### Experience

Experience changes speed, decision delay, decision noise and fatigue efficiency.

```text
Rookie
Regular
Experienced
Veteran
```

Higher experience should feel more predictable, not simply numerically stronger.

---

## 10. Rider decision model

A free listening rider scores live radio calls using:

- route cost to pickup,
- deadline pressure,
- payout,
- cargo type,
- same-district position,
- trip length,
- personality weights,
- radio channel,
- fatigue,
- experience-dependent decision noise.

The exact scalar score is intentionally hidden from the player.

Expose qualitative reasoning instead:

```text
Kira
Sprinter · Experienced
Considering D12 · 68%
close pickup
```

The player should develop intuition about people rather than solve visible equations.

---

## 11. Rider state machine

```text
LISTENING
   │
   ├── hears calls
   ▼
THINKING
   │
   ├── deliberation completes
   ▼
TO PICKUP
   ▼
TO DROPOFF
   ▼
DELIVERED
   │
   ├── fatigue low → LISTENING
   └── fatigue high → BREAK
                         │
                         ▼
                    RADIO OFF
                         │
                         ▼
                    LISTENING
```

### Break rule

Riders take breaks autonomously.

While on break:

- rider is grey on map,
- rider card is grey,
- marker shows `Ⅱ`,
- status says `BREAK`,
- radio is off,
- countdown shows return time,
- rider cannot deliberate or claim work.

The dispatcher cannot cancel a break.

This preserves the same core principle: **influence people; do not command them**.

---

## 12. Routing

The dense city uses a cached graph index plus A* routing.

`src/graph.js` provides:

```text
createGraphIndex()
shortestPathIndexed()
```

The heuristic is based on straight-line distance and remains conservative relative to supported speed multipliers.

Routing cost currently includes:

```text
segment distance
÷ street speed multiplier
÷ bike-lane multiplier
÷ temporary event multiplier
```

The graph index is built once per shift instead of reconstructing adjacency for every rider evaluation.

This is important because the address-first graph contains hundreds of nodes.

---

## 13. Dynamic disruptions

A shift periodically forecasts a road event before activation.

Current types:

- roadworks,
- demonstrations,
- bridge squeeze.

Lifecycle:

```text
forecast
→ orange dashed affected street
→ event activates
→ red street
→ routing cost increases
→ riders reroute at intersections
→ event clears
```

The forecast is crucial: disruption should create a decision, not an unavoidable punishment.

---

## 14. Roguelike run generation

A run is controlled by its seed.

Same seed must reproduce:

- run trait,
- contract profile,
- initial rider personalities/experience,
- initial jobs,
- goals,
- event RNG sequence,
- upgrade choice sequence.

### Run traits

Examples:

- Express Berlin
- Green Wave
- Rain Shift
- Tight Radio
- Berlin Rush
- Fresh Team

### Contract profiles

Examples:

- Mixed Desk
- Short-Hop Day
- Cross-Town
- High Stakes

Traits modify environment/team pressure. Contract profiles modify trip length, cargo weights, payout and spawn tempo.

This creates combinatorial variation without adding dozens of unrelated systems.

---

## 15. Goals

Goals make the current run ask the player to use different parts of Berlin.

Current goal families:

- work a specific real street,
- cover a district,
- cross a named bridge,
- complete a reliability target.

Goal logic responds to actual completed endpoints/routes rather than cargo-generation tables.

---

## 16. Upgrade philosophy

Upgrades should change dispatch decisions, team capacity or city movement.

Current examples:

- Radio Bandwidth
- Extra Rider
- Team Briefing
- Street Legs
- Client Buffer
- Bike-Lane Grant
- Team Coffee
- Local Goodwill

Avoid upgrades that merely add tiny percentage bonuses with no visible strategic consequence.

---

## 17. Visual design system

The visual direction is **warm minimal cartography**, not neon dashboard UI.

Priority order:

1. riders,
2. urgent/live jobs,
3. accepted routes,
4. pickup/dropoff addresses,
5. disruptions,
6. arterial streets,
7. local streets,
8. landmarks,
9. district shading.

### Job classification

Each cargo has both glyph and color.

Radio state is independent from cargo color:

```text
grey border    off radio
blue           OPEN
gold           PRIORITY
green          LOCAL
```

Urgency uses an outer deadline ring and red warning state.

### Rider classification

```text
triangle + unique color = rider identity
number inside = experience
white progress ring = thinking
dashed rider-color line = committed route
grey + Ⅱ = break / radio off
```

Never rely on color alone for essential state.

---

## 18. Zoom and map interaction

Controls:

```text
mouse wheel    zoom around cursor
drag           pan
+ / -          zoom
1:1            reset map
0              reset map
```

Zoom range is approximately `0.78× – 5.5×` relative to fit-to-screen.

Progressive disclosure:

- overview: arterials + core entities,
- medium: primary streets + more labels,
- close: secondary streets + exact selected address labels.

Dense geography must not make overview play unreadable.

---

## 19. GUI architecture and anti-flicker rule

The game renders at two independent cadences.

### Canvas

`requestAnimationFrame`

Used for:

- map,
- rider movement,
- routes,
- job markers,
- deadline rings,
- disruptions.

### DOM projection

~7 updates/second.

Used for:

- jobs,
- riders,
- goals,
- metrics.

**Important:** job/rider/goal elements are keyed persistent DOM nodes.

Do not rebuild live panels with repeated `innerHTML = ...`.

Update text/classes/styles in place so:

- hover does not disappear,
- focus does not reset,
- scroll position is stable,
- text does not flicker,
- layout changes only when game state actually changes.

Timers use tabular numerals and fixed-width columns to avoid horizontal jitter.

---

## 20. Interface structure

Desktop:

```text
┌────────────────────────────────────────────────────┐
│ brand / shift modifiers / REP SCORE CASH / actions │
├────────────────────────────────────────────────────┤
│         one-sentence core rule                     │
├──────────────┬───────────────────┬─────────────────┤
│ DISPATCH     │                   │ RIDERS          │
│ job cards    │    BERLIN MAP     │ rider cards     │
│ radio choice │                   │ fatigue/status  │
│ addresses    │                   │                 │
│              │                   │ SHIFT GOALS     │
└──────────────┴───────────────────┴─────────────────┘
```

The player must be able to answer at a glance:

- What needs attention?
- What is currently on radio?
- Who can hear it?
- Who is busy?
- Who is on break?
- Where are pickup and destination?
- How urgent is it?

---

## 21. Controls overview

`CONTROLS`, `H`, or `?` opens a toggleable reference panel.

It explains:

1. job anatomy,
2. radio channels,
3. autonomous rider choice,
4. rider states,
5. Berlin map interaction,
6. failure/run loop.

First launch opens it automatically with the simulation paused.

---

## 22. Difficulty and pacing

Difficulty should emerge mainly from **coordination complexity**.

Primary pressure sources:

- more simultaneous contracts,
- wider spatial distribution,
- rider fatigue/break overlap,
- road events,
- limited radio bandwidth,
- imperfect rider preferences.

Avoid simply shrinking every timer each wave.

Current pacing uses:

- slower early spawn interval,
- gradual wave compression,
- limited burst chance only in later waves,
- contract-profile spawn multiplier,
- moderate failure penalties so a run can recover.

Target run shape:

```text
0–2 min   understand current riders + nearby streets
2–6 min   meaningful radio conflicts begin
6–12 min  breaks/events/long jobs interact
12+ min   network complexity becomes the main threat
```

---

## 23. Post-run learning

Dispatch Review classifies misses into:

- never called,
- called but nobody accepted,
- accepted but late,
- radio changes blocked by bandwidth.

It also reports break pressure and top rider.

The ideal retry loop is:

```text
lose
→ understand the failure
→ retry same seed
→ change radio strategy
→ compare outcome
```

---

## 24. Architecture

```text
index.html
styles.css
src/
  rng.js
  graph.js
  berlin.js

  game-data.js
  game-core.js
  game-radio.js
  game-riders.js
  game-events.js
  game.js

  camera.js
  render-map.js
  render-entities.js
  render.js
  main.js

tests/
  core.test.js

IMPLEMENTATION_PLAN.md
README.md
```

### Responsibility boundaries

`berlin.js`
: static/deterministic city construction and addresses.

`graph.js`
: graph index + pathfinding only.

`game-core.js`
: run state, route helpers, address contracts, core resources.

`game-radio.js`
: indirect-control choice model.

`game-riders.js`
: movement, completion, fatigue, breaks, update loop.

`game-events.js`
: street events, goals, upgrades, review.

`camera.js`
: view transform only.

`render-map.js`
: geographic layers.

`render-entities.js`
: jobs/riders/routes.

`main.js`
: fixed-step host, stable DOM projection and input wiring.

---

## 25. Determinism rules

Simulation RNG must come from the seeded `RNG` instance.

Do not use `Math.random()` for gameplay state.

Allowed non-deterministic visual-only values:

- `performance.now()` for harmless canvas animation.

Same seed replay must not depend on frame rate because simulation advances through a fixed timestep.

---

## 26. Performance rules

The dense graph makes several optimizations non-optional:

- build node maps once,
- build adjacency once,
- use A* / heap instead of linear open-set Dijkstra,
- keep graph edges separate from clean visual street blocks,
- avoid rebuilding DOM lists,
- decouple simulation, canvas and UI rates,
- cap active contracts,
- reroute only when state requires it.

Target desktop behavior:

- smooth canvas movement at 60 FPS,
- hundreds of graph/address nodes,
- 6 riders,
- 20+ visible contracts,
- no UI hover/focus flicker.

---

## 27. Tests / acceptance gate

Run:

```bash
npm test
```

The suite must cover at minimum:

- deterministic RNG,
- dense Berlin street count,
- address integrity,
- address uniqueness,
- graph connectivity,
- deterministic seeded runs,
- exact six-name roster,
- address-to-address contracts,
- district-independent cargo,
- absence of direct assignment,
- radio bandwidth,
- radio-off exclusion,
- break/recovery,
- autonomous deliberation/claiming,
- real-street goal progression,
- actual bridge traversal goals,
- road-event cost changes,
- named-street routing,
- roguelike contract variation,
- multi-seed long-run finite-state stress.

No feature is considered merged until both local reasoning/tests and GitHub Actions pass.

---

## 28. Local development

No runtime dependencies and no build step.

```bash
npm test
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

GitHub Pages serves the same static files.

---

## 29. Reproducibility invariants

A clean-room implementation is BIKE-compatible only if all are true:

1. Player cannot directly assign riders.
2. Every normal contract has a street + house-number pickup and dropoff.
3. Berlin remains spatially recognizable.
4. Cargo type is not tied to district stereotype.
5. Radio bandwidth forces curation.
6. Riders have autonomous personality/experience behavior.
7. Riders can become unavailable through breaks/radio-off state.
8. Same seed reproduces the shift setup.
9. Failure is explainable after the run.
10. Important states use shape/text plus color.
11. Dense map detail progressively reveals with zoom.
12. Live DOM panels are stable rather than continuously reconstructed.

---

## 30. Design test before every new feature

Ask:

> Does this make choosing what goes on the radio more interesting?

If no, it probably does not belong in the core game yet.

Second question:

> Can the player understand the new state visually in under two seconds?

If no, redesign the visualization before increasing system depth.

The intended mastery curve is:

```text
understand a job
→ understand one rider
→ understand the radio
→ understand nearby streets
→ predict several riders
→ anticipate breaks/events
→ learn Berlin's network
→ shape a run through upgrades
→ coordinate the whole autonomous system
```
