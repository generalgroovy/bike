# Send It v11 — deep game / UX / visual audit

This audit treats **Send It** as a game first and a logistics dashboard second. The core invariant remains non-negotiable:

> You control information, not riders.

The goal is to make the existing simulation easier to read, more expressive, more kinetic and more fun without turning riders into directly commanded units or making the browser layer authoritative.

## Executive assessment

The simulation is substantially deeper than the old visual presentation suggested. The game already contains autonomous rider personalities, radio bandwidth, fatigue, cargo handling, future availability, feasibility, district pressure, recurring clients, predictable demand phases, events, FLOW, upgrades, doctrines and a large Berlin graph. The primary weakness was not lack of mechanics; it was **presentation compression**.

The pre-v11 UI presented too many systems with similar beige/grey weight, tiny labels and layered CSS overrides. That made the game feel like a dense admin dashboard even when the underlying state was volatile and interesting.

v11 therefore prioritizes:

1. visual hierarchy,
2. immediate cause/effect feedback,
3. kinetic but restrained motion,
4. stable browser interaction,
5. readable radio decisions,
6. map dominance,
7. coherent style identity,
8. accessibility and deterministic isolation.

---

## Critical inconsistencies found

### 1. Runtime stylesheet injection made visual behavior order-dependent

The shell injected `ui-minimal-map-context.css`, `ui-map-overview.css` and `ui-v10-stable-map.css` after the document had already painted. This meant:

- layout could visibly shift after initial paint,
- late rules could temporarily override earlier work,
- debugging depended on injection order rather than one static cascade,
- future visual changes were easy to break accidentally.

**v11 implementation:** all style layers are now linked statically in `index.html`, in deterministic order, with `ui-v11-kinetic.css` as the final visual authority. Runtime link injection is removed from `ui-shell.js`.

### 2. Visual importance did not match gameplay importance

Riders, urgent jobs, normal streets, passive labels, client hubs and district context often occupied a similarly muted tonal range. The player had to consciously parse information that should be visible pre-attentively.

**v11 implementation:**

- dark operational rails,
- warm cartographic map,
- cyan = OPEN / information,
- amber = PRIORITY / rising pressure,
- mint = LOCAL / healthy FLOW,
- coral = urgency / breach / danger,
- rider colors remain unique identity and route colors.

The result is a stronger foreground/background hierarchy without changing any simulation values.

### 3. Space optimization had crossed into micro-typography

Several core radio controls and task metadata were rendered at roughly 5–6 px. That is efficient in raw pixels but poor in scan speed, confidence and click satisfaction.

**v11 implementation:** primary radio action labels are brought back to a more legible size and gain stronger channel color differentiation. Secondary metadata stays compact.

### 4. FLOW existed mechanically but did not feel like momentum

FLOW affects score and local pressure, but its positive streak state was mostly buried in transient text and post-shift review. A mastery system should feel good while it is happening.

**v11 implementation:** a read-only kinetic HUD exposes:

- FLOW streak and seven pips,
- current peak CITY pressure,
- current predictable demand PHASE.

FLOW milestones create a short visual bloom. Service breaches create a short alert bloom. These are observer effects only.

### 5. The interface looked more static than the game actually is

The simulation contains rider deliberation, route movement, demand rhythm, district overload and event escalation, yet large parts of the interface looked like passive tables.

**v11 implementation:** motion is concentrated on meaningful state:

- urgent unresolved work has a restrained pulse,
- PRIORITY calls breathe subtly,
- FLOW milestones and breaches create short map-wide response flashes,
- hover/selection moves remain small and tactile,
- reduced-motion mode disables decorative animation.

### 6. Help/documentation lagged behind controls and releases

The game had reached v0.10 while README still identified the current release as v0.9. Help text also under-described Q/R independent rails and the momentum layer.

**v11 implementation:** release/help documentation is updated to the current control model and visual language.

---

## Interaction / correctness findings

### Stable keyed DOM is essential

v10 correctly fixed repeated re-appending of already-mounted task and rider nodes. That bug could move a live target between pointer down/up, causing cancelled clicks and visible flicker.

v11 explicitly preserves this stability layer and loads it before the new visual observer.

### UI observer boundary remains clean

The new `ui-vibe.js` reads:

- `serviceFlowState()`,
- `cityPressure()`,
- `demandPhase()`,
- read-only run stats.

It never calls radio mutation, rider selection authority, delivery spawning, upgrade application, event response or `game.update()`.

### Remaining testing gap: real browser E2E

The repository has strong deterministic simulation tests and increasingly good source-level UI regression tests. It still lacks a true browser automation suite that performs actual pointer and keyboard interactions in Chromium/WebKit/Firefox.

This is the most important remaining test-infrastructure gap. A future browser gate should verify at minimum:

- click OPEN / PRIORITY / LOCAL / OFF repeatedly while UI refreshes,
- select contracts and riders during simulation updates,
- drag + click canvas entities,
- Q/R rail collapse and restore,
- M map focus and D density,
- zoom controls and wheel zoom,
- help/modal open-close,
- reduced-motion rendering,
- resize at 1366×768, 1920×1080 and ultrawide.

