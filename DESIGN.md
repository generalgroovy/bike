# BIKE — Design North Star

## Core identity

BIKE is an indirect-control logistics roguelike. The player is the dispatcher at a bicycle-courier radio desk.

The player does **not** assign riders to jobs. The atomic decision is:

```text
job appears
→ decide whether it deserves airtime
→ choose how to broadcast it
→ riders visibly deliberate
→ one rider independently claims it
→ learn from the outcome
```

Every system must preserve that autonomy. A feature that becomes “click rider → click job” is outside the design.

## The three strategic layers

1. **Triage** — which jobs should be audible at all?
2. **Signal** — should a job be OPEN, PRIORITY or LOCAL?
3. **Timing** — should bandwidth be spent now or saved for a better-positioned future job?

The player controls the choice environment, not the final choice.

## Berlin: fixed city, procedural shift

The first city uses a recognizable stylized Berlin skeleton: districts/areas, the Spree, Tiergarten, Tempelhofer Feld, major hubs, landmarks and named crossings. The city is an abstraction for gameplay, not a navigation map.

Fixed enough to learn:
- macro geography
- relative district positions
- river and parks
- important corridors
- landmarks
- named Spree crossings

Procedural per shift:
- local service points
- rider roster
- personalities and experience
- run trait
- job stream
- city goals
- road disruptions
- upgrade order
- improved bike corridors

The desired mastery loop is: **learn Berlin → learn this team → read this shift**.

## District rule

Districts are spatial language, not cargo stereotypes. Food, parcels, documents, medical jobs, groceries and fragile cargo can spawn across the city.

Districts matter because they define relative position, rider locality, landmarks, goals and route geometry.

## Radio channels

Radio bandwidth replaces direct orders.

- **OPEN — cost 1:** neutral broadcast. Every free rider weighs it normally.
- **PRIORITY — cost 2:** raises a job's attractiveness for all riders. It is a strong signal, never an assignment.
- **LOCAL — cost 1:** favours riders already near the pickup area and can be unattractive to distant riders.

A future channel is valid only if it changes information exposure or weighting without selecting a specific rider.

## Rider model

Personality defines what a rider values. Experience defines how quickly and consistently they express that personality.

- Sprinter: proximity + urgency
- Earner: payout
- Guardian: urgent/medical calls
- Local: nearby/familiar pickups
- Tourer: landmarks and longer rides
- Steady: balanced choices

Experience runs Rookie → Regular → Experienced → Veteran.

### Deliberation is gameplay

Rider choice must not appear instantaneous or magical. Idle riders enter a visible deliberation phase:

```text
hears calls
→ attention line points toward current preference
→ white decision ring fills
→ rider commits
```

The player should be able to react during this short window by withdrawing or changing a call, but never by forcing the outcome.

## Information philosophy

Expose enough to predict behavior without exposing exact utility numbers.

Always expose:
- rider position
- personality
- experience
- current state
- current deliberation target/progress
- likely choice when listening
- reason for last choice
- job deadline
- payout
- endpoints
- radio channel
- nearest free-rider distance
- current road disruption forecast

The desired thought is “Maya is a Sprinter near Alex and D7 is LOCAL, so she is probably considering it,” not “Maya has 3.284 utility.”

## Berlin crossings and events

The Spree should be strategically meaningful. Named crossing edges include Moltkebrücke, Jannowitzbrücke and Oberbaumbrücke. Goals can require actual completed routes to use a crossing.

Temporary road events are forecast before they become active. They alter route cost and movement speed, and riders reconsider routes at intersections.

Examples:
- roadworks
- demonstration
- bridge squeeze

Events must create a readable planning problem, not arbitrary punishment.

## Goals

Good goals make geography matter without coupling cargo types to districts:
- serve Brandenburger Tor
- complete Kreuzberg-linked jobs
- use Oberbaumbrücke three times
- cross the Spree five times
- complete reliability milestones

## Post-shift learning

Failure should teach the next run. Dispatch Review distinguishes:
- jobs never called
- jobs called but never accepted
- jobs accepted too late
- bandwidth-blocked call attempts
- channel success rates
- top rider
- last critical radio/event moments

The review should produce a short actionable diagnosis instead of only a score screen.

## Visual hierarchy

Read the map in this order:
1. riders
2. live calls and channel strength
3. deliberation / attention lines
4. urgent uncalled jobs
5. accepted routes
6. active/forecast road disruptions
7. landmarks and Spree crossings
8. roads
9. districts
10. decoration

Map language:
- dim job = exists, not called
- broadcast arcs = live call
- channel badge O / ! / L = OPEN / PRIORITY / LOCAL
- dotted rider line = attention
- white ring around rider = deliberation progress
- dashed rider-color route = claimed job
- red/orange road = active/forecast disruption
- outer job ring = remaining deadline
- number inside rider = experience

## Quality bar

Before adding breadth, ask:
- Can a new player explain the core verb after 30 seconds?
- Can they distinguish OPEN, PRIORITY and LOCAL without reading a wiki?
- Can they see which rider is considering which job?
- Can they respond to a forecast before it becomes a penalty?
- Does Berlin remain recognizable after procedural variation?
- Do districts matter spatially without determining cargo type?
- When they lose, does Dispatch Review identify a plausible mistake?
- Does replaying a seed invite a different radio strategy?

If not, improve clarity and decision quality before adding systems.
