import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG,hashSeed } from '../src/rng.js';
import { createGraphIndex,shortestPathIndexed } from '../src/graph.js';
import { BERLIN } from '../src/berlin.js';
import { Game,COURIER_NAMES,DELIVERY_TYPES,RADIO_CHANNELS } from '../src/game.js';

test('seed hashing and RNG are deterministic',()=>{assert.equal(hashSeed('BERLIN-42'),hashSeed('BERLIN-42'));const a=new RNG('same'),b=new RNG('same');assert.deepEqual(Array.from({length:12},()=>a.next()),Array.from({length:12},()=>b.next()));});

test('Berlin graph is substantially dense and street based',()=>{assert.ok(BERLIN.visualEdges.length>500,`visual edges ${BERLIN.visualEdges.length}`);assert.ok(BERLIN.nodes.length>900,`nodes ${BERLIN.nodes.length}`);assert.ok(BERLIN.streetCatalog.length>110,`streets ${BERLIN.streetCatalog.length}`);for(const name of['Kurfürstendamm','Friedrichstraße','Karl-Marx-Allee','Skalitzer Straße','Sonnenallee','Hermannstraße','Schönhauser Allee','Hohenzollerndamm','Landsberger Allee'])assert.ok(BERLIN.streetCatalog.includes(name),name);});

test('address pool contains street number postcode and unique labels',()=>{assert.ok(BERLIN.addressNodes.length>600,`addresses ${BERLIN.addressNodes.length}`);const labels=new Set();for(const n of BERLIN.addressNodes){assert.equal(n.kind,'address');assert.ok(n.streetName);assert.ok(Number.isInteger(n.houseNumber)&&n.houseNumber>0);assert.match(n.postcode,/^\d{5}$/);assert.match(n.addressLabel,/\s\d+$/);labels.add(n.addressLabel);}assert.equal(labels.size,BERLIN.addressNodes.length);});

test('dense graph is connected from the dispatch base',()=>{const index=createGraphIndex(BERLIN.nodes,BERLIN.edges),start=BERLIN.landmarks.find(l=>l.id==='checkpoint').addressNodeId;for(const n of BERLIN.addressNodes.filter((_,i)=>i%9===0)){const path=shortestPathIndexed(index,start,n.id);assert.ok(path.length>0,`unreachable ${n.addressLabel}`);}});

test('same seed reproduces city conditions roster goals and initial contracts',()=>{const a=new Game({seed:'REPRO-1'}),b=new Game({seed:'REPRO-1'});assert.equal(a.runTrait.id,b.runTrait.id);assert.equal(a.runContract.id,b.runContract.id);assert.deepEqual(a.couriers.map(c=>[c.name,c.personality.id,c.experience.level]),b.couriers.map(c=>[c.name,c.personality.id,c.experience.level]));assert.deepEqual(a.goals,b.goals);assert.deepEqual(a.deliveries.map(d=>[d.type,d.pickupAddress,d.dropoffAddress,d.reward,d.specialId]),b.deliveries.map(d=>[d.type,d.pickupAddress,d.dropoffAddress,d.reward,d.specialId]));});

test('canonical rider roster is exact and upgrade order is stable',()=>{assert.deepEqual(COURIER_NAMES,['Kira','Mauro','Brian','Sam','Michail','Zorro']);const g=new Game({seed:'ROSTER'});assert.deepEqual(g.couriers.map(c=>c.name),['Kira','Mauro','Brian']);g.addCourier();g.addCourier();g.addCourier();assert.deepEqual(g.couriers.map(c=>c.name),COURIER_NAMES);});

test('every generated delivery is an address-to-address contract',()=>{const g=new Game({seed:'ADDRESSES'});for(let i=0;i<20;i++)g.spawnDelivery();for(const d of g.deliveries){assert.match(d.pickupAddress,/\s\d+$/);assert.match(d.dropoffAddress,/\s\d+$/);assert.notEqual(d.pickupAddress,d.dropoffAddress);assert.ok(d.plannedDistance>0);assert.ok(d.plannedStreets.length>0);assert.ok(Object.hasOwn(DELIVERY_TYPES,d.type));assert.ok(d.plannedPath.length>1);}});

test('delivery cargo remains independent from district identity once full Ring is unlocked',()=>{const g=new Game({seed:'CARGO'});g.cityLevel=3;const seen=new Map();for(let i=0;i<220;i++){g.deliveries=[];g.spawnDelivery();const d=g.deliveries[0];if(!d)continue;const set=seen.get(d.pickupDistrict)??new Set();set.add(d.type);seen.set(d.pickupDistrict,set);}assert.ok(seen.size>=7,`districts ${seen.size}`);for(const set of seen.values())assert.ok(set.size>=2);});

test('dispatcher has no direct rider assignment command',()=>{const g=new Game({seed:'INDIRECT'});assert.equal(typeof g.assign,'undefined');assert.equal(typeof g.assignCourier,'undefined');});

