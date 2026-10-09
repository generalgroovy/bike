import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodeInnerRing } from '../src/inner-ring-city.js';
import { BerlinPlaytest, FIXED_STEP } from '../src/game-berlin-playtest.js';

// Same ordinary dispatcher policy as the v7 demand comparison. No invitation,
// bonus, extension or forecast can secretly rescue an unattended rider here.
const city = decodeInnerRing(JSON.parse(readFileSync(new URL('../generated/berlin-city.json', import.meta.url))));
const args = process.argv.slice(2), seeds = args.length ? args : ['BERLIN-1', 'BERLIN-2', 'BERLIN-3'];
const runs = [];
for (const seed of seeds) for (const mode of ['training', 'standard']) for (const ruleset of ['berlin-dispatch-v7', 'berlin-dispatch-v8']) {
  const g = new BerlinPlaytest({ city, seed, mode, ruleset });
  const troughs = Object.fromEntries(g.couriers.map(c => [c.id, 72]));
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 33000 && !g.gameOver; tick++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % 300 === 0) for (const d of g.activeDeliveries().filter(d => d.status === 'waiting' && !d.called).sort((a, b) => a.deadlineAt - b.deadlineAt))
      g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
    g.update(FIXED_STEP);
    if (g.wellbeing) for (const c of g.couriers) troughs[c.id] = Math.min(troughs[c.id], c.wellbeing.satisfaction);
  }
  const result = { seed, mode, ruleset, generated: g.deliveries.length, completed: g.completed, target: g.config.target,
    missed: g.failed, outcome: g.outcome, reputation: Math.round(g.reputation * 10) / 10,
    warnings: g.dispatchLog.filter(e => e.action === 'rider-warning').length,
    departures: g.dispatchLog.filter(e => e.action === 'rider-left').length,
    riders: g.couriers.map(c => ({ name: c.name, completed: c.completed, breaks: c.breaks,
      ...(g.wellbeing ? { satisfaction: Math.round(c.wellbeing.satisfaction * 10) / 10,
        minimum: Math.round(troughs[c.id] * 10) / 10, offDuty: c.offDuty } : {}) })) };
  runs.push(result);
  console.log(JSON.stringify(result));
}
mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
writeFileSync(new URL('../reports/wellbeing-balance.json', import.meta.url), JSON.stringify({
  policy: 'Every five seconds, open-broadcast all waiting jobs by earliest deadline; take the legs upgrade. No assignments, invitations, bonuses, extensions, forecasts or speed changes.',
  caveats: 'Three deterministic seeds establish a bounded fairness comparison, not human enjoyment or all-seed acceptance.', runs
}, null, 2) + '\n');
