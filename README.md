# SEND IT — Berlin Courier Dispatch Roguelike

**Send It** is a browser-based real-time logistics game about coordinating autonomous bicycle couriers through a shared radio across Berlin.

> **You control information, not riders.**

Play: `https://generalgroovy.github.io/bike/`

Current release line: **v0.12 — Google Maps basemap + progressive map detail**.

## Berlin concept playtest

This branch also includes [the Berlin desk](playtest.html), a separate small ruleset for testing simplicity, decisions, and replay appeal. Serve this directory over HTTP and open `playtest.html`. Read [the playtest guide and approval gates](docs/BERLIN_PLAYTEST.md). The three-minute training shift and nine-minute standard shift use the bundled curated graph; full mobile adaptation and another city follow tested Berlin concept approval.

---

## What the game is

You are a courier dispatcher, not a unit commander. Contracts appear around Berlin, demand changes through the shift, local service pressure builds, events alter the city, and autonomous riders decide which radio calls they want to accept.

The player never performs:

```text
rider → job
```

The real loop is:

```text
contract appears
→ decide whether it deserves airtime
→ choose OPEN / PRIORITY / LOCAL / OFF
→ autonomous riders evaluate the live calls
→ one rider may volunteer
→ read movement, fatigue, city pressure and demand
→ adapt the next broadcast
```

There is intentionally no direct `assign()` command. Tests guard this invariant across gameplay, Dispatch Insight, Rider Outlook, the UI and optional map integrations.

---

## v0.12 map system

The map is the primary game surface. Contracts live in a narrow left rail, riders in a narrow right rail, and the center of the viewport remains available to Berlin.

```text
┌──────────────────── compact command strip ────────────────────┐
│ shift · area · REP · cash · score · focus · controls         │
├─────────────┬───────────────────────────────────┬──────────────┤
│ CONTRACTS   │                                   │ RIDERS       │
│ vertical    │            BERLIN MAP             │ vertical     │
│ attention   │          nearly full height       │ live team    │
│ queue       │                                   │ state        │
│             │                                   │              │
└─────────────┴───────────────────────────────────┴──────────────┘
```

Current normal desktop geometry is approximately:

- command strip: **34 px**,
- contracts rail: **164 px**,
- riders rail: **176 px**,
- collapsed rail: **20 px**,
- center map: all remaining width and almost all viewport height.

`M` removes both rails completely. `Q` and `R` collapse them independently. `D` switches information density.

### Two basemap modes

Send It now has two map presentation modes.

#### Built-in deterministic map

The default/fallback map is shipped with the repository and requires no network or API key. It renders the curated Send It Berlin graph, districts, parks, waterways, Ringbahn orientation, street hierarchy, events, routes, clients, contracts and riders.

#### Google Maps vector basemap

Press **G** to enable the optional Google Maps JavaScript API basemap.

When active:

- Google renders the live vector road map,
- Google supplies geographic street geometry and labels,
- Google owns pan and fractional zoom,
- supported zoom is **Z11–Z19**,
- the Send It canvas becomes a transparent operational overlay,
- riders, contracts, service pressure, events and game routes remain Send It state,
- the deterministic simulation does not use Google for rider decisions or path costs.

Google map content is not scraped, copied, prefetched or stored in the repository.

### Accuracy boundary

This distinction is important:

- **Google streets and labels** are rendered by Google Maps itself.
- **Send It simulation routes** still come from the deterministic curated game graph.
- the game plane is geographically calibrated to Berlin using four canonical Ringbahn control stations: Westkreuz, Gesundbrunnen, Ostkreuz and Südkreuz,
- therefore the operational overlay is geographically aligned, but it is not navigation-grade routing geometry.

The game deliberately remains deterministic and offline-capable rather than making live Google routing part of simulation authority.

See [`docs/GOOGLE_MAPS.md`](docs/GOOGLE_MAPS.md) for the full integration design and setup.

