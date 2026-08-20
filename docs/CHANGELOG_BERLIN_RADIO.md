# Send It v5 — Berlin dispatch overhaul

## Identity / layout

- Renamed player-facing game to **Send It**.
- Replaced multi-panel dashboard with compact command bar, horizontal contract rail, dominant map and rider instrument dock.
- Moved explanatory text into hover/help/contextual inspector.
- Added stable hover focus between cards and map entities.
- Added selected-contract decision inspector.
- Rider cards now show task progress, ETA and energy.

## Dispatch mechanics

- Preserved indirect rider autonomy.
- Retained OFF / OPEN / PRIORITY / LOCAL radio choices.
- Added Dispatch Focus.
- Added cash bonus intervention.
- Added client deadline negotiation.
- Added rebroadcast attention intervention.
- Added proactive/active detour advisory.

## Berlin / progression

- Expanded map to a much larger Ringbahn-oriented inner-city model.
- Added 27+ S41/S42 station orientation anchors.
- Expanded to 110+ real-named streets, 900+ graph nodes and 600+ address/service nodes.
- Added staged playable-area expansion:
  - Center Desk
  - Inner City at 6 deliveries
  - Inside the Ring at 16 deliveries
- Camera now fits/zooms out with operating-area expansion.
- Unified visual street unlocks with subdivided routing unlock state.

## Variation

- Added Flowers, Keys, Catering and Cold-chain alongside existing cargo.
- Cargo classes unlock with operating territory.
- Added RUSH special contracts.
- Added RETURN contracts that generate paid reverse follow-up work.
- Goals expand from local street/area objectives into bridge and cross-area work.

## Validation

- Browser entry/render files are syntax-checked by the test command.
- Current suite expanded to 35 passing tests including UI structure, natural progression, interventions, Ringbahn coverage and high-load simulation.
