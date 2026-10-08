// Shared presentation of existing simulation state. Reading this never dispatches work.
export function jobState(game, job) {
  if (!job) return null;
  const rider = game.courierById(job.courierId);
  if (job.status === 'completed') return { id: 'delivered', label: 'Delivered', step: 3, terminal: true, detail: `${rider?.name ?? 'Your courier'} delivered this job. €${job.reward} earned.` };
  if (job.status === 'failed') return { id: 'missed', label: 'Missed deadline', step: -1, terminal: true, detail: 'The deadline passed before delivery. This job is closed; choose the next offer.' };
  if (job.status === 'claimed') {
    if(game.logistics){
      if(rider?.deliveryId!==job.id)return{ id:job.pickedUp?'carried':'queued',label:job.pickedUp?'On the bike':'Next pickup',step:job.pickedUp?2:1,terminal:false,detail:`${rider?.name??'A courier'} accepted this extra job. ${job.pickedUp?'Its weight uses carrying capacity.':'Pickup fits after the current stop.'}` };
      if(rider?.phase==='waiting-window')return{id:'waiting-window',label:'Awaiting delivery window',step:2,terminal:false,detail:`Collected by ${rider.name}. Handover opens in ${Math.max(0,Math.ceil(job.deliverAfter-game.elapsed))}s; the parcel still uses carrying capacity.`};
    }
    const phases = { pickup: ['pickup', 'To pickup', 1], loading: ['loading', 'Collecting', 1], dropoff: ['riding', 'To delivery', 2], handover: ['handover', 'Handing over', 2] };
    const [id, label, step] = phases[rider?.phase] ?? phases.dropoff;
    return { id, label, step, terminal: false, detail: `${rider?.name ?? 'A courier'} chose this job. Its radio space is free; you can prepare another offer.` };
  }
  return job.called
    ? { id: 'on-air', label: 'On air', step: 0, terminal: false, detail: `${job.channel.toUpperCase()} · ${game.radioCost(job)} radio ${game.radioCost(job) === 1 ? 'slot' : 'slots'} in use. Listening riders decide whether to take it.` }
    : { id: 'waiting', label: 'Not broadcast', step: 0, terminal: false, detail: 'Choose who hears this offer. The deadline keeps running until delivery, even off the radio.' };
}

export function deskState(game) {
  if (game.gameOver) return { id: 'finished', label: 'Shift complete', detail: 'Review your deliveries and decisions.' };
  if (game.upgradePending) return { id: 'upgrade', label: 'Choose an upgrade', detail: 'Time is stopped while you choose.' };
  if (game.paused) return game.tick === 0
    ? { id: 'ready', label: 'Ready', detail: 'Prepare an offer, then start the clock.' }
    : { id: 'paused', label: 'Paused', detail: 'Time is stopped. You can still change offers.' };
  return game.closing
    ? { id: 'closing', label: 'Closing', detail: 'No new jobs. Finish the work already on the desk.' }
    : { id: 'running', label: 'Live', detail: 'Deadlines and riders are moving.' };
}
