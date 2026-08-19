import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed } from '../src/rng.js';
import { shortestPath } from '../src/graph.js';
import { BERLIN } from '../src/berlin.js';
import { Game, DELIVERY_TYPES, PERSONALITIES, EXPERIENCE } from '../src/game.js';

test('seed hashing and RNG are deterministic', () => {
  assert.equal(hashSeed('BERLIN-42'), hashSeed('BERLIN-42'));
  const a = new RNG('same-seed');
  const b = new RNG('same-seed');
  assert.deepEqual(Array.from({length:8},()=>a.next()),Array.from({length:8},()=>b.next()));
});

test('Berlin skeleton keeps recognizable relative landmark positions', () => {
  const byId = new Map(BERLIN.landmarks.map((l)=>[l.id,l]));
  assert.ok(byId.get('zoo').x < byId.get('brandenburg').x);
  assert.ok(byId.get('alex').x > byId.get('brandenburg').x);
  assert.ok(byId.get('mauerpark').y < byId.get('alex').y);
  assert.ok(byId.get('tempelhofer').y > byId.get('checkpoint').y);
  assert.ok(byId.get('eastside').x > byId.get('alex').x);
  assert.ok(BERLIN.districts.some((d)=>d.name === 'Kreuzberg'));
  assert.ok(BERLIN.districts.some((d)=>d.name === 'Neukölln'));
});

test('same seed creates same Berlin variation, roster, goals and jobs', () => {
  const a = new Game({seed:'BERLIN-TEST'});
  const b = new Game({seed:'BERLIN-TEST'});
  assert.equal(a.runTrait.id,b.runTrait.id);
  assert.deepEqual(a.nodes.map((n)=>[n.id,n.x,n.y,n.districtId]),b.nodes.map((n)=>[n.id,n.x,n.y,n.districtId]));
  assert.deepEqual(a.couriers.map((c)=>[c.name,c.personality.id,c.experience.level,c.homeDistrict]),b.couriers.map((c)=>[c.name,c.personality.id,c.experience.level,c.homeDistrict]));
  assert.deepEqual(a.goals,b.goals);
  assert.deepEqual(a.activeDeliveries(),b.activeDeliveries());
});

test('Berlin network is fully routable across procedural seeds', () => {
  for (let i=0;i<50;i+=1) {
    const game = new Game({seed:`ROUTE-${i}`});
    for (const node of game.nodes) {
      const path = shortestPath(game.nodes,game.edges,game.depotNodeId,node.id,game.edgeCost.bind(game));
      assert.ok(path.length>0,`seed ${i} cannot reach ${node.id}`);
    }
  }
});

test('dispatcher calls jobs instead of assigning riders', () => {
  const game = new Game({seed:'RADIO'});
  assert.equal(typeof game.assign,'undefined');
  const [first,second,third] = game.activeDeliveries();
  assert.equal(game.toggleCall(first.id),true);
  assert.equal(first.called,true);
  assert.equal(game.toggleCall(second.id),true);
  assert.equal(game.toggleCall(third.id),true);
  game.spawnDelivery();
  const fourth = game.activeDeliveries().find((d)=>!d.called);
  assert.equal(game.calledCount(),game.radioSlots);
  assert.equal(game.toggleCall(fourth.id),false);
  assert.equal(fourth.called,false);
  assert.equal(game.toggleCall(first.id),true);
  assert.equal(first.called,false);
});

test('idle rider autonomously claims a called job', () => {
  const game = new Game({seed:'CHOICE'});
  const delivery = game.activeDeliveries()[0];
  game.toggleCall(delivery.id);
  for (const rider of game.couriers) rider.decisionAt = 0;
  game.update(0.5);
  assert.equal(delivery.status,'claimed');
  assert.ok(delivery.courierId);
  const rider = game.courierById(delivery.courierId);
  assert.notEqual(rider.phase,'idle');
  assert.match(rider.lastDecision,/Took D/);
});

test('riders have personality and experience models', () => {
  const game = new Game({seed:'ROSTER'});
  for (const rider of game.couriers) {
    assert.ok(PERSONALITIES.some((p)=>p.id===rider.personality.id));
    assert.ok(EXPERIENCE.some((e)=>e.level===rider.experience.level));
    assert.ok(rider.personality.desc.length>5);
    assert.ok(rider.experience.level>=1 && rider.experience.level<=4);
  }
});

test('delivery type generation is independent of district identity', () => {
  const game = new Game({seed:'INDEPENDENT-SPAWNS'});
  const seen = new Map(game.districts.map((d)=>[d.id,new Set()]));
  for (let i=0;i<700;i+=1) {
    game.deliveries = [];
    game.spawnDelivery();
    const d = game.deliveries[0];
    const district = game.nodeById(d.pickupId).districtId;
    seen.get(district)?.add(d.type);
  }
  const observed = [...seen.values()].filter((set)=>set.size>0);
  assert.ok(observed.length>=7);
  for (const set of observed) assert.ok(set.size>=3,'a district became too tightly coupled to job type');
  assert.equal(Object.keys(DELIVERY_TYPES).length,6);
});

test('goal progress is driven by completed endpoints, not spawn tables', () => {
  const game = new Game({seed:'GOALS'});
  const goal = game.goals.find((g)=>g.type==='landmark');
  const targetNode = game.nodes.find((n)=>n.landmarkId===goal.targetId);
  const other = game.nodes.find((n)=>n.id!==targetNode.id && n.id!==game.depotNodeId);
  const before = goal.progress;
  game.updateGoals({pickupId:targetNode.id,dropoffId:other.id});
  assert.equal(goal.progress,before+1);
});
