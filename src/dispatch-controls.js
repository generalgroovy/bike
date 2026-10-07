import { RADIO_CHANNELS } from './game-data.js';

// One command path for the rail and inspector. UI forecasts never assign riders.
export function broadcastContract(game,id,channel,{resumeOnSuccess=false}={}){
  const delivery=game.deliveryById(id);
  if(!delivery||delivery.status!=='waiting'||delivery.deadlineAt<=game.elapsed||game.gameOver)return false;
  const changed=game.setChannel(id,channel);
  if(changed&&channel!=='off'&&resumeOnSuccess)game.paused=false;
  return changed;
}

export function broadcastChoice(game,delivery,id,insight){
  const channel=RADIO_CHANNELS[id],estimate=insight?.channels[id];
  if(!channel)return null;
  const used=game.radioUsed()-game.radioCost(delivery)+channel.cost;
  const available=delivery.status==='waiting'&&delivery.deadlineAt>game.elapsed&&!game.gameOver&&used<=game.radioSlots;
  const listeners=estimate?.listeners??0;
  const feedback=!available?(used>game.radioSlots?'Radio full': 'Contract unavailable')
    :listeners?`${listeners} may choose this`:(estimate?.consideringOther?'Riders considering other calls':estimate?.bestRider?'No clear preference':'No free listeners');
  return{available,active:delivery.called&&delivery.channel===id,label:`${channel.short} · ${channel.cost} slot${channel.cost===1?'':'s'}`,feedback};
}

// Stable controls expose both the price and the reason an action is unavailable.
export function renderDispatchTools(root,game,delivery){
  const state=game.deliveryToolState(delivery.id);
  const reasons={
    sweeten:delivery.sweetened?'Bonus already added':game.cash<5?'Need €5':'Costs €5',
    extend:delivery.extended?'Time already added':game.dispatchFocus<1?'Need 1 focus':'Costs 1 focus',
    rebroadcast:!delivery.called?'Broadcast first':game.dispatchFocus<1?'Need 1 focus':'Costs 1 focus',
  };
  for(const button of root.querySelectorAll('[data-tool]')){
    const id=button.dataset.tool;
    button.disabled=!state?.[id];
    const reason=delivery.status!=='waiting'?'Job already taken':reasons[id];
    const detail=button.querySelector('small');
    if(detail.textContent!==reason)detail.textContent=reason;
  }
}

export function renderBroadcastChoices(root,game,delivery,insight){
  root.hidden=delivery.status!=='waiting';
  if(root.hidden)return;
  for(const button of root.querySelectorAll('[data-broadcast]')){
    const id=button.dataset.broadcast;
    if(id==='off'){
      button.hidden=!delivery.called;
      button.setAttribute('aria-label',`Remove ${delivery.id.toUpperCase()} from radio`);
      continue;
    }
    const choice=broadcastChoice(game,delivery,id,insight);
    button.disabled=!choice.available;
    button.setAttribute('aria-pressed',String(choice.active));
    button.setAttribute('aria-label',`${choice.label}. ${choice.feedback}. Estimate, not a reservation.`);
    const title=button.querySelector('strong'),detail=button.querySelector('small');
    if(title.textContent!==choice.label)title.textContent=choice.label;
    if(detail.textContent!==choice.feedback)detail.textContent=choice.feedback;
  }
}
