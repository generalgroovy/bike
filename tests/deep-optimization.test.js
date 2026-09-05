import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('routing cache reuses deterministic paths and explicit invalidation forces recompute',()=>{
  const game=new Game({seed:'OPT-ROUTE'}),nodes=game.playableAddressNodes();
  const a=nodes[0],b=nodes.find(n=>n.id!==a.id);assert.ok(a&&b);
  game.routeCache.clear();const hits0=game.runStats.routeCacheHits,miss0=game.runStats.routeCacheMisses;
  const first=game.routeBetween(a.id,b.id),miss1=game.runStats.routeCacheMisses;assert.ok(first.length>1);assert.equal(miss1,miss0+1);
  const second=game.routeBetween(a.id,b.id);assert.deepEqual(second,first);assert.equal(game.runStats.routeCacheHits,hits0+1);
  const revision=game.routingRevision;game.invalidateRouting();assert.equal(game.routingRevision,revision+1);assert.equal(game.routeCache.size,0);
  game.routeBetween(a.id,b.id);assert.equal(game.runStats.routeCacheMisses,miss1+1);
});

test('entity lookup maps remain O(1) fast paths with safe fallback for fixture pushes',()=>{
  const game=new Game({seed:'OPT-LOOKUP'}),delivery=game.deliveries[0],courier=game.couriers[0];assert.ok(delivery&&courier);
  assert.equal(game.deliveryById(delivery.id),delivery);assert.equal(game.courierById(courier.id),courier);
  game.deliveryMap.clear();game.courierMap.clear();assert.equal(game.deliveryById(delivery.id),delivery);assert.equal(game.deliveryMap.get(delivery.id),delivery);assert.equal(game.courierById(courier.id),courier);assert.equal(game.courierMap.get(courier.id),courier);
});

test('dispatch projection cache invalidates on meaningful contract state change',()=>{
  const game=new Game({seed:'OPT-INSIGHT'}),delivery=game.activeDeliveries()[0];assert.ok(delivery);
  const first=game.deliveryDispatchInsight(delivery),second=game.deliveryDispatchInsight(delivery);assert.equal(second,first);
  delivery.reward+=1;const changed=game.deliveryDispatchInsight(delivery);assert.notEqual(changed,first);
});

test('browser UI polling is consolidated behind one visibility-aware scheduler',()=>{
  const runtime=read('../src/ui-runtime.js');assert.match(runtime,/registerUiTask/);assert.match(runtime,/document\.hidden/);assert.doesNotMatch(runtime,/game\.update\(|setChannel\(|claim\(|spawnDelivery\(/);
  const modules=['ui-outlook.js','ui-telemetry.js','ui-scheduled.js','ui-queue.js','ui-feasibility.js','ui-event-options.js','ui-expansion-policy.js','ui-service-pressure.js','ui-client-hubs.js','ui-demand-rhythm.js','ui-district-brief.js','ui-adaptive-upgrades.js','ui-sensory.js','ui-shell.js'];
  for(const file of modules){const source=read(`../src/${file}`);assert.doesNotMatch(source,/setInterval\s*\(/,`${file} must use shared UI runtime`);}
});

test('renderer preindexes Berlin geometry and rejects offscreen edges',()=>{
  const renderer=read('../src/render.js'),map=read('../src/render-map.js'),camera=read('../src/camera.js');
  assert.match(renderer,/prepareEdges/);assert.match(renderer,/streetLabelGroups/);assert.match(renderer,/frameWorldBounds/);assert.match(renderer,/this\.game\.paused\?50:0/);
  assert.match(map,/visibleEntry/);assert.match(map,/renderStats\.culledEdges/);assert.match(map,/streetLabelGroups/);assert.match(camera,/visibleWorldBounds/);
});
