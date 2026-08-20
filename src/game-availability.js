import { Game } from './game-core.js';

function baseVelocity(game,c){return Math.max(1,c.baseSpeed*c.experience.speed*game.modifiers.speed);}

Game.prototype.courierAvailability=function(c,delivery=null){
  if(!c)return null;
  let readyIn=0,fromNodeId=c.nodeId,state='ready';
  if(c.phase==='break'||!c.radioOn){readyIn=this.breakRemaining(c);state='break';}
  else if(c.phase==='pickup'||c.phase==='dropoff'){
    readyIn=this.courierETA(c)??0;state='busy';const current=this.deliveryById(c.deliveryId);fromNodeId=current?.dropoffId??c.targetNodeId??c.nodeId;
  }else if(c.deliberation){state='thinking';}
  if(!delivery)return{rider:c,state,readyIn,arrivalIn:readyIn,fromNodeId};
  const pickup=this.nodeById(delivery.pickupId);if(!pickup||!fromNodeId)return{rider:c,state,readyIn,arrivalIn:Infinity,fromNodeId};
  const route=this.routeBetween(fromNodeId,pickup.id),travel=route.length?this.routeDistance(route)/baseVelocity(this,c):Infinity;
  return{rider:c,state,readyIn,travelIn:travel,arrivalIn:readyIn+travel,fromNodeId,pickupId:pickup.id,availableNow:state==='ready'||state==='thinking'};
};

Game.prototype.deliveryRiderOutlook=function(delivery,{limit=4,horizon=75}={}){
  if(!delivery)return[];
  return this.couriers.map(c=>{
    const availability=this.courierAvailability(c,delivery);let score=-Infinity;
    if(availability.availableNow&&c.radioOn&&c.phase==='idle')score=this.courierChoiceScore(c,delivery,false);
    return{...availability,score};
  }).filter(item=>Number.isFinite(item.arrivalIn)&&item.arrivalIn<=horizon).sort((a,b)=>{
    if(a.availableNow!==b.availableNow)return a.availableNow?-1:1;
    if(a.availableNow&&b.availableNow&&a.score!==b.score)return b.score-a.score;
    return a.arrivalIn-b.arrivalIn;
  }).slice(0,limit);
};
