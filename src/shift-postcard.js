// The postcard reads the shift; it never awards money, changes rider choices,
// consumes random numbers or adds fields to legacy replay records.
import { FULL_CITY_RULESETS, GEOGRAPHIC_RULESET } from './game-berlin-playtest.js';

export const POSTCARD_STORAGE_KEY = 'send-it:postcards:v1';
export const POSTCARD_LIMIT = 24;

const OUTCOMES = new Set(['success', 'target-missed', 'collapse', 'team-left']);
const count = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const number = value => Number.isFinite(value) ? value : 0;
const list = value => Array.isArray(value) ? value : [];
const string = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const identity = card => JSON.stringify([card.city, card.ruleset, card.seed, card.mode, card.district]);

function riderLine(rider, completed, missed, ended) {
  const name = rider.name;
  if (rider.offDuty || rider.phase === 'off-duty') return ({
    Kira: 'Signed off. I needed a fitting call before the waiting got to me.',
    Mauro: 'Called it a day. Too much waiting, too little work.',
    Brian: 'Headed home. There was room on the bike, but the wait wore me down.'
  })[name] ?? 'Signed off after waiting too long without work.';
  if (missed) return ({
    Kira: `${missed} accepted ${missed === 1 ? 'job missed' : 'jobs missed'}. Give me a little more road next time.`,
    Mauro: `${missed} accepted ${missed === 1 ? 'job missed' : 'jobs missed'}. A better fee cannot buy back time.`,
    Brian: `${missed} accepted ${missed === 1 ? 'job missed' : 'jobs missed'}. Leave room for the whole tour.`
  })[name] ?? `${missed} accepted ${missed === 1 ? 'job missed its' : 'jobs missed their'} deadline.`;
  if (completed) return ({
    Kira: `${completed} delivered. Clear calls, quick feet.`,
    Mauro: `${completed} delivered. Parcels handed over; fees on the board.`,
    Brian: `${completed} delivered. A little more of Berlin connected.`
  })[name] ?? `${completed} ${completed === 1 ? 'delivery' : 'deliveries'} completed.`;
  if (rider.phase === 'break') return 'Taking an endurance break. No delivery completed yet.';
  if (['pickup', 'loading', 'dropoff', 'handover', 'waiting-window'].includes(rider.phase))
    return ended ? 'Accepted work, but no completed delivery this shift.' : 'On a tour. The first delivery is still ahead.';
  return ({
    Kira: ended ? 'No deliveries this time. Find me something that fits next shift.' : 'Listening. A fitting call and I am off.',
    Mauro: ended ? 'No deliveries this shift. A worthwhile offer would help next time.' : 'Listening for work worth the ride.',
    Brian: ended ? 'No deliveries this shift. There is room for me next time.' : 'Room on the bike. Listening for a fitting call.'
  })[name] ?? (ended ? 'No completed deliveries this shift.' : 'Listening for fitting work.');
}

