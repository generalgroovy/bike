import { shortestPathIndexed } from './graph.js';

// v6 keeps the dispatcher indirect: an offer changes appeal, never ownership.
export const RIDER_BIKES = Object.freeze({
  road: Object.freeze({ label: 'Road bike', capacityKg: 5, speed: 9.5, acceptedTypes: ['document', 'fragile'], preferences: 'Light parcels · short, urgent trips', favorite: 'document' }),
  city: Object.freeze({ label: 'City bike', capacityKg: 12, speed: 8.5, acceptedTypes: ['document', 'fragile', 'grocery'], preferences: 'Good fees · delicate parcels', favorite: 'fragile' }),
  cargo: Object.freeze({ label: 'Cargo bike', capacityKg: 30, speed: 7.7, acceptedTypes: ['document', 'fragile', 'grocery'], preferences: 'Heavy loads · familiar streets', favorite: 'grocery' })
});
const HANDLING_PHASES = ['loading', 'handover', 'waiting-window'];
const ACTIVE_PHASES = ['pickup', 'dropoff', ...HANDLING_PHASES];
const costCaches = new WeakMap();
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

// Forecasts use a private routing cache. Reading an offer must not consume RNG,
// increment simulation counters, reserve work, or alter replay state.
function travelCost(game, from, to) {
  if (from === to) return 0;
  let cache = costCaches.get(game);
  if (!cache || cache.revision !== game.routingRevision) {
    cache = { revision: game.routingRevision, costs: new Map() };
    costCaches.set(game, cache);
  }
  const key = `${from}>${to}`;
  if (cache.costs.has(key)) return cache.costs.get(key);
  const path = shortestPathIndexed(game.graph, from, to, (edge, origin) => game.edgeCost(edge, origin));
  let cost = path.length ? 0 : Infinity;
  for (let i = 1; i < path.length; i++) {
    const edge = game.edgeByIds(path[i - 1], path[i]);
    cost += edge.distance / Math.max(.16, (edge.speed ?? 1) * (edge.eventMultiplier ?? 1));
  }
  cache.costs.set(key, cost);
  if (cache.costs.size > 4096) cache.costs.delete(cache.costs.keys().next().value);
  return cost;
}

function loadHandling(game, c, loaded) {
  let speed = 1, fatigue = 1, kg = 0;
  for (const d of loaded) {
    const handling = game.cargoHandlingFor(d);
    speed = Math.min(speed, handling.speed ?? 1);
    fatigue = Math.max(fatigue, handling.fatigue ?? 1);
    kg += d.weightKg ?? 0;
  }
  const burden = kg / Math.max(1, c.capacityKg);
  return { speed: speed * (1 - .16 * burden) * (1 - .18 * c.fatigue), fatigue: fatigue * (1 + .9 * burden), kg };
}

function routeOrigin(game, c, loaded) {
  const node = game.nodeById(c.nodeId), target = game.nodeById(c.path?.[c.pathIndex]);
  if (!target || Math.hypot(c.x - node.x, c.y - node.y) < 1e-6) return { nodeId: c.nodeId, seconds: 0 };
  const edge = game.edgeByIds(c.path[c.pathIndex - 1], target.id);
  const speed = c.baseSpeed * c.experience.speed * game.modifiers.speed * loadHandling(game, c, loaded).speed;
  return { nodeId: target.id, seconds: Math.hypot(c.x - target.x, c.y - target.y) / (speed * (edge?.speed ?? 1) * (edge?.eventMultiplier ?? 1)) };
}

