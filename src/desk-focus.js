// A single, read-only lead for the current desk. Existing feasibility estimates
// are reused; claimed jobs use the read-only ETA. This never advances time or
// chooses riders.
const seconds = value => `${Math.max(0, Math.ceil(value))}s`;
const label = job => job.id.toUpperCase();
const focus = (id, tone, title, detail, jobId = null, cue = null) => ({ id, tone, title, detail, jobId, cue });

function riderWaitFocus(game, waiting, feasibility) {
  if (!game.wellbeing || game.closing) return null;
  const row = game.couriers.map(rider => ({ rider, wellbeing: game.riderWellbeing(rider) }))
    .filter(({ rider, wellbeing: w }) => w && !w.offDuty && w.idleSeconds > 0 && ['restless', 'at-risk'].includes(w.band) && rider.phase === 'idle' && !game.riderJobs(rider).length)
    .sort((a, b) => (a.wellbeing.leaveIn ?? Infinity) - (b.wellbeing.leaveIn ?? Infinity) || a.wellbeing.satisfaction - b.wellbeing.satisfaction)[0];
  if (!row) return null;
  const { rider, wellbeing: w } = row;
  const job = waiting.find(d => feasibility.get(d.id)?.candidates?.some(c => c.rider.id === rider.id && c.margin >= 0 && c.availableNow !== false));
  const leaving = Number.isFinite(w.leaveIn);
  const title = leaving ? `${rider.name} · ${seconds(w.leaveIn)} before leaving` : `${rider.name} has been waiting`;
  const detail = job ? job.preferredRiderId === rider.id && job.called
    ? `${label(job)} already invites ${rider.name}. Compare the fee and route; they still decide whether to take it.`
    : `${label(job)} fits ${rider.name}'s route and load. Try a personal invitation, then preview the broadcast. Acceptance is their choice.`
    : 'No waiting parcel fits this rider now. Inspect their patience and the next arrivals; a bonus cannot fix route or cargo limits.';
  return { ...focus(`rider-wait:${rider.id}`, leaving ? 'urgent' : 'watch', title, detail, job?.id ?? null), riderId: rider.id, leaving };
}

