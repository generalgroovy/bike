# Web and Windows parity

The default Send It website and /preview/ route to the same full-Berlin desk as the Windows app. The canonical game remains at /preview/berlin/, so existing links, map paths, browser saves and scenario URLs remain valid. Redirects preserve query parameters and fragments and replace history rather than creating a Back-button loop.

The older main-branch game is preserved at /classic.html, including the recent dispatch-guide refinements. Its original assets stay at the same paths. No saves are migrated, cleared or overwritten by the publication change. Classic and Berlin save formats remain distinct; Windows uses its own profile.

## Shared game, browser-specific packaging

`tools/build-pages.mjs` copies the tracked runtime from `feature/berlin-playtest` byte for byte: simulation, UI, CSS, map packs, building tiles, rider art and music. It adds a manifest and a browser platform module to the HTML. That module only provides fullscreen and optional offline downloading in Menu; it does not dispatch gameplay actions or alter rules, balances or saved-run formats.

- `build.json` records both source commits and the desktop version.
- `desktop-source.json` fingerprints the shared Windows-source files, before the two browser-only HTML additions.
- `offline-pack.json` fingerprints the actual published files after those additions.

The web entry no longer presents the older v0.12 game as the default while hiding the Windows-quality desk behind a preview link.

## Offline play

Menu → Download offline shows the download size before the player chooses it. The current complete pack is approximately 186 MB and includes full Berlin, Inner Ring, every building-detail tile, portraits, styles, code and sound generation. Four bounded workers download and SHA-256-check each file. Only a complete pack receives a ready marker. Failures, mismatched files and cancellation leave the current run and any previous completed offline copy intact. Browser storage quota is checked before downloading.

The worker is scoped to the canonical game, with scope-specific cache names. It serves completed cached packs without the network. A new worker waits for the existing game tabs to close, and older complete packs remain playable until the replacement is fully downloaded. Menu reports when an offline copy is available and when a newer copy can be downloaded. The app requests persistent storage after a successful download; the browser may decline or later clear data.

For offline entry, bookmark the canonical game after it opens, or use the browser's install/Add to Home Screen action when offered. The website root's first redirect requires a connection because it is outside the game's worker scope. Clearing site data removes browser saves and offline files. Audio still needs a user gesture, as it does in the regular browser game. Browser install support and physical mobile behavior are not established by desktop Chromium tests.

## Deployment and checks

GitHub Pages uses Actions. A successful push-triggered Test workflow on the desktop/playtest branch publishes that exact SHA. A main push or manual deployment checks the latest playtest branch using its Node and Chromium suites before composition. The composed artifact then runs `tools/check-web-publication.py` before it can deploy.

That check covers the real root redirect, source equality, complete offline manifest, fullscreen, failed downloads, hash mismatches, cancellation, responsive Menu, disconnected reload, audio, an autonomous delivery, previously unvisited building detail, and exact paused save restoration. Evidence is retained as `send-it-web-parity`.

To compose locally, pass the main checkout, desktop/playtest checkout and a new output directory outside both checkouts:

```powershell
node tools/build-pages.mjs MAIN_CHECKOUT PLAYTEST_CHECKOUT OUTPUT
python tools/check-web-publication.py OUTPUT REPORT_DIRECTORY
```

The output is a static site. No map API key or browser account is required. Git metadata, untracked files, tests, build tools and local configuration are excluded. Serve the composed output over HTTP for online testing; service workers require localhost or HTTPS.

After deployment, compare the hosted build identity and file hashes and exercise the public entry. A source push or CI result alone does not prove public content is current.
