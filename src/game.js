import { RNG, createSeed } from './rng.js';
import { buildAdjacency, distance, shortestPath } from './graph.js';

export const DELIVERY_TYPES = {
  food: { label: 'Food', glyph: '▲', color: '#ff5d8f', baseDeadline: 42, reward: 9 },
  parcel: { label: 'Parcel', glyph: '●', color: '#ffb703', baseDeadline: 66, reward: 12 },
  document: { label: 'Docs', glyph: '■', color: '#5eead4', baseDeadline: 48, reward: 14 },
  medical: { label: 'Medical', glyph: '✚', color: '#f43f5e', baseDeadline: 34, reward: 22 },
  grocery: { label: 'Grocery', glyph: '⬢', color: '#a3e635', baseDeadline: 74, reward: 13 },
  fragile: { label: 'Fragile', glyph: '◆', color: '#c084fc', baseDeadline: 58, reward: 17 }
};

export const DISTRICT_ARCHETYPES = [
  { name: 'Market', color: '#ff8a3d', demand: ['food', 'grocery', 'parcel'], modifier: 'Lunch rushes hit harder.' },
  { name: 'Old Town', color: '#b983ff', demand: ['food', 'document', 'fragile'], modifier: 'Dense streets, short hops.' },
  { name: 'Riverside', color: '#3ec6ff', demand: ['parcel', 'grocery', 'fragile'], modifier: 'Bridge routes create chokepoints.' },
  { name: 'Campus', color: '#66e36e', demand: ['food', 'document', 'parcel'], modifier: 'Bursty student demand.' },
  { name: 'Downtown', color: '#ff4f87', demand: ['document', 'food', 'medical'], modifier: 'High-value, high-pressure jobs.' },
  { name: 'Workshops', color: '#f4d35e', demand: ['parcel', 'fragile', 'grocery'], modifier: 'Longer cargo-oriented trips.' }
];

const COURIER_COLORS = ['#00e5ff', '#ff4d8d', '#b8ff5a', '#ffd166', '#9b8cff', '#ff7a45', '#5eead4'];
const COURIER_NAMES = ['Maya', 'Leo', 'Sam', 'Nova', 'Iris', 'Juno', 'Kai'];

function weightedPick(rng, items, weightFn) {
  if (!items.length) return undefined;
  const weights = items.map((item) => Math.max(0, Number(weightFn(item)) || 0));
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return rng.pick(items);
  let roll = rng.float(0, total);
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items.at(-1);
}

export const RUN_TRAITS = [
  {
    id: 'express',
    title: 'Express Contracts',
    desc: 'Tighter deadlines, richer payouts.',
    apply(game) { game.modifiers.deadline *= 0.9; game.modifiers.reward *= 1.18; }
  },
  {
    id: 'cycle-grid',
    title: 'Cycle Grid',
    desc: 'The city starts with fast bike corridors.',
    apply(game) {
      const lanes = game.rng.shuffle(game.edges).slice(0, Math.max(4, Math.floor(game.edges.length * 0.1)));
      for (const edge of lanes) { edge.speed = Math.max(edge.speed, 1.34); edge.bikeLane = true; }
    }
  },
  {
    id: 'food-capital',
    title: 'Food Capital',
    desc: 'Food and grocery demand dominates the run.',
    apply(game) { game.modifiers.typeBias.food = 2.1; game.modifiers.typeBias.grocery = 1.45; }
  },
  {
    id: 'paper-chase',
    title: 'Paper Chase',
    desc: 'Documents and fragile cargo are unusually common.',
    apply(game) { game.modifiers.typeBias.document = 1.9; game.modifiers.typeBias.fragile = 1.45; game.modifiers.reward *= 1.06; }
  }
];

