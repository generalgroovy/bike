import { Game } from './game-core.js';

const baseRespond=Game.prototype.respondToCityEvent;

function deliveryTouchesEvent(game,delivery,event){
  const path=delivery?.plannedPath?.length?delivery.plannedPath:game.routeBetween(delivery.pickupId,delivery.dropoffId);if(!path?.length)return false;
  for(let i=1;i<path.length;i++){const edge=game.edgeByIds(path[i-1],path[i]);if(edge&&event.edgeIds?.includes(edge.id))return true;}
  return false;
}

Game.prototype.cityEventResponseOptions=function(){
  const ev=this.currentEvent;if(!ev||!['forecast','active'].includes(ev.state))return[];
  const primary={id:'prepare',label:ev.kind==='demand'?(ev.state==='forecast'?'CAPACITY PLAN':'STAGGER CLIENTS'):(ev.state==='forecast'?'PRE-BRIEF':'DETOUR'),costType:'focus',cost:1,available:!ev.prepared&&this.dispatchFocus>=1,used:Boolean(ev.prepared)};
  if(ev.kind==='demand'){
    const used=Boolean(ev.surgePay),available=!used&&this.cash>=8;
    return[primary,{id:'surge-pay',label:'SURGE PAY',costType:'cash',cost:8,available,used,desc:'Pay an event-wide premium: +€5 and extra rider appeal for each surge contract.'}];
  }
  const affected=this.activeDeliveries().filter(d=>d.status==='waiting'&&deliveryTouchesEvent(this,d,ev)&&!d.eventBuffered),used=Boolean(ev.clientBuffer),available=!used&&this.dispatchFocus>=1&&affected.length>0;
  return[primary,{id:'client-buffer',label:'BUFFER CLIENTS',costType:'focus',cost:1,available,used,affected:affected.length,desc:'Protect currently exposed contracts with +16s client tolerance; streets stay slow.'}];
};

Game.prototype.respondToCityEvent=function(mode='prepare'){
  if(mode==='prepare')return baseRespond.call(this);
  const ev=this.currentEvent;if(!ev||!['forecast','active'].includes(ev.state))return false;
  if(mode==='surge-pay'&&ev.kind==='demand'){
    if(ev.surgePay||this.cash<8)return false;this.cash-=8;ev.surgePay=true;this.runStats.toolsUsed+=1;this.runStats.eventAlternatives=(this.runStats.eventAlternatives??0)+1;
    for(const d of this.activeDeliveries())if(d.eventId===ev.id&&d.status==='waiting'&&!d.eventSurgePaid){d.reward+=5;d.bonusAppeal=(d.bonusAppeal??0)+.28;d.eventSurgePaid=true;this.invalidateDeliberations(d.id);}
    for(const c of this.availableRiders())c.decisionAt=Math.min(c.decisionAt,this.elapsed+.08);
    this.logDispatch('event-surge-pay',null,{event:ev.title,place:ev.place,cost:8});this.flash(`SURGE PAY · ${ev.place} event work carries a premium`,5);return true;
  }
  if(mode==='client-buffer'&&ev.kind==='route'){
    const affected=this.activeDeliveries().filter(d=>d.status==='waiting'&&deliveryTouchesEvent(this,d,ev)&&!d.eventBuffered);if(ev.clientBuffer||!affected.length||!this.spendFocus(1))return false;ev.clientBuffer=true;this.runStats.eventAlternatives=(this.runStats.eventAlternatives??0)+1;
    for(const d of affected){d.deadlineAt+=16;d.eventBuffered=true;}
    this.logDispatch('event-client-buffer',null,{event:ev.title,place:ev.place,jobs:affected.length});this.flash(`CLIENT BUFFER · ${affected.length} exposed contract${affected.length===1?'':'s'} +16s`,5);return true;
  }
  return false;
};
