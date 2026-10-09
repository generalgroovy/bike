# Radio & rhythm — Send It 0.19

The Berlin desk now talks back. New shifts use capacity-aware v7 demand; existing v4–v6 records keep their original simulation.

## A conversation with consequences

Confirm a broadcast to hear your dispatch call. A forecast is still only a forecast. Kira is brisk and precise, Mauro is dry and fee-conscious, and Brian is patient and practical. Actual acceptance, collection, a closed delivery window, completion, a missed job and a needed break each have contextual responses. The lines use the parcel, location, weight, reward, remaining time and existing tour where relevant.

One short exchange appears on the map; dismiss it with ×. Its job chip opens that job. Menu → Radio log pauses the shift and shows its latest 12 exchanges; closing the log restores the previous pause state. Messages are local presentation, never instructions to riders. A fresh or restored shift starts a fresh radio history.

The synthesized score now has a soft wooden dispatcher voice. Your radio phrase asks, the accepting rider answers with their own instrument, and completion receives a quiet desk response. Foreground exchanges and oscillator counts are bounded; important outcomes take precedence over arrival chatter. Task pressure retains half, quarter, eighth and sixteenth notes. Sound is optional, and all actual decisions remain visible while muted.

## Bikes riding streets

Road, city and cargo bikes show their shape, rider posture, wheels and pedals. Pedaling follows actual distance traveled. The upcoming street route stays solid; completed segments fade into the map. Pausing freezes the scene, and reduced-motion mode suppresses decorative cycling. Bike positions, travel times and route hitboxes remain tied to the simulation.

## A busier, manageable desk

| New shift | Opening jobs | Delivery target | Maximum active queue |
|---|---:|---:|---:|
| First shift, 3 minutes | 2 | 6 | 7 |
| Berlin shift, 9 minutes | 4 | 26 | 10 |

New work considers free tour slots, compatible parcel weight and current service areas. Busy riders create opportunities near their route or final stop. Arrivals ease when the waiting desk fills or the team lacks usable capacity. Every parcel still requires an offer and a rider's voluntary acceptance. There is no assignment or reserved job.

In a three-seed simulation with an open broadcast every five seconds and the same bike upgrade, standard v7 shifts generated 33–36 jobs, completed 31–35 and missed 1–2. The same policy on v6 generated 27, completed 18–21 and missed 6–9. Additional accepted parcels increased from 9–12 to 20–28. These are synthetic balance checks, not human playtest results or a guarantee for every seed. The target of 26 leaves headroom for a human to inspect offers.

## Try this

1. Prepare a first shift in Mitte. Click All riders once: inspect the likely volunteer and consequences. No offer has been sent and no rider has spoken.
2. Click it again. Your dispatch bubble appears. Start the clock and watch a rider volunteer in their own voice.
3. Offer the second parcel. Try a personal invitation or a bonus; compare the consequences before sending. Riders can collect along their existing route or after current work when both commitments fit.
4. Enable sound. Match the three instruments to the riders and notice the quiet dispatcher reply when a delivery lands.
5. Pause, zoom in and inspect a bike. Open Menu → Radio log, then return. Resume and watch wheels move with real travel rather than a glowing fuse.
6. For a busier test, start a nine-minute shift. Read endurance, capacity, delivery windows and projected buffers before using your radio slots.

## Run and verification

Browser: https://generalgroovy.github.io/bike/ . After an online update, Menu → Update offline copy refreshes a previously downloaded offline game. Windows: double-click `Send-It-0.19.0-Windows-Portable.exe`, or use the per-user Setup executable. Source: `python -m http.server 8080`, then open `http://localhost:8080/`.

The release evidence records the exact commit, automated checks and downloaded executable hashes. Human enjoyment, listening comfort and physical-phone acceptance still require playtesting. The installer can be built without proving install/uninstall behavior on every device.
