# Send It 0.15 — one understandable desk

The browser and Windows app share the same Berlin desk. A first shift and a full shift are duration choices in one setup screen; both use the same job list, map, riders and decision panel. `playtest.html` is a compatibility link to `index.html` and preserves existing seed, locality and scenario links.

## Play

1. Choose a starting locality and shift length, then **Prepare shift**. The clock stays stopped while you read the opening offers.
2. Select a job in **Your jobs** or on the map. Selection focuses its real route and opens its decisions. Selection does not broadcast, spend money, advance time or assign a rider.
3. Use **All riders** (OPEN, one slot), **Nearby** (LOCAL, one slot), or **Priority** (two slots). The highlighted button shows the live channel. Capacity and consequences are explained beside these controls.
4. Press **Start shift** in the fixed shift bar. Watch a rider volunteer, collect, ride and hand over. The rider strip stays visible beneath the map.
5. Use **Improve the offer** only when needed: pay a €5 bonus or negotiate more time for a lower fee. Each displays its actual cost before the action. **Who might take it — and why?** reveals the current estimates.
6. At delivery or a missed deadline, the selected job retains its result. **Choose the next job** returns to active work. End-of-shift review retains export and same-seed retry.

## Reduced duplication

- Queue cards only select. The old left-side OPEN/withdraw shortcut is removed; broadcasting and withdrawal live in the selected job.
- The clock and the one start/pause control share a persistent bar. Ready, live, paused, closing, upgrade and finished states use explicit labels.
- One job-state description drives the queue and inspector. A four-step strip shows offer, pickup, delivery and completion. Claimed jobs show rider progress instead of disabled offer controls.
- Setup has one primary action with a length selector. The logo no longer reloads the game. The optional historical Inner Ring link lives under Help instead of competing with current-shift controls.
- First-shift guidance lives beside the queue. It no longer overlays the map. Portraits and rider activity stay in a dedicated strip below the map.
- On a phone, selecting a job moves focus to its decision heading while the sticky clock remains available. The bottom navigation returns to map, jobs or selected job. Keyboard controls and reduced-motion support remain available.

## Authority and saved games

These changes read existing game state and use the existing action vocabulary. They do not change routes, eligibility, fees, deadlines, random choices or replay rules. Full Berlin remains `berlin-dispatch-v5`; supported older saves retain their recorded rules. Camera and selection actions remain presentation-only. Riders choose their own work.

## Verification

The browser suite exercises real controls for broadcasts, slot exhaustion, bonuses, client negotiation, autonomous deliveries, job closure, next-job selection, keyboard focus, mobile navigation, saves, replay and sound. Layout checks cover widths from 320 to 1440 pixels. Windows acceptance exercises the same controls in the packaged offline runtime.

Run the established checks with Node 24 and the documented Python/Playwright environment:

```powershell
npm.cmd test
python e2e/browser_smoke.py
python e2e/playtest_smoke.py
python e2e/city_smoke.py
npm.cmd run app:windows
node desktop/smoke.mjs "dist/win-unpacked/Send It.exe"
```

Automated checks establish behavior and layout, not human enjoyment or audio recognizability. Current build results belong in the matching CI run and downloadable handoff report.
