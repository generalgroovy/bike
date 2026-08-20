import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

function distantJob(game){
  const pickup=game.playableAddressNodes().at(-1),dropoff=game.playableAddressNodes().find(n=>n.id!==pickup.id&&game.routeBetween(pickup.id,n.id).length>2);
  game.deliveries=[];assert.equal(game.spawnDelivery({pickupId:pickup.id,dropoffId:dropoff.id,special:false}),true);return game.deliveries.at(-1);
}

test('availability projection distinguishes ready busy and break riders',()=>{
  const g=new Game({seed:'AVAIL-STATES'}),job=distantJob(g),[ready,busy,resting]=g.couriers;
  const current=g.activeDeliveries().find(d=>d.id!==job.id)??job;
  if(current===job){g.spawnDelivery({special:false});}
  const work=g.activeDeliveries().find(d=>d.id!==job.id);assert.ok(work);
  g.setChannel(work.id,'open');assert.equal(g.claim(busy,work),true);
  assert.equal(g.startBreak(resting,18),true);
  const a=g.courierAvailability(ready,job),b=g.courierAvailability(busy,job),c=g.courierAvailability(resting,job);
  assert.equal(a.state,'ready');assert.equal(a.availableNow,true);assert.equal(a.readyIn,0);
  assert.equal(b.state,'busy');assert.equal(b.availableNow,false);assert.ok(b.readyIn>0);assert.ok(b.arrivalIn>=b.readyIn);
  assert.equal(c.state,'break');assert.equal(c.availableNow,false);assert.ok(c.readyIn>=17.9);assert.ok(c.arrivalIn>=c.readyIn);
});

test('future outlook can include soon-free riders but never lets them claim early',()=>{
  const g=new Game({seed:'AVAIL-NO-PREASSIGN'}),job=distantJob(g),busy=g.couriers[0];g.spawnDelivery({special:false});const work=g.deliveries.find(d=>d.id!==job.id);g.setChannel(work.id,'open');assert.equal(g.claim(busy,work),true);
  const outlook=g.deliveryRiderOutlook(job,{limit:6,horizon:180}),entry=outlook.find(item=>item.rider.id===busy.id);assert.ok(entry);assert.equal(entry.state,'busy');assert.equal(entry.availableNow,false);assert.ok(entry.arrivalIn>0);
  g.setChannel(job.id,'priority');assert.equal(g.claim(busy,job),false);assert.equal(busy.deliveryId,work.id);
});

test('outlook ranks current listeners before future riders and remains finite',()=>{
  const g=new Game({seed:'AVAIL-RANK'}),job=distantJob(g),resting=g.couriers[2];g.startBreak(resting,12);
  const outlook=g.deliveryRiderOutlook(job,{limit:6,horizon:180});assert.ok(outlook.length>=2);assert.equal(outlook[0].availableNow,true);
  const firstFuture=outlook.findIndex(item=>!item.availableNow);if(firstFuture>=0)assert.ok(outlook.slice(firstFuture).every(item=>!item.availableNow));
  assert.ok(outlook.every(item=>Number.isFinite(item.arrivalIn)&&item.arrivalIn>=0));
});
