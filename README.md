# SEND IT — Berlin Courier Dispatch Roguelike

**Send It** is a browser-based real-time logistics simulation about coordinating autonomous bicycle couriers through a shared dispatch radio.

> **You control information, not riders.**

Play: `https://generalgroovy.github.io/bike/`

This README is the authoritative product, gameplay, UI, map, simulation and reproducibility specification. `IMPLEMENTATION_PLAN.md` records the iteration/validation process.

---

## 1. Product identity

Send It should feel like a compact combination of:

- a spatial logistics puzzle,
- an autonomous-agent simulation,
- a learnable Berlin street map,
- a real-time dispatch desk,
- a short deterministic roguelike run.

It must not become:

- a direct unit-control game,
- a generic clicker/tycoon,
- a GIS viewer,
- a spreadsheet optimizer,
- an ability-bar game detached from logistics.

The fantasy is simple: **a courier desk, imperfect human riders, a changing Berlin workload, and too little attention to solve everything perfectly.**

---

## 2. Non-negotiable gameplay invariant

The player never performs:

```text
rider → assign → job
```

The player shapes a choice environment:

```text
address contract appears
→ decide whether it deserves airtime
→ choose OFF / OPEN / PRIORITY / LOCAL
→ optionally change time / money / attention / routing conditions
→ autonomous riders evaluate live calls
→ one rider commits
→ observe route, energy, events and result
→ adapt the next choice set
```

No future feature should bypass this with an explicit or hidden direct-assignment command.

---

## 3. The atomic decision loop

A normal contract contains:

```text
D12   ✚ MEDICAL   0:51
P  Oranienstraße 37
D  Kantstraße 82
3.8 km   €27
```

The dispatcher should be able to answer, in a few seconds:

1. How urgent and valuable is this?
2. Where are pickup and destination?
3. Which riders are free, close, energetic and likely to volunteer?
4. Should this be OFF, OPEN, PRIORITY or LOCAL?
5. Is it cheaper to spend time, money, attention or route guidance instead?
6. What other contract should remain unheard because of this choice?

Every system should deepen one of those questions.

---

## 4. Main-screen information architecture

The main screen is an **operational instrument**, not a tutorial.

Permanent information is limited to things that can change a decision now.

### 4.1 Header

Contains only:

- `SEND IT` identity,
- shift trait × contract profile,
- current operating area and expansion progress,
- reputation,
- cash,
- score,
- dispatch focus,
- help/new-shift controls.

Long explanations belong in hover text or the help drawer.

### 4.2 Horizontal task rail

All active contracts run **left → right across the top** in stable creation order.

Each compact card shows:

- cargo glyph/color,
- ID,
- special-contract badge if applicable,
- remaining deadline,
- pickup street + number,
- destination street + number,
- approximate trip distance,
- payout,
- current/likely rider state,
- four radio buttons: `O`, `!`, `L`, `×`.

The task rail scrolls horizontally under heavy load. It must not re-sort every frame when radio state changes; card position is stable until the contract leaves the active queue.

### 4.3 Map

The map is the dominant surface.

It shows, in descending priority:

1. riders,
2. live/urgent contracts,
3. selected/hovered route,
4. committed rider routes,
5. active/forecast disruptions,
6. unlocked streets,
7. landmarks/water/parks,
8. Ringbahn orientation boundary,
9. locked/future geography only as faint context.

### 4.4 Rider dock

Each rider card is a live operational instrument containing:

- name,
- personality shorthand,
- experience level,
- current street/location,
- listening/thinking/riding/break state,
- current job + phase,
- task-completion meter,
- ETA,
- energy meter.

Greyed-out riders are on break / radio off and cannot hear or accept contracts.

### 4.5 Contract inspector

Clicking a task pins a compact inspector over the map containing only context-specific detail:

- exact address pair,
- time left,
- distance,
- payout,
- two most likely currently free riders,
- important route streets,
- currently legal dispatch interventions.

### 4.6 Hover / help policy

Hover is used for information that matters occasionally but would clutter permanent UI:

- cargo meaning,
- rider personality description,
- experience detail,
- full route summary,
- radio-channel explanation,
- dispatch-tool cost/effect,
- special-contract explanation.

`H` or `?` opens the full reference drawer.

### Anti-flicker rule

Live lists use keyed persistent DOM nodes:

- one node per contract ID,
- one node per rider ID,
- one node per goal ID.

