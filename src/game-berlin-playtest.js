import { Game, PERSONALITIES, EXPERIENCE } from './game.js';
import { BASE_GAME_METHODS } from './game-core.js';
import { RIDER_SYSTEM } from './game-riders.js';

export const PLAYTEST_RULESET = 'berlin-dispatch-v1';
export const PLAYTEST_CITY = 'berlin-curated-v12';
export const FIXED_STEP = 1 / 60;
export const SHIFT_MODES = Object.freeze({
  training: Object.freeze({ name: 'First shift', arrivals: 120, closing: 60, target: 5, opening: 1, maxQueue: 6 }),
  standard: Object.freeze({ name: 'Berlin shift', arrivals: 480, closing: 60, target: 24, opening: 3, maxQueue: 10 })
});
export const SHIFT_UPGRADES = Object.freeze([
  { id: 'radio', title: 'An extra frequency', desc: 'One more radio slot for the rest of this shift.' },
  { id: 'rest', title: 'A better break room', desc: 'The team builds fatigue 25% more slowly.' },
  { id: 'legs', title: 'Fresh bike tune-up', desc: 'Every courier rides 12% faster.' }
]);
export const CARGO_FAMILIES = Object.freeze({
  document: { name: 'Light', detail: 'Quick handoff. Normal riding pace.', speed: 1, fatigue: .98 },
  fragile: { name: 'Delicate', detail: 'Careful handling. 10% slower when loaded.', speed: .9, fatigue: 1.12 },
  grocery: { name: 'Heavy', detail: 'A heavier ride. More tiring and 10% slower.', speed: .9, fatigue: 1.28 }
});

/** A small ruleset over the shared radio, graph and cargo-aware rider systems.
 * Optional full-game update/complete/spawn wrappers are deliberately not invoked.
 */
export class BerlinPlaytest extends Game {
  constructor({ seed = 'FIRST-BERLIN', mode = 'training' } = {}) {
    super({ seed, initialize: false });
    if (!Object.hasOwn(SHIFT_MODES, mode)) throw new Error('Unknown shift mode');
    this.mode = mode;
    this.ruleset = PLAYTEST_RULESET;
    this.config = SHIFT_MODES[mode];
    this.tick = 0;
    this.actions = [];
    this.outcome = null;
    this.closing = false;
    this.upgradeTaken = null;
    this.eventFinished = false;
    this.eventAnnounced = false;
    this.currentEvent = null;
    this.nextEventAt = mode === 'training' ? 90 : 160;
    this.nextUpgradeAt = Infinity;
    this.radioSlots = 3;
    this.cash = 10;
    this.startingCash = 10;
    this.dispatchFocus = this.dispatchFocusMax = 0;
    this.runTrait = { title: this.config.name, desc: 'You broadcast. Couriers choose.' };
    this.runContract = { title: 'Mitte + Kreuzberg', minTrip: mode === 'training' ? 70 : 130, maxTrip: mode === 'training' ? 300 : 680 };
    this.goals = [];
    this.modifiers.fatigue = .65;
    for (let i = 0; i < 3; i++) this.addCourier();
    for (let i = 0; i < this.config.opening; i++) this.spawnDelivery();
    this.selectedDeliveryId = this.deliveries[0].id;
    this.paused = true;
    this.flash('Choose a contract. Put it on the radio. Let a courier decide.', 12);
  }

  addCourier() {
    if (this.couriers.length >= 3) return false;
    BASE_GAME_METHODS.addCourier.call(this);
    const rider = this.couriers.at(-1), i = this.couriers.length - 1;
    rider.personality = PERSONALITIES.find(p => p.id === ['sprinter', 'earner', 'local'][i]);
    rider.experience = EXPERIENCE[1];
    rider.baseSpeed = [15, 13.5, 14][i];
    rider.homeDistrict = ['mitte', 'kreuzberg', 'mitte'][i];
    rider.fatigue = .08;
    return true;
  }

  weightedDeliveryType() {
    return this.rng.pick(this.completed < 1 && this.mode === 'training' ? ['document'] : Object.keys(CARGO_FAMILIES));
  }

  playableAddressNodes() {
    // The legacy center map contains disconnected street islands. A valid trip
    // inside an island is still impossible to collect from the depot component.
    if (!this.playtestAddresses) this.playtestAddresses = super.playableAddressNodes().filter(node => {
      const route = this.routeBetween(this.depotNodeId, node.id);
      return route.length && (this.mode !== 'training' || this.routeDistance(route) <= 350);
    });
    return this.playtestAddresses;
  }

