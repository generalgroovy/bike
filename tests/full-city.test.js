import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decodeInnerRing} from '../src/inner-ring-city.js';
import {BerlinPlaytest,FIXED_STEP,replayRun} from '../src/game-berlin-playtest.js';
import {CityAddressIndex} from '../src/city-address-index.js';
import {decisionBrief} from '../src/playtest-decisions.js';
const raw=readFileSync(new URL('../generated/berlin-city.json',import.meta.url));
const pack=JSON.parse(raw),city=decodeInnerRing(pack);
const make=options=>new BerlinPlaytest({city,seed:'BERLIN-1',...options});

test('the full city pack preserves all 97 localities and its compressed payload has identical data',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../generated/berlin-city-sources.json',import.meta.url)));
  assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.sha256);
  assert.deepEqual(gunzipSync(readFileSync(new URL('../generated/berlin-city.json.gz',import.meta.url))),raw);
  assert.equal(city.metadata.scope,'full-city');assert.equal(city.regions.length,97);assert.equal(city.boroughs.length,12);
  assert.equal(city.metadata.reachableAddresses,45618);assert.equal(city.nodes.length,198430);
  assert.ok(city.metadata.areaKm2>890&&city.metadata.areaKm2<892);
  for(const region of city.regions){assert.ok(region.addresses>0,region.name);assert.ok(pack.addressIds.includes(region.depot),region.name);}
  assert.ok(city.boundaryPolygons.length>0);assert.equal(city.metadata.license,'dl-de-zero-2.0');
});

test('all playable full-city addresses are reachable outward and back under directed street rules',()=>{
  const g=make();
  for(const reverse of [false,true]) {
    const seen=new Set([g.depotNodeId]),stack=[g.depotNodeId];
    while(stack.length){const from=stack.pop();for(const {to,edge:e} of g.graph.adjacency.get(from)) {
      const origin=reverse?(e.direction==='R'?e.b:e.a):(e.direction==='R'?e.a:e.b);
      if(e.direction!=='B'&&origin!==from)continue;
      if(!seen.has(to)){seen.add(to);stack.push(to);}
    }}
    for(const node of g.addressNodes)assert.ok(seen.has(node.id),node.addressLabel);
  }
});

test('every selectable locality has a short, feasible guided opening',()=>{
  for(const region of city.regions) {
    const g=make({startRegion:region.id}),d=g.deliveries[0];
    assert.ok(d,region.id);assert.equal(g.nodeById(g.depotNodeId).districtId,region.id);
    assert.ok(d.plannedDistance>0&&d.plannedDistance<=240,region.id);
    assert.ok(g.deliveryFeasibility(d).margin>20,region.id);
  }
});

test('a citywide shift spans real outer localities and replays exactly with its chosen start',()=>{
  const g=make({mode:'standard',startRegion:'citywide'});
  assert.deepEqual(g.couriers.map(c=>g.nodeById(c.nodeId).districtId),['mitte','spandau','koepenick']);
  g.dispatch({type:'pause',paused:false});
  for(let i=0;i<34000&&!g.gameOver;i++) {
    if(g.upgradePending)g.dispatch({type:'upgrade',id:'legs'});
    if(i%60===0)for(const d of g.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called))g.dispatch({type:'radio',jobId:d.id,channel:'open'});
    g.update(FIXED_STEP);
  }
  assert.equal(g.outcome,'success');assert.equal(g.activeDeliveries().length,0);
  for(const id of ['spandau','koepenick'])assert.ok(g.deliveries.some(d=>d.pickupDistrict===id));
  assert.deepEqual(replayRun(g.exportRun(),{city}).exportRun(),g.exportRun());
  assert.throws(()=>make({startRegion:'not-a-place'}));
  assert.throws(()=>make({ruleset:'berlin-dispatch-v3'}));
});

test('spatial address queries match exhaustive filtering and preserve seeded array order',()=>{
  const nodes=city.nodes.filter(n=>n.kind==='address'),index=new CityAddressIndex(nodes);
  for(const anchor of nodes.filter((_,i)=>i%5000===0))for(const radius of [10,100,210,336])
    assert.deepEqual(index.near(anchor.x,anchor.y,radius),nodes.filter(n=>Math.hypot(n.x-anchor.x,n.y-anchor.y)<radius));
});

