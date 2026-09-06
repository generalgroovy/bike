import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { BerlinPlaytest, CARGO_FAMILIES, FIXED_STEP, replayRun } from '../src/game-berlin-playtest.js';

function play(game, strategy = 'open') {
  game.dispatch({ type: 'pause', paused: false });
  for (let i = 0; i < 34000 && !game.gameOver; i++) {
    if (game.upgradePending) game.dispatch({ type: 'upgrade', id: 'legs' });
    if (i % 60 === 0) {
      const waiting = game.activeDeliveries().filter(d => d.status === 'waiting' && !d.called);
      if (strategy === 'selective') waiting.sort((a, b) => a.deadlineAt - b.deadlineAt);
      for (const d of waiting) {
        let channel = 'open';
        if (strategy === 'local') channel = 'local';
        if (strategy === 'selective') channel = d.deadlineAt - game.elapsed < 30 ? 'priority' : game.nearestIdleDistance(d) < 200 ? 'local' : 'open';
        game.dispatch({ type: 'radio', jobId: d.id, channel });
      }
    }
    game.update(FIXED_STEP);
  }
  return game;
}

test('playtest starts with a small explicit ruleset and stable people without altering the full game', () => {
  const a = new BerlinPlaytest({ seed: 'A' }), b = new BerlinPlaytest({ seed: 'B', mode: 'standard' });
  assert.equal(a.paused, true);
  assert.equal(a.deliveries.length, 1);
  assert.equal(b.deliveries.length, 3);
  assert.deepEqual(a.couriers.map(c => c.personality.id), b.couriers.map(c => c.personality.id));
  assert.equal(a.couriers.length, 3);
  assert.equal(a.dispatchFocus, 0);
  const full = new Game({ seed: 'A' });
  assert.equal(full.dispatchFocus, 2);
  assert.equal(full.deliveries.length, 5);
  assert.equal(typeof a.assign, 'undefined');
  assert.throws(() => new BerlinPlaytest({ mode: 'bad' }));
});

test('a broadcast changes information and bandwidth without assigning or reserving a courier', () => {
  const g = new BerlinPlaytest();
  const before = structuredClone(g.couriers);
  assert.equal(g.dispatch({ type: 'assign', jobId: 'd0', riderId: 'c0' }), false);
  assert.equal(g.dispatch({ type: 'radio', jobId: 'd0', channel: 'unknown' }), false);
  assert.equal(g.dispatch({ type: 'radio', jobId: 'd0', channel: 'priority' }), true);
  assert.equal(g.radioUsed(), 2);
  assert.deepEqual(g.couriers.map(c => [c.deliveryId, c.phase]), before.map(c => [c.deliveryId, c.phase]));
  g.dispatch({ type: 'pause', paused: false });
  for (let i = 0; i < 300; i++) g.update(FIXED_STEP);
  assert.equal(g.deliveries[0].status, 'claimed');
  assert.equal(g.radioUsed(), 0);
});

test('every generated address is reachable from the depot and trips respect the small ruleset bounds', () => {
  for (const mode of ['training', 'standard']) {
    const g = new BerlinPlaytest({ mode, seed: 'REACHABILITY' });
    for (const node of g.playableAddressNodes()) assert.ok(g.routeBetween(g.depotNodeId, node.id).length);
    for (let i = 0; i < 200; i++) {
      const trip = g.randomTrip();
      assert.ok(trip);
      assert.ok(trip.distance >= g.runContract.minTrip && trip.distance <= g.runContract.maxTrip);
    }
    const isolated = g.addressNodes.find(n => n.unlockLevel === 1 && !g.routeBetween(g.depotNodeId, n.id).length);
    assert.ok(isolated, 'Fixture contains the legacy disconnected island');
    assert.equal(g.spawnDelivery({ pickupId: isolated.id, dropoffId: g.deliveries[0].dropoffId }), false);
  }
});

test('a bonus costs cash and cannot create a larger client payment or repeat', () => {
  const g = new BerlinPlaytest(), d = g.deliveries[0], fee = d.reward;
  assert.equal(g.dispatch({ type: 'bonus', jobId: d.id }), true);
  assert.equal(g.cash, 5);
  assert.equal(d.reward, fee);
  assert.equal(g.dispatch({ type: 'bonus', jobId: d.id }), false);
  g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
  g.dispatch({ type: 'pause', paused: false });
  for (let i = 0; i < 1800; i++) g.update(FIXED_STEP);
  assert.equal(d.status, 'completed');
  assert.equal(g.cash, 5 + fee);
});

