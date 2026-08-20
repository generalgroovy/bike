# BIKE — Berlin Dispatch Roguelike

BIKE is a browser strategy game about **indirectly coordinating autonomous bicycle couriers through a shared radio**.

> The dispatcher chooses what work is available on the radio. Riders choose for themselves.

This README is the **authoritative design and implementation specification**. A contributor should be able to reproduce the intended game from this document without relying on hidden context.

## 1. Product identity

BIKE combines:

- a readable map-first logistics game,
- a simplified but recognizable real-city street network,
- autonomous rider personalities,
- radio bandwidth as the player's main resource,
- procedural/roguelike shift variation,
- short escalating runs with post-shift analysis.

It is not a direct unit-control game, a GIS application, or a delivery-company spreadsheet.

### Core invariant

```text
job exists
→ dispatcher chooses OFF / OPEN / PRIORITY / LOCAL
→ riders with radio on evaluate live calls
→ riders visibly deliberate
→ one rider autonomously claims a job
→ dispatcher adapts the next choice set
```

There must be **no rider → job assignment command**.

## 2. First city: Berlin

The first playable city is central Berlin.

The map is deliberately simplified, but its macro geometry and important street relationships are based on real Berlin map references. It uses named corridors including:

- Kurfürstendamm
- Kantstraße
- Bismarckstraße
- Straße des 17. Juni
- Tiergartenstraße
- Invalidenstraße
- Müllerstraße
- Brunnenstraße
- Schönhauser Allee
- Prenzlauer Allee
- Torstraße
- Unter den Linden
- Friedrichstraße
- Leipziger Straße
- Karl-Marx-Allee
- Frankfurter Allee
- Warschauer Straße
- Mühlenstraße / Stralauer Allee
- Oranienstraße
- Gitschiner / Skalitzer Straße
- Mehringdamm
- Kottbusser Damm
- Karl-Marx-Straße
- Hermannstraße
- Sonnenallee
- Tempelhofer Damm

Landmarks include Brandenburger Tor, Reichstag, Hauptbahnhof, Alexanderplatz, Fernsehturm, Museumsinsel, Checkpoint Charlie, Zoologischer Garten, Siegessäule, Mauerpark, East Side Gallery, Oberbaumbrücke, Görlitzer Park, Hermannplatz and Tempelhofer Feld.

### Map-source policy

The runtime does **not** fetch commercial map tiles or require an API key. The static game graph is hand-curated from public map references so GitHub Pages remains offline-capable and deterministic.

Primary references for reproduction:

- Berlin Senate, higher-level street network: `https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/verkehrsplanung/strassen-und-kfz-verkehr/uebergeordnetes-strassennetz/`
- Berlin Geoportal: `https://www.berlin.de/sen/stadt/stadtdaten/geodaten-berlin/geoportal-daten-und-dienste/`
- OpenStreetMap: `https://www.openstreetmap.org/#map=12/52.52/13.405`

The game map is **not suitable for navigation**.

### Simplification rules

Preserve:

1. relative west/east/north/south placement,
2. recognizable named corridors,
3. major crossings and chokepoints,
4. Spree and Landwehr Canal as spatial anchors,
5. landmark relationships,
6. enough intersections for meaningful route choice.

Remove:

1. residential micro-streets that add no strategic choice,
2. building footprints,
3. turn-lane/lane-count detail,
4. real-time traffic,
5. navigation-grade geometry.

The target is **more detailed than a board-game graph, far simpler than a real map**.

## 3. Visual design system

The GUI is map-first and intentionally quieter than previous neon versions.

### Base palette

- warm paper background = city/map plane,
- neutral grey streets = infrastructure,
- blue water = geographic anchor,
- desaturated green parks = geographic anchor,
- faint district tint = orientation only,
- saturated job/rider colors = interactive state.

### Information hierarchy

The map should be read in this order:

1. riders,
2. urgent jobs,
3. live radio calls,
4. committed rider routes,
5. road disruptions,
6. landmarks,
7. named streets,
8. districts and parks.

### Job classification

Every delivery type has both shape and color:

| Type | Glyph | Color role |
|---|---:|---|
| Food | ▲ | pink |
| Parcel | ● | amber |
| Documents | ■ | teal |
| Medical | ✚ | red |
| Grocery | ⬢ | green |
| Fragile | ◆ | purple |

Color is never the only state signal.

### Radio classification

