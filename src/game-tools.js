import { Game } from './game-core.js';

Object.assign(Game.prototype,{
  spendFocus(amount=1){if(this.dispatchFocus<amount)return false;this.dispatchFocus=Math.max(0,this.dispatchFocus-amount);this.runStats.toolsUsed+=1;return true;},
  sweetenJob(id){const d=this.deliveryById(id);if(!d||d.status!=='waiting'||d.sweetened||this.cash<5)return false;this.cash-=5;d.reward+=9;d.bonusAppeal=(d.bonusAppeal??0)+.34;d.sweetened=true;this.runStats.toolsUsed+=1;this.invalidateDeliberations(d.id);for(const c of this.availableRiders())c.decisionAt=Math.min(c.decisionAt,this.elapsed+.08);this.logDispatch('sweeten',d,{cost:5,reward:d.reward});this.flash(`BONUS ADDED · ${d.id.toUpperCase()} now €${d.reward}`,4);return true;},
  extendJob(id){const d=this.deliveryById(id);if(!d||d.status!=='waiting'||d.extended||!this.spendFocus(1))return false;d.deadlineAt+=20;d.extended=true;this.logDispatch('client-call',d,{seconds:20});this.flash(`CLIENT CALLED · ${d.id.toUpperCase()} +20s`,4);return true;},
  rebroadcastJob(id){const d=this.deliveryById(id);if(!d||d.status!=='waiting'||!d.called||!this.spendFocus(1))return false;d.rebroadcastUntil=this.elapsed+7;this.invalidateDeliberations(d.id);for(const c of this.availableRiders())c.decisionAt=this.elapsed+.04;this.logDispatch('rebroadcast',d,{until:d.rebroadcastUntil});this.flash(`REBROADCAST · ${d.id.toUpperCase()} back on every headset`,4);return true;},
  respondToCityEvent(){
    const ev=this.currentEvent;if(!ev||!['forecast','active'].includes(ev.state)||ev.prepared||!this.spendFocus(1))return false;ev.prepared=true;this.runStats.eventsPrepared=(this.runStats.eventsPrepared??0)+1;
    if(ev.kind==='route'){
      ev.advisory=true;if(ev.state==='active'){const factor=ev.factor+(1-ev.factor)*.35;ev.appliedFactor=factor;for(const e of this.edges)if(ev.edgeIds.includes(e.id))e.eventMultiplier=factor;}this.invalidateRouting();for(const c of this.couriers)if(c.phase==='pickup'||c.phase==='dropoff')this.rerouteCourier(c);this.logDispatch('event-response',null,{event:ev.title,place:ev.place,kind:ev.kind,state:ev.state});this.flash(ev.state==='forecast'?`PRE-BRIEF · riders plan around ${ev.place}`:`DETOUR · riders re-route around ${ev.place}`,5);return true;
    }
    if(ev.kind==='demand'&&ev.state==='active')for(const d of this.activeDeliveries())if(d.eventId===ev.id&&d.status==='waiting')d.deadlineAt+=14;
    this.logDispatch('event-response',null,{event:ev.title,place:ev.place,kind:ev.kind,state:ev.state});this.flash(ev.state==='forecast'?`CAPACITY PLAN · ${ev.place} surge softened`:`CLIENT STAGGER · ${ev.place} event jobs +14s`,5);return true;
  },
  issueDetourAdvisory(){return this.respondToCityEvent();},
  deliveryToolState(id){const d=this.deliveryById(id);if(!d)return null;return{sweeten:d.status==='waiting'&&!d.sweetened&&this.cash>=5,extend:d.status==='waiting'&&!d.extended&&this.dispatchFocus>=1,rebroadcast:d.status==='waiting'&&d.called&&this.dispatchFocus>=1};}
});