Do not rebuild whole live panels with `innerHTML` every simulation tick. Canvas rendering is independent from the slower DOM projection cadence.

---

## 5. Player controls

### Radio

| Channel | Cost | Effect |
|---|---:|---|
| OFF | 0 | contract cannot be considered |
| OPEN | 1 bandwidth | neutral broadcast |
| PRIORITY | 2 bandwidth | stronger rider attention; still not an order |
| LOCAL | 1 bandwidth | favors riders close to the pickup |

Bandwidth makes `broadcast everything` non-optimal.

### Dispatch tools

Dispatch tools are realistic interventions into the same simulation, not separate abilities.

| Tool | Cost | Simulation effect |
|---|---:|---|
| **Add bonus** | €5 | adds €9 payout and raises rider attraction |
| **Client call** | 1 focus | negotiates +20 seconds once for that waiting contract |
| **Rebroadcast** | 1 focus | boosts a live call back into rider attention for 7 seconds |
| **Detour advisory** | 1 focus | during forecast or active disruption, makes affected streets less desirable and forces active riders to re-evaluate routes |

Dispatch focus is deliberately scarce. City expansion and a specific upgrade can increase its capacity; successful work periodically restores it.

This gives several solutions to one problem:

```text
urgent unattractive job
├─ spend radio bandwidth on PRIORITY
├─ spend cash on a bonus
├─ spend focus to call the client
├─ rebroadcast at the right moment
├─ wait for a better-positioned rider
└─ leave it OFF and protect more important work
```

---

## 6. Rider simulation

Canonical roster order:

1. Kira
2. Mauro
3. Brian
4. Sam
5. Michail
6. Zorro

A shift begins with the first three; upgrades can add the rest in order.

### Personality types

- Sprinter — close and urgent work
- Earner — payout
- Guardian — urgent/critical cargo
- Local — nearby familiar pickups
- Tourer — longer city runs
- Steady — balanced

### Experience

Experience affects:

- speed,
- deliberation time,
- choice noise,
- fatigue rate.

### Autonomous choice score

A listening rider evaluates live calls using combinations of:

- route cost to pickup,
- deadline pressure,
- payout,
- critical-cargo affinity,
- same-area locality,
- trip length,
- OPEN/PRIORITY/LOCAL signal,
- added payout bonus,
- rebroadcast boost,
- rider fatigue,
- experience-dependent noise.

The player may predict tendencies but cannot command the result.

### Fatigue and breaks

Riding increases fatigue. High fatigue can trigger a voluntary break after a delivery.

```text
RIDING
→ fatigue rises
→ delivery completes
→ possible BREAK / RADIO OFF
→ recovery
→ LISTENING
```

The dispatcher cannot cancel somebody's break.

---

## 7. Berlin as the board

### Scope

The first city now targets the **inner Berlin region bounded/oriented by the S41/S42 Ringbahn**.

The gameplay model includes 12 broad operating areas:

- Charlottenburg
- Wilmersdorf
- Moabit
- Wedding / Gesundbrunnen
- Prenzlauer Berg
- Mitte / Tiergarten
- Friedrichshain
- Kreuzberg
- Schöneberg
- Neukölln
- Tempelhof
- Alt-Treptow

Current generated model acceptance floors:

- `900+` graph nodes,
- `600+` address/service nodes,
- `500+` visual road segments,
- `110+` named streets,
- `27+` Ringbahn station anchors.

### Ringbahn orientation anchors

The static model includes the S41/S42 orientation loop using anchors such as:

- Westkreuz
- Halensee
- Hohenzollerndamm
- Heidelberger Platz
- Bundesplatz
- Innsbrucker Platz
- Schöneberg
- Südkreuz
- Tempelhof
- Hermannstraße
- Neukölln
- Sonnenallee
- Treptower Park
- Ostkreuz
- Frankfurter Allee
- Storkower Straße
- Landsberger Allee
- Greifswalder Straße
- Prenzlauer Allee
- Schönhauser Allee
- Gesundbrunnen
- Wedding
- Westhafen
- Beusselstraße
- Jungfernheide
- Westend
- Messe Nord / ICC

The ring is a gameplay/orientation boundary, not a simulated train system.

### Street examples

The grid/arterial model includes real Berlin names such as:

