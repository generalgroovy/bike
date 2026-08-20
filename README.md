# SEND IT — Berlin Courier Dispatch Roguelike

**Send It** is a browser-based real-time logistics simulation about coordinating autonomous bicycle couriers through a shared radio.

> **You control information, not riders.**

Play: `https://generalgroovy.github.io/bike/`

This README is the authoritative product, gameplay, UI, map, simulation and reproducibility specification. `IMPLEMENTATION_PLAN.md` records implementation order and quality gates.

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

There is intentionally no direct `assign()` API. Tests guard this invariant, including future-availability and Dispatch Insight UI: a busy rider may be forecast as available soon, and a channel may be estimated as a stronger fit, but neither system may reserve, assign or force work.

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
- **Event response** — choose event-specific counterplay using Dispatch Focus or cash.

These tools attack different failure modes using **money, time, attention and routing**.

---

## 4. Operational GUI

Normal play is organized by the decisions that matter now:

```text
compact command bar
└─ shift / area / REP / cash / score / focus

horizontal contract rail
└─ highest-attention work first by default

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

Hover adds route streets, deadline risk/slack, rider fit, qualitative OPEN/LOCAL/PRIORITY comparison, special-contract explanation and cargo handling consequences.

### Attention-first queue

The task rail defaults to **ATTENTION** ordering:

1. at-risk and tight contracts,
2. live calls that still have no taker,
3. important special work,
4. normal waiting work,
5. already committed work.

Manual views remain available for arrival order, raw urgency, payout and nearest-pickup range. Sorting changes only CSS order on persistent keyed cards; it does not mutate simulation state.

### Rider Outlook

A selected contract includes a compact capacity forecast:

- **NOW** — rider can hear and potentially choose the job immediately,
- **BUSY · 0:xx** — projected time until the rider finishes current work and could reach the pickup,
- **BREAK · 0:xx** — projected time after radio-off recovery and travel.

This is informational only. It creates a choice between broadcasting now, waiting, paying a bonus or buying deadline time without introducing reservation/pre-assignment.

### Dispatch Insight

The selected contract and hover layer expose a qualitative, non-mutating decision projection:

- SAFE / FUTURE / TIGHT / AT RISK feasibility,
- best projected finisher and delivery slack,
- likely rider fit for OPEN / LOCAL / PRIORITY,
- concise suggestions such as hold, call, strengthen signal, buy time or sweeten payout.

The insight layer is explicitly tested not to spend resources, change a channel, commit a rider or advance simulation state.

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

### Map rider feedback

Rider markers are directional: the triangle points along the actual segment being ridden, including cargo-aware movement. While moving, a restrained cadence cue reinforces motion without particle clutter. Pickup and dropoff produce short milestone halos plus a compact `P` / `✓` mark.

When the browser reports `prefers-reduced-motion: reduce`, decorative cadence motion is removed and animated radio/milestone expansion is frozen while all state information remains visible.

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
- **Scheduled pickup** — a rider may volunteer early but must wait until the client-ready time; waiting occupies the rider and never becomes pre-assignment.

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
- S41/S42 Ringbahn geometry/orientation reference
- Datenlizenz Deutschland – Zero – Version 2.0 where applicable

The shipped runtime remains a hand-curated gameplay abstraction, not navigation-grade GIS geometry. House-number and parcel accuracy must never be implied beyond what the chosen static source snapshot supports.

### Official static candidate pipeline

The repository contains an offline candidate pipeline rather than a runtime map dependency:

```text
tools/import-ringbahn.mjs
→ documented S41/S42 interior polygon

tools/import-berlin.mjs
→ WFS street/address snapshot
→ polygon clip + deterministic projection/simplification
→ canonical street identity

tools/build-berlin-candidate.mjs
→ Detailnetz topology + address attachment
→ official street number first
→ canonical street name second
→ explicit geometric fallback last

