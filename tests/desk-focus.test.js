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

test('a waiting rider warning suggests only a compatible route and keeps acceptance voluntary', () => {
  const { game, job, candidate, estimates } = fixture();
  game.wellbeing = true; game.couriers[0].phase = 'idle'; game.riderJobs = () => [];
  const wellbeing = { satisfaction: 30, band: 'restless', idleSeconds: 90, leaveIn: null, offDuty: false };
  game.riderWellbeing = () => wellbeing;
  const before = JSON.stringify({ job, wellbeing, rider: game.couriers[0] });
  const value = deskFocus(game, estimates);
  assert.equal(value.id, 'rider-wait:c0'); assert.equal(value.jobId, job.id);
  assert.equal(value.tone, 'watch'); assert.match(value.detail, /personal invitation/); assert.match(value.detail, /Acceptance is their choice/);
  assert.equal(JSON.stringify({ job, wellbeing, rider: game.couriers[0] }), before);
  candidate.margin = -2;
  assert.equal(deskFocus(game, estimates).id, 'tight:d1');
  wellbeing.leaveIn = 12;
  const urgent = deskFocus(game, estimates);
  assert.equal(urgent.jobId, null); assert.equal(urgent.riderId, 'c0');
  assert.match(urgent.title, /12s before leaving/); assert.match(urgent.detail, /No waiting parcel fits/);
});

test('already invited, occupied, departed and closing riders never get misleading fresh invitations', () => {
  const { game, job, estimates } = fixture();
  game.wellbeing = true; game.couriers[0].phase = 'idle'; game.riderJobs = () => [];
  const wellbeing = { satisfaction: 20, band: 'at-risk', idleSeconds: 120, leaveIn: 20, offDuty: false };
  game.riderWellbeing = () => wellbeing;
  job.preferredRiderId = game.couriers[0].id; job.called = true;
  assert.match(deskFocus(game, estimates).detail, /already invites Kira/);
  game.riderJobs = () => [{ id: 'busy' }];
  assert.notEqual(deskFocus(game, estimates).id, 'rider-wait:c0');
  game.riderJobs = () => []; wellbeing.offDuty = true;
  assert.notEqual(deskFocus(game, estimates).id, 'rider-wait:c0');
  wellbeing.offDuty = false; game.closing = true;
  assert.notEqual(deskFocus(game, estimates).id, 'rider-wait:c0');
});

test('a team departure ending never promises more arrivals and explains the new-shift recovery', () => {
  const { game, estimates } = fixture();
  game.gameOver = true; game.outcome = 'team-left';
  const value = deskFocus(game, estimates);
  assert.equal(value.id, 'finished'); assert.equal(value.jobId, null);
  assert.match(value.title, /team finished for today/); assert.match(value.detail, /new shift with the full team/);
  assert.doesNotMatch(value.detail, /New work arrives/);
});