export const UPGRADES = [
  { id: 'rider', title: 'Extra Rider', desc: '+1 courier joins immediately.', apply(game) { game.addCourier(); } },
  { id: 'speed', title: 'Street Legs', desc: 'All couriers move 14% faster.', apply(game) { game.modifiers.speed *= 1.14; } },
  { id: 'grace', title: 'Client Buffer', desc: 'New delivery deadlines are 18% longer.', apply(game) { game.modifiers.deadline *= 1.18; } },
  { id: 'pay', title: 'Premium Contracts', desc: 'Delivery rewards are worth 22% more.', apply(game) { game.modifiers.reward *= 1.22; } },
  { id: 'reputation', title: 'Local Goodwill', desc: '+16 reputation now, max 100.', apply(game) { game.reputation = Math.min(100, game.reputation + 16); } },
  {
    id: 'bikeLane', title: 'Bike-Lane Grant', desc: 'Several road links become express lanes.',
    apply(game) {
      const eligible = game.rng.shuffle(game.edges).slice(0, Math.max(3, Math.floor(game.edges.length * 0.09)));
      for (const edge of eligible) { edge.speed = Math.max(edge.speed, 1.45); edge.bikeLane = true; }
    }
  }
];

export class Game {
  constructor({ seed = createSeed(), width = 1000, height = 700 } = {}) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.width = width;
    this.height = height;
    this.elapsed = 0;
    this.score = 0;
    this.cash = 0;
    this.reputation = 100;
    this.completed = 0;
    this.failed = 0;
    this.wave = 1;
    this.speed = 1;
    this.paused = false;
    this.gameOver = false;
    this.upgradePending = false;
    this.nextUpgradeAt = 8;
    this.selectedDeliveryId = null;
    this.selectedCourierId = null;
    this.notice = 'Select a delivery, then a courier.';
    this.noticeUntil = 6;
    this.deliverySerial = 0;
    this.courierSerial = 0;
    this.spawnAccumulator = 0;
    this.modifiers = { speed: 1, deadline: 1, reward: 1, typeBias: Object.fromEntries(Object.keys(DELIVERY_TYPES).map((key) => [key, 1])) };
    this.runStats = { peakActive: 0, distance: 0 };
    this.generateCity();
    this.runTrait = this.rng.pick(RUN_TRAITS);
    this.runTrait.apply(this);
    this.hotDistrictId = null;
    this.deliveries = [];
    this.couriers = [];
    for (let i = 0; i < 3; i += 1) this.addCourier();
    this.spawnDelivery();
    this.spawnDelivery();
  }

  generateCity() {
    const districtCount = this.rng.int(4, 6);
    const shuffled = this.rng.shuffle(DISTRICT_ARCHETYPES).slice(0, districtCount);
    this.districts = shuffled.map((type, index) => {
      const angle = (Math.PI * 2 * index) / districtCount + this.rng.float(-0.3, 0.3);
      const orbit = this.rng.float(150, 250);
      const districtRadius = this.rng.float(95, 145);
      const rawX = this.width / 2 + Math.cos(angle) * orbit;
      const rawY = this.height / 2 + Math.sin(angle) * orbit;
      return { id: `district-${index}`, ...type, cx: Math.max(districtRadius + 35, Math.min(this.width - districtRadius - 35, rawX)), cy: Math.max(districtRadius + 35, Math.min(this.height - districtRadius - 35, rawY)), radius: districtRadius, demandBias: this.rng.float(0.8, 1.35) };
    });

    this.nodes = [];
    this.edges = [];
    let idCounter = 0;
    for (const district of this.districts) {
      const count = this.rng.int(6, 9);
      for (let i = 0; i < count; i += 1) {
        const angle = this.rng.float(0, Math.PI * 2);
        const radius = Math.sqrt(this.rng.next()) * district.radius * 0.8;
        this.nodes.push({ id: `n${idCounter++}`, districtId: district.id, x: district.cx + Math.cos(angle) * radius, y: district.cy + Math.sin(angle) * radius, kind: this.rng.pick(['shop', 'office', 'home', 'cafe']) });
      }
    }

    const centerNode = this.nodes.reduce((best, node) => {
      const d = Math.hypot(node.x - this.width / 2, node.y - this.height / 2);
      return !best || d < best.d ? { node, d } : best;
    }, null).node;
    this.depotNodeId = centerNode.id;
    centerNode.kind = 'depot';

    const seen = new Set();
    const addEdge = (a, b, speed = 1) => {
      if (!a || !b || a.id === b.id) return;
      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) return;
      seen.add(key);
      this.edges.push({ id: `e${this.edges.length}`, a: a.id, b: b.id, distance: distance(a, b), speed, bikeLane: false });
    };

    for (const node of this.nodes) {
      const nearest = this.nodes.filter((other) => other.id !== node.id).map((other) => ({ other, d: distance(node, other) })).sort((a, b) => a.d - b.d).slice(0, 3);
      for (const item of nearest) addEdge(node, item.other, this.rng.chance(0.12) ? 1.18 : 1);
    }

    const districtRepresentatives = this.districts.map((district) => this.nodes.filter((node) => node.districtId === district.id).sort((a, b) => distance(a, { x: district.cx, y: district.cy }) - distance(b, { x: district.cx, y: district.cy }))[0]);
    for (let i = 0; i < districtRepresentatives.length; i += 1) addEdge(districtRepresentatives[i], districtRepresentatives[(i + 1) % districtRepresentatives.length], 1.08);

    const components = () => {
      const adjacency = buildAdjacency(this.nodes, this.edges);
      const unvisited = new Set(this.nodes.map((node) => node.id));
      const groups = [];
      while (unvisited.size) {
        const first = unvisited.values().next().value;
        const stack = [first];
        const group = [];
        unvisited.delete(first);
        while (stack.length) {
          const id = stack.pop();
          group.push(id);
          for (const { to } of adjacency.get(id) ?? []) {
            if (!unvisited.has(to)) continue;
            unvisited.delete(to);
            stack.push(to);
          }
        }
        groups.push(group);
      }
      return groups;
    };

    let groups = components();
    while (groups.length > 1) {
      const primary = groups[0].map((id) => this.nodes.find((node) => node.id === id));
      let bridge = null;
      for (let groupIndex = 1; groupIndex < groups.length; groupIndex += 1) {
        for (const a of primary) {
          for (const id of groups[groupIndex]) {
            const b = this.nodes.find((node) => node.id === id);
            const d = distance(a, b);
            if (!bridge || d < bridge.d) bridge = { a, b, d };
          }
        }
      }
      addEdge(bridge.a, bridge.b, 1.02);
      groups = components();
    }
  }

  addCourier() {
    const depot = this.nodeById(this.depotNodeId);
    const index = this.courierSerial++;
    this.couriers.push({ id: `c${index}`, name: COURIER_NAMES[index % COURIER_NAMES.length], color: COURIER_COLORS[index % COURIER_COLORS.length], nodeId: depot.id, x: depot.x + (index - 1) * 8, y: depot.y + (index - 1) * 8, path: [], pathIndex: 0, targetNodeId: null, deliveryId: null, phase: 'idle', progress: 0, speed: 64 + (index % 3) * 4 });
  }

  nodeById(id) { return this.nodes.find((node) => node.id === id); }
  deliveryById(id) { return this.deliveries.find((delivery) => delivery.id === id); }
  courierById(id) { return this.couriers.find((courier) => courier.id === id); }

  spawnDelivery() {
    if (this.deliveries.filter((d) => d.status === 'waiting' || d.status === 'assigned').length > 28) return;
    const sourceDistrict = weightedPick(this.rng, this.districts, (district) => district.demandBias * (district.id === this.hotDistrictId ? 1.8 : 1));
    const pickup = this.rng.pick(this.nodes.filter((node) => node.kind !== 'depot' && node.districtId === sourceDistrict.id));
    const dropoff = this.rng.pick(this.nodes.filter((node) => node.id !== pickup.id && node.kind !== 'depot'));
    if (!dropoff) return;
    const district = this.districts.find((d) => d.id === pickup.districtId);
    const typeKey = weightedPick(this.rng, Object.keys(DELIVERY_TYPES), (key) => (district.demand.includes(key) ? 2.25 : 0.62) * (this.modifiers.typeBias[key] ?? 1));
    const type = DELIVERY_TYPES[typeKey];
    const directDistance = Math.max(80, distance(pickup, dropoff));
    const deadline = type.baseDeadline * this.modifiers.deadline * (0.82 + directDistance / 600) / (1 + (this.wave - 1) * 0.025);
    const id = `d${this.deliverySerial++}`;
    this.deliveries.push({ id, type: typeKey, pickupId: pickup.id, dropoffId: dropoff.id, createdAt: this.elapsed, deadlineAt: this.elapsed + deadline, reward: Math.round((type.reward + directDistance / 65) * this.modifiers.reward), status: 'waiting', courierId: null, pickedUp: false });
    this.runStats.peakActive = Math.max(this.runStats.peakActive, this.activeDeliveries().length);
  }

  activeDeliveries() { return this.deliveries.filter((d) => d.status === 'waiting' || d.status === 'assigned'); }

  assign(deliveryId, courierId) {
    const delivery = this.deliveryById(deliveryId);
    const courier = this.courierById(courierId);
    if (!delivery || !courier || delivery.status !== 'waiting' || courier.phase !== 'idle') return false;
    const path = shortestPath(this.nodes, this.edges, courier.nodeId, delivery.pickupId, this.edgeCost.bind(this));
    if (!path.length) return false;
    delivery.status = 'assigned';
    delivery.courierId = courier.id;
    courier.deliveryId = delivery.id;
    courier.phase = 'pickup';
    this.setCourierPath(courier, path, delivery.pickupId);
    this.selectedDeliveryId = null;
    this.selectedCourierId = courier.id;
    this.flash(`${courier.name} dispatched to ${DELIVERY_TYPES[delivery.type].label}.`);
    return true;
  }

  edgeCost(edge) { return edge.distance / Math.max(0.25, edge.speed ?? 1); }

  setCourierPath(courier, path, targetNodeId) {
    courier.path = path;
    courier.pathIndex = path.length > 1 ? 1 : 0;
    courier.targetNodeId = targetNodeId;
    courier.progress = 0;
  }

  update(dt) {
    if (this.paused || this.gameOver || this.upgradePending) return;
    const step = Math.min(0.05, dt) * this.speed;
    this.elapsed += step;
    this.spawnAccumulator += step;
    const spawnInterval = Math.max(1.8, 6.2 - this.wave * 0.26 - this.elapsed / 240);
    while (this.spawnAccumulator >= spawnInterval) {
      this.spawnAccumulator -= spawnInterval;
      this.spawnDelivery();
      if (this.wave >= 4 && this.rng.chance(0.12 + this.wave * 0.01)) this.spawnDelivery();
    }
    this.updateCouriers(step);
    this.updateDeadlines();
    const nextWave = 1 + Math.floor(this.completed / 7);
    if (nextWave > this.wave) {
      this.wave = nextWave;
      this.hotDistrictId = this.rng.pick(this.districts).id;
      const hot = this.districts.find((district) => district.id === this.hotDistrictId);
      this.flash(`${hot.name} demand surge · wave ${this.wave}`);
    } else this.wave = nextWave;
    if (this.completed >= this.nextUpgradeAt && !this.upgradePending) {
      this.upgradePending = true;
      this.nextUpgradeAt += 8 + Math.floor(this.wave / 2);
    }
    if (this.reputation <= 0) {
      this.reputation = 0;
      this.gameOver = true;
      this.paused = true;
    }
  }

  updateCouriers(dt) {
    for (const courier of this.couriers) {
      if (courier.phase === 'idle' || courier.path.length < 2 || courier.pathIndex >= courier.path.length) continue;
      const fromId = courier.path[courier.pathIndex - 1];
      const toId = courier.path[courier.pathIndex];
      const from = this.nodeById(fromId);
      const to = this.nodeById(toId);
      const edge = this.edges.find((item) => (item.a === fromId && item.b === toId) || (item.a === toId && item.b === fromId));
      const segmentDistance = Math.max(1, distance(from, to));
      const actualSpeed = courier.speed * this.modifiers.speed * (edge?.speed ?? 1);
      courier.progress += (actualSpeed * dt) / segmentDistance;
      this.runStats.distance += actualSpeed * dt;
      if (courier.progress >= 1) {
        courier.nodeId = toId;
        courier.x = to.x;
        courier.y = to.y;
        courier.progress = 0;
        courier.pathIndex += 1;
        if (courier.pathIndex >= courier.path.length) this.arrive(courier);
      } else {
        courier.x = from.x + (to.x - from.x) * courier.progress;
        courier.y = from.y + (to.y - from.y) * courier.progress;
      }
    }
  }

  arrive(courier) {
    const delivery = this.deliveryById(courier.deliveryId);
    if (!delivery) { this.releaseCourier(courier); return; }
    if (courier.phase === 'pickup') {
      delivery.pickedUp = true;
      courier.phase = 'dropoff';
      const path = shortestPath(this.nodes, this.edges, courier.nodeId, delivery.dropoffId, this.edgeCost.bind(this));
      if (!path.length) { this.failDelivery(delivery); this.releaseCourier(courier); return; }
      this.setCourierPath(courier, path, delivery.dropoffId);
      this.flash(`${courier.name} picked up ${DELIVERY_TYPES[delivery.type].label}.`);
    } else if (courier.phase === 'dropoff') {
      this.completeDelivery(delivery);
      this.releaseCourier(courier);
    }
  }

  releaseCourier(courier) {
    courier.phase = 'idle'; courier.deliveryId = null; courier.path = []; courier.pathIndex = 0; courier.progress = 0; courier.targetNodeId = null;
  }

  completeDelivery(delivery) {
    if (delivery.status === 'completed' || delivery.status === 'failed') return;
    const remaining = delivery.deadlineAt - this.elapsed;
    delivery.status = 'completed';
    this.completed += 1;
    const timeBonus = remaining > 0 ? Math.round(Math.min(15, remaining / 3)) : 0;
    const earned = delivery.reward + timeBonus;
    this.cash += earned;
    this.score += earned * 10 + this.wave * 5;
    this.reputation = Math.min(100, this.reputation + 1.3);
    this.flash(`Delivered! +€${earned}`);
  }

  failDelivery(delivery) {
    if (delivery.status === 'completed' || delivery.status === 'failed') return;
    delivery.status = 'failed';
    this.failed += 1;
    const penalty = delivery.type === 'medical' ? 22 : 12;
    this.reputation -= penalty;
    const courier = delivery.courierId ? this.courierById(delivery.courierId) : null;
    if (courier) this.releaseCourier(courier);
    this.flash(`${DELIVERY_TYPES[delivery.type].label} missed. Reputation -${penalty}.`);
  }

  updateDeadlines() { for (const delivery of this.activeDeliveries()) if (this.elapsed > delivery.deadlineAt) this.failDelivery(delivery); }
  getUpgradeChoices(count = 3) { return this.rng.shuffle(UPGRADES).slice(0, count); }

  applyUpgrade(id) {
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (!upgrade || !this.upgradePending) return;
    upgrade.apply(this);
    this.upgradePending = false;
    this.flash(`${upgrade.title} acquired.`);
  }

  flash(text) { this.notice = text; this.noticeUntil = this.elapsed + 4; }

  urgency(delivery) {
    const total = delivery.deadlineAt - delivery.createdAt;
    const remaining = delivery.deadlineAt - this.elapsed;
    return Math.max(0, Math.min(1, remaining / total));
  }

  selectDelivery(id) {
    const delivery = this.deliveryById(id);
    if (!delivery || delivery.status !== 'waiting') return;
    this.selectedDeliveryId = id;
    this.selectedCourierId = null;
  }

  selectCourier(id) {
    const courier = this.courierById(id);
    if (!courier) return;
    if (this.selectedDeliveryId && courier.phase === 'idle') this.assign(this.selectedDeliveryId, id);
    else this.selectedCourierId = id;
  }

  nearestEntity(x, y, maxDistance = 22) {
    let best = null;
    for (const delivery of this.activeDeliveries()) {
      if (delivery.status !== 'waiting') continue;
      const node = this.nodeById(delivery.pickupId);
      const d = Math.hypot(x - node.x, y - node.y);
      if (d <= maxDistance && (!best || d < best.distance)) best = { type: 'delivery', id: delivery.id, distance: d };
    }
    for (const courier of this.couriers) {
      const d = Math.hypot(x - courier.x, y - courier.y);
      if (d <= maxDistance && (!best || d < best.distance)) best = { type: 'courier', id: courier.id, distance: d };
    }
    return best;
  }

  summary() {
    return { seed: this.seed, score: Math.round(this.score), completed: this.completed, failed: this.failed, wave: this.wave, cash: this.cash, peakActive: this.runStats.peakActive, distanceKm: (this.runStats.distance / 1000).toFixed(1) };
  }
}
