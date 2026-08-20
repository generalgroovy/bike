import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { CITY_EVENT_TYPES } from '../src/event-data.js';

test('city event catalogue includes route weather and demand surges',()=>{
  const kinds=new Set(CITY_EVENT_TYPES.map(e=>e.kind));
  assert.ok(kinds.has('route'));
  assert.ok(kinds.has('demand'));
  assert.ok(CITY_EVENT_TYPES.some(e=>e.id==='rain-cell'));
  assert.ok(CITY_EVENT_TYPES.some(e=>e.id==='transit-outage'));
});

test('forecast preparation softens a route event before activation',()=>{
  const g=new Game({seed:'RAIN-PREP'});g.cityLevel=2;g.nextEventAt=10;g.elapsed=0;
  assert.equal(g.scheduleRoadEvent('rain-cell'),true);const ev=g.currentEvent,edge=g.edges.find(e=>ev.edgeIds.includes(e.id)),focus=g.dispatchFocus;
  assert.equal(ev.kind,'route');assert.ok(edge);assert.equal(g.respondToCityEvent(),true);assert.equal(g.dispatchFocus,focus-1);assert.equal(ev.prepared,true);assert.equal(ev.advisory,true);
  g.elapsed=ev.startsAt;g.updateRoadEvent();
  assert.equal(ev.state,'active');assert.ok(ev.appliedFactor>ev.factor);assert.equal(edge.eventMultiplier,ev.appliedFactor);
});

test('unprepared transit outage creates a larger tagged demand burst',()=>{
  const a=new Game({seed:'TRANSIT-A'});a.cityLevel=2;a.nextEventAt=10;a.elapsed=0;assert.equal(a.scheduleRoadEvent('transit-outage'),true);const beforeA=a.activeDeliveries().length;a.elapsed=a.currentEvent.startsAt;a.updateRoadEvent();const jobsA=a.deliveries.filter(d=>d.eventId===a.currentEvent.id);
  assert.ok(a.activeDeliveries().length>beforeA);assert.equal(jobsA.length,a.currentEvent.generatedJobs);assert.ok(jobsA.length>=3);assert.ok(jobsA.every(d=>d.specialLabel==='TRANSIT'));
  const b=new Game({seed:'TRANSIT-B'});b.cityLevel=2;b.nextEventAt=10;b.elapsed=0;assert.equal(b.scheduleRoadEvent('transit-outage'),true);assert.equal(b.respondToCityEvent(),true);b.elapsed=b.currentEvent.startsAt;b.updateRoadEvent();const jobsB=b.deliveries.filter(d=>d.eventId===b.currentEvent.id);
  assert.ok(jobsB.length<jobsA.length);assert.ok(jobsB.every(d=>d.eventPrepared));
});

test('active demand response buys time for unresolved surge jobs',()=>{
  const g=new Game({seed:'SURGE-ACTIVE'});g.cityLevel=2;g.nextEventAt=10;g.elapsed=0;assert.equal(g.scheduleRoadEvent('venue-release'),true);g.elapsed=g.currentEvent.startsAt;g.updateRoadEvent();const jobs=g.deliveries.filter(d=>d.eventId===g.currentEvent.id&&d.status==='waiting');assert.ok(jobs.length>0);const before=jobs.map(d=>d.deadlineAt),focus=g.dispatchFocus;
  assert.equal(g.respondToCityEvent(),true);assert.equal(g.dispatchFocus,focus-1);jobs.forEach((d,i)=>assert.equal(d.deadlineAt,before[i]+14));
});