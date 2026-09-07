import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {decodeInnerRing} from '../src/inner-ring-city.js';
import {BerlinPlaytest,FIXED_STEP,replayRun} from '../src/game-berlin-playtest.js';
import {CityAddressIndex} from '../src/city-address-index.js';
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
