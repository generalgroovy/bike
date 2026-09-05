import { Game } from './game-core.js';
import { RADIO_CHANNELS } from './game-data.js';

const fitLabel=score=>score>=2.15?'STRONG':score>=1.45?'GOOD':score>=.85?'FAIR':'WEAK';
const slackLabel=margin=>!Number.isFinite(margin)?'NO VIABLE PATH':margin<0?`${Math.round(Math.abs(margin))}s LATE`:margin<18?`${Math.round(margin)}s SLACK`:`${Math.round(margin)}s SLACK`;

function channelRanking(game,delivery,channelId){
  const probe={...delivery,called:true,channel:channelId};
  return game.availableRiders().map(rider=>({rider,score:game.courierChoiceScore(rider,probe,false)})).filter(item=>Number.isFinite(item.score)).sort((a,b)=>b.score-a.score);
}
function riderStateKey(game){return game.couriers.map(r=>`${r.id}:${r.phase}:${r.radioOn?1:0}:${r.nodeId}:${r.pathIndex}:${Math.round(r.x/8)}:${Math.round(r.y/8)}:${Math.round((r.fatigue??0)*20)}:${r.deliveryId??''}:${r.deliberation?.deliveryId??''}`).join(';');}
function insightKey(game,d){const ev=game.currentEvent;return`${Math.floor(game.elapsed*5)}|${game.cityLevel}|${game.dispatchFocus}|${game.cash}|${game.radioUsed()}|${ev?.id??''}:${ev?.state??''}:${ev?.advisory?1:0}|${d.id}:${d.status}:${d.called?1:0}:${d.channel??''}:${d.pickedUp?1:0}:${Math.round(d.deadlineAt*5)}:${d.reward}:${d.sweetened?1:0}:${d.extended?1:0}:${Math.round((d.rebroadcastUntil??0)*5)}|${riderStateKey(game)}`;}

Game.prototype.deliveryDispatchInsight=function(delivery){
  if(!delivery)return null;
  const cache=this._dispatchInsightCache??(this._dispatchInsightCache=new Map()),key=insightKey(this,delivery),cached=cache.get(delivery.id);if(cached?.key===key)return cached.value;
  const feasibility=delivery.status==='waiting'?this.deliveryFeasibility?.(delivery,{horizon:240}):null;
  const channels={};
  for(const id of Object.keys(RADIO_CHANNELS)){
    const ranking=channelRanking(this,delivery,id),best=ranking[0]??null;
    channels[id]={id,cost:RADIO_CHANNELS[id].cost,bestRider:best?.rider??null,score:best?.score??-Infinity,fit:best?fitLabel(best.score):'NONE'};
  }
  const current=delivery.called?channels[delivery.channel]:null,bestChannel=Object.values(channels).filter(item=>item.bestRider).sort((a,b)=>b.score-a.score)[0]??null;
  const deliberating=this.couriers.filter(rider=>rider.deliberation?.deliveryId===delivery.id).length;
  let recommendation={action:'HOLD',reason:'Keep bandwidth free until this contract needs attention.'};
  if(delivery.status==='claimed')recommendation={action:'OBSERVE',reason:'A rider already committed; protect the rest of the desk.'};
  else if(delivery.status==='waiting'){
    if(feasibility?.state==='risk'&&!delivery.extended&&this.dispatchFocus>0)recommendation={action:'CLIENT +20s',reason:'Current projected finish misses the deadline.'};
    else if(delivery.called&&deliberating===0&&this.dispatchFocus>0&&this.elapsed-(delivery.firstCalledAt??this.elapsed)>4)recommendation={action:'REBROADCAST',reason:'The call is live but no listening rider is actively considering it.'};
    else if(!delivery.called&&bestChannel){
      const open=channels.open,local=channels.local,priority=channels.priority;
      if(local.bestRider&&local.score>open.score+.18)recommendation={action:'LOCAL',reason:`Local signal best matches ${local.bestRider.name} without extra bandwidth.`};
      else if((feasibility?.state==='tight'||feasibility?.state==='risk')&&priority.bestRider)recommendation={action:'PRIORITY',reason:`Deadline pressure justifies stronger attention from ${priority.bestRider.name}.`};
      else recommendation={action:'OPEN',reason:open.bestRider?`${open.bestRider.name} already has a workable neutral fit.`:'No free rider is listening yet; preserve options.'};
    }else if(delivery.called&&current?.bestRider)recommendation={action:delivery.channel.toUpperCase(),reason:`${current.bestRider.name} is the strongest current listener.`};
  }
  const best=feasibility?.best??null,value={state:feasibility?.state??(delivery.status==='claimed'?'claimed':'unknown'),label:feasibility?.label??(delivery.status==='claimed'?'COMMITTED':'—'),margin:feasibility?.margin??null,slack:slackLabel(feasibility?.margin),bestFinisher:best?.rider??null,channels,recommendation,deliberating};
  cache.set(delivery.id,{key,value});if(cache.size>64)for(const id of cache.keys())if(!this.deliveryById(id)||!this.activeDeliveries().some(d=>d.id===id))cache.delete(id);return value;
};

Game.prototype.riderDispatchInsight=function(rider,{limit=3}={}){
  if(!rider)return null;
  const calls=this.calledDeliveries().map(delivery=>({delivery,score:this.courierChoiceScore(rider,delivery,false)})).filter(item=>Number.isFinite(item.score)).sort((a,b)=>b.score-a.score).slice(0,limit);
  return{available:rider.phase==='idle'&&rider.radioOn,energy:Math.max(0,Math.min(1,1-rider.fatigue)),calls:calls.map(item=>({delivery:item.delivery,fit:fitLabel(item.score),reason:this.choiceReason(rider,item.delivery)})),current:rider.deliveryId?this.deliveryById(rider.deliveryId):null};
};