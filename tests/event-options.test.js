import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

test('route event offers rerouting or client buffering as distinct responses',()=>{
  const game=new Game({seed:'EVENT-CHOICES-ROUTE'}),delivery=game.activeDeliveries().find(d=>d.status==='waiting');
  const path=delivery.plannedPath?.length?delivery.plannedPath:game.routeBetween(delivery.pickupId,delivery.dropoffId),edge=game.edgeByIds(path[0],path[1]);
  assert.ok(edge);
  game.currentEvent={id:'route-choice',kind:'route',type:'roadworks',title:'ROADWORKS',place:edge.streetName,state:'forecast',startsAt:10,endsAt:50,factor:.5,edgeIds:[edge.id],visualIds:[edge.visualId],prepared:false};
  game.dispatchFocus=2;
  const options=game.cityEventResponseOptions();
  const buffer=options.find(option=>option.id==='client-buffer');
  assert.ok(buffer);
  assert.equal(buffer.available,true);
  assert.ok(buffer.affected>=1);
  const beforeDeadline=delivery.deadlineAt,beforeFocus=game.dispatchFocus,beforeCost=game.edgeCost(edge);
  assert.equal(game.respondToCityEvent('client-buffer'),true);
  assert.equal(delivery.deadlineAt,beforeDeadline+16);
  assert.equal(game.dispatchFocus,beforeFocus-1);
  assert.equal(game.edgeCost(edge),beforeCost);
  assert.equal(game.currentEvent.clientBuffer,true);
  assert.equal(game.currentEvent.prepared,false);
});

test('demand event surge pay uses cash and marks future surge contracts',()=>{
  const game=new Game({seed:'EVENT-CHOICES-DEMAND'});game.cityLevel=2;game.cash=20;game.dispatchFocus=2;game.nextEventAt=10;game.elapsed=0;
  assert.equal(game.scheduleRoadEvent('venue-release'),true);
  const event=game.currentEvent;assert.equal(event.kind,'demand');
  const option=game.cityEventResponseOptions().find(item=>item.id==='surge-pay');
  assert.equal(option.available,true);
  const beforeFocus=game.dispatchFocus;
  assert.equal(game.respondToCityEvent('surge-pay'),true);
  assert.equal(game.cash,12);
  assert.equal(game.dispatchFocus,beforeFocus);
  assert.equal(event.surgePay,true);
  const spawned=game.spawnEventDemand(event);assert.ok(spawned>0);
  const jobs=game.activeDeliveries().filter(d=>d.eventId===event.id);
  assert.ok(jobs.length>0);
  for(const delivery of jobs){assert.equal(delivery.eventSurgePaid,true);assert.ok(delivery.bonusAppeal>=.28);}
});

test('primary and secondary event responses spend different resources and can stack by choice',()=>{
  const game=new Game({seed:'EVENT-CHOICES-STACK'});game.cityLevel=2;game.cash=20;game.dispatchFocus=3;game.nextEventAt=10;game.elapsed=0;
  assert.equal(game.scheduleRoadEvent('transit-outage'),true);
  const event=game.currentEvent,beforeFocus=game.dispatchFocus,beforeCash=game.cash;
  assert.equal(game.respondToCityEvent('surge-pay'),true);
  assert.equal(game.cash,beforeCash-8);
  assert.equal(game.dispatchFocus,beforeFocus);
  assert.equal(game.respondToCityEvent('prepare'),true);
  assert.equal(game.dispatchFocus,beforeFocus-1);
  assert.equal(event.prepared,true);
  assert.equal(event.surgePay,true);
});
