// Compare rulesets with the same explicit, deliberately simple dispatch policy.
// This is a mechanical baseline, not a model of player skill or enjoyment.
import { readFileSync } from 'node:fs';
import { BerlinPlaytest, FIXED_STEP, GEOGRAPHIC_RULESETS } from '../src/game-berlin-playtest.js';
import { decodeInnerRing } from '../src/inner-ring-city.js';

const city = decodeInnerRing(JSON.parse(readFileSync(new URL('../generated/berlin-inner-ring.json', import.meta.url))));
const results = [];
for (const ruleset of GEOGRAPHIC_RULESETS.filter(id=>id!=='berlin-dispatch-v4')) for (let index = 1; index <= 5; index++) {
  const seed = `BERLIN-${index}`, game = new BerlinPlaytest({ city, seed, mode: 'standard', ruleset });
  const claims = [], claim = game.claim;
  game.claim = function (courier, delivery, ...args) {
    const margin = this.offerMargin(courier, delivery);
    const accepted = claim.call(this, courier, delivery, ...args);
    if (accepted) claims.push({ id: delivery.id, margin });
    return accepted;
  };
  game.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 34000 && !game.gameOver; tick++) {
    if (game.upgradePending) game.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % 60 === 0) for (const job of game.activeDeliveries().filter(d => d.status === 'waiting' && !d.called))
      game.dispatch({ type: 'radio', jobId: job.id, channel: 'open' });
    game.update(FIXED_STEP);
  }
  if (!game.gameOver) throw new Error(`${ruleset} ${seed} did not finish`);
  results.push({ ruleset, seed, completed: game.completed, missed: game.failed, outcome: game.outcome,
    reputation: Number(game.reputation.toFixed(1)), claims: claims.length,
    lateAtAcceptance: claims.filter(c => c.margin < 0).length,
    claimedMisses: game.deliveries.filter(d => d.failureKind === 'claimed-late').length });
}
console.log(JSON.stringify({ city: city.metadata.id, policy: 'Broadcast all waiting work OPEN once per simulated second; choose faster bikes halfway.', results }, null, 2));