tools/compare-berlin-candidate.mjs
→ shadow comparison against curated runtime
```

The importer preserves official RBS street numbers on addresses and Detailnetz street segments. Official Detailnetz from/to node IDs are preferred over harmless coordinate drift when building topology. Geometric address fallback is counted, surfaced and can fail the quality gate instead of silently attaching an address to a nearby parallel street.

An official candidate is not allowed to become runtime authority merely because it has more data. Shadow comparison independently gates:

- recognizable street-name overlap,
- largest connected-network share,
- official address match rate,
- geometric fallback share,
- sampled cross-city route-scale distortion.

The curated graph remains active until an actual imported snapshot passes these gates and a browser playtest confirms that the denser geometry is at least as readable and playable.

CI tests the pipeline using local fixtures; CI and runtime make no geographic network requests.

---

## 9. Spatial progression and operating doctrine

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

The map camera automatically fits newly unlocked operating bounds. Locked geography is heavily suppressed until relevant.

The 30-delivery Ring threshold is intentional: automated pacing tests showed that a 16-delivery threshold could expose the entire city in roughly two minutes under competent dispatch. The second expansion is a mid-run transition rather than an onboarding event.

Each territory expansion also offers one concise operating-doctrine decision. It reuses existing systems rather than creating a separate tech tree:

- **Signal Desk** — +1 radio bandwidth and +1 maximum Dispatch Focus.
- **Rider Care** — slower fatigue growth and shorter future autonomous breaks.
- **Client Network** — stronger future contract economics and modest deadline room.

The simulation model itself does not pause for doctrine state; only the browser choice overlay pauses presentation until the player chooses. Resolved doctrines remain visible as a tiny hoverable `S` / `R` / `C` memory badge inside the existing AREA chip.

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

Two different response families are available:

- **PRE-BRIEF / DETOUR** — spend Dispatch Focus to soften route impact and reroute riders.
- **CLIENT BUFFER** — spend client tolerance/time instead of improving the route itself.

The alternatives may be stacked deliberately, but doing so consumes resources needed elsewhere.

### Demand events

Examples:

- venue release,
- transit outage.

A district is visibly highlighted on the map. When the event starts it creates tagged contracts concentrated around that area.

Two different response families are available:

- **CAPACITY PLAN / STAGGER CLIENTS** — spend Dispatch Focus to reduce pressure or buy time.
- **SURGE PAY** — spend cash so event-generated contracts become more attractive to autonomous riders.

Every event therefore has forecast → spatial cue → pressure → multiple resource-specific responses.

---

## 11. Strategic roguelike upgrades

Upgrades should create operating styles, not only inflate numbers.

Existing system upgrades include radio bandwidth, extra rider, briefing, movement speed, client buffer, bike corridors, fatigue relief, focus capacity and reputation recovery.

Strategic upgrades add:

- **Cargo Racks** — heavy/delicate load penalties become 45% smaller,
- **Local Repeater** — same-area LOCAL calls attract riders more strongly,
- **Event Feed** — disruptions and demand surges are forecast six seconds earlier,
- **Relief Roster** — future autonomous breaks are 20% shorter.

No upgrade assigns work.

---

## 12. Map visual hierarchy

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

Motion is state feedback, not decoration. Rider orientation follows actual route direction, pickup/dropoff use short milestone feedback, and reduced-motion preferences suppress decorative animation.

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

## 13. Shift goals and upgrades

Goals are generated from the currently playable city and later expand with territory.

Examples:

- work a named street,
- cover a district,
- reliability target,
- named bridge use,
- cross-area Ring operation.

No goal or upgrade directly assigns work.

---

## 14. Post-shift learning and telemetry

The Dispatch Review classifies failures into:

- never called,
- called but no taker,
- accepted too late,
- radio-blocked decisions,
- rider breaks,
- event preparation/tool usage.

A **Critical Timeline** reconstructs high-value causal events:

- city expansions,
- event forecasts/starts/responses,
- demand bursts,
- doctrine choices,
- breaks/returns,
- radio-denied moments,
- dispatch interventions,
- failures,
- collapse.

Routine radio chatter is deliberately omitted.

A separate deterministic telemetry projection records:

- delivered/minute,
- average call delay,
- average acceptance delay,
- average delivery time,
- peak queue,
- peak radio,
- event preparations,
- city-expansion timing,
- failure mix.

This supports measured human balance work instead of tuning only by feel.

---

## 15. Determinism and architecture

Same seed reproduces the same simulation state and stochastic sequence as long as the same player actions are applied. Browser-only projections such as hover, sorting and doctrine presentation must not alter that sequence.

Core modules:

```text
src/
├── berlin.js                   curated Berlin gameplay graph
├── graph.js                    indexed pathfinding
├── rng.js                      seeded RNG
├── game-core.js                run state / contracts / city state
├── game-radio.js               autonomous rider choice
├── game-riders.js              rider lifecycle / milestones
├── game-pacing.js              progression pacing
├── game-cargo.js               cargo handling data
├── game-cargo-motion.js        effective loaded movement/fatigue + heading
├── game-availability.js        NOW / busy / break capacity projection
├── game-feasibility.js         deadline feasibility projection
├── game-insight.js             read-only dispatch/rider insight
├── game-events.js              event lifecycle
├── game-event-demand.js        demand burst generation
├── game-event-options.js       alternate event responses
├── event-data.js               extended city-event catalogue
├── game-tools.js               player interventions
├── game-expansion-policy.js    operating doctrines
├── game-strategic-upgrades.js  strategic upgrade effects
├── game-review.js              causal post-shift timeline
├── game-telemetry.js           comparable run metrics
├── camera.js                   zoom/pan/fit
├── render-map.js               geography/event rendering
├── render-entities.js          riders/contracts/routes/motion feedback
├── ui-outlook.js               future capacity UI
├── ui-feasibility.js           compact feasibility state
├── ui-queue.js                 attention/manual queue ordering
├── ui-event-options.js         contextual second event response
├── ui-expansion-policy.js      browser-only doctrine choice/memory
├── ui-telemetry.js             post-shift telemetry UI
└── main.js                     browser controller

