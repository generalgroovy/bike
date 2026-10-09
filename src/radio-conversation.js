// Authored radio dialogue, selected from event facts. This layer never chooses
// a job, consumes the simulation RNG, or writes back into a saved shift.
export const RIDER_VOICES = Object.freeze({
  Kira: Object.freeze({ name: 'Kira', tone: 'sharp', tagline: 'Quick feet. Clear calls.', instrument: 'bell' }),
  Mauro: Object.freeze({ name: 'Mauro', tone: 'dry', tagline: 'Soft hands. A fair fee.', instrument: 'pluck' }),
  Brian: Object.freeze({ name: 'Brian', tone: 'warm', tagline: 'Room on the bike. Time for the job.', instrument: 'reed' })
});

const PRIORITY = Object.freeze({ fail: 9, complete: 8, claim: 7, 'window-wait': 6, 'window-open': 6, break: 6,
  'rider-restless': 6, 'rider-warning': 9, 'rider-recovered': 7, 'rider-left': 10,
  'radio-on': 6, call: 5, channel: 5, prefer: 5, sweeten: 5, 'client-call': 5, uncall: 5,
  'radio-denied': 5, pickup: 4, 'event-start': 4, 'event-end': 4, 'event-forecast': 3, spawn: 1 });
const RIDER_EVENTS = new Set(['claim', 'pickup', 'window-wait', 'window-open', 'complete', 'fail', 'break', 'radio-on', 'rider-restless', 'rider-warning', 'rider-recovered', 'rider-left']);
const finite = value => Number.isFinite(value);
const brief = (value, limit = 40) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
};
const hash = value => {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
};
const seconds = value => `${Math.max(0, Math.ceil(value))}s`;
const parcel = d => ({ document: 'documents', fragile: 'a delicate parcel', grocery: 'groceries' })[d?.type] ?? 'a parcel';
const weight = d => finite(d?.weightKg) ? `${d.weightKg} kg` : parcel(d);
const fee = d => finite(d?.reward) ? `€${d.reward}` : 'the posted fee';
const voiceLine = (voice, name, text, tone = voice === 'dispatcher' ? 'desk' : 'neutral') => ({ speaker: voice, name, text, tone });

/**
 * Convert one actual dispatchLog entry to a short, immutable-in-practice view.
 * Window events may be supplied by presentation code watching rider phases;
 * preview:true is deliberately silent. Call this when the event occurs, then
 * keep the returned text as its snapshot instead of regenerating old events.
 *
 * Returns null or {id, action, at, jobId, riderId, priority, tone, lines, cue}.
 * Each of the one or two lines is {speaker, name, text, tone}. Text is plain
 * text, never HTML. No game methods are called, including forecast/route APIs.
 */