---

## Google Maps setup

Google mode is optional. The built-in map works without it.

To enable Google mode:

1. create a Google Cloud project,
2. enable **Maps JavaScript API** and billing,
3. create a browser API key,
4. restrict the key to **Maps JavaScript API**,
5. add an HTTP-referrer restriction for the deployed game, normally:

```text
https://generalgroovy.github.io/*
```

6. open Send It,
7. press **G**,
8. paste the key into the prompt.

The key is saved only in that browser's `localStorage` under:

```text
sendit.googleMapsApiKey.v1
```

No API key is committed to this repository. Client-side Maps JavaScript API keys are visible to the browser, so security must come from Google Cloud application/API restrictions rather than attempted secrecy in JavaScript.

Public policy pages are included:

- [`privacy.html`](privacy.html)
- [`terms.html`](terms.html)

If the key is missing or invalid, billing/quota is unavailable, or the network is offline, the built-in map remains usable.

---

## Zoom and visibility hierarchy

Google mode does not simply scale every game label forever. Send It progressively discloses its own operational overlay so Google's map remains readable.

### Overview

At the widest view:

- riders and contracts remain clearly visible,
- routine rider trails disappear,
- ordinary contract IDs stay hidden,
- non-focused routes become thin and subdued,
- idle rider deliberation lines are suppressed unless meaningful,
- urgent/live work continues to stand out.

### District

At district scale:

- urgent/live contract IDs can appear,
- route context strengthens,
- pressure/event geography stays visible,
- routine labels remain restrained.

### Street

At street scale:

- rider names appear,
- contract IDs appear,
- drop markers become visible,
- selected pickup/drop address tags appear,
- route detail becomes stronger.

### Detail

At the closest zoom:

- full operational labels remain available,
- Google keeps the street/address context,
- Send It maintains approximately screen-stable entity markers and hit targets.

This prevents the game overlay from becoming a second competing street map.

---

## Map controls

| Input | Action |
|---|---|
| mouse wheel / pinch | zoom |
| drag | pan |
| `+` / `-` | zoom |
| `0` / `FIT` | fit unlocked operating area |
| `G` | Google / built-in basemap |
| `M` | full map focus |
| `Q` | collapse / restore contracts rail |
| `R` | collapse / restore rider rail |
| `D` | compact / comfortable density |
| `Space` | pause |
| `1` / `2` / `3` | 1× / 2× / 4× simulation speed |
| `H` / `?` | help |
| `Esc` | close / clear selection |

In Google mode, Google owns geographic drag/wheel/pinch behavior. `FIT`, `+`, `-` and `0` are bridged to the Google camera.

---

## Main player decisions

### Radio

| Action | Cost | Effect |
|---|---:|---|
| OFF | 0 | Hold a contract off radio. |
| OPEN | 1 bandwidth | Neutral call to listening riders. |
| PRIORITY | 2 bandwidth | Stronger attention; still not an order. |
| LOCAL | 1 bandwidth | Favors riders already near the pickup. |

Bandwidth is scarce. Broadcasting everything is usually worse than triage.

### Dispatch tools

Selected contracts can expose indirect interventions:

- **+€ Bonus** — spend cash to improve incentive,
- **Client call** — spend Dispatch Focus for more deadline room,
- **Rebroadcast** — spend Dispatch Focus to refresh rider attention,
- **Kiez Brief** — influence interest in work from one district,
- **Event response** — choose route/client or capacity/pay counterplay.

These reshape information or incentives. They do not force rider assignment.

### Rider Outlook and Dispatch Insight

Read-only projections expose information such as:

- NOW / BUSY / BREAK rider availability,
- SAFE / FUTURE / TIGHT / AT RISK feasibility,
- projected delivery slack,
- likely rider fit,
- qualitative OPEN / LOCAL / PRIORITY comparison.

They cannot reserve or commit riders.

