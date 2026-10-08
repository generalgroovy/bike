import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeInnerRing } from '../src/inner-ring-city.js';
import { BerlinPlaytest, FIXED_STEP, replayRun } from '../src/game-berlin-playtest.js';
import { RNG } from '../src/rng.js';

const city = decodeInnerRing(JSON.parse(readFileSync(new URL('../generated/berlin-city.json', import.meta.url))));
const make = options => new BerlinPlaytest({ city, seed: 'LOGISTICS-TEST', ...options });
function advance(g, seconds) {
  g.paused = false;
  for (let i = 0; i < seconds / FIXED_STEP && !g.gameOver; i++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    g.update(FIXED_STEP);
  }
}
function add(g, options = {}) {
  const opening = g.deliveries[0];
  assert.equal(g.spawnDelivery({ pickupId: opening.pickupId, dropoffId: opening.dropoffId, typeKey: 'document', ...options }), true);
  return g.deliveries.at(-1);
}

test('v6 has distinct slower bikes, truthful endurance and capacity without changing v5', () => {
  const g = make(), old = make({ ruleset: 'berlin-dispatch-v5' });
  assert.deepEqual(g.couriers.map(c => c.bikeType), ['road', 'city', 'cargo']);
  assert.deepEqual(g.couriers.map(c => c.capacityKg), [5, 12, 30]);
  assert.ok(g.couriers.every((c, i) => c.baseSpeed < old.couriers[i].baseSpeed * .7));
  assert.deepEqual(old.couriers.map(c => c.bikeType), [undefined, undefined, undefined]);
  const c = g.couriers[0]; c.fatigue = .37;
  assert.deepEqual(g.riderEndurance(c), { current: 63, max: 100 });
  assert.equal(g.riderProfile(c).endurance, 63);
  assert.equal(g.deliveries[0].weightKg, .5);
  assert.equal(old.deliveries[0].weightKg, undefined);
});

test('broadcast previews are pure and preference changes appeal rather than assigning a rider', () => {
  const g = make(), d = g.deliveries[0], c = g.couriers[0];
  const before = JSON.stringify({ couriers: g.couriers, jobs: g.deliveries, rng: g.rng, stats: g.runStats, actions: g.actions, log: g.dispatchLog, routeCache: [...g.routeCache] });
  const first = g.broadcastForecast(d, 'open');
  for (let i = 0; i < 4; i++) g.broadcastForecast(d, ['open', 'local', 'priority'][i % 3]);
  assert.equal(JSON.stringify({ couriers: g.couriers, jobs: g.deliveries, rng: g.rng, stats: g.runStats, actions: g.actions, log: g.dispatchLog, routeCache: [...g.routeCache] }), before);
  assert.ok(first.rows.every(row => typeof row.reason === 'string'));
  assert.equal(g.dispatch({ type: 'prefer', jobId: d.id, riderId: c.id }), true);
  const next = g.broadcastForecast(d, 'open');
  assert.ok(next.rows.find(row => row.rider === c).score > first.rows.find(row => row.rider === c).score);
  assert.equal(d.status, 'waiting'); assert.equal(c.deliveryId, null); assert.deepEqual(c.stops, []);
  assert.equal(g.dispatch({ type: 'prefer', jobId: d.id, riderId: 'unknown' }), false);
  assert.equal(g.dispatch({ type: 'prefer', jobId: d.id, riderId: null }), true);
  g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
  const rngState = g.rng.state;
  g.beginDeliberation(c);
  const neutralTime = c.deliberation.readyAt;
  g.dispatch({ type: 'prefer', jobId: d.id, riderId: c.id });
  g.rng.state = rngState;
  g.beginDeliberation(c);
  assert.ok(c.deliberation.readyAt < neutralTime, 'An invitation speeds a willing rider response to even a single call');
});

test('heavy cargo is refused by an unsuitable bike even when preferred with priority and bonus', () => {
  const g = make(), d = add(g, { typeKey: 'grocery', weightKg: 16 });
  g.dispatch({ type: 'prefer', jobId: d.id, riderId: g.couriers[0].id });
  g.dispatch({ type: 'bonus', jobId: d.id });
  const forecast = g.broadcastForecast(d, 'priority');
  assert.equal(forecast.rows.find(row => row.rider.bikeType === 'road').eligible, false);
  assert.equal(forecast.rows.find(row => row.rider.bikeType === 'city').eligible, false);
  assert.equal(forecast.rows.find(row => row.rider.bikeType === 'cargo').eligible, true);
  g.dispatch({ type: 'radio', jobId: d.id, channel: 'priority' });
  assert.equal(g.claim(g.couriers[0], d), false);
  assert.equal(g.claim(g.couriers[2], d), true);
});

