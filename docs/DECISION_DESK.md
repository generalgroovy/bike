# Send It 0.18 — Read the ride

The radio desk should make a difficult choice understandable before the player spends attention, money or time. This refinement reveals the depth of the existing `berlin-dispatch-v6` game without changing its rules or saved replays.

## Play a decision

1. Choose a waiting job. The small lead above the queue highlights a current opportunity or constraint; clicking it selects the relevant job.
2. Preview All riders, Nearby or Priority. The likely volunteer is still a prediction; no offer is broadcast on this first click.
3. Read the estimated deadline buffer, endurance at the end of the **whole tour**, highest simultaneous load and extra tour time. Existing promises show their projected delay. Current energy and carried weight remain visible on the rider cards.
4. Open the stop trail for the actual proposed pickup/drop-off order, address, completion time and delivery-window waits. Compare another rider from Rider estimates; inspecting them does not invite or assign them.
5. Change invitation, bonus or deadline if the tradeoff makes sense. Preview again, then confirm the same broadcast. Riders compare all live offers and decide independently.

After acceptance, **Remaining tour** keeps the next stop and ordered route available on the selected job. If the likely volunteer gains or finishes a stop between preview and confirmation, the outlook must be reviewed again; ordinary movement does not block confirmation.

The estimate accounts for current street costs, loaded riding, handoffs, later delivery windows and the rider's current commitments. Future traffic and new work can change it. Appeal reasons describe actual scoring inputs, not invented personality dialogue or guarantees.

## Where the interesting choices come from

- A parcel that cannot yet be handed over can leave time to collect and deliver another parcel. A suitable insertion can use that waiting time without delaying the first commitment.
- A lighter bike can reach an urgent document quickly but cannot take a heavy load. An invitation or bonus changes interest, never cargo compatibility.
- An apparently harmless extra pickup can consume endurance or carrying capacity. Compare the whole tour, not only the new parcel's finish.
- Priority uses two radio slots. A client extension trades part of the fee for time. Neither effect is a faster bike.
- The queue lead chooses one relevant situation rather than adding another dashboard. Detailed explanations and stop order remain optional.

## Music

The three rider signatures remain recognizable. Accepting a second compatible job adds a short answering bass figure. Waiting for a delivery window suspends the rider's phrase; the window opening answers it upward. Both share the existing 102 BPM grid. These cues occur on observed transitions, never on every redraw, and are not replayed when loading a saved shift or re-enabling sound. Existing parcel pressure still moves from half notes through quarters and eighths to sixteenths.

## Verification

- `npm test`: model, projection purity, capacity, deadline, route, replay and musical-transition checks.
- `python e2e/decision_smoke.py`: numerical preview, two-click broadcast, alternate rider inspection, combined jobs, delivery windows and narrow-screen interaction.
- Existing Classic, Inner Ring, full-city, desktop and published offline acceptance remain release gates.

Automated acceptance establishes behavior and layout at tested viewport sizes. It does not establish that people find the game fun or that audio is well balanced on every speaker. The next human session should ask the player to explain one invitation, one combined tour and one paid extension before expanding the simulation further.
