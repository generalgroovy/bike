import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodeInnerRing } from '../src/inner-ring-city.js';
import { BerlinPlaytest, FIXED_STEP } from '../src/game-berlin-playtest.js';

// Synthetic comparison, not a claim about human difficulty or enjoyment.
// One identical, deliberately ordinary dispatch policy is used for both rules:
// broadcast every waiting offer once a second, earliest deadline first; choose
// the speed upgrade. No assignments, teleports, bonuses or client extensions.
const city = decodeInnerRing(JSON.parse(readFileSync(new URL('../generated/berlin-city.json', import.meta.url))));
const args = process.argv.slice(2), seedArgs = args.filter(arg => !arg.startsWith('--'));
const cadence = Number(args.find(arg => arg.startsWith('--cadence='))?.split('=')[1] ?? 1);
if (!Number.isFinite(cadence) || cadence < 1 || cadence > 20) throw new Error('Cadence must be 1–20 seconds');
const seeds = seedArgs.length ? seedArgs : ['BERLIN-1', 'BERLIN-2', 'BERLIN-3'];
const runs = [];
for (const seed of seeds) for (const mode of ['training', 'standard']) for (const ruleset of ['berlin-dispatch-v6', 'berlin-dispatch-v7']) {
  const g = new BerlinPlaytest({ city, seed, mode, ruleset });
  g.dispatch({ type: 'pause', paused: false });
  for (let tick = 0; tick < 33000 && !g.gameOver; tick++) {
    if (g.upgradePending) g.dispatch({ type: 'upgrade', id: 'legs' });
    if (tick % Math.round(60 * cadence) === 0) for (const d of g.activeDeliveries().filter(d => d.status === 'waiting' && !d.called).sort((a, b) => a.deadlineAt - b.deadlineAt))
      g.dispatch({ type: 'radio', jobId: d.id, channel: 'open' });
    g.update(FIXED_STEP);
  }
  const result = { seed, mode, ruleset, generated: g.deliveries.length, completed: g.completed, target: g.config.target,
    missed: g.failed, outcome: g.outcome, reputation: Math.round(g.reputation * 10) / 10,
    multiJobAcceptances: g.deliveries.filter(d => d.claimedAt != null && d.planMode !== 'ready').length,
    scheduled: g.deliveries.filter(d => d.deliverAfter > d.createdAt).length,
    riders: g.couriers.map(c => ({ name: c.name, completed: c.completed, breaks: c.breaks })),
    peakQueue: g.runStats.peakActive, meanDistance: Math.round(g.deliveries.reduce((sum, d) => sum + d.plannedDistance, 0) / g.deliveries.length) };
  runs.push(result);
  console.log(JSON.stringify(result));
}
mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
writeFileSync(new URL(`../reports/demand-balance${cadence === 1 ? '' : `-cadence-${cadence}`}.json`, import.meta.url), JSON.stringify({
  policy: `Every ${cadence} second(s), open-broadcast all waiting jobs by earliest deadline; take the legs upgrade. No bonuses, invitations, extensions, predictions, assignments or speed changes.`,
  caveats: 'Fixed seeds and an automatic policy establish bounded comparisons, not human fun, full fairness, or all-seed acceptance.', runs
}, null, 2) + '\n');
