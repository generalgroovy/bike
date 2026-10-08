/** Read-only language for the desk. An estimate never promises a volunteer. */
export function timingAdvice(feasibility) {
  if (!feasibility?.best || !Number.isFinite(feasibility.best.finishIn))
    return { state: 'risk', label: 'No finish estimate', detail: 'No courier can currently reach this job within the estimate window.' };
  const { best, margin } = feasibility;
  const busy=best.mode==='next'||best.mode==='on the way';
  const state = margin < 1.5 ? 'risk' : margin < 18 ? 'tight' : busy||!best.availableNow ? 'future' : 'safe';
  const label = state==='future'&&best.mode==='on the way'?'Fits along the way':{ risk: 'Too little time', tight: 'Tight window', future: 'After current work', safe: 'Time to spare' }[state];
  const detail = state === 'risk' ? 'Priority and bonuses cannot extend the deadline.' : busy ? 'A rider could add this job while keeping current commitments. Preview a broadcast to compare.' : !best.availableNow ? 'Needs a rider to finish work or rest. Estimate only.' : 'Estimate only; couriers still choose.';
  return { state, label, detail, finishIn: best.finishIn, margin };
}
