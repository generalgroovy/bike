import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,UPGRADES } from '../src/game.js';

function apply(game,id){game.upgradePending=true;assert.equal(game.applyUpgrade(id),true);}

test('strategic upgrade pool covers cargo radio event intelligence and staffing',()=>{
  const ids=new Set(UPGRADES.map(u=>u.id));
  for(const id of['cargo-racks','local-repeater','event-feed','relief-roster'])assert.ok(ids.has(id),id);
});

test('Cargo Racks reduce loaded catering penalties without removing cargo identity',()=>{
  const g=new Game({seed:'UP-CARGO'}),before=g.cargoHandlingFor({type:'catering'});apply(g,'cargo-racks');const after=g.cargoHandlingFor({type:'catering'});
  assert.ok(after.speed>before.speed&&after.speed<1);
  assert.ok(after.fatigue<before.fatigue&&after.fatigue>1);
});

test('Local Repeater strengthens only same-area LOCAL rider attraction',()=>{
  const g=new Game({seed:'UP-LOCAL'}),r=g.couriers[0],here=g.nodeById(r.nodeId),pickup=g.playableAddressNodes().find(n=>n.districtId===here.districtId&&n.id!==r.nodeId),drop=g.playableAddressNodes().find(n=>n.id!==pickup.id);g.deliveries=[];assert.ok(pickup&&drop);assert.equal(g.spawnDelivery({pickupId:pickup.id,dropoffId:drop.id,special:false}),true);const d=g.deliveries.at(-1);g.setChannel(d.id,'local');const before=g.courierChoiceScore(r,d,false);apply(g,'local-repeater');const after=g.courierChoiceScore(r,d,false);assert.ok(after>before+.25);
});

test('Event Feed forecasts the next event earlier without changing its activation time',()=>{
  const control=new Game({seed:'UP-EVENT'}),intel=new Game({seed:'UP-EVENT'});control.nextEventAt=20;intel.nextEventAt=20;control.elapsed=4.5;intel.elapsed=4.5;apply(intel,'event-feed');control.update(.01);intel.update(.01);assert.equal(control.currentEvent,null);assert.ok(intel.currentEvent);assert.equal(intel.currentEvent.startsAt,20);assert.equal(intel.currentEvent.state,'forecast');
});

test('Relief Roster shortens future autonomous breaks using the same RNG state',()=>{
  const control=new Game({seed:'UP-BREAK'}),relief=new Game({seed:'UP-BREAK'}),a=control.couriers[0],b=relief.couriers[0];a.fatigue=.9;b.fatigue=.9;apply(relief,'relief-roster');assert.equal(control.startBreak(a),true);assert.equal(relief.startBreak(b),true);const normal=a.breakUntil-control.elapsed,shorter=b.breakUntil-relief.elapsed;assert.ok(shorter<normal*.82,`${shorter} vs ${normal}`);assert.ok(shorter>normal*.7);
});