---

## Style audit

### Previous identity

The earlier presentation was coherent but visually conservative:

- warm off-white paper,
- grey lines,
- small utilitarian labels,
- low-saturation operational colors,
- minimal motion.

That style supported clarity but undersold speed, urgency, personality and courier culture.

### v11 identity: Berlin courier zine × live dispatch board

The new style intentionally combines two layers:

**Map:** warm print-like Berlin board, paper texture, stronger saturation, readable geography.

**Operations:** dark graphite/navy rails inspired by dispatch consoles, messenger bags, night streets and screen-printed gig posters.

**Accents:** bright functional color rather than decoration.

This keeps the map playful and tactile while making the controls feel precise and fast.

---

## Gameplay design assessment

### What is already strong

- autonomous riders make dispatch indirect rather than RTS-like,
- radio bandwidth creates real triage,
- personalities generate imperfect but learnable behavior,
- fatigue makes rider availability temporal,
- Berlin geography creates spatial memory,
- recurring clients reinforce place recognition,
- demand rhythm gives predictable macro-pacing,
- service pressure gives district-level consequences,
- events create counterplay rather than random punishment,
- FLOW rewards sustained mastery,
- no-direct-assignment tests protect the central fantasy.

### Where fun can improve next

#### A. Stronger short-term arcs

Current decisions are individually meaningful, but the player can still experience them as a stream of similar contract triage.

Recommended next slice:

- 45–90 second “city beats” that combine demand phase + event + client cluster,
- no new currency,
- no forced scripted outcomes,
- use existing systems to create recognizable mini-stories such as lunch crush, rain + clinic surge, office sweep or venue release.

#### B. More rider personality expression

Personality mostly affects decision scoring. Make that difference more visible without adding direct control:

- unique deliberation visual motif per personality,
- short contextual thought tags on hover (e.g. `CLOSE`, `PAYOUT`, `CRITICAL`, `LONG RUN`),
- post-shift “what this rider preferred” summary.

#### C. Better positive feedback, not more punishment

Pressure and missed deadlines are already clear. Positive play should be equally vivid:

- FLOW transitions,
- clean handoff streaks,
- rider milestone cues,
- recurring-client appreciation / reputation texture,
- low-key celebratory map motion.

v11 begins this with the FLOW kinetic HUD.

#### D. More meaningful quiet windows

Reset Window currently lowers demand. It can become a deliberate recovery beat where the player notices:

- riders returning from breaks,
- district load draining,
- bandwidth clearing,
- opportunity to prepare calls before the next phase.

No new action is necessary; presentation can make the existing rhythm more legible.

#### E. Route readability at high density

When many riders are active, all route/deliberation lines can compete with streets and jobs.

Recommended renderer slice:

- full opacity route only for selected/hovered rider,
- active non-focused routes slightly thinner and lower alpha,
- reduce predicted attention lines at low zoom,
- preserve accessibility by keeping rider color + marker identity.

---

## Technical debt / maintainability

### CSS generation layers

The project still carries several historical style files (`styles.css`, overhaul, clarity, minimal, map-overview, v10, v11). Static ordering removes runtime instability, but this remains maintainability debt.

Recommended after v11 acceptance:

1. capture browser screenshots / visual baselines,
2. fold active rules into 2–3 semantic stylesheets,
3. delete superseded rules,
4. retain regression tests for geometry and accessibility,
5. avoid another “override layer” unless it is temporary.

### Main browser controller size

`main.js` continues to own substantial DOM rendering and event wiring. Long term, stable keyed component creation/update can be split by task/rider/inspector while keeping mutation authority centralized.

### Canvas visual APIs

`render-map.js` and `render-entities.js` are dense, minified-style modules. Refactoring into smaller visual primitives would make future art-direction work safer and easier to test.

---

## v11 implementation summary

Implemented in this slice:

- deterministic static stylesheet ordering,
- removed runtime CSS injection,
- new dark dispatch / warm map visual identity,
- stronger radio channel semantics,
- larger and more readable primary action labels,
- task/rider surface redesign,
- active/urgent/priority motion language,
- read-only FLOW / CITY / PHASE kinetic HUD,
- positive FLOW and breach flash feedback,
- reduced-motion and high-contrast fallbacks,
- updated help/control language,
- preserved v10 DOM stability and click contracts,
- version bump to 0.11.0,
- new v11 regression tests.

Not implemented intentionally in this visual slice:

- direct rider controls,
- new currencies,
- extra city breadth,
- authoritative UI automation,
- browser E2E dependency stack,
- gameplay balance changes without measured play data.

---

## Recommended next order

1. real browser E2E interaction gate,
2. measured playtest at 1×/2×/4× with 10–20 jobs,
3. route-density renderer cleanup,
4. personality expression cues,
5. short city-beat / mini-story pacing using existing systems,
6. post-shift learning improvements,
7. CSS consolidation after visual acceptance,
8. official Berlin candidate adoption only if readability and quality gates pass.