---

## Berlin simulation

The deterministic runtime is a curated gameplay abstraction of Berlin inside the S41/S42 Ringbahn.

Current scale includes:

- 1600 × 1120 simulation space,
- 12 operating areas,
- 900+ graph nodes,
- 600+ addressable service nodes,
- 500+ visual road segments,
- 110+ Berlin street names,
- Spree and Landwehr Canal,
- major parks and landmarks,
- named bridges,
- Ringbahn orientation anchors.

### Offline official-data candidate pipeline

The repository also contains a gated pipeline for evaluating more detailed Berlin data without silently replacing the working game graph:

```text
tools/import-ringbahn.mjs
→ S41/S42 interior polygon

tools/import-berlin.mjs
→ Detailnetz + address snapshot
→ clipping / deterministic projection / simplification

tools/build-berlin-candidate.mjs
→ topology + address attachment

tools/compare-berlin-candidate.mjs
→ candidate-vs-curated quality gates
```

Imported data must pass connectivity, address-match, recognizable-street, geometric-fallback and route-scale gates before it can be considered for runtime use.

---

## Progression

```text
0 completed  → CENTER DESK
                Mitte + Kreuzberg

6 completed  → INNER CITY
                more corridors, cargo and specials

30 completed → INSIDE THE RING
                full Ring interior operation
```

Territory expansions can offer operating doctrines such as:

- **Signal Desk** — radio / Dispatch Focus capacity,
- **Rider Care** — fatigue and break recovery,
- **Client Network** — contract economics / deadline room.

---

## Cargo and special work

Cargo affects loaded speed, fatigue and future rider availability.

| Cargo | Character |
|---|---|
| Food | light, fast-turnaround |
| Parcel | standard load |
| Documents | very light |
| Grocery | heavy, tiring |
| Fragile | delicate, slower loaded pace |
| Flowers | mild delicate-load penalty |
| Keys | tiny urgent handoff |
| Medical | critical light cargo |
| Catering | bulky, strongest load penalty |
| Cold-chain | protected critical load |

Special contracts include RUSH, RETURN and scheduled pickups.

---

## City pressure, demand and FLOW

Unresolved local work creates district service pressure. Sustained overload causes explicit service breaches and reputation loss rather than an invisible failure state.

Demand follows learnable phases:

- Quiet Start,
- Lunch Rush,
- Office Sweep,
- Evening Handoff,
- Reset Window.

The next phase is forecast so the player can prepare.

Recurring fictional clients create spatial memory at real in-game address nodes.

Consistently healthy deliveries build **FLOW**, a capped positive mastery streak. Misses and service breaches reset it.

The v0.11+ kinetic HUD exposes FLOW, peak CITY pressure and current PHASE as read-only game energy.

---

## Events and counterplay

Route, weather and demand events are forecast before activation.

Examples include:

- roadworks,
- demonstrations,
- bridge squeezes,
- rain cells,
- venue releases,
- transit outages.

Responses use distinct resources and tradeoffs. Events can alter routing costs or demand but never rider autonomy.

---

## Riders

Canonical roster order:

1. Kira
2. Mauro
3. Brian
4. Sam
5. Michail
6. Zorro

A shift begins with the first three; upgrades add the rest in order.

Personality niches include Sprinter, Earner, Guardian, Local, Tourer and Steady. Riders accumulate fatigue, autonomously take radio-off breaks, recover and return. There is no cancel-break command.

---

## Sensory language

The browser-only sensory layer uses generated WebAudio and canvas/CSS feedback while remaining outside simulation authority.

It includes:

- cargo-specific delivery sonar,
- urgency-scaled ripples,
- rider speed notes and trails,
- radio-channel motifs,
- pressure pulses,
- demand/event/FLOW cues,
- optional sound.

Reduced-motion mode removes decorative movement while preserving state information.

---

## Architecture

Important modules include:

