import { RNG,createSeed } from './rng.js';
import { createGraphIndex,shortestPathIndexed } from './graph.js';
import { BERLIN } from './berlin.js';
import { COURIER_COLORS,COURIER_NAMES,DELIVERY_TYPES,EXPERIENCE,PERSONALITIES,RADIO_CHANNELS,RUN_CONTRACTS,RUN_TRAITS,SPECIAL_CONTRACTS,weightedPick } from './game-data.js';

const ROUTE_CACHE_LIMIT=2048;

export class Game{
constructor({seed=createSeed(),width=BERLIN.width,height=BERLIN.height}={}){
  this.seed=seed;this.rng=new RNG(seed);this.width=width;this.height=height;this.elapsed=0;this.score=0;this.cash=0;this.reputation=100;this.completed=0;this.failed=0;this.wave=1;this.speed=1;this.paused=false;this.gameOver=false;this.upgradePending=false;this.nextUpgradeAt=8;this.deliverySerial=0;this.courierSerial=0;this.spawnAccumulator=0;this.selectedDeliveryId=null;this.selectedCourierId=null;this.hoveredDeliveryId=null;this.hoveredCourierId=null;this.radioSlots=4;this.cityLevel=1;this.cityChangedAt=0;this.dispatchFocusMax=3;this.dispatchFocus=2;this.notice='Read the city. Shape the radio. Riders decide.';this.noticeUntil=10;
  this.modifiers={speed:1,deadline:1,reward:1,teamSkill:1,spawnRate:1,fatigue:1};
  this.runStats={peakActive:0,peakRadio:0,distance:0,riderChoices:0,radioDenied:0,eventExposure:0,breaks:0,toolsUsed:0,expansions:0,routeCacheHits:0,routeCacheMisses:0};this.dispatchLog=[];
  this.routingRevision=0;this.routeCache=new Map();this.playableAddressCacheLevel=0;this.playableAddressCache=null;this.deliveryMap=new Map();this.courierMap=new Map();
  this.generateBerlin();this.deliveries=[];this.couriers=[];this.runTrait=this.rng.pick(RUN_TRAITS);this.runContract=this.rng.pick(RUN_CONTRACTS);this.runTrait.apply(this);this.applyContract(this.runContract);for(let i=0;i<3;i++)this.addCourier();this.goals=this.generateGoals();this.currentEvent=null;this.nextEventAt=58+this.rng.float(0,20);for(let i=0;i<5;i++)this.spawnDelivery();
}

generateBerlin(){
  this.districts=BERLIN.districts.map(d=>({...d,polygon:d.polygon.map(p=>[...p])}));
  this.parks=BERLIN.parks.map(p=>({...p,polygon:p.polygon.map(q=>[...q])}));
  this.river=BERLIN.river.map(p=>[...p]);this.canal=BERLIN.canal.map(p=>[...p]);this.landmarks=BERLIN.landmarks.map(l=>({...l}));this.ringStations=BERLIN.ringStations.map(s=>({...s}));this.ringPath=BERLIN.ringPath.map(p=>[...p]);this.unlockStages=BERLIN.unlockStages.map(s=>({...s,bounds:{...s.bounds},districts:[...s.districts]}));
  this.nodes=BERLIN.nodes.map(n=>({...n,address:n.address?{...n.address}:n.address}));this.edges=BERLIN.edges.map(e=>({...e,streetNames:[...(e.streetNames??[e.streetName])]}));this.visualEdges=BERLIN.visualEdges.map(e=>({...e,streetNames:[...(e.streetNames??[e.streetName])]}));this.addressNodes=this.nodes.filter(n=>n.kind==='address');this.streetCatalog=[...BERLIN.streetCatalog];
  this.nodeMap=new Map(this.nodes.map(n=>[n.id,n]));this.edgeMap=new Map();this.edgeIdMap=new Map();for(const e of this.edges){this.edgeMap.set(this.edgeKey(e.a,e.b),e);this.edgeIdMap.set(e.id,e);}this.graph=createGraphIndex(this.nodes,this.edges);this.depotNodeId=this.landmarks.find(l=>l.id==='checkpoint')?.addressNodeId??this.addressNodes.find(n=>n.unlockLevel===1)?.id??this.addressNodes[0]?.id;
}

applyContract(contract){this.modifiers.reward*=contract.reward??1;this.modifiers.deadline*=contract.deadline??1;this.modifiers.spawnRate*=contract.spawnRate??1;}
edgeKey(a,b){return a<b?`${a}|${b}`:`${b}|${a}`;}
nodeById(id){return this.nodeMap.get(id);}
deliveryById(id){if(id==null)return undefined;const cached=this.deliveryMap.get(id);if(cached)return cached;const found=this.deliveries.find(d=>d.id===id);if(found)this.deliveryMap.set(id,found);return found;}
courierById(id){if(id==null)return undefined;const cached=this.courierMap.get(id);if(cached)return cached;const found=this.couriers.find(c=>c.id===id);if(found)this.courierMap.set(id,found);return found;}
edgeById(id){return this.edgeIdMap.get(id);}
edgeByIds(a,b){return this.edgeMap.get(this.edgeKey(a,b));}
currentStage(){return this.unlockStages.find(s=>s.level===this.cityLevel)??this.unlockStages.at(-1);}
playableBounds(){return{...this.currentStage().bounds};}
isDistrictUnlocked(id){return this.currentStage().districts.includes(id);}
playableAddressNodes(){if(this.playableAddressCache&&this.playableAddressCacheLevel===this.cityLevel)return this.playableAddressCache;this.playableAddressCacheLevel=this.cityLevel;this.playableAddressCache=this.addressNodes.filter(n=>(n.unlockLevel??1)<=this.cityLevel);return this.playableAddressCache;}
edgePlayable(e){const a=this.nodeById(e.a),b=this.nodeById(e.b);return(a?.unlockLevel??1)<=this.cityLevel&&(b?.unlockLevel??1)<=this.cityLevel;}
invalidateRouting(){this.routingRevision+=1;this.routeCache.clear();}
routeBetween(startId,goalId){if(startId===goalId)return[startId];const key=`${this.routingRevision}:${startId}>${goalId}`,cached=this.routeCache.get(key);if(cached){this.runStats.routeCacheHits=(this.runStats.routeCacheHits??0)+1;return cached.slice();}this.runStats.routeCacheMisses=(this.runStats.routeCacheMisses??0)+1;const path=shortestPathIndexed(this.graph,startId,goalId,this.edgeCost.bind(this));if(path.length){this.routeCache.set(key,path);this.routeCache.set(`${this.routingRevision}:${goalId}>${startId}`,[...path].reverse());if(this.routeCache.size>ROUTE_CACHE_LIMIT){const first=this.routeCache.keys().next().value;if(first)this.routeCache.delete(first);}}return path.slice();}
routeDistance(path){let total=0;for(let i=1;i<(path?.length??0);i++)total+=this.edgeByIds(path[i-1],path[i])?.distance??0;return total;}
routeStreets(path){const result=[];for(let i=1;i<(path?.length??0);i++){const name=this.edgeByIds(path[i-1],path[i])?.streetName;if(name&&name!=='connector'&&result.at(-1)!==name)result.push(name);}return result;}
routeTravelCost(startId,goalId){const path=this.routeBetween(startId,goalId);if(!path.length)return Infinity;let total=0;for(let i=1;i<path.length;i++){const e=this.edgeByIds(path[i-1],path[i]);if(e)total+=this.edgeCost(e);}return total;}
edgeCost(e){if(!this.edgePlayable(e))return Infinity;let cost=e.distance/Math.max(.16,(e.speed??1)*(e.eventMultiplier??1));if(this.currentEvent?.advisory&&this.currentEvent.edgeIds?.includes(e.id))cost*=1.65;return cost;}

promoteBikeLanes(count,speed=1.4){const visualIds=new Set(this.rng.shuffle(this.visualEdges.filter(e=>e.roadClass!=='connector')).slice(0,count).map(e=>e.id));for(const e of this.edges)if(visualIds.has(e.visualId)){e.speed=Math.max(e.speed,speed);e.bikeLane=true;}for(const e of this.visualEdges)if(visualIds.has(e.id))e.bikeLane=true;this.invalidateRouting();}

addCourier(){if(this.courierSerial>=COURIER_NAMES.length)return false;const depot=this.nodeById(this.depotNodeId),index=this.courierSerial++,personality=this.rng.pick(PERSONALITIES),experience=weightedPick(this.rng,EXPERIENCE,e=>[0,3.1,4.1,2.8,1.2][e.level]),homeDistrict=this.rng.pick(this.currentStage().districts),courier={id:`c${index}`,name:COURIER_NAMES[index],color:COURIER_COLORS[index],personality,experience,homeDistrict,nodeId:depot.id,x:depot.x+(index-1)*8,y:depot.y+(index-1)*6,path:[],pathIndex:0,targetNodeId:null,deliveryId:null,phase:'idle',baseSpeed:64+this.rng.float(-3,5),decisionAt:this.elapsed+this.rng.float(.35,1.1),deliberation:null,lastDecision:'Radio on · listening',completed:0,radioOn:true,fatigue:this.rng.float(.05,.14),breakUntil:null,breaks:0};this.couriers.push(courier);this.courierMap.set(courier.id,courier);return true;}
availableRiders(){return this.couriers.filter(c=>c.phase==='idle'&&c.radioOn);}
activeDeliveries(){return this.deliveries.filter(d=>d.status==='waiting'||d.status==='claimed');}
calledDeliveries(){return this.deliveries.filter(d=>d.status==='waiting'&&d.called);}
calledCount(){return this.calledDeliveries().length;}
radioCost(d){return d?.called?(RADIO_CHANNELS[d.channel]?.cost??1):0;}
radioUsed(){return this.calledDeliveries().reduce((s,d)=>s+this.radioCost(d),0);}
urgency(d){const total=Math.max(1,d.deadlineAt-d.createdAt);return Math.max(0,Math.min(1,(d.deadlineAt-this.elapsed)/total));}

weightedDeliveryType(){const weights=this.runContract.typeWeights??{},items=Object.entries(DELIVERY_TYPES).filter(([,type])=>(type.unlockLevel??1)<=this.cityLevel);return weightedPick(this.rng,items,entry=>entry[1].weight*(weights[entry[0]]??1))[0];}
randomAddress(excludeId=null){const pool=this.playableAddressNodes().filter(n=>n.id!==excludeId&&n.id!==this.depotNodeId);return this.rng.pick(pool);}
randomTrip(){const min=this.runContract.minTrip??120,max=this.runContract.maxTrip??1000;for(let attempt=0;attempt<28;attempt++){const pickup=this.randomAddress(),dropoff=this.randomAddress(pickup?.id);if(!pickup||!dropoff)continue;const path=this.routeBetween(pickup.id,dropoff.id);if(!path.length)continue;const d=this.routeDistance(path);if(d>=min&&d<=max)return{pickup,dropoff,path,distance:d};}const pickup=this.randomAddress(),dropoff=this.randomAddress(pickup?.id),path=pickup&&dropoff?this.routeBetween(pickup.id,dropoff.id):[];return pickup&&dropoff&&path.length?{pickup,dropoff,path,distance:this.routeDistance(path)}:null;}

rollSpecial(){if(this.cityLevel<2)return null;const chance=this.cityLevel>=3?.16:.09;if(!this.rng.chance(chance))return null;const available=SPECIAL_CONTRACTS.filter(s=>s.minLevel<=this.cityLevel);return weightedPick(this.rng,available,s=>s.weight);}
spawnDelivery(options={}){
  if(this.activeDeliveries().length>=36)return false;
  let trip=null;
  if(options.pickupId&&options.dropoffId){const pickup=this.nodeById(options.pickupId),dropoff=this.nodeById(options.dropoffId),path=this.routeBetween(options.pickupId,options.dropoffId);if(pickup&&dropoff&&path.length)trip={pickup,dropoff,path,distance:this.routeDistance(path)};}
  else trip=this.randomTrip();
  if(!trip)return false;
  const typeKey=options.typeKey??this.weightedDeliveryType(),type=DELIVERY_TYPES[typeKey];if(!type)return false;
  const special=options.special===false?null:(options.special??this.rollSpecial());
  const distanceFactor=.82+trip.distance/900,deadline=type.baseDeadline*this.modifiers.deadline*distanceFactor/(1+(this.wave-1)*.014)*(special?.deadline??1),id=`d${this.deliverySerial++}`,reward=Math.round((type.reward+trip.distance/92)*this.modifiers.reward*(special?.reward??1)),delivery={id,type:typeKey,pickupId:trip.pickup.id,dropoffId:trip.dropoff.id,pickupAddress:trip.pickup.addressLabel,dropoffAddress:trip.dropoff.addressLabel,pickupPostcode:trip.pickup.postcode,dropoffPostcode:trip.dropoff.postcode,pickupDistrict:trip.pickup.districtId,dropoffDistrict:trip.dropoff.districtId,createdAt:this.elapsed,deadlineAt:this.elapsed+deadline,reward,status:'waiting',called:false,channel:null,courierId:null,pickedUp:false,firstCalledAt:null,claimedAt:null,edgesTraversed:[],callHistory:[],plannedDistance:trip.distance,plannedStreets:this.routeStreets(trip.path),plannedPath:trip.path,specialId:special?.id??options.specialId??null,specialLabel:special?.label??options.specialLabel??null,specialGlyph:special?.glyph??options.specialGlyph??null,specialDesc:special?.desc??options.specialDesc??null,bonusAppeal:special?.appeal??0,parentId:options.parentId??null,sweetened:false,extended:false,rebroadcastUntil:0};
  this.deliveries.push(delivery);this.deliveryMap.set(delivery.id,delivery);this.runStats.peakActive=Math.max(this.runStats.peakActive,this.activeDeliveries().length);return true;
}

spawnReturnLeg(d){if(!d||d.returnSpawned)return false;d.returnSpawned=true;const typeKey=this.rng.chance(.5)?'parcel':'document';return this.spawnDelivery({pickupId:d.dropoffId,dropoffId:d.pickupId,typeKey,special:false,specialId:'return-leg',specialLabel:'RETURN LEG',specialGlyph:'↩',specialDesc:`Paid return generated by ${d.id.toUpperCase()}`,parentId:d.id});}

maybeAdvanceCity(){let next=this.cityLevel;for(const stage of this.unlockStages)if(this.completed>=stage.threshold)next=Math.max(next,stage.level);if(next<=this.cityLevel)return false;this.cityLevel=next;this.cityChangedAt=this.elapsed;this.playableAddressCache=null;this.invalidateRouting();this.radioSlots+=1;this.dispatchFocusMax+=1;this.dispatchFocus=Math.min(this.dispatchFocusMax,this.dispatchFocus+1);this.runStats.expansions+=1;const stage=this.currentStage();this.logDispatch('city-expand',null,{stage:stage.name,level:stage.level});this.flash(`CITY EXPANDED · ${stage.name} · ${stage.desc}`,7);return true;}
recoverFocus(){if(this.completed>0&&this.completed%4===0)this.dispatchFocus=Math.min(this.dispatchFocusMax,this.dispatchFocus+1);}
}