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

test('offer consequences account for handoffs, delivery-window waiting, parcel load and street addresses', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  d.deliverAfter = 70; d.deadlineAt = 125;
  const result = g.offerConsequences(c, d), [pickup, dropoff] = result.itinerary;
  assert.equal(result.feasible, true);
  assert.deepEqual(result.load, { currentKg: 0, peakKg: .5, capacityKg: 5 });
  assert.deepEqual(result.itinerary.map(stop => [stop.jobId, stop.kind, stop.nodeId]), [[d.id, 'pickup', d.pickupId], [d.id, 'dropoff', d.dropoffId]]);
  assert.equal(pickup.address, d.pickupAddress);
  assert.equal(pickup.addressId, g.nodeById(d.pickupId).sourceId);
  assert.equal(pickup.doneIn - pickup.arrivalIn, g.handoffTime(d).pickup);
  assert.equal(result.pickupIn, pickup.doneIn);
  assert.equal(dropoff.waitSeconds, d.deliverAfter - g.elapsed - dropoff.arrivalIn);
  assert.ok(dropoff.waitSeconds > 40, 'The early parcel creates real idle time at the delivery door');
  assert.equal(dropoff.doneIn, d.deliverAfter - g.elapsed + g.handoffTime(d).dropoff);
  assert.equal(result.finishIn, dropoff.doneIn);
  assert.equal(result.margin, d.deadlineAt - g.elapsed - dropoff.doneIn);
  assert.equal(result.endurance.current, g.riderEndurance(c).current);
  assert.ok(result.endurance.projected < result.endurance.current);
  assert.deepEqual(result.itinerary.map(stop => [stop.loadBeforeKg, stop.loadAfterKg]), [[0, .5], [.5, 0]]);
  assert.equal(result.baselineTourSeconds, 0);
  assert.equal(result.addedTourSeconds, result.tourSeconds);
});

test('extra-job projections distinguish using delivery-window slack from delaying another commitment', () => {
  const g = make(), c = g.couriers[0], early = g.deliveries[0];
  early.deliverAfter = 70; early.deadlineAt = 125;
  for (const other of g.couriers.slice(1)) other.radioOn = false;
  g.dispatch({ type: 'radio', jobId: early.id, channel: 'open' }); g.claim(c, early);
  advance(g, 2);
  const extra = add(g, { weightKg: 1 }), fitsWindow = g.offerConsequences(c, extra);
  assert.equal(fitsWindow.mode, 'on the way');
  assert.deepEqual(fitsWindow.load, { currentKg: .5, peakKg: 1.5, capacityKg: 5 });
  assert.equal(fitsWindow.addedTourSeconds, 0, 'The same-route job uses an existing delivery-window wait');
  assert.equal(fitsWindow.commitments[0].jobId, early.id);
  assert.equal(fitsWindow.commitments[0].delaySeconds, 0);
  assert.equal(fitsWindow.itinerary.at(-1).jobId, early.id);
  assert.ok(fitsWindow.itinerary.at(-1).waitSeconds > 0);
  assert.ok(fitsWindow.finishIn < fitsWindow.tourSeconds);

  early.deliverAfter = g.elapsed;
  const addsDelay = g.offerConsequences(c, extra);
  assert.equal(addsDelay.feasible, true);
  assert.ok(addsDelay.addedTourSeconds > 3);
  assert.ok(addsDelay.commitments[0].delaySeconds > 3);
  assert.equal(addsDelay.commitments[0].delaySeconds, addsDelay.commitments[0].finishIn - addsDelay.commitments[0].baselineFinishIn);
  assert.ok(addsDelay.itinerary.every(stop => stop.waitSeconds === 0));
});

test('projection load and endurance respond to actual weight and refuse incompatible cargo', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  const light = g.offerConsequences(c, d);
  d.weightKg = 4;
  const heavy = g.offerConsequences(c, d);
  assert.equal(heavy.load.peakKg, 4);
  assert.ok(heavy.finishIn > light.finishIn);
  assert.ok(heavy.endurance.projected < light.endurance.projected);
  d.weightKg = 6;
  const refused = g.offerConsequences(c, d);
  assert.equal(refused.feasible, false);
  assert.match(refused.reason, /6 kg exceeds 5 kg/);
  assert.equal(refused.finishIn, null);
  assert.equal(refused.endurance.projected, null);
  assert.deepEqual(refused.itinerary, []);
  assert.deepEqual(refused.appealReasons, []);
  assert.equal(g.offerConsequences(null, d).feasible, false);
  assert.equal(make({ ruleset: 'berlin-dispatch-v5' }).offerConsequences(c, d).feasible, false);
});