function simulateStops(game, c, stops, extra = null, enforce = true, detail = false) {
  const jobs = game.riderJobs(c), loaded = jobs.filter(d => d.pickedUp);
  const origin = routeOrigin(game, c, loaded);
  let nodeId = origin.nodeId, seconds = origin.seconds, peakKg = game.riderLoad(c), fatigue = c.fatigue;
  const arrivals = {}, finishes = {}, pickups = {}, itinerary = [];
  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i], d = stop.jobId === extra?.id ? extra : game.deliveryById(stop.jobId);
    if (!d || !['waiting', 'claimed'].includes(d.status)) continue;
    const target = stop.kind === 'pickup' ? d.pickupId : d.dropoffId;
    const handling = loadHandling(game, { ...c, fatigue }, loaded);
    const speed = c.baseSpeed * c.experience.speed * game.modifiers.speed * handling.speed;
    // A cheap geographic lower bound avoids searching across all Berlin for an
    // offer whose deadline already cannot fit, even at unloaded speed.
    const a = game.nodeById(nodeId), b = game.nodeById(target);
    if (enforce && Math.hypot(a.x - b.x, a.y - b.y) / speed > d.deadlineAt - game.elapsed - seconds) return null;
    const travel = travelCost(game, nodeId, target) / speed;
    if (!Number.isFinite(travel)) return null;
    seconds += travel;
    fatigue = clamp(fatigue + travel * .00315 * c.experience.fatigue * game.modifiers.fatigue * handling.fatigue, 0, 1);
    arrivals[d.id] ??= seconds;
    const arrivalIn = seconds, loadBeforeKg = handling.kg;
    const waitSeconds = stop.kind === 'dropoff' ? Math.max(0, (d.deliverAfter ?? 0) - game.elapsed - seconds) : 0;
    const continuing = i === 0 && c.stops?.[0]?.jobId === stop.jobId && c.stops[0].kind === stop.kind && HANDLING_PHASES.includes(c.phase);
    if (stop.kind === 'pickup') {
      seconds += continuing && c.phase === 'loading' ? Math.max(0, c.handoffUntil - game.elapsed) : game.handoffTime(d).pickup;
      loaded.push(d);
      peakKg = Math.max(peakKg, loaded.reduce((sum, item) => sum + item.weightKg, 0));
      pickups[d.id] = seconds;
      if (peakKg > c.capacityKg + 1e-8) return null;
    } else {
      seconds = Math.max(seconds, (d.deliverAfter ?? 0) - game.elapsed);
      seconds += continuing && c.phase === 'handover' ? Math.max(0, c.handoffUntil - game.elapsed) : game.handoffTime(d).dropoff;
      finishes[d.id] = seconds;
      if (enforce && game.elapsed + seconds > d.deadlineAt - 1) return null;
      const at = loaded.findIndex(item => item.id === d.id);
      if (at >= 0) loaded.splice(at, 1);
    }
    if (detail) itinerary.push({ jobId: d.id, kind: stop.kind, nodeId: target,
      addressId: b.sourceId ?? target, address: stop.kind === 'pickup' ? d.pickupAddress : d.dropoffAddress,
      arrivalIn, doneIn: seconds, waitSeconds, loadBeforeKg,
      loadAfterKg: loaded.reduce((sum, item) => sum + (item.weightKg ?? 0), 0) });
    nodeId = target;
  }
  return { stops, seconds, finishes, pickups, arrivals, peakKg, fatigue, endNodeId: nodeId, itinerary };
}

function planOffer(game, c, d) {
  if (!c || !d || d.status !== 'waiting') return { reason: 'Already accepted or finished' };
  if (!c.radioOn || c.phase === 'break' || c.phase === 'coasting') return { reason: 'Radio off · recovering' };
  const profile = RIDER_BIKES[c.bikeType];
  if (!profile?.acceptedTypes.includes(d.type)) return { reason: 'Bike does not carry this cargo' };
  if (d.weightKg > c.capacityKg) return { reason: `${d.weightKg} kg exceeds ${c.capacityKg} kg capacity` };
  const jobs = game.riderJobs(c);
  if (jobs.length >= 2) return { reason: 'Two jobs already committed' };
  if (c.fatigue >= .9) return { reason: 'Needs an endurance break' };
  const existing = (c.stops ?? []).filter(stop => game.deliveryById(stop.jobId)?.status === 'claimed');
  const baseline = existing.length ? simulateStops(game, c, existing) : null;
  let best = null;
  const locked = HANDLING_PHASES.includes(c.phase) && c.phase !== 'waiting-window' ? 1 : 0;
  for (let pick = locked; pick <= existing.length; pick++) {
    for (let drop = pick + 1; drop <= existing.length + 1; drop++) {
      const stops = existing.map(stop => ({ ...stop }));
      stops.splice(pick, 0, { jobId: d.id, kind: 'pickup' });
      stops.splice(drop, 0, { jobId: d.id, kind: 'dropoff' });
      const plan = simulateStops(game, c, stops, d);
      if (!plan) continue;
      // Added work may make a modest detour, but cannot sacrifice an existing
      // commitment or keep another customer's parcel waiting indefinitely.
      if (baseline && jobs.some(job => plan.finishes[job.id] > baseline.finishes[job.id] + Math.max(12, baseline.finishes[job.id] * .25))) continue;
      if (plan.fatigue >= .99) continue;
      const finishIn = plan.finishes[d.id], merit = plan.seconds + finishIn * .1;
      if (!best || merit < best.merit) best = { ...plan, baseline, merit, finishIn, margin: d.deadlineAt - game.elapsed - finishIn, mode: !existing.length ? 'ready' : pick < existing.length ? 'on the way' : 'next', reason: !existing.length ? 'Can collect now' : pick < existing.length ? 'Fits along the current route' : 'Fits after the current job' };
    }
  }
  return best ?? { reason: 'Timing, detour or remaining endurance does not fit' };
}

