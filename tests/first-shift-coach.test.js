import test from 'node:test';
import assert from 'node:assert/strict';
import { firstShiftCoach } from '../src/first-shift-coach.js';
import { previewKey } from '../src/broadcast-preview.js';
import { BerlinPlaytest, FIXED_STEP } from '../src/game-berlin-playtest.js';

function fixture() {
  const rider = { id: 'c0', name: 'Kira', phase: 'idle', offDuty: false, wellbeing: { warningRemaining: null } };
  const job = { id: 'd0', status: 'waiting', called: false, deadlineAt: 100, reward: 12 };
  const game = { mode: 'training', completed: 0, tick: 0, elapsed: 0, paused: true, selectedDeliveryId: job.id, couriers: [rider], deliveries: [job] };
  const candidate = { rider, margin: 45, availableNow: true };
  const feasibility = new Map([[job.id, { best: candidate, candidates: [candidate] }]]);
  const forecast = { rider, rows: [{ rider, eligible: true }] };
  const options = { feasibility, forecast };
  return { game, rider, job, candidate, options };
}

test('the first invitation previews, reviews the same option, then starts the clock without choosing a rider', () => {
  const { game, job, options } = fixture();
  assert.equal(firstShiftCoach(game, options).action, 'preview');
  assert.match(firstShiftCoach(game, options).detail, /Nothing is sent yet/);
  const draft = { jobId: job.id, channel: 'local', key: previewKey(job, 'local', options.forecast) };
  const review = firstShiftCoach(game, { ...options, draft });
  assert.equal(review.step, 'confirm'); assert.equal(review.action, 'confirm');
  assert.match(review.detail, /same radio option again/); assert.match(review.detail, /still decides/);
  assert.equal(firstShiftCoach(game, { ...options, draft: { ...draft, jobId: 'other' } }).step, 'preview');
  job.called = true;
  assert.equal(firstShiftCoach(game, options).action, 'start');
  game.paused = false;
  assert.equal(firstShiftCoach(game, options).step, 'choosing');
  assert.equal(firstShiftCoach(game, options).action, null);
  assert.match(firstShiftCoach(game, options).detail, /decide for themselves/);
});

test('a changed forecast requests renewed review and no-volunteer previews cannot imply acceptance', () => {
  const { game, job, options } = fixture();
  const draft = { jobId: job.id, channel: 'open', key: previewKey(job, 'open', options.forecast) };
  job.reward += 5;
  const changed = firstShiftCoach(game, { ...options, draft });
  assert.equal(changed.step, 'review'); assert.match(changed.detail, /refresh the preview/);
  const forecast = { rider: null, rows: [] };
  draft.key = previewKey(job, 'open', forecast);
  const noFit = firstShiftCoach(game, { ...options, draft, forecast });
  assert.equal(noFit.step, 'no-fit'); assert.equal(noFit.action, null);
  assert.match(noFit.detail, /cannot fix cargo limits/);
});

test('a missing or unsuitable selection points to an available offer without trusting stale or departed candidates', () => {
  const { game, rider, job, options } = fixture();
  game.selectedDeliveryId = null;
  assert.equal(firstShiftCoach(game, options).action, 'select');
  assert.equal(firstShiftCoach(game, options).jobId, job.id);
  game.selectedDeliveryId = 'missed';
  game.deliveries.unshift({ id: 'missed', status: 'failed' });
  assert.match(firstShiftCoach(game, options).title, /fresh chance/);
  const other = { ...job, id: 'd1' };
  game.deliveries.push(other); options.feasibility.set(other.id, { best: null, candidates: [] });
  assert.equal(firstShiftCoach(game, { ...options, selectedJob: other }).jobId, job.id);
  const departed = { ...rider, id: 'departed', offDuty: true };
  options.feasibility.set(job.id, { best: { rider: departed, margin: 40 }, candidates: [{ rider: departed, margin: 40 }] });
  assert.equal(firstShiftCoach(game, options).step, 'no-fit');
  assert.equal(firstShiftCoach(game, options).action, null);
});

