import { previewKey } from './broadcast-preview.js';

const prompt = (step, title, detail, action = null, jobId = null) => ({ step, title, detail, action, jobId });
const label = job => String(job.id).toUpperCase();

function offerCoach(job, draft, forecast) {
  if (draft?.jobId !== job.id) return prompt('preview', 'First, a quiet look', `${label(job)} is off-air. Click All riders once to inspect the likely rider, finish buffer and load. Nothing is sent yet.`, 'preview', job.id);
  if (forecast && previewKey(job, draft.channel, forecast) !== draft.key) return prompt('review', 'The outlook moved', 'The radio is unchanged. Click the same option to refresh the preview, then review it before sending.', 'confirm', job.id);
  if (forecast && (!forecast.rider || forecast.rider.offDuty)) {
    if (forecast.available === false) return prompt('no-fit', 'The radio is full', 'Withdraw another call or wait for a rider to accept it. This preview has not changed any live call.', null, job.id);
    const possible = (forecast.rows ?? []).filter(row => row.eligible && !row.rider?.offDuty);
    if (possible.some(row => row.competingJob)) return prompt('no-fit', 'Other calls have their ear', 'Suitable riders prefer other live offers. Let them choose, or use Tailor offer to change this parcel’s appeal.', null, job.id);
    if (possible.length) return prompt('no-fit', 'A fit, but no taker yet', 'Try an invitation or bonus in Tailor offer. A better offer can interest a rider; acceptance is still their choice.', null, job.id);
    return prompt('no-fit', 'The bike has limits', 'No rider can fit this route now. Compare another parcel or the client extension; a bonus cannot fix cargo limits.', null, job.id);
  }
  const choice = forecast?.rider?.name ?? 'The rider';
  const cost = draft.channel === 'priority' ? ' Priority uses two radio slots.' : '';
  return prompt('confirm', job.called ? 'Your current call stays live' : 'Still only a preview',
    `Click the same radio option again to ${job.called ? 'change the call' : 'send it'}. ${choice} still decides.${cost}`, 'confirm', job.id);
}

function ridingCoach(game, job, rider) {
  if (!rider || rider.offDuty) return null;
  if (game.paused) return prompt('start', 'Wheels paused', `${rider.name} accepted ${label(job)}. Resume the clock to continue the tour; its deadline resumes too.`, 'start', job.id);
  if (rider.deliveryId !== job.id) return prompt('riding', 'One bike, more promises',
    job.pickedUp ? `${rider.name} has ${label(job)} on board. Its weight uses capacity while other stops come first.`
      : `${label(job)} is queued with ${rider.name} after another stop. Acceptance frees radio space; collection still lies ahead.`, null, job.id);
  const phases = {
    pickup: ['The call did its job', `${rider.name} chose ${label(job)} and is riding to pickup. Its radio space is free; you can prepare another offer.`],
    loading: ['Doorbells take time', `${rider.name} is collecting ${label(job)}. Handling counts toward the deadline; no extra click is needed.`],
    dropoff: ['Mind the promises', `${rider.name} has ${label(job)} on the bike. Adding a parcel can change this tour’s finish time; check the preview first.`],
    'waiting-window': ['At the right time', `Delivery opens in ${Math.max(0, Math.ceil((job.deliverAfter ?? game.elapsed) - game.elapsed))}s. ${rider.name} already has ${label(job)}; its weight uses capacity until handover.`],
    handover: ['One last handoff', `${rider.name} is handing over ${label(job)}. The delivery counts when the handoff finishes; the deadline still matters.`]
  };
  const phase = phases[rider.phase];
  return phase ? prompt('riding', ...phase, null, job.id) : null;
}

// Presentation only. Reuse the desk's estimates instead of routing, looking up
// cached entities, choosing a rider, or advancing a separate tutorial clock.
// Actions identify controls to focus; they are never simulation commands.
export function firstShiftCoach(game, { draft = null, selectedJob = null, feasibility = null, forecast = null } = {}) {
  if (!game || game.mode !== 'training' || game.completed > 0 || game.gameOver || game.upgradePending) return null;
  const riders = game.couriers ?? [];
  if (!riders.some(rider => !rider.offDuty)) return null;
  // An imminent departure or deadline already has its own actionable alert.
  if (!game.closing && riders.some(rider => !rider.offDuty && rider.wellbeing?.warningRemaining != null)) return null;
  const jobs = (game.deliveries ?? []).filter(job => ['waiting', 'claimed'].includes(job.status));
  const waiting = jobs.filter(job => job.status === 'waiting');
  if (waiting.some(job => {
    const best = feasibility?.get(job.id)?.best;
    return best && best.margin <= 12 || job.deadlineAt - game.elapsed <= 12;
  })) return null;
  const selected = jobs.find(job => job.id === (selectedJob?.id ?? game.selectedDeliveryId));
  const eligible = job => {
    if (!feasibility?.has(job.id)) return true; // Missing estimates make no promise of a fit.
    const candidates = feasibility.get(job.id)?.candidates ?? [feasibility.get(job.id)?.best];
    return candidates.some(candidate => candidate && !candidate.rider?.offDuty && candidate.margin >= 0 && candidate.availableNow !== false);
  };

  // Follow what the player is inspecting, including a second offer or a live
  // channel change. Another rider's first tour must not swallow this preview.
  if (selected?.status === 'waiting' && draft?.jobId === selected.id) return offerCoach(selected, draft, forecast);
  if (selected?.status === 'waiting' && !selected.called && eligible(selected)) return offerCoach(selected, null, null);
  const claimed = selected?.status === 'claimed' ? selected : !selected ? jobs.find(job => job.status === 'claimed') : null;
  if (claimed) return ridingCoach(game, claimed, riders.find(rider => rider.id === claimed.courierId));
  const live = selected?.called ? selected : !selected ? waiting.find(job => job.called) : null;
  if (live) return game.paused
    ? prompt('start', 'On air · clock stopped', `${label(live)} is broadcast. ${game.tick === 0 ? 'Start shift' : 'Resume'} so riders can consider it. Deadlines ${game.tick === 0 ? 'start' : 'resume'} too.`, 'start', live.id)
    : prompt('choosing', 'Give them a moment', `${label(live)} is on air. Riders compare live offers and decide for themselves. You can inspect another parcel while they choose.`, null, live.id);

  if (game.closing) return null;
  const next = waiting.find(eligible);
  if (!next) {
    if (waiting.length) return prompt('no-fit', 'Room to rethink', 'No waiting offer has an available route. Inspect rider limits or the client extension; a bonus cannot fix capacity.', null, selected?.id ?? null);
    return prompt('arrivals', game.paused ? 'The next call needs a clock' : 'A moment between calls', game.paused ? `${game.tick === 0 ? 'Start shift' : 'Resume'} to let new offers arrive. Deadlines move with the clock.` : 'New work arrives while the clock runs. Keep an eye on the team between tours.', game.paused ? 'start' : null);
  }
  return prompt('select', game.deliveries.some(job => job.status === 'failed') ? 'Another parcel, a fresh chance' : 'Your first call', `Open ${label(next)}. Check its finish buffer before you offer it; every parcel’s deadline keeps running off-air.`, 'select', next.id);
}
