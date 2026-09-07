// Geographic ruleset adaptations. Old shift records retain the original motion.
import { shortestPathIndexed } from './graph.js';

export function installGeographicMotion(BerlinPlaytest) {
const prototype=BerlinPlaytest.prototype;
const old=Object.fromEntries(['routeBetween','edgeCost','moveCourier','finishEdge','rerouteCourier','releaseCourier','courierETA','courierAvailability']
  .map(key=>[key,prototype[key]]));

prototype.routeBetween=function(start,goal) {
  if (!this.cityData) return old.routeBetween.call(this,start,goal);
  if (start===goal) return [start];
  const key=`${start}>${goal}`, cached=this.routeCache.get(key);
  if (cached) {this.runStats.routeCacheHits++;return cached.slice();}
  this.runStats.routeCacheMisses++;
  const path=shortestPathIndexed(this.graph,start,goal,(e,from)=>this.edgeCost(e,from));
  this.routeCache.set(key,path);
  if (this.routeCache.size>4096) this.routeCache.delete(this.routeCache.keys().next().value);
  // A reversed path can violate one-way streets, so it is never cached here.
  return path.slice();
};
prototype.edgeCost=function(e,from) {
  from=from?.id??from;
  if (this.cityData&&from!=null&&((e.direction==='R'&&from!==e.a)||(e.direction==='G'&&from!==e.b))) return Infinity;
  return old.edgeCost.call(this,e);
};
prototype.rerouteCourier=function(c) {
  if (!this.cityData) return old.rerouteCourier.call(this,c);
  const at=this.nodeById(c.nodeId);
  if (Math.hypot(c.x-at.x,c.y-at.y)>.001) {c.reroutePending=true;return;}
  old.rerouteCourier.call(this,c);c.reroutePending=false;
};
prototype.finishEdge=function(c,target,edge) {
  if (!this.cityData) return old.finishEdge.call(this,c,target,edge);
  c.x=target.x;c.y=target.y;c.nodeId=target.id;c.pathIndex++;
  const d=this.deliveryById(c.deliveryId);
  if (d?.pickedUp&&edge) d.edgesTraversed.push(edge.id);
  if (c.phase==='coasting') {c.phase='idle';old.releaseCourier.call(this,c,false);return;}
  if (c.pathIndex>=c.path.length) {this.arrive(c);return;}
  if (c.reroutePending) this.rerouteCourier(c);
};
prototype.releaseCourier=function(c,allowBreak=false) {
  if (this.cityData&&['pickup','dropoff'].includes(c.phase)&&c.path[c.pathIndex]) {
    const at=this.nodeById(c.nodeId);
    if (Math.hypot(c.x-at.x,c.y-at.y)>.001) {
      c.deliveryId=null;c.deliberation=null;c.phase='coasting';c.radioOn=false;
      c.lastDecision='Finishing the street before listening';return;
    }
  }
  return old.releaseCourier.call(this,c,allowBreak);
};
prototype.moveCourier=function(c,dt) {
  if (!this.cityData) return old.moveCourier.call(this,c,dt);
  // A tick can cross several short geometry segments. Consume the whole time
  // budget, retaining road position and cargo handling at each segment.
  for (let guard=0;dt>1e-10&&guard<1000&&['pickup','dropoff','coasting'].includes(c.phase);guard++) {
    const target=this.nodeById(c.path[c.pathIndex]);if (!target) return;
    const dx=target.x-c.x,dy=target.y-c.y,remaining=Math.hypot(dx,dy);
    const edge=this.edgeByIds(c.path[Math.max(0,c.pathIndex-1)],target.id);
    if (remaining<1e-7) {this.finishEdge(c,target,edge);continue;}
    const d=this.deliveryById(c.deliveryId),handling=c.phase==='dropoff'?this.cargoHandlingFor(d):{speed:1,fatigue:1};
    const velocity=c.baseSpeed*c.experience.speed*this.modifiers.speed*(handling.speed??1)*(edge?.speed??1)*(edge?.eventMultiplier??1);
    if (!(velocity>0)) throw new Error('Invalid rider speed');
    const used=Math.min(dt,remaining/velocity),step=used*velocity;
    c.heading=Math.atan2(dy,dx)+Math.PI/2;c.x+=dx/remaining*step;c.y+=dy/remaining*step;
    c.fatigue=Math.min(1,c.fatigue+used*.00315*c.experience.fatigue*this.modifiers.fatigue*(handling.fatigue??1));
    this.runStats.distance+=step;if ((edge?.eventMultiplier??1)<.99) this.runStats.eventExposure+=step;
    dt-=used;
    if (step>=remaining-1e-7) this.finishEdge(c,target,edge);
  }
};
prototype.courierETA=function(c) {
  if (!this.cityData) return old.courierETA.call(this,c);
  if (!c||!['pickup','dropoff','coasting'].includes(c.phase)) return null;
  const d=this.deliveryById(c.deliveryId),base=c.baseSpeed*c.experience.speed*this.modifiers.speed;
  const cargo=this.cargoHandlingFor(d).speed??1;
  let cost=0;
  for (let i=c.pathIndex;i<c.path.length;i++) {
    const edge=this.edgeByIds(c.path[i-1],c.path[i]),node=this.nodeById(c.path[i]);
    const distance=i===c.pathIndex?Math.hypot(node.x-c.x,node.y-c.y):edge.distance;
    cost+=distance/((edge.speed??1)*(edge.eventMultiplier??1));
  }
  let seconds=cost/(base*(c.phase==='dropoff'?cargo:1));
  if (c.phase==='pickup'&&d) seconds+=this.routeTravelCost(d.pickupId,d.dropoffId)/(base*cargo);
  return seconds;
};
prototype.courierAvailability=function(c,d=null) {
  if (!this.cityData) return old.courierAvailability.call(this,c,d);
  if (!c) return null;
  const current=this.deliveryById(c.deliveryId),busy=['pickup','dropoff','coasting'].includes(c.phase);
  const state=busy?'busy':c.phase==='break'?'break':c.deliberation?'thinking':'ready';
  const fromNodeId=busy?(current?.dropoffId??c.path[c.pathIndex]):c.nodeId;
  const readyIn=busy?this.courierETA(c):state==='break'?this.breakRemaining(c):0;
  if(this.fullCity&&d) {
    const from=this.nodeById(fromNodeId),pickup=this.nodeById(d.pickupId),base=c.baseSpeed*c.experience.speed*this.modifiers.speed;
    const lowerBound=Math.hypot(from.x-pickup.x,from.y-pickup.y)/base;
    if(readyIn+lowerBound>Math.min(180,Math.max(0,d.deadlineAt-this.elapsed)+30))
      return {rider:c,state,readyIn,travelIn:Infinity,arrivalIn:Infinity,fromNodeId,pickupId:d.pickupId,availableNow:state==='ready'||state==='thinking'};
  }
  const travelIn=d?this.routeTravelCost(fromNodeId,d.pickupId)/(c.baseSpeed*c.experience.speed*this.modifiers.speed):0;
  return {rider:c,state,readyIn,travelIn,arrivalIn:readyIn+travelIn,fromNodeId,pickupId:d?.pickupId,availableNow:state==='ready'||state==='thinking'};
};
}