test('personal invitations increase actual acceptance chances across paired seeded single-call races', () => {
  const g = make(), job = g.deliveries[0], originalJob = structuredClone(job), originalRiders = structuredClone(g.couriers);
  function winner(seed, invite) {
    g.elapsed = 0; g.tick = 0; g.actions = []; g.dispatchLog = []; g.paused = true;
    Object.assign(job, structuredClone(originalJob));
    g.couriers.forEach((c, i) => Object.assign(c, structuredClone(originalRiders[i])));
    g.rng.state = new RNG(seed).state;
    if (invite) g.dispatch({ type: 'prefer', jobId: job.id, riderId: g.couriers[1].id });
    g.dispatch({ type: 'radio', jobId: job.id, channel: 'open' });
    g.dispatch({ type: 'pause', paused: false });
    for (let i = 0; i < 300 && job.status === 'waiting'; i++) g.update(FIXED_STEP);
    return job.courierId;
  }
  let neutral = 0, invited = 0;
  for (let i = 0; i < 48; i++) {
    if (winner(`INVITE-${i}`, false) === g.couriers[1].id) neutral++;
    if (winner(`INVITE-${i}`, true) === g.couriers[1].id) invited++;
  }
  assert.ok(invited > neutral, `${invited} invited wins versus ${neutral} neutral wins`);
  assert.ok(invited < 48, 'The invitation never becomes an assignment guarantee');
});

test('a rider can collect an early parcel and complete a second fitting job before its delivery window', () => {
  const g = make(), c = g.couriers[0], early = g.deliveries[0];
  early.deliverAfter = 70; early.deadlineAt = 125;
  for (const other of g.couriers.slice(1)) other.radioOn = false;
  g.dispatch({ type: 'radio', jobId: early.id, channel: 'open' });
  assert.equal(g.claim(c, early), true);
  advance(g, 2);
  assert.equal(early.pickedUp, true);
  assert.equal(g.riderLoad(c), .5);
  const extra = add(g, { weightKg: 1 });
  g.dispatch({ type: 'radio', jobId: extra.id, channel: 'open' });
  const xy = [c.x, c.y], prediction = g.broadcastForecast(extra);
  assert.equal(prediction.rows.find(row => row.rider === c).eligible, true);
  assert.equal(g.claim(c, extra), true);
  assert.deepEqual([c.x, c.y], xy, 'Accepting another job never teleports the rider');
  assert.equal(g.riderJobs(c).length, 2);
  advance(g, 55);
  assert.equal(extra.status, 'completed');
  assert.equal(early.status, 'claimed');
  assert.ok(early.pickedUp);
  assert.equal(c.phase, 'waiting-window');
  advance(g, 25);
  assert.equal(early.status, 'completed');
  assert.ok(early.completedAt >= early.deliverAfter + g.handoffTime(early).dropoff);
  assert.equal(g.riderLoad(c), 0);
});

test('busy riders autonomously accept fitting broadcasts and decline a third commitment', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  d.deliverAfter = 70; d.deadlineAt = 125;
  for (const other of g.couriers.slice(1)) other.radioOn = false;
  g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' }); g.claim(c, d);
  const second = add(g); g.dispatch({ type: 'radio', jobId: second.id, channel: 'open' });
  advance(g, 3);
  assert.equal(second.status, 'claimed');
  assert.equal(second.courierId, c.id);
  const third = add(g); g.dispatch({ type: 'radio', jobId: third.id, channel: 'open' });
  assert.equal(g.claim(c, third), false);
  assert.match(g.broadcastForecast(third).rows.find(row => row.rider === c).reason, /Two jobs/);
});

test('failure of one shared job keeps the other commitment and physical street position', () => {
  const g = make(), c = g.couriers[2], first = g.deliveries[0];
  first.deliverAfter = 70; first.deadlineAt = 125;
  g.dispatch({ type: 'radio', jobId: first.id, channel: 'open' }); g.claim(c, first);
  const second = add(g); g.dispatch({ type: 'radio', jobId: second.id, channel: 'open' }); g.claim(c, second);
  advance(g, 3);
  const xy = [c.x, c.y]; g.failDelivery(first);
  assert.deepEqual([c.x, c.y], xy);
  assert.equal(g.riderJobs(c).length, 1);
  assert.equal(g.riderJobs(c)[0].id, second.id);
  advance(g, 50);
  assert.equal(second.status, 'completed');
  assert.equal(first.status, 'failed');
});

test('weight increases riding fatigue and reduces loaded speed', () => {
  function loaded(weightKg) {
    const g = make(), c = g.couriers[2], d = g.deliveries[0]; d.weightKg = weightKg;
    g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' }); g.claim(c, d); advance(g, 2);
    return { g, c, startFatigue: c.fatigue, startDistance: g.runStats.distance };
  }
  const light = loaded(1), heavy = loaded(20);
  advance(light.g, 3); advance(heavy.g, 3);
  assert.ok(heavy.c.fatigue - heavy.startFatigue > light.c.fatigue - light.startFatigue);
  assert.ok(heavy.g.runStats.distance - heavy.startDistance < light.g.runStats.distance - light.startDistance);
});

test('preference actions and autonomous multi-job journeys replay exactly', () => {
  const g = make();
  g.dispatch({ type: 'prefer', jobId: g.deliveries[0].id, riderId: g.couriers[0].id });
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 11000 && !g.gameOver; tick++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % 60 === 0) for (const d of g.activeDeliveries().filter(d => d.status === 'waiting' && !d.called)) g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
    if (tick % 30 === 0) for (const d of g.activeDeliveries()) if (d.status === 'waiting') g.broadcastForecast(d, 'priority');
    g.update(FIXED_STEP);
  }
  assert.equal(g.outcome, 'success');
  assert.deepEqual(replayRun(g.exportRun(), { city }).exportRun(), g.exportRun());
});
