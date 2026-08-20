import test from 'node:test';
import assert from 'node:assert/strict';
import { BERLIN } from '../src/berlin.js';
import { Game,DELIVERY_TYPES } from '../src/game.js';

test('Ringbahn model covers canonical S41/S42 anchors and a large inner-city graph',()=>{
  assert.ok(BERLIN.ringStations.length>=27,`ring stations ${BERLIN.ringStations.length}`);
  const names=new Set(BERLIN.ringStations.map(s=>s.name));
  for(const name of['Westkreuz','Gesundbrunnen','Ostkreuz','Südkreuz','Hermannstraße','Treptower Park','Beusselstraße'])assert.ok(names.has(name),name);
  assert.equal(BERLIN.ringPath.length,BERLIN.ringStations.length);
  assert.ok(BERLIN.nodes.length>=900);
  assert.ok(BERLIN.visualEdges.length>=500);
  assert.ok(BERLIN.streetCatalog.length>=110);
});

test('new shifts begin in the compact center operating area',()=>{
  const g=new Game({seed:'CENTER-ONLY'});
  assert.equal(g.cityLevel,1);
  assert.equal(g.currentStage().id,'center');
  for(const d of g.activeDeliveries()){
    assert.ok((g.nodeById(d.pickupId).unlockLevel??1)<=1,d.pickupAddress);
    assert.ok((g.nodeById(d.dropoffId).unlockLevel??1)<=1,d.dropoffAddress);
    assert.ok((DELIVERY_TYPES[d.type].unlockLevel??1)<=1,d.type);
  }
});

test('operating territory expands at six and sixteen completed jobs',()=>{
  const g=new Game({seed:'EXPAND'});
  g.completed=6;
  assert.equal(g.maybeAdvanceCity(),true);
  assert.equal(g.cityLevel,2);
  assert.equal(g.currentStage().id,'inner');
  assert.ok(g.radioSlots>=5);
  g.completed=16;
  assert.equal(g.maybeAdvanceCity(),true);
  assert.equal(g.cityLevel,3);
  assert.equal(g.currentStage().id,'ring');
  assert.ok(g.runStats.expansions>=2);
});

test('full Ring unlock exposes outer inner-city districts',()=>{
  const g=new Game({seed:'FULL-RING'});g.cityLevel=3;
  const districts=new Set(g.playableAddressNodes().map(n=>n.districtId));
  for(const id of['wilmersdorf','wedding','tempelhof','neukoelln','moabit','treptow'])assert.ok(districts.has(id),id);
});

test('delivery classes are gated by city progression',()=>{
  const g=new Game({seed:'CARGO-GATE'}),low=new Set();
  for(let i=0;i<100;i++)low.add(g.weightedDeliveryType());
  for(const id of low)assert.ok((DELIVERY_TYPES[id].unlockLevel??1)<=1,id);
  g.cityLevel=3;const high=new Set();for(let i=0;i<180;i++)high.add(g.weightedDeliveryType());
  assert.ok(high.has('catering')||high.has('coldchain'),`seen ${[...high].join(',')}`);
});

test('return special can generate a reverse paid follow-up contract',()=>{
  const g=new Game({seed:'RETURN'});g.cityLevel=3;const original=g.activeDeliveries()[0],before=g.deliveries.length;
  assert.equal(g.spawnReturnLeg(original),true);
  assert.equal(g.deliveries.length,before+1);
  const follow=g.deliveries.at(-1);
  assert.equal(follow.pickupId,original.dropoffId);
  assert.equal(follow.dropoffId,original.pickupId);
  assert.equal(follow.specialId,'return-leg');
  assert.equal(follow.parentId,original.id);
});

test('cash bonus, client call and rebroadcast reshape one contract without assigning a rider',()=>{
  const g=new Game({seed:'TOOLS'}),d=g.activeDeliveries()[0];g.cash=20;
  const reward=d.reward;
  assert.equal(g.sweetenJob(d.id),true);
  assert.equal(g.cash,15);
  assert.equal(d.reward,reward+9);
  assert.ok(d.bonusAppeal>0);
  const deadline=d.deadlineAt,focus=g.dispatchFocus;
  assert.equal(g.extendJob(d.id),true);
  assert.equal(d.deadlineAt,deadline+20);
  assert.equal(g.dispatchFocus,focus-1);
  assert.equal(g.setChannel(d.id,'open'),true);
  const beforeBroadcast=g.dispatchFocus;
  assert.equal(g.rebroadcastJob(d.id),true);
  assert.equal(g.dispatchFocus,beforeBroadcast-1);
  assert.ok(d.rebroadcastUntil>g.elapsed);
  assert.equal(typeof g.assign,'undefined');
});

test('detour advisory can be issued during forecast and changes routing cost',()=>{
  const g=new Game({seed:'ADVISORY'});g.nextEventAt=10;g.elapsed=0;g.scheduleRoadEvent();const ev=g.currentEvent;
  assert.equal(ev.state,'forecast');const edge=g.edges.find(e=>ev.edgeIds.includes(e.id)),normal=g.edgeCost(edge),focus=g.dispatchFocus;
  assert.equal(g.issueDetourAdvisory(),true);
  assert.equal(ev.advisory,true);
  assert.equal(g.dispatchFocus,focus-1);
  assert.ok(g.edgeCost(edge)>normal);
});

test('rider task progress and ETA are finite and advance while riding',()=>{
  const g=new Game({seed:'PROGRESS'}),r=g.couriers[0],d=g.activeDeliveries()[0];g.setChannel(d.id,'open');assert.equal(g.claim(r,d),true);
  const p0=g.courierTaskProgress(r),eta0=g.courierETA(r);assert.ok(Number.isFinite(p0));assert.ok(Number.isFinite(eta0));
  for(let i=0;i<20;i++)g.update(1/30);
  const p1=g.courierTaskProgress(r);assert.ok(Number.isFinite(p1));assert.ok(p1>=p0,`${p0} -> ${p1}`);assert.ok(p1>=0&&p1<=1);
});

test('visual street unlock level matches every subdivided routing segment',()=>{
  const g=new Game({seed:'VISUAL-LOCK'});
  for(const level of[1,2,3]){
    g.cityLevel=level;
    for(const visual of g.visualEdges.filter(v=>v.roadClass!=='connector')){
      const parts=g.edges.filter(e=>e.visualId===visual.id);
      if(g.visualEdgePlayable(visual.id))assert.ok(parts.every(e=>g.edgePlayable(e)),`${visual.streetName} partially locked at level ${level}`);
    }
  }
});
