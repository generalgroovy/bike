# Send It v5 — deep Berlin dispatch overhaul

Current feature branch changes relative to the earlier Berlin radio prototype:

## Interaction / GUI

- Player-facing product renamed to **Send It**.
- Live layout rebuilt around compact command bar → horizontal contract rail → dominant map → rider dock.
- Explanatory text moved out of normal play into hover, selected-contract inspector and Help.
- Rider cards show live task progress, ETA, energy, radio/break state and location.
- Selected contracts show a future Rider Outlook: available now vs busy/break riders projected to become relevant soon.
- Demand events highlight their affected Berlin area directly on the map.
- Game-over review includes a causal critical timeline plus compact run telemetry.
- Keyed live DOM nodes remain mandatory to prevent flicker.

## Core simulation

- No direct rider assignment.
- Rider personalities rebalanced with deterministic anti-dominance tests.
- Cargo classes now have loaded speed/fatigue handling differences.
- Added route/weather events plus venue-release/transit-outage demand surges.
- Event responses distinguish route pre-brief/detour from demand capacity planning/client staggering.
- Added strategic Cargo Racks, Local Repeater, Event Feed and Relief Roster upgrades.
- Future rider availability is informational only; busy riders still cannot claim early.

## Progression

- Center Desk unlocks Inner City at 6 completed deliveries.
- Full Inside-the-Ring operation now unlocks at 30 rather than 16 after automated pacing showed the former threshold exposed the whole city in roughly two minutes under competent dispatch.
- Level-gated cargo and special RUSH/RETURN work remain tied to territory expansion.

## Berlin precision

- Current curated Ringbahn-interior graph remains the runtime authority.
- Added an offline official-data importer foundation for Detailnetz Berlin + Adressen Berlin WFS.
- Importer includes capability discovery, GeoJSON request construction, deterministic simplification/projection, address normalization and stable output ordering.
- Runtime still makes zero map-network requests.

## Validation

Current green automated gate before this documentation-only update: **71 tests / 71 pass / 0 fail**, plus browser source syntax checks and importer CLI syntax validation.
