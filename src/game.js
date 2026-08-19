import { RNG, createSeed } from './rng.js';
import { buildAdjacency, distance, shortestPath } from './graph.js';
import { BERLIN, bridgeById, districtById, landmarkById } from './berlin.js';

export const DELIVERY_TYPES = {
  food: { label: 'Food', glyph: '▲', color: '#ff5d8f', baseDeadline: 58, reward: 10 },
  parcel: { label: 'Parcel', glyph: '●', color: '#ffb703', baseDeadline: 82, reward: 12 },
  document: { label: 'Docs', glyph: '■', color: '#5eead4', baseDeadline: 64, reward: 15 },
  medical: { label: 'Medical', glyph: '✚', color: '#ff4667', baseDeadline: 48, reward: 24 },
  grocery: { label: 'Grocery', glyph: '⬢', color: '#a3e635', baseDeadline: 88, reward: 13 },
  fragile: { label: 'Fragile', glyph: '◆', color: '#c084fc', baseDeadline: 74, reward: 18 }
};

export const RADIO_CHANNELS = {
  open: { id:'open', label:'Open', short:'OPEN', cost:1, color:'#71d9ff', desc:'Normal call. Every free rider weighs it on its merits.' },
  priority: { id:'priority', label:'Priority', short:'PRIORITY', cost:2, color:'#ffd166', desc:'Costs 2 bandwidth. Stronger signal, but still not an order.' },
  local: { id:'local', label:'Local', short:'LOCAL', cost:1, color:'#5eead4', desc:'Favours riders already near the pickup area; distant riders may pass.' }
};

export const PERSONALITIES = [
  { id:'sprinter', title:'Sprinter', icon:'⚡', desc:'Gravitates to close, urgent calls.', weights:{ distance:1.55, urgency:1.25, reward:0.45, landmark:0.15 } },
  { id:'earner', title:'Earner', icon:'€', desc:'Chases the best-paying work.', weights:{ distance:0.7, urgency:0.7, reward:1.7, landmark:0.15 } },
  { id:'guardian', title:'Guardian', icon:'✚', desc:'Prioritises medical and late jobs.', weights:{ distance:0.75, urgency:1.75, reward:0.45, medical:1.35, landmark:0.1 } },
  { id:'local', title:'Local', icon:'⌂', desc:'Strong preference for nearby pickups.', weights:{ distance:1.9, urgency:0.7, reward:0.35, sameDistrict:0.9, landmark:0.1 } },
  { id:'tourer', title:'Tourer', icon:'◎', desc:'Likes landmark runs and longer rides.', weights:{ distance:0.25, urgency:0.7, reward:0.75, landmark:1.35, longRide:0.85 } },
  { id:'steady', title:'Steady', icon:'≋', desc:'Balances distance, deadline and pay.', weights:{ distance:1.05, urgency:1.05, reward:0.95, landmark:0.25 } }
];

export const EXPERIENCE = [
  { level:1, title:'Rookie', speed:0.94, think:1.45, noise:0.34 },
  { level:2, title:'Regular', speed:1.00, think:1.18, noise:0.22 },
  { level:3, title:'Experienced', speed:1.06, think:0.94, noise:0.13 },
  { level:4, title:'Veteran', speed:1.11, think:0.78, noise:0.07 }
];

const COURIER_COLORS = ['#00e5ff', '#ff4d8d', '#b8ff5a', '#ffd166', '#9b8cff', '#ff7a45', '#5eead4'];
const COURIER_NAMES = ['Maya', 'Leo', 'Sam', 'Nova', 'Iris', 'Juno', 'Kai', 'Mika', 'Ari', 'Toni'];

export const RUN_TRAITS = [
  { id:'express', title:'Express Berlin', desc:'Tighter client windows; better payouts.', apply(game){ game.modifiers.deadline *= 0.90; game.modifiers.reward *= 1.18; } },
  { id:'green-wave', title:'Green Wave', desc:'Several corridors begin as fast bike lanes.', apply(game){ game.promoteBikeLanes(7, 1.34); } },
  { id:'tourist-saturday', title:'Tourist Saturday', desc:'More jobs touch Berlin landmarks.', apply(game){ game.modifiers.landmarkBias = 0.52; game.modifiers.reward *= 1.06; } },
  { id:'rain-shift', title:'Rain Shift', desc:'Roads are slower, but clients tip more.', apply(game){ game.modifiers.speed *= 0.91; game.modifiers.reward *= 1.20; } }
];

export const UPGRADES = [
  { id:'radio', title:'Radio Bandwidth', desc:'+1 radio bandwidth. Priority calls become easier to sustain.', apply(game){ game.radioSlots += 1; } },
  { id:'rider', title:'Extra Rider', desc:'A new personality joins the autonomous team.', apply(game){ game.addCourier(); } },
  { id:'briefing', title:'Team Briefing', desc:'Riders deliberate faster and with less decision noise.', apply(game){ game.modifiers.teamSkill *= 1.20; } },
  { id:'speed', title:'Street Legs', desc:'All riders move 11% faster.', apply(game){ game.modifiers.speed *= 1.11; } },
  { id:'grace', title:'Client Buffer', desc:'New delivery deadlines are 15% longer.', apply(game){ game.modifiers.deadline *= 1.15; } },
  { id:'bikeLane', title:'Bike-Lane Grant', desc:'Six corridors become express bike links.', apply(game){ game.promoteBikeLanes(6, 1.46); } },
  { id:'goodwill', title:'Local Goodwill', desc:'+18 reputation now.', apply(game){ game.reputation = Math.min(100, game.reputation + 18); } }
];

