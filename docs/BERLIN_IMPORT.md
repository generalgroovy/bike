# Official Berlin static import workflow

Send It must remain deterministic, offline at runtime and deployable as static GitHub Pages files. Official geodata is therefore a **development/build input**, never a runtime dependency.

## Sources

Current source endpoints:

- Berlin Open Data — Detailnetz Berlin WFS
  - `https://gdi.berlin.de/services/wfs/detailnetz`
  - detailed transport-oriented street network
- Berlin Open Data — Adressen Berlin WFS
  - `https://gdi.berlin.de/services/wfs/adressen_berlin`
  - official address points
- license metadata: Datenlizenz Deutschland – Zero – Version 2.0

The public dataset pages remain the human-readable metadata authority. The WFS endpoints above are queried only by the import CLI.

## Current importer status

`tools/import-berlin.mjs` is the reproducible foundation for the next precision tier. It currently:

1. requests WFS 2.0 `GetCapabilities`,
2. discovers likely street/address feature types,
3. requests GeoJSON in EPSG:4326,
4. clips to a configurable Berlin inner-city bounding box,
5. simplifies street polylines deterministically,
6. projects source coordinates into Send It's 1600 × 1120 game space,
7. normalizes address fields,
8. stable-sorts the output,
9. writes one static JSON artifact with source metadata.

It does **not yet replace `src/berlin.js` at runtime**. The existing hand-curated graph remains authoritative until imported topology, Ring clipping, connectivity and visual readability satisfy the normal game tests.

## Run

```bash
npm run import:berlin -- --output=generated/berlin-official.json
```

Optional controls:

```bash
npm run import:berlin -- \
  --bbox=13.27,52.45,13.51,52.57 \
  --street-type=<WFS feature type> \
  --address-type=<WFS feature type> \
  --street-count=50000 \
  --address-count=100000 \
  --output=generated/berlin-official.json
```

Explicit feature types are useful if Berlin changes layer naming and automatic capability hints no longer choose the intended layer.

## Determinism

Network responses may change when the source datasets change, so regeneration is an intentional development action. Once generated, the normalized artifact is committed or otherwise version-pinned together with:

- generation timestamp,
- source endpoints,
- selected feature types,
- bounding box,
- source license,
- importer version/commit.

Runtime must never silently refresh it.

## Required next precision steps

Before official imported geometry replaces the curated graph:

1. replace the rough bounding-box clip with a documented S41/S42 interior polygon,
2. inspect exact WFS schemas and replace property-name heuristics with source-schema mappings,
3. join address points to retained street geometry,
4. construct connected bike-usable routing topology,
5. simplify geometry with a measured tolerance while preserving intersections/bridges,
6. retain named bridges, parks, landmarks and Ringbahn orientation metadata,
7. produce generated static JS/JSON optimized for GitHub Pages,
8. run all connectivity, address, pacing, map-clarity and simulation tests,
9. compare imported map readability against the curated version before switching authority.

Precision is useful only when it improves the dispatch game. Navigation-grade detail that obscures riders, contracts or route choices should be simplified rather than displayed verbatim.
