import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeInnerRing } from '../src/inner-ring-city.js';
import { BerlinPlaytest, FIXED_STEP, replayRun } from '../src/game-berlin-playtest.js';
import { WELLBEING } from '../src/rider-wellbeing.js';

const city = decodeInnerRing(JSON.parse(readFileSync(new URL('../generated/berlin-city.json', import.meta.url))));
const make = options => new BerlinPlaytest({ city, seed: 'WELLBEING-TEST', ...options });
const closeTo = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`);
function clearWork(g) {
  for (const d of g.deliveries) d.status = 'completed';
  g.spawnAccumulator = -100000; g.eventFinished = true;
}
function advance(g, seconds, dt = FIXED_STEP) {
  g.paused = false;
  for (let i = 0; i < Math.round(seconds / dt) && !g.gameOver; i++) g.update(dt);
}
function pendingWarning(g, c, satisfaction = 24) {
  Object.assign(c.wellbeing, { satisfaction, idleSeconds: g.riderWellbeing(c).graceSeconds + 1, band: 'restless' });
  advance(g, FIXED_STEP);
  assert.equal(g.riderWellbeing(c).leaveIn, 20);
}
const snapshot = g => JSON.stringify({ riders: g.couriers, jobs: g.deliveries, rng: g.rng.state,
  log: g.dispatchLog, actions: g.actions, stats: g.runStats, routeCache: [...g.routeCache] });

test('v8 satisfaction bands and distinct patience are explicit; earlier rules have no counters', () => {
  const g = make(), older = make({ ruleset: 'berlin-dispatch-v7' });
  assert.equal(g.ruleset, 'berlin-dispatch-v8');
  assert.equal(g.wellbeing, true);
  assert.deepEqual(g.couriers.map(c => g.riderWellbeing(c).graceSeconds), [30, 40, 55]);
  assert.ok(g.couriers.every(c => c.wellbeing.satisfaction === 72 && !c.offDuty));
  assert.equal(g.riderWellbeing(g.couriers[0]).lastTourAgo, null);
  assert.equal(older.riderWellbeing(older.couriers[0]), null);
  assert.ok(older.couriers.every(c => !Object.hasOwn(c, 'wellbeing') && !Object.hasOwn(c, 'offDuty')));
  for (const [value, band] of [[100, 'content'], [70, 'content'], [69.9, 'steady'], [45, 'steady'], [44.9, 'restless'], [25, 'restless'], [24.9, 'at-risk']]) {
    g.couriers[0].wellbeing.satisfaction = value;
    assert.equal(g.riderWellbeing(g.couriers[0]).band, band);
  }
});

test('waiting starts from first offer and decays only beyond each rider patience', () => {
  const g = make({ mode: 'standard' }); clearWork(g);
  advance(g, 40);
  closeTo(g.riderWellbeing(g.couriers[0]).satisfaction, 65);
  closeTo(g.riderWellbeing(g.couriers[1]).satisfaction, 72);
  closeTo(g.riderWellbeing(g.couriers[2]).satisfaction, 72);
  closeTo(g.riderWellbeing(g.couriers[0]).idleSeconds, 40);
  assert.equal(g.riderWellbeing(g.couriers[0]).lastTourAgo, null);
});

test('pause, upgrade and closing protect morale; double speed follows the simulation clock', () => {
  const g = make({ mode: 'standard' }); clearWork(g);
  const c = g.couriers[0]; c.wellbeing.idleSeconds = 31;
  const original = structuredClone(c.wellbeing);
  g.update(10); assert.deepEqual(c.wellbeing, original);
  g.paused = false; g.upgradePending = true; g.update(10); assert.deepEqual(c.wellbeing, original);
  g.upgradePending = false; g.speed = 2; advance(g, 5);
  closeTo(c.wellbeing.satisfaction, 65); closeTo(c.wellbeing.idleSeconds, 41);
  const beforeClosing = structuredClone(c.wellbeing);
  g.elapsed = g.config.arrivals; g.closing = true; g.update(FIXED_STEP);
  assert.deepEqual(c.wellbeing, beforeClosing);
});

test('actual endurance breaks do not consume idle patience or departure countdown', () => {
  const g = make({ mode: 'standard' }); clearWork(g); const c = g.couriers[0];
  pendingWarning(g, c);
  assert.equal(g.startBreak(c, 5), true);
  assert.equal(g.riderWellbeing(c).leaveIn, null, 'A protected break does not display an active departure countdown');
  const before = structuredClone(c.wellbeing);
  advance(g, 5);
  assert.deepEqual(c.wellbeing, before);
  advance(g, .5);
  assert.equal(c.phase, 'idle');
  assert.ok(c.wellbeing.warningRemaining < 20);
  g.closing = true;
  assert.equal(g.riderWellbeing(c).leaveIn, null, 'Closing never threatens a departure that cannot happen');
});

test('warnings are issued once, use actual idle time, and end the rider day without a teleport', () => {
  const g = make({ mode: 'standard' }); clearWork(g); const c = g.couriers[0], position = [c.x, c.y, c.nodeId];
  pendingWarning(g, c); advance(g, 19);
  assert.equal(c.offDuty, false); closeTo(g.riderWellbeing(c).leaveIn, 1);
  const before = structuredClone(c.wellbeing); g.paused = true; g.update(5); assert.deepEqual(c.wellbeing, before);
  advance(g, 1.1);
  assert.equal(c.offDuty, true); assert.equal(c.radioOn, false); assert.equal(c.phase, 'off-duty');
  assert.deepEqual([c.x, c.y, c.nodeId], position);
  assert.equal(g.dispatchLog.filter(e => e.action === 'rider-warning' && e.rider === c.name).length, 1);
  assert.equal(g.dispatchLog.filter(e => e.action === 'rider-left' && e.rider === c.name).length, 1);
  advance(g, 10);
  assert.equal(g.dispatchLog.filter(e => e.action === 'rider-left').length, 1);
});

test('broadcast changes, invitation, bonus and previews cannot restore satisfaction or reset waiting', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  Object.assign(c.wellbeing, { satisfaction: 24, idleSeconds: 80, warningRemaining: 12, band: 'at-risk' });
  const original = structuredClone(c.wellbeing);
  for (const channel of ['open', 'off', 'local', 'off', 'priority', 'off']) g.dispatch({ type: 'radio', jobId: d.id, channel });
  g.dispatch({ type: 'prefer', jobId: d.id, riderId: c.id });
  g.dispatch({ type: 'bonus', jobId: d.id });
  assert.deepEqual(c.wellbeing, original);
  const before = snapshot(g);
  for (let i = 0; i < 3; i++) { g.riderWellbeing(c); g.broadcastForecast(d, 'open'); g.offerConsequences(c, d); g.riderTour(c); g.demandCapacity(); }
  assert.equal(snapshot(g), before);
});

test('actual acceptance cancels the warning and recovers morale; active windows and handoffs stay protected', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  Object.assign(c.wellbeing, { satisfaction: 24, idleSeconds: 80, warningRemaining: 3, band: 'at-risk' });
  g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
  assert.equal(g.claim(c, d), true);
  assert.equal(c.wellbeing.satisfaction, 42); assert.equal(c.wellbeing.warningRemaining, null); assert.equal(c.wellbeing.idleSeconds, 0);
  assert.ok(g.dispatchLog.some(e => e.action === 'rider-recovered' && e.reason === 'accepted'));
  for (const phase of ['loading', 'waiting-window', 'handover']) {
    c.phase = phase; c.handoffUntil = g.elapsed + 100;
    const before = structuredClone(c.wellbeing); advance(g, .5);
    assert.deepEqual(c.wellbeing, before);
  }
});

test('a tour ends after its last accepted parcel; intermediate completion and missed parcels do not create fake idle time', () => {
  const g = make(), c = g.couriers[0], first = g.deliveries[0];
  g.deliveries[1].status = 'completed';
  assert.equal(g.spawnDelivery({ pickupId: first.pickupId, dropoffId: first.dropoffId, typeKey: 'document' }), true);
  const second = g.deliveries.at(-1);
  for (const d of [first, second]) { g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' }); assert.equal(g.claim(c, d), true); }
  c.wellbeing.satisfaction = 50;
  g.elapsed = 10; g.completeDelivery(c, first);
  assert.equal(c.wellbeing.satisfaction, 60); assert.equal(c.wellbeing.lastTourEndedAt, null);
  assert.equal(g.riderJobs(c).length, 1); assert.equal(c.wellbeing.idleSeconds, 0);
  g.elapsed = 15; g.failDelivery(second);
  assert.equal(c.wellbeing.satisfaction, 54); assert.equal(c.wellbeing.lastTourEndedAt, 15);
  g.elapsed = 19; assert.equal(g.riderWellbeing(c).lastTourAgo, 4);
});

test('departed riders cannot return via invitations, radio flags, breaks or offer forecasts; demand and other riders continue', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  c.offDuty = true; c.phase = 'off-duty'; c.radioOn = false;
  const before = structuredClone(c);
  assert.equal(g.endBreak(c), false); assert.equal(g.startBreak(c), false); assert.equal(g.releaseCourier(c), false);
  assert.deepEqual(c, before);
  c.radioOn = true; // Even a stale flag cannot revive an off-duty rider.
  assert.equal(g.dispatch({ type: 'prefer', jobId: d.id, riderId: c.id }), false);
  g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
  assert.equal(g.claim(c, d), false); assert.equal(g.predictCall(c), null); assert.equal(g.beginDeliberation(c), false);
  assert.equal(g.broadcastForecast(d).rows.find(row => row.rider === c).eligible, false);
  assert.equal(g.offerConsequences(c, d).feasible, false); assert.equal(g.riderTour(c).feasible, false);
  assert.equal(g.courierAvailability(c, d).availableNow, false);
  assert.ok(!g.deliveryFeasibility(d).candidates.some(row => row.rider === c));
  assert.equal(g.demandCapacity().riders.find(row => row.rider === c).slots, 0);
  for (const job of g.deliveries) job.status = 'completed';
  assert.equal(g.spawnDelivery(), true);
  const next = g.deliveries.at(-1); g.dispatch({ type: 'radio', jobId: next.id, channel: 'open' });
  assert.ok(g.couriers.slice(1).some(rider => g.predictCall(rider)), 'Remaining bikes still have playable voluntary work');
});

test('v8 replay restores the same wellbeing, warnings and departures from ordinary player actions', () => {
  const g = make({ mode: 'standard', seed: 'IDLE-WELLBEING' });
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 9000 && !g.gameOver; tick++) g.update(FIXED_STEP);
  assert.ok(g.couriers.every(c => c.offDuty));
  assert.equal(g.outcome, 'team-left');
  assert.ok(g.elapsed < g.config.arrivals, 'The empty desk ends immediately rather than waiting out the shift');
  assert.ok(g.gameOver && g.paused);
  assert.equal(g.upgradePending, false);
  assert.equal(g.shiftReview().unserved, g.activeDeliveries().length);
  assert.ok(g.shiftReview().unserved > 0, 'Unserved offers stay distinct from actual deadline misses');
  assert.equal(g.failed, g.deliveries.filter(d => d.status === 'failed').length);
  assert.match(g.shiftReview().lesson, /All riders finished/);
  const restored = replayRun(g.exportRun(), { city });
  assert.deepEqual(restored.exportRun(), g.exportRun());
  assert.deepEqual(restored.couriers, g.couriers);
  assert.equal(restored.rng.state, g.rng.state);
});

test('final rider departure cancels a simultaneous upgrade and cannot spawn work or reopen the finished desk', () => {
  const g = make({ mode: 'standard' }); clearWork(g);
  g.elapsed = g.config.arrivals * .5 - FIXED_STEP / 2;
  for (const c of g.couriers) Object.assign(c.wellbeing, {
    satisfaction: 10, idleSeconds: 100, warningRemaining: FIXED_STEP / 2, band: 'at-risk'
  });
  advance(g, FIXED_STEP);
  assert.equal(g.outcome, 'team-left'); assert.equal(g.gameOver, true);
  assert.equal(g.upgradePending, false, 'Departure clears the upgrade raised in the same update');
  assert.equal(g.dispatch({ type: 'upgrade', id: 'legs' }), false);
  assert.equal(g.dispatch({ type: 'pause', paused: false }), false);
  assert.ok(g.couriers.every(c => c.offDuty && g.riderWellbeing(c).leaveIn === null));
  const before = snapshot(g), elapsed = g.elapsed;
  g.update(60);
  assert.equal(g.spawnDelivery(), false);
  assert.equal(g.elapsed, elapsed); assert.equal(snapshot(g), before);
  assert.equal(g.dispatchLog.filter(e => e.action === 'shift-finish').length, 1);
});

test('v7 retains the exact pre-v8 full training shift, rider state, deliveries and random stream', () => {
  // Captured directly from release 2224712 before installing wellbeing.
  const g = make({ seed: 'LEGACY-WELLBEING-PIN', ruleset: 'berlin-dispatch-v7' });
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 11000 && !g.gameOver; tick++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % 300 === 0) for (const d of g.activeDeliveries().filter(d => d.status === 'waiting' && !d.called))
      g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
    g.update(FIXED_STEP);
  }
  const state = { run: g.exportRun(), rng: g.rng.state, couriers: g.couriers, deliveries: g.deliveries };
  assert.equal(createHash('sha256').update(JSON.stringify(state)).digest('hex'), '2e811c943f9b708d9481e567e9e2efda960640e0f842caee3e2024ccf50398e7');
  assert.equal(WELLBEING.initial, 72);
});