test('radio bandwidth accounts for OPEN PRIORITY LOCAL and OFF',()=>{const g=new Game({seed:'RADIO'}),[a,b,c]=g.activeDeliveries();assert.equal(RADIO_CHANNELS.priority.cost,2);assert.equal(g.setChannel(a.id,'priority'),true);assert.equal(g.radioUsed(),2);assert.equal(g.setChannel(b.id,'open'),true);assert.equal(g.radioUsed(),3);assert.equal(g.setChannel(c.id,'local'),true);assert.equal(g.radioUsed(),4);assert.equal(g.setChannel(a.id,'off'),true);assert.equal(g.radioUsed(),2);});

test('radio-off rider cannot deliberate or claim',()=>{const g=new Game({seed:'OFF'}),r=g.couriers[0],d=g.activeDeliveries()[0];g.setChannel(d.id,'open');r.phase='break';r.radioOn=false;r.breakUntil=999;assert.equal(g.beginDeliberation(r),false);assert.equal(g.claim(r,d),false);});

test('high fatigue produces a visible radio-off break and recovery',()=>{const g=new Game({seed:'BREAK'}),r=g.couriers[0];r.fatigue=.99;r.phase='idle';assert.equal(g.startBreak(r,1),true);assert.equal(r.radioOn,false);assert.equal(r.phase,'break');g.update(1.1);assert.equal(r.phase,'idle');assert.equal(r.radioOn,true);assert.ok(r.fatigue<.5);});

test('idle rider autonomously deliberates then claims a broadcast',()=>{const g=new Game({seed:'CHOICE'}),d=g.activeDeliveries()[0];g.setChannel(d.id,'priority');for(const r of g.couriers)r.decisionAt=0;for(let i=0;i<180&&d.status==='waiting';i++)g.update(1/30);assert.equal(d.status,'claimed');assert.ok(d.courierId);});

test('street goal advances from matching unlocked street endpoint',()=>{const g=new Game({seed:'STREET-GOAL'}),goal=g.goals.find(x=>x.type==='street'),address=g.playableAddressNodes().find(n=>n.streetName===goal.targetId),other=g.playableAddressNodes().find(n=>n.streetName!==goal.targetId),before=goal.progress;assert.ok(address&&other);g.updateGoals({pickupId:address.id,dropoffId:other.id,edgesTraversed:[]});assert.equal(goal.progress,before+1);});

test('bridge goal unlocks with city expansion and advances only for traversed bridge edge',()=>{const g=new Game({seed:'BRIDGE-GOAL'});g.cityLevel=2;g.addExpansionGoals();const goal=g.goals.find(x=>x.type==='bridge');assert.ok(goal);const edge=g.edges.find(e=>e.bridgeId===goal.targetId&&g.edgePlayable(e));assert.ok(edge);const p=g.playableAddressNodes()[0],q=g.playableAddressNodes()[1],before=goal.progress;g.updateGoals({pickupId:p.id,dropoffId:q.id,edgesTraversed:[edge.id]});assert.equal(goal.progress,before+1);});

test('road disruption changes graph edge cost and carries visual segment ids',()=>{const g=new Game({seed:'EVENT'});g.nextEventAt=10;g.elapsed=0;g.scheduleRoadEvent();const ev=g.currentEvent;assert.ok(ev.edgeIds.length>0);assert.ok(ev.visualIds.length>0);const edge=g.edges.find(e=>ev.edgeIds.includes(e.id)),normal=g.edgeCost(edge);g.elapsed=ev.startsAt;g.updateRoadEvent();assert.equal(ev.state,'active');assert.ok(g.edgeCost(edge)>normal);});

test('routing uses named streets throughout a generated trip',()=>{const g=new Game({seed:'ROUTE-NAMES'}),d=g.activeDeliveries()[0],path=g.routeBetween(d.pickupId,d.dropoffId),streets=g.routeStreets(path);assert.ok(path.length>2);assert.ok(streets.length>0);assert.ok(streets.every(s=>typeof s==='string'&&s.length>2));});

test('run contracts produce deterministic roguelike variation',()=>{const ids=new Set();for(let i=0;i<24;i++)ids.add(new Game({seed:`VAR-${i}`}).runContract.id);assert.ok(ids.size>=3);const a=new Game({seed:'VAR-SAME'}),b=new Game({seed:'VAR-SAME'});assert.equal(a.runContract.id,b.runContract.id);});

test('multi-seed autonomous stress run keeps state finite and valid',()=>{for(let s=0;s<16;s++){const g=new Game({seed:`STRESS-${s}`});for(const d of g.activeDeliveries().slice(0,3))g.setChannel(d.id,'open');for(let i=0;i<900&&!g.gameOver;i++){g.update(1/30);if(i%120===0){for(const d of g.activeDeliveries().filter(x=>!x.called&&x.status==='waiting').slice(0,Math.max(0,g.radioSlots-g.radioUsed())))g.setChannel(d.id,'open');}if(g.upgradePending){const choice=g.getUpgradeChoices()[0];g.applyUpgrade(choice.id);}}assert.ok(Number.isFinite(g.score));assert.ok(Number.isFinite(g.reputation));assert.ok(g.reputation>=0&&g.reputation<=100);for(const r of g.couriers){assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.y));assert.ok(r.fatigue>=0&&r.fatigue<=1);}}});
