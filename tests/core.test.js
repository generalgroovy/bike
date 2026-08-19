import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed } from '../src/rng.js';
import { shortestPath } from '../src/graph.js';
import { Game } from '../src/game.js';

test('seed hashing is stable', () => {
  assert.equal(hashSeed('CITY-42'), hashSeed('CITY-42'));
  assert.notEqual(hashSeed('CITY-42'), hashSeed('CITY-43'));
});

test('RNG produces deterministic sequences', () => {
  const a = new RNG('same-seed');
  const b = new RNG('same-seed');
  assert.deepEqual(Array.from({ length: 8 }, () => a.next()), Array.from({ length: 8 }, () => b.next()));
});

test('shortestPath chooses lower total cost', () => {
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 1, y: 0 },
    { id: 'c', x: 2, y: 0 },
    { id: 'd', x: 0, y: 2 }
  ];
  const edges = [
    { a: 'a', b: 'b', distance: 1, speed: 1 },
    { a: 'b', b: 'c', distance: 1, speed: 1 },
    { a: 'a', b: 'd', distance: 4, speed: 1 },
    { a: 'd', b: 'c', distance: 4, speed: 1 }
  ];
  assert.deepEqual(shortestPath(nodes, edges, 'a', 'c'), ['a', 'b', 'c']);
});

test('same seed creates the same city, trait, and starting jobs', () => {
  const a = new Game({ seed: 'TEST-RUN' });
  const b = new Game({ seed: 'TEST-RUN' });
  assert.equal(a.runTrait.id, b.runTrait.id);
  assert.deepEqual(a.nodes.map((n) => [n.id, n.x, n.y, n.districtId]), b.nodes.map((n) => [n.id, n.x, n.y, n.districtId]));
  assert.deepEqual(a.edges.map((e) => [e.a, e.b, e.distance, e.speed]), b.edges.map((e) => [e.a, e.b, e.distance, e.speed]));
  assert.deepEqual(a.activeDeliveries(), b.activeDeliveries());
});

test('generated cities remain fully routable across many seeds', () => {
  for (let i = 0; i < 30; i += 1) {
    const game = new Game({ seed: `CONNECT-${i}` });
    for (const node of game.nodes) {
      const path = shortestPath(game.nodes, game.edges, game.depotNodeId, node.id, game.edgeCost.bind(game));
      assert.ok(path.length > 0, `seed ${i} cannot reach ${node.id}`);
    }
  }
});

test('assignment transitions courier and delivery state', () => {
  const game = new Game({ seed: 'ASSIGN' });
  const delivery = game.activeDeliveries()[0];
  const courier = game.couriers[0];
  assert.equal(game.assign(delivery.id, courier.id), true);
  assert.equal(delivery.status, 'assigned');
  assert.equal(courier.phase, 'pickup');
  assert.equal(courier.deliveryId, delivery.id);
});