| State | Cost | Meaning |
|---|---:|---|
| OFF | 0 | riders cannot consider the job |
| OPEN | 1 | neutral broadcast |
| PRIORITY | 2 | stronger attention signal, still not an order |
| LOCAL | 1 | favors riders already near the pickup |

### Rider classification

- colored triangle = active rider,
- number inside rider = experience level,
- white decision ring = deliberation progress,
- grey rider with `Ⅱ` = break / radio off,
- dashed rider-colored line = committed route,
- faint dotted line = current likely choice.

## 4. Stable GUI / no flicker rule

Dynamic list containers must **not** be rebuilt every simulation tick.

The UI uses keyed DOM reconciliation:

- one persistent DOM node per job ID,
- one persistent DOM node per rider ID,
- one persistent DOM node per goal ID,
- text/classes/styles update in place,
- nodes are only created/removed when entities enter or leave a list.

Do not replace `innerHTML` for the entire radio board or rider roster during the render loop. This is a project-level rule because replacing lists caused visual flicker and unstable hover/focus behavior.

Canvas rendering may redraw each animation frame; DOM projection is throttled independently.

## 5. Map controls

- **Mouse wheel**: zoom around cursor.
- **Drag map**: pan.
- **+ / −**: zoom.
- **1:1 button or `0`**: reset map.
- Zoom range: approximately `0.85×` to `4×` the fitted map scale.
- Street labels appear progressively as zoom increases to avoid clutter.

Camera changes are render-only and must not affect simulation determinism.

## 6. Controls overview

A `CONTROLS` button and `?` / `H` keyboard shortcut toggle the quick-reference overlay.

The overview must explain, on one screen:

1. the dispatcher does not assign riders,
2. radio channel costs,
3. job glyph meanings,
4. rider marker meanings,
5. break/radio-off state,
6. wheel zoom and drag pan,
7. pause and speed shortcuts,
8. the reputation loss condition.

The first browser session opens this overview automatically and pauses the game until dismissed.

## 7. Rider roster

Canonical rider-name order:

1. Kira
2. Mauro
3. Brian
4. Sam
5. Michail
6. Zorro

A shift starts with the first three. `Extra Rider` upgrades add the next names in order. No random generated rider names are used.

Each rider also has a seeded personality, experience level, home-area bias, speed variance and fatigue state.

### Personalities

- **Sprinter** — proximity + urgency
- **Earner** — payout
- **Guardian** — urgency + medical work
- **Local** — nearby/familiar pickup
- **Tourer** — landmark and longer routes
- **Steady** — balanced

### Experience

`Rookie → Regular → Experienced → Veteran`

Higher experience means faster deliberation and lower decision noise.

## 8. Breaks and radio-off state

Riders are people, not permanently available units.

### Fatigue

- increases while riding,
- recovers very slowly while idle,
- recovers rapidly on break,
- influences willingness to take work slightly.

### Autonomous break behavior

After delivery completion, a sufficiently fatigued rider may take a break.

During a break:

```text
phase = break
radioOn = false
cannot deliberate
cannot claim jobs
marker is grey
rider card is grey
status reads BREAK / RADIO OFF
countdown shows return time
```

When the break ends the rider automatically switches radio back on and returns to `idle`.

Breaks preserve the indirect-control fantasy: the dispatcher adapts to rider availability rather than commanding breaks on/off.

## 9. Delivery generation

Cargo category is intentionally **independent of district identity**.

Districts matter for:

- spatial position,
- route distance,
- goals,
- landmark containment,
- rider locality,
- street/bridge geometry.

They do not define `Kreuzberg = food`, `Mitte = documents`, etc.

Each job contains:

```text
id
category
pickup node
dropoff node
created time
deadline
reward
radio state/channel
claim state
rider
ridden edges
```

## 10. Autonomous rider choice

For every radio-on idle rider, live calls are scored from:

- route travel cost to pickup,
- urgency,
- payout,
- personality weights,
- same-district/locality bias,
- medical bias,
- landmark bias,
- fatigue,
- radio channel,
- experience-scaled decision noise.

Do not show exact utility numbers to the player.

Expose instead:

- likely job,
- deliberation progress,
- personality,
- experience,
- current status,
- last decision explanation.

## 11. Simulation states

### Rider states

```text
idle + radioOn
idle + deliberating
pickup
dropoff
break + radioOff
```

### Delivery states

```text
waiting/off-radio
waiting/broadcast
claimed
completed
failed
```

The fixed-step simulation runs independently from rendering.

## 12. Routing

