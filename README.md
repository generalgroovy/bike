# SEND IT — Berlin Courier Dispatch Roguelike

**Send It** is a browser-based real-time logistics simulation about coordinating autonomous bicycle couriers through a shared radio across a dense, deterministic model of Berlin.

> **You control information, not riders.**

Play: `https://generalgroovy.github.io/bike/`

Current release line: **v0.9 — map-overview GUI**.

---

## Core idea

You are a courier dispatcher, not a unit commander. Contracts arrive, the city develops pressure, events alter routes and demand, and imperfect autonomous riders decide which live radio calls they want to accept.

The player never performs:

```text
rider → job
```

The actual loop is:

```text
contract appears
→ decide whether it deserves airtime
→ choose OPEN / PRIORITY / LOCAL / OFF
→ autonomous riders evaluate the live calls
→ one rider volunteers
→ observe movement, fatigue, district pressure and events
→ adapt the next broadcast
```

There is intentionally no direct `assign()` API. Tests guard this invariant across gameplay, Rider Outlook, Dispatch Insight and all GUI layers.

---

## v0.9 GUI: map first

The interface is designed around one rule: **the Berlin map should own as much of the viewport as possible**.

Normal desktop layout:

```text
┌──────────────── compact command strip ────────────────┐
│ shift · area · REP · cash · score · focus · controls │
├──────────────┬───────────────────────────┬─────────────┤
│ CONTRACTS    │                           │ RIDERS      │
│ vertical     │       BERLIN MAP          │ vertical    │
│ attention    │       full height         │ team state  │
│ queue        │                           │ + goals     │
│              │                           │             │
│              │                           │             │
└──────────────┴───────────────────────────┴─────────────┘
```

### Space budget

- command strip: about **38 px** in normal mode,
- left contract rail: about **188 px**,
- right rider rail: about **204 px**,
- center map: consumes all remaining width and nearly all viewport height,
- collapsed rail: only **24 px** remains as a restore handle,
- compact density mode tightens the rails and top strip further,
- full map-focus mode removes both side rails completely.

The previous permanent horizontal work queue is gone. Contracts now scroll vertically beside the map, so increasing queue pressure no longer steals map height.

### Rail controls

| Key | Action |
|---|---|
| `Q` | Collapse / restore the contract rail |
| `R` | Collapse / restore the rider rail |
| `M` | Full map focus: hide both rails |
| `D` | Toggle comfortable / compact density |

Rail states persist locally where appropriate. Collapsing a rail is presentation-only and never changes simulation state.

### Contract rail

The left rail is an attention-first vertical work queue.

Each compact contract instrument exposes only live decision information:

- cargo glyph,
- ID / special tag,
- deadline,
- pickup identity,
- distance / payout / state metadata,
- OPEN / PRIORITY / LOCAL / OFF radio controls.

The queue defaults to **ATTENTION** ordering:

1. at-risk and tight contracts,
2. live calls with no taker,
3. important special work,
4. ordinary waiting work,
5. already committed work.

Manual sort views remain available for arrival, urgency, payout and pickup range. Sorting changes CSS order on persistent keyed nodes; it does not mutate deterministic simulation state.

### Rider rail

The right rail is a dense team instrument rather than a card wall.

It shows:

- rider identity and stable color,
- personality / experience where space allows,
- LISTENING / THINKING / RIDING / BREAK state,
- task progress and ETA,
- energy / fatigue reserve,
- ready / riding / rest summary,
- collapsible shift goals.

Richer location and contextual detail remains available through hover and selection instead of permanently consuming rail width.

### Map HUD

Systemic context stays on the map rather than occupying another dashboard column:

- CITY LOAD / district pressure,
- current + next demand rhythm,
- event forecast / active event state,
- selected-contract inspector,
- zoom and time controls,
- notices and spatial event overlays.

The contract inspector is intentionally shallow so selecting a job does not cover a large part of Berlin.

### Map visual hierarchy

From strongest to weakest:

1. riders,
2. selected / live / urgent contracts,
3. routes and rider deliberation,
4. active event effects,
5. event forecasts,
6. recurring clients / landmarks / Ringbahn orientation,
7. road hierarchy,
8. districts, parks and decoration.

Progressive disclosure keeps the dense city readable:

- overview: arterials + operational entities,
- closer: primary streets,
- higher zoom: secondary streets + labels,
- selected work: exact pickup/drop and route context.

---

## Controls

```text
mouse wheel   zoom at pointer
left drag     pan
+ / −         zoom
FIT / 0       fit unlocked operating area
Space         pause
1 / 2 / 3     1× / 2× / 4× simulation speed
Q             collapse / restore contract rail
R             collapse / restore rider rail
M             full map focus
D             compact / comfortable density
H / ?         help
Esc           close / clear selection
```

Accessibility contracts remain in place:

