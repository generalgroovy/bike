import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed } from '../src/rng.js';
import { shortestPath } from '../src/graph.js';
import { BERLIN } from '../src/berlin.js';
import { Game, DELIVERY_TYPES, COURIER_NAMES, RADIO_CHANNELS } from '../src/game.js';

test('seed hashing and RNG remain deterministic',()=>{assert.equal(hashSeed('BERLIN-42'),hashSeed('BERLIN-42'));const a=new RNG('x'),b=new RNG('x');assert.deepEqual(Array.from({length:10},()=>a.next()),Array.from({length:10},()=>b.next()));});

test('Berlin map is a detailed simplified real-street graph',()=>{assert.ok(BERLIN.nodes.length>=65);assert.ok(BERLIN.streets.length>=35);const names=new Set(BERLIN.streets.map((s)=>s.name));for(const name of ['Kurfürstendamm','Straße des 17. Juni','Unter den Linden','Friedrichstraße','Karl-Marx-Allee','Warschauer Straße','Oranienstraße','Sonnenallee','Hermannstraße'])assert.ok(names.has(name),name);});

test('Berlin macro layout retains recognizable west/east/north/south relationships',()=>{const by=new Map(BERLIN.nodes.map((n)=>[n.id,n]));assert.ok(by.get('zoo').x<by.get('brandenburg').x);assert.ok(by.get('alex').x>by.get('brandenburg').x);assert.ok(by.get('mauerpark').y<by.get('alex').y);assert.ok(by.get('tempelhofer').y>by.get('checkpoint').y);assert.ok(by.get('warschauer').x>by.get('alex').x);});

test('same seed creates same roster, jobs and goals',()=>{const a=new Game({seed:'REPRO'}),b=new Game({seed:'REPRO'});assert.deepEqual(a.couriers.map((c)=>[c.name,c.personality.id,c.experience.level,c.homeDistrict]),b.couriers.map((c)=>[c.name,c.personality.id,c.experience.level,c.homeDistrict]));assert.deepEqual(a.goals,b.goals);assert.deepEqual(a.activeDeliveries(),b.activeDeliveries());});

test('all generated Berlin nodes are routable across seeds',()=>{for(let i=0;i<20;i+=1){const game=new Game({seed:`ROUTE-${i}`});for(const node of game.nodes){const path=shortestPath(game.nodes,game.edges,game.depotNodeId,node.id,game.edgeCost.bind(game));assert.ok(path.length>0,`${i}:${node.id}`);}}});

test('rider roster uses requested names in order',()=>{const game=new Game({seed:'NAMES'});assert.deepEqual(game.couriers.map((c)=>c.name),COURIER_NAMES.slice(0,3));while(game.addCourier());assert.deepEqual(game.couriers.map((c)=>c.name),COURIER_NAMES);assert.deepEqual(COURIER_NAMES,['Kira','Mauro','Brian','Sam','Michail','Zorro']);});

test('radio channels have explicit bandwidth costs',()=>{assert.equal(RADIO_CHANNELS.open.cost,1);assert.equal(RADIO_CHANNELS.priority.cost,2);assert.equal(RADIO_CHANNELS.local.cost,1);const game=new Game({seed:'RADIO'}),jobs=game.activeDeliveries();assert.equal(game.setChannel(jobs[0].id,'priority'),true);assert.equal(game.radioUsed(),2);assert.equal(game.setChannel(jobs[1].id,'open'),true);assert.equal(game.radioUsed(),3);});

test('dispatcher never directly assigns riders',()=>{const game=new Game({seed:'INDIRECT'});assert.equal(typeof game.assign,'undefined');});

test('rider break turns radio off and prevents deliberation',()=>{const game=new Game({seed:'BREAK'}),rider=game.couriers[0],job=game.activeDeliveries()[0];game.setChannel(job.id,'open');rider.phase='idle';assert.equal(game.startBreak(rider,5),true);assert.equal(rider.radioOn,false);assert.equal(rider.phase,'break');assert.equal(game.predictCall(rider),null);game.update(2);assert.equal(rider.phase,'break');game.update(4);assert.equal(rider.radioOn,true);assert.equal(rider.phase,'idle');});

test('fatigued rider can be forced onto autonomous break after delivery release',()=>{const game=new Game({seed:'FATIGUE'}),rider=game.couriers[0];rider.fatigue=.95;rider.phase='idle';game.releaseCourier(rider,true);assert.equal(rider.phase,'break');assert.equal(rider.radioOn,false);});

test('idle radio-on rider autonomously claims a broadcast job',()=>{const game=new Game({seed:'CLAIM'}),job=game.activeDeliveries()[0];game.setChannel(job.id,'priority');for(const rider of game.couriers){rider.decisionAt=0;rider.experience={...rider.experience,think:.01};}for(let i=0;i<20&&job.status==='waiting';i++)game.update(.1);assert.equal(job.status,'claimed');assert.ok(job.courierId);});

test('delivery type remains independent of district identity',()=>{const game=new Game({seed:'INDEPENDENT'}),seen=new Map(game.districts.map((d)=>[d.id,new Set()]));for(let i=0;i<650;i+=1){game.deliveries=[];game.spawnDelivery();const d=game.deliveries[0];if(!d)continue;seen.get(game.nodeById(d.pickupId).districtId)?.add(d.type);}const observed=[...seen.values()].filter((s)=>s.size);assert.ok(observed.length>=7);for(const set of observed)assert.ok(set.size>=3);assert.equal(Object.keys(DELIVERY_TYPES).length,6);});

test('bridge goals depend on ridden bridge edges',()=>{const game=new Game({seed:'BRIDGE'}),goal=game.goals.find((g)=>g.type==='bridge');assert.ok(goal);const bridge=BERLIN.bridges.find((b)=>b.id===goal.targetId),edge=game.edgeByIds(...bridge.edge);assert.ok(edge);const delivery={pickupId:bridge.edge[0],dropoffId:bridge.edge[1],edgesTraversed:[edge.id]};const before=goal.progress;game.updateGoals(delivery);assert.equal(goal.progress,before+1);});

test('street events modify route cost and recover',()=>{const game=new Game({seed:'EVENT'}),edge=game.edges.find((e)=>e.roadClass==='primary');const normal=game.edgeCost(edge);edge.eventMultiplier=.5;assert.ok(game.edgeCost(edge)>normal);edge.eventMultiplier=1;assert.equal(game.edgeCost(edge),normal);});

test('forty autonomous seeded simulations keep finite state',()=>{for(let seed=0;seed<40;seed+=1){const game=new Game({seed:`STRESS-${seed}`});for(let tick=0;tick<1200&&!game.gameOver;tick+=1){if(tick%22===0){for(const d of game.activeDeliveries().filter((d)=>d.status==='waiting'&&!d.called).slice(0,2)){if(game.radioUsed()<game.radioSlots)game.setChannel(d.id,tick%44===0?'local':'open');}}game.update(.25);for(const c of game.couriers){assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.fatigue));}}}});
