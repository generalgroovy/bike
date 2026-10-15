import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BerlinPlaytest } from '../src/game-berlin-playtest.js';
import { decodeInnerRing } from '../src/inner-ring-city.js';
import { postcardFor, makeChallengeURL, challengeURLForPostcard, challengeText,
  collectPostcard, normalizePostcardCollection, POSTCARD_LIMIT } from '../src/shift-postcard.js';

function fixture(patch = {}) {
  return { seed: 'POSTCARD-1', mode: 'training', ruleset: 'berlin-dispatch-v8', fullCity: true,
    startRegion: 'mitte', cityData: { metadata: { scope: 'full-city' }, regions: [{ id: 'mitte', name: 'Mitte' }] },
    completed: 6, failed: 0, cash: 100, startingCash: 10, config: { target: 6 }, bestChain: 4,
    outcome: 'success', couriers: [
      { id: 'c0', name: 'Kira', color: '#378eb8', completed: 3, phase: 'idle' },
      { id: 'c1', name: 'Mauro', color: '#d65c70', completed: 2, phase: 'idle' },
      { id: 'c2', name: 'Brian', color: '#76a64e', completed: 1, phase: 'idle' }
    ], deliveries: [], dispatchLog: [], ...patch };
}

test('postcard milestones come from durable outcomes even after the event log rolls off', () => {
  const game = fixture(), card = postcardFor(game);
  assert.equal(card.locality, 'Mitte'); assert.equal(card.profit, 90);
  assert.deepEqual(card.stamps.map(stamp => [stamp.id, stamp.value, stamp.target, stamp.earned]),
    [['deliveries', 6, 6, true], ['flow', 4, 3, true], ['team', 3, 3, true]]);
  assert.deepEqual(card.riders.map(rider => rider.completed), [3, 2, 1]);
  assert.match(card.riders[0].line, /^3 delivered/);
  card.riders[0].name = 'changed'; card.stamps[0].value = 900;
  assert.equal(game.couriers[0].name, 'Kira'); assert.equal(game.completed, 6);
});

test('stamps do not falsely claim a win; full shifts require a six-delivery flow', () => {
  const card = postcardFor(fixture({ mode: 'standard', outcome: 'collapse', bestChain: 5 }));
  assert.equal(card.stamps[0].earned, true); assert.equal(card.stamps[1].earned, false);
  assert.equal(card.stamps[1].target, 6); assert.equal(card.outcome, 'collapse');
  assert.doesNotMatch(card.headline, /kept Berlin moving/);
});

test('whole crew requires every rider to complete work, not just accept an offer', () => {
  const game = fixture(); game.couriers[2].completed = 0; game.couriers[2].phase = 'pickup';
  game.deliveries.push({ id: 'd9', courierId: 'c2', status: 'claimed' });
  const card = postcardFor(game);
  assert.equal(card.stamps[2].earned, false); assert.equal(card.stamps[2].value, 2);
  assert.match(card.riders[2].line, /Accepted work, but no completed delivery/);
  assert.match(card.nextTry, /fitting offer for Brian/);
});

test('rider signoffs distinguish departure, missed accepted work, idle and served riders', () => {
  const game = fixture({ outcome: 'team-left', failed: 2 });
  game.couriers[0].offDuty = true;
  game.couriers[1].completed = 0;
  game.couriers[2].completed = 0;
  game.deliveries = [{ status: 'failed', courierId: 'c1', failureKind: 'claimed-late' },
    { status: 'failed', courierId: null, failureKind: 'never-called' }];
  const card = postcardFor(game);
  assert.match(card.riders[0].line, /Signed off/);
  assert.match(card.riders[1].line, /1 accepted job missed/);
  assert.match(card.riders[2].line, /No deliveries this shift/);
  assert.match(card.nextTry, /Watch Kira between tours/);
  assert.doesNotMatch(card.riders[2].line, /missed|signed off/i);
});

test('next attempt advice follows actual failure causes without inferring blame from previews', () => {
  for (const [failureKind, expected] of [['never-called', /off-air/], ['called-unclaimed', /no feasible taker/], ['claimed-late', /larger finish buffer/]]) {
    const card = postcardFor(fixture({ failed: 1, outcome: 'target-missed', deliveries: [{ status: 'failed', failureKind }] }));
    assert.match(card.nextTry, expected);
  }
});

test('missing optional data is safe and cannot award an empty-roster or zero-target stamp', () => {
  for (const game of [undefined, null, {}, { couriers: [null], deliveries: [null], completed: NaN }]) {
    const card = postcardFor(game);
    assert.equal(card.completed, 0); assert.equal(card.profit, 0);
    assert.ok(card.stamps.every(stamp => !stamp.earned));
  }
  assert.doesNotMatch(postcardFor(fixture({ completed: 0, outcome: 'target-missed' })).headline, /deliveries made/);
});

test('repeated inspection leaves current and legacy model exports, RNG, riders, logs and route caches untouched', () => {
  const city = decodeInnerRing(JSON.parse(readFileSync(new URL('../generated/berlin-city.json', import.meta.url))));
  const games = [new BerlinPlaytest({ seed: 'POSTCARD-PURITY' }),
    ...[4, 5, 6, 7, 8].map(version => new BerlinPlaytest({ city, seed: 'POSTCARD-PURITY', ruleset: `berlin-dispatch-v${version}` }))];
  for (const game of games) {
    const snapshot = () => JSON.stringify({ run: game.exportRun(), rng: game.rng, riders: game.couriers,
      deliveries: game.deliveries, stats: game.runStats, routes: [...game.routeCache] });
    const before = snapshot(), first = postcardFor(game);
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(postcardFor(game), first); challengeText(game);
      makeChallengeURL(game, 'https://generalgroovy.github.io/bike/preview/berlin/');
    }
    assert.equal(snapshot(), before, game.ruleset);
  }
});

