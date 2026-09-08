import { BerlinPlaytest, CARGO_FAMILIES, FIXED_STEP, SHIFT_MODES, replayRun } from './game-berlin-playtest.js';
import { Renderer } from './render.js';
import { createSeed } from './rng.js';
import { createCargoIconElement } from './cargo-icons.js';
import { createRiderPortraitElement } from './rider-identity.js';
import { DeskScore } from './playtest-score.js';
import { decisionBrief, riderActivity } from './playtest-decisions.js';
import { loadInnerRing, loadBerlinCity } from './inner-ring-city.js';
import { timingAdvice } from './playtest-advice.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#game-canvas');
const cards = new Map(), riderCards = new Map();
const estimates = new Map(), feasibility = new Map();
const audio = new DeskScore();
const time = seconds => { const n = Math.max(0, Math.ceil(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const text = (selector, value) => { const el = $(selector), next = String(value); if (el.textContent !== next) el.textContent = next; };
const dialogs = ['#intro', '#help-dialog', '#sound-dialog', '#upgrade-dialog', '#review-dialog'];
let game, renderer, city, lastTime = performance.now(), accumulator = 0, lastUI = 0, lastLog = 0;
let sound = false, faulted = false, helpWasPaused = true, soundWasPaused=true, pointer = null, receiptUntil=0;
let savedRecord=null, saveEnabled=false, lastSave=0;
const touches=new Map();let pinchDistance=0;
audio.enabled = false;
for(const control of document.querySelectorAll('button,select')) if(control.id!=='reload') control.disabled=true;

function begin(mode, seed = createSeed(), startRegion=$('#start-region').value, restored=null) {
  dialogs.forEach(id => { if ($(id).open) $(id).close(); });
  renderer?.dispose();
  audio.cancel();receiptUntil=0;$('#delivery-receipt').hidden=true;
  game = restored ?? new BerlinPlaytest({ seed, mode, city, startRegion });
  renderer = new Renderer(canvas, game, { nativeMap: false, minimumMapBand: 'district' });
  $('#region-view').value = '';
  cards.clear(); riderCards.clear();
  estimates.clear();
  $('#coach-panel').open = true;
  $('#work-list').replaceChildren(); $('#team-list').replaceChildren();
  lastLog = restored?game.dispatchLog.length:0;accumulator = 0; lastTime = performance.now(); faulted = false;
  $('#client-negotiation').hidden=!game.refined;$('#refined-help').hidden=!game.refined;
  const url = new URL(location.href);
  url.searchParams.set('seed', seed); url.searchParams.set('mode', mode);
  url.searchParams.set('city',game.fullCity?'berlin':'inner-ring');
  if(game.fullCity)url.searchParams.set('district',game.startRegion);else url.searchParams.delete('district');
  history.replaceState({}, '', url);
  if (mode === 'training'&&!restored) focusContract(game.deliveries[0]);
  else if(game.fullCity&&game.startRegion!=='citywide') {
    const region=city.regions.find(r=>r.id===game.startRegion);renderer.focusBounds(region.bounds);$('#region-view').value=region.id;renderer.focusRegionId=region.id;
  }
  render(true);
  renderer.draw(true);
}

function saveShift() {
  if(!game||!saveEnabled)return;
  try {
    const key=`send-it:shift:${city.metadata.id}`;
    if(game.gameOver){localStorage.removeItem(key);savedRecord=null;text('#save-state','Shift complete · download the record in review.');}
    else {savedRecord=game.exportRun();localStorage.setItem(key,JSON.stringify(savedRecord));text('#save-state','Saved on this device · resume after reloading.');}
    lastSave=performance.now();
  }catch {text('#save-state','Saving unavailable in this browser.');}
}

function act(action) {
  if (!game) return false;
  const changed = game.dispatch(action);
  if (changed && sound) {
    audio.ensure();
    if (action.type === 'pause') {audio.cancel();audio.cue(action.paused?'pause':'start');}
  }
  render();
  if(changed)saveShift();
  return changed;
}

function soundPan(point){return point?Math.max(-.85,Math.min(.85,(renderer.worldToScreen(point.x,point.y).x/renderer.viewWidth-.5)*1.7)):0;}
function renderListening(){
  const list=audio.listened.map(t=>`${t.id.toUpperCase()} · ${t.division}`).join('  /  ');
  text('#listening-now',!sound?'Sound off':game.paused?'Listening paused':!audio.rhythms?'Task rhythms off':list?`Listening: ${list}`:'Listening for new work');
}

function newCard(d) {
  const card = document.createElement('article');
  card.className = 'job-card'; card.dataset.job = d.id;
  card.style.setProperty('--cargo-color',({document:'#398a9a',fragile:'#947397',grocery:'#739455'})[d.type]);
  card.innerHTML = '<button class="job-select"><span class="job-top"><span class="job-family"></span><strong class="job-fee"></strong></span><span class="job-address"><small>P</small><span class="job-pickup"></span></span><span class="job-address"><small>D</small><span class="job-drop"></span></span><span class="job-meta"><span class="job-distance"></span><span class="job-time"></span></span><span class="job-timing"><strong></strong><span></span></span></button><div class="job-action-row"><span class="job-status"></span><button class="quick-call">Broadcast OPEN</button></div>';
  $('#work-list').append(card); cards.set(d.id, card);
  card.querySelector('.job-select').addEventListener('click', () => select(d.id));
  card.querySelector('.quick-call').addEventListener('click', () => act({ type: 'radio', jobId: d.id, channel: game.deliveryById(d.id).called ? 'off' : 'open' }));
  return card;
}

function setWithin(root, selector, value) {
  const node = root.querySelector(selector), next = String(value);
  if (node.textContent !== next) node.textContent = next;
}

function renderQueue() {
  const jobs = game.activeDeliveries(), live = new Set(jobs.map(d => d.id));
  for (const [id, card] of cards) if (!live.has(id)) { card.remove(); cards.delete(id); }
  for (const d of jobs) {
    const card = cards.get(d.id) ?? newCard(d), claimed = d.status === 'claimed';
    card.dataset.selected = String(game.selectedDeliveryId === d.id);
    card.dataset.urgent = String(d.deadlineAt - game.elapsed < 25);
    card.dataset.status = d.status; card.dataset.channel = d.channel ?? 'off';
    setWithin(card, '.job-family', `${CARGO_FAMILIES[d.type].name} · ${d.id.toUpperCase()}`);
    setWithin(card, '.job-fee', `€${d.reward}`);
    setWithin(card, '.job-pickup', d.pickupAddress); setWithin(card, '.job-drop', d.dropoffAddress);
    setWithin(card, '.job-distance', `${(d.plannedDistance / 100).toFixed(1)} km`);
    setWithin(card, '.job-time', `${time(d.deadlineAt - game.elapsed)} left`);
    const rider = game.courierById(d.courierId);
    const advice = estimates.get(d.id);
    const finish = claimed ? game.courierETA(rider) : advice?.finishIn;
    const timing = card.querySelector('.job-timing');
    timing.dataset.state = claimed ? 'riding' : advice.state;
    const activity=rider&&riderActivity(game,rider);
    setWithin(timing, 'strong', claimed ? activity?.label??(rider?.phase === 'pickup' ? 'To pickup' : 'To drop-off') : advice.label);
    setWithin(timing, 'span', Number.isFinite(finish) ? `~${time(finish)} to finish` : 'Check the team');
    setWithin(card, '.job-status', claimed ? `${rider?.name ?? 'Courier'} is on it` : d.called ? `${d.channel.toUpperCase()} on air` : 'Off the radio');
    const button = card.querySelector('.quick-call');
    button.hidden = claimed;
    button.disabled = game.gameOver || (!d.called && game.radioUsed() >= game.radioSlots);
    button.textContent = d.called ? 'Withdraw call' : game.radioUsed() >= game.radioSlots ? 'Radio full' : 'Broadcast OPEN';
    button.title = !d.called && game.radioUsed() >= game.radioSlots ? 'Withdraw an on-air call or wait for a courier to volunteer.' : '';
    button.setAttribute('aria-label', `${d.called ? 'Withdraw' : 'Broadcast OPEN for'} ${d.id.toUpperCase()}`);
    card.querySelector('.job-select').setAttribute('aria-label', `Inspect ${d.id.toUpperCase()}: ${d.pickupAddress} to ${d.dropoffAddress}, €${d.reward}, ${time(d.deadlineAt-game.elapsed)} left. ${timing.textContent}`);
  }
  text('#work-count', jobs.length);
  $('#empty-queue').hidden = jobs.length > 0;
}

function renderTeam() {
  for (const rider of game.couriers) {
    let card = riderCards.get(rider.id);
    if (!card) {
      card = document.createElement('article'); card.className = 'rider';
      const locate=document.createElement('button');locate.className='rider-locate';locate.setAttribute('aria-label',`Locate ${rider.name} on the map`);locate.title=`Locate ${rider.name}`;locate.append(createRiderPortraitElement(rider));card.append(locate);
      locate.addEventListener('click',()=>{
        game.selectedCourierId=rider.id;
        renderer.focusRegionId=null;
        const job=game.deliveryById(rider.deliveryId);
        if(job){game.selectedDeliveryId=job.id;focusContract(job);}else {game.selectedDeliveryId=null;renderer.focusBounds({x1:rider.x-85,y1:rider.y-85,x2:rider.x+85,y2:rider.y+85});$('#region-view').value='route';}
        renderer.draw(true);render();
        if(innerWidth<=850)canvas.scrollIntoView({block:'center',behavior:'instant'});
      });
      const content = document.createElement('div');
      content.innerHTML = '<div class="rider-head"><strong></strong><span></span></div><p></p><meter min="0" max="100"></meter>';
      card.append(content); $('#team-list').append(card); riderCards.set(rider.id, card);
      card.style.setProperty('--courier',rider.color);
    }
    const job = game.deliveryById(rider.deliveryId);
    setWithin(card, 'strong', rider.name);
    const activity=riderActivity(game,rider);
    card.dataset.phase=rider.phase;
    setWithin(card, '.rider-head span', rider.phase === 'break' ? `Rest ${time(game.breakRemaining(rider))}` : activity?.label??(job ? `${job.id.toUpperCase()} · ${rider.phase === 'pickup' ? 'pickup' : 'drop-off'}` : rider.phase === 'coasting' ? 'Finishing street' : rider.deliberation ? 'Considering' : 'Listening'));
    const preference = { sprinter: 'Likes short, urgent jobs', earner: 'Likes a worthwhile fee', local: 'Likes work in their district' };
    setWithin(card, 'p', activity?.detail??(job ? `${time(game.courierETA(rider))} estimated to finish · ${rider.lastDecision.replace(/^Took \w+ · /,'')}` : game.calledDeliveries().length && rider.lastDecision.includes('time to finish') ? rider.lastDecision : preference[rider.personality.id]));
    card.title = `${rider.completed} delivered · ${rider.lastDecision}`;
    card.querySelector('meter').value = Math.round((1 - rider.fatigue) * 100);
    card.querySelector('meter').setAttribute('aria-label', `${rider.name} energy ${Math.round((1 - rider.fatigue) * 100)} percent`);
  }
}

function select(id) {
  game.selectedDeliveryId = id;
  game.selectedCourierId = null;
  render();
  if (innerWidth<=850) $('#contract-title').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}

function renderSelection() {
  const d = game.deliveryById(game.selectedDeliveryId), active = d && ['waiting', 'claimed'].includes(d.status);
  $('#selection-empty').hidden = Boolean(active); $('#contract-detail').hidden = !active;
  if (!active) return;
  text('#contract-title', d.id.toUpperCase());
  const cargo = $('#selected-cargo');
  if (cargo.dataset.type !== d.type) {
    cargo.replaceChildren(createCargoIconElement(d.type, { className: 'cargo-icon', title: CARGO_FAMILIES[d.type].name }), document.createTextNode(CARGO_FAMILIES[d.type].name));
    cargo.dataset.type = d.type;
  }
  text('#selected-reward', `€${d.reward}`); text('#selected-pickup', d.pickupAddress); text('#selected-drop', d.dropoffAddress);
  text('#selected-time', `${time(d.deadlineAt - game.elapsed)} left`);
  text('#selected-distance', `${(d.plannedDistance / 100).toFixed(1)} km`);
  const regionName=id=>game.districts.find(r=>r.id===id)?.name??id;
  text('#selected-regions',`${regionName(d.pickupDistrict)} → ${regionName(d.dropoffDistrict)}`);
  const handling=game.handoffTime(d);
  text('#selected-handling', CARGO_FAMILIES[d.type].detail+(game.refined?` Stops: ${handling.pickup}s collection + ${handling.dropoff}s handover.`:''));
  const advice = estimates.get(d.id);
  const rider = game.courierById(d.courierId);
  let explanation = rider ? `${rider.name} volunteered · ${time(game.courierETA(rider))} estimated to finish. ${riderActivity(game,rider)?.detail??(rider.phase === 'pickup' ? 'Riding to the pickup.' : 'Cargo is on board.')}` : 'Couriers decide after they hear your call.';
  if (advice) explanation = `${advice.label}${Number.isFinite(advice.finishIn) ? ` · ~${time(advice.finishIn)} with pickup` : ''}. ${advice.detail}`;
  text('#selected-state', explanation);
  $('#selected-state').dataset.state = advice?.state ?? 'riding';
  for (const button of document.querySelectorAll('[data-radio]')) {
    const channel = button.dataset.radio, cost = channel === 'priority' ? 2 : 1;
    button.disabled = game.gameOver || d.status !== 'waiting' || game.radioUsed() - game.radioCost(d) + cost > game.radioSlots;
    button.title = button.disabled && d.status === 'waiting' ? `${channel.toUpperCase()} needs ${cost} ${cost === 1 ? 'slot' : 'slots'}. Withdraw another call to make room.` : '';
    button.setAttribute('aria-pressed', String(d.called && d.channel === channel));
  }
  $('#withdraw').hidden = !d.called || d.status !== 'waiting';
  $('#bonus').disabled = game.gameOver || d.status !== 'waiting' || d.sweetened || game.cash < 5;
  text('#bonus', d.sweetened ? '€5 courier bonus paid' : 'Offer €5 courier bonus');
  const extension=game.extensionOffer(d);
  $('#client-call').disabled=!extension.available;
  text('#client-call',d.extended?'Client extension agreed':extension.available?`Ask for +${Math.round(extension.seconds)}s · fee −€${extension.fee}`:'Call client for more time');
  text('#client-call-detail',d.extended?`+${Math.round(d.deadlineAdded??0)}s agreed; fee reduced by €${d.feeConcession??0}.`:extension.available?`One time. Fee €${d.reward} → €${extension.newReward}. More time, less pay; no rider is assigned.`:extension.reason);
  $('#decision-details').hidden=d.status!=='waiting';
  if($('#decision-details').open&&d.status==='waiting')renderDecisions(d);
}

function renderDecisions(d) {
  const brief=decisionBrief(game,d,feasibility.get(d.id));if(!brief)return;
  const outlook=$('#rider-outlook');
  if(!outlook.children.length)for(const c of game.couriers){const row=document.createElement('div');row.className='outlook-row';row.innerHTML='<strong></strong><span></span><small></small>';row.style.setProperty('--courier',c.color);outlook.append(row);}
  brief.rows.forEach((row,i)=>{const el=outlook.children[i];el.dataset.state=row.state;setWithin(el,'strong',row.rider.name);setWithin(el,'span',row.detail);setWithin(el,'small',Number.isFinite(row.finishIn)?`~${time(row.finishIn)} to finish · ${row.margin>=0?`${time(row.margin)} buffer`:`${time(-row.margin)} late`}`:'No finish within the estimate window');});
  const effects=$('#channel-effects');if(!effects.children.length)for(const channel of brief.channels){const p=document.createElement('p');p.innerHTML='<strong></strong><span></span>';effects.append(p);}
  brief.channels.forEach((channel,i)=>{const el=effects.children[i];setWithin(el,'strong',`${channel.id.toUpperCase()} · ${channel.eligible} ready ${channel.eligible===1?'rider':'riders'} can consider`);setWithin(el,'span',channel.detail);});
}
$('#decision-details').addEventListener('toggle',()=>{if($('#decision-details').open){const d=game?.deliveryById(game.selectedDeliveryId);if(d?.status==='waiting')renderDecisions(d);}});

function showReview() {
  const review = game.shiftReview(), success = review.outcome === 'success';
  text('#result-label', success ? 'A GOOD DAY ON THE DESK' : 'EVERY SHIFT TEACHES SOMETHING');
  text('#result-title', success ? 'You kept Berlin moving.' : review.outcome === 'collapse' ? 'The desk lost its rhythm.' : 'Close the desk. Try again.');
  text('#result-description', `${review.completed} of ${review.target} target deliveries. ${success ? 'The team made it through with reputation to spare.' : 'A fresh attempt gives you the same opening and another chance to read the city.'}`);
  const stats = $('#result-stats'); stats.replaceChildren();
  for (const [value, label] of [[review.completed, 'Delivered'], [review.failed, 'Missed'], [`€${review.profit}`, 'Net earned']]) {
    const box = document.createElement('div'), strong = document.createElement('strong'), small = document.createElement('small');
    strong.textContent = value; small.textContent = label; box.append(strong, small); stats.append(box);
  }
  text('#result-rider', `${review.topRider} completed ${review.topDeliveries} deliveries.`);
  text('#result-flow', `Best flow: ${game.bestChain} deliveries in a row without a miss.`+(game.refined?` ${review.clientExtensions} client extensions · €${review.feesConceded} in fee concessions · €${review.bonusesPaid} in bonuses.`:''));
  text('#result-lesson', review.lesson);
  const timeline = $('#result-timeline'); timeline.replaceChildren();
  for (const entry of game.dispatchLog.filter(e => ['claim', 'complete', 'fail', 'event-start', 'event-end', 'upgrade'].includes(e.action)).slice(-12)) {
    const li = document.createElement('li');
    const descriptions = { claim: `${entry.rider} took ${entry.deliveryId?.toUpperCase()}`, complete: `${entry.rider} delivered ${entry.deliveryId?.toUpperCase()}`, fail: `${entry.deliveryId?.toUpperCase()} missed · ${entry.kind?.replaceAll('-', ' ')}`, 'event-start': `Roadworks on ${entry.place}`, 'event-end': `${entry.place} cleared`, upgrade: entry.upgrade };
    li.textContent = `${time(entry.at)} — ${descriptions[entry.action]}`; timeline.append(li);
  }
  $('#review-dialog').showModal();
}

function render() {
  const end = game.config.arrivals + game.config.closing, phase = game.phase();
  text('#reputation', Math.ceil(game.reputation)); $('#rep-meter').value = game.reputation;
  text('#cash', `€${game.cash}`); text('#radio-count', `${game.radioUsed()} / ${game.radioSlots}`);
  const freeSlots = game.radioSlots - game.radioUsed();
  text('#radio-hint', freeSlots === 0 ? 'Radio full. Withdraw a call or wait for a volunteer.' : `${freeSlots} ${freeSlots === 1 ? 'slot' : 'slots'} free · a volunteer frees the frequency.`);
  $('#radio-hint').dataset.full = String(freeSlots === 0);
  text('#phase-name', phase.label); text('#phase-detail', phase.detail);
  const demand=game.demandRegion();
  text('#demand-region',game.closing?'Finishing the queue':`Demand favors ${demand.name}`);
  text('#flow-count',game.cleanChain>1?`${game.cleanChain} clean deliveries in a row`:'Build a clean delivery streak');
  text('#map-detail-status',renderer.buildingDetails?.status(renderer.scale)??'');
  text('#mobile-job-count',game.activeDeliveries().length);
  const metersPerPixel=city.metadata.metersPerUnit/renderer.scale;
  const scaleMeters=[50,100,200,500,1000,2000,5000].findLast(n=>n/metersPerPixel<=100)??50;
  text('#map-scale-label',scaleMeters>=1000?`${scaleMeters/1000} km`:`${scaleMeters} m`);
  $('#map-scale-bar').style.width=`${scaleMeters/metersPerPixel}px`;
  text('#delivery-target', `${game.completed} / ${game.config.target} delivered`);
  text('#clock', time(end - game.elapsed)); $('#shift-progress').max = end; $('#shift-progress').value = game.elapsed;
  text('#pause', game.gameOver ? 'Shift finished' : game.paused ? game.tick === 0 ? 'Start shift' : 'Resume' : 'Pause');
  $('#pause').disabled = game.gameOver; text('#speed', `${game.speed}×`); $('#speed').disabled = game.gameOver;
  text('#seed-label', `SHIFT ${game.seed}`);
  text('#notice', game.elapsed <= game.noticeUntil ? game.notice : '');
  const ev = game.currentEvent;
  $('#event-banner').hidden = !ev;
  if (ev) {
    text('#event-state', ev.state === 'forecast' ? 'ROADWORKS AHEAD' : 'SLOWER STREET');
    text('#event-place', ev.place); text('#event-time', ev.state === 'forecast' ? `Starts in ${time(ev.startsAt - game.elapsed)}` : `Clears in ${time(ev.endsAt - game.elapsed)}`);
  }
  $('#coach-panel').hidden = game.mode !== 'training' || game.completed >= 3;
  if (game.mode === 'training') {
    const first = game.deliveries[0];
    text('#coach', game.completed > 0 ? 'First delivery done. Try LOCAL for nearby work. PRIORITY uses two radio slots when a job needs attention.' : first.status === 'claimed' ? `${game.courierById(first.courierId).name} chose the job. Watch the pickup, then the delivery. You shape the call; the rider chooses.` : first.called ? 'Your call is on air. Press Start shift or Resume if paused, and watch a courier volunteer.' : 'Your first call: select the light parcel and tap Broadcast OPEN. Start the shift when you are ready.');
  }
  estimates.clear();feasibility.clear();
  for (const d of game.activeDeliveries()) if (d.status === 'waiting') {const value=game.deliveryFeasibility(d);feasibility.set(d.id,value);estimates.set(d.id,timingAdvice(value));}
  renderQueue(); renderTeam(); renderSelection();
  if (game.upgradePending && !$('#upgrade-dialog').open && !$('#intro').open && !$('#help-dialog').open) {
    audio.cancel();
    const list = $('#upgrade-list'); list.replaceChildren();
    for (const upgrade of game.getUpgradeChoices()) {
      const button = document.createElement('button'), name = document.createElement('strong'), desc = document.createElement('small');
      name.textContent = upgrade.title; desc.textContent = upgrade.desc; button.append(name, desc);
      button.addEventListener('click', () => { act({ type: 'upgrade', id: upgrade.id }); $('#upgrade-dialog').close(); render(); }); list.append(button);
    }
    $('#upgrade-dialog').showModal();
  }
  if (game.gameOver && !$('#review-dialog').open) { if ($('#upgrade-dialog').open) $('#upgrade-dialog').close(); showReview(); }
  const events = game.dispatchLog.slice(lastLog); lastLog = game.dispatchLog.length;
  for (const event of events) {
    const job=game.deliveryById(event.deliveryId);
    if(event.action==='complete'&&job){
      const rider=game.couriers.find(c=>c.name===event.rider);$('#delivery-receipt').style.setProperty('--courier',rider?.color??'#367b69');
      text('#receipt-title',`${event.rider} · ${job.id.toUpperCase()}`);text('#receipt-address',job.dropoffAddress);text('#receipt-result',`+€${job.reward} · ${Math.round(event.quality*100)}% of the time window left`);receiptUntil=performance.now()+5000;
    }
    if(sound&&!document.hidden){
      const rider=game.couriers.find(c=>c.name===event.rider);
      const edge=event.action.startsWith('event-')&&game.visualEdges.find(e=>e.streetName===event.place);
      const point=rider??(job?game.nodeById(job.pickupId):edge?game.nodeById(edge.a):null);
      const name=['call','channel'].includes(event.action)?`call-${event.channel}`:({uncall:'call-off',sweeten:'bonus','shift-finish':'finish'})[event.action]??event.action;
      audio.cue(name,{jobId:job?.id,rider:event.rider,cargo:job?.type,pan:soundPan(point),success:game.outcome==='success'});
    }
  }
  $('#delivery-receipt').hidden=performance.now()>receiptUntil;
}

function frame(now) {
  if (faulted) return;
  requestAnimationFrame(frame);
  try {
    const delta = Math.min(.25, (now - lastTime) / 1000); lastTime = now;
    if (!document.hidden) {
      accumulator += delta;
      while (accumulator >= FIXED_STEP) { game.update(FIXED_STEP); accumulator -= FIXED_STEP; }
      renderer.draw();
      if (now - lastUI > 125) { render();audio.update(game,{feasibility,panFor:soundPan});renderListening(); lastUI = now; }
      if (now-lastSave>5000)saveShift();
    }
  } catch (error) {
    faulted = true; game.paused = true; $('#fatal-error').hidden = false; throw error;
  }
}

document.querySelectorAll('[data-radio]').forEach(button => button.addEventListener('click', () => act({ type: 'radio', jobId: game.selectedDeliveryId, channel: button.dataset.radio })));
$('#withdraw').addEventListener('click', () => act({ type: 'radio', jobId: game.selectedDeliveryId, channel: 'off' }));
$('#bonus').addEventListener('click', () => act({ type: 'bonus', jobId: game.selectedDeliveryId }));
$('#client-call').addEventListener('click', () => act({ type: 'client-call', jobId: game.selectedDeliveryId }));
$('#pause').addEventListener('click', () => act({ type: 'pause', paused: !game.paused }));
$('#speed').addEventListener('click', () => act({ type: 'speed', speed: game.speed === 1 ? 2 : 1 }));
function setSound(enabled){sound=audio.setEnabled(enabled);text('#sound',sound?'Sound on':'Sound off');$('#sound').setAttribute('aria-pressed',String(sound));text('#studio-toggle',sound?'Mute sound':'Enable sound');text('#sound-status',enabled&&!sound?'Audio is unavailable in this browser. The desk remains fully playable.':sound?'Sound on. Rider previews and event cues use the same original score.':'Muted. Every event is still shown visually.');}
$('#sound').addEventListener('click',()=>setSound(!sound));
$('#open-sound-studio').addEventListener('click',()=>{soundWasPaused=game.paused;act({type:'pause',paused:true});$('#sound-dialog').showModal();});
function closeSound(){$('#sound-dialog').close();act({type:'pause',paused:soundWasPaused});}
$('#close-sound').addEventListener('click',closeSound);$('#sound-dialog').addEventListener('cancel',event=>{event.preventDefault();closeSound();});
$('#studio-toggle').addEventListener('click',()=>setSound(!sound));
$('#sound-volume').addEventListener('input',event=>audio.setVolume(Number(event.target.value)/100));
$('#sound-mix').addEventListener('change',event=>audio.setMix(event.target.value));
$('#task-rhythms').addEventListener('change',event=>audio.setRhythms(event.target.checked));
document.querySelectorAll('[data-rhythm]').forEach(button=>button.addEventListener('click',()=>{setSound(true);audio.previewRhythm(Number(button.dataset.rhythm));}));
document.querySelectorAll('[data-listen]').forEach(button=>button.addEventListener('click',()=>{setSound(true);audio.cancel();audio.cue('rider',{rider:button.dataset.listen});}));
$('#new-shift').addEventListener('click', () => { act({ type: 'pause', paused: true }); $('#continue-shift').hidden = false; $('#resume-saved').hidden=true; $('#intro').showModal(); });
$('#continue-shift').addEventListener('click', () => $('#intro').close());
document.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => {
  saveEnabled=true;
  const seed = game.tick === 0 ? game.seed : createSeed(); begin(button.dataset.start, seed);
  saveShift();
  if (sound) {audio.ensure();audio.cue('start');}
}));
$('#help').addEventListener('click', () => { helpWasPaused = game.paused; act({ type: 'pause', paused: true }); $('#help-dialog').showModal(); });
function closeHelp() { $('#help-dialog').close(); act({ type: 'pause', paused: helpWasPaused }); }
$('#close-help').addEventListener('click', closeHelp);
$('#help-dialog').addEventListener('cancel', event => { event.preventDefault(); closeHelp(); });
['#intro', '#upgrade-dialog', '#review-dialog'].forEach(id => $(id).addEventListener('cancel', event => event.preventDefault()));
$('#retry').addEventListener('click', () => {begin(game.mode,game.seed,game.startRegion);saveShift();});
$('#next-shift').addEventListener('click', () => {begin(game.mode === 'training' ? 'standard' : game.mode);saveShift();});
$('#resume-saved').addEventListener('click',()=>{
  if(!savedRecord)return;
  try {
    const restored=replayRun(savedRecord,{city});
    restored.dispatch({type:'pause',paused:true});
    restored.selectedDeliveryId=restored.activeDeliveries()[0]?.id??null;
    begin(restored.mode,restored.seed,restored.startRegion,restored);
    saveEnabled=true;saveShift();
    game.flash('Shift restored. Resume when you are ready.',6);
  }catch {
    $('#resume-saved').hidden=true;$('#resume-note').hidden=false;text('#resume-note','This saved shift could not be restored. Start a fresh shift below.');
  }
});
$('#export-run').addEventListener('click', () => {
  const record = game.exportRun(), url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `send-it-${game.mode}-${String(game.seed).replace(/[^a-z0-9_-]/gi, '_').slice(0,60)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#reload').addEventListener('click', () => location.reload());

function zoom(factor) { renderer.zoomAt(renderer.viewWidth / 2, renderer.viewHeight / 2, factor); renderer.draw(true); }
$('#zoom-in').addEventListener('click', () => zoom(1.2));
$('#zoom-out').addEventListener('click', () => zoom(1 / 1.2));
$('#fit-map').addEventListener('click', () => { renderer.resetView(); renderer.draw(true); });
$('#region-view').addEventListener('change',event=>{
  const region=city.regions.find(r=>r.id===event.target.value);
  renderer.focusRegionId=region?.id??null;
  if(region)renderer.focusBounds(region.bounds);else renderer.resetView();
  renderer.draw(true);render();
});
$('#fit-map').addEventListener('click',()=>{$('#region-view').value='';renderer.focusRegionId=null;});
function focusContract(d) {
  $('#region-view').value='route';renderer.focusRegionId=null;
  const rider=game.courierById(d.courierId);
  const route=game.routeBetween(d.pickupId,d.dropoffId);
  const points=route.map(id=>game.nodeById(id));
  if(rider){points.push(rider);for(const id of rider.path.slice(rider.pathIndex))points.push(game.nodeById(id));}
  else if(game.tick===0)points.push(game.nodeById(game.depotNodeId));
  renderer.focusBounds({x1:Math.min(...points.map(p=>p.x))-45,y1:Math.min(...points.map(p=>p.y))-45,x2:Math.max(...points.map(p=>p.x))+45,y2:Math.max(...points.map(p=>p.y))+45});
}
$('#find-route').addEventListener('click',()=>{
  const d=game.deliveryById(game.selectedDeliveryId);if(!d)return;
  focusContract(d);
  renderer.draw(true);render();
  if(innerWidth<=850)canvas.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
});
canvas.addEventListener('wheel', event => { event.preventDefault(); const rect = canvas.getBoundingClientRect(); renderer.zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
canvas.addEventListener('pointerdown', event => {
  if(event.pointerType==='touch') {
    touches.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);
    if(touches.size===2) {const [a,b]=[...touches.values()];pinchDistance=Math.hypot(a.x-b.x,a.y-b.y);if(pointer)pointer.moved=true;return;}
  }
  if (!event.isPrimary || event.button !== 0) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if(touches.has(event.pointerId))touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(touches.size===2) {
    const [a,b]=[...touches.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),rect=canvas.getBoundingClientRect();
    if(pinchDistance>0&&distance>0)renderer.zoomAt((a.x+b.x)/2-rect.left,(a.y+b.y)/2-rect.top,distance/pinchDistance);
    pinchDistance=distance;return;
  }
  if (!pointer || pointer.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6) pointer.moved = true;
  if (pointer.moved) renderer.pan(event.clientX - pointer.x, event.clientY - pointer.y);
  pointer.x = event.clientX; pointer.y = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if(touches.has(event.pointerId)) {
    touches.delete(event.pointerId);
    if(pinchDistance) {pinchDistance=0;pointer=null;touches.clear();if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);return;}
  }
  if (!pointer || pointer.id !== event.pointerId) return;
  if (!pointer.moved) {
    const rect = canvas.getBoundingClientRect(), p = renderer.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const hit = game.nearestEntity(p.x, p.y, 24 / renderer.scale);
    if (hit?.type === 'delivery') select(hit.id);
    else if (hit?.type === 'courier') { game.selectedCourierId = hit.id; render(); }
  }
  pointer = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointercancel', () => { pointer = null;touches.clear();pinchDistance=0; });
canvas.addEventListener('lostpointercapture', event => {if(pointer?.id===event.pointerId)pointer=null;touches.delete(event.pointerId);if(touches.size<2)pinchDistance=0;});
window.addEventListener('keydown', event => {
  if (!game) return;
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable=true]') || dialogs.some(id => $(id).open)) return;
  if (event.key === ' ' && event.target.closest?.('button,a,summary')) return;
  if (event.key === ' ') { event.preventDefault(); act({ type: 'pause', paused: !game.paused }); }
  if (event.key === '+' || event.key === '=') zoom(1.2);
  if (event.key === '-') zoom(1 / 1.2);
  if (event.key === '0') { renderer.resetView(); renderer.draw(true); }
  if (event.key === 'Escape') { game.selectedDeliveryId = game.selectedCourierId = null; render(); }
});
document.addEventListener('visibilitychange', () => {
  if (!game) return;
  accumulator = 0; lastTime = performance.now();
  if (document.hidden) { act({ type: 'pause', paused: true }); saveShift();audio.suspend(); }
  else { game.flash('The desk paused while you were away. Resume when ready.', 8); render(); }
});
window.addEventListener('pagehide', () => { game?.dispatch({ type: 'pause', paused: true });saveShift(); });
const params = new URLSearchParams(location.search);
try {
  const inner=params.get('city')==='inner-ring';
  text('#loading-detail',inner?'Loading the Inner Ring street map.':'Loading Berlin’s complete street map. The first visit may take a moment.');
  city=await (inner?loadInnerRing:loadBerlinCity)({signal:AbortSignal.timeout(120000)});
  text('#scope-name',inner?'⌁ BERLIN · INNER RING':'⌁ BERLIN · FULL CITY');
  text('#scope-eyebrow',inner?'BERLIN / INNER RING':'BERLIN / FULL CITY');
  text('#map-credits',inner?'Berlin Open Data · © OpenStreetMap contributors · map details':'Berlin Open Data · map sources and accuracy');
  $('#region-view').options[0].textContent=inner?'Whole Inner Ring':'Whole Berlin';
  text('#scope-link',inner?'Explore the full city':'Play the original Inner Ring');$('#scope-link').href=inner?'?city=berlin':'?city=inner-ring';
  text('#city-summary',`${city.metadata.areaKm2.toLocaleString()} km² · ${city.regions.length} official localities · one connected operating map`);
  $('#start-region-field').hidden=inner;
  if(inner)text('#scope-help','This original scenario operates inside the S41 / S42 Ringbahn. Map views change the camera without changing the operating area.');
  for(const region of city.regions) {
    const option=document.createElement('option');option.value=region.id;option.textContent=region.name;$('#region-view').append(option);
    if(!inner&&region.depot!=null)$('#start-region').append(option.cloneNode(true));
  }
  if([...$('#start-region').options].some(o=>o.value===params.get('district')))$('#start-region').value=params.get('district');
  for(const control of document.querySelectorAll('button,select')) control.disabled=false;
  begin(Object.hasOwn(SHIFT_MODES, params.get('mode')) ? params.get('mode') : 'training', params.get('seed') || createSeed());
  try {const record=JSON.parse(localStorage.getItem(`send-it:shift:${city.metadata.id}`));if(record?.city===city.metadata.id&&record.ticks>0&&!record.review?.outcome){savedRecord=record;$('#resume-saved').hidden=false;text('#resume-saved',`Resume saved ${record.mode==='training'?'first shift':'Berlin shift'} · paused`);}}catch{}
  $('#map-loading').hidden=true;$('#intro').showModal();requestAnimationFrame(frame);
} catch(error) {
  console.error('Berlin map startup failed',error);
  $('#map-loading').hidden=true;
  $('#fatal-error').hidden=false;
  $('#fatal-message').textContent='The Berlin map could not load. Check your connection and reload; this desk needs its local city data.';
}
