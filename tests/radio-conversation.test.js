import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationFor, appendConversation, RIDER_VOICES } from '../src/radio-conversation.js';

function fixture(options = {}) {
  return {
    seed: 'RADIO-BERLIN', elapsed: 20,
    couriers: ['Kira', 'Mauro', 'Brian'].map((name, index) => ({ id: `c${index}`, name, stops: [], fatigue: .2, radioOn: true })),
    deliveries: [{ id: 'd2', type: 'document', pickupAddress: 'Brunnenstraße 42', dropoffAddress: 'Invalidenstraße 101',
      weightKg: 1.5, reward: 18, deadlineAt: 85, deliverAfter: 0, status: 'waiting', courierId: null, ...options }],
    rng: { state: 123, float() { throw new Error('Dialogue must not consume game RNG'); } },
    actions: [], dispatchLog: [],
    broadcastForecast() { throw new Error('Dialogue must not route or forecast'); },
    choiceReason() { throw new Error('Dialogue must not invoke mutable model helpers'); }
  };
}
const event = (action, extra = {}) => ({ action, at: 20, deliveryId: 'd2', ...extra });
const words = exchange => exchange.lines.map(line => line.text).join(' ');
function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

test('radio text is deterministic and pure even with frozen shift state and hostile RNG', () => {
  const game = deepFreeze(fixture({ courierId: 'c0', status: 'claimed' }));
  const before = JSON.stringify(game);
  const recorded = deepFreeze(event('claim', { rider: 'Kira', mode: 'ready' }));
  const first = conversationFor(game, recorded);
  for (let i = 0; i < 8; i++) assert.deepEqual(conversationFor(game, recorded), first);
  assert.equal(JSON.stringify(game), before);
  assert.equal(first.riderId, 'c0');
  assert.equal(first.lines[0].name, 'Kira');
  assert.ok(first.lines.some(line => line.speaker === 'dispatcher'));
  assert.equal(conversationFor(game, { ...recorded, preview: true }), null);
});

test('broadcasts and invitations never manufacture a rider acceptance', () => {
  const game = fixture({ preferredRiderId: 'c1', called: true });
  for (const channel of ['open', 'local', 'priority']) {
    const exchange = conversationFor(game, event('call', { channel }));
    assert.ok(exchange.lines.every(line => line.speaker !== 'rider'));
    assert.equal(exchange.riderId, null);
    assert.match(words(exchange), /personally invited.*choice stays with each rider/);
  }
  const onAir = conversationFor(game, event('prefer', { rider: 'Mauro' }));
  assert.match(words(onAir), /Your call if it fits/);
  game.deliveries[0].called = false;
  const draft = conversationFor(game, event('prefer', { rider: 'Mauro' }));
  assert.match(words(draft), /when D2 goes on air/);
  assert.equal(draft.lines.length, 1);
  assert.equal(draft.lines[0].speaker, 'dispatcher');
  assert.match(words(conversationFor(game, event('prefer', { rider: null }))), /no personal invitation/);
  game.deliveries[0].courierId = 'c1';
  assert.equal(conversationFor(game, event('call', { channel: 'open' })).riderId, null, 'An old offer is never attributed to its eventual volunteer');
});

test('rider voices and accepted route modes are distinct and fact based', () => {
  const game = fixture({ status: 'claimed' });
  assert.equal(new Set(Object.values(RIDER_VOICES).map(voice => voice.instrument)).size, 3);
  assert.equal(new Set(Object.values(RIDER_VOICES).map(voice => voice.tone)).size, 3);
  const replies = new Set();
  for (const name of ['Kira', 'Mauro', 'Brian']) {
    const ready = conversationFor(game, event('claim', { rider: name, mode: 'ready' }));
    replies.add(ready.lines[0].text);
    assert.equal(ready.cue.attitude, RIDER_VOICES[name].tone);
    const queued = conversationFor(game, event('claim', { rider: name, mode: 'next' }));
    assert.match(words(queued), /current work|current parcel|current delivery|current work|current|this one first/i);
    assert.match(words(queued), /Queued after your current work/);
    const along = conversationFor(game, event('claim', { rider: name, mode: 'on the way' }));
    assert.match(words(along), /both deliveries/);
    assert.notEqual(ready.lines[0].text, along.lines[0].text);
  }
  assert.equal(replies.size, 3);
});

