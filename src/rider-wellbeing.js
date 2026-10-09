// v8 keeps work voluntary. These counters use simulation time only; previews
// and broadcasts cannot restore morale, reset waiting or reserve a rider.
export const WELLBEING = Object.freeze({ initial: 72, max: 100, decayPerSecond: .7,
  warningSeconds: 20, acceptanceGain: 18, completionGain: 10, failureLoss: 6 });
export const RIDER_PATIENCE = Object.freeze({ Kira: 30, Mauro: 40, Brian: 55 });
const labels = Object.freeze({ content: 'Content', steady: 'Steady', restless: 'Restless', 'at-risk': 'At risk', 'off-duty': 'Off duty' });
const bandFor = value => value >= 70 ? 'content' : value >= 45 ? 'steady' : value >= 25 ? 'restless' : 'at-risk';
const clamp = value => Math.max(0, Math.min(WELLBEING.max, value));
const graceFor = c => RIDER_PATIENCE[c.name] ?? 40;
const isWaiting = (game, c) => !c.offDuty && c.phase === 'idle' && game.riderJobs(c).length === 0;

/** Pure presentation snapshot. null means that this saved ruleset has no morale. */
export function riderWellbeing(game, c) {
  if (!game.wellbeing || !c?.wellbeing) return null;
  const state = c.wellbeing, band = c.offDuty ? 'off-duty' : bandFor(state.satisfaction);
  const busy = game.riderJobs(c).length > 0, resting = c.phase === 'break';
  const graceSeconds = graceFor(c), untilDecay = Math.max(0, graceSeconds - state.idleSeconds);
  let reason, effect, recovery = 'A voluntarily accepted job adds 18; a completed delivery adds 10; a missed accepted job costs 6. Broadcast a fitting offer and consider a personal invitation.';
  if (c.offDuty) {
    reason = 'Left after a long wait without work.';
    effect = 'Unavailable for the rest of this shift. Remaining riders keep working.';
    recovery = 'Returns at the start of a new shift.';
  } else if (busy) {
    reason = 'Working on an accepted tour.';
    effect = 'No waiting penalty while travelling, handling parcels or waiting for a delivery window.';
  } else if (resting) {
    reason = 'Taking an endurance break.';
    effect = 'Waiting and satisfaction are protected during the break.';
  } else if (game.closing || game.gameOver) {
    reason = game.gameOver ? 'Shift finished.' : 'The desk is closing.';
    effect = 'No waiting penalty or departure during closing.';
  } else if (state.warningRemaining != null) {
    reason = 'Too long without a tour.';
    effect = `Leaves for today after ${Math.ceil(state.warningRemaining)} more seconds of waiting. Actual acceptance cancels the warning.`;
  } else if (untilDecay > 0) {
    reason = state.lastTourEndedAt == null ? 'Waiting for the first tour.' : 'Between tours.';
    effect = `${Math.ceil(untilDecay)} seconds of waiting before satisfaction starts falling.`;
  } else {
    reason = 'Waiting beyond this rider\'s patience.';
    effect = 'Unoccupied waiting costs 0.7 satisfaction per second. Below 25 starts a 20-second departure warning.';
  }
  return { satisfaction: state.satisfaction, max: WELLBEING.max, band, label: labels[band],
    idleSeconds: state.idleSeconds, lastTourAgo: state.lastTourEndedAt == null ? null : Math.max(0, game.elapsed - state.lastTourEndedAt),
    lastTourEndedAt: state.lastTourEndedAt, graceSeconds, untilDecay,
    leaveIn: c.offDuty || busy || resting || game.closing || game.gameOver ? null : state.warningRemaining,
    offDuty: !!c.offDuty, reason, effect, recovery };
}

function log(game, c, action, extra = {}) {
  game.logDispatch(action, null, { rider: c.name, riderId: c.id, satisfaction: c.wellbeing.satisfaction,
    leaveIn: c.wellbeing.warningRemaining, ...extra });
}

function changeSatisfaction(game, c, amount, reason) {
  const state = c.wellbeing, previous = state.band;
  state.satisfaction = clamp(state.satisfaction + amount);
  state.band = bandFor(state.satisfaction);
  if ((previous === 'content' || previous === 'steady') && state.satisfaction < 45)
    log(game, c, 'rider-restless', { reason });
}

function endTour(game, c) {
  if (game.riderJobs(c).length) return;
  Object.assign(c.wellbeing, { lastTourEndedAt: game.elapsed, idleSeconds: 0, activityAt: game.elapsed });
}

