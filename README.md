# BIKE — Berlin Dispatch Roguelike

BIKE is a browser strategy game about **indirectly coordinating autonomous bicycle couriers through a shared radio**.

> The dispatcher chooses what work riders can hear. Riders choose for themselves.

This README is the authoritative product, gameplay, map, UI and implementation specification. A contributor should be able to reproduce the intended game from this document without hidden context.

## 1. Product identity

BIKE is deliberately narrow:

- one readable city map,
- address-to-address jobs,
- autonomous riders,
- limited radio bandwidth,
- rising time pressure,
- deterministic roguelike shifts.

The game is not a direct unit-control RTS, a GIS viewer, a delivery-company spreadsheet or a full logistics tycoon.

### Core invariant

```text
address job appears
→ dispatcher chooses OFF / OPEN / PRIORITY / LOCAL
→ radio-on riders evaluate the live jobs
→ riders visibly deliberate
→ one rider autonomously claims one
→ rider goes to pickup address
→ rider goes to destination address
→ dispatch chooses the next useful choice set
```

There must never be a `rider → assign job` command.

## 2. Core loop

The entire game should be understandable through five questions:

1. **What jobs exist?**
2. **Where are their addresses?**
3. **Which riders are free and listening?**
4. **Which jobs should be on the radio right now?**
5. **Which calls should be removed before they attract the wrong rider?**

Everything else supports those questions.

### Loss condition

Missed deadlines reduce reputation. At `0 REP` the shift ends.

### Success loop

Successful jobs:

- increase score and cash,
- slightly recover reputation,
- advance Berlin goals,
- eventually trigger one-of-three run upgrades.

## 3. Berlin: fixed city, procedural shift

The first city is Berlin.

The macro city is fixed and learnable:

- Charlottenburg
- Moabit
- Wedding
- Prenzlauer Berg
- Tiergarten
- Mitte
- Friedrichshain
- Kreuzberg
- Schöneberg
- Tempelhof
- Neukölln

Important fixed geography includes the Spree, Landwehr Canal, Tiergarten, Tempelhofer Feld and major landmarks/crossings.

The shift is procedural:

- delivery stream,
- exact street numbers,
- rider personality/experience combinations,
- starting fatigue,
- run trait,
- Berlin goals,
- disruption timing,
- upgrade order,
- enhanced bike corridors.

The same seed must reproduce all simulation-affecting randomness.

## 4. Street-network model

### Design goal

The city must feel like a **compressed real Berlin street map**, not a node diagram.

The player should see:

- major Berlin axes from overview scale,
- neighborhood blocks when zooming in,
- enough intersections that rider position and route choice matter,
- no unnecessary building-level clutter.

### Data/source policy

Street naming and broad spatial relationships are checked against public Berlin map references, especially:

- Berlin public `Straßenverzeichnis`
- Geoportal Berlin / `Detailnetz Berlin`
- ordinary map applications may be used as visual reference during manual simplification

Useful official references:

- `https://service.berlin.de/dienstleistung/324319/`
- `https://gdi.berlin.de/`

The runtime game does **not** load commercial map tiles, routing APIs or geocoding services.

### Important accuracy rule

BIKE is a deterministic gameplay abstraction, not navigation data.

- street names are real,
- macro relative placement is intentionally recognizable,
- neighborhood grids are hand-compressed,
- generated house numbers are plausible gameplay addresses, **not authoritative postal records**.

Do not present the map as suitable for real-world routing.

## 5. Two-layer Berlin graph

The map is built from two layers.

### Layer A — strategic skeleton

`src/berlin.js`

Contains:

- major hubs,
- landmarks,
- arterial/primary/secondary corridors,
- named bridges,
- water/parks,
- district geometry.

Examples include:

- Kurfürstendamm
- Kantstraße
- Bismarckstraße
- Straße des 17. Juni
- Invalidenstraße
- Müllerstraße
- Brunnenstraße
- Schönhauser Allee
- Prenzlauer Allee
- Unter den Linden
- Friedrichstraße
- Leipziger Straße
- Karl-Marx-Allee
- Frankfurter Allee
- Warschauer Straße
- Oranienstraße
- Skalitzer Straße
- Mehringdamm
- Kottbusser Damm
- Karl-Marx-Straße
- Hermannstraße
- Sonnenallee
- Tempelhofer Damm

### Layer B — dense neighborhood grids

`src/berlin-detail.js`

Adds compact local grids inside the strategic skeleton.

Current patches cover:

- Charlottenburg
- Moabit
- Wedding
- Mitte
- Prenzlauer Berg
- Friedrichshain
- Kreuzberg
- Schöneberg
- Neukölln

Each patch contains real Berlin street names arranged into a compressed grid and connects back into nearby strategic hubs.

The detailed runtime network should currently contain roughly:

- `230+` total graph nodes,
- `100+` named street definitions,
- `160+` address-capable local nodes.

These numbers are acceptance floors, not hard limits.

### Expansion rule

When adding city detail:

