# Send It — Berlin acceptance build

8 October 2026 · full-city ruleset `berlin-dispatch-v6` · original score **Spokes & Postcards**

[Guided first shift](https://generalgroovy.github.io/bike/preview/berlin/?city=berlin&mode=training&district=mitte&seed=BERLIN-1) · [Citywide desk](https://generalgroovy.github.io/bike/preview/berlin/?city=berlin&mode=standard&district=citywide&seed=BERLIN-1) · [Map provenance](https://generalgroovy.github.io/bike/preview/berlin/map-data.html)

Berlin is the first acceptance map. It covers the complete official city boundary, all 97 localities and 12 boroughs. The next gate is player understanding, enjoyment and actual-phone testing within Berlin, before another city or more management systems.

## A believable decision with a visible consequence

You control the offer and the radio. Autonomous couriers compare calls, volunteer, travel on directed street routes, collect cargo, deliver it and take their own breaks. No player action assigns, reserves or relocates a rider. Camera focus and read-only offer explanations never advance the simulation or consume its random stream.

The vocabulary stays compact:

| Choice | Benefit | Cost or limitation |
| --- | --- | --- |
| OPEN | All listening riders judge the offer | One radio slot; no guaranteed volunteer |
| LOCAL | Better appeal near the pickup; less appeal farther away | One slot; nearby riders may still prefer other work |
| PRIORITY | Adds attention to the offer | Two slots; travel and handoff times stay the same |
| Courier bonus | Makes the offer more attractive | €5 paid immediately from desk cash; client fee is unchanged |
| Personal invitation | Increases one rider's interest | No reservation; capacity, endurance, other calls and deadlines still matter |
| Call client | Adds up to 20 seconds to an unclaimed job | One agreement per job; 20% fee concession, at least €3; cannot pass closing time |
| Withdraw | Frees the radio slot(s) | Work stays on the desk; its deadline continues |

The client offer displays the actual extra time, fee deduction and resulting fee before the click. It rejects repeated agreements, claimed or expired jobs and extensions with less than five useful seconds before closing. The shift review records concessions and bonuses separately. The saved action record includes the negotiation.

**First click previews, second click broadcasts.** The preview names the likely volunteer, why the offer fits, the estimated finish and radio cost. It compares other live offers and current deliberations. If the leading rider or offer changes before confirmation, the click refreshes the forecast instead. Changing the selected job or improving the offer clears the draft. Preview, map and selection actions never appear in the saved action history. Rider estimates expands the other candidates and their reasons for passing. These are current estimates, not promises or future assignments.

## Bikes, endurance and two-job routes

The rider strip keeps bike type, preferences, accepted parcel types, numerical current / maximum endurance, and carried / maximum kilograms visible. Bike silhouettes replace map portraits for v6: a road frame, city basket and front cargo box. Their endurance ring, load bar and job-count badge echo the strip; tapping a rider locates them, and their job chips select every accepted parcel.

| Rider | Bicycle | Capacity | Accepted work | Preference |
| --- | --- | ---: | --- | --- |
| Kira | Road | 5 kg | Light, delicate | Light parcels and short urgent trips |
| Mauro | City | 12 kg | Light, delicate, heavy | Good fees and delicate parcels |
| Brian | Cargo | 30 kg | Light, delicate, heavy | Heavy loads and familiar streets |

Riding starts at 9.5 / 8.5 / 7.7 world units per game second, versus 15 / 13.5 / 14 in v5. Actual pace also reflects the street, cargo, load and fatigue. Loaded weight slows movement and increases fatigue; capacity applies to the parcels on the bike at each planned stop. A later pickup can therefore fit after an existing parcel is delivered even when both parcels could not be carried together.

Riders autonomously consider one additional job while travelling or waiting. The planner compares pickup/delivery insertion orders, respects directed streets, locks handoffs already underway, and checks both deadlines, carrying capacity, endurance and a bounded detour for existing work. The maximum is two accepted jobs. New plans take effect at the end of the current street segment, without moving a rider to a different point. Failed or completed work is removed independently from the remaining itinerary.

Some offers allow immediate pickup but open for delivery 55 game seconds later. The parcel remains on the bike and consumes capacity until handover; the rider can use suitable waiting time for another job. The job panel shows when its delivery window opens. These are compressed shift-time windows, rather than a simulated full-day clock.

The guided shift lasts three minutes with a four-delivery target; the standard shift lasts nine minutes with a target of eighteen. Arrivals are spaced more widely and deadlines leave more travel time. The purpose is readable decisions at a slower pace; deterministic balance audits are a mechanical baseline, not evidence of human enjoyment.

## Physical work at real addresses

Previously, reaching an address instantly transferred the cargo. Full-city v5 adds stationary collection and handover phases:

| Cargo | Collection | Handover | Loaded riding |
| --- | ---: | ---: | --- |
| Light documents | 1.5 game seconds | 1.5 game seconds | Normal pace |
| Delicate | 3 seconds | 3 seconds | 10% slower |
| Heavy | 4 seconds | 3.5 seconds | 10% slower, more tiring |

Cargo becomes picked up only after collection finishes; payment arrives only after the final handover. The route estimate, per-job ETA, feasibility judgment and claim recheck include the same handling time and delivery-window wait. Riders may accept a compatible second job during a stop, but that handoff is finished before moving. Deadlines can still expire during a handoff.

Real route distances coexist with compressed riding and shift time. These handoff durations are tuned game time, not measured Berlin service times. Existing traffic-direction, cargo, fatigue, break and roadwork systems remain part of the causal model. Future disruptions and autonomous choices can still change a forecast.

V6 is explicitly versioned. V4 and v5 retain their former movement and decision rules, and the Inner Ring retains v3. Resuming an older saved shift uses its recorded ruleset; a fresh full-city shift uses v6. Every personal invitation is a validated replay action; a broadcast preview is presentation state only.

## Berlin, with real building detail

The unchanged routing pack is `berlin-city-v1-b81f2dddf012`: 43,473 displayed street sections, 45,618 sampled reachable addresses and 198,430 graph nodes. Streets, address pins, water, parks and administrative boundaries share EPSG:25833 at ten metres per game unit. The [full-city report](BERLIN_FULL_CITY.md) describes its source and route audit.

The separate, presentation-only layer `berlin-buildings-v1-5827632257d9` comes from [ALKIS Berlin Gebäude](https://daten.berlin.de/datensaetze/alkis-berlin-gebaude-wfs-728b368a), provided under **dl-de-zero-2.0**. It includes buildings and building parts; these are not 784,025 unique standalone buildings.

| Building detail evidence | Result |
| --- | ---: |
| Complete source records fetched | 784,026 |
| Records intersecting the city boundary | 784,025 |
| Polygon outlines | 784,054 |
| Spatial detail files | 926 |
| Largest compressed detail file | 115,551 bytes |
| All detail files, compressed | 28,819,847 bytes |
| Maximum measured processing deviation | 0.499840 m |

The builder checks every output polygon against its projected, boundary-clipped source geometry. It attempts 0.35 m simplification and 0.1 m coordinate rounding, retaining finer geometry when needed to preserve validity and stay below 0.5 m measured deviation. Nineteen invalid source geometries were repaired; 377 polygons required a fallback with more detail. These figures concern processing differences, not certified survey accuracy.

A separate validator checks every file hash, gzip equivalence, closed ring, finite coordinate, indexed bound and aggregate count. Footprints use the existing city's origin and scale. Polygon orientation preserves courtyard holes while overlapping building parts fill together. They do not introduce junctions, change addresses, block routes or alter gameplay costs.

Whole-city views use the lighter map. Detailed views request nearby footprint files from the same static site, with two requests at a time and at most 48 cached tiles. The base city download remains about 8.5 MB compressed. All building detail is **not** part of that initial download. Requests are aborted when the renderer is disposed. A failed optional detail layer reports its state while the street game continues.

## A coherent visual and musical identity

The visual language uses distinct bicycle silhouettes and established rider colors: cream paper, dark green ink, blue offer controls, ochre parcel requirements, green endurance, cadastral outlines and a stamped delivery receipt. The receipt names the courier, contract, destination and actual fee. A focused rider draws above others sharing the same real address, with a small count badge rather than relocating markers.

**Spokes & Postcards** is an original synthesized composition, sharing D minor pentatonic and 102 BPM across its phrases. It uses no sampled recordings or external audio services.

- Kira: a bright, quick bicycle-bell figure.
- Mauro: a warm, lower plucked figure.
- Brian: a gentler descending reed figure.
- Claiming and collecting use the courier's musical identity; a completed delivery resolves their phrase.
- New documents, delicate items and heavy cargo have different arrival cues. Radio channels, bonuses, client calls, breaks, return to radio, roadworks, upgrades and the final review have specific phrases.
- A sparse, four-bar score changes with the shift phase and active riders. It is scheduled from audio time without reading or changing simulation RNG.

Task pressure is an actual repeating part of the composition. The same little parcel motif changes its spacing on a shared sixteenth-note grid:

| Rhythm | When it comes forward | Pulses per four-beat bar |
| --- | --- | ---: |
| Half notes | More than 55% of the window and more than 25 seconds of estimated buffer | 2 |
| Quarter notes | At most 55% of the window or 25 seconds of buffer | 4 |
| Eighth notes | At most 30% of the window or 12 seconds of buffer | 8 |
| Sixteenth notes | At most 15% of the window or 4 seconds of buffer | 16 |

The most urgent matching rule wins. Buffer means deadline minus the current estimated finish, including travel, availability and handoffs. Claimed work uses its actual rider's ETA. A client extension can relax the pattern; a route slowdown can tighten it. The tempo stays at 102 BPM even at 2× simulation speed, so acceleration comes from the task's changing situation rather than a sped-up soundtrack.

The three most pressing jobs form the foreground, ordered by pressure then smallest buffer. The lead is louder, the others softer and their slower rhythms interleave. Light parcels pluck, delicate parcels chime and heavy parcels hum. A volunteer brings their own instrument to the task; a small phrase variation keeps successive jobs from sounding identical. The footer names the audible jobs and their divisions. This is an overview of pressure, not a guarantee that every job can be identified by ear in a crowded mix.

Stereo follows the current map view: waiting work sounds at the pickup, claimed work follows its rider, and roadwork cues come from the affected street. Collection starts with two soft taps; handover holds a note. Offbeat pedal notes rotate through moving riders and drop in pitch on a currently slowed edge. Break and return cues retain the rider's signature. Completion resolves the courier phrase; failure descends from the cargo's tonal register. Both stop that task's scheduled pulses and temporarily soften new accompaniment. Events start on the next sixteenth (normally within about 150 ms), including their resolution in the same musical grid.

Sound begins muted. The top Sound button enables it; **Sound & music** opens the paused listening studio with rider previews, four rhythm previews, a volume slider and **City score + field cues / Field cues only**. **Hear task pressure** is independent of the backing score. A 54-oscillator limit, fading cancellation, envelope cleanup and output compression bound bursts. Muting clears scheduled voices and silences the output; hidden tabs suspend audio. Old timeline events are not replayed as a burst when a saved shift is restored. Every event is also readable visually.

The downloadable 58-second audio study renders the exact in-game note scheduler through Chromium's OfflineAudioContext. It presents Kira, Mauro and Brian at 0, 3 and 6 seconds, job arrivals from 9 seconds, radio/client choices from 14 seconds, then pickups, deliveries and a short score passage. From 40 seconds it demonstrates half, quarter, eighth and sixteenth notes, one bar each, followed by completion, failure and the end of roadworks. Waveform checks verify finite samples, audible energy and headroom. Musical taste and long-session listening comfort still require people to listen.

## Run, reproduce and validate

Serve the feature checkout over HTTP:

```sh
python -m http.server 8080
```

Open `http://localhost:8080/`. Choose a locality or the citywide starting bases, then a guided or standard shift. Click All riders to preview the first offer, then Confirm to broadcast. Start shift advances time. Inspect a job to compare implications, tap a bike to locate a rider and zoom further for footprints.

```sh
npm test
node tools/validate-building-details.mjs
python -m pip install playwright==1.57.0
python -m playwright install chromium
python e2e/browser_smoke.py
python e2e/playtest_smoke.py
python e2e/city_smoke.py
node tools/replay-playtest.mjs path/to/shift.json
python tools/render-score-demo.py path/to/output-folder
```

On Windows PowerShell, use `npm.cmd test` if `npm.ps1` is blocked. Playing requires no map API key or build step. Rebuilding source data is optional and requires `tools/requirements-map.txt`:

```sh
node tools/fetch-berlin-city.mjs ../berlin-building-source buildings
python tools/build-berlin-buildings.py ../berlin-building-source generated/berlin-buildings ../building-scratch
```

Use new or empty output/scratch folders for an intentional rebuild. The complete hashed source snapshot is read in bounded memory; download pages are cached to resume acquisition.

## Acceptance gate before expansion

Automated evidence covers implementation correctness. Berlin is ready for acceptance **testing**, not declared player-approved by those tests.

1. A fresh player should make the first offer and describe who actually made the assignment decision.
2. Before using PRIORITY, a bonus or a client call, they should be able to explain its benefit and cost.
3. Observe central, citywide and outer-locality shifts. Check whether the player can follow collection, riding, handover and breaks without losing the queue.
4. Compare strategies on the same seed. Record the choices, surprises, failure causes and whether another attempt feels worthwhile; do not infer balance from one scripted win.
5. On physical iOS and Android devices, test loading, touch, interruptions, save/resume, battery/heat, audio activation and long-session readability. Test with sound off as well.
6. Without looking, identify which rider volunteered, whether work is being collected or handed over, whether pressure rose or fell, and whether a task completed or failed. Then look to verify. Test stereo headphones, a mono phone speaker, three urgent jobs together and at least a ten-minute session; record recognition, charm, repetition and fatigue before adding more instruments.

Only after those observations should the project broaden the scenario set, build offline/mobile packaging or introduce another city. Full map coverage does not imply complete bicycle-specific access rules, live construction knowledge or navigation suitability.
