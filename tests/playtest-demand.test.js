import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeInnerRing } from '../src/inner-ring-city.js';
import { BerlinPlaytest, FIXED_STEP, replayRun } from '../src/game-berlin-playtest.js';
import { demandCapacity } from '../src/playtest-demand.js';

const city = decodeInnerRing(JSON.parse(readFileSync(new URL('../generated/berlin-city.json', import.meta.url))));
const make = options => new BerlinPlaytest({ city, seed: 'DEMAND-TEST', ruleset: 'berlin-dispatch-v7', ...options });
const snapshot = g => JSON.stringify({ rng: g.rng, couriers: g.couriers, deliveries: g.deliveries,
  actions: g.actions, log: g.dispatchLog, stats: g.runStats, tick: g.tick, cash: g.cash });

test('v7 opens more work with unchanged three-bike autonomy and separate legacy configuration', () => {
  const g = make(), legacy = make({ ruleset: 'berlin-dispatch-v6' });
  assert.equal(g.ruleset, 'berlin-dispatch-v7');
  assert.equal(g.capacityDemand, true);
  assert.equal(legacy.capacityDemand, false);
  assert.equal(g.deliveries.length, 2);
  assert.equal(legacy.deliveries.length, 1);
  assert.equal(g.config.target, 6);
  assert.equal(legacy.config.target, 4);
  assert.equal(g.config.maxQueue, 7);
  assert.deepEqual(g.couriers.map(c => [c.bikeType, c.capacityKg, c.baseSpeed]), legacy.couriers.map(c => [c.bikeType, c.capacityKg, c.baseSpeed]));
  assert.ok(g.deliveries.every(d => !d.called && d.courierId === null && d.status === 'waiting'));
  assert.ok(g.couriers.every(c => c.stops.length === 0));
  assert.ok(g.arrivalInterval() < legacy.arrivalInterval());
});

test('demand capacity reads local compatible work without consuming randomness or changing decisions', () => {
  const g = make(), before = snapshot(g), first = demandCapacity(g);
  for (let i = 0; i < 5; i++) {
    const next = g.demandCapacity();
    assert.equal(next.waiting, first.waiting);
    assert.equal(next.freeSlots, first.freeSlots);
    assert.ok(next.riders.every(row => row.slots >= 0 && row.slots <= 2));
    g.arrivalInterval();
  }
  assert.equal(snapshot(g), before);
  // A weight-incompatible offer must not block the nearby road bike's area.
  const d = g.deliveries[0];
  g.deliveries[1].status = 'completed'; d.type = 'grocery'; d.weightKg = 16;
  const heavy = demandCapacity(g);
  assert.equal(heavy.riders[0].nearby, 0);
  assert.equal(heavy.riders[1].nearby, 0);
  assert.equal(heavy.riders[2].nearby, 1);
});

test('automatic demand waits when riders recover, then resumes without accumulating impossible jobs', () => {
  const g = make();
  for (const d of g.deliveries) d.status = 'completed';
  for (const c of g.couriers) { c.radioOn = false; c.phase = 'break'; c.fatigue = .9; }
  const before = snapshot(g), slowed = g.arrivalInterval();
  assert.equal(g.demandCapacity().freeSlots, 0);
  for (let i = 0; i < 12; i++) assert.equal(g.spawnDelivery(), false);
  assert.equal(snapshot(g), before, 'A blocked arrival does not consume RNG, create a parcel or mutate a rider');
  const rider = g.couriers[0]; rider.phase = 'idle'; rider.radioOn = true; rider.fatigue = .2;
  assert.ok(g.arrivalInterval() < slowed);
  assert.equal(g.spawnDelivery(), true);
  const offer = g.deliveries.at(-1);
  assert.ok(['document', 'fragile'].includes(offer.type));
  assert.ok(offer.weightKg <= rider.capacityKg);
  assert.equal(offer.courierId, null);
  assert.equal(offer.status, 'waiting');
  assert.equal(offer.called, false);
  assert.deepEqual(rider.stops, []);
});

test('unanswered demand stays bounded even while three riders could theoretically carry more', () => {
  const g = make({ mode: 'standard' });
  for (let i = 0; i < 20; i++) g.spawnDelivery();
  assert.equal(g.deliveries.length, 4);
  assert.equal(g.activeDeliveries().filter(d => d.status === 'waiting').length, 4);
  assert.equal(g.runStats.peakActive, 4);
  const before = snapshot(g);
  assert.equal(g.spawnDelivery(), false);
  assert.equal(snapshot(g), before);
});

test('two committed jobs consume a rider demand slot even before either parcel is collected', () => {
  const rider = { id: 'c0', bikeType: 'road', capacityKg: 5, radioOn: true, phase: 'pickup', fatigue: .2, x: 0, y: 0 };
  const jobs = [{ status: 'claimed', courierId: 'c0', pickedUp: false, dropoffId: 'end' },
    { status: 'claimed', courierId: 'c0', pickedUp: false, dropoffId: 'end' }];
  const game = { couriers: [rider], activeDeliveries: () => jobs, riderJobs: () => jobs, nodeById: () => ({ x: 20, y: 0 }) };
  assert.equal(demandCapacity(game).freeSlots, 0);
  jobs.pop();
  assert.equal(demandCapacity(game).freeSlots, 1);
  rider.radioOn = false;
  assert.equal(demandCapacity(game).freeSlots, 0);
});

test('v7 replay reproduces denser arrivals, early collection windows and autonomous combined tours', () => {
  const g = make({ seed: 'BERLIN-1' });
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 11000 && !g.gameOver; tick++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % 300 === 0) for (const d of g.activeDeliveries().filter(d => d.status === 'waiting' && !d.called))
      g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
    g.update(FIXED_STEP);
  }
  assert.equal(g.outcome, 'success');
  assert.ok(g.deliveries.length >= 8, 'The first shift carries materially more than the five v6 arrivals');
  assert.ok(g.deliveries.some(d => d.deliverAfter > d.createdAt));
  assert.ok(g.deliveries.some(d => d.planMode === 'on the way' || d.planMode === 'next'));
  assert.ok(g.couriers.every(c => c.completed > 0), 'The seed exercises all three bike personalities');
  assert.deepEqual(replayRun(g.exportRun(), { city }).exportRun(), g.exportRun());
});

test('v6 retains the exact pre-v7 full-shift state and random stream', () => {
  // Golden captured from 0.18 source 25b94c4, independently compared with
  // the new class for v4/v5/v6 before accepting the new demand implementation.
  const g = make({ seed: 'LEGACY-DEMAND-PIN', ruleset: 'berlin-dispatch-v6' });
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 11000 && !g.gameOver; tick++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % 60 === 0) for (const d of g.activeDeliveries().filter(d => d.status === 'waiting' && !d.called))
      g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
    g.update(FIXED_STEP);
  }
  const state = { run: g.exportRun(), rng: g.rng.state, couriers: g.couriers, deliveries: g.deliveries };
  assert.equal(createHash('sha256').update(JSON.stringify(state)).digest('hex'),
    '1f92c077c99331723cbfd83997df2fc159b0950bb5fa252e2eea8a9c9491b65b');
});
