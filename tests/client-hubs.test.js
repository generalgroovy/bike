import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game,CLIENT_HUB_TYPES } from '../src/game.js';

test('same seed creates the same fictional clients at real game addresses without consuming main RNG',()=>{
  const a=new Game({seed:'HUB-REPRO'}),b=new Game({seed:'HUB-REPRO'});const shape=g=>g.ensureClientHubs().map(h=>[h.name,h.typeId,h.nodeId,h.address,h.unlockLevel]);assert.deepEqual(shape(a),shape(b));assert.ok(a.clientHubs.length>=12);for(const hub of a.clientHubs){const node=a.nodeById(hub.nodeId);assert.equal(node.kind,'address');assert.equal(node.addressLabel,hub.address);assert.equal(node.streetName,hub.streetName);assert.equal(node.districtId,hub.districtId);}
});

test('client hub catalogue creates distinct realistic demand signatures rather than district cargo locks',()=>{
  const g=new Game({seed:'HUB-CARGO'});g.cityLevel=3;assert.equal(CLIENT_HUB_TYPES.length,6);const clinic=g.ensureClientHubs().find(h=>h.typeId==='clinic'),market=g.clientHubs.find(h=>h.typeId==='market');assert.ok(clinic&&market);const clinicTypes=new Set(),marketTypes=new Set();for(let i=0;i<50;i++){clinicTypes.add(g.hubCargoType(clinic));marketTypes.add(g.hubCargoType(market));}assert.ok(clinicTypes.has('medical'));assert.ok(marketTypes.has('grocery'));assert.ok(clinicTypes.size>=2);assert.ok(marketTypes.size>=2);
});

test('normal work stream mixes recurring-client jobs with ordinary address jobs',()=>{
  const g=new Game({seed:'HUB-STREAM'});g.cityLevel=3;g.deliveries=[];let hub=0,generic=0;for(let i=0;i<90;i++){const ok=g.spawnDelivery();if(!ok)continue;const d=g.deliveries.at(-1);if(d.clientHubId)hub++;else generic++;d.status='completed';}assert.ok(hub>=25,`hub jobs ${hub}`);assert.ok(generic>=15,`generic jobs ${generic}`);for(const d of g.deliveries.filter(x=>x.clientHubId)){const h=g.clientHubById(d.clientHubId);assert.ok(h);assert.equal(d.clientName,h.name);assert.ok(['pickup','dropoff'].includes(d.clientEndpoint));}
});

test('client identity is read-only UI/map context and never becomes assignment control',()=>{
  const ui=readFileSync(new URL('../src/ui-client-hubs.js',import.meta.url),'utf8'),map=readFileSync(new URL('../src/render-map.js',import.meta.url),'utf8'),game=readFileSync(new URL('../src/game-client-hubs.js',import.meta.url),'utf8');assert.match(ui,/Recurring client/);assert.match(map,/drawClientHubs/);assert.match(game,/clientHubId/);for(const source of[ui,game])assert.doesNotMatch(source,/assignCourier|assign\(|reserveRider|preassign/);
});