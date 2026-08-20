import { Game } from './game-core.js';

function loadedTravelTime(game,rider,delivery){
  const route=game.routeBetween(delivery.pickupId,delivery.dropoffId);if(!route.length)return Infinity;
  const handling=game.cargoHandlingFor?.(delivery)??{speed:1},base=Math.max(1,rider.baseSpeed*rider.experience.speed*game.modifiers.speed*(handling.speed??1));
  let seconds=0;for(let i=1;i<route.length;i++){const edge=game.edgeByIds(route[i-1],route[i]);if(!edge)continue;const multiplier=Math.max(.16,(edge.speed??1)*(edge.eventMultiplier??1));seconds+=edge.distance/(base*multiplier);}return seconds;
}

Game.prototype.deliveryFeasibility=function(delivery,{horizon=180}={}){
  if(!delivery||delivery.status!=='waiting')return null;
  const remaining=Math.max(0,delivery.deadlineAt-this.elapsed),candidates=this.couriers.map(rider=>{const availability=this.courierAvailability(rider,delivery);if(!availability||!Number.isFinite(availability.arrivalIn)||availability.arrivalIn>horizon)return null;const loaded=loadedTravelTime(this,rider,delivery),finishIn=availability.arrivalIn+loaded,margin=remaining-finishIn;return{rider,state:availability.state,availableNow:availability.availableNow,arrivalIn:availability.arrivalIn,loadedIn:loaded,finishIn,margin};}).filter(Boolean).sort((a,b)=>b.margin-a.margin||a.finishIn-b.finishIn);
  const best=candidates[0]??null;if(!best)return{state:'risk',label:'AT RISK',margin:-Infinity,remaining,best:null,candidates:[]};
  let state='safe',label='SAFE';if(best.margin<0){state='risk';label='AT RISK';}else if(best.margin<18){state='tight';label='TIGHT';}else if(!best.availableNow){state='future';label='FUTURE';}
  return{state,label,margin:best.margin,remaining,best,candidates:candidates.slice(0,4)};
};