test('real phases distinguish travelling, handling and scheduled delivery without extra controls', () => {
  const { game, rider, job, options } = fixture();
  job.status = 'claimed'; job.courierId = rider.id; rider.deliveryId = job.id; game.paused = false;
  const cases = [
    ['pickup', /riding to pickup/], ['loading', /collecting/], ['dropoff', /on the bike/],
    ['waiting-window', /opens in 20s/], ['handover', /counts when the handoff finishes/]
  ];
  job.deliverAfter = 20;
  for (const [phase, message] of cases) {
    rider.phase = phase;
    const coach = firstShiftCoach(game, options);
    assert.equal(coach.step, 'riding'); assert.equal(coach.action, null); assert.match(coach.detail, message);
  }
  rider.deliveryId = 'other';
  assert.match(firstShiftCoach(game, options).detail, /after another stop/);
  job.pickedUp = true;
  assert.match(firstShiftCoach(game, options).detail, /has D0 on board/);
  game.paused = true; game.tick = 500;
  assert.equal(firstShiftCoach(game, options).action, 'start');
  assert.match(firstShiftCoach(game, options).detail, /Resume the clock/);
  job.courierId = 'missing';
  assert.equal(firstShiftCoach(game, options), null);
});

test('important alerts, completed tutorials and non-training runs keep their screen space', () => {
  const { game, rider, job, candidate, options } = fixture();
  assert.equal(firstShiftCoach(null), null);
  for (const field of ['gameOver', 'upgradePending']) assert.equal(firstShiftCoach({ ...game, [field]: true }, options), null);
  assert.equal(firstShiftCoach({ ...game, mode: 'standard' }, options), null);
  assert.equal(firstShiftCoach({ ...game, completed: 1 }, options), null);
  assert.equal(firstShiftCoach({ ...game, couriers: [] }, options), null);
  rider.offDuty = true; assert.equal(firstShiftCoach(game, options), null); rider.offDuty = false;
  rider.wellbeing.warningRemaining = 20; assert.equal(firstShiftCoach(game, options), null); rider.wellbeing.warningRemaining = null;
  candidate.margin = 10; assert.equal(firstShiftCoach(game, options), null); candidate.margin = 45;
  job.deadlineAt = 10; assert.equal(firstShiftCoach(game, options), null);
});

test('empty and failed openings recover through new work and never promise arrivals after closing', () => {
  const { game, options } = fixture();
  game.deliveries[0].status = 'failed';
  assert.equal(firstShiftCoach(game, options).step, 'arrivals');
  assert.equal(firstShiftCoach(game, options).action, 'start');
  game.paused = false;
  assert.equal(firstShiftCoach(game, options).action, null);
  game.closing = true;
  assert.equal(firstShiftCoach(game, options), null);
});

test('coaching is read-only on frozen inputs and never invokes simulation or lookup helpers', () => {
  const { game, rider, job, candidate, options } = fixture();
  const forbidden = () => { throw new Error('A coach must not call simulation or cached lookup methods'); };
  Object.assign(game, { dispatch: forbidden, update: forbidden, courierById: forbidden, deliveryById: forbidden, deliveryFeasibility: forbidden, broadcastForecast: forbidden, rng: { next: forbidden } });
  [rider.wellbeing, rider, job, candidate, game.couriers, game.deliveries, game].forEach(Object.freeze);
  const before = JSON.stringify({ game, entries: [...options.feasibility] });
  for (let i = 0; i < 50; i++) assert.equal(firstShiftCoach(game, options).step, 'preview');
  assert.equal(JSON.stringify({ game, entries: [...options.feasibility] }), before);
});

test('a real first delivery remains autonomous and has identical replay state with coaching on every tick', () => {
  const guided = new BerlinPlaytest({ seed: 'COACH' }), control = new BerlinPlaytest({ seed: 'COACH' });
  const snapshot = game => JSON.stringify({ run: game.exportRun(), riders: game.couriers, jobs: game.deliveries, rng: game.rng, stats: game.runStats });
  assert.equal(firstShiftCoach(guided).action, 'preview');
  for (const game of [guided, control]) game.dispatch({ type: 'radio', jobId: game.deliveries[0].id, channel: 'open' });
  assert.equal(firstShiftCoach(guided).action, 'start');
  assert.equal(guided.deliveries[0].status, 'waiting');
  for (const game of [guided, control]) game.dispatch({ type: 'pause', paused: false });
  for (let i = 0; i < 4000 && !guided.completed; i++) {
    const before = snapshot(guided); firstShiftCoach(guided);
    assert.equal(snapshot(guided), before);
    guided.update(FIXED_STEP); control.update(FIXED_STEP);
  }
  assert.equal(guided.completed, 1); assert.equal(firstShiftCoach(guided), null);
  assert.equal(snapshot(guided), snapshot(control));
});

