# Send It — Berlin source and fidelity policy

The runtime map is a deliberately compressed game model, not navigation/GIS data.

## Current reference hierarchy

1. **Berlin Open Data — Detailnetz Berlin**
   - detailed street-network reference
   - `https://daten.berlin.de/datensaetze/detailnetz-berlin-wfs-4f2045ef`
2. **Berlin Open Data — Adressen Berlin**
   - official address-point reference for the planned build-time precision import
   - `https://daten.berlin.de/datensaetze/adressen-berlin-wfs-634ab8ba`
3. **BVG network / tariff references**
   - used to define the intended inner-city/Ringbahn operating frame
   - `https://www.bvg.de/en/subscriptions-and-tickets/tariff-zones-and-networks`
   - `https://www.bvg.de/en/connections/network-maps-and-routes`

## Current gameplay fidelity

The committed static model uses:

- 12 broad inner-Berlin operating areas,
- 110+ real street names,
- 27+ S41/S42 station anchors,
- 900+ graph nodes,
- 600+ deterministic service/address nodes,
- water, parks, bridges and landmarks as orientation anchors.

Street names and broad relative topology are real-inspired. Geometry and current generated house numbers are gameplay abstractions and must not be represented as parcel-accurate real-world routing.

## Runtime rule

GitHub Pages must not require:

- commercial map tiles,
- geocoding APIs,
- routing APIs,
- API keys,
- live WFS calls.

## Next precision tier

Official Berlin WFS data should be imported **offline at build/development time**, clipped/simplified to the playable Ringbahn-oriented region, normalized into the game graph, and committed as static generated data with source date/license metadata.
