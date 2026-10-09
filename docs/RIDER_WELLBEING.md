# Rider wellbeing · Send It 0.20

New full-Berlin shifts use `berlin-dispatch-v8`. Each rider starts at 72 / 100 satisfaction. The card shows satisfaction, its current band and waiting time. After a tour ends it also shows how long ago that was. A tour ends when its last accepted parcel is delivered or fails, so a second parcel on the same bike does not create a false gap between tours.

Click or tap the satisfaction meter to pause and inspect the exact rules. The details work with the keyboard, too. Endurance, carried weight, accepted cargo and preferences remain separate: satisfaction is about whether the working day feels worthwhile, not leg strength.

| Satisfaction | Band | Meaning |
| --- | --- | --- |
| 70–100 | Content | Work is going well. |
| 45–below 70 | Steady | Some room before frustration. |
| 25–below 45 | Restless | The rider speaks up about the wait. |
| Below 25 | At risk | A visible 20-second warning begins while waiting. |
| Signed off | Off duty | Unavailable until the next shift. |

Kira waits 30 seconds before losing satisfaction, Mauro 40, Brian 55. After that grace period, unoccupied waiting costs 0.7 points per simulation second. From the initial 72, an entirely neglected Kira reaches the warning after about 97 seconds, and leaves about 20 seconds later. The earlier restless message gives additional notice. These are compressed game timings, not claims about real couriers' working conditions.

Acceptance adds 18 satisfaction, clears the warning and resets idle waiting. Each completed delivery adds 10; a missed accepted parcel costs 6. Values stay between 0 and 100. A rider with accepted work never leaves that tour because of this system. Travelling, loading, handover, waiting for a delivery window and actual endurance breaks do not consume patience. Pausing or inspecting a dialog stops the simulation clock; closing protects the team while they finish the shift. At 2× speed these times advance with the rest of the game.

The dispatcher can broadcast fitting work, invite a rider, improve the fee or negotiate a deadline. Riders still decide. Previewing or repeatedly changing an offer does not restore satisfaction. Satisfaction does not secretly alter bid scores: its consequence is the explicit risk of losing that rider's availability for the rest of the shift. A rider who leaves is excluded from invitations, forecasts and available demand capacity; the remaining riders keep working. If the entire team signs off, the shift ends immediately with an explanation and a separate count of unserved offers. Those offers are not falsely recorded as expired deadlines. Starting a new shift restores the full team.

Warnings, recovery and sign-off each have a short conversation and a quiet musical phrase in the affected rider's instrument. The warning is a one-time event, not another repeating alarm. Job deadline rhythms retain their existing role. All information is visible when muted. Clicking a rider-only radio chip locates that rider.

## Try it

1. Prepare a fresh full-Berlin shift. All three cards begin at 72 / 100, with “Waiting for first tour.” Click a meter to inspect personal patience and the ranges.
2. Preview a fitting call, then confirm and start. The rider who accepts gains satisfaction; completing the final parcel sets the last-tour timer.
3. In a separate fresh standard shift, leave calls off air. Watch the early restless message, countdown, and eventual “Finished for today” state. Pause during the warning to inspect your options. An accepted fitting offer cancels the warning; a preview alone does not.
4. Save and reload. Satisfaction, waiting, warnings and departures reconstruct from the recorded shift; the desk reopens paused.

Older v4–v7 full-Berlin saves retain their recorded simulation, and the Inner Ring rules stay unchanged. Start a new full-Berlin shift to try wellbeing.

## Validation

Focused model checks cover thresholds, first-tour waiting, real clock speed, paused time, protected work/rest, warnings, recovery, multi-parcel tours, departures, unavailable offers and deterministic save/replay. A pre-change v7 full-shift state and RNG hash guards compatibility; existing v6 parity checks remain.

`node tools/check-wellbeing-balance.mjs` compares v7 and v8 on three seeds in both shift lengths, broadcasting available work every five seconds. In this sample, delivery/miss/job totals match across versions, with no warnings or departures under active dispatch. This is a regression and balance sample, not proof of every seed or human enjoyment. The standard runs finish 34/36, 35/36 and 31/33 jobs against the target of 26; all three training runs finish 9/9 against the target of 6.

`python e2e/wellbeing_smoke.py` exercises cards, keyboard details, narrow screens, genuine update-driven warnings/departures, actual voluntary recovery and save restoration. Warning fixtures shorten waiting deliberately; the replay case uses only recorded player actions. The packaged Windows smoke test checks the same wellbeing UI and restored state offline.
