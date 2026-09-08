// Counterfactual descriptions only: no RNG, clock advance, claim or reservation.
export const CHANNEL_EFFECTS=Object.freeze({
  open:'One radio slot. All listening riders judge the original offer.',
  local:'One radio slot. Favors nearby pickups; riders farther away find it less attractive.',
  priority:'Two radio slots. Adds attention, with one less slot for other work. Travel time is unchanged.'
});
export function decisionBrief(game,d,feasibility=game.deliveryFeasibility(d)) {
  if(!d||d.status!=='waiting')return null;
  const channel=d.channel??'open',probe={...d,called:true,channel};
  const rows=game.couriers.map(rider=>{
    const fit=feasibility?.candidates.find(c=>c.rider.id===rider.id),ready=rider.phase==='idle'&&rider.radioOn;
    const score=ready?game.courierChoiceScore(rider,probe,false):-Infinity;
    let state='pass',detail='Would pass: not enough time on the current routes.';
    if(!ready){state='occupied';detail=rider.phase==='break'?'Resting, with the radio off.':'Committed to current work first.';}
    else if(score>=.3){state='possible';detail=`Could consider: ${game.choiceReason(rider,probe)}.`;}
    else if(Number.isFinite(score))detail='Waiting for an offer that fits better.';
    if(rider.deliberation)detail=`Considering ${rider.deliberation.deliveryId.toUpperCase()} · ${rider.deliberation.reason}.`;
    return{rider,state,detail,finishIn:fit?.finishIn??Infinity,margin:fit?.margin??-Infinity,handlingIn:fit?.handlingIn??0};
  });
  const channels=Object.keys(CHANNEL_EFFECTS).map(id=>{
    const eligible=game.couriers.filter(c=>c.phase==='idle'&&c.radioOn&&game.courierChoiceScore(c,{...d,called:true,channel:id},false)>=.3).length;
    return{id,eligible,detail:CHANNEL_EFFECTS[id]};
  });
  return{rows,channels,extension:game.extensionOffer(d),channel};
}

export function riderActivity(game,rider) {
  const job=game.deliveryById(rider.deliveryId),remaining=Math.max(0,(rider.handoffUntil??game.elapsed)-game.elapsed);
  if(rider.phase==='loading')return{label:'Collecting',detail:`${job.id.toUpperCase()} · ${Math.ceil(remaining)}s to secure the cargo`};
  if(rider.phase==='handover')return{label:'Handing over',detail:`${job.id.toUpperCase()} · ${Math.ceil(remaining)}s for the handoff`};
  if(rider.phase==='break')return{label:'On a break',detail:'Radio off · recovery comes before the next job'};
  return null;
}
