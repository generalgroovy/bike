# BIKE — Berlin Dispatch Roguelike

A colorful minimalist browser strategy game about running a bicycle-courier radio desk in Berlin.

The core idea is **indirect dispatch**:

> You do not assign riders to jobs. You decide which jobs are worth calling out. Autonomous riders choose among the live calls based on where they are, who they are, and how experienced they are.

## Play

GitHub Pages: `https://generalgroovy.github.io/bike/`

Local:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Core loop

1. Jobs appear around a stylized central-Berlin street network.
2. Every deadline starts immediately.
3. Click a waiting job to put it **ON RADIO**.
4. Radio slots are limited.
5. Free riders independently evaluate all live calls.
6. They choose using pickup distance, deadline pressure, payout, personality and experience.
7. Successful deliveries earn cash/score and advance city goals.
8. Misses damage reputation. At 0 reputation, the shift ends.
9. Every few successful jobs, choose a permanent roguelike upgrade for the current shift.

The main skill is reading the city and team well enough to expose the *right choice set* to autonomous riders.

## Berlin

The first city is a deliberately stylized central Berlin, not a GIS/navigation map. Its fixed geographic skeleton includes relative placement of Charlottenburg, Moabit, Wedding, Prenzlauer Berg, Tiergarten, Mitte, Friedrichshain, Kreuzberg, Schöneberg, Tempelhof and Neukölln.

Landmarks include Zoologischer Garten, Kurfürstendamm, Siegessäule, Hauptbahnhof, Reichstag, Brandenburger Tor, Potsdamer Platz, Checkpoint Charlie, Museumsinsel, Alexanderplatz, Fernsehturm, Mauerpark, East Side Gallery, Oberbaumbrücke, Görlitzer Park, Hermannplatz and Tempelhofer Feld. The Spree and major green spaces are part of the map language.

The Berlin skeleton stays recognizable between runs. Roguelike variation comes from local service points, rider roster, run trait, delivery stream, city goals, bike-lane upgrades and player choices.

## District rule

**Delivery icons/types are not generated from district stereotypes or district demand tables.** Food, parcels, documents, medical jobs, groceries and fragile cargo can appear throughout the playable city.

Districts matter for spatial orientation, travel geometry, relative rider position, explicit city goals and containing landmarks/service points.

## Rider autonomy

Each rider has a name, color identity, home area, personality, experience level, decision speed/noise, riding-speed modifier and an explanation of their current/last choice.

Current personalities:

- **Sprinter** — close and urgent work
- **Earner** — payout
- **Guardian** — urgent/medical work
- **Local** — nearby pickups and familiar area
- **Tourer** — landmarks and longer rides
- **Steady** — balanced decisions

Experience runs **Rookie → Regular → Experienced → Veteran**. Veterans decide faster and with less deviation from their personality model; rookies are less predictable.

When riders are idle and calls are live, the UI shows their **likely next choice**. Faint attention lines visualize what each rider is leaning toward without removing uncertainty.

## Radio design

Radio slots are the main strategic resource. Calling every job is deliberately impossible.

Useful questions:

- Which rider is likely to become free first?
- Who is physically close?
- Which personality will prefer this call?
- Which deadline can wait?
- Is a high-value distant job worth exposing now?
- Should a slot remain open for an urgent arrival?
- Is a rookie likely to make a surprising choice if too many calls are live?

## Run goals

Each shift generates visible goals such as serving a named landmark, completing jobs linked to a named district, or reaching a reliability milestone. Goal-linked endpoints receive a mild spawn bias so objectives remain achievable; cargo type remains district-independent.

## Roguelike variation

A run seed controls local service-point placement, rider roster, personality/experience combinations, run trait, job stream, city goals and upgrade ordering.

Current run traits include **Express Berlin**, **Green Wave**, **Tourist Saturday** and **Rain Shift**.

Current upgrades include **Radio Bandwidth**, **Extra Rider**, **Team Briefing**, **Street Legs**, **Client Buffer**, **Bike-Lane Grant** and **Local Goodwill**.

## Visual language

- faint colored polygons = Berlin districts/areas
- blue line = Spree
- green shapes = major parks
- white labeled symbols = landmarks
- dim colored job ring = waiting job not on radio
- broadcasting arcs = live call
- triangle = rider
- number inside rider = experience
- faint dotted rider line = likely call
- dashed colored path = accepted route
- outer job ring = deadline remaining

Important state is encoded with shape/text as well as color.

## Controls

- Click a waiting delivery — call / uncall it
- Click a rider — inspect/highlight rider
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
  berlin.js    fixed Berlin spatial skeleton
  rng.js       deterministic RNG
  graph.js     weighted graph pathfinding
  game.js      simulation, rider AI, calls, goals, upgrades
  render.js    Canvas map renderer
  main.js      DOM projection, input, fixed-step loop
tests/
  core.test.js
```

## Tests

```bash
npm test
```

The suite covers deterministic RNG, Berlin landmark relative positions, deterministic run generation, graph connectivity across many seeds, radio-slot rules, autonomous rider claiming, personality/experience validity, district-independent job-type generation and city-goal progression.

## Design direction

```text
choose calls
→ understand riders
→ predict team behavior
→ manage radio bandwidth
→ shape infrastructure
→ coordinate autonomous courier personalities
→ master the city as a living dispatch system
```

The game should remain about **curating choices for people**, not commanding units.