/** A factual, detached projection. Safe to inspect every frame or after replay. */
export function postcardFor(game = {}) {
  game ??= {};
  const jobs = list(game.deliveries), crew = list(game.couriers).filter(Boolean);
  const completed = count(game.completed), failed = count(game.failed), target = count(game.config?.target);
  const mode = game.mode === 'standard' ? 'standard' : 'training';
  const outcome = OUTCOMES.has(game.outcome) ? game.outcome : null;
  const city = game.fullCity || game.cityData?.metadata?.scope === 'full-city' ? 'berlin' : 'inner-ring';
  const district = city === 'berlin' ? string(game.startRegion, 'citywide') : null;
  const region = list(game.cityData?.regions ?? game.districts).find(item => item?.id === district);
  const locality = district && district !== 'citywide' ? string(region?.name, district) : city === 'berlin' ? 'Across Berlin' : 'Berlin · Inner Ring';
  const riders = crew.map(rider => {
    const delivered = count(rider.completed);
    const missed = jobs.filter(job => job?.courierId === rider.id && job.status === 'failed').length;
    return { id: string(rider.id), name: string(rider.name, 'Rider'), color: string(rider.color, '#367b69'),
      completed: delivered, line: riderLine(rider, delivered, missed, Boolean(outcome)) };
  });
  const flow = count(game.bestChain), flowTarget = mode === 'training' ? 3 : 6;
  const served = riders.filter(rider => rider.completed > 0).length;
  const stamps = [
    { id: 'deliveries', label: 'Target met', detail: `Complete ${target} deliveries in this shift.`, value: completed, target, earned: target > 0 && completed >= target },
    { id: 'flow', label: 'In the flow', detail: `${flowTarget} consecutive deliveries without a miss.`, value: flow, target: flowTarget, earned: flow >= flowTarget },
    { id: 'team', label: 'Whole crew', detail: 'Every rider completes at least one delivery.', value: served, target: riders.length, earned: riders.length > 0 && served === riders.length }
  ];
  const departed = crew.find(rider => rider.offDuty || rider.phase === 'off-duty');
  const waiting = riders.find(rider => rider.completed === 0);
  const misses = jobs.filter(job => job?.status === 'failed');
  const uncalled = misses.filter(job => job.failureKind === 'never-called').length;
  const untaken = misses.filter(job => job.failureKind === 'called-unclaimed').length;
  const late = misses.filter(job => job.failureKind === 'claimed-late').length;
  let nextTry = 'Replay this shift and try a different radio choice. The riders still decide.';
  if (departed) nextTry = `Watch ${string(departed.name, 'the waiting rider')} between tours. Offer fitting work before patience runs out; an invitation helps only if they accept.`;
  else if (failed && uncalled >= Math.max(untaken, late) && uncalled > 0) nextTry = 'Bring fitting work onto the radio earlier. A job left off-air still has a deadline.';
  else if (failed && untaken >= late && untaken > 0) nextTry = 'Compare fit before broadcasting. Withdraw calls with no feasible taker to free radio space.';
  else if (failed && late > 0) nextTry = 'Leave a larger finish buffer. An extra job can delay both stops on a rider’s tour.';
  else if (waiting) nextTry = `Find a fitting offer for ${waiting.name}. A personal invitation adds interest; it never reserves the job.`;
  else if (!stamps[1].earned) nextTry = `Aim for ${flowTarget} deliveries in a row. Protect the finish buffer before adding another call.`;
  else if (!stamps[0].earned) nextTry = `Aim for ${target} deliveries. Look for jobs a busy rider can fit along the way.`;
  else if (outcome === 'success') nextTry = 'All three stamps earned. Replay the same shift and see whether you can keep them with fewer bonuses.';
  const headline = outcome === 'success' ? 'You kept Berlin moving.'
    : outcome === 'team-left' ? 'The team called it a day.'
    : outcome === 'collapse' ? 'A rough shift. A story to learn from.'
    : outcome === 'target-missed' ? completed ? 'Some deliveries made. Another way to play.' : 'A tough shift. Another way to play.'
    : completed ? 'Your Berlin story is taking shape.' : 'Your next Berlin story.';
  const card = { locality, city, district, seed: string(game.seed), mode, ruleset: string(game.ruleset),
    completed, target, failed, profit: number(game.cash) - number(game.startingCash), outcome,
    stamps, riders, headline, nextTry };
  return { id: identity(card), ...card };
}

/** A challenge is the same opening and rules, never a preassigned outcome. */
export function makeChallengeURL(game, baseURL) {
  return challengeURLForPostcard(postcardFor(game), baseURL);
}

/** The base destination is supplied by the app, never read from stored data. */
export function challengeURLForPostcard(card, baseURL) {
  const url = new URL(baseURL);
  url.search = ''; url.hash = '';
  url.searchParams.set('city', card.city);
  url.searchParams.set('seed', card.seed);
  url.searchParams.set('mode', card.mode);
  if (card.district) url.searchParams.set('district', card.district);
  if (card.ruleset) url.searchParams.set('ruleset', card.ruleset);
  return url.href;
}