- keyboard-operable controls,
- explicit ARIA labels for radio and rail actions,
- `prefers-reduced-motion` fallbacks,
- `prefers-contrast` fallbacks,
- audio is optional and never the sole carrier of state.

---

## Main player decisions

### Radio

| Action | Cost | Effect |
|---|---:|---|
| OFF | 0 | Hold a contract off radio. |
| OPEN | 1 bandwidth | Neutral call to listening riders. |
| PRIORITY | 2 bandwidth | Stronger rider attention; still not an order. |
| LOCAL | 1 bandwidth | Favors riders already near the pickup. |

Bandwidth is deliberately scarce. Calling everything is usually worse than triage.

### Dispatch tools

The selected-contract inspector exposes interventions that reshape incentives or timing without bypassing autonomy:

- **+€ Bonus** — spend cash to increase payout,
- **Client call** — spend Dispatch Focus for extra deadline time,
- **Rebroadcast** — spend Dispatch Focus to refresh rider attention,
- **Kiez Brief** — influence interest in work from one district,
- **Event response** — choose route/client or capacity/pay counterplay.

### Rider Outlook and Dispatch Insight

Read-only projections show:

- NOW / BUSY / BREAK rider availability,
- SAFE / FUTURE / TIGHT / AT RISK feasibility,
- projected delivery slack,
- likely rider fit,
- qualitative OPEN / LOCAL / PRIORITY comparison.

These systems never reserve, assign or force a rider.

---

## Berlin is the board

The first city is a static deterministic gameplay model of Berlin inside the S41/S42 Ringbahn.

Current runtime scale includes:

- 1600 × 1120 game-space extent,
- 12 operating areas,
- 900+ graph nodes,
- 600+ addressable service nodes,
- 500+ visual road blocks,
- 110+ real Berlin street names,
- Spree + Landwehr Canal,
- major parks and landmarks,
- named bridges,
- Ringbahn orientation anchors including Westkreuz, Gesundbrunnen, Ostkreuz and Südkreuz.

The shipped runtime is a curated gameplay abstraction, not navigation-grade GIS geometry.

### Offline official-data candidate pipeline

The repository contains a gated static candidate pipeline:

```text
tools/import-ringbahn.mjs
→ S41/S42 interior polygon

tools/import-berlin.mjs
→ Detailnetz + address snapshot
→ polygon clipping
→ deterministic projection / simplification
→ canonical street identity

tools/build-berlin-candidate.mjs
→ topology + address attachment
→ official street number first
→ canonical street name second
→ explicit geometric fallback last

tools/compare-berlin-candidate.mjs
→ candidate-vs-curated shadow comparison
```

An imported graph cannot become runtime authority merely because it contains more data. It must clear connectivity, address-match, geometric-fallback, recognizable-street and route-scale gates, then remain readable in an actual browser playtest.

Runtime and CI do not depend on geographic network access.

---