  randomTrip() {
    for (let attempt = 0; attempt < 96; attempt++) {
      const pickup = this.randomAddress(), dropoff = this.randomAddress(pickup?.id);
      if (!pickup || !dropoff) continue;
      const path = this.routeBetween(pickup.id, dropoff.id), distance = this.routeDistance(path);
      if (path.length && distance >= this.runContract.minTrip && distance <= this.runContract.maxTrip)
        return { pickup, dropoff, path, distance };
    }
    return null;
  }

  spawnDelivery(options = {}) {
    if (this.closing || this.gameOver || this.activeDeliveries().length >= this.config.maxQueue) return false;
    const typeKey = options.typeKey ?? this.weightedDeliveryType();
    if (!Object.hasOwn(CARGO_FAMILIES, typeKey)) return false;
    if (options.pickupId && !this.playableAddressNodes().some(n => n.id === options.pickupId)) return false;
    if (options.dropoffId && !this.playableAddressNodes().some(n => n.id === options.dropoffId)) return false;
    // The opening teaches one achievable trip; subsequent jobs use the shared seeded graph.
    if (this.deliverySerial === 0 && this.mode === 'training' && !options.pickupId) {
      const depot = this.nodeById(this.depotNodeId);
      const near = this.playableAddressNodes().filter(n => n.id !== depot.id)
        .sort((a, b) => Math.hypot(a.x - depot.x, a.y - depot.y) - Math.hypot(b.x - depot.x, b.y - depot.y));
      const pickup = near[4], drop = near.find(n => this.routeDistance(this.routeBetween(pickup.id, n.id)) >= 100);
      options = { ...options, pickupId: pickup.id, dropoffId: drop.id };
    }
    const created = BASE_GAME_METHODS.spawnDelivery.call(this, { ...options, typeKey, special: false });
    if (!created) return false;
    const d = this.deliveries.at(-1), cargo = CARGO_FAMILIES[typeKey];
    d.cargoSpeed = cargo.speed;
    d.cargoFatigue = cargo.fatigue;
    d.handlingLabel = cargo.detail;
    d.family = cargo.name;
    d.specialDesc = cargo.detail;
    d.reward = Math.round(10 + d.plannedDistance / 38 + (typeKey === 'document' ? 0 : 5));
    d.deadlineAt = Math.min(this.config.arrivals + this.config.closing,
      this.elapsed + (this.mode === 'training' ? 85 : 48) + d.plannedDistance / 14);
    d.bonusPaid = 0;
    return true;
  }

  phase() {
    if (this.gameOver) return { id: 'finished', label: 'Shift complete', detail: 'A moment to look back.' };
    if (this.closing) return { id: 'closing', label: 'Last deliveries', detail: 'No new work. Finish the remaining jobs before the desk closes.' };
    const ratio = this.elapsed / this.config.arrivals;
    if (ratio < .2) return { id: 'opening', label: 'Find your rhythm', detail: 'Start with nearby work and learn what each courier likes.' };
    if (ratio < .43) return { id: 'build', label: 'Work is picking up', detail: 'Choose which jobs deserve the radio.' };
    if (ratio < .65) return { id: 'recovery', label: 'Room to recover', detail: 'Clear the queue and watch who is resting.' };
    return { id: 'push', label: 'One last push', detail: 'Keep the team moving. Leave room for an urgent call.' };
  }

  arrivalInterval() {
    if (this.mode === 'training') return this.completed < 1 ? 32 : 20;
    return { opening: 22, build: 11, recovery: 24, push: 12 }[this.phase().id] ?? 20;
  }

  updateRoadEvent() {
    if (this.eventFinished) return;
    if (!this.currentEvent && this.elapsed >= this.nextEventAt - 25) {
      const candidates = this.visualEdges.filter(e => e.roadClass !== 'connector' && this.visualEdgePlayable(e.id));
      const preferred = candidates.filter(e => /Friedrichstraße|Leipziger Straße/.test(e.streetName));
      const edge = this.rng.pick(preferred.length ? preferred : candidates);
      if (!edge) { this.eventFinished = true; return; }
      this.currentEvent = {
        id: 'berlin-roadworks', type: 'roadworks', kind: 'route', state: 'forecast', title: 'Roadworks',
        place: edge.streetName, startsAt: this.nextEventAt, endsAt: this.nextEventAt + (this.mode === 'training' ? 30 : 65),
        factor: .3, visualIds: [edge.id], edgeIds: this.edges.filter(e => e.visualId === edge.id).map(e => e.id)
      };
      this.logDispatch('event-forecast', null, { title: 'Roadworks', place: edge.streetName });
    }
    const ev = this.currentEvent;
    if (!ev) return;
    if (ev.state === 'forecast' && this.elapsed >= ev.startsAt) {
      ev.state = 'active';
      for (const id of ev.edgeIds) this.edgeById(id).eventMultiplier = ev.factor;
      this.invalidateRouting();
      for (const rider of this.couriers) if (['pickup', 'dropoff'].includes(rider.phase)) this.rerouteCourier(rider);
      this.logDispatch('event-start', null, { title: ev.title, place: ev.place });
      this.flash(`${ev.place} is slower. Couriers choose their own detours.`, 8);
    }
    if (this.elapsed >= ev.endsAt) {
      for (const id of ev.edgeIds) this.edgeById(id).eventMultiplier = 1;
      this.invalidateRouting();
      this.logDispatch('event-end', null, { title: ev.title, place: ev.place });
      this.currentEvent = null;
      this.eventFinished = true;
      this.flash('The road is clear. A little breathing room.', 6);
    }
  }