const ROAD_EVENT_TYPES = [
  { id:'roadworks', title:'ROADWORKS', factor:0.48, duration:[28,42], forecast:'A corridor is narrowing soon.' },
  { id:'demo', title:'DEMONSTRATION', factor:0.58, duration:[22,36], forecast:'Crowds are expected on a central route.' },
  { id:'bridge', title:'BRIDGE SQUEEZE', factor:0.44, duration:[24,38], forecast:'A Spree crossing is about to slow down.', bridgeOnly:true }
];

function weightedPick(rng, items, weightFn) {
  if (!items.length) return undefined;
  const weights = items.map((item) => Math.max(0, Number(weightFn(item)) || 0));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return rng.pick(items);
  let roll = rng.float(0, total);
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items.at(-1);
}

function edgeKey(a, b) { return [a,b].sort().join('|'); }

export class Game {
  constructor({ seed = createSeed(), width = BERLIN.width, height = BERLIN.height } = {}) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.width = width;
    this.height = height;
    this.elapsed = 0;
    this.score = 0;
    this.cash = 0;
    this.reputation = 100;
    this.completed = 0;
    this.failed = 0;
    this.wave = 1;
    this.speed = 1;
    this.paused = false;
    this.gameOver = false;
    this.upgradePending = false;
    this.nextUpgradeAt = 7;
    this.deliverySerial = 0;
    this.courierSerial = 0;
    this.spawnAccumulator = 0;
    this.selectedDeliveryId = null;
    this.selectedCourierId = null;
    this.radioSlots = 4;
    this.notice = 'CALL OUT jobs. Riders choose what to take.';
    this.noticeUntil = 8;
    this.modifiers = { speed:1, deadline:1, reward:1, teamSkill:1, landmarkBias:0.30 };
    this.runStats = { peakActive:0, peakRadio:0, distance:0, riderChoices:0, radioDenied:0, eventExposure:0 };
    this.dispatchLog = [];
    this.generateBerlin();
    this.deliveries = [];
    this.couriers = [];
    this.runTrait = this.rng.pick(RUN_TRAITS);
    this.runTrait.apply(this);
    for (let i = 0; i < 3; i += 1) this.addCourier();
    this.goals = this.generateGoals();
    this.currentEvent = null;
    this.nextEventAt = 44 + this.rng.float(0, 18);
    this.spawnDelivery();
    this.spawnDelivery();
    this.spawnDelivery();
  }

  generateBerlin() {
    this.districts = BERLIN.districts.map((district) => ({ ...district, polygon:district.polygon.map((p) => [...p]) }));
    this.parks = BERLIN.parks.map((park) => ({ ...park, polygon:park.polygon.map((p) => [...p]) }));
    this.river = BERLIN.river.map((p) => [...p]);
    this.landmarks = BERLIN.landmarks.map((landmark) => ({ ...landmark }));
    this.nodes = [
      ...BERLIN.landmarks.map((item) => ({ ...item, kind:'landmark', landmarkId:item.id })),
      ...BERLIN.hubs.map((item) => ({ ...item, kind:'hub' }))
    ];
    for (const district of this.districts) {
      for (let i = 0; i < 2; i += 1) {
        const angle = this.rng.float(0, Math.PI * 2);
        const radius = this.rng.float(28, 68);
        this.nodes.push({
          id:`local-${district.id}-${i}`, name:`${district.name} ${i + 1}`, districtId:district.id,
          x:district.center[0] + Math.cos(angle) * radius, y:district.center[1] + Math.sin(angle) * radius,
          kind:this.rng.pick(['cafe','shop','office','home'])
        });
      }
    }
    const byId = new Map(this.nodes.map((node) => [node.id,node]));
    this.edges = [];
    const seen = new Set();
    const bridgeMap = new Map(BERLIN.bridges.map((bridge) => [edgeKey(...bridge.edge), bridge.id]));
    const addEdge = (aId,bId,speed=1) => {
      const a=byId.get(aId), b=byId.get(bId);
      if (!a || !b || aId===bId) return;
      const key=edgeKey(aId,bId);
      if (seen.has(key)) return;
      seen.add(key);
      this.edges.push({ id:`e${this.edges.length}`, a:aId, b:bId, distance:distance(a,b), speed, bikeLane:false,
        eventMultiplier:1, bridgeId:bridgeMap.get(key) ?? null });
    };
    for (const [a,b] of BERLIN.roads) addEdge(a,b,1);
    for (const node of this.nodes.filter((n) => n.id.startsWith('local-'))) {
      const nearest = this.nodes.filter((other) => other.id!==node.id && !other.id.startsWith('local-'))
        .map((other) => ({ other,d:distance(node,other) })).sort((a,b) => a.d-b.d).slice(0,2);
      for (const item of nearest) addEdge(node.id,item.other.id,this.rng.chance(0.18)?1.14:1);
    }
    this.ensureConnectivity(addEdge);
    this.depotNodeId='checkpoint';
  }

  ensureConnectivity(addEdge) {
    const components = () => {
      const adjacency=buildAdjacency(this.nodes,this.edges), remaining=new Set(this.nodes.map((n) => n.id)), groups=[];
      while (remaining.size) {
        const first=remaining.values().next().value, stack=[first], group=[];
        remaining.delete(first);
        while (stack.length) {
          const id=stack.pop(); group.push(id);
          for (const {to} of adjacency.get(id) ?? []) if (remaining.has(to)) { remaining.delete(to); stack.push(to); }
        }
        groups.push(group);
      }
      return groups;
    };
    let groups=components();
    while (groups.length>1) {
      const primary=groups[0].map((id) => this.nodeById(id)); let bridge=null;
      for (let gi=1;gi<groups.length;gi+=1) for (const a of primary) for (const id of groups[gi]) {
        const b=this.nodeById(id), d=distance(a,b); if (!bridge || d<bridge.d) bridge={a,b,d};
      }
      addEdge(bridge.a.id,bridge.b.id,1); groups=components();
    }
  }

  promoteBikeLanes(count,speed=1.4) {
    for (const edge of this.rng.shuffle(this.edges).slice(0,count)) { edge.speed=Math.max(edge.speed,speed); edge.bikeLane=true; }
  }

  addCourier() {
    const depot=this.nodeById(this.depotNodeId), index=this.courierSerial++;
    const personality=this.rng.pick(PERSONALITIES);
    const experience=weightedPick(this.rng,EXPERIENCE,(level) => [0,3.2,4.2,2.7,1.2][level.level]);
    const homeDistrict=this.rng.pick(this.districts).id;
    this.couriers.push({
      id:`c${index}`, name:COURIER_NAMES[index%COURIER_NAMES.length], color:COURIER_COLORS[index%COURIER_COLORS.length],
      personality, experience, homeDistrict, nodeId:depot.id, x:depot.x+(index-1)*10, y:depot.y+(index-1)*7,
      path:[], pathIndex:0, targetNodeId:null, deliveryId:null, phase:'idle', progress:0,
      baseSpeed:62+this.rng.float(-3,5), decisionAt:this.elapsed+this.rng.float(0.35,1.2), deliberation:null,
      lastDecision:'Listening for a good call.', completed:0
    });
  }

  nodeById(id){ return this.nodes.find((node) => node.id===id); }
  deliveryById(id){ return this.deliveries.find((delivery) => delivery.id===id); }
  courierById(id){ return this.couriers.find((courier) => courier.id===id); }
  districtForNode(nodeId){ return districtById(this.nodeById(nodeId)?.districtId); }
  landmarkForNode(nodeId){ return landmarkById(this.nodeById(nodeId)?.landmarkId); }
  edgeByIds(a,b){ return this.edges.find((edge) => edgeKey(edge.a,edge.b)===edgeKey(a,b)); }

  randomEndpoint(excludeId=null) {
    const candidates=this.nodes.filter((node) => node.id!==excludeId && node.id!==this.depotNodeId);
    const landmarkGoal=this.goals?.find((goal) => goal.type==='landmark' && !goal.complete);
    if (landmarkGoal && this.rng.chance(0.18)) {
      const target=candidates.find((node) => node.landmarkId===landmarkGoal.targetId); if (target) return target;
    }
    const districtGoal=this.goals?.find((goal) => goal.type==='district' && !goal.complete);
    if (districtGoal && this.rng.chance(0.11)) {
      const local=candidates.filter((node) => node.districtId===districtGoal.targetId); if (local.length) return this.rng.pick(local);
    }
    const landmarks=candidates.filter((node) => node.kind==='landmark');
    if (landmarks.length && this.rng.chance(this.modifiers.landmarkBias)) return this.rng.pick(landmarks);
    return this.rng.pick(candidates);
  }

  spawnDelivery() {
    if (this.activeDeliveries().length>=30) return;
    const pickup=this.randomEndpoint(), dropoff=this.randomEndpoint(pickup?.id);
    if (!pickup || !dropoff) return;
    const typeKey=this.rng.pick(Object.keys(DELIVERY_TYPES)), type=DELIVERY_TYPES[typeKey];
    const route=shortestPath(this.nodes,this.edges,pickup.id,dropoff.id,this.edgeCost.bind(this));
    const routeDistance=this.pathDistance(route)||distance(pickup,dropoff);
    const deadline=type.baseDeadline*this.modifiers.deadline*(0.82+routeDistance/720)/(1+(this.wave-1)*0.018);
    const id=`d${this.deliverySerial++}`;
    this.deliveries.push({ id,type:typeKey,pickupId:pickup.id,dropoffId:dropoff.id,createdAt:this.elapsed,deadlineAt:this.elapsed+deadline,
      reward:Math.round((type.reward+routeDistance/80)*this.modifiers.reward),status:'waiting',called:false,channel:null,courierId:null,
      pickedUp:false,firstCalledAt:null,claimedAt:null,edgesTraversed:[],callHistory:[] });
    this.runStats.peakActive=Math.max(this.runStats.peakActive,this.activeDeliveries().length);
  }

  activeDeliveries(){ return this.deliveries.filter((d) => d.status==='waiting'||d.status==='claimed'); }
  calledDeliveries(){ return this.deliveries.filter((d) => d.status==='waiting'&&d.called); }
  calledCount(){ return this.calledDeliveries().length; }
  radioCost(delivery){ return delivery?.called ? (RADIO_CHANNELS[delivery.channel]?.cost ?? 1) : 0; }
  radioUsed(){ return this.calledDeliveries().reduce((sum,delivery) => sum+this.radioCost(delivery),0); }

  toggleCall(deliveryId) {
    const delivery=this.deliveryById(deliveryId);
    if (!delivery || delivery.status!=='waiting') return false;
    if (delivery.called) return this.setChannel(deliveryId,null);
    return this.setChannel(deliveryId,'open');
  }

  setChannel(deliveryId,channelId) {
    const delivery=this.deliveryById(deliveryId);
    if (!delivery || delivery.status!=='waiting') return false;
    if (channelId===null || channelId==='off') {
      if (!delivery.called) return true;
      const previous=delivery.channel;
      delivery.called=false; delivery.channel=null;
      delivery.callHistory.push({at:this.elapsed,channel:null});
      this.logDispatch('uncall',delivery,{channel:previous});
      this.flash(`Radio withdrawn: ${this.deliveryLabel(delivery)}.`);
      this.invalidateDeliberations(delivery.id);
      return true;
    }
    const channel=RADIO_CHANNELS[channelId];
    if (!channel) return false;
    const currentCost=this.radioCost(delivery), nextUsed=this.radioUsed()-currentCost+channel.cost;
    if (nextUsed>this.radioSlots) {
      this.runStats.radioDenied+=1;
      this.logDispatch('radio-denied',delivery,{channel:channelId,used:this.radioUsed()});
      this.flash(`Radio bandwidth full — ${channel.label} needs ${channel.cost}, ${this.radioSlots-this.radioUsed()+currentCost} free.`);
      return false;
    }
    const wasCalled=delivery.called, previous=delivery.channel;
    delivery.called=true; delivery.channel=channelId; delivery.firstCalledAt ??= this.elapsed;
    delivery.callHistory.push({at:this.elapsed,channel:channelId});
    this.selectedDeliveryId=delivery.id;
    this.runStats.peakRadio=Math.max(this.runStats.peakRadio,this.radioUsed());
    this.logDispatch(wasCalled?'channel':'call',delivery,{channel:channelId,previous});
    this.flash(`${channel.short}: ${this.deliveryLabel(delivery)}. Riders are considering it.`);
    for (const courier of this.couriers) if (courier.phase==='idle') {
      courier.decisionAt=Math.min(courier.decisionAt,this.elapsed+0.22);
      if (courier.deliberation && courier.deliberation.deliveryId!==delivery.id) courier.deliberation=null;
    }
    return true;
  }

  invalidateDeliberations(deliveryId) {
    for (const courier of this.couriers) if (courier.deliberation?.deliveryId===deliveryId) {
      courier.deliberation=null; courier.decisionAt=this.elapsed+0.12;
    }
  }

  selectDelivery(id){ this.selectedDeliveryId=this.selectedDeliveryId===id?null:id; }
  selectCourier(id){ this.selectedCourierId=this.selectedCourierId===id?null:id; }

  routeTravelCost(startId,goalId) {
    const route=shortestPath(this.nodes,this.edges,startId,goalId,this.edgeCost.bind(this));
    if (!route.length) return Infinity;
    let total=0;
    for (let i=1;i<route.length;i+=1) {
      const edge=this.edgeByIds(route[i-1],route[i]); total+=edge?this.edgeCost(edge):0;
    }
    return total;
  }

  courierChoiceScore(courier,delivery,withNoise=true) {
    const pickup=this.nodeById(delivery.pickupId), current=this.nodeById(courier.nodeId);
    const travelCost=Math.max(1,this.routeTravelCost(courier.nodeId,pickup.id));
    const closeness=1/(1+travelCost/180), urgency=1-this.urgency(delivery), reward=Math.min(1.7,delivery.reward/26);
    const isMedical=delivery.type==='medical'?1:0;
    const isLandmark=pickup.kind==='landmark'||this.nodeById(delivery.dropoffId).kind==='landmark'?1:0;
    const sameDistrict=current.districtId&&current.districtId===pickup.districtId?1:0;
    const longRide=Math.min(1,travelCost/520), w=courier.personality.weights;
    let score=closeness*(w.distance??0)+urgency*(w.urgency??0)+reward*(w.reward??0)+isMedical*(w.medical??0)+
      isLandmark*(w.landmark??0)+sameDistrict*(w.sameDistrict??0)+longRide*(w.longRide??0);
    if (delivery.channel==='priority') score+=0.55;
    if (delivery.channel==='local') {
      score+=sameDistrict?0.72:closeness>0.58?0.28:-0.20;
    }
    if (withNoise) {
      const noiseScale=courier.experience.noise/this.modifiers.teamSkill;
      score+=this.rng.float(-noiseScale,noiseScale);
    }
    return score;
  }

  predictCall(courier) {
    if (!courier||courier.phase!=='idle') return null;
    if (courier.deliberation) {
      const delivery=this.deliveryById(courier.deliberation.deliveryId);
      if (delivery?.called&&delivery.status==='waiting') return { delivery,score:courier.deliberation.score,deliberating:true };
    }
    const calls=this.calledDeliveries();
    if (!calls.length) return null;
    return calls.map((delivery) => ({delivery,score:this.courierChoiceScore(courier,delivery,false)})).sort((a,b)=>b.score-a.score)[0]??null;
  }

  beginDeliberation(courier) {
    const calls=this.calledDeliveries();
    if (!calls.length) { courier.lastDecision='No jobs on the radio.'; courier.decisionAt=this.elapsed+this.decisionDelay(courier); return false; }
    const ranked=calls.map((delivery) => ({delivery,score:this.courierChoiceScore(courier,delivery,true)})).sort((a,b)=>b.score-a.score);
    const best=ranked[0];
    if (!best||best.score<0.28) { courier.lastDecision='Waiting for a better-positioned call.'; courier.decisionAt=this.elapsed+this.decisionDelay(courier); return false; }
    const duration=Math.max(0.34,courier.experience.think/this.modifiers.teamSkill*this.rng.float(0.52,0.88));
    courier.deliberation={ deliveryId:best.delivery.id, startedAt:this.elapsed, readyAt:this.elapsed+duration, score:best.score,
      runnerUp:ranked[1]?.delivery.id??null, reason:this.choiceReason(courier,best.delivery) };
    courier.lastDecision=`Considering ${best.delivery.id.toUpperCase()} · ${courier.deliberation.reason}`;
    return true;
  }

  deliberationProgress(courier) {
    if (!courier?.deliberation) return 0;
    const total=Math.max(0.001,courier.deliberation.readyAt-courier.deliberation.startedAt);
    return Math.max(0,Math.min(1,(this.elapsed-courier.deliberation.startedAt)/total));
  }

  resolveDeliberation(courier) {
    const thought=courier.deliberation;
    if (!thought) return false;
    const delivery=this.deliveryById(thought.deliveryId);
    courier.deliberation=null;
    if (!delivery||delivery.status!=='waiting'||!delivery.called) {
      courier.lastDecision='That call vanished before I committed.';
      courier.decisionAt=this.elapsed+0.16;
      return false;
    }
    const claimed=this.claim(courier,delivery,thought.score);
    if (!claimed) courier.decisionAt=this.elapsed+this.decisionDelay(courier);
    return claimed;
  }

  claim(courier,delivery,score=0) {
    if (!courier||!delivery||courier.phase!=='idle'||delivery.status!=='waiting'||!delivery.called) return false;
    const path=shortestPath(this.nodes,this.edges,courier.nodeId,delivery.pickupId,this.edgeCost.bind(this));
    if (!path.length) return false;
    delivery.status='claimed'; delivery.called=false; delivery.claimedAt=this.elapsed; delivery.courierId=courier.id;
    courier.deliveryId=delivery.id; courier.phase='pickup'; courier.deliberation=null; this.setCourierPath(courier,path,delivery.pickupId);
    const pickup=this.nodeById(delivery.pickupId), district=districtById(pickup.districtId)?.name??'Berlin';
    courier.lastDecision=`Took ${delivery.id.toUpperCase()} · ${this.choiceReason(courier,delivery)}`;
    this.runStats.riderChoices+=1;
    this.logDispatch('claim',delivery,{rider:courier.name,personality:courier.personality.id,score});
    this.invalidateDeliberations(delivery.id);
    this.flash(`${courier.name} chose ${this.deliveryLabel(delivery)} near ${district}.`);
    return true;
  }

  choiceReason(courier,delivery) {
    const pickup=this.nodeById(delivery.pickupId), current=this.nodeById(courier.nodeId), d=distance(current,pickup);
    if (delivery.channel==='priority') return 'priority signal';
    if (delivery.channel==='local'&&current.districtId===pickup.districtId) return 'local call nearby';
    if (delivery.type==='medical'&&courier.personality.id==='guardian') return 'medical priority';
    if (this.urgency(delivery)<0.34) return 'deadline pressure';
    if (courier.personality.id==='earner') return `€${delivery.reward} payout`;
    if (courier.personality.id==='tourer'&&(pickup.kind==='landmark'||this.nodeById(delivery.dropoffId).kind==='landmark')) return 'landmark route';
    if (d<160) return 'close pickup';
    return courier.personality.title.toLowerCase();
  }

  edgeCost(edge){ return edge.distance/Math.max(0.18,edge.speed*(edge.eventMultiplier??1)); }
  setCourierPath(courier,path,targetNodeId) {
    courier.path=path; courier.pathIndex=path.length>1?1:path.length; courier.targetNodeId=targetNodeId; courier.progress=0;
    if (path.length<=1) this.arrive(courier);
  }
  pathDistance(path) {
    if (!path||path.length<2) return 0;
    let total=0;
    for (let i=1;i<path.length;i+=1) total+=this.edgeByIds(path[i-1],path[i])?.distance??0;
    return total;
  }

  moveCourier(courier,dt) {
    if (courier.phase==='idle'||courier.pathIndex>=courier.path.length) return;
    const target=this.nodeById(courier.path[courier.pathIndex]), dx=target.x-courier.x, dy=target.y-courier.y, remaining=Math.hypot(dx,dy);
    const edgeFromId=courier.path[Math.max(0,courier.pathIndex-1)], edge=this.edgeByIds(edgeFromId,target.id);
    if (remaining<0.001) { this.finishEdge(courier,target,edge); return; }
    const velocity=courier.baseSpeed*courier.experience.speed*this.modifiers.speed*(edge?.speed??1)*(edge?.eventMultiplier??1);
    const step=Math.min(remaining,velocity*dt);
    courier.x+=dx/remaining*step; courier.y+=dy/remaining*step; this.runStats.distance+=step;
    if ((edge?.eventMultiplier??1)<0.99) this.runStats.eventExposure+=step;
    if (step>=remaining-0.001) this.finishEdge(courier,target,edge);
  }

  finishEdge(courier,target,edge) {
    courier.x=target.x; courier.y=target.y; courier.nodeId=target.id; courier.pathIndex+=1;
    const delivery=this.deliveryById(courier.deliveryId);
    if (delivery?.pickedUp&&edge) delivery.edgesTraversed.push(edge.id);
    if (courier.pathIndex>=courier.path.length) { this.arrive(courier); return; }
    if (this.currentEvent?.state==='active') this.rerouteCourier(courier);
  }

  rerouteCourier(courier) {
    if (!courier.targetNodeId||courier.nodeId===courier.targetNodeId) return;
    const route=shortestPath(this.nodes,this.edges,courier.nodeId,courier.targetNodeId,this.edgeCost.bind(this));
    if (route.length) { courier.path=route; courier.pathIndex=route.length>1?1:route.length; }
  }

  arrive(courier) {
    const delivery=this.deliveryById(courier.deliveryId);
    if (!delivery) { this.releaseCourier(courier); return; }
    if (courier.phase==='pickup') {
      delivery.pickedUp=true; courier.phase='dropoff'; delivery.edgesTraversed=[];
      this.setCourierPath(courier,shortestPath(this.nodes,this.edges,courier.nodeId,delivery.dropoffId,this.edgeCost.bind(this)),delivery.dropoffId);
      this.flash(`${courier.name} picked up ${this.deliveryLabel(delivery)}.`); return;
    }
    if (courier.phase==='dropoff') this.completeDelivery(courier,delivery);
  }

  completeDelivery(courier,delivery) {
    delivery.status='completed'; delivery.completedAt=this.elapsed; this.completed+=1; courier.completed+=1;
    const early=Math.max(0,delivery.deadlineAt-this.elapsed), earned=delivery.reward;
    this.cash+=earned; this.score+=earned*10+Math.round(early*3); this.reputation=Math.min(100,this.reputation+1.35);
    this.updateGoals(delivery); this.logDispatch('complete',delivery,{rider:courier.name,early}); this.releaseCourier(courier);
    this.flash(`${courier.name} delivered ${delivery.id.toUpperCase()} · +€${earned}`);
    if (this.completed>=this.nextUpgradeAt) this.upgradePending=true;
  }

  releaseCourier(courier) {
    courier.deliveryId=null; courier.phase='idle'; courier.path=[]; courier.pathIndex=0; courier.targetNodeId=null; courier.deliberation=null;
    courier.decisionAt=this.elapsed+this.decisionDelay(courier);
  }
  decisionDelay(courier){ return Math.max(0.28,courier.experience.think/this.modifiers.teamSkill*this.rng.float(0.72,1.28)); }

  failDelivery(delivery) {
    if (delivery.status!=='waiting'&&delivery.status!=='claimed') return;
    const courier=delivery.courierId?this.courierById(delivery.courierId):null;
    const failureKind=delivery.claimedAt!=null?'claimed-late':delivery.firstCalledAt==null?'never-called':'called-unclaimed';
    delivery.status='failed'; delivery.called=false; delivery.channel=null; delivery.failureKind=failureKind; this.failed+=1;
    const penalty=delivery.type==='medical'?18:11;
    this.reputation=Math.max(0,this.reputation-penalty); this.score=Math.max(0,this.score-penalty*12);
    this.invalidateDeliberations(delivery.id);
    if (courier) { courier.lastDecision=`${delivery.id.toUpperCase()} missed — back on radio.`; this.releaseCourier(courier); }
    this.logDispatch('fail',delivery,{kind:failureKind,penalty});
    this.flash(`${delivery.id.toUpperCase()} missed · -${penalty}% reputation`);
    if (this.reputation<=0) { this.gameOver=true; this.paused=true; this.logDispatch('collapse',delivery,{}); }
  }

  urgency(delivery) {
    const total=Math.max(1,delivery.deadlineAt-delivery.createdAt);
    return Math.max(0,Math.min(1,(delivery.deadlineAt-this.elapsed)/total));
  }

  update(dt) {
    if (this.paused||this.gameOver||this.upgradePending) return;
    const scaled=dt*this.speed; this.elapsed+=scaled; this.wave=1+Math.floor(this.elapsed/58); this.spawnAccumulator+=scaled;
    this.updateRoadEvent();
    const interval=Math.max(2.8,9.2-this.wave*0.46);
    while (this.spawnAccumulator>=interval) {
      this.spawnAccumulator-=interval; this.spawnDelivery();
      if (this.wave>=4&&this.rng.chance(Math.min(0.34,0.06+this.wave*0.022))) this.spawnDelivery();
    }
    for (const delivery of [...this.activeDeliveries()]) if (this.elapsed>=delivery.deadlineAt) this.failDelivery(delivery);
    for (const courier of this.couriers) {
      if (courier.phase==='idle') {
        if (courier.deliberation) {
          const target=this.deliveryById(courier.deliberation.deliveryId);
          if (!target||target.status!=='waiting'||!target.called) { courier.deliberation=null; courier.decisionAt=this.elapsed+0.12; }
          else if (this.elapsed>=courier.deliberation.readyAt) this.resolveDeliberation(courier);
        } else if (this.elapsed>=courier.decisionAt) this.beginDeliberation(courier);
      } else this.moveCourier(courier,scaled);
    }
  }

  scheduleRoadEvent() {
    const template=this.rng.pick(ROAD_EVENT_TYPES);
    let edges=[]; let place='central Berlin';
    if (template.bridgeOnly) {
      const bridge=this.rng.pick(BERLIN.bridges), edge=this.edgeByIds(...bridge.edge);
      if (edge) { edges=[edge]; place=bridge.short; }
    }
    if (!edges.length) {
      const central=this.edges.filter((edge) => {
        const a=this.nodeById(edge.a), b=this.nodeById(edge.b), mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
        return mx>430&&mx<920&&my>220&&my<560&&!edge.bikeLane;
      });
      edges=this.rng.shuffle(central.length?central:this.edges).slice(0,this.rng.chance(0.35)?2:1);
      if (edges[0]) {
        const a=this.nodeById(edges[0].a), b=this.nodeById(edges[0].b); place=`${a.short??a.name} ↔ ${b.short??b.name}`;
      }
    }
    const startsAt=this.nextEventAt, duration=this.rng.float(template.duration[0],template.duration[1]);
    this.currentEvent={ id:`event-${Math.round(startsAt)}`, type:template.id, title:template.title, detail:template.forecast,
      place, state:'forecast', startsAt, endsAt:startsAt+duration, factor:template.factor, edgeIds:edges.map((edge)=>edge.id) };
    this.logDispatch('event-forecast',null,{title:template.title,place,startsAt});
    this.flash(`${template.title} forecast · ${place} in ${Math.ceil(startsAt-this.elapsed)}s`,5);
  }

  updateRoadEvent() {
    if (!this.currentEvent && this.elapsed>=this.nextEventAt-9) this.scheduleRoadEvent();
    const event=this.currentEvent;
    if (!event) return;
    if (event.state==='forecast'&&this.elapsed>=event.startsAt) {
      event.state='active';
      for (const edge of this.edges.filter((e)=>event.edgeIds.includes(e.id))) edge.eventMultiplier=event.factor;
      this.logDispatch('event-start',null,{title:event.title,place:event.place});
      this.flash(`${event.title} ACTIVE · ${event.place}`,5);
    }
    if (event.state==='active'&&this.elapsed>=event.endsAt) {
      for (const edge of this.edges.filter((e)=>event.edgeIds.includes(e.id))) edge.eventMultiplier=1;
      this.logDispatch('event-end',null,{title:event.title,place:event.place});
      this.flash(`${event.title} cleared · ${event.place}`,4);
      this.currentEvent=null; this.nextEventAt=this.elapsed+42+this.rng.float(0,28);
    }
  }

  generateGoals() {
    const goals=[];
    const landmark=this.rng.pick(this.landmarks);
    goals.push({ id:'landmark',type:'landmark',targetId:landmark.id,label:`Serve ${landmark.short}`,detail:`Complete 4 jobs touching ${landmark.name}.`,progress:0,target:4,reward:18,complete:false });
    const district=this.rng.pick(this.districts.filter((d)=>d.id!==landmark.districtId));
    goals.push({ id:'district',type:'district',targetId:district.id,label:`Cover ${district.name}`,detail:`Complete 6 jobs starting or ending in ${district.name}.`,progress:0,target:6,reward:20,complete:false });
    if (this.rng.chance(0.52)) {
      const bridge=this.rng.pick(BERLIN.bridges);
      goals.push({ id:'spree',type:'bridge',targetId:bridge.id,label:`Use ${bridge.short}`,detail:`Complete 3 deliveries that cross ${bridge.name}.`,progress:0,target:3,reward:22,complete:false });
    } else {
      goals.push({ id:'spree',type:'spree',targetId:null,label:'Cross the Spree',detail:'Complete 5 deliveries using any marked Spree bridge.',progress:0,target:5,reward:22,complete:false });
    }
    goals.push({ id:'reliability',type:'reliability',targetId:null,label:'Reliable radio',detail:'Complete 12 deliveries this shift.',progress:0,target:12,reward:24,complete:false });
    return goals;
  }

  updateGoals(delivery) {
    for (const goal of this.goals) {
      if (goal.complete) continue;
      const pickup=this.nodeById(delivery.pickupId), dropoff=this.nodeById(delivery.dropoffId);
      const crossedBridgeIds=new Set(delivery.edgesTraversed.map((edgeId) => this.edges.find((edge)=>edge.id===edgeId)?.bridgeId).filter(Boolean));
      let hit=false;
      if (goal.type==='landmark') hit=pickup.landmarkId===goal.targetId||dropoff.landmarkId===goal.targetId;
      if (goal.type==='district') hit=pickup.districtId===goal.targetId||dropoff.districtId===goal.targetId;
      if (goal.type==='bridge') hit=crossedBridgeIds.has(goal.targetId);
      if (goal.type==='spree') hit=crossedBridgeIds.size>0;
      if (goal.type==='reliability') hit=true;
      if (!hit) continue;
      goal.progress+=1;
      if (goal.progress>=goal.target) {
        goal.complete=true; this.cash+=goal.reward; this.score+=goal.reward*20; this.reputation=Math.min(100,this.reputation+8);
        this.logDispatch('goal',delivery,{goal:goal.label}); this.flash(`CITY GOAL complete: ${goal.label} · +€${goal.reward}`);
      }
    }
  }

  getUpgradeChoices(){ return this.rng.shuffle(UPGRADES).slice(0,3); }
  applyUpgrade(id) {
    const upgrade=UPGRADES.find((item)=>item.id===id);
    if (!upgrade||!this.upgradePending) return false;
    upgrade.apply(this); this.upgradePending=false; this.nextUpgradeAt+=7+Math.floor(this.nextUpgradeAt/14);
    this.logDispatch('upgrade',null,{upgrade:upgrade.title}); this.flash(`${upgrade.title} added to the shift.`); return true;
  }

  deliveryLabel(delivery) {
    const from=this.nodeById(delivery.pickupId), to=this.nodeById(delivery.dropoffId);
    return `${DELIVERY_TYPES[delivery.type].label}: ${from.short??from.name} → ${to.short??to.name}`;
  }
  nearestIdleDistance(delivery) {
    const pickup=this.nodeById(delivery.pickupId), idle=this.couriers.filter((courier)=>courier.phase==='idle');
    if (!idle.length) return null;
    return Math.min(...idle.map((courier)=>distance(courier,pickup)));
  }
  flash(message,duration=4){ this.notice=message; this.noticeUntil=this.elapsed+duration; }

  logDispatch(action,delivery=null,extra={}) {
    this.dispatchLog.push({ at:this.elapsed,action,deliveryId:delivery?.id??null,urgency:delivery?this.urgency(delivery):null,
      radioUsed:this.radioUsed?.()??0,...extra });
    if (this.dispatchLog.length>180) this.dispatchLog.splice(0,this.dispatchLog.length-180);
  }

  dispatchReview() {
    const finished=this.deliveries.filter((d)=>d.status==='completed'||d.status==='failed');
    const failures=finished.filter((d)=>d.status==='failed');
    const neverCalled=failures.filter((d)=>d.failureKind==='never-called').length;
    const calledUnclaimed=failures.filter((d)=>d.failureKind==='called-unclaimed').length;
    const claimedLate=failures.filter((d)=>d.failureKind==='claimed-late').length;
    const priorityJobs=finished.filter((d)=>d.callHistory.some((entry)=>entry.channel==='priority'));
    const localJobs=finished.filter((d)=>d.callHistory.some((entry)=>entry.channel==='local'));
    const successRate=(jobs) => jobs.length?Math.round(jobs.filter((d)=>d.status==='completed').length/jobs.length*100):null;
    const callDelays=finished.filter((d)=>d.firstCalledAt!=null).map((d)=>(d.firstCalledAt-d.createdAt)/Math.max(1,d.deadlineAt-d.createdAt));
    const averageCallDelay=callDelays.length?Math.round(callDelays.reduce((a,b)=>a+b,0)/callDelays.length*100):null;
    const topRider=[...this.couriers].sort((a,b)=>b.completed-a.completed)[0];
    const advice=[];
    if (neverCalled>=2) advice.push(`${neverCalled} missed jobs never reached the radio. Triage was too conservative when pressure rose.`);
    if (calledUnclaimed>=2) advice.push(`${calledUnclaimed} called jobs expired without a rider. Fewer, better-fitting calls would reduce radio noise.`);
    if (claimedLate>=2) advice.push(`${claimedLate} jobs were accepted but still arrived late. Call earlier or avoid routes exposed to disruptions.`);
    if (this.runStats.radioDenied>=2) advice.push(`Bandwidth blocked ${this.runStats.radioDenied} call changes. Preserve a slot for true priority work.`);
    if (averageCallDelay!=null&&averageCallDelay>42) advice.push(`On average, jobs spent ${averageCallDelay}% of their deadline uncalled. Earlier signalling would give riders more options.`);
    if (!advice.length) advice.push('Radio discipline was solid. The next improvement is matching channel type to rider location before the rush peaks.');
    const timeline=this.dispatchLog.filter((entry)=>['call','channel','claim','fail','event-start','goal'].includes(entry.action)).slice(-8).map((entry)=>this.describeLog(entry));
    return {
      neverCalled,calledUnclaimed,claimedLate,radioDenied:this.runStats.radioDenied,averageCallDelay,
      prioritySuccess:successRate(priorityJobs),localSuccess:successRate(localJobs),
      topRider:topRider?`${topRider.name} · ${topRider.completed} deliveries · ${topRider.personality.title}`:'—',
      advice,timeline
    };
  }

  describeLog(entry) {
    const t=`${Math.floor(entry.at/60)}:${String(Math.floor(entry.at%60)).padStart(2,'0')}`;
    const id=entry.deliveryId?.toUpperCase()??'';
    if (entry.action==='call') return `${t} · ${id} called ${String(entry.channel??'open').toUpperCase()}`;
    if (entry.action==='channel') return `${t} · ${id} changed to ${String(entry.channel).toUpperCase()}`;
    if (entry.action==='claim') return `${t} · ${entry.rider} took ${id}`;
    if (entry.action==='fail') return `${t} · ${id} missed · ${entry.kind.replaceAll('-',' ')}`;
    if (entry.action==='event-start') return `${t} · ${entry.title} · ${entry.place}`;
    if (entry.action==='goal') return `${t} · goal complete · ${entry.goal}`;
    return `${t} · ${entry.action}`;
  }

  nearestEntity(x,y,maxDistance=28) {
    let best=null;
    for (const delivery of this.activeDeliveries()) {
      const node=this.nodeById(delivery.pickedUp?delivery.dropoffId:delivery.pickupId), d=Math.hypot(node.x-x,node.y-y);
      if (d<=maxDistance&&(!best||d<best.distance)) best={type:'delivery',id:delivery.id,distance:d};
    }
    for (const courier of this.couriers) {
      const d=Math.hypot(courier.x-x,courier.y-y);
      if (d<=maxDistance&&(!best||d<best.distance)) best={type:'courier',id:courier.id,distance:d};
    }
    return best;
  }

  summary() {
    return { score:Math.round(this.score),completed:this.completed,failed:this.failed,wave:this.wave,
      distanceKm:(this.runStats.distance/1000).toFixed(1),seed:this.seed,goals:this.goals.filter((g)=>g.complete).length,
      riderChoices:this.runStats.riderChoices,review:this.dispatchReview() };
  }
}
