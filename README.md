# BIKE — Berlin Dispatch Roguelike

A colorful minimalist browser strategy game about running a bicycle-courier radio desk in Berlin.

**You do not assign riders to jobs.** You choose which jobs are audible, how strongly or locally to broadcast them, and when to preserve radio bandwidth. Autonomous riders visibly deliberate and choose among the calls according to position, personality, experience, deadline pressure and pay.

## Play

GitHub Pages: `https://generalgroovy.github.io/bike/`

Local:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Core loop

1. Jobs appear across a stylized Berlin map; deadlines begin immediately.
2. Decide which jobs deserve airtime.
3. Broadcast with one of three channels:
   - **OPEN · 1 bandwidth** — neutral call.
   - **PRIORITY · 2 bandwidth** — stronger attention signal, still not an order.
   - **LOCAL · 1 bandwidth** — favours riders already near the pickup.
4. Free riders visibly deliberate. Attention lines and a filling white ring show what they are considering.
5. A rider independently commits and follows the graph route to pickup and dropoff.
6. Forecast road disruptions can change route quality before or during the job.
7. Deliveries and Berlin goals earn score, cash, reputation and roguelike upgrades.
8. Missed deadlines damage reputation. At 0%, the shift ends with a **Dispatch Review** explaining how the radio failed.

The skill is not click speed. It is **shaping a good choice set for autonomous people**.

## Berlin

The first city is a deliberately stylized central Berlin, not a GIS/navigation map. The fixed macro layout includes relative placement of Charlottenburg, Moabit, Wedding, Prenzlauer Berg, Tiergarten, Mitte, Friedrichshain, Kreuzberg, Schöneberg, Tempelhof and Neukölln.

Landmarks include Zoologischer Garten, Kurfürstendamm, Siegessäule, Hauptbahnhof, Reichstag, Brandenburger Tor, Potsdamer Platz, Checkpoint Charlie, Museumsinsel, Alexanderplatz, Fernsehturm, Mauerpark, East Side Gallery, Oberbaumbrücke, Görlitzer Park, Hermannplatz and Tempelhofer Feld.

The Spree is a gameplay boundary. Named crossing edges currently include **Moltkebrücke, Jannowitzbrücke and Oberbaumbrücke**. Some generated goals require completed routes to use a specific bridge or cross the Spree repeatedly.

The macro city stays learnable between runs. Local service points, roster, job stream, goals, disruptions, bike-lane upgrades and run modifiers change per seed.

## District rule

Delivery category generation is independent of district identity. Food is not a Kreuzberg rule; documents are not a Mitte rule. Districts matter for geography, locality, route shape, landmarks and explicit goals.

## Rider autonomy

Each rider has:
- name and visual identity
- home-area bias
- personality
- experience level
- movement speed
- decision speed/noise
- current deliberation
- reason for their last choice

Personalities:
- **Sprinter** — proximity and urgency
- **Earner** — payout
- **Guardian** — urgent/medical work
- **Local** — nearby/familiar pickups
- **Tourer** — landmark routes and longer rides
- **Steady** — balanced

Experience runs **Rookie → Regular → Experienced → Veteran**. Veterans decide faster and with less noise.

### Visible deliberation

Riders no longer jump instantly from idle to accepted job. When listening, a rider can enter a short deliberation state. The map shows a colored attention line toward the job and a white decision ring filling around the rider. The sidebar shows the job and reason being considered.

This gives the dispatcher a readable reaction window without adding direct control.

## Road disruptions

Temporary events are forecast before activation:
- roadworks
- demonstrations
- bridge squeezes

Affected corridors are highlighted on the map. Active events increase route cost and reduce movement speed; riders use the changed costs when evaluating calls and can reroute at intersections.

## Berlin goals

Each shift mixes goals such as:
- serve a named landmark
- cover a named district
- use a named Spree bridge
- cross the Spree several times
- complete a reliability milestone

Goal endpoint bias is mild and does not change cargo-type generation.

## Dispatch Review

The game-over screen is now diagnostic. It reports:
- jobs that were never called
- called jobs that no rider accepted
- accepted jobs that still arrived too late
- call attempts blocked by bandwidth
- PRIORITY and LOCAL success rates
- top rider
- last critical calls, claims, misses, goals and road events
- short actionable advice for the next attempt

The intended loss reaction is “I see why that radio strategy collapsed,” not merely “the difficulty got too high.”

## Roguelike variation

A seed controls local service points, rider roster, personality/experience combinations, run trait, job stream, goals, road-event timing and upgrade order.

Run traits include **Express Berlin**, **Green Wave**, **Tourist Saturday** and **Rain Shift**.

Upgrades include **Radio Bandwidth**, **Extra Rider**, **Team Briefing**, **Street Legs**, **Client Buffer**, **Bike-Lane Grant** and **Local Goodwill**.

## Visual language

- faint colored polygons = Berlin districts
- blue line = Spree
- green polygons = major parks
- white symbols = landmarks
- dim colored job = waiting, not broadcast
- broadcast arcs = live radio call
- `O` / `!` / `L` badge = OPEN / PRIORITY / LOCAL
- triangle = rider
- number inside rider = experience
- dotted rider line = attention
- white ring around rider = deliberation progress
- dashed rider-color line = accepted route
- orange/red corridor = forecast/active disruption
- outer job ring = deadline remaining

Important information is encoded through shape and text as well as color.

## Controls

- On the map, click a waiting job to toggle a normal OPEN call.
- In the Radio Board, choose **OPEN / PRIORITY / LOCAL / OFF** explicitly.
- Click a rider to inspect/highlight them.
- `Space` — pause
- `1` / `2` / `3` — 1× / 2× / 4×
- `Esc` — clear inspection
- **New Shift** — new deterministic seed
- **Retry Same Shift** — replay identical generated conditions

## Architecture

Zero runtime dependencies and zero build step.

```text
index.html
styles.css
src/
  berlin.js    Berlin spatial skeleton, landmarks and bridge metadata
  rng.js       deterministic RNG
  graph.js     weighted graph pathfinding
  game.js      simulation, radio channels, autonomous AI, events, review
  render.js    Canvas visualization
  main.js      DOM projection, input, fixed-step loop
tests/
  core.test.js
```

## Tests

```bash
npm test
```

The suite covers deterministic generation, Berlin geometry, multi-seed routability, radio bandwidth/channel behavior, indirect control, visible deliberation, personality/experience validity, district-independent cargo spawning, bridge goals, temporary route disruptions, Dispatch Review classification and goal progression.

The implementation is also stress-simulated across seeded autonomous shifts to catch invalid state and routing failures.

## Design direction

```text
triage jobs
→ choose channel
→ read deliberation
→ learn personalities
→ anticipate Berlin geography
→ react to disruptions
→ shape upgrades
→ review failure
→ replay with a better information strategy
```

See `DESIGN.md` for the north-star rules.
