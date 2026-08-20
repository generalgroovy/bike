# Berlin map references

Send It's runtime map is a deliberately simplified gameplay diagram, not a navigation/GIS product.

## Official references

Primary Berlin Open Data sources:

- Detailnetz Berlin — detailed transport-oriented street network
  - dataset page: `https://daten.berlin.de/datensaetze/detailnetz-berlin-wfs-4f2045ef`
  - WFS: `https://gdi.berlin.de/services/wfs/detailnetz`
- Adressen Berlin — official address points
  - dataset page: `https://daten.berlin.de/datensaetze/adressen-berlin-wfs-634ab8ba`
  - WFS: `https://gdi.berlin.de/services/wfs/adressen_berlin`
- license metadata: Datenlizenz Deutschland – Zero – Version 2.0 where stated by the source datasets.

The S41/S42 Ringbahn is used as the intended first-city operating boundary/orientation concept.

## Current runtime fidelity

The active `src/berlin.js` graph is still a deterministic hand-curated gameplay abstraction using real street names, recognizable broad topology, water/parks, landmarks and Ringbahn anchors. Current generated house numbers are gameplay addresses and are not claimed as exact official parcels.

No external map API, tile service or runtime geodata request is required.

## Reproducible next precision tier

`tools/import-berlin.mjs` and `tools/berlin-import-lib.mjs` now provide the tested build-time foundation for importing official streets/addresses into a static candidate dataset.

See [BERLIN_IMPORT.md](BERLIN_IMPORT.md) for the workflow, current limitations and the required Ring-polygon/topology steps before imported data may replace the curated runtime graph.