test('consequence previews and appeal explanations are pure and only cite active scoring advantages', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  const snapshot = () => JSON.stringify({ run: g.exportRun(), couriers: g.couriers, jobs: g.deliveries, rng: g.rng,
    stats: g.runStats, log: g.dispatchLog, routeCache: [...g.routeCache], modifiers: g.modifiers, cash: g.cash, elapsed: g.elapsed, tick: g.tick });
  const before = snapshot();
  for (const rider of g.couriers) for (const channel of ['open', 'local', 'priority']) {
    const probe = { ...d, channel }, result = g.offerConsequences(rider, probe);
    const row = g.broadcastForecast(d, channel).rows.find(item => item.rider === rider);
    assert.deepEqual(row.appealReasons, result.appealReasons);
    result.itinerary.length = 0; result.endurance.current = 0; result.appealReasons.push('not a real preference');
  }
  assert.equal(snapshot(), before, 'Inspecting all channels and editing returned data cannot change the run');
  const neutral = g.offerConsequences(c, d);
  assert.ok(neutral.appealReasons.includes('Preferred cargo'));
  assert.ok(!neutral.appealReasons.includes('Personal invitation'));
  const invited = g.offerConsequences(c, { ...d, preferredRiderId: c.id, channel: 'priority', sweetened: true, bonusAppeal: 0 });
  assert.ok(invited.appealReasons.includes('Personal invitation'));
  assert.ok(invited.appealReasons.includes('Priority signal'));
  assert.ok(!invited.appealReasons.includes('Courier bonus'), 'A cosmetic sweetened flag is not a scoring advantage');
  assert.ok(g.offerConsequences(c, { ...d, sweetened: true, bonusAppeal: .4 }).appealReasons.includes('Courier bonus'));
});

test('remaining rider tours stay inspectable through pickup handoff, delivery-window waiting and completion', () => {
  const g = make(), c = g.couriers[0], d = g.deliveries[0];
  d.deliverAfter = 70; d.deadlineAt = 125;
  g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' }); g.claim(c, d);
  advance(g, .5);
  const snapshot = () => JSON.stringify({ run: g.exportRun(), couriers: g.couriers, jobs: g.deliveries, rng: g.rng, stats: g.runStats, routeCache: [...g.routeCache] });
  const before = snapshot(), loading = g.riderTour(c);
  assert.equal(c.phase, 'loading');
  assert.equal(loading.feasible, true);
  assert.equal(loading.itinerary[0].doneIn, c.handoffUntil - g.elapsed);
  assert.equal(loading.load.currentKg, 0);
  assert.equal(loading.load.peakKg, .5);
  assert.equal(snapshot(), before);
  loading.itinerary[0].jobId = 'not-the-actual-job';
  assert.equal(c.stops[0].jobId, d.id, 'Returned annotations never expose mutable live stops');

  advance(g, 20);
  assert.equal(c.phase, 'waiting-window');
  const waiting = g.riderTour(c);
  assert.equal(waiting.itinerary.length, 1);
  assert.equal(waiting.itinerary[0].kind, 'dropoff');
  assert.equal(waiting.itinerary[0].waitSeconds, d.deliverAfter - g.elapsed);
  assert.equal(waiting.tourSeconds, d.deliverAfter - g.elapsed + g.handoffTime(d).dropoff);
  assert.equal(waiting.load.currentKg, .5);
  assert.equal(waiting.endurance.current, waiting.endurance.projected, 'Standing at the door does not consume riding endurance');

  advance(g, 60);
  assert.equal(d.status, 'completed');
  const empty = g.riderTour(c);
  assert.equal(empty.feasible, true);
  assert.equal(empty.tourSeconds, 0);
  assert.deepEqual(empty.itinerary, []);
  assert.deepEqual(empty.load, { currentKg: 0, peakKg: 0, capacityKg: 5 });
  assert.equal(empty.endurance.projected, empty.endurance.current);
  assert.equal(g.riderTour(null).feasible, false);
});

test('preference actions and autonomous multi-job journeys replay exactly', () => {
  const g = make();
  g.dispatch({ type: 'prefer', jobId: g.deliveries[0].id, riderId: g.couriers[0].id });
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 11000 && !g.gameOver; tick++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % 60 === 0) for (const d of g.activeDeliveries().filter(d => d.status === 'waiting' && !d.called)) g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
    if (tick % 30 === 0) for (const d of g.activeDeliveries()) if (d.status === 'waiting') {
      g.broadcastForecast(d, 'priority');
      for (const c of g.couriers) g.offerConsequences(c, d);
    }
    if (tick % 30 === 0) for (const c of g.couriers) g.riderTour(c);
    g.update(FIXED_STEP);
  }
  assert.equal(g.outcome, 'success');
  assert.deepEqual(replayRun(g.exportRun(), { city }).exportRun(), g.exportRun());
});
