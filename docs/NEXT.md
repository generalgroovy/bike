# Send It — next quality slices

Prioritize depth, precision, readability and measured play quality over feature count.

## Completed in the current v5 iteration loop

- [x] Rider personality balance gates and specialist/generalist tuning.
- [x] Route, rain, venue-release and transit-outage events with forecasted counterplay.
- [x] Distinct event responses: route preparation vs client buffering; capacity planning vs surge pay.
- [x] Demand-surge area highlighting on the Berlin map.
- [x] Causal post-shift critical timeline and deterministic run telemetry.
- [x] Full-Ring pacing gate; second expansion moved from 16 to 30 completed deliveries.
- [x] Cargo handling semantics affecting loaded speed and fatigue.
- [x] Future rider availability outlook without pre-assignment.
- [x] Read-only Dispatch Insight: feasibility/slack, best rider fit, qualitative OPEN/LOCAL/PRIORITY comparison and suggested response.
- [x] Attention-first task-rail sorting while retaining arrival/urgency/payout/range views.
- [x] Strategic upgrades tied to cargo, LOCAL radio, event intelligence and break recovery.
- [x] Expansion operating doctrines: Signal Desk, Rider Care or Client Network.
- [x] Compact persistent doctrine memory in the AREA chip.
- [x] Official Berlin WFS importer foundation with Ring polygon clipping and deterministic normalization.
- [x] Official street-number-first address joining, canonical-name fallback, explicit geometric fallback accounting and Detailnetz node-ID topology.
- [x] Candidate quality gate for connectivity, address match and fallback share.
- [x] Shadow comparison against the curated runtime for street overlap, route-scale distortion and candidate quality before any authority switch.
- [x] Directional rider markers based on actual cargo-aware movement heading.
- [x] Restrained pickup/dropoff milestone feedback and active-riding cadence cues.
- [x] Reduced-motion-safe entity feedback with decorative motion frozen/removed while state remains visible.

## Next slices after v5

1. **Run the official static Berlin pipeline on current source snapshots**
   - import Detailnetz + Adressen using the documented Ringbahn polygon,
   - generate the candidate graph offline,
   - inspect schema/source diagnostics,
   - require low geometric fallback and high connected-network/address coverage,
   - run `compare:berlin-candidate`,
   - do not switch runtime authority unless the candidate clears every gate and remains readable.

2. **Real browser acceptance / human telemetry**
   - desktop aspect ratios and zoom behavior,
   - top-rail scanning under 10–20 simultaneous contracts,
   - Dispatch Insight usefulness without feeling like autoplay,
   - doctrine overlay comprehension,
   - Rider Outlook and event-response comprehension,
   - directional marker / milestone readability,
   - record human run telemetry instead of relying only on autoplay.

3. **Optional sound only if it improves recognition**
   - restrained radio/commit/pickup/dropoff cues,
   - clear mute path,
   - no constant ambience required,
   - avoid audio as the only source of state information.

4. **Contract-chain depth**
   - refine RETURN and scheduled-window work,
   - explore realistic multi-stop/paired contracts only if one contract remains readable at a glance,
   - keep every offer inside autonomous radio choice,
   - never introduce rider reservation/pre-assignment.

5. **Balance doctrines and interventions from measured runs**
   - doctrine pick distribution and win/survival effect,
   - personality win distribution,
   - intervention usage and opportunity cost,
   - average full-Ring unlock time,
   - event response rate by response type,
   - break overlap and cargo workload effects,
   - failure classification mix.

6. **No second city yet**
   - Berlin remains the benchmark until geography, interaction and the single-run dispatch loop are excellent.