export function deskFocus(game, feasibility = new Map()) {
  if (game.gameOver) return game.outcome === 'team-left'
    ? focus('finished', 'watch', 'The team finished for today', 'Every rider signed off. Start a new shift with the full team; the review shows when patience ran out.')
    : focus('finished', 'calm', 'Shift complete', 'Your decisions are in the shift review.');
  const jobs = game.activeDeliveries();
  const waiting = jobs.filter(d => d.status === 'waiting').sort((a, b) => a.deadlineAt - b.deadlineAt || a.id.localeCompare(b.id));
  const remaining = Math.max(0, game.config.target - game.completed);
  if (game.upgradePending) return focus('upgrade', 'opportunity', 'A little breathing room', 'Choose the team upgrade while the clock is stopped.');
  const riderWait = riderWaitFocus(game, waiting, feasibility);
  if (riderWait?.leaving) return riderWait;

  // Surface a decision that is still available before passive status or praise.
  const tight = waiting.find(d => {
    const best = feasibility.get(d.id)?.best;
    return best && best.margin <= 12;
  });
  if (tight) {
    const best = feasibility.get(tight.id).best, extension = game.extensionOffer?.(tight);
    return focus(`tight:${tight.id}`, 'urgent', `${label(tight)} · ${seconds(best.margin)} estimated buffer`,
      extension?.available ? `A client call buys ${seconds(extension.seconds)} for €${extension.fee} less pay. ${tight.called ? 'Protect the live call’s deadline.' : 'Compare before sending.'}` : `Compare the ${tight.called ? 'live call’s' : 'offered'} route. More attention does not make the bike faster.`, tight.id);
  }
  if (riderWait) return riderWait;
  const full = game.radioUsed() >= game.radioSlots;
  if (full && waiting.some(d => !d.called)) return focus('radio-full', 'watch', 'The radio is full',
    'Inspect a live call to withdraw it, or wait for a rider to accept.', waiting.find(d => d.called)?.id ?? waiting[0].id);

  const stranded = waiting.find(d => !feasibility.get(d.id)?.best && feasibility.has(d.id) && d.deadlineAt - game.elapsed <= 25);
  if (stranded) return focus(`no-fit:${stranded.id}`, 'watch', `${label(stranded)} · no route fits now`,
    'Inspect rider limits and the client extension. A bonus cannot fix cargo capacity.', stranded.id);

  const pair = waiting.map(d => ({ d, match: feasibility.get(d.id)?.candidates?.find(c => c.mode === 'on the way') }))
    .find(({ d, match }) => !d.called && match);
  if (pair) return focus(`pair:${pair.d.id}:${pair.match.rider.id}`, 'opportunity', `A detour worth a look`,
    `${pair.match.rider.name} could fit ${label(pair.d)} along the way. Compare the effect on their first delivery.`, pair.d.id, 'opportunity');

  const scheduled = waiting.find(d => !d.called && d.deliverAfter > game.elapsed && feasibility.get(d.id)?.best);
  if (scheduled) return focus(`window:${scheduled.id}`, 'opportunity', 'Collect now, deliver later',
    `${label(scheduled)} opens in ${seconds(scheduled.deliverAfter - game.elapsed)}. Carrying it early uses load space.`, scheduled.id);

  const unsent = waiting.find(d => !d.called && feasibility.get(d.id)?.best);
  if (unsent) return focus(`offer:${unsent.id}`, 'opportunity', `${label(unsent)} · ready for an offer`,
    game.tick === 0 ? 'Preview a broadcast, confirm it, then start the clock.' : 'Compare a rider’s route and remaining energy before broadcasting.', unsent.id);

  const pressured = jobs.filter(d => d.status === 'claimed').map(d => {
    const rider = game.courierById(d.courierId);
    const eta = rider ? game.logistics ? game.jobETA(rider, d) : game.courierETA(rider) : Infinity;
    return { d, rider, margin: d.deadlineAt - game.elapsed - eta };
  }).filter(row => row.margin <= 8).sort((a, b) => a.margin - b.margin)[0];
  if (pressured) return focus(`riding-tight:${pressured.d.id}`, 'watch', `${label(pressured.d)} · a close finish`,
    `${pressured.rider?.name ?? 'The rider'} is committed. ${pressured.margin < 0 ? 'Currently estimated late.' : `Only ${seconds(pressured.margin)} of estimated buffer.`} Follow the route.`, pressured.d.id);

  if (waiting.some(d => d.called)) return focus('on-air', 'calm', game.paused ? 'Calls ready · clock stopped' : 'The riders are choosing',
    game.paused ? 'Start or resume to hear their replies.' : 'Each rider compares every live offer. Acceptance frees its radio slots.', waiting.find(d => d.called).id);
  if (game.closing) return focus('closing', remaining ? 'watch' : 'calm', remaining ? `${remaining} more to reach the target` : 'Bring the last parcels home',
    'No new arrivals. Every unfinished job still needs its delivery.', jobs[0]?.id ?? null);
  if (remaining === 1) return focus('one-more', 'opportunity', 'One delivery from the target', 'Keep the remaining promises too; missed deadlines still count.', jobs[0]?.id ?? null);
  if (game.cleanChain > 1) return focus('chain', 'calm', `${game.cleanChain} clean deliveries in a row`, 'Keep room on the radio for the next good match.', jobs[0]?.id ?? null);
  return focus('flow', 'calm', jobs.length ? 'The city is in motion' : 'Room for the next call',
    jobs.length ? 'Follow a parcel or inspect a rider’s next stop.' : 'New work arrives while the clock runs.', jobs[0]?.id ?? null);
}