test('collection and handover take actual time at the sourced addresses, included in ETA',()=>{
  const g=make(),d=g.deliveries[0],c=g.couriers[0];
  assert.equal(g.ruleset,'berlin-dispatch-v5');
  g.dispatch({type:'radio',jobId:d.id,channel:'open'});g.claim(c,d);
  assert.equal(c.phase,'loading');assert.equal(d.pickedUp,false);
  const pickup=g.nodeById(d.pickupId),xy=[c.x,c.y];assert.deepEqual(xy,[pickup.x,pickup.y]);
  const eta=g.courierETA(c),start=g.elapsed;
  g.dispatch({type:'pause',paused:false});
  for(let i=0;i<60;i++)g.update(FIXED_STEP);
  assert.equal(c.phase,'loading');assert.deepEqual([c.x,c.y],xy);
  while(c.phase==='loading')g.update(FIXED_STEP);
  assert.ok(g.elapsed-start>=g.handoffTime(d).pickup);assert.equal(d.pickedUp,true);
  while(c.phase==='dropoff')g.update(FIXED_STEP);
  assert.equal(c.phase,'handover');assert.equal(d.status,'claimed');
  const reached=g.elapsed,drop=g.nodeById(d.dropoffId);assert.deepEqual([c.x,c.y],[drop.x,drop.y]);
  while(d.status==='claimed')g.update(FIXED_STEP);
  assert.ok(g.elapsed-reached>=g.handoffTime(d).dropoff-1e-8);
  assert.ok(Math.abs(g.elapsed-start-eta)<.06,`ETA ${eta}, actual ${g.elapsed-start}`);
  assert.equal(d.status,'completed');
});

test('client agreement changes time and fee once without assigning riders or exceeding closing',()=>{
  const g=make(),d=g.deliveries[0],fee=d.reward,deadline=d.deadlineAt,cash=g.cash,positions=g.couriers.map(c=>[c.x,c.y,c.deliveryId]);
  const offer=g.extensionOffer(d);assert.equal(offer.seconds,20);assert.equal(offer.fee,Math.max(3,Math.ceil(fee*.2)));
  assert.equal(g.dispatch({type:'client-call',jobId:d.id}),true);
  assert.equal(d.deadlineAt,deadline+20);assert.equal(d.reward,fee-offer.fee);assert.equal(g.cash,cash);
  assert.deepEqual(g.couriers.map(c=>[c.x,c.y,c.deliveryId]),positions);
  assert.equal(g.dispatch({type:'client-call',jobId:d.id}),false);
  const h=make(),job=h.deliveries[0];job.deadlineAt=179;assert.equal(h.extensionOffer(job).available,false);
  job.deadlineAt=170;assert.equal(h.extensionOffer(job).seconds,10);
  assert.equal(h.dispatch({type:'client-call',jobId:job.id}),true);assert.equal(job.deadlineAt,180);
  const replay=replayRun(g.exportRun(),{city});assert.deepEqual(replay.exportRun(),g.exportRun());
});

test('offer explanations match feasibility and channel effects without choosing a rider or using RNG',()=>{
  const g=make(),d=g.deliveries[0],before=g.exportRun(),riders=structuredClone(g.couriers),rng=JSON.stringify(g.rng);
  const brief=decisionBrief(g,d);assert.equal(brief.rows.length,3);assert.equal(brief.channels.length,3);
  assert.ok(brief.rows.every(r=>r.state==='possible'&&r.handlingIn===3));
  for(const row of brief.rows)assert.ok(Math.abs(row.margin-g.offerMargin(row.rider,d))<1e-6);
  assert.deepEqual(g.exportRun(),before);assert.deepEqual(g.couriers,riders);assert.equal(JSON.stringify(g.rng),rng);
  d.deadlineAt=1;const late=decisionBrief(g,d);assert.ok(late.rows.every(r=>r.state==='pass'));assert.ok(late.channels.every(c=>c.eligible===0));
  assert.equal(g.dispatch({type:'assign',jobId:d.id,riderId:'c0'}),false);
  assert.equal(g.dispatch({type:'client-call',jobId:d.id}),true);assert.ok(decisionBrief(g,d).rows.some(r=>r.state==='possible'));
});

test('the previously published v4 shift still replays byte-for-byte',()=>{
  const record=JSON.parse(readFileSync(new URL('fixtures/berlin-v4-shift.json',import.meta.url)));
  const replay=replayRun(record,{city});assert.equal(replay.refined,false);assert.deepEqual(replay.exportRun(),record);
  assert.equal(make({ruleset:'berlin-dispatch-v4'}).dispatch({type:'client-call',jobId:'d0'}),false);
});