  completeDelivery(c, d) {
    RIDER_SYSTEM.completeDelivery.call(this, c, d);
  }

  failDelivery(d) {
    if (!['waiting', 'claimed'].includes(d.status)) return;
    d.failedAt = this.elapsed;
    RIDER_SYSTEM.failDelivery.call(this, d);
    if (this.reputation <= 0) this.finishShift('collapse');
  }

  sweetenJob(id) {
    const d = this.deliveryById(id);
    if (this.gameOver || !d || d.status !== 'waiting' || d.sweetened || this.cash < 5) return false;
    this.cash -= 5;
    d.bonusPaid = 5;
    d.bonusAppeal += .5;
    d.sweetened = true;
    this.runStats.toolsUsed++;
    this.invalidateDeliberations(id);
    this.logDispatch('sweeten', d, { cost: 5, clientFee: d.reward });
    this.flash(`€5 courier bonus. Client fee stays €${d.reward}.`, 5);
    return true;
  }

  getUpgradeChoices() { return SHIFT_UPGRADES; }
  applyUpgrade(id) {
    if (!this.upgradePending || this.upgradeTaken || !SHIFT_UPGRADES.some(u => u.id === id)) return false;
    if (id === 'radio') this.radioSlots++;
    if (id === 'rest') this.modifiers.fatigue *= .75;
    if (id === 'legs') this.modifiers.speed *= 1.12;
    this.upgradeTaken = id;
    this.upgradePending = false;
    this.logDispatch('upgrade', null, { upgrade: SHIFT_UPGRADES.find(u => u.id === id).title });
    return true;
  }

  /** All player mutations use this validated vocabulary. No rider argument is accepted. */
  dispatch(action) {
    if (!action || this.gameOver) return false;
    let ok = false, recorded;
    switch (action.type) {
      case 'radio':
        if (!['open', 'local', 'priority', 'off'].includes(action.channel)) return false;
        ok = this.setChannel(action.jobId, action.channel);
        recorded = { type: 'radio', jobId: action.jobId, channel: action.channel };
        break;
      case 'bonus': ok = this.sweetenJob(action.jobId); recorded = { type: 'bonus', jobId: action.jobId }; break;
      case 'upgrade': ok = this.applyUpgrade(action.id); recorded = { type: 'upgrade', id: action.id }; break;
      case 'pause':
        if (typeof action.paused !== 'boolean') return false;
        this.paused = action.paused; ok = true; recorded = { type: 'pause', paused: action.paused }; break;
      case 'speed':
        if (![1, 2].includes(action.speed)) return false;
        this.speed = action.speed; ok = true; recorded = { type: 'speed', speed: action.speed }; break;
      default: return false;
    }
    if (ok) this.actions.push({ tick: this.tick, ...recorded });
    return ok;
  }

