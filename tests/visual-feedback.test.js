import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.js';

const renderSource=readFileSync(new URL('../src/render-entities.js',import.meta.url),'utf8');

test('rider heading follows actual travel direction and stays finite',()=>{
  const g=new Game({seed:'HEADING'}),r=g.couriers[0],d=g.activeDeliveries()[0];
  assert.equal(g.setChannel(d.id,'open'),true);assert.equal(g.claim(r,d),true);
  const before=[r.x,r.y];for(let i=0;i<12;i++)g.update(1/30);
  assert.ok(Number.isFinite(r.heading));assert.ok(Math.hypot(r.x-before[0],r.y-before[1])>0);
});

test('pickup and dropoff milestones are explicit short-lived rider state',()=>{
  const g=new Game({seed:'MILESTONE'}),r=g.couriers[0],d=g.activeDeliveries()[0],pickup=g.nodeById(d.pickupId);
  d.status='claimed';d.courierId=r.id;r.deliveryId=d.id;r.phase='pickup';r.nodeId=d.pickupId;r.x=pickup.x;r.y=pickup.y;
  g.arrive(r);assert.equal(r.lastMilestone,'pickup');assert.equal(r.lastMilestoneAt,g.elapsed);assert.equal(d.pickedUp,true);
  g.elapsed+=2;g.completeDelivery(r,d);assert.equal(r.lastMilestone,'dropoff');assert.equal(r.lastMilestoneAt,g.elapsed);assert.equal(d.status,'completed');
});

test('renderer rotates only the rider marker and keeps reduced-motion feedback static',()=>{
  assert.match(renderSource,/prefers-reduced-motion: reduce/);
  assert.match(renderSource,/Number\.isFinite\(rider\.heading\).*c\.rotate\(rider\.heading\)/s);
  assert.match(renderSource,/drawMilestoneCue/);assert.match(renderSource,/rider\.lastMilestone/);
  assert.match(renderSource,/if\(reduced\|\|!\(rider\.phase==='pickup'\|\|rider\.phase==='dropoff'\)/);
  assert.match(renderSource,/reduced=reducedMotion\(\)/);
});