function advanceWaiting(game, c, seconds) {
  const state = c.wellbeing, previousIdle = state.idleSeconds;
  state.idleSeconds += seconds;
  const decay = Math.max(0, state.idleSeconds - graceFor(c)) - Math.max(0, previousIdle - graceFor(c));
  if (decay > 0) changeSatisfaction(game, c, -decay * WELLBEING.decayPerSecond, 'waiting');
  if (state.satisfaction >= 25) return;
  if (state.warningRemaining == null) {
    state.warningRemaining = WELLBEING.warningSeconds;
    log(game, c, 'rider-warning');
    return;
  }
  state.warningRemaining = Math.max(0, state.warningRemaining - seconds);
  if (state.warningRemaining > 1e-8) return;
  c.offDuty = true;
  c.radioOn = false;
  c.phase = 'off-duty';
  c.deliberation = null;
  c.decisionAt = Infinity;
  c.lastDecision = 'Finished for today · too long without work';
  state.warningRemaining = 0;
  state.band = 'off-duty';
  log(game, c, 'rider-left');
  if (game.couriers.every(rider => rider.offDuty)) game.finishShift('team-left');
}

export function installRiderWellbeing(Type) {
  const p = Type.prototype;
  const old = Object.fromEntries(['addCourier', 'update', 'claim', 'completeDelivery', 'failDelivery', 'startBreak', 'endBreak', 'releaseCourier', 'shiftReview'].map(key => [key, p[key]]));
  p.riderWellbeing = function(c) { return riderWellbeing(this, c); };
  p.shiftReview = function() {
    const review = old.shiftReview.call(this);
    if (!this.wellbeing || this.outcome !== 'team-left') return review;
    return { ...review, unserved: this.activeDeliveries().length,
      lesson: 'All riders finished for today. Broadcast fitting work before patience runs out; personal invitations can help, but riders still choose.' };
  };
  p.addCourier = function() {
    const result = old.addCourier.call(this);
    if (result && this.wellbeing) {
      const c = this.couriers.at(-1);
      c.offDuty = false;
      c.wellbeing = { satisfaction: WELLBEING.initial, idleSeconds: 0, lastTourEndedAt: null,
        warningRemaining: null, band: 'content', activityAt: this.elapsed };
    }
    return result;
  };
  p.update = function(dt) {
    if (!this.wellbeing) return old.update.call(this, dt);
    // Sampling both sides excludes the tick in which a tour ends or a break
    // ends, and never charges a rider for a tick spent collecting/delivering.
    const before = this.elapsed;
    const waiting = this.couriers.filter(c => isWaiting(this, c)).map(c => ({ c, activityAt: c.wellbeing.activityAt }));
    const result = old.update.call(this, dt), seconds = this.elapsed - before;
    if (seconds > 0 && !this.closing && !this.gameOver) for (const { c, activityAt } of waiting)
      if (isWaiting(this, c) && activityAt === c.wellbeing.activityAt) advanceWaiting(this, c, seconds);
    return result;
  };
  p.claim = function(c, d, score = 0) {
    if (this.wellbeing && c?.offDuty) return false;
    const wasWaiting = d?.status === 'waiting', result = old.claim.call(this, c, d, score);
    if (this.wellbeing && result && wasWaiting && d.status === 'claimed' && d.courierId === c.id) {
      const state = c.wellbeing, recovered = state.warningRemaining != null || state.satisfaction < 45;
      Object.assign(state, { idleSeconds: 0, warningRemaining: null, activityAt: this.elapsed });
      changeSatisfaction(this, c, WELLBEING.acceptanceGain, 'accepted');
      if (recovered) log(this, c, 'rider-recovered', { reason: 'accepted', deliveryId: d.id });
    }
    return result;
  };
  p.completeDelivery = function(c, d) {
    const valid = this.wellbeing && d?.status === 'claimed' && d.courierId === c.id;
    const result = old.completeDelivery.call(this, c, d);
    if (valid && d.status === 'completed') {
      const previous = c.wellbeing.satisfaction;
      changeSatisfaction(this, c, WELLBEING.completionGain, 'completed');
      if (previous < 45 && c.wellbeing.satisfaction >= 45) log(this, c, 'rider-recovered', { reason: 'completed', deliveryId: d.id });
      endTour(this, c);
    }
    return result;
  };
  p.failDelivery = function(d) {
    const c = this.wellbeing && d?.status === 'claimed' ? this.courierById(d.courierId) : null;
    const result = old.failDelivery.call(this, d);
    if (c && d.status === 'failed') {
      changeSatisfaction(this, c, -WELLBEING.failureLoss, 'missed-job');
      endTour(this, c);
    }
    return result;
  };
  for (const key of ['startBreak', 'endBreak', 'releaseCourier']) p[key] = function(c, ...args) {
    if (this.wellbeing && c?.offDuty) return false;
    return old[key].call(this, c, ...args);
  };
}
