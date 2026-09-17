const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));

export const DISTANCE_BANDS=Object.freeze([
  Object.freeze({id:'near',label:'NEAR',maxMeters:1400,color:'#55bda6'}),
  Object.freeze({id:'mid',label:'MID',maxMeters:2800,color:'#42aeca'}),
  Object.freeze({id:'far',label:'FAR',maxMeters:4800,color:'#4f7fc4'}),
  Object.freeze({id:'cross-town',label:'CROSS-TOWN',maxMeters:Infinity,color:'#785fbd'})
]);

export const DIFFICULTY_BANDS=Object.freeze([
  Object.freeze({id:'easy',label:'EASY',maxScore:25,color:'#55bda6'}),
  Object.freeze({id:'normal',label:'NORMAL',maxScore:45,color:'#92b94f'}),
  Object.freeze({id:'demanding',label:'DEMANDING',maxScore:63,color:'#d3a33f'}),
  Object.freeze({id:'hard',label:'HARD',maxScore:80,color:'#df7d3f'}),
  Object.freeze({id:'extreme',label:'EXTREME',maxScore:100,color:'#d95858'})
]);

const CARGO_FALLBACK=Object.freeze({
  food:{speed:.98,fatigue:1.02},parcel:{speed:.97,fatigue:1.05},document:{speed:1,fatigue:.98},grocery:{speed:.9,fatigue:1.28},fragile:{speed:.9,fatigue:1.12},flowers:{speed:.93,fatigue:1.08},keys:{speed:1,fatigue:.97},medical:{speed:1,fatigue:1.02},catering:{speed:.82,fatigue:1.48},coldchain:{speed:.95,fatigue:1.1}
});

export function distanceBandForMeters(meters){const value=Math.max(0,Number(meters)||0);return DISTANCE_BANDS.find(item=>value<=item.maxMeters)??DISTANCE_BANDS.at(-1);}
export function difficultyBandForScore(score){const value=clamp(Number(score)||0,0,100);return DIFFICULTY_BANDS.find(item=>value<=item.maxScore)??DIFFICULTY_BANDS.at(-1);}

function edgesForDelivery(game,delivery){
  const result=[],path=delivery?.plannedPath??[];
  for(let i=1;i<path.length;i++){const edge=game?.edgeByIds?.(path[i-1],path[i]);if(edge)result.push(edge);}
  return result;
}

function averageRiderSpeed(game){
  const riders=game?.couriers??[];if(!riders.length)return 66;
  const modifier=Number(game?.modifiers?.speed)||1;
  return riders.reduce((sum,rider)=>sum+(Number(rider.baseSpeed)||66)*(Number(rider.experience?.speed)||1)*modifier,0)/riders.length;
}

function turnComplexity(game,path){
  if(!game||!Array.isArray(path)||path.length<3)return 0;
  let turns=0,segments=0;
  for(let i=1;i<path.length-1;i++){
    const a=game.nodeById?.(path[i-1]),b=game.nodeById?.(path[i]),c=game.nodeById?.(path[i+1]);if(!a||!b||!c)continue;
    const ux=b.x-a.x,uy=b.y-a.y,vx=c.x-b.x,vy=c.y-b.y,ul=Math.hypot(ux,uy),vl=Math.hypot(vx,vy);if(ul<1e-6||vl<1e-6)continue;
    const dot=clamp((ux*vx+uy*vy)/(ul*vl),-1,1),angle=Math.acos(dot);segments++;
    if(angle>.42)turns++;
  }
  return segments?clamp((turns/segments-.08)/.55):0;
}

function cargoPenalty(delivery){
  const fallback=CARGO_FALLBACK[delivery?.type]??{speed:1,fatigue:1},speed=Number(delivery?.cargoSpeed??fallback.speed)||1,fatigue=Number(delivery?.cargoFatigue??fallback.fatigue)||1;
  return clamp((1-speed)/.22*.65+Math.max(0,fatigue-1)/.5*.35);
}

export function assessRoute(game,delivery){
  if(!delivery)return null;
  const metersPerUnit=Number(game?.metersPerGameUnit)||10;
  const distanceUnits=Math.max(0,Number(delivery.plannedDistance)||0),distanceMeters=distanceUnits*metersPerUnit,distanceBand=distanceBandForMeters(distanceMeters);
  const edges=edgesForDelivery(game,delivery),path=delivery.plannedPath??[];
  let routeCost=0,totalEdgeDistance=0,eventDistance=0,bikeLaneDistance=0;
  const event=game?.currentEvent,affected=event?.kind==='route'&&event.state==='active'?event.edgeIds??[]:[];
  for(const edge of edges){
    const distance=Math.max(0,Number(edge.distance)||0);totalEdgeDistance+=distance;
    const speed=Math.max(.16,(Number(edge.speed)||1)*(Number(edge.eventMultiplier)||1));routeCost+=distance/speed;
    if(affected.includes(edge.id))eventDistance+=distance;
    if(edge.bikeLane)bikeLaneDistance+=distance;
  }
  if(!edges.length)routeCost=distanceUnits;
  const handling=CARGO_FALLBACK[delivery.type]??{speed:1},cargoSpeed=Math.max(.5,Number(delivery.cargoSpeed??handling.speed)||1),estimatedRideSeconds=routeCost/Math.max(1,averageRiderSpeed(game))/cargoSpeed;
  const remainingSeconds=(Number(delivery.deadlineAt)||0)-(Number(game?.elapsed)||0),slackSeconds=remainingSeconds-estimatedRideSeconds;
  const deadlinePressure=remainingSeconds<=0?1:clamp(1-slackSeconds/Math.max(18,estimatedRideSeconds*1.65));
  const eventExposure=totalEdgeDistance?clamp(eventDistance/totalEdgeDistance):0;
  const bikeLaneShare=totalEdgeDistance?clamp(bikeLaneDistance/totalEdgeDistance):0;
  const routeComplexity=turnComplexity(game,path);
  const cargoPenaltyValue=cargoPenalty(delivery);
  const distancePressure=clamp((distanceMeters-650)/6200);
  const bikeLanePenalty=1-bikeLaneShare;
  const difficultyScore=Math.round(clamp(
    distancePressure*.35+
    deadlinePressure*.29+
    cargoPenaltyValue*.13+
    eventExposure*.13+
    routeComplexity*.06+
    bikeLanePenalty*.04
  )*100);
  const difficultyBand=difficultyBandForScore(difficultyScore);
  return{
    distanceMeters,
    distanceBand:distanceBand.id,
    distanceLabel:distanceBand.label,
    distanceColor:distanceBand.color,
    difficultyScore,
    difficultyBand:difficultyBand.id,
    difficultyLabel:difficultyBand.label,
    difficultyColor:difficultyBand.color,
    deadlinePressure,
    slackSeconds,
    estimatedRideSeconds,
    eventExposure,
    cargoPenalty:cargoPenaltyValue,
    routeComplexity,
    bikeLaneShare
  };
}

// This is a loaded-ride estimate, not a promise that a rider can finish the job.
// Unlike a countdown, a margin must retain its sign when the route is late.
export function formatRouteMargin(seconds){
  if(!Number.isFinite(seconds))return 'ride margin unknown';
  const value=Math.ceil(Math.abs(seconds));
  const clock=`${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;
  return `${seconds<0?'−':'+'}${clock} ride margin`;
}
