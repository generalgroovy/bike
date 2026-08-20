import { Game } from './game-core.js';
import { SPECIAL_CONTRACTS } from './game-data.js';

export const SCHEDULED_SPECIAL={id:'scheduled',label:'WINDOW',glyph:'◷',minLevel:2,weight:.24,reward:1.2,deadline:1.22,appeal:-.06,readyDelay:[14,30],desc:'Pickup opens shortly; an early volunteer may wait at the client.'};
if(!SPECIAL_CONTRACTS.some(item=>item.id===SCHEDULED_SPECIAL.id))SPECIAL_CONTRACTS.push(SCHEDULED_SPECIAL);

const baseSpawnDelivery=Game.prototype.spawnDelivery;
Game.prototype.spawnDelivery=function(options={}){
  const before=this.deliveries.length,result=baseSpawnDelivery.call(this,options);if(!result||this.deliveries.length<=before)return result;
  const delivery=this.deliveries.at(-1);if(delivery.specialId==='scheduled'){const source=options.special?.id==='scheduled'?options.special:SCHEDULED_SPECIAL,range=source.readyDelay??SCHEDULED_SPECIAL.readyDelay,delay=this.rng.float(range[0],range[1]);delivery.pickupReadyAt=delivery.createdAt+delay;delivery.pickupWindowDelay=delay;delivery.specialDesc=`${source.desc} · opens in ${Math.round(delay)}s`;if(delivery.deadlineAt<=delivery.pickupReadyAt+25)delivery.deadlineAt=delivery.pickupReadyAt+25;}
  return result;
};

const baseArrive=Game.prototype.arrive;
Game.prototype.arrive=function(c){
  const delivery=this.deliveryById(c?.deliveryId);if(c?.phase==='pickup'&&delivery?.pickupReadyAt!=null&&this.elapsed<delivery.pickupReadyAt){c.phase='waiting-pickup';c.waitUntil=delivery.pickupReadyAt;c.path=[];c.pathIndex=0;c.targetNodeId=delivery.pickupId;c.lastDecision=`At ${delivery.id.toUpperCase()} · waiting for client`;this.logDispatch('pickup-wait',delivery,{rider:c.name,readyAt:delivery.pickupReadyAt});return;}
  if(c?.phase==='waiting-pickup'){c.phase='pickup';c.waitUntil=null;}
  return baseArrive.call(this,c);
};

const baseTaskProgress=Game.prototype.courierTaskProgress;
Game.prototype.courierTaskProgress=function(c){if(c?.phase==='waiting-pickup')return .35;return baseTaskProgress.call(this,c);};

const baseEta=Game.prototype.courierETA;
Game.prototype.courierETA=function(c){
  if(c?.phase!=='waiting-pickup')return baseEta.call(this,c);
  const delivery=this.deliveryById(c.deliveryId);if(!delivery)return null;const wait=Math.max(0,(delivery.pickupReadyAt??this.elapsed)-this.elapsed),path=this.routeBetween(c.nodeId,delivery.dropoffId),distance=this.routeDistance(path),handling=this.cargoHandlingFor?.(delivery)??{speed:1},velocity=Math.max(1,c.baseSpeed*c.experience.speed*this.modifiers.speed*(handling.speed??1));return wait+distance/velocity;
};

const baseAvailability=Game.prototype.courierAvailability;
Game.prototype.courierAvailability=function(c,delivery=null){
  if(c?.phase!=='waiting-pickup')return baseAvailability.call(this,c,delivery);
  const current=this.deliveryById(c.deliveryId),readyIn=this.courierETA(c)??0,fromNodeId=current?.dropoffId??c.nodeId;if(!delivery)return{rider:c,state:'busy',readyIn,arrivalIn:readyIn,fromNodeId};const pickup=this.nodeById(delivery.pickupId),route=pickup?this.routeBetween(fromNodeId,pickup.id):[],travel=route.length?this.routeDistance(route)/Math.max(1,c.baseSpeed*c.experience.speed*this.modifiers.speed):Infinity;return{rider:c,state:'busy',readyIn,travelIn:travel,arrivalIn:readyIn+travel,fromNodeId,pickupId:pickup?.id??null,availableNow:false};
};

const baseUpdate=Game.prototype.update;
Game.prototype.update=function(dt){const result=baseUpdate.call(this,dt);if(this.paused||this.gameOver||this.upgradePending)return result;for(const c of this.couriers)if(c.phase==='waiting-pickup'&&this.elapsed>=c.waitUntil)this.arrive(c);return result;};