- Kurfürstendamm
- Kantstraße
- Kaiserdamm
- Bismarckstraße
- Hohenzollerndamm
- Bundesallee
- Turmstraße
- Alt-Moabit
- Invalidenstraße
- Müllerstraße
- Osloer Straße
- Seestraße
- Bornholmer Straße
- Danziger Straße
- Schönhauser Allee
- Prenzlauer Allee
- Greifswalder Straße
- Torstraße
- Unter den Linden
- Friedrichstraße
- Leipziger Straße
- Landsberger Allee
- Karl-Marx-Allee
- Frankfurter Allee
- Warschauer Straße
- Oranienstraße
- Skalitzer Straße
- Gneisenaustraße
- Urbanstraße
- Mehringdamm
- Kottbusser Straße
- Schlesische Straße
- Sonnenallee
- Karl-Marx-Straße
- Hermannstraße
- Columbiadamm
- Tempelhofer Damm
- Ringbahnstraße
- Puschkinallee
- Elsenstraße
- Kiefholzstraße

### Important precision statement

Send It is **not navigation software**.

The current map uses real street names and a manually compressed approximation of their relative city structure. Geometry and generated house numbers are gameplay abstractions and must not be described as parcel-accurate routing data.

The runtime must remain static/offline/deterministic: no commercial map tiles, geocoder, routing service or API key is required by GitHub Pages.

### Reproducibility references

Berlin Open Data:

- Detailnetz Berlin WFS: `https://daten.berlin.de/datensaetze/detailnetz-berlin-wfs-4f2045ef`
- Adressen Berlin WFS: `https://daten.berlin.de/datensaetze/adressen-berlin-wfs-634ab8ba`
- license: Datenlizenz Deutschland – Zero – Version 2.0

BVG reference for the Ringbahn/tariff-area relationship and current network maps:

- `https://www.bvg.de/en/subscriptions-and-tickets/tariff-zones-and-networks`
- `https://www.bvg.de/en/connections/network-maps-and-routes`

The next geographic precision tier is an **offline build-time import** from official Berlin data, followed by simplification and committing the generated static result.

---

## 8. Address model

Every generated contract stores:

```js
{
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
  plannedPath
}
```

Player-facing contracts always use street + house number rather than internal graph IDs.

Current house numbers are deterministic street-consistent gameplay numbers, not authoritative Berlin parcel records.

---

## 9. City progression

Progression expands the **same simulation** instead of adding disconnected minigames.

### Stage 1 — CENTER DESK

Start:

- Mitte / Tiergarten
- Kreuzberg
- four base cargo classes
- compact map framing
- three riders

### Stage 2 — INNER CITY

Unlock at **6 completed deliveries**:

- Charlottenburg
- Schöneberg
- Prenzlauer Berg
- Friedrichshain
- map automatically fits a larger operating area
- +1 radio bandwidth
- +1 dispatch-focus capacity
- bridge-oriented goal can appear
- Fragile, Flowers, Keys, Medical cargo
- RUSH special contracts

### Stage 3 — INSIDE THE RING

Unlock at **16 completed deliveries**:

- Wilmersdorf
- Moabit
- Wedding / Gesundbrunnen
- Neukölln
- Tempelhof
- Alt-Treptow
- full Ringbahn-oriented map extent
- named Ringbahn station labels appear with zoom
- +1 radio bandwidth
- +1 dispatch-focus capacity
- cross-area goal
- Catering and Cold-chain cargo
- RETURN special contracts

Expansion should feel like the dispatch desk becoming responsible for more of the same real city, not a conventional level transition.

---

## 10. Cargo and special contracts

### Cargo

| Glyph | Type | Unlock | Character |
|---|---|---:|---|
| ▲ | Food | 1 | fast-turnaround restaurant run |
| ● | Parcel | 1 | common general delivery |
| ■ | Docs | 1 | business/signature work |
| ⬢ | Grocery | 1 | forgiving local work |
| ◆ | Fragile | 2 | higher value, careful timing |
| ✿ | Flowers | 2 | delicate/time-sensitive |
| ⌑ | Keys | 2 | small urgent access handoff |
| ✚ | Medical | 2 | urgent critical courier work |
| ♨ | Catering | 3 | longer event-oriented run |
| ❄ | Cold | 3 | strict cold-chain timing |

Cargo category remains independent of district stereotypes.

### Special contracts

**RUSH**

- stage 2+
- much tighter deadline
- better payout
- slightly more attractive to riders