```text
src/
├── berlin.js                    curated deterministic Berlin graph
├── graph.js                     pathfinding
├── rng.js                       seeded RNG
├── game-core.js                 contracts / run / city state
├── game-radio.js                autonomous rider choice
├── game-riders.js               rider lifecycle
├── game-cargo*.js               cargo movement / fatigue
├── game-availability.js         future capacity projection
├── game-feasibility.js          deadline feasibility
├── game-insight.js              read-only dispatch insight
├── game-events*.js              events / demand / responses
├── game-service-pressure.js     district pressure / breaches
├── game-demand-rhythm.js        predictable demand phases
├── game-service-flow.js         FLOW mastery streak
├── camera.js                    built-in map camera
├── geo-reference.js             game-plane ↔ geographic calibration
├── google-basemap.js            optional Google Maps presentation bridge
├── render-map.js                built-in geography + operational overlays
├── render-entities.js           riders / contracts / routes / zoom disclosure
├── ui-runtime.js                shared visibility-aware UI scheduler
├── ui-shell.js                  rails / density / map focus
├── ui-vibe.js                   FLOW / CITY / PHASE observer
└── main.js                      browser controller
```

### Authority boundary

Google Maps, UI, rendering, sensory and insight layers may observe and present game state. They may not become simulation authority.

The Google bridge does **not**:

- set radio channels,
- assign or claim jobs,
- spawn contracts,
- advance simulation time,
- change RNG order,
- replace deterministic route costs.

---

## Performance architecture

The project maintains:

- bounded deterministic route memoization,
- explicit routing invalidation,
- O(1) delivery / courier / edge lookup fast paths,
- cached playable-address pools,
- memoized Dispatch Insight,
- one-pass service-load aggregation,
- one visibility-aware browser UI scheduler,
- background-tab UI downshift,
- renderer viewport culling,
- paused-render downshift,
- stable keyed DOM nodes to prevent click cancellation and flicker.

Google mode retains the same deterministic simulation and overlays only presentation state.

---

## Validation

`npm test` is the merge gate.

Coverage includes:

- deterministic RNG and same-seed reproduction,
- autonomous radio choice and no direct assignment API,
- rider fatigue / breaks / personality balance,
- cargo mechanics,
- city progression,
- event counterplay,
- service pressure and FLOW,
- demand rhythm and recurring clients,
- feasibility / Dispatch Insight read-only boundaries,
- Berlin graph and candidate-import quality gates,
- route-cache invalidation,
- renderer culling,
- keyed-DOM interaction stability,
- map-first layout and rail collapse,
- reduced-motion / high-contrast fallbacks,
- geographic control-point round trips,
- Google Z11–Z19 scale conversion,
- Google API-key isolation,
- Google presentation-only authority boundary,
- attribution-safe map chrome,
- progressive game-overlay disclosure across Google zoom bands.

The remaining test-infrastructure goal is true browser E2E pointer/keyboard coverage. Source-level UI contracts are not treated as a substitute for that.

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

The game runs without network access in built-in-map mode. Google mode naturally requires network access and a configured Maps JavaScript API key.

Official-data candidate workflow:

```bash
npm run import:ringbahn
npm run import:berlin -- --ring-polygon=generated/ringbahn.geojson --output=generated/berlin-official.json
npm run build:berlin-candidate -- --input=generated/berlin-official.json
npm run compare-berlin-candidate -- --candidate=generated/berlin-candidate-graph.json
```

---

## Design order

Continue inside-out:

```text
radio decision quality
→ rider behavior / availability
→ contract semantics / cargo
→ event counterplay
→ pacing / progression
→ Berlin readability / geographic alignment
→ map overview / zoom visibility
→ sensory polish
→ additional content
```

Do not add breadth to compensate for a weak inner loop. Berlin remains the benchmark city until geography, interaction, learning, readability, performance and the single-run dispatch loop are excellent.
