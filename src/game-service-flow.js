import { Game } from './game-core.js';

Game.prototype.ensureServiceFlow=function(){if(!Number.isInteger(this.serviceFlow))this.serviceFlow=0;if(!Number.isInteger(this.bestServiceFlow))this.bestServiceFlow=0;this.runStats.bestServiceFlow??=this.bestServiceFlow;this.runStats.cleanDeliveries??=0;return this.serviceFlow;};
Game.prototype.breakServiceFlow=function(reason='miss'){this.ensureServiceFlow();if(this.serviceFlow>=3)this.logDispatch('flow-break',null,{flow:this.serviceFlow,reason});this.serviceFlow=0;};
Game.prototype.serviceFlowState=function(){this.ensureServiceFlow();return{streak:this.serviceFlow,best:this.bestServiceFlow,cleanDeliveries:this.runStats.cleanDeliveries??0};};

const baseComplete=Game.prototype.completeDelivery;
Game.prototype.completeDelivery=function(c,d){
  this.ensureServiceFlow();const total=Math.max(1,d.deadlineAt-d.createdAt),quality=Math.max(0,Math.min(1,(d.deadlineAt-this.elapsed)/total)),pressure=typeof this.districtPressure==='function'?(this.districtPressure(d.pickupDistrict)?.pressure??0):0,clean=quality>=.28&&pressure<82,result=baseComplete.call(this,c,d);
  if(!clean){this.breakServiceFlow('late delivery');return result;}
  this.serviceFlow=Math.min(7,this.serviceFlow+1);this.bestServiceFlow=Math.max(this.bestServiceFlow,this.serviceFlow);this.runStats.bestServiceFlow=this.bestServiceFlow;this.runStats.cleanDeliveries=(this.runStats.cleanDeliveries??0)+1;const bonus=18+this.serviceFlow*9;this.score+=bonus;
  if(this.serviceFlow>=3&&typeof this.ensureServicePressure==='function'){const state=this.ensureServicePressure().get(d.pickupDistrict);if(state){state.pressure=Math.max(0,state.pressure-(2+Math.min(3,this.serviceFlow-3)));state.overload=Math.max(0,state.overload-1.5);}}
  if([3,5,7].includes(this.serviceFlow)){this.logDispatch('flow',d,{flow:this.serviceFlow,bonus});this.flash(`CLEAN FLOW ×${this.serviceFlow} · +${bonus} score · local load easing`,3.5);}
  return result;
};

const baseFail=Game.prototype.failDelivery;
Game.prototype.failDelivery=function(d){const wasActive=d?.status==='waiting'||d?.status==='claimed',result=baseFail.call(this,d);if(wasActive&&d?.status==='failed')this.breakServiceFlow('missed delivery');return result;};
