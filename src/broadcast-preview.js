// Read-only forecasts also support saved shifts from earlier rulesets.
export function forecastBroadcast(game, job, channel) {
  if (game.logistics) return game.broadcastForecast(job, channel);
  const probe = { ...job, called: true, channel };
  const feasibility = game.deliveryFeasibility(probe);
  const rows = game.couriers.map(rider => {
    const fit = feasibility?.candidates.find(item => item.rider.id === rider.id);
    const score = rider.phase === 'idle' && rider.radioOn ? game.courierChoiceScore(rider, probe, false) : -Infinity;
    return { rider, score, eligible: score >= .3, reason: score >= .3 ? game.choiceReason(rider, probe) : 'Current work, rest or the deadline prevents acceptance.', finishIn: fit?.finishIn, margin: fit?.margin, mode: 'direct' };
  });
  const best = rows.filter(row => row.eligible).sort((a, b) => b.score - a.score)[0];
  return { rider: best?.rider ?? null, rows, reason: best?.reason ?? 'No likely volunteer. Improve the offer or allow the team to recover.' };
}

export function previewKey(job, channel, forecast) {
  return JSON.stringify([job.id, channel, job.status, job.preferredRiderId ?? null,
    job.reward, job.bonusPaid, job.deadlineAt, forecast.rider?.id ?? null]);
}
