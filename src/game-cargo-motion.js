import { Game } from './game-core.js';

Game.prototype.courierETA=function(c){
  if(!c||!(c.phase==='pickup'||c.phase==='dropoff'))return null;
  const delivery=c.deliveryId?this.deliveryById(c.deliveryId):null,handling=c.phase==='dropoff'?this.cargoHandlingFor(delivery):{speed:1},velocity=Math.max(1,c.baseSpeed*c.experience.speed*this.modifiers.speed*(handling.speed??1));
  return this.remainingPathDistance(c)/velocity;
};

Game.prototype.moveCourier=function(c,dt){
  if(c.phase!=='pickup'&&c.phase!=='dropoff')return;
  const target=this.nodeById(c.path[c.pathIndex]);if(!target)return;
  const dx=target.x-c.x,dy=target.y-c.y,remaining=Math.hypot(dx,dy),from=c.path[Math.max(0,c.pathIndex-1)],edge=this.edgeByIds(from,target.id);if(remaining<.001){this.finishEdge(c,target,edge);return;}
  c.heading=Math.atan2(dy,dx)+Math.PI/2;
  const delivery=c.deliveryId?this.deliveryById(c.deliveryId):null,handling=c.phase==='dropoff'?this.cargoHandlingFor(delivery):{speed:1,fatigue:1},velocity=c.baseSpeed*c.experience.speed*this.modifiers.speed*(handling.speed??1)*(edge?.speed??1)*(edge?.eventMultiplier??1),step=Math.min(remaining,velocity*dt);
  c.x+=dx/remaining*step;c.y+=dy/remaining*step;c.fatigue=Math.min(1,c.fatigue+dt*.00315*c.experience.fatigue*this.modifiers.fatigue*(handling.fatigue??1));this.runStats.distance+=step;if((edge?.eventMultiplier??1)<.99)this.runStats.eventExposure+=step;if(step>=remaining-.001)this.finishEdge(c,target,edge);
};