function scoreOffer(game, c, d, plan) {
  if (!plan?.stops) return -Infinity;
  const pickup = game.nodeById(d.pickupId), current = game.nodeById(c.nodeId);
  const same = pickup.districtId === current.districtId;
  const closeness = 1 / (1 + (plan.pickups[d.id] ?? 0) / 28);
  const reward = Math.min(1.9, d.reward / 30), urgency = 1 - game.urgency(d), w = c.personality.weights;
  let score = closeness * (w.distance ?? 0) + urgency * (w.urgency ?? 0) + reward * (w.reward ?? 0) + (same ? w.sameDistrict ?? 0 : 0);
  if (c.bikeType === 'road') score += (closeness > .6 ? .3 : 0) + (urgency > .38 ? .4 : 0);
  if (c.bikeType === 'city' && reward > .95) score += .5;
  if (c.bikeType === 'cargo' && same) score += .35;
  if (RIDER_BIKES[c.bikeType].favorite === d.type) score += .4;
  if (d.channel === 'local') score += same ? .74 : closeness > .6 ? .24 : -.28;
  if (d.channel === 'priority') score += .65;
  score += d.bonusAppeal ?? 0;
  if (d.preferredRiderId === c.id) score += .75;
  if (plan.mode === 'on the way') score += .15;
  return score - c.fatigue * .45;
}

// These labels mirror positive terms in scoreOffer. They explain a rider's
// actual preferences; carrying capacity and deadlines remain hard constraints.
function appealReasons(game, c, d, plan) {
  if (!plan?.stops) return [];
  const same = game.nodeById(d.pickupId).districtId === game.nodeById(c.nodeId).districtId;
  const closeness = 1 / (1 + (plan.pickups[d.id] ?? 0) / 28), urgency = 1 - game.urgency(d);
  const reasons = [];
  if (d.preferredRiderId === c.id) reasons.push('Personal invitation');
  if ((d.bonusAppeal ?? 0) > 0) reasons.push(d.sweetened ? 'Courier bonus' : 'Contract appeal');
  if (RIDER_BIKES[c.bikeType]?.favorite === d.type) reasons.push('Preferred cargo');
  if (closeness > .6 && ((c.personality.weights.distance ?? 0) > 0 || c.bikeType === 'road')) reasons.push('Nearby pickup');
  if (c.bikeType === 'road' && urgency > .38) reasons.push('Urgent trip suits a road bike');
  if (c.bikeType === 'city' && Math.min(1.9, d.reward / 30) > .95) reasons.push('Good fee suits a city bike');
  if (same && ((c.personality.weights.sameDistrict ?? 0) > 0 || c.bikeType === 'cargo')) reasons.push('Familiar pickup district');
  if (d.channel === 'priority') reasons.push('Priority signal');
  if (d.channel === 'local' && (same || closeness > .6)) reasons.push(same ? 'Local signal in this district' : 'Local signal near pickup');
  if (plan.mode === 'on the way') reasons.push('Fits along the current route');
  return reasons;
}

