# SEND IT — Berlin Courier Dispatch Roguelike

**Send It** is a browser-based real-time logistics simulation about coordinating autonomous bicycle couriers through a shared radio.

> **You control information, not riders.**

Play: `https://generalgroovy.github.io/bike/`

This README is the authoritative product, gameplay, UI, map, simulation and reproducibility specification. `IMPLEMENTATION_PLAN.md` records the implementation order and quality gates.

---

## 1. Product identity

Send It combines:

- spatial logistics,
- autonomous-agent management,
- a learnable Berlin street board,
- real-time triage,
- short deterministic roguelike shifts.

It must not become a direct unit-control game, spreadsheet optimizer, generic delivery tycoon or GIS viewer.

The fantasy is a courier dispatch desk: jobs arrive, imperfect humans move through the city, and the dispatcher shapes what information reaches them.

---

## 2. Non-negotiable simulation rule

The player never performs:

```text
rider → job
```

The actual loop is:

```text
address contract appears
→ decide whether it deserves airtime
→ choose radio channel
→ autonomous riders evaluate the live calls
→ one rider volunteers
→ observe movement / fatigue / city conditions
→ adapt the next broadcast
```

There is intentionally no direct `assign()` API. Tests guard this invariant.

---

## 3. Main player decisions

### Radio

| Action | Cost | Effect |
|---|---:|---|
| OFF | 0 | Hold a contract off radio. |
| OPEN | 1 bandwidth | Neutral call to listening riders. |
| PRIORITY | 2 bandwidth | Stronger rider attention; still not an order. |
| LOCAL | 1 bandwidth | Favors riders already near the pickup. |

Bandwidth is deliberately scarce. Calling everything is usually worse than triage.

### Contextual dispatch tools

The selected-contract inspector exposes realistic interventions rather than powers that bypass rider autonomy:

- **+€ Bonus** — spend cash to make one job more attractive.
- **Client call** — spend Dispatch Focus for +20 seconds.
- **Rebroadcast** — spend Dispatch Focus to refresh rider attention.
- **Event response** — spend Dispatch Focus to pre-brief routes, detour riders, prepare capacity or stagger clients depending on event type.

These tools attack different failure modes using **money, time, attention and routing**.

---

## 4. Operational GUI

Normal play is organized by the decisions that matter now:

```text
compact command bar
└─ shift / area / REP / cash / score / focus

horizontal contract rail
└─ newest work runs left → right

map
└─ dominant spatial decision surface

rider dock
└─ current team state and goals
```

Permanent tutorial paragraphs are excluded from the live workspace. Explanations live in:

- hover cards,
- the selected-contract inspector,
- the `? HELP` reference panel,
- the post-shift review.

### Contract card

A compact card contains only live decision information:

- cargo glyph,
- ID / special tag,
- deadline,
- pickup street + number,
- dropoff street + number,
- distance,
- payout,
- current radio/likely-rider state.

Hover adds route streets, likely riders, special-contract explanation and cargo handling consequences.

### Rider card

Every rider card is an operational instrument:

- stable rider color,
- name,
- personality + experience,
- current street/location,
- LISTENING / THINKING / RIDING / BREAK state,
- task-completion bar,
- ETA,
- energy bar.

A rider on break is greyed out and explicitly **RADIO OFF**.

### Anti-flicker rule

Live contract, rider and goal elements are persistent keyed DOM nodes. The UI updates their text/classes in place rather than rebuilding complete lists each tick.

---

## 5. Rider roster and autonomy

Canonical roster order:

1. Kira
2. Mauro
3. Brian
4. Sam
5. Michail
6. Zorro

A new shift begins with the first three. Extra Rider upgrades add the rest in order.

### Personality niches

- **Sprinter** — close + urgent work.
- **Earner** — unusually profitable jobs.
- **Guardian** — urgent critical/medical work.
- **Local** — nearby and same-area pickups.
- **Tourer** — longer cross-city rides.
- **Steady** — generalist; competitive on balanced work rather than an extreme specialist.

Choice scoring includes route travel cost, urgency, payout, critical cargo, locality, trip length, radio channel, cargo incentives, fatigue, experience noise and temporary rebroadcast/bonus effects.

Automated balance gates require specialists to retain distinct niches and reject generic job streams that collapse overwhelmingly to one personality.

### Experience

Rookie → Regular → Experienced → Veteran affects:

- movement speed,
- deliberation time,
- decision noise,
- fatigue.

### Fatigue and breaks

Movement builds fatigue. Riders autonomously take breaks when sufficiently tired and staffing allows it.

