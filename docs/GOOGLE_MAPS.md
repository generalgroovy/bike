# Google Maps basemap — Send It v0.12

Send It can use Google Maps JavaScript API as an optional live vector basemap while keeping the deterministic courier simulation independent from Google services.

## What Google mode does

- Google renders the road map, exact street geometry, labels and native fractional zoom.
- Google owns geographic pan/zoom while the mode is active.
- Send It renders riders, contracts, routes, FLOW/service-pressure/event overlays and client hubs on a transparent canvas above the map.
- Four canonical Ringbahn stations georeference the existing game plane to Berlin: Westkreuz, Gesundbrunnen, Ostkreuz and Südkreuz.
- The game graph, RNG, rider decisions, deadlines, route costs and simulation timing do not change.
- No Google map content is copied into the repository or persisted by Send It.

## Enable

1. Create a Google Cloud project.
2. Enable **Maps JavaScript API** and billing for that project.
3. Create a browser API key.
4. Restrict the key to **Maps JavaScript API**.
5. Add an HTTP referrer restriction for the deployed game, normally:

   `https://generalgroovy.github.io/*`

6. Open Send It and press **G** (or the G button in the map controls).
7. Paste the key into the one-time prompt.

The key is saved only to browser localStorage under `sendit.googleMapsApiKey.v1`. It is intentionally not present in Git.

Because Maps JavaScript API keys are used client-side, users can inspect them in browser network traffic. Security comes from Google Cloud application/API restrictions, not from trying to hide the key in JavaScript.

## Controls in Google mode

- drag: native Google Maps pan
- wheel/pinch: native Google Maps fractional zoom
- `+` / `-`: zoom
- `0` or `FIT`: fit the currently unlocked operating area
- `G`: return to the deterministic built-in basemap

Supported Google zoom range is 11–19. Send It exposes four presentation bands—overview, district, street and detail—while Google itself remains responsible for road/label detail at each level.

## Geographic accuracy

The Google basemap itself is Google Maps geometry. The current simulation graph remains the curated deterministic Send It graph and is transformed onto geographic space through a four-point projective calibration. Therefore:

- Google streets/labels are exact to the Google basemap;
- major city alignment is anchored to the Ringbahn;
- game routes and moving riders remain simulation overlays and are not navigation-grade traces;
- at extreme street-level zoom, small differences between the curated game graph and real road centerlines can be visible.

A later optional visual-only route layer could use the Maps JavaScript Routes library for selected contracts, but it must remain separate from deterministic simulation and comply with Google requirements for bicycling-route warnings and billing.

## Failure / offline behavior

Google mode is optional. If no key exists, the key fails, billing is disabled, the quota is exceeded, or the network is offline, Send It remains fully playable with its built-in deterministic Berlin renderer.

## Policy surfaces

The deployed game exposes `privacy.html` and `terms.html`. Google-provided attribution remains visible and unobstructed. The game does not prefetch, scrape, cache or store Google Maps content.