test('offer changes explain what improved and what did not', () => {
  const game = fixture({ reward: 14 });
  const extension = conversationFor(game, event('client-call', { seconds: 18, fee: 4 }));
  assert.match(words(extension), /18s/);
  assert.match(words(extension), /Fee reduced by €4/);
  const variants = new Set();
  for (let i = 0; i < 20; i++) {
    const result = conversationFor({ ...game, seed: `bonus-${i}` }, event('sweeten', { cost: 5 }));
    variants.add(words(result));
    assert.ok(result.lines.every(line => line.speaker === 'dispatcher'));
  }
  assert.equal(variants.size, 3);
  assert.ok([...variants].some(text => /deadline stays put/.test(text)));
});

test('pickup dialogue follows actual cargo and delivery windows', () => {
  const fragile = fixture({ type: 'fragile', deliverAfter: 65, status: 'claimed', courierId: 'c1' });
  const picked = conversationFor(fragile, event('pickup', { rider: 'Mauro' }));
  assert.match(words(picked), /delicate|rattles/i);
  assert.match(words(picked), /opens in 45s. No early handover/);
  const heavy = fixture({ type: 'grocery', weightKg: 16, status: 'claimed', courierId: 'c2' });
  const loaded = conversationFor(heavy, event('pickup', { rider: 'Brian' }));
  assert.match(words(loaded), /16 kg|proper load/);
  assert.equal(loaded.lines.length, 1);
  const wait = conversationFor(fragile, event('window-wait', { rider: 'Mauro' }));
  assert.equal(wait.tone, 'waiting');
  assert.match(words(wait), /45s/);
  const open = conversationFor(fragile, event('window-open', { rider: 'Mauro', at: 65 }));
  assert.match(words(open), /window is open/);
  assert.match(words(open), /handing over/i);
});

test('completion reflects actual deadline buffer, income, address and remaining work', () => {
  const game = fixture({ courierId: 'c2', status: 'completed' });
  const tight = conversationFor(game, event('complete', { rider: 'Brian', at: 80, quality: .05 }));
  assert.equal(tight.tone, 'close');
  assert.match(words(tight), /5s to spare/);
  assert.match(words(tight), /€18/);
  assert.match(words(tight), /breathing room/);
  game.deliveries.push({ id: 'd3', status: 'claimed', courierId: 'c2', pickedUp: true });
  const chained = conversationFor(game, event('complete', { rider: 'Brian', at: 40 }));
  assert.match(words(chained), /other stop stays on the tour/);
  assert.match(words(chained), /45s to spare/);
  assert.equal(chained.priority, 8);
  game.deliveries.pop();
  const variants = Array.from({ length: 12 }, (_, index) => words(conversationFor({ ...game, seed: `finish-${index}` }, event('complete', { rider: 'Brian' }))));
  assert.ok(variants.some(text => text.includes('Invalidenstraße 101')));
});

test('misses distinguish an unheard offer, no volunteer, and an accepted late delivery', () => {
  const game = fixture({ status: 'failed' });
  const unheard = conversationFor(game, event('fail', { kind: 'never-called' }));
  assert.match(words(unheard), /expired off air/);
  assert.ok(unheard.lines.every(line => line.speaker === 'dispatcher'));
  const unclaimed = conversationFor(game, event('fail', { kind: 'called-unclaimed' }));
  assert.match(words(unclaimed), /without a taker/);
  game.deliveries[0].courierId = 'c0';
  const late = conversationFor(game, event('fail', { kind: 'claimed-late', penalty: 9 }));
  assert.equal(late.lines[0].speaker, 'rider');
  assert.equal(late.lines[0].name, 'Kira');
  assert.match(words(late), /9 reputation lost/);
  assert.equal(late.priority, 9);
  game.couriers = [];
  assert.doesNotMatch(words(conversationFor(game, event('fail', { kind: 'claimed-late' }))), /without a taker/, 'Missing presentation identity does not rewrite an accepted job as unclaimed');
});

test('rest and recovery respect rider autonomy without inventing restored endurance', () => {
  const game = fixture();
  for (const name of ['Kira', 'Mauro', 'Brian']) {
    const resting = conversationFor(game, event('break', { rider: name, deliveryId: null }));
    assert.equal(resting.riderId, game.couriers.find(r => r.name === name).id);
    assert.match(words(resting), /recover/);
    const recovery = conversationFor(game, event('radio-on', { rider: name, deliveryId: null }));
    assert.match(words(recovery), /Pick what suits/);
    assert.doesNotMatch(words(recovery), /100|fully recovered|assigned/);
  }
});