```text
RIDING
→ fatigue rises
→ delivery completes
→ possible BREAK / RADIO OFF
→ recovery
→ LISTENING
```

The dispatcher must plan around expected availability; there is no “cancel break” command.

---

## 6. Cargo is mechanically different

Cargo classes do more than change payout/deadline.

| Cargo | Tier | Handling character |
|---|---:|---|
| Food | 1 | Light, fast-turnaround. |
| Parcel | 1 | Standard load. |
| Documents | 1 | Very light, efficient. |
| Grocery | 1 | Heavy; slower and more tiring while loaded. |
| Fragile | 2 | Delicate; careful slower pace. |
| Flowers | 2 | Delicate; mild loaded slowdown. |
| Keys | 2 | Tiny urgent handoff; no load penalty. |
| Medical | 2 | Critical light cargo; strict timing. |
| Catering | 3 | Bulky; strongest speed/fatigue penalty. |
| Cold-chain | 3 | Protected critical cargo; moderate slowdown. |

Loaded speed/fatigue affects rider availability after the pickup, so contract type changes downstream dispatch capacity.

Cargo remains independent from district identity.

---

## 7. Special contracts

From Inner City onward, deterministic seeds may create special work:

- **RUSH** — tighter window, increased payout/appeal.
- **RETURN** — successful completion creates a paid reverse follow-up leg.

Specials modify the normal contract loop; they do not create separate minigames.

---

## 8. Berlin is the board

The first city is a static, deterministic gameplay model of Berlin inside the S41/S42 Ringbahn.

Current model:

- 1600 × 1120 game-space extent,
- 12 operating areas,
- 900+ graph nodes,
- 600+ addressable service nodes,
- 500+ visual road blocks,
- 110+ real Berlin street names,
- Spree + Landwehr Canal,
- major parks and landmarks,
- named bridge metadata,
- 27 Ringbahn orientation anchors including Westkreuz, Gesundbrunnen, Ostkreuz and Südkreuz.

Examples include Kurfürstendamm, Kantstraße, Kaiserdamm, Turmstraße, Müllerstraße, Schönhauser Allee, Prenzlauer Allee, Invalidenstraße, Torstraße, Unter den Linden, Friedrichstraße, Karl-Marx-Allee, Frankfurter Allee, Warschauer Straße, Oranienstraße, Skalitzer Straße, Mehringdamm, Kottbusser Straße, Sonnenallee, Hermannstraße, Tempelhofer Damm and many more.

### Precision contract

The runtime never depends on Google Maps, commercial tiles, API keys or live web requests.

Reference datasets:

- Berlin Open Data — **Detailnetz Berlin**
- Berlin Open Data — **Adressen Berlin**
- BVG S41/S42 Ringbahn orientation
- Datenlizenz Deutschland – Zero – Version 2.0 where applicable

The current shipped streets use real names and broadly recognizable topology, but the graph is a hand-curated gameplay abstraction, not navigation-grade GIS geometry. Current house numbers are deterministic street-consistent gameplay addresses, not claims of exact current parcels.

The next precision tier is an offline build-time importer that samples official street/address data, simplifies it deterministically and commits the normalized static output. Runtime must remain offline.

---

## 9. Spatial progression

The whole city is not dumped onto the player immediately.

```text
0 completed
CENTER DESK
Mitte + Kreuzberg

6 completed
INNER CITY
west/east corridors unlock
more cargo + specials

30 completed
INSIDE THE RING
full S41/S42 interior operation
highest-tier cargo
```

The map camera automatically fits the newly unlocked operating bounds. Locked geography is heavily suppressed until relevant.

The 30-delivery Ring threshold is intentional: automated pacing tests showed that a 16-delivery threshold could expose the entire city in roughly two minutes under competent dispatch. The second expansion is now a mid-run transition rather than an onboarding event.

---

## 10. City events and counterplay

All meaningful disruptions are forecast before activation.

### Route events

Examples:

- roadworks,
- demonstration,
- bridge squeeze,
- district rain cell.

Effects alter graph travel cost and physical movement. Forecasted segments are visually distinct from active segments.

Counterplay:

- **PRE-BRIEF** during forecast,
- **DETOUR** while active.

A prepared route event has a softer slowdown and riders recalculate their routes.

### Demand events

Examples:

- venue release,
- transit outage.

A district is visibly highlighted on the map. When the event starts it creates tagged contracts concentrated around that area.

Counterplay:

- **CAPACITY PLAN** during forecast reduces the burst and buffers deadlines.
- **STAGGER CLIENTS** while active buys time for unresolved event jobs.

Every event therefore has forecast → spatial cue → pressure → meaningful response.