test('a second inspected offer keeps its own preview while the first rider works', () => {
  const { game, rider, job, options } = fixture();
  job.status = 'claimed'; job.courierId = rider.id; rider.deliveryId = job.id; rider.phase = 'pickup';
  const next = { id: 'd1', status: 'waiting', called: false, deadlineAt: 120, reward: 14 };
  game.deliveries.push(next);
  options.feasibility.set(next.id, { best: { rider, margin: 30, availableNow: true } });
  const before = JSON.stringify(game);
  for (const paused of [true, false]) {
    const scene = { ...game, paused };
    const preview = firstShiftCoach(scene, { ...options, selectedJob: next });
    assert.equal(preview.jobId, next.id); assert.equal(preview.step, 'preview');
    const draft = { jobId: next.id, channel: 'priority', key: previewKey(next, 'priority', options.forecast) };
    const confirm = firstShiftCoach(scene, { ...options, selectedJob: next, draft });
    assert.equal(confirm.step, 'confirm'); assert.equal(confirm.jobId, next.id);
    assert.match(confirm.detail, /two radio slots/); assert.match(confirm.detail, /Kira still decides/);
    assert.match(confirm.title, /only a preview/);
  }
  assert.equal(JSON.stringify(game), before);
});

test('a channel-change preview never claims an existing live call has gone off air', () => {
  const { game, job, options } = fixture(); job.called = true; job.channel = 'open';
  const draft = { jobId: job.id, channel: 'local', key: previewKey(job, 'local', options.forecast) };
  const coach = firstShiftCoach(game, { ...options, draft });
  assert.equal(coach.step, 'confirm'); assert.equal(coach.action, 'confirm');
  assert.match(coach.title, /current call stays live/); assert.match(coach.detail, /change the call/);
  assert.doesNotMatch(coach.detail, /off-air|nothing is sent/i);
  job.reward++;
  const changed = firstShiftCoach(game, { ...options, draft });
  assert.equal(changed.step, 'review'); assert.match(changed.detail, /radio is unchanged/);
});

test('selected accepted work keeps the correct rider and explains a useful consequence at each stage', () => {
  const { game, rider, job, options } = fixture();
  job.status = 'claimed'; job.courierId = rider.id; rider.deliveryId = job.id; rider.phase = 'pickup';
  const other = { id: 'c1', name: 'Mauro', phase: 'dropoff', deliveryId: 'd1' };
  const second = { id: 'd1', status: 'claimed', courierId: other.id, pickedUp: true, deadlineAt: 150 };
  game.couriers.push(other); game.deliveries.push(second); game.paused = false;
  const selected = firstShiftCoach(game, { ...options, selectedJob: second });
  assert.equal(selected.jobId, second.id); assert.match(selected.detail, /Mauro/); assert.doesNotMatch(selected.detail, /Kira/);
  assert.match(selected.detail, /Adding a parcel can change/); assert.equal(selected.action, null);
  const pickup = firstShiftCoach(game, { ...options, selectedJob: job });
  assert.match(pickup.detail, /radio space is free/);
  rider.phase = 'loading';
  assert.match(firstShiftCoach(game, options).detail, /Handling counts toward the deadline/);
  rider.phase = 'waiting-window'; job.deliverAfter = 20;
  assert.match(firstShiftCoach(game, options).detail, /weight uses capacity until handover/);
});

test('no-volunteer guidance distinguishes bandwidth, competing offers, appeal and route limits', () => {
  const { game, rider, job, options } = fixture();
  const cases = [
    [{ available: false, rows: [] }, /radio is full/i, /Withdraw another call/],
    [{ available: true, rows: [{ rider, eligible: true, competingJob: 'd2' }] }, /Other calls/, /prefer other live offers/],
    [{ available: true, rows: [{ rider, eligible: true }] }, /no taker yet/, /invitation or bonus/],
    [{ available: true, rows: [{ rider, eligible: false }] }, /bike has limits/, /cannot fix cargo limits/],
    [{ available: true, rows: [{ rider: { ...rider, offDuty: true }, eligible: true }] }, /bike has limits/, /No rider can fit/]
  ];
  for (const [facts, title, detail] of cases) {
    const forecast = { ...facts, rider: null };
    const draft = { jobId: job.id, channel: 'open', key: previewKey(job, 'open', forecast) };
    const coach = firstShiftCoach(game, { ...options, draft, forecast });
    assert.equal(coach.step, 'no-fit'); assert.equal(coach.action, null);
    assert.match(coach.title, title); assert.match(coach.detail, detail);
  }
});