tools/
├── berlin-import-lib.mjs       deterministic import primitives
├── berlin-graph-lib.mjs        topology/address candidate builder
├── berlin-compare-lib.mjs      shadow-comparison gates
├── import-ringbahn.mjs         offline Ring polygon importer
├── import-berlin.mjs           offline Berlin WFS importer
├── build-berlin-candidate.mjs  static candidate graph CLI
└── compare-berlin-candidate.mjs candidate-vs-runtime CLI
```

Rendering and simulation are separated. Canvas may animate continuously; DOM state projects at a slower cadence with persistent nodes.

---

## 16. Validation contract

`npm test` must remain green before a merge candidate is accepted.

Current green gate: **124 tests / 124 pass / 0 fail** plus browser/importer/comparator syntax checks.

Coverage includes, among other things:

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
- 6 → 30 full-Ring pacing under an adaptive dispatcher,
- operating doctrines without simulation-boundary leakage,
- route/weather/demand event counterplay with resource-specific alternatives,
- cargo handling speed/fatigue effects,
- strategic upgrade effects,
- rider task progress/ETA/travel heading,
- pickup/dropoff milestone feedback state,
- reduced-motion-safe entity rendering source invariants,
- future rider availability without pre-assignment,
- read-only Dispatch Insight,
- attention-first queue ordering on persistent cards,
- six-rider high-load finite-state simulation,
- stable keyed UI structure,
- event-specific UI wording and demand-area map feedback,
- causal review timeline and deterministic telemetry,
- Ringbahn polygon import/stitch validation,
- official Berlin identity/topology/address-attachment gates,
- candidate shadow comparison and route-scale checks,
- browser entry/render/outlook/feasibility/queue/doctrine/telemetry syntax checks.

A red gate is treated as either a real implementation bug or a flawed fixture; it is investigated rather than weakened automatically.

---

## 17. Reproduce locally

Requirements: modern browser, Node.js 24+ for tests, Python only for the convenience static server.

```bash
npm test
npm run serve
```

Then open:

```text
http://localhost:8080
```

Official-data candidate workflow:

```bash
npm run import:ringbahn
npm run import:berlin -- --ring-polygon=generated/ringbahn.geojson --output=generated/berlin-official.json
npm run build:berlin-candidate -- --input=generated/berlin-official.json
npm run compare:berlin-candidate -- --candidate=generated/berlin-candidate-graph.json
```

These are development actions; the game itself requires no network.

---

## 18. Design order for future iterations

Continue **inside out**:

```text
radio decision quality
→ rider behavior / availability
→ contract semantics / cargo
→ event counterplay
→ pacing / progression
→ map precision
→ UI readability / charm
→ additional content
```

Do not add breadth to compensate for a weak inner loop.

Highest-value remaining work after v5:

1. run a reviewed official Berlin snapshot through the completed candidate + shadow-comparison pipeline and browser-test it before any runtime authority switch,
2. perform real browser acceptance at multiple desktop aspect ratios and collect human run telemetry,
3. tune attention ordering, doctrine balance, event resource costs and break overlap from measured human runs,
4. add optional restrained sound feedback only if it improves state recognition and has a mute path,
5. deepen contract chains only when each new contract adds a distinct dispatch decision,
6. no second city until Berlin is excellent.
