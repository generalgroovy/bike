import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed } from '../src/rng.js';
import { shortestPath } from '../src/graph.js';
import { Game } from '../src/game.js';

test('seed hashing is stable', () => { assert.equal(hashSeed('CITY-42'), hashSeed('CITY-42')); assert.notEqual(hashSeed('CITY-42'), hashSeed('CITY-43')); });
test('RNG produces deterministic sequences', () => { const a = new RNG('same-seed'); const b = new RNG('same-seed'); const seqA = Array.from({ length: 8 }, () => a.next()); const seqB = Array.from({ length: 8 }, () => b.next()); assert.deepEqual(seqA, seqB); });
test('shortestPath chooses lower total cost', () => {
  const nodes = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1, y: 0 }, { id: 'c', x: 2, y: 0 }, { id: 'd', x: 0, y: 2 }];
  const edges = [{ a: 'a', b: 'b', distance: 1, speed: 1 }, { a: 'b', b: 'c', distance: 1, speed: 1 }, { a: 'a', b: 'd', distance: 4, speed: 1 }, { a: 'd', b: 'c', distance: 4, speed: 1 }];
  assert.deepEqual(shortestPath(nodes, edges, 'a', 'c'), ['a', 'b', 'c']);
});
test('same game seed creates same city topology', () => { const a = new Game({ seed: 'TEST-RUN' }); const b = new Game({ seed: 'TEST-RUN' }); assert.equal(a.nodes.length, b.nodes.length); assert.deepEqual(a.nodes.map((n) => [n.id, n.x, n.y, n.districtId]), b.nodes.map((n) => [n.id, n.x, n.y, n.districtId])); assert.deepEqual(a.edges.map((e) => [e.a, e.b, e.distance]), b.edges.map((e) => [e.a, e.b, e.distance])); });
test('assignment transitions courier and delivery state', () => { const game = new Game({ seed: 'ASSIGN' }); game.spawnDelivery(); const delivery = game.activeDeliveries()[0]; const courier = game.couriers[0]; assert.equal(game.assign(delivery.id, courier.id), true); assert.equal(delivery.status, 'assigned'); assert.equal(courier.phase, 'pickup'); assert.equal(courier.deliveryId, delivery.id); });