test('training and standard shifts can be won and end with no unresolved jobs', () => {
  for (const mode of ['training', 'standard']) for (const seed of ['BERLIN-1', 'BERLIN-2', 'BERLIN-3']) {
    const g = play(new BerlinPlaytest({ mode, seed }));
    assert.equal(g.outcome, 'success', `${mode}/${seed}: ${JSON.stringify(g.shiftReview())}`);
    assert.ok(g.elapsed <= g.config.arrivals + g.config.closing + 1e-6);
    assert.equal(g.activeDeliveries().length, 0);
    assert.equal(g.closing, true);
    assert.ok(g.completed >= g.config.target);
    assert.ok(g.deliveries.every(d => Object.hasOwn(CARGO_FAMILIES, d.type) && !d.specialId && !d.clientHubId));
    assert.equal(g.cityLevel, 1);
    assert.equal(g.couriers.length, 3);
    assert.equal(g.servicePressure, undefined);
    assert.equal(g.serviceFlow, undefined);
    assert.equal(g.dispatchLog.filter(e => e.action === 'upgrade').length, 1);
  }
});

test('closing stops arrivals and unresolved work is explicitly failed', () => {
  const g = new BerlinPlaytest();
  g.elapsed = g.config.arrivals - FIXED_STEP / 2;
  g.deliveries[0].deadlineAt = 1000;
  g.upgradeTaken = 'radio';
  g.dispatch({ type: 'pause', paused: false });
  g.update(FIXED_STEP);
  const count = g.deliveries.length;
  assert.equal(g.closing, true);
  assert.equal(g.spawnDelivery(), false);
  while (!g.gameOver) g.update(FIXED_STEP);
  assert.equal(g.deliveries.length, count);
  assert.equal(g.deliveries[0].status, 'failed');
  assert.equal(g.failed, 1);
  assert.equal(g.outcome, 'target-missed');
  assert.equal(g.activeDeliveries().length, 0);
});

test('deferring work can lose the desk and paused or ended runs cannot advance', () => {
  const g = new BerlinPlaytest({ mode: 'standard' });
  const before = JSON.stringify(g.exportRun());
  for (let i = 0; i < 120; i++) g.update(FIXED_STEP);
  assert.equal(JSON.stringify(g.exportRun()), before);
  g.dispatch({ type: 'pause', paused: false });
  for (let i = 0; i < 34000 && !g.gameOver; i++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'radio' });
    g.update(FIXED_STEP);
  }
  assert.equal(g.outcome, 'collapse');
  assert.equal(g.reputation, 0);
  const ended = JSON.stringify(g.exportRun());
  assert.equal(g.dispatch({ type: 'bonus', jobId: 'd0' }), false);
  g.update(100);
  assert.equal(JSON.stringify(g.exportRun()), ended);
});

test('one route disruption is forecast, changes routing and clears without demand or Focus effects', () => {
  const g = new BerlinPlaytest();
  g.elapsed = 66;
  g.updateRoadEvent();
  assert.equal(g.currentEvent.state, 'forecast');
  const ids = [...g.currentEvent.edgeIds], revision = g.routingRevision;
  g.elapsed = 91; g.updateRoadEvent();
  assert.equal(g.currentEvent.state, 'active');
  assert.ok(g.routingRevision > revision);
  assert.ok(ids.every(id => g.edgeById(id).eventMultiplier === .3));
  const count = g.deliveries.length;
  assert.equal(g.respondToCityEvent(), false);
  assert.equal(g.briefDistrict('mitte'), false);
  assert.equal(g.extendJob('d0'), false);
  assert.equal(g.rebroadcastJob('d0'), false);
  g.elapsed = 121; g.updateRoadEvent();
  assert.equal(g.currentEvent, null);
  assert.ok(ids.every(id => g.edgeById(id).eventMultiplier === 1));
  g.elapsed = 500; g.updateRoadEvent();
  assert.equal(g.currentEvent, null);
  assert.equal(g.deliveries.length, count);
});

test('a recorded run replays exactly, including pause, speed, bonus and upgrade actions', () => {
  const original = new BerlinPlaytest({ seed: 'REPLAY' });
  original.dispatch({ type: 'bonus', jobId: 'd0' });
  original.dispatch({ type: 'speed', speed: 2 });
  original.dispatch({ type: 'pause', paused: true });
  play(original, 'selective');
  const record = JSON.parse(JSON.stringify(original.exportRun()));
  const replay = replayRun(record);
  assert.deepEqual(replay.exportRun(), record);
  assert.deepEqual(replay.deliveries, original.deliveries);
  assert.equal(replay.rng.state, original.rng.state);
  assert.throws(() => replayRun({ ...record, ruleset: 'future-version' }));
  assert.throws(() => replayRun({ ...record, actions: [{ tick: -1, type: 'pause', paused: false }] }));
});