test('all exchanges are readable two-line plain text with meaningful deterministic variety', () => {
  const game = fixture({ courierId: 'c1', status: 'claimed', deliverAfter: 40 });
  const actions = ['spawn', 'call', 'channel', 'prefer', 'sweeten', 'client-call', 'claim', 'pickup', 'window-wait', 'window-open', 'complete', 'fail', 'break', 'radio-on', 'uncall', 'radio-denied', 'event-forecast', 'event-start', 'event-end'];
  for (const action of actions) for (const rider of ['Kira', 'Mauro', 'Brian']) {
    const exchange = conversationFor(game, event(action, { rider, channel: 'open', seconds: 20, fee: 4, kind: 'claimed-late', place: 'Karl-Marx-Allee' }));
    assert.ok(exchange, action);
    assert.ok(exchange.lines.length >= 1 && exchange.lines.length <= 2, action);
    for (const line of exchange.lines) {
      assert.ok(line.text.length > 0 && line.text.length <= 180, `${action}: ${line.text.length} ${line.text}`);
      assert.doesNotMatch(line.text, /undefined|NaN|\[object|<[^>]+>/);
    }
  }
  const claimTexts = new Set(Array.from({ length: 20 }, (_, index) => words(conversationFor({ ...game, seed: `voice-${index}` }, event('claim', { rider: 'Mauro' })))));
  assert.ok(claimTexts.size >= 3);
  assert.equal(conversationFor(game, event('pickup-arrival', { rider: 'Mauro' })), null, 'Tiny handoff steps do not crowd the radio');
  assert.equal(conversationFor(game, event('claim', { rider: 'Missing' })), null);
});

test('history remains bounded, deduplicates repeated entries and never changes the caller array', () => {
  const game = fixture(), history = [];
  const first = conversationFor(game, event('call', { channel: 'open' }));
  const one = appendConversation(history, first);
  assert.equal(history.length, 0);
  assert.equal(one.length, 1);
  assert.deepEqual(appendConversation(one, first), one);
  let bounded = one;
  for (let i = 1; i < 20; i++) bounded = appendConversation(bounded, conversationFor(game, event('call', { at: i + 20 })));
  assert.equal(bounded.length, 6);
  assert.equal(bounded.at(-1).at, 39);
  assert.deepEqual(appendConversation(bounded, null), bounded);
  assert.equal(appendConversation(bounded, null, 2).length, 2);
  assert.equal(appendConversation(Array.from({ length: 30 }, (_, i) => ({ id: i + 1 })), null, 1000).length, 12);
});

// Wellbeing is an event-driven conversation: no synthetic acceptance or timer.
test('rider wellbeing warnings name the affected rider and explain remaining time and day scope', () => {
  const game = deepFreeze(fixture());
  const before = JSON.stringify(game);
  const variants = new Set();
  for (const name of ['Kira', 'Mauro', 'Brian']) {
    const restless = conversationFor(game, event('rider-restless', { rider: name, deliveryId: null, reason: 'waiting' }));
    const warning = conversationFor(game, event('rider-warning', { rider: name, deliveryId: null, leaveIn: 20 }));
    const recovered = conversationFor(game, event('rider-recovered', { rider: name, deliveryId: null, reason: 'accepted' }));
    const left = conversationFor(game, event('rider-left', { rider: name, deliveryId: null }));
    for (const exchange of [restless, warning, recovered, left]) {
      assert.equal(exchange.riderId, game.couriers.find(c => c.name === name).id);
      assert.equal(exchange.lines[0].speaker, 'rider');
      assert.equal(exchange.lines[0].name, name);
      assert.equal(exchange.lines.length, 2);
      assert.ok(exchange.lines.every(line => line.text.length <= 180));
    }
    variants.add(warning.lines[0].text);
    assert.match(words(warning), /20s/);
    assert.match(words(warning), /taking it is your call/);
    assert.ok(warning.priority > restless.priority);
    assert.ok(left.priority > warning.priority);
    assert.match(words(left), /signed off for today.*unavailable until the next shift/i);
    assert.doesNotMatch(words(left), /short breather|back when|recover/);
    const missed = conversationFor(game, event('rider-restless', { rider: name, deliveryId: null, reason: 'missed-job' }));
    assert.match(words(missed), /miss|wasted trip|hard ending/i);
    assert.doesNotMatch(words(missed), /been waiting|long gap/i);
  }
  assert.equal(variants.size, 3);
  assert.equal(JSON.stringify(game), before);
});