1. add meaningful streets, not decorative lines;
2. connect them into the route graph;
3. use progressive visual detail so overview remains readable;
4. keep major axes visually stronger than local streets;
5. test every generated node is routable from dispatch.

## 6. Address model

A delivery is no longer `node A → node B` in player-facing language.

It is:

```text
Oranienstraße 34
→
Weserstraße 87
```

Each delivery stores:

```js
{
  pickupId,
  dropoffId,
  pickupAddress: {
    street,
    number,
    label,
    districtId
  },
  dropoffAddress: {
    street,
    number,
    label,
    districtId
  }
}
```

Dense grid nodes carry address hints for both crossing streets. Base strategic nodes derive a plausible address from their incident street edges.

House-number generation is seeded.

### Job distance tiers

Every job is classified from route length:

- `SHORT`
- `MID`
- `LONG`

The job card displays the tier and approximate distance.

This gives useful decisions without adding a new rules system:

- short jobs reposition riders locally,
- mid jobs form the normal workload,
- long jobs can strand a rider far from future demand.

## 7. Job spawning

Normal cargo type is independent from district identity.

Food must not inherently mean Kreuzberg. Documents must not inherently mean Mitte.

Spawn procedure:

1. select a pickup endpoint;
2. strongly prefer dense address nodes;
3. select a distinct destination with minimum spatial separation;
4. verify a route exists;
5. reject trivial routes;
6. create seeded pickup/dropoff street numbers;
7. calculate route-distance tier;
8. derive deadline and reward from cargo type + route length + run modifiers.

The result should feel like a changing city workload, not a fixed district economy table.

## 8. Delivery types

```text
▲ Food
● Parcel
■ Documents
✚ Medical
⬢ Grocery
◆ Fragile
```

Type controls color/glyph plus base deadline/reward.

Type should remain immediately classifiable by shape as well as color.

## 9. Radio: the player's actual control surface

Channels:

| Channel | Cost | Meaning |
|---|---:|---|
| OFF | 0 | riders cannot consider the job |
| OPEN | 1 | normal broadcast |
| PRIORITY | 2 | stronger attention signal, still not an order |
| LOCAL | 1 | favours riders already close to the pickup |

The live bandwidth cap prevents `broadcast everything` from becoming optimal.

The player manipulates the **choice environment**, not the riders.

## 10. Riders

Canonical roster order:

1. Kira
2. Mauro
3. Brian
4. Sam
5. Michail
6. Zorro

A normal shift starts with the first three. `Extra Rider` adds later names in order.

### Personality

Current personality models:

- Sprinter — proximity + urgency
- Earner — payout
- Guardian — urgent/medical work
- Local — nearby/familiar pickups
- Tourer — landmark/longer rides
- Steady — balanced

### Experience

```text
Rookie
Regular
Experienced
Veteran
```

Experience changes:

- riding speed,
- deliberation time,
- decision noise.

The UI exposes personality and experience, but never exact hidden utility scores.

## 11. Rider deliberation

A radio-on idle rider does not instantly claim work.

```text
LISTENING
→ CONSIDERING D12
→ visible deliberation ring fills
→ CLAIM
→ RIDING
```

The player can withdraw or change a call while a rider is thinking. A changed channel invalidates stale deliberation and forces re-evaluation.

This delay is essential: it creates a real window for dispatch decisions.

## 12. Fatigue, breaks and radio-off state

Riding increases fatigue.

After a delivery, a sufficiently tired rider can autonomously take a break.

Break state:

```text
phase = break
radioOn = false
```

While on break the rider:

- cannot hear live calls,
- cannot deliberate,
- cannot claim jobs,
- recovers fatigue,
- is greyed out on map and rider card,
- shows a return countdown.

The dispatcher cannot cancel a rider's break.

## 13. Routing

Routing uses the current weighted graph.

Edge cost is approximately:

```text
distance / (streetSpeed × bikeLaneBonus × disruptionMultiplier)
```

Riders may reroute at graph nodes when an active disruption changes edge cost.

Routes must remain readable visually; route precision is less important than decision clarity.

## 14. Berlin disruptions

Temporary events are forecast before activation.

Examples:

- roadworks
- demonstration
- bridge squeeze

A disruption modifies one or more street edges for a limited time.

Good event design gives the dispatcher enough warning to change radio choices before riders commit.

## 15. Goals

Goals make geography matter without coupling cargo type to districts.

Examples:

- serve Brandenburger Tor
- cover Kreuzberg-linked endpoints
- complete deliveries crossing Oberbaumbrücke
- complete a reliability target

Goal rewards can provide cash, score and reputation.

## 16. Roguelike structure

A seed governs the complete run.

Run traits currently alter pressure/economics/infrastructure without changing the core verbs.

Good upgrades modify one of these:

- radio bandwidth
- rider count
- rider decision quality
- speed
- deadline margin
- bike corridors
- reputation buffer

Avoid upgrades that add additional control panels or direct rider commands.

## 17. UI architecture

The screen is map-first:

