# Send It 0.23 · first calls and shift postcards

This slice gives a shift a clearer opening, three visible goals and a result worth revisiting. It adds presentation and local keepsakes around the existing Berlin simulation. Street data, routing, job generation, balance and saved-shift rules remain unchanged. Riders still decide which offers to accept.

## First delivery

The selected-offer panel now guides a training shift through selecting a job, previewing a broadcast, reviewing the same option, starting the clock and following the rider. The guide highlights the actual radio or clock control; its only extra button selects a relevant offer when necessary. It never broadcasts, confirms or starts the clock for the player. **PREVIEW · NOT SENT** is a quiet blue dashed card. **Send call** on the same radio option confirms it; **On air** marks a live broadcast. If circumstances change, **Refresh** updates the preview before another click can send it.

The guide distinguishes pickup, collection, travel, delivery-window waiting and handover. It disappears after the first completed delivery and yields to urgent deadline or departure warnings, upgrades and the shift review. A changed forecast requires renewed review through the existing two-click broadcast flow. Help remains available from Menu. Inspecting a second offer keeps its own preview guidance even while another rider works. Accepted work names the actual rider and explains the current phase: radio space freed, handling time, weight on board or the final handover.

Radio replies show the actual speaker’s bicycle and map color. The first confirmed call gets a dispatcher opening; the first delivery gets a rider-specific acknowledgment when there is no more pressing deadline or continuing-tour detail. Forecasts never generate a rider reply.

Setup opens a paused desk. Opening it with unchanged settings retains the already-prepared game and map; choosing another duration or locality still prepares the requested run. Saved-shift restoration and exact retry keep their original rules.

## Three stamps

The setup presents the goals; the delivery counter opens their current progress. Inspecting **Stamps & postcards** holds the clock until the dialog closes.

| Stamp | Actual criterion |
| --- | --- |
| **Target met** | Complete the delivery target for this shift's ruleset. Current full-city rules use 6 deliveries in a first shift and 26 in a full shift; older rules keep their own targets. |
| **In the flow** | Reach a best streak of 3 consecutive deliveries in a first shift, or 6 in a full shift. Any missed job resets the current streak; an earned best streak remains recorded. |
| **Whole crew** | Every rider completes at least one delivery during this shift. Acceptance alone does not count. |

Stamps add no money, upgrades or rider powers. A quiet, original stamp flourish can mark an earned stamp; important rider replies and outcomes take priority over it. Stamps can survive a later failed shift, so they are shown separately from the final outcome.

## Review and local album

The finished-shift review produces a standalone 960 × 640 SVG postcard. It includes actual totals, earned stamps and rider sign-offs derived from their deliveries, missed accepted jobs and departure state. A rider who left is described as having signed off, even if they delivered earlier.

The map uses real street geometry and marks the pickup and delivery points of completed jobs. It does not claim to show the route a rider travelled. The SVG includes source attribution and a text description, works without external image assets, and can be saved with **Save postcard**.

The device album keeps up to 24 distinct challenges, with one best finished attempt per challenge. A challenge is identified by city, ruleset, seed, mode and starting locality. Attempts are compared in this order: successful outcome, number of stamps, completed deliveries, fewer misses, then net earnings. The album preserves a single actual attempt; it never combines stamps from different runs.

The album uses local storage and has no account, server leaderboard or cross-device sync. If storage is unavailable, the review still offers the SVG download.

## Retry and challenge

**Retry this exact shift** preserves the city, seed, mode, starting locality and ruleset. **Copy challenge link** carries the same configuration, including supported legacy rules. It shares the opening conditions, not saved actions, results or assigned riders. New decisions can produce a different outcome. **Choose another shift** opens setup for a fresh run.

## Human playtest acceptance

Automated checks can verify state, rendering and replay integrity. They do not establish whether the game is fun or ready for a wider audience. Observe first-time players without coaching, then ask:

- **First call:** Can they preview, confirm and start their first broadcast without opening Help or receiving instructions? Record where they hesitate and whether they mistake a preview for acceptance.
- **Meaningful choice:** Can they name a tradeoff they chose between radio reach, rider preference, bonus, deadline extension or an extra stop? Record the decision and why it mattered.
- **Accurate consequences:** Can they explain who chose the work, what a signal changes, and why the result differed from the forecast? Compare their explanation with the actual shift record.
- **Desire to retry:** After seeing the postcard, do they want another attempt? Ask what they would change and whether a particular stamp or rider gave them a reason. Observe whether they actually start again.

Use these observations to choose the next improvement. Clear controls, a meaningful choice, understood consequences and an unprompted retry are acceptance evidence to gather, not outcomes this release claims to have proved.
