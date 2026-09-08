// Full-city v5 only. Handoffs and negotiations are replayed simulation state;
// older rulesets retain their exact movement, rewards and random stream.
export const HANDOFFS=Object.freeze({document:{pickup:1.5,dropoff:1.5},fragile:{pickup:3,dropoff:3},grocery:{pickup:4,dropoff:3.5}});
export const CLIENT_EXTENSION=Object.freeze({seconds:20,feeFraction:.2,minFee:3});
export function installPlaytestRealism(Type) {
  const p=Type.prototype,old=Object.fromEntries(['spawnDelivery','arrive','moveCourier','releaseCourier','courierETA','courierAvailability','offerMargin','deliveryFeasibility','extendJob','shiftReview'].map(key=>[key,p[key]]));
  p.handoffTime=function(d){return this.refined?(HANDOFFS[d?.type]??HANDOFFS.document):{pickup:0,dropoff:0};};
  p.spawnDelivery=function(options){const result=old.spawnDelivery.call(this,options);if(result&&this.refined){const d=this.deliveries.at(-1);d.originalReward=d.reward;this.logDispatch('spawn',d,{cargo:d.type});}return result;};
  p.arrive=function(c){
    const d=this.deliveryById(c.deliveryId);
    if(!this.refined||!d||!['pickup','dropoff'].includes(c.phase))return old.arrive.call(this,c);
    const pickup=c.phase==='pickup';c.phase=pickup?'loading':'handover';
    c.handoffUntil=this.elapsed+this.handoffTime(d)[pickup?'pickup':'dropoff'];
    this.logDispatch(pickup?'pickup-arrival':'dropoff-arrival',d,{rider:c.name,seconds:c.handoffUntil-this.elapsed});
  };
  p.moveCourier=function(c,dt){
    if(this.refined&&['loading','handover'].includes(c.phase)){
      if(this.elapsed>=c.handoffUntil){c.phase=c.phase==='loading'?'pickup':'dropoff';c.handoffUntil=null;old.arrive.call(this,c);}return;
    }
    return old.moveCourier.call(this,c,dt);
  };
  p.releaseCourier=function(c,allowBreak){if(this.refined)c.handoffUntil=null;return old.releaseCourier.call(this,c,allowBreak);};
  p.courierETA=function(c){
    if(!this.refined||!c)return old.courierETA.call(this,c);
    const d=this.deliveryById(c.deliveryId),service=this.handoffTime(d),remaining=Math.max(0,(c.handoffUntil??this.elapsed)-this.elapsed);
    if(c.phase==='handover')return remaining;
    if(c.phase==='loading')return remaining+this.routeTravelCost(d.pickupId,d.dropoffId)/(c.baseSpeed*c.experience.speed*this.modifiers.speed*this.cargoHandlingFor(d).speed)+service.dropoff;
    const riding=old.courierETA.call(this,c);
    return riding==null?riding:riding+(c.phase==='pickup'?service.pickup+service.dropoff:c.phase==='dropoff'?service.dropoff:0);
  };
  p.courierAvailability=function(c,d){
    if(!this.refined||!['loading','handover'].includes(c?.phase))return old.courierAvailability.call(this,c,d);
    const current=this.deliveryById(c.deliveryId),fromNodeId=current.dropoffId,readyIn=this.courierETA(c),from=this.nodeById(fromNodeId),pickup=d&&this.nodeById(d.pickupId);
    const base=c.baseSpeed*c.experience.speed*this.modifiers.speed;
    const far=d&&readyIn+Math.hypot(from.x-pickup.x,from.y-pickup.y)/base>Math.min(180,Math.max(0,d.deadlineAt-this.elapsed)+30);
    const travelIn=!d?0:far?Infinity:this.routeTravelCost(fromNodeId,d.pickupId)/base;
    return{rider:c,state:'busy',readyIn,travelIn,arrivalIn:readyIn+travelIn,fromNodeId,pickupId:d?.pickupId,availableNow:false};
  };
  p.offerMargin=function(c,d){const service=this.handoffTime(d);return old.offerMargin.call(this,c,d)-service.pickup-service.dropoff;};
  p.deliveryFeasibility=function(d,options){
    const value=old.deliveryFeasibility.call(this,d,options);if(!this.refined||!value)return value;
    const service=this.handoffTime(d),handlingIn=service.pickup+service.dropoff;
    const candidates=value.candidates.map(item=>({...item,handlingIn,finishIn:item.finishIn+handlingIn,margin:item.margin-handlingIn}));
    const best=candidates[0]??null,margin=best?.margin??-Infinity,state=margin<0?'risk':margin<18?'tight':best&&!best.availableNow?'future':'safe';
    return{...value,candidates,best,margin,state,label:state.toUpperCase()};
  };
  p.extensionOffer=function(d){
    const seconds=Math.max(0,Math.min(CLIENT_EXTENSION.seconds,this.config.arrivals+this.config.closing-(d?.deadlineAt??Infinity)));
    const fee=d?Math.max(CLIENT_EXTENSION.minFee,Math.ceil(d.reward*CLIENT_EXTENSION.feeFraction)):0;
    const reason=!this.refined?'Available in the full Berlin acceptance build.':this.gameOver?'The shift is finished.':!d||d.status!=='waiting'?'Only unclaimed work can be renegotiated.':d.extended?'The client already agreed once.':d.deadlineAt<=this.elapsed?'The deadline has passed.':seconds<5?'Closing time leaves no useful extension.':d.reward<=fee?'The remaining fee is too small.':null;
    return{available:!reason,seconds,fee,newReward:d?d.reward-fee:0,reason};
  };
  p.extendJob=function(id){
    if(!this.refined)return old.extendJob.call(this,id);
    const d=this.deliveryById(id),offer=this.extensionOffer(d);if(!offer.available)return false;
    d.deadlineAt+=offer.seconds;d.reward=offer.newReward;d.extended=true;d.deadlineAdded=offer.seconds;d.feeConcession=offer.fee;
    this.runStats.toolsUsed++;this.invalidateDeliberations(id);
    this.logDispatch('client-call',d,{seconds:offer.seconds,fee:offer.fee,clientFee:d.reward});
    this.flash(`Client agreed: +${offer.seconds}s for ${id.toUpperCase()}; fee now €${d.reward}. Riders still choose.`,7);return true;
  };
  p.shiftReview=function(){const review=old.shiftReview.call(this);if(!this.refined)return review;
    return{...review,clientExtensions:this.deliveries.filter(d=>d.extended).length,feesConceded:this.deliveries.reduce((sum,d)=>sum+(d.feeConcession??0),0),bonusesPaid:this.deliveries.reduce((sum,d)=>sum+d.bonusPaid,0)};
  };
}