**RETURN**

- stage 3+
- successful completion creates a paid reverse-direction follow-up contract
- creates interesting rider-position consequences without direct rider control

---

## 11. Street events

Temporary events include:

- roadworks,
- demonstrations,
- bridge squeeze.

Lifecycle:

```text
FORECAST
→ player may issue detour advisory
→ ACTIVE
→ affected edge speed/cost changes
→ riders reroute at graph nodes
→ CLEAR
```

Events should always create visible, counterable logistics problems rather than arbitrary penalties.

---

## 12. Roguelike construction

A seed determines simulation-affecting randomness including:

- run trait,
- contract profile,
- rider personality/experience combinations,
- initial fatigue,
- delivery stream,
- special-contract rolls,
- events,
- goals,
- upgrade order,
- enhanced bike corridors.

The same seed must reproduce the same opening state and random sequence when played identically.

Run traits modify the same core dispatch questions: deadlines, payout, speed, bandwidth, fatigue or demand tempo.

---

## 13. Loss, reward and review

Successful jobs produce:

- cash,
- score,
- small reputation recovery,
- goal progress,
- city progression,
- periodic upgrades.

Missed work reduces reputation. Critical medical/cold-chain failures are more expensive.

At `0 REP` the shift ends.

Dispatch Review classifies failures into:

- never called,
- called but no taker,
- accepted too late,
- radio bandwidth blocked,
- rider break pressure,
- dispatch-tool usage.

The review should teach the player how the system failed rather than only report a score.

---

## 14. Rendering and performance architecture

Important modules:

```text
src/
├── berlin.js             static generated/stylized Berlin model
├── graph.js              graph index + heap A*
├── rng.js                deterministic randomness
├── game-core.js          run/city/address generation
├── game-data.js          cargo/radio/personality/upgrade data
├── game-radio.js         autonomous contract evaluation
├── game-riders.js        movement/fatigue/progress/completion
├── game-events.js        disruptions/goals/review
├── game-tools.js         contextual dispatch interventions
├── game-progression.js   city-expansion hooks
├── camera.js             stage-aware zoom/pan/fit
├── render-map.js         progressive city/cartographic layer
├── render-entities.js    jobs/riders/routes/hover focus
├── render.js             canvas orchestration
└── main.js               stable DOM projection + interaction
```

Performance rules:

- cache node/edge/adjacency lookup,
- use A* instead of scanning every node for every route,
- fixed simulation timestep,
- canvas draws every animation frame,
- DOM updates around 8 times/second,
- do not add route caches until profiling proves they are needed,
- task/rider/goal DOM nodes persist across updates.

---

## 15. Input

```text
Mouse wheel   zoom around cursor
Drag map      pan
FIT / 0       fit current operating area
Space         pause/resume
1             1×
2             2×
3             4×
H / ?         help drawer
Esc           clear selection / close help
```

Hovering map entities or operational cards should produce immediate visual/map feedback.

---

## 16. Test/merge acceptance gates

`npm test` must parse browser entry/render sources and pass the simulation suite.

Current test categories include:

- deterministic RNG,
- Ringbahn-scale city density,
- address integrity/uniqueness,
- graph connectivity,
- same-seed reproduction,
- exact rider roster,
- address-to-address contracts,
- district-independent cargo,
- absence of direct assignment,
- radio accounting,
- radio-off behavior,
- breaks/recovery,
- autonomous deliberation/claiming,
- street/bridge goals,
- disruption routing,
- named-street routes,
- run-contract variation,
- multi-seed stress,
- opening-shift survival floor,
- six-rider high-density load,
- Ringbahn station anchors,
- territory unlock thresholds,
- level-gated cargo,
- return follow-up generation,
- cash/time/attention/routing dispatch interventions,
- rider progress + ETA instrumentation.

Do not merge a substantial gameplay slice if these gates are red.

---

## 17. Design north star

> **Send It is a charming Berlin logistics simulation about shaping the decisions of autonomous people through limited information, money, time and street knowledge.**

When evaluating a new feature, ask:

1. Does it create a meaningful dispatch decision?
2. Does it interact with riders, contracts, streets or scarce attention?
3. Can the player understand its state visually?
4. Does it preserve rider autonomy?
5. Does it make Berlin more learnable or the run more varied?
6. Can something else be removed or simplified to make room for it?

If not, it probably does not belong in the main loop.
