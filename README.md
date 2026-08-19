# BIKE — Dispatch Roguelike

A colorful minimalist browser strategy game about dispatching bicycle couriers through a procedurally generated city under escalating delivery pressure.

**Core loop:** pick a delivery → assign an available rider → beat the deadline → survive longer → choose a permanent run upgrade → adapt to a harder city.

## Why it is roguelike

Every run is driven by a visible seed. The seed controls city districts, road topology, district demand biases, delivery stream, and upgrade ordering. Runs escalate in waves, and periodic one-of-three upgrades permanently alter the current run. Retry the same seed to solve the same underlying logistics puzzle differently, or generate a new city.

## Play

GitHub Pages: once Pages is enabled for this repository, the default URL is:

`https://generalgroovy.github.io/bike/`

Local:

```bash
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Controls

- Click a delivery, then click an available courier to dispatch it.
- `Space` — pause/unpause.
- `1`, `2`, `3` — 1×, 2×, 4× simulation speed.
- `Esc` — clear selection.
- `New Run` — generate a new seed and city.

## Current gameplay

- Deterministic seeded procedural city graph.
- 4–6 colorful districts with distinct demand profiles.
- Three starting couriers with graph pathfinding and animated routes.
- Six delivery classes: food, parcels, documents, medical, groceries, fragile.
- Deadlines, urgency rings/pulses, cash, score, reputation, failure state.
- Increasing demand waves and occasional delivery bursts.
- Roguelike upgrade picks including riders, speed, deadline grace, rewards, reputation recovery, and express bike lanes.
- Run summary and local best-score persistence.
- Responsive desktop-first interface with keyboard controls and reduced-motion support.

## Architecture

The project intentionally has no runtime dependencies and no build step.

```text
index.html        DOM shell / HUD
styles.css        responsive UI and visual system
src/rng.js        deterministic seeded RNG
src/graph.js      adjacency and shortest-path routing
src/game.js       simulation state and game rules
src/render.js     Canvas renderer
src/main.js       input, UI projection, game loop
tests/            Node built-in test suite
```

The simulation is independent from rendering. `Game` owns deterministic state, `Renderer` projects that state to Canvas, and `main.js` handles browser input/DOM updates.

## Tests

Requires a recent Node.js version:

```bash
npm test
```

The suite covers deterministic RNG, graph routing, seeded city generation, and delivery assignment state transitions.

## GitHub Pages

A Pages workflow is included in `.github/workflows/pages.yml`. Repository Pages settings should use **GitHub Actions** as the deployment source. Pushes to `main` deploy the static site.

## Design principles

1. **Readable pressure** — failure should be visible on the map before it appears in a score panel.
2. **One interaction, meaningful consequence** — dispatch remains click delivery → click rider.
3. **Procedural but legible** — generated cities should resemble neighborhoods connected by a useful road graph, not random noise.
4. **Colorful minimalism** — district palettes, cargo shapes and courier identities carry information without visual clutter.
5. **Roguelike adaptation** — upgrades should change how the player solves the current run, not merely inflate numbers.
6. **System mastery over click speed** — future progression should move toward route queues, handoffs, service zones, hubs and dispatch rules.

## Near-term roadmap

- Multi-job courier queues and drag reordering.
- District expansion choices during runs.
- Stronger per-seed modifiers: hills, rivers, bridges and temporary closures.
- Courier archetypes and cargo capacity.
- Demand forecast / rush-hour telegraphing.
- Service zones, handoff hubs and automation rules.
- Daily deterministic challenge seeds and richer run history.
- Sound layer and touch-focused interaction pass.

## License

No license selected yet.
