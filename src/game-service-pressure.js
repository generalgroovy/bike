import { Game } from './game-core.js';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

function districtForCourier(game,courier){
  if(!courier)return null;
  const node=game.nodeById(courier.nodeId);
  if(node?.districtId)return node.districtId;
  const delivery=courier.deliveryId?game.deliveryById(courier.deliveryId):null;
  return delivery?.pickupDistrict??delivery?.dropoffDistrict??null;
}

Game.prototype.ensureServicePressure=function(){
  if(this.servicePressure)return this.servicePressure;
  this.servicePressure=new Map();
  for(const district of this.districts)this.servicePressure.set(district.id,{districtId:district.id,pressure:0,target:0,overload:0,breaches:0,lastBreachAt:null,waiting:0,called:0,claimed:0,urgent:0,capacity:0});
  this.runStats.districtBreaches??=0;this.runStats.peakDistrictPressure??=0;
  return this.servicePressure;
};

Game.prototype.serviceLoadForDistrict=function(id){
  const jobs=this.activeDeliveries().filter(d=>d.pickupDistrict===id),waiting=jobs.filter(d=>d.status==='waiting'&&!d.called).length,called=jobs.filter(d=>d.status==='waiting'&&d.called).length,claimed=jobs.filter(d=>d.status==='claimed').length,urgent=jobs.filter(d=>this.urgency(d)<.42).length;
  let nearby=0;
  for(const rider of this.couriers){
    const district=districtForCourier(this,rider);
    if(district===id&&rider.phase!=='break')nearby+=rider.phase==='idle'?1:.55;
  }
  const capacity=2.4+nearby*.9;
  const demand=waiting*1.15+called*.82+claimed*.28+urgent*.9;
  return{waiting,called,claimed,urgent,capacity,demand};
};

Game.prototype.updateServicePressure=function(dt){
  if(!(dt>0))return;
  const states=this.ensureServicePressure();
  for(const district of this.districts){
    const state=states.get(district.id),unlocked=(district.unlockLevel??1)<=this.cityLevel;
    if(!unlocked){state.target=0;state.pressure=Math.max(0,state.pressure-dt*8);state.overload=0;continue;}
    const load=this.serviceLoadForDistrict(district.id);Object.assign(state,load);
    state.target=clamp((load.demand-load.capacity)*17+load.urgent*7,0,100);
    const rate=state.target>state.pressure?.46:.2;
    state.pressure=clamp(state.pressure+(state.target-state.pressure)*Math.min(1,dt*rate),0,100);
    if(state.pressure>=82)state.overload+=dt;else state.overload=Math.max(0,state.overload-dt*1.8);
    this.runStats.peakDistrictPressure=Math.max(this.runStats.peakDistrictPressure,state.pressure);
    if(state.overload>=18){
      state.overload=0;state.breaches+=1;state.lastBreachAt=this.elapsed;state.pressure=Math.min(state.pressure,58);this.runStats.districtBreaches+=1;
      this.reputation=Math.max(0,this.reputation-5);this.logDispatch('service-breach',null,{district:district.name,pressure:Math.round(state.pressure)});this.flash(`SERVICE BREACH · ${district.name} · -5 REP`,5);
      if(this.reputation<=0){this.gameOver=true;this.paused=true;this.logDispatch('collapse',null,{reason:'district-service-pressure',district:district.name});}
    }
  }
};

Game.prototype.districtPressure=function(id){const state=this.ensureServicePressure().get(id);return state?{...state}:null;};
Game.prototype.servicePressureSnapshot=function(){
  return this.districts.filter(d=>(d.unlockLevel??1)<=this.cityLevel).map(d=>({district:d, ...this.districtPressure(d.id)})).sort((a,b)=>b.pressure-a.pressure||a.district.name.localeCompare(b.district.name));
};
Game.prototype.cityPressure=function(){const list=this.servicePressureSnapshot();return list.length?Math.max(...list.map(x=>x.pressure)):0;};
Game.prototype.mostPressuredDistrict=function(){return this.servicePressureSnapshot()[0]??null;};

const baseUpdate=Game.prototype.update;
Game.prototype.update=function(dt){
  const before=this.elapsed;baseUpdate.call(this,dt);const advanced=this.elapsed-before;if(advanced>0)this.updateServicePressure(advanced);return undefined;
};

const baseComplete=Game.prototype.completeDelivery;
Game.prototype.completeDelivery=function(c,d){const districtId=d?.pickupDistrict;const result=baseComplete.call(this,c,d);if(districtId){const state=this.ensureServicePressure().get(districtId);if(state){state.pressure=Math.max(0,state.pressure-7);state.overload=Math.max(0,state.overload-3);}}return result;};
