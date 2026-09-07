import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { decodeInnerRing } from '../src/inner-ring-city.js';
import { BerlinPlaytest, FIXED_STEP, replayRun } from '../src/game-berlin-playtest.js';
const raw=readFileSync(new URL('../generated/berlin-inner-ring.json',import.meta.url));
const pack=JSON.parse(raw),city=decodeInnerRing(pack);
const make=options=>new BerlinPlaytest({city,seed:'BERLIN-1',...options});

test('city pack has a verified identity, geographic bounds and real locality/address data',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../generated/berlin-inner-ring-sources.json',import.meta.url)));
  assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.sha256);
  assert.equal(city.metadata.crs,'EPSG:25833');
  assert.ok(city.metadata.id.startsWith('berlin-inner-ring-v1-'));
  assert.equal(city.metadata.metersPerUnit,10);
  assert.ok(city.metadata.areaKm2>87&&city.metadata.areaKm2<88);
  assert.equal(city.nodes.length,30656);assert.equal(city.metadata.reachableAddresses,7533);
  for(const name of ['Mitte','Kreuzberg','Friedrichshain','Moabit','Neukölln','Charlottenburg','Prenzlauer Berg']) assert.ok(city.regions.some(r=>r.name===name));
  const g=make();assert.equal(g.nodes.length,city.nodes.length,'No legacy wrapper can replace the city');
  for(const n of g.addressNodes) {
    assert.ok(n.sourceId.startsWith('adressen_berlin.'));assert.ok(n.lonLat[0]>13.28&&n.lonLat[0]<13.48);
    assert.ok(n.lonLat[1]>52.46&&n.lonLat[1]<52.55);assert.ok(n.addressLabel.length>3);
  }
  assert.throws(()=>decodeInnerRing({...pack,metadata:{...pack.metadata,crs:'unknown'}}));
});

test('every playable address has both an outward and a return route to the depot',()=>{
  const g=make(),forward=new Map(g.nodes.map(n=>[n.id,[]])),reverse=new Map(g.nodes.map(n=>[n.id,[]]));
  for(const e of g.edges) for(const [a,b] of (e.direction==='B'?[[e.a,e.b],[e.b,e.a]]:e.direction==='R'?[[e.a,e.b]]:[[e.b,e.a]])) {
    forward.get(a).push(b);reverse.get(b).push(a);
  }
  for(const graph of [forward,reverse]) {
    const seen=new Set([g.depotNodeId]),stack=[g.depotNodeId];
    while(stack.length) for(const n of graph.get(stack.pop())) if(!seen.has(n)){seen.add(n);stack.push(n);}
    for(const n of g.addressNodes) assert.ok(seen.has(n.id),n.addressLabel);
  }
});

test('route segments use displayed street geometry; crossings connect only by source junction ID',()=>{
  const g=make(),byVisual=new Map(city.visualEdges.map(e=>[e.id,e])),owners=new Map();
  for(const v of city.visualEdges) for(const id of v.nodeIds) {
    const owner=owners.get(id);if(owner&&owner!==v.sourceId) assert.ok(g.nodeById(id).sourceId.startsWith('vp:'),id);
    owners.set(id,v.sourceId);
  }
  for(const e of g.edges) {
    if(e.roadClass==='connector') {assert.ok(e.distance<=6.02);assert.ok(g.nodeById(e.b).sourceId.startsWith('adressen_berlin.'));continue;}
    const v=byVisual.get(e.visualId);assert.ok(v?.routable);
    const a=v.nodeIds.indexOf(e.a);assert.equal(v.nodeIds[a+1],e.b);
    assert.equal(e.level,v.level);
  }
  assert.ok(g.edges.some(e=>e.level!==0),'Bridge and tunnel levels retained');
});

test('one-way routes never reuse the reversed cached path',()=>{
  const g=make(),oneWay=g.edges.find(e=>e.direction==='R'&&e.distance>1);
  assert.deepEqual(g.routeBetween(oneWay.a,oneWay.b),[oneWay.a,oneWay.b]);
  assert.notDeepEqual(g.routeBetween(oneWay.b,oneWay.a),[oneWay.b,oneWay.a]);
  for(let i=0;i<30;i++) {
    const trip=g.randomTrip();assert.ok(trip);
    for(let j=1;j<trip.path.length;j++) {
      const e=g.edgeByIds(trip.path[j-1],trip.path[j]);
      assert.ok(e.direction==='B'||e.direction==='R'&&e.a===trip.path[j-1]||e.direction==='G'&&e.b===trip.path[j-1]);
    }
  }
});

test('dense street geometry conserves movement time and reroutes do not cut corners',()=>{
  const a=make(),b=make();
  for(const g of [a,b]) {const d=g.deliveries[0];g.setChannel(d.id,'open');g.claim(g.couriers[0],d);}
  a.moveCourier(a.couriers[0],1);
  for(let i=0;i<60;i++) b.moveCourier(b.couriers[0],FIXED_STEP);
  assert.ok(Math.hypot(a.couriers[0].x-b.couriers[0].x,a.couriers[0].y-b.couriers[0].y)<1e-6);
  const c=b.couriers[0],before={x:c.x,y:c.y,path:[...c.path],index:c.pathIndex};
  b.rerouteCourier(c);assert.equal(c.x,before.x);assert.equal(c.y,before.y);
  assert.deepEqual(c.path,before.path);assert.equal(c.pathIndex,before.index);assert.equal(c.reroutePending,true);
  b.failDelivery(b.deliveries[0]);assert.equal(c.phase,'coasting');
  for(let i=0;i<2000&&c.phase==='coasting';i++)b.moveCourier(c,FIXED_STEP);
  assert.equal(c.phase,'idle');assert.equal(c.x,b.nodeById(c.nodeId).x);assert.equal(c.y,b.nodeById(c.nodeId).y);
});

function play(g) {
  g.dispatch({type:'pause',paused:false});
  for(let i=0;i<34000&&!g.gameOver;i++) {
    if(g.upgradePending)g.dispatch({type:'upgrade',id:'legs'});
    if(i%60===0)for(const d of g.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called))g.dispatch({type:'radio',jobId:d.id,channel:'open'});
    g.update(FIXED_STEP);
  }
  return g;
}
test('the geographic first shift is achievable, replayable and bound to its city version',()=>{
  for(const seed of ['BERLIN-1','BERLIN-2','BERLIN-3']) {
    const g=play(make({seed}));assert.equal(g.outcome,'success');assert.ok(g.completed>=5);assert.equal(g.activeDeliveries().length,0);
    assert.deepEqual(replayRun(g.exportRun(),{city}).exportRun(),g.exportRun());
    assert.throws(()=>replayRun(g.exportRun()));
    assert.throws(()=>replayRun(g.exportRun(),{city:{...city,metadata:{...city.metadata,id:'different-map'}}}));
  }
});

test('a full geographic shift finishes with explicit results and a traffic event',()=>{
  const g=play(make({mode:'standard'}));assert.equal(g.outcome,'success');assert.ok(g.completed>=24);assert.equal(g.activeDeliveries().length,0);
  assert.ok(g.dispatchLog.some(e=>e.action==='event-start'));assert.ok(g.dispatchLog.some(e=>e.action==='event-end'));
  assert.equal(g.couriers.length,3);assert.equal(g.cityLevel,1);assert.equal(g.upgradeTaken,'legs');
  assert.deepEqual(replayRun(g.exportRun(),{city}).exportRun(),g.exportRun());
});
