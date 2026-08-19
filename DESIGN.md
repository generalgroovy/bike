# BIKE — Design North Star

## Core identity

BIKE is not a unit-control game. The player is a courier dispatcher who curates the shared radio.

The atomic decision is:

```text
job exists
→ do I call it out?
→ free riders evaluate the live calls
→ one rider independently claims one
```

The player should never directly click “rider → job”.

## Berlin: fixed geography, procedural shift

A recognizable city is more learnable than a fully random graph, while a changing shift is more replayable than a fixed puzzle.

Fixed per city:
- macro geography
- districts/areas
- river and parks
- major corridors
- landmarks

Procedural per shift:
- local service points
- rider roster
- personalities and experience
- run trait
- job stream
- city goals
- upgrade order
- enhanced bike corridors

## District rule

Districts are spatial language, not cargo stereotypes. They tell the player where things are and provide explicit location goals. Normal cargo type generation stays independent of district identity.

## Rider model

Personality defines what a rider values. Experience defines how quickly and consistently they express that personality.

- Sprinter: proximity + urgency
- Earner: payout
- Guardian: urgent/medical calls
- Local: nearby/familiar pickups
- Tourer: landmarks and longer rides
- Steady: balanced choices

Experience runs Rookie → Regular → Experienced → Veteran. Higher experience reduces decision delay and decision noise.

## Information philosophy

Give the player enough information to predict, but not exact hidden utility scores.

Always expose:
- rider position
- rider state
- personality
- experience
- likely next call when idle
- reason for last choice
- job deadline
- payout
- endpoints
- nearest free-rider distance

The desired thought is “Maya is close and she is a Sprinter, so she will probably take D7,” not “Maya has 3.284 utility.”

## Visual hierarchy

Read the map in this order:
1. riders
2. live radio calls
3. urgent uncalled jobs
4. accepted routes
5. landmarks
6. roads
7. districts
8. decoration

Map language:
- dim job = exists, not called
- broadcast arcs = live call
- dotted rider line = likely choice
- dashed rider-color route = claimed job
- outer ring = remaining deadline
- number inside rider = experience

## Radio bandwidth

The live-call limit prevents “broadcast everything” from becoming optimal. It is the main strategic resource and a natural upgrade axis.

Future indirect-control tools should preserve rider autonomy:
- priority channel
- neighborhood-only channel
- rider-group channel
- emergency override with cost

## Goals

Good goals make geography matter without changing cargo stereotypes:
- serve Brandenburger Tor four times
- complete six Kreuzberg-linked jobs
- cross the Spree three times
- complete landmark-to-landmark jobs
- reach a reliability milestone

## Quality bar

Before adding breadth, test:
- Can a new player explain the core verb after 30 seconds?
- Can they tell which jobs are live on the radio?
- Can they see why a rider chose a call?
- Can they reason about rider position versus job position?
- Does the map read as Berlin?
- When they lose, can they identify the dispatch mistake?
- Does replaying a seed invite a different call-out strategy?

If not, improve clarity and decision quality before adding systems.