export function challengeText(game) {
  const card = postcardFor(game);
  const earned = card.stamps.filter(stamp => stamp.earned).length;
  return `Send It · ${card.locality} · ${card.completed}/${card.target} delivered · ${earned}/3 stamps. Same streets, your calls. Riders choose. Shift ${card.seed}.`;
}

const boundedText = (value, max, allowEmpty = false) => typeof value === 'string' && value.length <= max && (allowEmpty || value.length > 0);
function savedCard(value) {
  if (!value || typeof value !== 'object' || !OUTCOMES.has(value.outcome) || !['training', 'standard'].includes(value.mode)
      || !['berlin', 'inner-ring'].includes(value.city) || !boundedText(value.seed, 512)
      || !(value.city === 'berlin' ? FULL_CITY_RULESETS : ['berlin-dispatch-v2', GEOGRAPHIC_RULESET]).includes(value.ruleset)
      || !boundedText(value.locality, 100) || !(value.district === null || boundedText(value.district, 100))
      || (value.city === 'berlin' ? value.district === null : value.district !== null)
      || !boundedText(value.headline, 160) || !boundedText(value.nextTry, 360)
      || ![value.completed, value.target, value.failed].every(n => Number.isInteger(n) && n >= 0 && n <= 10000)
      || !Number.isFinite(value.profit) || Math.abs(value.profit) > 1000000
      || !Array.isArray(value.stamps) || value.stamps.length !== 3
      || !Array.isArray(value.riders) || value.riders.length > 12) return null;
  const expected = ['deliveries', 'flow', 'team'];
  const stamps = [];
  for (let index = 0; index < expected.length; index++) {
    const stamp = value.stamps[index];
    if (!stamp || stamp.id !== expected[index] || !boundedText(stamp.label, 60) || !boundedText(stamp.detail, 180)
        || ![stamp.value, stamp.target].every(n => Number.isInteger(n) && n >= 0 && n <= 10000)) return null;
    stamps.push({ id: stamp.id, label: stamp.label, detail: stamp.detail, value: stamp.value, target: stamp.target,
      earned: stamp.target > 0 && stamp.value >= stamp.target });
  }
  const riders = [];
  for (const rider of value.riders) {
    if (!rider || !boundedText(rider.id, 40) || !boundedText(rider.name, 60) || !boundedText(rider.color, 30)
        || !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(rider.color) || !boundedText(rider.line, 240)
        || !Number.isInteger(rider.completed) || rider.completed < 0 || rider.completed > 10000) return null;
    riders.push({ id: rider.id, name: rider.name, color: rider.color, completed: rider.completed, line: rider.line });
  }
  const card = { locality: value.locality, city: value.city, district: value.district, seed: value.seed, mode: value.mode,
    ruleset: value.ruleset, completed: value.completed, target: value.target, failed: value.failed,
    profit: value.profit, outcome: value.outcome, stamps, riders, headline: value.headline, nextTry: value.nextTry };
  return { id: identity(card), ...card };
}

/** Storage is untrusted input. Return detached records, never its objects. */
export function normalizePostcardCollection(value) {
  if (!Array.isArray(value)) return [];
  const records = [], seen = new Set();
  for (const entry of value.slice(0, 120)) {
    const card = savedCard(entry);
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id); records.push(card);
    if (records.length === POSTCARD_LIMIT) break;
  }
  return records;
}

const rank = card => [card.outcome === 'success' ? 1 : 0, card.stamps.filter(stamp => stamp.earned).length, card.completed, -card.failed, card.profit];
const better = (a, b) => { const left = rank(a), right = rank(b); for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return left[i] > right[i]; return true; };

/** Keep one actual best attempt per challenge; never combine incompatible runs. */
export function collectPostcard(collection, postcard) {
  const records = normalizePostcardCollection(collection), candidate = savedCard(postcard);
  if (!candidate) return records;
  const prior = records.find(card => card.id === candidate.id);
  const chosen = prior && !better(candidate, prior) ? prior : candidate;
  return [chosen, ...records.filter(card => card.id !== candidate.id)].slice(0, POSTCARD_LIMIT);
}