function offerConsequences(game, c, d, plan) {
  const current = c ? game.riderEndurance(c) : { current: 0, max: 100 };
  const base = { feasible: !!plan?.stops, reason: plan?.reason ?? 'Choose a rider and an open offer',
    pickupIn: null, finishIn: null, margin: null, mode: null,
    endurance: { ...current, projected: null },
    load: { currentKg: c ? game.riderLoad(c) : 0, peakKg: null, capacityKg: c?.capacityKg ?? 0 },
    addedTourSeconds: null, baselineTourSeconds: null, tourSeconds: null,
    commitments: [], itinerary: [], appealReasons: appealReasons(game, c, d, plan) };
  if (!plan?.stops) return base;
  // Only the winning itinerary needs detailed annotations. Route distances
  // are already in the private forecast cache, so this does not search again.
  const detailed = simulateStops(game, c, plan.stops, d, false, true);
  const baseline = plan.baseline;
  return { ...base, pickupIn: plan.pickups[d.id], finishIn: plan.finishIn, margin: plan.margin, mode: plan.mode,
    endurance: { ...current, projected: Math.round((1 - clamp(plan.fatigue, 0, 1)) * current.max) },
    load: { ...base.load, peakKg: plan.peakKg },
    addedTourSeconds: plan.seconds - (baseline?.seconds ?? 0), baselineTourSeconds: baseline?.seconds ?? 0, tourSeconds: plan.seconds,
    commitments: game.riderJobs(c).map(job => ({ jobId: job.id,
      baselineFinishIn: baseline?.finishes[job.id] ?? null, finishIn: plan.finishes[job.id],
      delaySeconds: baseline ? plan.finishes[job.id] - baseline.finishes[job.id] : null,
      margin: job.deadlineAt - game.elapsed - plan.finishes[job.id] })),
    itinerary: detailed?.itinerary ?? [] };
}

