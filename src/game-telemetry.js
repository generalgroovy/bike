import { Game } from './game-core.js';

const average=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;

Game.prototype.runTelemetry=function(){
  const completed=this.deliveries.filter(d=>d.status==='completed'),resolved=this.deliveries.filter(d=>d.status==='completed'||d.status==='failed');
  const callDelays=resolved.filter(d=>d.firstCalledAt!=null).map(d=>Math.max(0,d.firstCalledAt-d.createdAt));
  const acceptance=resolved.filter(d=>d.claimedAt!=null&&d.firstCalledAt!=null).map(d=>Math.max(0,d.claimedAt-d.firstCalledAt));
  const deliveryTimes=completed.filter(d=>d.completedAt!=null).map(d=>Math.max(0,d.completedAt-d.createdAt));
  const expansions=this.dispatchLog.filter(entry=>entry.action==='city-expand').map(entry=>({at:entry.at,stage:entry.stage,level:entry.level??entry.cityLevel}));
  const failures={neverCalled:0,calledUnclaimed:0,claimedLate:0};for(const d of resolved)if(d.status==='failed'&&Object.hasOwn(failures,d.failureKind))failures[d.failureKind]+=1;
  const minutes=Math.max(this.elapsed/60,1/60);
  return{
    elapsed:this.elapsed,
    completed:this.completed,
    failed:this.failed,
    throughputPerMinute:this.completed/minutes,
    averageCallDelay:average(callDelays),
    averageAcceptanceDelay:average(acceptance),
    averageDeliveryTime:average(deliveryTimes),
    peakQueue:this.runStats.peakActive,
    peakRadio:this.runStats.peakRadio,
    radioCapacity:this.radioSlots,
    radioPressure:this.radioSlots?this.runStats.peakRadio/this.radioSlots:0,
    toolsUsed:this.runStats.toolsUsed,
    breaks:this.runStats.breaks,
    eventsPrepared:this.runStats.eventsPrepared??0,
    distanceKm:this.runStats.distance/100,
    expansions,
    failures
  };
};
