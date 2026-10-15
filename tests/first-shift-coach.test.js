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
  assert.match(firstShiftCoach(game, options).detail, /invitation, not an assignment/);
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
  assert.match(noFit.detail, /cannot fix route or cargo limits/);
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
  assert.match(firstShiftCoach(game, options).detail, /has it on board/);
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
