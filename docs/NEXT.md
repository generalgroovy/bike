# Send It — next quality slices

Prioritize depth, precision, readability and measured play quality over feature count.

## Completed in the current v5 iteration loop

- [x] Rider personality balance gates and specialist/generalist tuning.
- [x] Route, rain, venue-release and transit-outage events with forecasted counterplay.
- [x] Demand-surge area highlighting on the Berlin map.
- [x] Causal post-shift critical timeline.
- [x] Comparable run telemetry: throughput, call/take delay, queue/radio peaks and area timing.
- [x] Full-Ring pacing gate; second expansion moved from 16 to 30 completed deliveries.
- [x] Cargo handling semantics affecting loaded speed and fatigue.
- [x] Future rider availability outlook without pre-assignment.
- [x] Strategic upgrades tied to cargo, LOCAL radio, event intelligence and break recovery.
- [x] Official Berlin WFS importer foundation with deterministic normalization tests.

## Next slices

1. **Integrate official static Berlin data into a candidate graph**
   - replace rough bbox with a documented S41/S42 interior polygon,
   - inspect exact WFS schemas and pin source-field mappings,
   - join official address points to retained street geometry,
   - construct connected bike-usable topology,
   - compare imported vs curated map readability before switching authority.

2. **Real browser acceptance / human telemetry**
   - desktop aspect ratios and zoom behavior,
   - task-rail density and horizontal scanning,
   - hover usefulness and inspector placement,
   - rider outlook comprehension,
   - event-area legibility,
   - record human run telemetry instead of relying only on autoplay.

3. **Feedback and charm without visual noise**
   - subtle pickup/dropoff confirmation,
   - rider motion orientation/cadence,
   - restrained radio/commit feedback,
   - optional lightweight sound cues,
   - reduced-motion-safe behavior.

4. **Contract-chain depth**
   - refine RETURN jobs and event-generated work,
   - explore realistic multi-stop or scheduled-window contracts only if they remain understandable in the same radio loop,
   - avoid direct reservation/pre-assignment.

5. **Balance from measured runs**
   - personality win distribution,
   - intervention usage,
   - average full-Ring unlock time,
   - event preparation rate,
   - break overlap,
   - cargo workload effects,
   - failure classification mix.

6. **No second city yet**
   - Berlin remains the benchmark until geography, interaction and the single-run dispatch loop are excellent.
