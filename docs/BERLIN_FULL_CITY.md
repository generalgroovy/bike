# Send It — full Berlin and a more usable desk

Implementation snapshot: 7 September 2026. Full-city ruleset `berlin-dispatch-v4`; map `berlin-city-v1-b81f2dddf012`.

[Play across Berlin](https://generalgroovy.github.io/bike/preview/berlin/?city=berlin&mode=standard&district=citywide&seed=BERLIN-1) · [Guided first shift](https://generalgroovy.github.io/bike/preview/berlin/?city=berlin&mode=training&district=mitte&seed=BERLIN-1) · [Original Inner Ring](https://generalgroovy.github.io/bike/preview/berlin/?city=inner-ring)

## Current state

The default game now covers Berlin's complete official city boundary. Every one of its 97 localities has a reachable starting base. A citywide shift starts Kira in Mitte, Mauro in Spandau and Brian in Köpenick; a locality shift starts all three together in the chosen locality. Nearby deliveries let the team work in those areas and move naturally into neighboring localities. There is no teleporting, direct assignment or forced rider reservation during a shift.

The radio game stays small: three riders, three cargo families, OPEN / LOCAL / PRIORITY, a bonus, one forecast roadworks event and one halfway upgrade. The desk displays estimated finish times, including pickup. Couriers can decline an offer that cannot currently fit its deadline. Player choices influence which work they hear and how attractive it is; the couriers still choose.

The first shift starts together in Mitte unless a locality was chosen. Its opening is a short delivery from that actual starting address. This prevents a visually nearby destination across a river or one-way network from turning the tutorial into a long detour. Standard shifts keep their eight minutes of arrivals, up to one minute to close, and 24-delivery target. Training keeps its five-delivery target within three minutes.

## Refinements for the larger city

- Choose a start anywhere in Berlin before playing. The full city remains the operating area; the start determines initial rider positions.
- Select a locality to view its real boundary, or Fit map to return to the whole city. Whole-city views emphasize boroughs and main roads; closer views reveal local streets and address details.
- Tap a rider portrait to locate that rider. This changes the camera without moving the rider or assigning work.
- Unfinished shifts save on this device after actions, every five seconds and when leaving the page. Resume saved shift reconstructs the recorded actions and restores the game paused.
- The saved state includes the city version, ruleset, starting locality, seed, ticks and player actions. Reload does not overwrite an existing save before the player chooses to resume or start again. Completed shifts can still be downloaded as replay records.
- Full-city map drawing uses spatial batches and a cached background, so a close view need not redraw the entire city's terrain and streets. Job searches use a spatial address index. These affect cost of lookup/drawing, not geography or courier authority.

Saving depends on local browser storage. Clearing site data, private-browsing restrictions, storage limits or a hard shutdown between saves can lose progress. Saves are not uploaded or synchronized. Offline installation and real-device mobile certification remain future work.

## Geographic coverage and evidence

| Item | Full Berlin | Retained Inner Ring |
| --- | ---: | ---: |
| Boundary area in the sourced projection | 890.668 km² | 87.351 km² |
| Localities represented | 97 complete localities | 19 intersections with the ring |
| Boroughs | 12 | — |
| Displayed street sections | 43,473 | 6,938 |
| Playable sampled addresses | 45,618 | 7,533 |
| Graph nodes / edges | 198,430 / 199,421 | 30,656 / 32,293 |
| Raw runtime pack | 32.51 MB | 4.91 MB |
| Full-city gzip payload | 8.50 MB | — |

The official address service returned 402,756 records; 402,755 are covered by the chosen boundary snapshot. The pack samples addresses near suitable streets and retains destinations in the largest strongly connected route component. Every sampled address has an outward and a return route. Restricted/disconnected roads can be displayed without becoming playable destinations.

Streets, locality and borough polygons, parks, water, vegetation and built-up land cover share EPSG:25833 coordinates at 10 metres per game unit. Coordinates are not shifted or stretched for gameplay. Source geometry is simplified at 1 m and rounded to 0.1 m. Bridge/tunnel levels and original junction IDs preserve topology; a crossing drawn on the map does not automatically become a connection.

The independent source audit checked all 45,618 playable address points and all 43,473 street sections. Maximum observed address processing error was **0.070591 m**. Maximum sampled street deviation was **1.036975 m**, with samples no more than 5 m apart. All seven source hashes and the runtime pack hash verified. These are processing differences from the downloaded source snapshots, not certified survey accuracy.

Full-city sources: [official Berlin boundary](https://daten.berlin.de/datensaetze/alkis-berlin-landesgrenze-wfs-07b1347b), [boroughs](https://gdi.berlin.de/services/wfs/alkis_bezirke?service=WFS&request=GetCapabilities), [localities](https://daten.berlin.de/datensaetze/alkis-berlin-ortsteile-wfs-61bd3084), [Detailnetz streets](https://gdi.berlin.de/services/wfs/detailnetz?service=WFS&request=GetCapabilities), [addresses](https://gdi.berlin.de/services/wfs/adressen_berlin?service=WFS&request=GetCapabilities), [parks](https://gdi.berlin.de/services/wfs/gruenanlagen?service=WFS&request=GetCapabilities) and [ALKIS land cover](https://gdi.berlin.de/services/wfs/lc_alkis?service=WFS&request=GetCapabilities).

The full-city data pack uses **dl-de-zero-2.0**. The separate Inner Ring pack retains its ODbL license and OpenStreetMap Ringbahn attribution. [Map sources, accuracy limits and downloadable packs](https://generalgroovy.github.io/bike/preview/berlin/map-data.html) are accessible from the game.

General traffic direction is modeled; bicycle exceptions, turn restrictions, stairs, access hours and live construction are incomplete. Address access links of at most 60 m are schematic. Built-up land cover is not a building-footprint survey. Riders, jobs, demand and roadworks are fictional; speeds and shift time are compressed. This is a game map, not a navigation service.

## Run and test

From `feature/berlin-playtest`, serve the repository over HTTP:

```sh
python -m http.server 8080
```

Open `http://localhost:8080/`. Choose a starting area, then a first shift or standard shift. Broadcast OPEN and start the clock. On a citywide shift, use portraits and Find route to move between the team's work areas. On a phone, use the Map / Jobs / Contract links. Pause whenever needed.

Automated checks use Node 24 and Python with Playwright 1.57.0 and Chromium:

```sh
npm test
python e2e/browser_smoke.py
python e2e/playtest_smoke.py
python e2e/city_smoke.py
```

Verified locally: **258/258 Node tests**, **17/17 full-city browser tests**, **13/13 Inner Ring browser tests** and **9/9 historical browser tests**. The independently repeated full-city build was byte-identical.

Use `npm.cmd test` in Windows PowerShell when `npm.ps1` is blocked. Node coverage includes full-city connectivity, gzip equivalence, a feasible guided opening in all 97 localities, spatial lookup equivalence, and exact v4 replay. Browser coverage exercises both maps, citywide/locality starts, loading failures, saved-shift recovery, corrupt-save handling, map interaction, phone layouts, real-time acceptance/delivery and a complete shift review/download.

Download a shift record and verify it with:

```sh
node tools/replay-playtest.mjs path/to/shift.json
```

The CLI chooses the appropriate checked-in city pack. Original v1, v2 and v3 records remain supported; a mismatched city version is rejected. Deterministic replay is verified against this implementation, not promised across arbitrary future engines.

To deliberately rebuild full Berlin, install `tools/requirements-map.txt` and use a new source folder for a fresh snapshot:

```sh
node tools/fetch-berlin-city.mjs ../berlin-city-source
python tools/build-inner-ring.py ../berlin-city-source generated --full-city
python tools/validate-inner-ring.py ../berlin-city-source generated --full-city
```

The fetcher caches pages and verifies complete counts and duplicate IDs. The builder reads the completed hashed source files in bounded memory. A refresh should change the city ID when source content changes; processing changes need a corresponding build revision. Do not silently substitute a new map under an old saved-shift identity.

## Next priorities

1. Observe fresh players in central, citywide and outer-locality shifts. Check whether they understand courier choice, spot a deadline risk and use the map without losing the queue.
2. Measure which radio choices and upgrades create useful alternatives. Adjust existing timing and preference rules from observed play, keeping geometry fixed.
3. Verify mobile save/resume, interruptions, touch gestures, performance and readability on actual iOS and Android devices. Add offline installation and a more compact portrait contract panel after those checks.
4. Add contrasting scenarios within the city before another city. Use the same simulation and versioned CityPack format for later expansion.

Full geographic coverage and automated tests do not establish enjoyment, final balance or mobile release readiness. The site root continues to serve the retained release; this work is the playable Berlin preview.
