import { previewKey } from './broadcast-preview.js';

const prompt = (step, title, detail, action = null, jobId = null) => ({ step, title, detail, action, jobId });
const label = job => String(job.id).toUpperCase();

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
  const claimed = jobs.find(job => job.status === 'claimed');
  const live = waiting.find(job => job.called);

  if (claimed) {
    const rider = riders.find(item => item.id === claimed.courierId && !item.offDuty);
    if (!rider) return null;
    if (game.paused) return prompt('start', 'Let the wheels turn', `${rider.name} accepted ${label(claimed)}. Resume the clock to continue the tour.`, 'start', claimed.id);
    if (rider.deliveryId !== claimed.id) return prompt('riding', 'A place on the tour', `${rider.name} accepted ${label(claimed)} ${claimed.pickedUp ? 'and has it on board' : 'after another stop'}. Follow the planned stops; the rider keeps choosing their work.`, null, claimed.id);
    const phases = {
      pickup: ['Follow the wheels', `${rider.name} chose ${label(claimed)} and is riding to pickup. Its radio space is free for another offer.`],
      loading: ['The first handoff', `${rider.name} is collecting ${label(claimed)}. Handling takes time too; the deadline is still running.`],
      dropoff: ['A parcel, a promise', `${rider.name} has ${label(claimed)} on the bike. Follow the remaining route to delivery.`],
      'waiting-window': ['Waiting for the door', `${rider.name} has the parcel. Delivery opens in ${Math.max(0, Math.ceil((claimed.deliverAfter ?? game.elapsed) - game.elapsed))}s; its weight still uses capacity.`],
      handover: ['One last handoff', `${rider.name} is handing over ${label(claimed)}. The delivery counts when the handoff finishes.`]
    };
    const phase = phases[rider.phase];
    return phase ? prompt('riding', ...phase, null, claimed.id) : null;
  }

  if (live) return game.paused
    ? prompt('start', game.tick === 0 ? 'Let the city move' : 'Put the clock back on', `${label(live)} is on air. ${game.tick === 0 ? 'Start' : 'Resume'} the clock so riders can consider the offer.`, 'start', live.id)
    : prompt('choosing', 'The choice is theirs', `${label(live)} is on air. Riders compare the live offers; a broadcast is an invitation, not an assignment.`, null, live.id);

  if (game.closing) return null;
  const eligible = job => {
    if (!feasibility?.has(job.id)) return true; // Missing estimates make no promise of a fit.
    const candidates = feasibility.get(job.id)?.candidates ?? [feasibility.get(job.id)?.best];
    return candidates.some(candidate => candidate && !candidate.rider?.offDuty && candidate.margin >= 0 && candidate.availableNow !== false);
  };
  const next = selected?.status === 'waiting' && eligible(selected) ? selected : waiting.find(eligible);
  if (!next) {
    if (waiting.length) return prompt('no-fit', 'Room to rethink', 'No waiting offer currently has an available route. Inspect rider limits and the client extension; a bonus cannot fix capacity.', null, selected?.id ?? null);
    return prompt('arrivals', game.paused ? 'The next call needs a clock' : 'A moment between calls', game.paused ? 'Resume to let the next offer arrive.' : 'New work arrives while the clock runs. Keep an eye on the team.', game.paused ? 'start' : null);
  }
  if (next.id !== selected?.id) return prompt('select', game.deliveries.some(job => job.status === 'failed') ? 'Another parcel, a fresh chance' : 'Your first call', `Open ${label(next)} and compare its route, load and finish estimate.`, 'select', next.id);
  if (draft?.jobId === next.id) {
    if (forecast && previewKey(next, draft.channel, forecast) !== draft.key) return prompt('review', 'The outlook changed', 'Click the same radio option to refresh the preview before you commit.', 'confirm', next.id);
    if (forecast && !forecast.rider) return prompt('no-fit', 'No likely volunteer yet', 'Compare another offer or tailor this one. A stronger signal cannot fix route or cargo limits.', null, next.id);
    return prompt('confirm', 'Make the call', 'Check the likely rider and consequences, then click the same radio option again. The rider still decides.', 'confirm', next.id);
  }
  return prompt('preview', 'Hear the possibilities', 'Click All riders to preview who might take this parcel and what it would cost their tour.', 'preview', next.id);
}