  update(dt) {
    if (this.paused || this.gameOver || this.upgradePending || !Number.isFinite(dt) || dt <= 0) return;
    const end = this.config.arrivals + this.config.closing;
    const scaled = Math.min(dt * this.speed, end - this.elapsed);
    this.tick++;
    this.elapsed += scaled;
    if (this.elapsed >= this.config.arrivals) this.closing = true;
    this.updateRoadEvent();
    if (!this.closing) {
      this.spawnAccumulator += scaled;
      const interval = this.arrivalInterval();
      while (this.spawnAccumulator >= interval) { this.spawnAccumulator -= interval; this.spawnDelivery(); }
    }
    for (const d of this.activeDeliveries()) {
      if (this.elapsed >= d.deadlineAt) this.failDelivery(d);
      if (this.gameOver) return;
    }
    for (const c of this.couriers) {
      if (c.phase === 'break') {
        c.fatigue = Math.max(0, c.fatigue - scaled * .04);
        if (this.elapsed >= c.breakUntil) this.endBreak(c);
      } else if (c.phase === 'idle') {
        c.fatigue = Math.max(0, c.fatigue - scaled * .0011);
        if (!c.radioOn) continue;
        if (c.deliberation) {
          const d = this.deliveryById(c.deliberation.deliveryId);
          if (!d?.called || d.status !== 'waiting') { c.deliberation = null; c.decisionAt = this.elapsed + .1; }
          else if (this.elapsed >= c.deliberation.readyAt) this.resolveDeliberation(c);
        } else if (this.elapsed >= c.decisionAt) this.beginDeliberation(c);
      } else this.moveCourier(c, scaled);
    }
    if (this.elapsed >= end || (this.closing && !this.activeDeliveries().length)) {
      // Outstanding work receives the same explicit miss penalty as expired work.
      for (const d of this.activeDeliveries()) this.failDelivery(d);
      this.finishShift(this.reputation > 0 && this.completed >= this.config.target ? 'success' : 'target-missed');
      return;
    }
    if (!this.closing && !this.upgradeTaken && this.elapsed >= this.config.arrivals * .5) this.upgradePending = true;
  }

  finishShift(reason) {
    if (this.outcome) return;
    this.outcome = reason;
    this.gameOver = this.paused = true;
    this.upgradePending = false;
    this.logDispatch('shift-finish', null, { outcome: reason, completed: this.completed, target: this.config.target });
  }

  shiftReview() {
    const misses = this.deliveries.filter(d => d.status === 'failed');
    const causes = [
      { id: 'never-called', label: 'Work left off the radio', tip: 'A deadline keeps running while a job waits off-air.' },
      { id: 'called-unclaimed', label: 'Calls with no taker', tip: 'Try LOCAL near a free courier, or reserve two slots for PRIORITY.' },
      { id: 'claimed-late', label: 'Trips that ran out of time', tip: 'Leave room for travel to pickup, heavy cargo and tired riders.' }
    ].map(cause => ({ ...cause, count: misses.filter(d => d.failureKind === cause.id).length }))
      .sort((a, b) => b.count - a.count);
    const top = [...this.couriers].sort((a, b) => b.completed - a.completed)[0];
    return { outcome: this.outcome, completed: this.completed, target: this.config.target,
      failed: this.failed, profit: this.cash - this.startingCash, reputation: this.reputation,
      topRider: top.name, topDeliveries: top.completed, causes,
      lesson: causes[0].count ? causes[0].tip : 'Clean work. Try the same shift with fewer priority calls or a different upgrade.' };
  }

  exportRun() {
    return { version: 1, ruleset: this.ruleset, city: PLAYTEST_CITY, seed: this.seed, mode: this.mode,
      fixedStep: FIXED_STEP, ticks: this.tick, actions: this.actions.map(a => ({ ...a })),
      review: this.shiftReview(), timeline: this.dispatchLog.map(entry => ({ ...entry })) };
  }

  // Disabled systems cannot consume resources, create work, or affect outcomes in this ruleset.
  updateGoals() {} recoverFocus() {} updateServicePressure() {}
  maybeAdvanceCity() { return false; } spawnReturnLeg() { return false; }
  spendFocus() { return false; } extendJob() { return false; } rebroadcastJob() { return false; }
  respondToCityEvent() { return false; } briefDistrict() { return false; }
  districtBriefActive() { return false; } servicePressureSnapshot() { return []; }
  activeClientHubs() { return []; } districtPressure() { return null; }
}

export function replayRun(record) {
  if (record?.version !== 1 || record.ruleset !== PLAYTEST_RULESET || record.city !== PLAYTEST_CITY ||
      record.fixedStep !== FIXED_STEP || !Number.isInteger(record.ticks) || record.ticks < 0 || record.ticks > 40000 ||
      !Array.isArray(record.actions) || record.actions.length > 10000) throw new Error('Unsupported replay');
  const game = new BerlinPlaytest({ seed: record.seed, mode: record.mode });
  let index = 0;
  while (game.tick <= record.ticks) {
    while (index < record.actions.length && record.actions[index].tick === game.tick) {
      if (!game.dispatch(record.actions[index++])) throw new Error('Replay action rejected');
    }
    if (game.tick === record.ticks) break;
    const before = game.tick;
    game.update(FIXED_STEP);
    if (before === game.tick) throw new Error('Replay cannot advance');
  }
  if (index !== record.actions.length) throw new Error('Replay actions are out of order');
  return game;
}