```text
┌──────────────┬─────────────────────────┬─────────────┐
│ RADIO / JOBS │       BERLIN MAP        │   RIDERS    │
│              │                         │   GOALS     │
│ addresses    │ streets / jobs / routes│             │
└──────────────┴─────────────────────────┴─────────────┘
```

### Visual hierarchy

Read the map in this order:

1. active jobs
2. riders
3. live radio state
4. committed rider routes
5. road disruptions
6. major streets
7. local street grid
8. landmarks
9. districts/decoration

### Stable DOM / anti-flicker rule

Live job/rider/goal lists use keyed persistent DOM elements.

Do not rebuild those lists with `innerHTML` every frame.

Only update:

- text that changed,
- state classes,
- progress/fatigue widths,
- elements entering/leaving the active set.

Canvas rendering runs independently through `requestAnimationFrame`.

## 18. Zoom and map controls

```text
Mouse wheel   zoom around cursor
Drag          pan
+ / −         zoom
1:1           reset zoom
0             reset map
```

Progressive detail:

- overview: arterial/primary streets dominate;
- medium zoom: secondary streets and district labels;
- close zoom: local-grid street names and address numbers.

Never show every label at every scale.

## 19. Controls overview

`CONTROLS` or `? / H` opens the quick reference.

First run opens it automatically and pauses the simulation.

Core shortcuts:

```text
Wheel      zoom
Drag       pan
Space      pause
1 / 2 / 3  1× / 2× / 4×
0          reset map
? / H      controls
Esc        close / clear inspection
```

## 20. Architecture

Zero runtime dependencies and zero build step.

```text
index.html
styles.css
src/
  berlin.js           strategic Berlin data
  berlin-detail.js    neighborhood grids + address nodes
  graph.js            weighted pathfinding
  rng.js              deterministic RNG

  game.js             module assembly
  game-data.js        static gameplay definitions
  game-core.js        state, city graph, addresses, spawning
  game-radio.js       broadcast + autonomous choice
  game-riders.js      movement, fatigue, breaks
  game-events.js      disruptions, goals, review

  camera.js           zoom/pan camera
  render.js           renderer assembly
  render-map.js       streets/water/parks/labels
  render-entities.js  jobs/riders/routes/intentions
  main.js             fixed-step loop + stable DOM projection

tests/
  core.test.js
```

## 21. Simulation rules

Use a fixed simulation timestep.

Rendering remains decoupled from simulation.

Requirements:

- deterministic seed behavior,
- no simulation decisions from wall-clock time,
- no DOM state used as game state,
- graph routing is the source of truth for movement,
- state transitions are explicit.

## 22. Performance target

The browser should comfortably support:

- `200+` graph nodes,
- `300+` road edges,
- six riders,
- 30+ active deliveries,
- animated map at 60 FPS on ordinary laptops.

Increasing visual city detail must not imply increasing UI update frequency.

## 23. Tests / acceptance gate

Run:

```bash
npm test
```

Before merging, tests should prove at minimum:

- RNG determinism,
- recognizable Berlin macro layout,
- detailed street-count floor,
- dense address-node floor,
- street + integer house number on every spawned endpoint,
- deterministic address jobs for the same seed,
- complete graph routability across multiple seeds,
- requested rider roster order,
- radio bandwidth costs,
- absence of a direct assignment API,
- radio-off riders cannot consider work,
- fatigue can trigger breaks,
- autonomous claiming works,
- cargo type remains district-independent,
- bridge goals use actually traversed edges,
- disruptions alter route costs,
- seeded stress simulations remain finite.

GitHub CI is the merge gate.

## 24. Reproduction order

If rebuilding BIKE from scratch, implement in this order:

1. deterministic RNG
2. weighted graph routing
3. Berlin strategic skeleton
4. dense local street grid
5. address generation
6. delivery spawn/deadline/reward
7. one autonomous rider
8. radio broadcast loop
9. multiple personalities/experience
10. stable map rendering
11. zoom/pan
12. fatigue/breaks
13. events/goals
14. upgrades
15. run review
16. polish/accessibility

This order is intentional: **work from simulation truth outward into presentation**.

## 25. Quality questions

Before adding another feature, ask:

- Does it strengthen `address → broadcast → autonomous choice → ride → outcome`?
- Can the player classify the new information visually in under a second?
- Does it create a meaningful timing/spatial decision?
- Can the same depth be achieved with fewer rules?
- Does the map remain readable at overview scale?
- Does zoom reveal useful detail rather than decoration?
- Can the player understand why a rider made a choice?
- When the run collapses, can the player identify the dispatch mistake?

If not, simplify instead of expanding.

## 26. Current north star

```text
learn Berlin
→ read exact addresses
→ understand rider positions
→ decide what goes on the radio
→ predict imperfect autonomous choices
→ preserve coverage through fatigue and disruptions
→ improve the next shift with better timing
```

The long-term identity is:

> **A compact Berlin logistics roguelike about shaping an autonomous courier network through information rather than orders.**
