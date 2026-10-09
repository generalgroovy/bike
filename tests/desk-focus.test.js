import test from 'node:test';
import assert from 'node:assert/strict';
import { deskFocus } from '../src/desk-focus.js';

function fixture() {
  const rider = { id: 'c0', name: 'Kira' };
  const job = { id: 'd1', status: 'waiting', deadlineAt: 100, deliverAfter: 0, called: false };
  const game = { elapsed: 0, tick: 0, config: { target: 4 }, completed: 0, radioSlots: 3, couriers: [rider],
    activeDeliveries: () => [job], radioUsed: () => 0, courierById: () => rider,
    extensionOffer: () => ({ available: true, seconds: 20, fee: 4 }) };
  const candidate = { rider, mode: 'on the way', margin: 30, finishIn: 70 };
  const estimates = new Map([[job.id, { best: candidate, candidates: [candidate] }]]);
  return { game, job, candidate, estimates };
}

test('a real paired route becomes an inspectable opportunity without changing game state', () => {
  const { game, job, estimates } = fixture(), snapshot = JSON.stringify({ game, job, estimates: [...estimates] });
  const value = deskFocus(game, estimates);
  assert.equal(value.jobId, 'd1'); assert.equal(value.cue, 'opportunity');
  assert.match(value.detail, /Kira could fit D1 along the way/);
  assert.equal(JSON.stringify({ game, job, estimates: [...estimates] }), snapshot);
});

test('an actionable tight deadline outranks a possible combination and names the actual tradeoff', () => {
  const { game, candidate, estimates } = fixture(); candidate.margin = 7.1;
  const value = deskFocus(game, estimates);
  assert.equal(value.tone, 'urgent'); assert.match(value.title, /8s estimated buffer/);
  assert.match(value.detail, /20s for €4 less pay/);
});

test('live calls, full radio and closed delivery windows have distinct next actions', () => {
  const { game, job, candidate, estimates } = fixture(); candidate.mode = 'ready';
  job.deliverAfter = 55;
  assert.match(deskFocus(game, estimates).detail, /opens in 55s/);
  game.radioUsed = () => 3;
  assert.equal(deskFocus(game, estimates).id, 'radio-full');
  game.radioUsed = () => 1; job.called = true; game.paused = true;
  assert.equal(deskFocus(game, estimates).title, 'Calls ready · clock stopped');
  game.paused = false;
  assert.equal(deskFocus(game, estimates).title, 'The riders are choosing');
});

test('no-fit advice does not promise that incentives repair incompatible cargo', () => {
  const { game, job, estimates } = fixture(); job.deadlineAt = 20;
  estimates.set(job.id, { best: null, candidates: [] });
  assert.match(deskFocus(game, estimates).detail, /bonus cannot fix cargo capacity/);
  game.gameOver = true;
  assert.equal(deskFocus(game, estimates).id, 'finished');
});