The city is an undirected weighted graph.

Edge cost is approximately:

```text
distance / (street speed × bike-lane multiplier × event multiplier)
```

Shortest-path routing uses Dijkstra-style graph traversal in `src/graph.js`.

Named street segments carry metadata:

```text
streetName
roadClass
bikeLane
bridgeId
eventMultiplier
```

Road events can temporarily raise travel cost. Riders reroute at graph nodes rather than teleporting or changing route continuously mid-edge.

## 13. Dynamic Berlin events

Current event families:

- roadworks,
- demonstration,
- bridge squeeze.

Events are forecast before activation. Forecast streets are visually distinct from active disruptions so the player can react before a route becomes bad.

## 14. Roguelike run structure

A seed controls:

- rider personality/experience combinations,
- starting fatigue,
- job stream,
- city goals,
- run trait,
- event timing,
- upgrade order,
- bike-lane promotions.

The Berlin street skeleton remains fixed and learnable.

Current shift traits:

- Express Berlin
- Green Wave
- Tourist Saturday
- Rain Shift

Current upgrades:

- Radio Bandwidth
- Extra Rider
- Team Briefing
- Street Legs
- Client Buffer
- Bike-Lane Grant
- Local Goodwill

## 15. Goals

Goals make geography matter without coupling cargo type to district.

Examples:

- serve a named landmark,
- complete jobs touching a district,
- complete deliveries that actually cross a named bridge,
- reach a reliability milestone.

Bridge goals inspect the ridden graph edges, not a visual approximation.

## 16. Failure and review

Missed deadlines reduce reputation. Medical failures carry a larger penalty. At `0 REP`, the shift ends.

Post-shift review should separate at least:

- never called,
- called but no taker,
- accepted too late,
- radio changes blocked by capacity,
- number of rider breaks.

The purpose is to make same-seed retries educational rather than opaque.

## 17. Repository architecture

```text
index.html             persistent GUI shell
styles.css             visual system / responsive layout
src/
  berlin.js            curated Berlin street graph + map geometry
  game.js              composition entry point
  game-data.js         job/radio/rider/run constants
  game-core.js         deterministic graph + base simulation
  game-radio.js        radio channels + autonomous choice
  game-riders.js       movement + fatigue + breaks
  game-events.js       events + goals + upgrades + review
  graph.js             graph helpers + shortest path
  camera.js            zoom/pan camera
  render-map.js        Berlin map renderer
  render-entities.js   jobs/riders/routes renderer
  render.js            Canvas renderer composition
  main.js              input, keyed DOM reconciliation, fixed-step loop
  rng.js               deterministic seeded RNG
tests/
  core.test.js         simulation/map invariants
.github/workflows/
  ci.yml               Node test suite
  pages.yml            GitHub Pages deployment
```

Runtime dependencies: **none**.

Build step: **none**.

## 18. Development and deployment

Run locally:

```bash
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

Run tests:

```bash
npm test
```

Live site:

```text
https://generalgroovy.github.io/bike/
```

## 19. Reproducibility requirements

A change is acceptable only if it preserves these invariants:

1. same seed → same simulation setup,
2. Berlin graph remains connected,
3. no direct assignment API,
4. cargo type remains district-independent,
5. radio-off riders cannot deliberate or claim,
6. break state is visible in map and GUI,
7. map camera does not mutate simulation state,
8. dynamic lists retain stable DOM identity,
9. interactive elements encode state using more than color,
10. GitHub Pages works without backend or API key.

## 20. Test acceptance bar

Before merging:

```text
npm test
node --check src/*.js
```

The current suite verifies:

- deterministic RNG,
- detailed Berlin street graph,
- recognizable macro geography,
- deterministic shift generation,
- full graph routability,
- exact rider roster,
- radio bandwidth rules,
- absence of direct assignment,
- radio-off break behavior,
- fatigue-triggered breaks,
- autonomous claims,
- district-independent cargo generation,
- bridge-goal routing,
- event route penalties,
- multi-seed autonomous stress stability.

## 21. Quality priorities

When choosing what to improve next, prioritize in this order:

1. instant visual comprehension,
2. quality of dispatch decisions,
3. rider behavior readability,
4. Berlin spatial authenticity,
5. stable game feel and pacing,
6. replay depth,
7. additional content.

Do not add breadth if the player cannot clearly answer:

- What is urgent?
- What is on the radio?
- Which riders are listening?
- Who is on break?
- What will each rider probably choose?
- Why did the network fail?
