import { CityAddressIndex } from './city-address-index.js';
import { RIDER_BIKES } from './playtest-logistics.js';

// v7 changes demand, not rider autonomy. A service area can attract another
// customer, but a generated offer never reserves a rider or a place in a tour.
export function demandCapacity(game) {
  const waiting = game.activeDeliveries().filter(d => d.status === 'waiting');
  const riders = game.couriers.map(rider => {
    const jobs = game.riderJobs(rider), profile = RIDER_BIKES[rider.bikeType];
    const lastJob = jobs.at(-1), endpoint = lastJob && game.nodeById(lastJob.dropoffId);
    const nearby = waiting.filter(d => {
      if (!profile.acceptedTypes.includes(d.type) || d.weightKg > rider.capacityKg) return false;
      const pickup = game.nodeById(d.pickupId);
      return Math.hypot(pickup.x - rider.x, pickup.y - rider.y) < 250 ||
        endpoint && Math.hypot(pickup.x - endpoint.x, pickup.y - endpoint.y) < 180;
    }).length;
    const responsive = !(game.wellbeing && rider.offDuty) && rider.radioOn && !['break', 'coasting'].includes(rider.phase) && rider.fatigue < .87;
    const slots = responsive ? Math.max(0, 2 - jobs.length) : 0;
    return { rider, jobs, endpoint, nearby, slots, room: Math.max(0, slots - nearby) };
  });
  return { waiting: waiting.length, freeSlots: riders.reduce((sum, r) => sum + r.room, 0), riders };
}

function demandTrip(game, row) {
  game.addressIndex ??= new CityAddressIndex(game.playableAddressNodes());
  const c = row.rider, job = row.jobs[0], min = game.mode === 'training' ? 65 : 100;
  // Every other busy-rider opportunity follows their existing corridor. The
  // alternate is a pickup near their last stop, useful as the next job.
  const along = job && game.deliverySerial % 2 === 0;
  const center = job && !along ? row.endpoint : c;
  const pickups = game.addressIndex.near(center.x, center.y, job ? 65 : 105);
  if (!pickups.length) return null;
  for (let attempt = 0; attempt < 24; attempt++) {
    const pickup = game.rng.pick(pickups);
    const dropCenter = along ? game.nodeById(job.dropoffId) : pickup;
    const drops = game.addressIndex.near(dropCenter.x, dropCenter.y, along ? 65 : 200)
      .filter(node => Math.hypot(node.x - pickup.x, node.y - pickup.y) >= min * .55);
    if (!drops.length) continue;
    const dropoff = game.rng.pick(drops), path = game.routeBetween(pickup.id, dropoff.id), distance = game.routeDistance(path);
    if (path.length && distance >= min && distance <= game.runContract.maxTrip)
      return { pickupId: pickup.id, dropoffId: dropoff.id };
  }
  return null;
}

export function installPlaytestDemand(Type) {
  const p = Type.prototype, oldSpawn = p.spawnDelivery, oldInterval = p.arrivalInterval;
  p.demandCapacity = function() { return demandCapacity(this); };
  p.arrivalInterval = function() {
    if (!this.capacityDemand) return oldInterval.call(this);
    const capacity = demandCapacity(this);
    const base = this.mode === 'training' ? this.completed < 1 ? 20 : 17 :
      ({ opening: 14, build: 8, recovery: 16, push: 10 }[this.phase().id] ?? 14);
    // The rhythm breathes when riders recover or the desk is already full.
    return base * (capacity.freeSlots === 0 ? 1.25 : capacity.waiting >= 3 ? 1.35 : 1);
  };
  p.spawnDelivery = function(options = {}) {
    if (!this.capacityDemand || options.pickupId || options.dropoffId || options.typeKey)
      return oldSpawn.call(this, options);
    const capacity = demandCapacity(this), limit = this.mode === 'training' ? 3 : 4;
    if (this.closing || this.gameOver || capacity.waiting >= limit) return false;
    const candidates = capacity.riders.filter(row => row.room > 0)
      .sort((a, b) => a.nearby - b.nearby || a.jobs.length - b.jobs.length ||
        (this.deliverySerial + Number(a.rider.id.slice(1))) % 3 - (this.deliverySerial + Number(b.rider.id.slice(1))) % 3);
    if (!candidates.length) return false;
    const row = candidates[0], bike = RIDER_BIKES[row.rider.bikeType];
    const types = this.mode === 'training' && this.completed < 1 ? ['document'] : bike.acceptedTypes;
    const typeKey = this.rng.pick(types);
    // Early collection windows still recur; an additional load must leave
    // real carrying room beside the parcels already accepted by the rider.
    const spareKg = row.rider.capacityKg - row.jobs.reduce((sum, d) => sum + d.weightKg, 0);
    const weightKg = Math.min(spareKg, typeKey === 'document' ? [0.5, 1, 1.5][this.deliverySerial % 3] :
      typeKey === 'fragile' ? [2, 3, 4][this.deliverySerial % 3] : [6, 10, 16][this.deliverySerial % 3]);
    if (weightKg <= 0) return false;
    // Preserve the readable, depot-based first tutorial job.
    const trip = this.deliverySerial === 0 && this.mode === 'training' ? {} : demandTrip(this, row);
    return trip ? oldSpawn.call(this, { ...options, ...trip, typeKey, weightKg }) : false;
  };
}