test('challenge links retain exact seed, mode, locality and legacy rules, dropping unrelated query data', () => {
  const seed = 'Berlin? # /& Ä🚲'.repeat(60);
  const game = fixture({ seed, ruleset: 'berlin-dispatch-v4', mode: 'standard' });
  const url = new URL(makeChallengeURL(game, 'https://generalgroovy.github.io/bike/preview/berlin/?old=1#panel'));
  assert.equal(url.origin, 'https://generalgroovy.github.io');
  assert.equal(url.searchParams.get('seed'), seed); assert.equal(url.searchParams.get('ruleset'), 'berlin-dispatch-v4');
  assert.equal(url.searchParams.get('city'), 'berlin'); assert.equal(url.searchParams.get('district'), 'mitte');
  assert.equal(url.searchParams.get('mode'), 'standard'); assert.equal(url.searchParams.has('old'), false); assert.equal(url.hash, '');
  const inner = new URL(makeChallengeURL(fixture({ fullCity: false, cityData: null, ruleset: 'berlin-dispatch-v2' }), url.href));
  assert.equal(inner.searchParams.get('city'), 'inner-ring'); assert.equal(inner.searchParams.has('district'), false);
});

test('local collection accepts only finished bounded records and returns detached sanitized objects', () => {
  const game = fixture(), card = postcardFor(game);
  assert.deepEqual(collectPostcard([], postcardFor({ ...game, outcome: null })), []);
  const stored = normalizePostcardCollection([null, {}, { ...card, url: 'https://unwanted.test', id: 'forged', stamps: card.stamps.map(stamp => ({ ...stamp, earned: false })) }]);
  assert.equal(stored.length, 1); assert.equal(stored[0].url, undefined); assert.equal(stored[0].id, card.id);
  assert.ok(stored[0].stamps.every(stamp => stamp.earned));
  stored[0].riders[0].line = 'changed'; assert.notEqual(card.riders[0].line, 'changed');
  assert.deepEqual(collectPostcard([], postcardFor(fixture({ seed: 'x'.repeat(513) }))), []);
  assert.deepEqual(normalizePostcardCollection({ cards: [card] }), []);
});

test('a replay keeps its best actual attempt, and never combines stamps from different runs', () => {
  const firstGame = fixture({ completed: 8, bestChain: 6 }); firstGame.couriers[2].completed = 0;
  const first = postcardFor(firstGame), second = postcardFor(fixture({ completed: 6, bestChain: 1 }));
  const original = [first], before = JSON.stringify(original), combined = collectPostcard(original, second);
  assert.equal(JSON.stringify(original), before); assert.equal(combined.length, 1);
  assert.equal(combined[0].completed, 8); assert.equal(combined[0].stamps[2].earned, false);
  const won = postcardFor(fixture());
  assert.equal(collectPostcard(combined, won)[0].stamps.filter(stamp => stamp.earned).length, 3);
});

test('local postcards are bounded, deduplicated and separated by ruleset and district', () => {
  const cards = Array.from({ length: 40 }, (_, i) => postcardFor(fixture({ seed: `SHIFT-${i}` })));
  assert.equal(normalizePostcardCollection(cards).length, POSTCARD_LIMIT);
  assert.equal(normalizePostcardCollection([cards[0], cards[0], ...cards]).length, POSTCARD_LIMIT);
  const current = postcardFor(fixture()), legacy = postcardFor(fixture({ ruleset: 'berlin-dispatch-v7' }));
  assert.notEqual(current.id, legacy.id);
  assert.notEqual(current.id, postcardFor(fixture({ startRegion: 'spandau' })).id);
  const added = collectPostcard(cards, legacy);
  assert.equal(added.length, POSTCARD_LIMIT); assert.equal(added[0].ruleset, 'berlin-dispatch-v7');
  const link = new URL(challengeURLForPostcard(added[0], 'https://generalgroovy.github.io/bike/preview/berlin/'));
  assert.equal(link.searchParams.get('ruleset'), 'berlin-dispatch-v7');
});

test('stored challenges reject unknown and mismatched map rules instead of promising an inexact retry', () => {
  const full = postcardFor(fixture());
  for (const invalid of [
    { ...full, ruleset: 'berlin-dispatch-v999' },
    { ...full, ruleset: 'berlin-dispatch-v2' },
    { ...full, city: 'inner-ring', district: null },
    { ...full, district: null }
  ]) assert.deepEqual(normalizePostcardCollection([invalid]), []);
  for (const version of [2, 3]) {
    const inner = postcardFor(fixture({ fullCity: false, cityData: null, ruleset: `berlin-dispatch-v${version}` }));
    assert.equal(normalizePostcardCollection([inner]).length, 1);
    assert.deepEqual(normalizePostcardCollection([{ ...inner, district: 'mitte' }]), []);
  }
  for (const version of [4, 5, 6, 7, 8])
    assert.equal(normalizePostcardCollection([{ ...full, ruleset: `berlin-dispatch-v${version}` }]).length, 1);
});

test('share text reports earned milestones without presenting every finish as a win', () => {
  const text = challengeText(fixture({ outcome: 'collapse', completed: 2, bestChain: 0 }));
  assert.match(text, /2\/6 delivered · 1\/3 stamps/); assert.match(text, /Riders choose/);
  assert.doesNotMatch(text, /won|victory|success/i);
});