export function installPlaytestLogistics(Type) {
  const p = Type.prototype;
  const keys = ['addCourier', 'spawnDelivery', 'arrivalInterval', 'dispatch', 'courierChoiceScore', 'choiceReason', 'beginDeliberation', 'predictCall', 'claim', 'arrive', 'moveCourier', 'finishEdge', 'releaseCourier', 'courierETA', 'courierAvailability', 'offerMargin', 'deliveryFeasibility', 'setChannel'];
  const old = Object.fromEntries(keys.map(key => [key, p[key]]));
  p.riderJobs = function(c) { return this.deliveries.filter(d => d.courierId === c?.id && d.status === 'claimed'); };
  p.riderLoad = function(c) { return this.riderJobs(c).filter(d => d.pickedUp).reduce((sum, d) => sum + (d.weightKg ?? 0), 0); };
  p.riderEndurance = function(c) { return { current: Math.round((1 - clamp(c.fatigue, 0, 1)) * (c.enduranceMax ?? 100)), max: c.enduranceMax ?? 100 }; };
  p.riderProfile = function(c) { const bike = RIDER_BIKES[c.bikeType] ?? RIDER_BIKES.city; return { ...bike, endurance: this.riderEndurance(c).current, enduranceMax: c.enduranceMax ?? 100, loadKg: this.riderLoad(c), capacityKg: c.capacityKg ?? bike.capacityKg }; };
  p.offerConsequences = function(c, d) {
    return offerConsequences(this, c, d, this.logistics ? planOffer(this, c, d) : { reason: 'Detailed tours require the current Berlin ruleset' });
  };
  p.riderTour = function(c) {
    const endurance = c ? this.riderEndurance(c) : { current: 0, max: 100 }, currentKg = c ? this.riderLoad(c) : 0;
    const summary = { feasible: !!c && this.logistics, reason: !c ? 'Choose a rider' : !this.logistics ? 'Detailed tours require the current Berlin ruleset' : 'Current remaining tour',
      endurance: { ...endurance, projected: endurance.current }, load: { currentKg, peakKg: currentKg, capacityKg: c?.capacityKg ?? 0 }, tourSeconds: 0, itinerary: [] };
    if (!summary.feasible) return summary;
    const stops = (c.stops ?? []).filter(stop => this.deliveryById(stop.jobId)?.status === 'claimed');
    if (!stops.length) return { ...summary, reason: 'No accepted work' };
    const plan = simulateStops(this, c, stops, null, false, true);
    if (!plan) return { ...summary, feasible: false, reason: 'Remaining route cannot currently be estimated', tourSeconds: null };
    return { ...summary, endurance: { ...endurance, projected: Math.round((1 - clamp(plan.fatigue, 0, 1)) * endurance.max) },
      load: { ...summary.load, peakKg: plan.peakKg }, tourSeconds: plan.seconds, itinerary: plan.itinerary };
  };
  p.addCourier = function() {
    const result = old.addCourier.call(this);
    if (result && this.logistics) {
      const c = this.couriers.at(-1), bikeType = ['road', 'city', 'cargo'][this.couriers.length - 1], profile = RIDER_BIKES[bikeType];
      Object.assign(c, { bikeType, capacityKg: profile.capacityKg, enduranceMax: 100, baseSpeed: profile.speed, stops: [] });
    }
    return result;
  };
  p.spawnDelivery = function(options = {}) {
    let localBikes = [];
    if (this.logistics && !options.typeKey) {
      const anchor = this.couriers[this.deliverySerial % this.couriers.length];
      localBikes = this.couriers.filter(c => Math.hypot(c.x - anchor.x, c.y - anchor.y) < 300);
      // Citywide riders start far apart. Generated work must have a bike in its
      // service area that can carry it; an impossible random load is no choice.
      const types = [...new Set(localBikes.flatMap(c => RIDER_BIKES[c.bikeType].acceptedTypes))];
      options = { ...options, typeKey: this.mode === 'training' && this.completed < 1 ? 'document' : this.rng.pick(types) };
    }
    const result = old.spawnDelivery.call(this, options);
    if (result && this.logistics) {
      const d = this.deliveries.at(-1), serial = this.deliverySerial - 1;
      const weights = { document: [.5, 1, 1.5], fragile: [2, 3, 4], grocery: [6, 10, 16] };
      d.weightKg = Number.isFinite(options.weightKg) && options.weightKg > 0 ? options.weightKg : weights[d.type][serial % 3];
      if (localBikes.length) {
        const capacity = Math.max(...localBikes.filter(c => RIDER_BIKES[c.bikeType].acceptedTypes.includes(d.type)).map(c => c.capacityKg));
        d.weightKg = Math.min(d.weightKg, capacity);
      }
      const scheduled = serial > 0 && serial % 4 === 0;
      d.deliverAfter = Number.isFinite(options.deliverAfter) ? Math.max(this.elapsed, options.deliverAfter) : scheduled ? this.elapsed + 55 : this.elapsed;
      d.deadlineAt = Math.min(this.config.arrivals + this.config.closing, Math.max(d.deliverAfter + 35, this.elapsed + (this.mode === 'training' ? 85 : 95) + d.plannedDistance / 9.5));
      d.preferredRiderId = null;
    }
    return result;
  };
  p.arrivalInterval = function() {
    if (!this.logistics) return old.arrivalInterval.call(this);
    return this.mode === 'training' ? this.completed < 1 ? 32 : 26 : ({ opening: 24, build: 16, recovery: 26, push: 18 }[this.phase().id] ?? 24);
  };
  p.dispatch = function(action) {
    if (!this.logistics || action?.type !== 'prefer') return old.dispatch.call(this, action);
    const d = this.deliveryById(action.jobId), rider = action.riderId == null ? null : this.courierById(action.riderId);
    if (this.gameOver || d?.status !== 'waiting' || (action.riderId != null && !rider)) return false;
    d.preferredRiderId = rider?.id ?? null;
    this.invalidateDeliberations(d.id);
    this.actions.push({ tick: this.tick, type: 'prefer', jobId: d.id, riderId: d.preferredRiderId });
    this.logDispatch('prefer', d, { rider: rider?.name ?? null });
    return true;
  };
  p.broadcastForecast = function(d, channel = 'open') {
    const probe = { ...d, called: true, channel };
    const rows = this.couriers.map(rider => {
      const plan = planOffer(this, rider, probe), score = scoreOffer(this, rider, probe, plan);
      const otherCalls = this.calledDeliveries().filter(item => item.id !== d.id);
      const committedThought = otherCalls.find(item => item.id === rider.deliberation?.deliveryId);
      const strongestOther = otherCalls.map(delivery => ({ delivery, score: scoreOffer(this, rider, delivery, planOffer(this, rider, delivery)) })).sort((a, b) => b.score - a.score)[0];
      const competing = committedThought ?? (strongestOther?.score > score ? strongestOther.delivery : null);
      const preference = probe.preferredRiderId === rider.id ? 'personal invitation' : probe.sweetened ? 'courier bonus' : RIDER_BIKES[rider.bikeType]?.favorite === probe.type ? 'preferred cargo' : channel === 'local' ? 'nearby work signal' : channel === 'priority' ? 'priority signal' : null;
      const reason = !plan.stops ? plan.reason : competing ? `Considering ${competing.id.toUpperCase()} first` : `${plan.reason}${preference ? ` · ${preference}` : ''}`;
      const reactionIn = rider.deliberation?.deliveryId === d.id ? Math.max(0, rider.deliberation.readyAt - this.elapsed) : Math.max(0, Math.min(rider.decisionAt - this.elapsed, .16)) + Math.max(.25, rider.experience.think / this.modifiers.teamSkill * .67 / (.8 + Math.max(0, score) * .24));
      return { rider, score, eligible: Number.isFinite(score), competingJob: competing?.id ?? null, reactionIn, reason, appealReasons: appealReasons(this, rider, probe, plan), finishIn: plan.finishIn ?? Infinity, margin: plan.margin ?? -Infinity, mode: plan.mode ?? null };
    }).sort((a, b) => Number(b.eligible && !b.competingJob) - Number(a.eligible && !a.competingJob) || a.reactionIn - b.reactionIn || b.score - a.score || a.rider.id.localeCompare(b.rider.id));
    const leader = rows.find(row => row.eligible && !row.competingJob && row.score >= .3);
    const cost = channel === 'priority' ? 2 : channel === 'off' ? 0 : 1;
    const available = this.radioUsed() - this.radioCost(d) + cost <= this.radioSlots;
    return { rider: available && channel !== 'off' ? leader?.rider ?? null : null, rows, available, cost, reason: !available ? 'Not enough free radio slots' : leader ? `${leader.rider.name} is the strongest current fit; riders still choose` : rows.some(row => row.competingJob && row.eligible) ? 'Suitable riders currently prefer other live calls' : 'No rider can currently fit this offer' };
  };
  p.courierChoiceScore = function(c, d, withNoise = true) {
    if (!this.logistics) return old.courierChoiceScore.call(this, c, d, withNoise);
    const score = scoreOffer(this, c, d, planOffer(this, c, d));
    return Number.isFinite(score) && withNoise ? score + this.rng.float(-c.experience.noise / this.modifiers.teamSkill, c.experience.noise / this.modifiers.teamSkill) : score;
  };
  p.choiceReason = function(c, d) {
    if (!this.logistics) return old.choiceReason.call(this, c, d);
    if (d.preferredRiderId === c.id) return 'personal invitation';
    if (d.sweetened) return 'courier bonus';
    if (RIDER_BIKES[c.bikeType].favorite === d.type) return 'preferred cargo';
    if (d.channel === 'priority') return 'priority signal';
    return planOffer(this, c, d).reason ?? 'good fit';
  };
  p.predictCall = function(c) {
    if (!this.logistics) return old.predictCall.call(this, c);
    if (!c?.radioOn || this.riderJobs(c).length >= 2) return null;
    const best = this.calledDeliveries().map(delivery => ({ delivery, score: this.courierChoiceScore(c, delivery, false) })).sort((a, b) => b.score - a.score)[0];
    return best && best.score >= .3 ? best : null;
  };
  p.beginDeliberation = function(c) {
    if (!this.logistics) return old.beginDeliberation.call(this, c);
    if (!c.radioOn || this.riderJobs(c).length >= 2) return false;
    const best = this.calledDeliveries().map(delivery => ({ delivery, score: this.courierChoiceScore(c, delivery, true) })).sort((a, b) => b.score - a.score)[0];
    if (!best || best.score < .3) { c.decisionAt = this.elapsed + 1.2; if (c.phase === 'idle') c.lastDecision = 'Listening for work that fits'; return false; }
    // Better fit creates a quicker voluntary response as well as a higher
    // ranking among calls. A personal invitation therefore has a real effect
    // even when only one contract is on the radio, without guaranteeing it.
    const duration = Math.max(.25, c.experience.think / this.modifiers.teamSkill * this.rng.float(.5, .84) / (.8 + Math.max(0, best.score) * .24));
    c.deliberation = { deliveryId: best.delivery.id, startedAt: this.elapsed, readyAt: this.elapsed + duration, score: best.score, reason: this.choiceReason(c, best.delivery) };
    c.lastDecision = `Considering ${best.delivery.id.toUpperCase()} · ${c.deliberation.reason}`;
    return true;
  };
  p.setChannel = function(id, channel) {
    const result = old.setChannel.call(this, id, channel);
    if (result && this.logistics && channel !== 'off') for (const c of this.couriers) if (c.radioOn) c.decisionAt = Math.min(c.decisionAt, this.elapsed + .16);
    return result;
  };
  p.routeLogisticsStop = function(c) {
    c.stops = c.stops.filter(stop => this.deliveryById(stop.jobId)?.status === 'claimed');
    const stop = c.stops[0];
    if (!stop) return this.releaseCourier(c, true);
    const d = this.deliveryById(stop.jobId), target = stop.kind === 'pickup' ? d.pickupId : d.dropoffId;
    const at = this.nodeById(c.nodeId);
    if (Math.hypot(c.x - at.x, c.y - at.y) > 1e-6) { c.reroutePending = true; return; }
    c.deliveryId = d.id; c.phase = stop.kind; c.targetNodeId = target; c.handoffUntil = null;
    c.reroutePending = false;
    this.setCourierPath(c, this.routeBetween(c.nodeId, target), target);
  };
  p.claim = function(c, d, score = 0) {
    if (!this.logistics) return old.claim.call(this, c, d, score);
    if (!d?.called) return false;
    const plan = planOffer(this, c, d);
    if (!plan.stops) { c.deliberation = null; c.decisionAt = this.elapsed + 1; return false; }
    const previous = c.stops?.[0], retainHandoff = HANDLING_PHASES.includes(c.phase) && previous && plan.stops[0].jobId === previous.jobId && plan.stops[0].kind === previous.kind;
    const reason = this.choiceReason(c, d);
    Object.assign(d, { status: 'claimed', called: false, claimedAt: this.elapsed, courierId: c.id, pickupLegDistance: travelCost(this, c.nodeId, d.pickupId), planMode: plan.mode });
    c.stops = plan.stops; c.deliberation = null; c.decisionAt = this.elapsed + 1;
    if (!retainHandoff) this.routeLogisticsStop(c);
    c.lastDecision = `Accepted ${d.id.toUpperCase()} · ${plan.mode === 'ready' ? reason : plan.reason.toLowerCase()}`;
    this.runStats.riderChoices++;
    this.logDispatch('claim', d, { rider: c.name, score, mode: plan.mode });
    this.invalidateDeliberations(d.id);
    this.flash(`${c.name} accepted ${d.id.toUpperCase()} · ${plan.reason.toLowerCase()}`, 3);
    return true;
  };
  p.arrive = function(c) {
    if (!this.logistics) return old.arrive.call(this, c);
    const stop = c.stops?.[0], d = stop && this.deliveryById(stop.jobId);
    if (!d) return this.releaseCourier(c);
    c.deliveryId = d.id;
    if (stop.kind === 'dropoff' && this.elapsed < d.deliverAfter) { c.phase = 'waiting-window'; c.handoffUntil = d.deliverAfter; return; }
    c.phase = stop.kind === 'pickup' ? 'loading' : 'handover';
    c.handoffUntil = this.elapsed + this.handoffTime(d)[stop.kind];
    this.logDispatch(stop.kind === 'pickup' ? 'pickup-arrival' : 'dropoff-arrival', d, { rider: c.name, seconds: c.handoffUntil - this.elapsed });
  };
  p.moveCourier = function(c, dt) {
    if (!this.logistics) return old.moveCourier.call(this, c, dt);
    if (c.radioOn && this.riderJobs(c).length < 2) {
      if (c.deliberation && this.elapsed >= c.deliberation.readyAt) this.resolveDeliberation(c);
      else if (!c.deliberation && this.elapsed >= c.decisionAt) this.beginDeliberation(c);
    }
    if (HANDLING_PHASES.includes(c.phase)) {
      if (this.elapsed < c.handoffUntil) return;
      if (c.phase === 'waiting-window') return this.arrive(c);
      const stop = c.stops.shift(), d = this.deliveryById(stop?.jobId);
      if (!d) return this.releaseCourier(c);
      c.handoffUntil = null;
      if (stop.kind === 'pickup') {
        d.pickedUp = true; d.edgesTraversed = []; c.lastMilestone = 'pickup'; c.lastMilestoneAt = this.elapsed;
        this.logDispatch('pickup', d, { rider: c.name, weightKg: d.weightKg });
        this.routeLogisticsStop(c);
      } else this.completeDelivery(c, d);
      return;
    }
    for (let guard = 0; dt > 1e-10 && guard < 1000 && ['pickup', 'dropoff', 'coasting'].includes(c.phase); guard++) {
      const target = this.nodeById(c.path[c.pathIndex]); if (!target) return;
      const dx = target.x - c.x, dy = target.y - c.y, remaining = Math.hypot(dx, dy), edge = this.edgeByIds(c.path[c.pathIndex - 1], target.id);
      if (remaining < 1e-7) { this.finishEdge(c, target, edge); continue; }
      const handling = loadHandling(this, c, this.riderJobs(c).filter(d => d.pickedUp));
      const velocity = c.baseSpeed * c.experience.speed * this.modifiers.speed * handling.speed * (edge?.speed ?? 1) * (edge?.eventMultiplier ?? 1);
      const used = Math.min(dt, remaining / velocity), step = used * velocity;
      c.heading = Math.atan2(dy, dx) + Math.PI / 2; c.x += dx / remaining * step; c.y += dy / remaining * step;
      c.fatigue = Math.min(1, c.fatigue + used * .00315 * c.experience.fatigue * this.modifiers.fatigue * handling.fatigue);
      this.runStats.distance += step; if ((edge?.eventMultiplier ?? 1) < .99) this.runStats.eventExposure += step;
      dt -= used;
      if (step >= remaining - 1e-7) this.finishEdge(c, target, edge);
    }
  };
  p.finishEdge = function(c, target, edge) {
    if (!this.logistics) return old.finishEdge.call(this, c, target, edge);
    c.x = target.x; c.y = target.y; c.nodeId = target.id; c.pathIndex++;
    for (const d of this.riderJobs(c)) if (d.pickedUp && edge) d.edgesTraversed.push(edge.id);
    if (c.phase === 'coasting') { c.phase = 'idle'; return old.releaseCourier.call(this, c, false); }
    if (c.reroutePending) return this.routeLogisticsStop(c);
    if (c.pathIndex >= c.path.length) return this.arrive(c);
  };
  p.releaseCourier = function(c, allowBreak = false) {
    if (!this.logistics) return old.releaseCourier.call(this, c, allowBreak);
    c.stops = (c.stops ?? []).filter(stop => this.deliveryById(stop.jobId)?.status === 'claimed');
    if (c.stops.length) {
      if (HANDLING_PHASES.includes(c.phase) && c.stops[0].jobId === c.deliveryId) return;
      return this.routeLogisticsStop(c);
    }
    return old.releaseCourier.call(this, c, allowBreak);
  };
  p.jobETA = function(c, d) {
    if (!this.logistics) return this.courierETA(c);
    if (d?.status === 'waiting') return planOffer(this, c, d).finishIn ?? Infinity;
    return simulateStops(this, c, c.stops ?? [], null, false)?.finishes[d?.id] ?? Infinity;
  };
  p.courierETA = function(c) {
    if (!this.logistics) return old.courierETA.call(this, c);
    if (!c || !ACTIVE_PHASES.includes(c.phase)) return null;
    return simulateStops(this, c, c.stops ?? [], null, false)?.seconds ?? Infinity;
  };
  p.courierAvailability = function(c, d = null) {
    if (!this.logistics) return old.courierAvailability.call(this, c, d);
    const plan = d ? planOffer(this, c, d) : simulateStops(this, c, c.stops ?? []), busy = this.riderJobs(c).length > 0;
    const arrivalIn = d ? plan.pickups?.[d.id] ?? Infinity : plan?.seconds ?? 0;
    return { rider: c, state: c.phase === 'break' ? 'break' : busy ? 'busy' : c.deliberation ? 'thinking' : 'ready', readyIn: busy ? this.courierETA(c) : 0, travelIn: arrivalIn, arrivalIn, fromNodeId: c.nodeId, pickupId: d?.pickupId, availableNow: !!c.radioOn && (d ? !!plan.stops : !busy) };
  };
  p.offerMargin = function(c, d) { return this.logistics ? planOffer(this, c, d).margin ?? -Infinity : old.offerMargin.call(this, c, d); };
  p.deliveryFeasibility = function(d, options) {
    if (!this.logistics) return old.deliveryFeasibility.call(this, d, options);
    if (!d || d.status !== 'waiting') return null;
    const candidates = this.couriers.map(rider => {
      const plan = planOffer(this, rider, d);
      return plan.stops ? { rider, state: plan.mode === 'ready' ? 'ready' : 'busy', availableNow: true, arrivalIn: plan.pickups[d.id], pickupWait: 0, loadedIn: plan.finishIn - plan.pickups[d.id], finishIn: plan.finishIn, margin: plan.margin, mode: plan.mode } : null;
    }).filter(Boolean).sort((a, b) => b.margin - a.margin);
    const best = candidates[0] ?? null, margin = best?.margin ?? -Infinity, state = margin < 0 ? 'risk' : margin < 18 ? 'tight' : best?.state === 'busy' ? 'future' : 'safe';
    return { candidates, best, margin, remaining: Math.max(0, d.deadlineAt - this.elapsed), state, label: state === 'risk' ? 'NO FIT' : state.toUpperCase() };
  };
}