export function conversationFor(game, event) {
  if (!game || !event || event.preview || !Object.hasOwn(PRIORITY, event.action)) return null;
  const action = event.action;
  const jobs = game.deliveries ?? [], riders = game.couriers ?? [];
  const d = jobs.find(job => job.id === event.deliveryId);
  const hasExplicitRider = Object.hasOwn(event, 'rider') || Object.hasOwn(event, 'riderId');
  const c = RIDER_EVENTS.has(action) || action === 'prefer' ? riders.find(rider => event.riderId ? rider.id === event.riderId
    : event.rider ? rider.name === event.rider : !hasExplicitRider && RIDER_EVENTS.has(action) && rider.id === d?.courierId) : null;
  const riderVoice = RIDER_VOICES[c?.name];
  const riderName = c?.name ?? event.rider ?? 'Rider';
  const at = finite(event.at) ? event.at : game.elapsed ?? 0;
  const jobId = event.deliveryId ?? null;
  const job = String(jobId ?? 'this job').toUpperCase();
  const pickup = brief(event.pickup ?? d?.pickupAddress) || 'the pickup';
  const dropoff = brief(event.dropoff ?? d?.dropoffAddress) || 'the delivery address';
  const channel = event.channel ?? d?.channel ?? 'open';
  const id = `${action}:${jobId ?? '-'}:${at}:${event.riderId ?? event.rider ?? ''}:${event.channel ?? ''}`;
  const pick = (variants, salt = '') => variants[hash(`${game.seed ?? ''}:${id}:${salt}`) % variants.length];
  const say = (variants, fallback) => pick(variants[riderName] ?? fallback);
  const desk = text => voiceLine('dispatcher', 'You · dispatch', text, 'desk');
  const rider = text => voiceLine('rider', riderName, text, riderVoice?.tone ?? 'neutral');
  const radio = text => voiceLine('radio', 'Radio', text, 'neutral');
  const remainingJobs = c ? jobs.filter(j => j.courierId === c.id && j.status === 'claimed' && j.id !== jobId) : [];
  let lines, tone = 'routine';

  if (action === 'spawn') {
    if (!d) return null;
    lines = [desk(pick([
      `${job} just landed. ${weight(d)}, ${fee(d)}. Who has room?`,
      `New one: ${job}, ${pickup}. Let's find it a good ride.`,
      `${job}: ${parcel(d)} at ${pickup}. Still off the radio.`
    ]))];
  } else if (action === 'call' || action === 'channel') {
    if (!d) return null;
    const invitation = riders.find(r => r.id === d.preferredRiderId);
    const offers = {
      open: [`All ears: ${job}, ${weight(d)}, ${fee(d)}. Any takers?`, `${job} is open. Pickup at ${pickup}. Take it if it fits.`, `${job}, ${parcel(d)}, ${fee(d)}. Who's got room in the day?`],
      local: [`Anyone near ${pickup}? ${job}, ${weight(d)}, ${fee(d)}.`, `Keeping this local: ${job} at ${pickup}. Who's close?`, `${job} on the nearby channel. A good one if you're around ${pickup}.`],
      priority: [`Priority call: ${job}, ${pickup}. Only take it if the timing works.`, `${job} needs attention. ${weight(d)}, ${fee(d)}. Who can fit it?`, `Clear call for ${job}. Clock's running; nobody needs to be a hero.`]
    };
    lines = [desk(pick(offers[channel] ?? offers.open)), radio(invitation
      ? `${invitation.name} is personally invited. The choice stays with each rider.`
      : `${channel === 'priority' ? 'Priority · two slots' : channel === 'local' ? 'Nearby · one slot' : 'All riders · one slot'}. Waiting for a volunteer.`)];
    tone = channel === 'priority' ? 'urgent' : 'offer';
  } else if (action === 'prefer') {
    const invited = riders.find(r => r.name === event.rider || r.id === event.riderId);
    lines = [desk(invited ? d?.called
      ? `${invited.name}, a personal invitation for ${job}. Your call if it fits.`
      : `${invited.name} gets a personal invitation when ${job} goes on air.`
      : `${job}: no personal invitation. Everyone weighs the same offer.`)];
    tone = 'offer';
  } else if (action === 'sweeten') {
    if (!d) return null;
    lines = [desk(pick([
      `I've put €${event.cost ?? 5} behind ${job}. A better offer; same streets.`,
      `${job} has a courier bonus now. Let's make the effort worth it.`,
      `A little extra for whoever takes ${job}. The deadline stays put.`
    ]))];
    tone = 'offer';
  } else if (action === 'client-call') {
    const extra = finite(event.seconds) ? seconds(event.seconds) : 'a little more time';
    const concession = finite(event.fee) ? ` Fee reduced by €${event.fee}.` : '';
    lines = [desk(pick([
      `Client agreed: ${job} gets ${extra} more.${concession}`,
      `Bought ${job} some breathing room: +${extra}.${concession}`
    ]))];
    tone = 'relief';
  } else if (action === 'claim') {
    if (!c) return null;
    const mode = event.mode ?? d?.planMode ?? 'ready';
    const acceptance = mode === 'on the way' ? {
      Kira: [`${job} fits on the way. Neat. I'm taking it.`, `Two jobs, one line through town. ${job} is on my tour.`],
      Mauro: [`${job} fits the tour. One more fee for a sensible detour.`, `I'll fold ${job} into this run. The bike's earning its keep.`],
      Brian: [`There's room for ${job} along the way. I'll take it.`, `${job} fits between my stops. That's a good bit of dispatching.`]
    } : mode === 'next' ? {
      Kira: [`${job}, after this one. One thing, then the next.`, `Taking ${job} next. Current delivery keeps its place.`],
      Mauro: [`${job} can be my next chapter. Finishing this one first.`, `I'll take ${job} next. My current parcel was here first.`],
      Brian: [`${job} fits after my current work. Count me in.`, `I'll finish this run, then collect ${job}. Steady does it.`]
    } : {
      Kira: [`${job}. Good fit. I'm in.`, `I'll take ${job}. Clear call, clear route.`],
      Mauro: [`${job} works for me. Let's earn that fee.`, `I'll take ${job}. A bike has to pay its own way.`],
      Brian: [`I've got room for ${job}. Leave the carrying to me.`, `${job} suits me. I'll take care of it.`]
    };
    const reply = mode === 'on the way' ? 'Copy. Keep both deliveries in the picture.' : mode === 'next' ? 'Copy. Queued after your current work.'
      : d?.preferredRiderId === c.id ? 'Glad it suits you. Thanks for taking the invitation.'
        : d?.sweetened ? 'Copy. The bonus goes with the job.' : pick(['Copy. Keep me posted.', 'Copy. Thanks for taking it.', 'Heard you. Good riding.'], 'desk');
    lines = [rider(say(acceptance, [`I'll take ${job}.`])), desk(reply)];
    tone = 'accepted';
  } else if (action === 'pickup') {
    if (!c || !d) return null;
    const wording = d.type === 'fragile' ? {
      Kira: [`${job} collected. Careful corners from here.`, `${job} secure. Quick legs, gentle hands.`],
      Mauro: [`${job} aboard. Delicate parcel, delicate treatment.`, `${job} collected. Nobody's paying for a box of rattles.`],
      Brian: [`${job} is settled in. I'll give it a smooth ride.`, `${job} secured. Precious things get a bit of space.`]
    } : d.weightKg >= 6 ? {
      Kira: [`${job} loaded: ${weight(d)}.`, `${job} aboard. Feeling the weight.`],
      Mauro: [`${job} loaded. ${weight(d)} is honest work.`, `${job} aboard. The bike noticed those ${weight(d)}.`],
      Brian: [`${job}, ${weight(d)}, all secured. This is what the rack is for.`, `${job} aboard. A proper load; we'll take our time on the corners.`]
    } : {
      Kira: [`Got ${job}. Rolling.`, `${job} in the bag. Next stop.`],
      Mauro: [`${job} collected. Paperwork with somewhere to be.`, `${job} aboard. The glamorous part is over.`],
      Brian: [`${job} picked up, safe and sound.`, `Got ${job}. A little parcel, a proper job.`]
    };
    lines = [rider(say(wording, [`${job} collected.`]))];
    if (finite(d.deliverAfter) && d.deliverAfter > at) lines.push(desk(`Delivery opens in ${seconds(d.deliverAfter - at)}. No early handover.`));
  } else if (action === 'window-wait') {
    if (!c || !d) return null;
    lines = [rider(say({
      Kira: [`At ${job}'s door. Early. The clock wins this round.`, `${job} is here before the window. Holding.`],
      Mauro: [`At ${job}'s door. Apparently punctual has a lower limit.`, `${job} is here; the delivery window isn't. I'll wait.`],
      Brian: [`At the door with ${job}. A little wait is part of the job.`, `${job} can wait safely with me until they're ready.`]
    }, [`Waiting for ${job}'s delivery window.`])), desk(`Handover opens in ${seconds((d.deliverAfter ?? at) - at)}. A fitting extra job can still be offered.`)];
    tone = 'waiting';
  } else if (action === 'window-open') {
    if (!c) return null;
    lines = [desk(`${job}'s delivery window is open.`), rider(say({
      Kira: ['Good. Handing over now.', 'Clock caught up. Handing it over.'],
      Mauro: ['Finally, fashionably on time. Handing over.', 'The appointment has arrived. Handing over.'],
      Brian: ['Right on time for them. Handing it over.', 'There we are. Time for the handover.']
    }, ['Starting the handover.']))];
    tone = 'relief';
  } else if (action === 'complete') {
    if (!c || !d) return null;
    const buffer = finite(d.deadlineAt) ? Math.max(0, d.deadlineAt - at) : null;
    const tight = buffer != null && buffer < 12;
    const continuing = remainingJobs.length > 0;
    lines = [rider(say(tight ? {
      Kira: [`${job} delivered. Close. Let's leave more room next time.`, `${job} is in. That clock was getting loud.`],
      Mauro: [`${job} delivered. A little too much suspense for my fee.`, `${job} made it. Next one could use a quieter deadline.`],
      Brian: [`${job} delivered. We cut that one fine.`, `${job} is safe with them. A little more time would be welcome.`]
    } : continuing ? {
      Kira: [`${job} done. Next stop's already on the bike's mind.`, `${job} delivered. One down; keeping the tour moving.`],
      Mauro: [`${job} delivered. Next parcel, same charming courier.`, `${job} done. This tour still has another chapter.`],
      Brian: [`${job} delivered. Carrying on with the rest of the tour.`, `${job} safely delivered. Still another person waiting for me.`]
    } : {
      Kira: [`${job} delivered. Clean finish.`, `${job} at ${dropoff}. Done and dusted.`],
      Mauro: [`${job} delivered. One less parcel, one better ledger.`, `${job} is with them. A small triumph for two wheels.`],
      Brian: [`${job} delivered at ${dropoff}. All taken care of.`, `${job} safely delivered. That's a good bit of work.`]
    }, [`${job} delivered.`])), desk(`${finite(d.reward) ? `+€${d.reward}. ` : ''}${buffer != null ? `${seconds(buffer)} to spare. ` : ''}${tight ? 'Noted. More breathing room on the next call.' : continuing ? 'Copy. Your other stop stays on the tour.' : pick(['Good work. Thanks for the ride.', 'Nicely done. Take the next call when it fits.', 'Copy. Another Berlin doorstep reached.'], 'desk')}`)];
    tone = tight ? 'close' : 'delivered';
  } else if (action === 'fail') {
    const kind = event.kind ?? d?.failureKind;
    if (c && kind === 'claimed-late') lines = [rider(say({
      Kira: [`Missed ${job}'s window. No point dressing it up.`, `${job} ran out of time. That's a miss.`],
      Mauro: [`${job} missed the window. Not the ending I'd choose.`, `${job} is late. The clock doesn't negotiate after the fact.`],
      Brian: [`We missed ${job}'s window. I'm sorry about that.`, `${job} ran out of time. Let's learn from this one.`]
    }, [`${job} missed its deadline.`])), desk(`Logged. ${event.penalty ?? 9} reputation lost. Let's give the next tour more room.`)];
    else lines = [desk(kind === 'never-called'
      ? `${job} expired off air. Nobody could volunteer for a call they never heard.`
      : kind === 'claimed-late' ? `${job} missed its delivery window. More breathing room on the next tour.`
        : `${job} expired without a taker. The offer never found a willing rider.`)];
    tone = 'missed';
  } else if (action === 'rider-restless') {
    if (!c) return null;
    lines = [rider(say({
      Kira: ['Still here. My wheels would like a job.', 'Long gap, desk. Got a short run that fits?'],
      Mauro: ["Lovely view. Doesn't pay much, though. Anything suitable?", 'The bike is ready. The earnings are taking a long break.'],
      Brian: ["I've been waiting a while. Is there something that needs carrying?", 'Bit quiet over here, desk. Keep me in mind for the next good fit.']
    }, ['I have been waiting for suitable work.'])), desk('Heard. Time to look for an offer that suits you.')];
    if (event.reason === 'missed-job') lines = [rider(say({
      Kira: ['That miss hurt. The next run needs room to work.'],
      Mauro: ['A wasted trip. Let us make the next offer worth riding for.'],
      Brian: ['That was a hard ending. I need a tour with a fair chance.']
    }, ['That missed delivery knocked my confidence.'])), desk('Heard. Let us give the next tour a workable deadline.')];
    tone = 'watch';
  } else if (action === 'rider-warning') {
    if (!c) return null;
    const wait = finite(event.leaveIn) ? seconds(event.leaveIn) : 'a short while';
    lines = [rider(say({
      Kira: [`I'm giving it ${wait}, then I'm done for today. Need a run that fits.`, `${wait} more on standby. Then I'm calling it a day.`],
      Mauro: [`About ${wait} more. After that, even going home pays better than this.`, `I'll wait ${wait}. Without a worthwhile run, that's my day done.`],
      Brian: [`I'll give it ${wait} more, but I can't wait here all day.`, `One last ${wait} on standby, desk. Then I'll head off for the day.`]
    }, [`I may sign off in ${wait} without suitable work.`])), desk('Understood. I can shape the offer; taking it is your call.')];
    tone = 'urgent';
  } else if (action === 'rider-recovered') {
    if (!c) return null;
    lines = [rider(say({
      Kira: ['Better. Back in the rhythm.', 'A proper run. That makes a difference.'],
      Mauro: ["Work on the bike. That's a more persuasive argument.", 'The day is looking rather more worthwhile now.'],
      Brian: ['Good to be useful again. Thanks for keeping me in mind.', 'There we are. A bit of work puts the day right.']
    }, ['That work helped. I am staying with the shift.'])), desk('Good to hear. Keep me posted.')];
    tone = 'relief';
  } else if (action === 'rider-left') {
    if (!c) return null;
    lines = [rider(say({
      Kira: ["That's enough waiting. Signing off for today.", 'No run, no reason to hang around. Done for the day, desk.'],
      Mauro: ['I have earned a very detailed knowledge of this pavement. Signing off for today.', "Calling it a day. This much waiting isn't a working arrangement."],
      Brian: ["I've waited long enough, desk. Heading off for the day. Take care.", "I'm signing off for today. I needed a bit more work to make it worthwhile."]
    }, ['I am finished for today after waiting too long.'])), desk(`${riderName} has signed off for today. Their bike is unavailable until the next shift.`)];
    tone = 'departed';
  } else if (action === 'break') {
    if (!c) return null;
    lines = [rider(say({
      Kira: ['Legs need a reset. Radio off for a bit.', 'Short breather. Even quick feet need one.'],
      Mauro: ['Taking a break. Maintenance for the expensive part of the bicycle.', 'Rest stop. My legs have entered negotiations.'],
      Brian: ['Taking a proper breather. Back when the legs are ready.', 'A little rest now means a better ride later. Radio off.']
    }, ['Taking a break. Radio off.'])), desk('Heard. Calls can wait while you recover.')];
    tone = 'rest';
  } else if (action === 'radio-on') {
    if (!c) return null;
    lines = [rider(say({
      Kira: ['Back. Legs reset; ears open.', 'Radio on. What fits?'],
      Mauro: ['Back on air. Any offers worth leaving this lovely spot for?', 'Legs and radio have reached an agreement. Listening.'],
      Brian: ['Back with you. Rested and listening.', "Ready to carry on. What's on the board?"]
    }, ['Back on radio. Listening for work.'])), desk('Welcome back. Pick what suits.')];
    tone = 'relief';
  } else if (action === 'uncall') {
    lines = [desk(`${job} is off the radio. Holding the offer for now.`)];
  } else if (action === 'radio-denied') {
    lines = [radio('No free radio capacity for that call. Withdraw a live offer or choose a one-slot channel.')];
    tone = 'urgent';
  } else if (action.startsWith('event-')) {
    const place = brief(event.place) || 'the affected streets';
    lines = [desk(action === 'event-forecast' ? `Roadworks ahead at ${place}. Leave room in your plans.`
      : action === 'event-start' ? `Roadworks active at ${place}. Those streets are slower now.`
        : `Roadworks clear at ${place}. A little room to breathe.`)];
    tone = action === 'event-end' ? 'relief' : 'traffic';
  }
  if (!lines?.length) return null;
  return { id, action, at, jobId, riderId: c?.id ?? null, priority: PRIORITY[action], tone, lines,
    cue: { rider: c?.name ?? null, attitude: riderVoice?.tone ?? 'desk' } };
}

/** Bounded presentation history. Callers may keep this beside, never in, game. */
export function appendConversation(history, exchange, limit = 6) {
  const cap = Math.max(1, Math.min(12, Math.floor(Number(limit) || 6)));
  const items = Array.isArray(history) ? history.filter(item => item?.id) : [];
  if (!exchange?.id || items.some(item => item.id === exchange.id)) return items.slice(-cap);
  return [...items, exchange].slice(-cap);
}