---

## 11. Map visual hierarchy

From strongest to weakest:

1. riders,
2. selected/live/urgent contracts,
3. rider routes and deliberation,
4. active event effects,
5. forecast effects,
6. landmarks / Ringbahn orientation,
7. road hierarchy,
8. districts / parks / decoration.

Progressive disclosure prevents the denser map from becoming clutter:

- overview: arterials + operational entities,
- closer: primary streets,
- higher zoom: secondary streets + labels,
- selected work: exact pickup/drop tags and route context.

Controls:

```text
mouse wheel   zoom at pointer
left drag     pan
+ / −         zoom
FIT / 0       fit unlocked operating area
Space         pause
1 / 2 / 3     1× / 2× / 4×
H / ?         help
Esc           close / clear selection
```

---

## 12. Shift goals and upgrades

Goals are generated from the currently playable city and later expand with territory.

Examples:

- work a named street,
- cover a district,
- reliability target,
- named bridge use,
- cross-area Ring operation.

Upgrades modify existing systems:

- radio bandwidth,
- extra rider,
- team briefing,
- movement speed,
- client deadline buffer,
- bike-lane grants,
- slower fatigue,
- more Dispatch Focus,
- reputation recovery.

No upgrade directly assigns work.

---

## 13. Post-shift learning

The Dispatch Review classifies failures into:

- never called,
- called but no taker,
- accepted too late,
- radio-blocked decisions,
- rider breaks,
- event preparation/tool usage.

A **Critical Timeline** reconstructs the high-value causal sequence around the run:

- city expansions,
- event forecasts/starts/responses,
- demand bursts,
- breaks/returns,
- radio-denied moments,
- dispatch interventions,
- failures,
- collapse.

Routine radio chatter is deliberately omitted so the review teaches rather than logs everything.

---

## 14. Determinism and architecture

Same seed reproduces the same opening run state and stochastic sequence as long as the same player actions are applied.

Core modules:

```text
src/
├── berlin.js              static Berlin gameplay graph
├── graph.js               indexed pathfinding
├── rng.js                 seeded RNG
├── game-core.js           run state / contracts / city state
├── game-radio.js          autonomous rider choice
├── game-riders.js         rider lifecycle
├── game-pacing.js         progression pacing
├── game-cargo.js          cargo handling data
├── game-cargo-motion.js   loaded movement/fatigue
├── game-events.js         event lifecycle
├── game-event-demand.js   demand burst generation
├── event-data.js          extended city-event catalogue
├── game-tools.js          player interventions
├── game-review.js         causal post-shift timeline
├── camera.js              zoom/pan/fit
├── render-map.js          geography/event rendering
├── render-entities.js     riders/contracts/routes
└── main.js                browser UI/controller
```

Rendering and simulation are separated. Canvas may animate continuously; DOM state projects at a slower cadence with persistent nodes.

---

## 15. Validation contract

`npm test` must remain green before a merge candidate is accepted.

The suite covers, among other things:

- deterministic RNG/run generation,
- dense Berlin connectivity and address integrity,
- exact rider roster,
- no direct assignment API,
- radio bandwidth,
- autonomous deliberation/claiming,
- breaks/radio-off behavior,
- personality differentiation and dominance checks,
- route/bridge goals,
- staged territory and cargo gating,
- full-Ring pacing under an adaptive dispatcher,
- route/weather/demand event counterplay,
- cargo handling speed/fatigue effects,
- rider task progress/ETA,
- six-rider high-load finite-state simulation,
- stable keyed UI structure,
- event-specific UI wording,
- demand-event map highlighting,
- causal review timeline,
- browser entry/render syntax checks.

A red gate is treated as either a real implementation bug or a flawed fixture; it is investigated rather than weakened automatically.

---

## 16. Reproduce locally

Requirements: modern browser, Node.js 24+ for tests, Python only for the convenience static server.

```bash
npm test
npm run serve
```

Then open:

```text
http://localhost:8080
```

No build step, map API, account or backend is required.

---

## 17. Design order for future iterations

Continue **inside out**:

```text
radio decision quality
→ rider behavior
→ contract semantics
→ event counterplay
→ pacing / progression
→ map precision
→ UI readability / charm
→ additional content
```

Do not add breadth to compensate for a weak inner loop.

Highest-value remaining work:

1. real browser playtest at several desktop aspect ratios,
2. official static Berlin street/address import pipeline,
3. measured tuning from human runs rather than autoplay alone,
4. stronger but restrained motion/audio feedback,
5. additional event/contract variants only when each adds a distinct dispatch decision.
