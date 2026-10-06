# Send It

A single-player browser game about dispatching autonomous bicycle couriers across a deterministic Berlin map. Select a contract, choose what to broadcast, and watch riders decide. You influence information and incentives; you do not assign a rider directly.

[Play the released game](https://generalgroovy.github.io/bike/). The [Berlin preview](https://generalgroovy.github.io/bike/preview/) comes from a separate playtest branch; its features and tests do not automatically describe this main-branch source.

## Run locally

Use a modern browser, Python 3 for the convenience server, and Node.js 24+ for development tests. There are no npm dependencies to install.

```sh
npm run serve
```

Open `http://localhost:8080`. Serve the files over HTTP; opening `index.html` directly is not supported because the app uses JavaScript modules. On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`.

## Play a shift

1. Choose **Plan first dispatch** in the optional guide. Time stays paused while you compare signals; your first successful broadcast starts the shift. **Resume** starts it explicitly whenever you prefer.
2. Select a waiting contract and inspect its route, deadline and likely riders.
3. Broadcast **OPEN** (one radio slot), **PRIORITY** (two slots), or **LOCAL** (one slot, favors nearby riders) directly from the selected contract or its queue card. **Remove from radio** / **OFF** releases its slots. Switching signals replaces the old cost.
4. Watch rider decisions and delivery progress. Use bonuses, client calls, rebroadcasts and event responses when their benefits justify the cost.
5. Pause to assess deadlines, pressure and fatigue. Completed deliveries unlock upgrades and wider operating areas. Reputation reaching zero ends the run.

The guide follows your first broadcast through the real rider claim and delivery outcome. Dismiss it to keep the desk clear; replay it from **Help > Dispatch guide**. Detailed reference stays in Help.

The selected contract compares how many free listeners **may choose this** signal over competing live calls, before random variation. Riders already considering a different job are excluded. This makes the extra slot for Priority a real choice: it can change attention, but cannot create riders or shorten their trip. Predictions are read-only estimates; they neither reserve riders nor guarantee acceptance or completion. **Riders & route** holds deeper availability and route detail.

Comfortable density enlarges contract labels and actions. Compact density remains available with **D**. Phones stack the work queue, map and riders; swipe the queue sideways to choose a contract. Intentional pause stays paused when you change a broadcast, and Help restores the previous pause state.

| Input | Action |
| --- | --- |
| Click contract/rider | Inspect |
| Drag / mouse wheel | Pan / zoom built-in map |
| FIT or 0 | Fit the active area |
| Zoom buttons | Zoom in/out |
| Space | Pause/resume |
| 1 / 2 / 3 | 1× / 2× / 4× speed and resume |
| H or ? / Escape | Open help / close help or clear selection |
| Q / R | Collapse contracts / riders rail |
| M / D | Map focus / information density |
| G | Optional Google basemap |

Shortcuts ignore held-key repeats, text entry, browser modifier chords, and open modal dialogs. Help pauses the run and restores its previous pause state when closed. Native button keyboard activation is preserved.

## Runs and browser storage

The URL's `seed` parameter reproduces the initial run. **Same seed** restarts it; **New run** changes it. A seed is not a saved in-progress shift. Reloading or closing the page loses current run progress.

The browser stores the best score, dispatch-guide/help dismissal, sound preference, queue sorting, rail layout and density. Storage failure falls back to session defaults. There is no account or cloud save. Pause before leaving an active tab if you need to preserve the current moment.

## Maps and networking

The bundled deterministic map needs no API key. After application files load, simulation does not require a game server. This is not an offline-install guarantee.

Google Maps is an optional presentation layer enabled with **G**. It requires network access and a browser-local Google Maps API key. See [Google Maps setup](docs/GOOGLE_MAPS.md). The key and mode preference stay in browser storage; do not commit a key. Live map streets do not change rider path costs or simulation authority. Game routes are not navigation-grade directions.

## Development and validation

```sh
npm test
node --test tests/keyboard-shortcuts.test.js tests/help-focus.test.js
```

The main suite covers simulation, route/cache invariants, read-only projections, competing calls, stale commands, onboarding pause ownership and UI contracts. DOM/event harnesses do not establish rendered browser usability or live Google service behavior. Manual smoke check: plan a first dispatch while paused, broadcast from the inspector, inspect a rider, pause with Space, change a signal while still paused, open/close Help, and restart the same seed. See [the October quality record](docs/PROJECT-QUALITY-2026-10-06.md) for current evidence and limits.

The preview branch has separate Chromium checks. See [Pages deployment and preview isolation](docs/PAGES_PREVIEW.md); this checkout does not contain the preview's `e2e/` runners.

## Source and docs

- `src/main.js`: browser controller and interactions.
- `src/game*.js`: deterministic run, radio, riders, events and progression.
- `src/render*.js`, `src/camera.js`: presentation and built-in camera.
- `src/keyboard-shortcuts.js`: shared eligibility for game, layout and map shortcuts.
- `src/google-basemap.js`: optional geographic presentation bridge.
- [Berlin import pipeline](docs/BERLIN_IMPORT.md) and [data sources](docs/BERLIN_SOURCES.md): candidate generation and quality gates.
- [Design](DESIGN.md): design intent; implementation and tests determine current behavior.

Keep rider decisions in the simulation. UI, map and insight layers must not assign jobs, advance time independently or consume simulation randomness.
