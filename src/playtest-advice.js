/** Read-only language for the desk. An estimate never promises a volunteer. */
export function timingAdvice(feasibility) {
  if (!feasibility?.best || !Number.isFinite(feasibility.best.finishIn))
    return { state: 'risk', label: 'No finish estimate', detail: 'No courier can currently reach this job within the estimate window.' };
  const { best, margin } = feasibility;
  const state = margin < 1.5 ? 'risk' : margin < 18 ? 'tight' : !best.availableNow ? 'future' : 'safe';
  const label = { risk: 'Too little time', tight: 'Tight window', future: 'After current work', safe: 'Time to spare' }[state];
  const detail = state === 'risk' ? 'Priority and bonuses cannot extend the deadline.' : !best.availableNow ? 'Needs a rider to finish work or rest. Estimate only.' : 'Estimate only; couriers still choose.';
  return { state, label, detail, finishIn: best.finishIn, margin };
}