## Progression

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
full Ring interior operation
highest-tier cargo
```

Each territory expansion can also offer one operating doctrine:

- **Signal Desk** — more radio / Dispatch Focus capacity,
- **Rider Care** — better fatigue and break recovery,
- **Client Network** — stronger future contract economics / deadline room.

---

## Cargo and special contracts

Cargo changes loaded speed, fatigue and downstream rider availability.

| Cargo | Character |
|---|---|
| Food | light, fast-turnaround |
| Parcel | standard load |
| Documents | very light |
| Grocery | heavy, more tiring |
| Fragile | delicate, slower loaded pace |
| Flowers | mild delicate-load penalty |
| Keys | tiny urgent handoff |
| Medical | critical light cargo |
| Catering | bulky, strongest load penalty |
| Cold-chain | protected critical load |

Special contracts include:

- **RUSH** — tighter time / higher appeal,
- **RETURN** — paid reverse follow-up after successful completion,
- **Scheduled pickup** — rider may volunteer early but must wait for client-ready time.

---

## City pressure, demand and mastery

### District service pressure

Unresolved local work creates spatial pressure. Sustained overload causes an explicit **service breach** with reputation consequences rather than an invisible fail state.

### Predictable demand rhythm

Demand cycles through learnable phases:

- Quiet Start,
- Lunch Rush,
- Office Sweep,
- Evening Handoff,
- Reset Window.

The next phase is forecast so the player can prepare instead of merely react.

### Recurring clients

Fictional kitchens, clinics, offices, markets, studios and workshops recur at real in-game address nodes, creating spatial memory without stereotyping whole districts by cargo type.

### FLOW

Consistently healthy deliveries build a capped positive FLOW streak. Misses and service breaches reset it. FLOW rewards sustained dispatch quality without becoming another spendable currency.

---

## Events and counterplay

Route, weather and demand events are forecast before activation.

Examples:

- roadworks,
- demonstrations,
- bridge squeezes,
- rain cells,
- venue releases,
- transit outages.

Response families deliberately use different resources:

- pre-brief / detour,
- client buffer,
- capacity planning / stagger clients,
- surge pay.

Events change routes or demand, never rider autonomy.

---

## Riders

Canonical roster order:

1. Kira
2. Mauro
3. Brian
4. Sam
5. Michail
6. Zorro

A new shift starts with the first three; upgrades add the rest in order.

Personality niches:

- **Sprinter** — close + urgent,
- **Earner** — profitable work,
- **Guardian** — critical / medical,
- **Local** — nearby pickups,
- **Tourer** — long cross-city work,
- **Steady** — balanced generalist.

Riders accumulate fatigue, can autonomously take RADIO OFF breaks, recover, and return. There is no cancel-break command.

---

## Sensory language

The browser-only sensory layer uses generated WebAudio and canvas/CSS feedback while remaining outside simulation authority.

- shared D-minor-pentatonic / 102 BPM palette,
- periodic cargo-specific delivery sonar,
- urgency-scaled sonar/ripples,
- rider speed notes,
- speed/heat trails,
- radio-channel motifs,
- pressure pulses,
- Kiez Brief bloom,
- demand-phase motifs,
- event / goal / upgrade / FLOW cues,
- optional sound toggle.

Reduced-motion mode removes decorative movement while preserving state information.

---

## Performance architecture

v0.7+ introduced a dedicated performance layer that remains part of the product contract:

- bounded deterministic route memoization,
- explicit routing invalidation after network-cost changes,
- O(1) delivery / courier / edge lookup fast paths,
- cached playable-address pools,
- memoized Dispatch Insight projections,
- one-pass district service-load aggregation,
- one visibility-aware browser UI scheduler instead of timer-per-widget polling,
- background-tab UI downshift,
- throttled district hover diagnostics,
- pre-resolved Berlin visual-edge geometry,
- viewport culling for roads, labels, stations, landmarks and clients,
- paused-render downshift,
- renderer drawn/culled edge diagnostics.

Caching is observational only: fixed-step simulation order, RNG state and authoritative decisions remain deterministic.

---

## Architecture

Core modules include:

```text
src/
├── berlin.js                    curated Berlin graph
├── graph.js                     pathfinding
├── rng.js                       seeded RNG
├── game-core.js                 run / contracts / city state
├── game-radio.js                autonomous rider choice
├── game-riders.js               rider lifecycle
├── game-cargo*.js               cargo handling / movement
├── game-availability.js         future capacity projection
├── game-feasibility.js          deadline feasibility
├── game-insight.js              read-only dispatch insight
├── game-events*.js              event lifecycle / demand / responses
├── game-service-pressure.js     district pressure / breaches
├── game-demand-rhythm.js        predictable demand phases
├── game-client-hubs.js          recurring clients
├── game-district-brief.js       Kiez Brief
├── game-service-flow.js         FLOW mastery streak
├── game-review.js               post-shift timeline
├── game-telemetry.js            deterministic metrics
├── camera.js                    zoom / pan / visible bounds
├── render-map.js                geography + event rendering
├── render-entities.js           riders / contracts / trails
├── ui-runtime.js                shared visibility-aware scheduler
├── ui-shell.js                  map-first operator shell / rail controls
├── ui-queue.js                  attention sorting
├── ui-outlook.js                future rider capacity UI
├── ui-feasibility.js            feasibility state
├── ui-sensory.js                browser-only sensory observer
└── main.js                      browser controller
```

The GUI layer may observe and present simulation state but may not become simulation authority.

---

## Validation

`npm test` is the merge gate.

Coverage includes:

- deterministic RNG and same-seed reproduction,
- dense Berlin connectivity and addresses,
- no direct rider assignment API,
- autonomous radio choice,
- radio bandwidth,
- breaks and recovery,
- personality balance,
- cargo mechanics,
- city progression,
- event counterplay,
- service pressure and breaches,
- demand rhythm,
- recurring clients,
- Kiez Brief,
- FLOW,
- strategic upgrades and doctrines,
- Dispatch Insight / Rider Outlook read-only boundaries,
- deterministic telemetry and post-shift review,
- Berlin import / candidate / shadow-comparison gates,
- sensory observer isolation,
- route-cache invalidation,
- shared UI scheduler contracts,
- renderer culling and paused-frame behavior,
- minimal GUI space budgets,
- full-height map-overview layout,
- independently collapsible contract and rider rails,
- responsive / low-height / reduced-motion / high-contrast fallbacks.

A red gate is investigated rather than weakened automatically.

---

## Run locally

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

The game itself requires no network.

---

## Design order

Continue inside-out:

```text
radio decision quality
→ rider behavior / availability
→ contract semantics / cargo
→ event counterplay
→ pacing / progression
→ Berlin readability / precision
→ GUI map overview and scan speed
→ sensory polish
→ additional content
```

Do not add breadth to compensate for a weak inner loop. Berlin remains the benchmark city until geography, interaction, learning, sensory clarity, performance and the single-run dispatch loop are excellent.
