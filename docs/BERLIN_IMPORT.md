# Official Berlin static import workflow

Send It must remain deterministic, offline at runtime and deployable as static GitHub Pages files. External geodata is therefore a **development/build input**, never a runtime dependency.

## Sources

Berlin Open Data:

- Detailnetz Berlin WFS
  - `https://gdi.berlin.de/services/wfs/detailnetz`
  - detailed transport-oriented street network
- Adressen Berlin WFS
  - `https://gdi.berlin.de/services/wfs/adressen_berlin`
  - official RBS address points
- source metadata states Datenlizenz Deutschland – Zero – Version 2.0 for these Berlin datasets.

Ring boundary candidate:

- OpenStreetMap S41 relation `14981`
- OpenStreetMap S42 relation `14983`
- the build output records OpenStreetMap / ODbL 1.0 attribution metadata.

The Ring relation is a **build-time clipping candidate**, not a hidden runtime dependency. Before distributing a generated combined dataset as runtime authority, licensing/attribution for all combined sources must be reviewed explicitly.

---

## 1. Generate a Ringbahn boundary candidate

```bash
npm run import:ringbahn -- \
  --ref=S41 \
  --output=generated/ringbahn-boundary.geojson
```

The tool requests the full OSM relation JSON and:

1. indexes relation nodes/ways,
2. keeps route-way members,
3. stitches reversed/disordered ways into connected chains,
4. selects the longest continuous chain,
5. closes it as a polygon,
6. rejects implausibly small/open/low-vertex output,
7. writes static GeoJSON with source relation and license metadata.

S41 is the default relation because it provides one complete direction around the same physical Ring as S42. S42 is pinned as a cross-check/reference.

The generated polygon must still be visually inspected before it is trusted as the final operating boundary; rail route relations can contain service/geometry details that are valid transit data but undesirable as a gameplay clip boundary.

---

## 2. Import official streets + addresses through the polygon

```bash
npm run import:berlin -- \
  --ring-polygon=generated/ringbahn-boundary.geojson \
  --output=generated/berlin-official.json
```

When a polygon is supplied, its bounds are used for the WFS request and the returned geometry is then clipped again against the actual polygon.

The importer currently:

1. requests WFS 2.0 `GetCapabilities`,
2. discovers likely street/address feature types unless explicitly pinned,
3. requests GeoJSON in EPSG:4326,
4. clips street line segments and address points to the explicit polygon,
5. simplifies retained street polylines deterministically,
6. projects source coordinates into Send It's 1600 × 1120 game space,
7. normalizes source metadata,
8. stable-sorts output independently of source response ordering,
9. writes static JSON with source endpoints, selected layers, polygon vertex count and schema metadata.

It does **not yet replace `src/berlin.js` at runtime**.

---

## Pinned Adressen RBS schema

The official RBS address documentation explicitly defines these source fields, and the importer treats them as canonical:

```text
adr_ident  address identifier
strnam     street name
strnr      street number
str_typ    street type
hausnr     house number
hausnrz    house-number suffix
postleit   postcode
bez_name   district
ot_name    locality
plr_name   planning-area name
```

By default `import:berlin` validates that returned address records contain canonical `strnam` and `hausnr` fields. A reviewed alternate export can be processed with:

```bash
--allow-address-aliases=true
```

This is deliberately opt-in so a silently changed WFS schema cannot produce superficially plausible but malformed addresses.

---

## Detailnetz schema policy

Berlin's Detailnetz technical description documents the required street-section semantics—Detailnetz identifiers/numbers, RBS street number, street name, road classifications, direction, from/to connection points and length—but the current technical PDF does not provide the WFS property identifiers used by the live service.

Therefore the importer currently keeps an **ordered compatibility-candidate map** for Detailnetz fields instead of falsely declaring one undocumented field spelling canonical.

Next schema step:

1. capture current `DescribeFeatureType` / capabilities output during a reviewed import run,
2. pin the exact selected layer name,
3. pin its actual street-name, connection-node and classification property identifiers,
4. fail fast on future incompatible schema changes.

---

## Optional controls

```bash
npm run import:berlin -- \
  --bbox=13.27,52.45,13.51,52.57 \
  --ring-polygon=generated/ringbahn-boundary.geojson \
  --street-type=<WFS feature type> \
  --address-type=<WFS feature type> \
  --street-count=50000 \
  --address-count=100000 \
  --output=generated/berlin-official.json
```

If both `--bbox` and `--ring-polygon` are supplied, the explicit bbox controls the WFS request while polygon clipping controls retention.

---

## Determinism

External source data can change, so regeneration is an intentional development action. A promoted static artifact must be version-pinned together with:

- generation timestamp,
- source URLs,
- OSM relation ID used for boundary generation (if applicable),
- selected WFS feature types,
- bounding box,
- polygon vertex count,
- source/schema metadata,
- licenses/required attribution,
- importer commit/version.

Runtime must never silently refresh any of it.

CI does not call OSM or Berlin WFS. Geometry/schema tests use local fixture data.

---

## Required next precision steps

Before official imported geometry replaces the curated graph:

1. generate and visually verify the Ring polygon candidate,
2. pin exact current Detailnetz WFS feature type/property identifiers,
3. join official address points to retained street geometry,
4. construct connected bike-usable routing topology from retained linework,
5. preserve intersections, named bridges and meaningful route choices during simplification,
6. retain parks, landmarks and Ringbahn orientation metadata,
7. produce compact static JS/JSON suitable for GitHub Pages,
8. run connectivity/address/pacing/high-load/UI-readability gates on the imported candidate,
9. compare imported vs curated map legibility before switching authority,
10. review source-license/attribution obligations for the exact generated artifact.

Precision is useful only when it improves dispatch decisions. Navigation-grade detail that obscures riders, contracts or route choices should be simplified rather than rendered verbatim.
