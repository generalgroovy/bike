import { BerlinPlaytest, CARGO_FAMILIES, FIXED_STEP, SHIFT_MODES, replayRun } from './game-berlin-playtest.js';
import { Renderer } from './render.js';
import { createSeed } from './rng.js';
import { createCargoIconElement } from './cargo-icons.js';
import { createRiderPortraitElement } from './rider-identity.js';
import { DeskScore } from './playtest-score.js';
import { CHANNEL_EFFECTS, decisionBrief, riderActivity } from './playtest-decisions.js';
import { loadInnerRing, loadBerlinCity } from './inner-ring-city.js';
import { timingAdvice } from './playtest-advice.js';
import { deskState, jobState } from './desk-state.js';
import { createBikeIconElement, bikeVisual, riderEndurance, riderLoad } from './bike-display.js';
import { forecastBroadcast, previewKey } from './broadcast-preview.js';
import { deskFocus } from './desk-focus.js';
import { RadioDesk } from './radio-desk.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#game-canvas');
const cards = new Map(), riderCards = new Map();
const estimates = new Map(), feasibility = new Map();
const audio = new DeskScore();
const radioDesk = new RadioDesk();
const time = seconds => { const n = Math.max(0, Math.ceil(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const text = (selector, value) => { const el = $(selector), next = String(value); if (el.textContent !== next) el.textContent = next; };
const dialogs = ['#intro', '#help-dialog', '#sound-dialog', '#radio-log-dialog', '#rider-wellbeing-dialog', '#upgrade-dialog', '#review-dialog'];
let radioWasPaused=true;
let wellbeingWasPaused=true, wellbeingRiderId=null;
let game, renderer, city, lastTime = performance.now(), accumulator = 0, lastUI = 0, lastLog = null;
let sound = false, faulted = false, helpWasPaused = true, soundWasPaused=true, pointer = null, receiptUntil=0;
let savedRecord=null, saveEnabled=false, lastSave=0;
let broadcastDraft=null, inspectedRiderId=null;
const touches=new Map();let pinchDistance=0;
audio.enabled = false;
for(const control of document.querySelectorAll('button,select')) if(control.id!=='reload') control.disabled=true;

function begin(mode, seed = createSeed(), startRegion=$('#start-region').value, restored=null) {
  dialogs.forEach(id => { if ($(id).open) $(id).close(); });
  renderer?.dispose();
  audio.cancel();receiptUntil=0;$('#delivery-receipt').hidden=true;
  game = restored ?? new BerlinPlaytest({ seed, mode, city, startRegion });
  radioDesk.reset();
  broadcastDraft=null;inspectedRiderId=null;$('#rider-comparison').hidden=true;
  $('#rider-preference-field').hidden=!game.logistics;
  $('#preference-effect').hidden=!game.logistics;
  $('#parcel-requirements').hidden=!game.logistics;
  $('#logistics-help').hidden=!game.logistics;
  $('#wellbeing-help').hidden=!game.wellbeing;
  wellbeingRiderId=null;
  $('#preferred-rider').replaceChildren(new Option('No preference', ''), ...game.couriers.map(c=>new Option(`${c.name} · ${bikeVisual(c).label}`,c.id)));
  $('#shift-length').options[0].textContent=`3 minutes · ${game.fullCity?6:5} deliveries`;
  $('#shift-length').options[1].textContent=`9 minutes · ${game.fullCity?26:24} deliveries`;
  if (!restored) game.selectedDeliveryId = game.activeDeliveries()[0]?.id ?? null;
  $('#shift-length').value = mode;
  $('#prepare-shift').dataset.start = mode;
  if (restored && game.fullCity) $('#start-region').value = game.startRegion;
  renderer = new Renderer(canvas, game, { nativeMap: false, minimumMapBand: 'district' });
  $('#region-view').value = '';
  cards.clear(); riderCards.clear();
  estimates.clear();
  $('#coach-panel').open = true;
  $('#offer-options').open = false;
  $('#decision-details').open = false;
  $('#forecast-route').open = false;
  $('#accepted-tour').open = false;
  $('#rider-outlook').replaceChildren();
  $('#work-list').replaceChildren(); $('#team-list').replaceChildren();
  lastLog = restored?game.dispatchLog.at(-1)??null:null;accumulator = 0; lastTime = performance.now(); faulted = false;
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
  if(changed && ['radio','bonus','client-call','prefer'].includes(action.type))broadcastDraft=null;
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
  card.innerHTML = '<button class="job-select"><span class="job-top"><span class="job-family"></span><strong class="job-fee"></strong></span><span class="job-address"><small>P</small><span class="job-pickup"></span></span><span class="job-address"><small>D</small><span class="job-drop"></span></span><span class="job-meta"><span class="job-distance"></span><span class="job-time"></span></span><span class="job-timing"><strong></strong><span></span></span><span class="job-status"></span></button>';
  $('#work-list').append(card); cards.set(d.id, card);
  card.querySelector('.job-select').addEventListener('click', () => select(d.id));
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
    const state = jobState(game, d);
    card.dataset.selected = String(game.selectedDeliveryId === d.id);
    card.dataset.urgent = String(d.deadlineAt - game.elapsed < 25);
    card.dataset.status = d.status; card.dataset.channel = d.channel ?? 'off';
    setWithin(card, '.job-family', `${d.id.toUpperCase()} · ${CARGO_FAMILIES[d.type].name}${game.logistics?` · ${d.weightKg} kg`:''}`);
    setWithin(card, '.job-fee', `€${d.reward}`);
    setWithin(card, '.job-pickup', d.pickupAddress); setWithin(card, '.job-drop', d.dropoffAddress);
    setWithin(card, '.job-distance', `${(d.plannedDistance / 100).toFixed(1)} km`);
    setWithin(card, '.job-time', `${time(d.deadlineAt - game.elapsed)} left`);
    const rider = game.courierById(d.courierId);
    const advice = estimates.get(d.id);
    const finish = claimed ? game.logistics?game.jobETA(rider,d):game.courierETA(rider) : advice?.finishIn;
    const timing = card.querySelector('.job-timing');
    timing.dataset.state = claimed ? 'riding' : advice.state;
    setWithin(timing, 'strong', claimed ? state.label : advice.label);
    setWithin(timing, 'span', Number.isFinite(finish) ? `~${time(finish)} to finish` : 'Check the team');
    setWithin(card, '.job-status', claimed ? `${rider?.name ?? 'Courier'} is on it${state.id==='queued'?' · next pickup':''}` : d.called ? `${state.label} · ${d.channel.toUpperCase()}` : state.label);
    card.querySelector('.job-select').setAttribute('aria-pressed', String(game.selectedDeliveryId === d.id));
    card.querySelector('.job-select').setAttribute('aria-label', `Inspect ${d.id.toUpperCase()}: ${d.pickupAddress} to ${d.dropoffAddress}, €${d.reward}, ${time(d.deadlineAt-game.elapsed)} left. ${timing.textContent}`);
  }
  text('#work-count', jobs.length);
  text('#queue-summary', `${jobs.filter(d=>d.status==='waiting').length} waiting · ${jobs.filter(d=>d.status==='claimed').length} riding`);
  const focus=deskFocus(game,feasibility),focusButton=$('#desk-focus');
  focusButton.hidden=!focus;
  if(focus){
    focusButton.dataset.tone=focus.tone;focusButton.dataset.focus=focus.id;
    focusButton.dataset.job=focus.jobId??'';focusButton.dataset.rider=focus.riderId??'';focusButton.disabled=!focus.jobId&&!focus.riderId;
    text('#focus-title',focus.title);text('#focus-detail',focus.detail);
    focusButton.setAttribute('aria-label',`${focus.title}. ${focus.detail}${focus.jobId?`. Inspect ${focus.jobId.toUpperCase()}`:focus.riderId?'. Inspect this rider’s patience and recovery':''}`);
  }
  $('#empty-queue').hidden = jobs.length > 0;
}

function renderTeam() {
  for (const rider of game.couriers) {
    let card = riderCards.get(rider.id);
    if (!card) {
      card = document.createElement('article'); card.className = 'rider';card.dataset.rider=rider.id;
      const locate=document.createElement('button');locate.className='rider-locate';locate.setAttribute('aria-label',`Locate ${rider.name} on the map`);locate.title=`Locate ${rider.name}`;locate.append(rider.bikeType?createBikeIconElement(rider,{className:'bike-icon',title:bikeVisual(rider).label}):createRiderPortraitElement(rider));card.append(locate);
      locate.addEventListener('click',()=>{
        game.selectedCourierId=rider.id;
        renderer.focusRegionId=null;
        const job=game.deliveryById(rider.deliveryId);
        if(job){game.selectedDeliveryId=job.id;focusContract(job);}else {game.selectedDeliveryId=null;renderer.focusBounds({x1:rider.x-85,y1:rider.y-85,x2:rider.x+85,y2:rider.y+85});$('#region-view').value='route';}
        renderer.draw(true);render();
        if(innerWidth<=850)canvas.scrollIntoView({block:'center',behavior:'instant'});
      });
      const content = document.createElement('div');
      content.className='rider-info';
      content.innerHTML = '<div class="rider-head"><strong></strong><span></span></div><p class="rider-preferences"></p><p class="rider-accepts"></p><div class="rider-resources"><label><span class="rider-endurance"></span><meter class="endurance-meter" min="0" max="100"></meter></label><label class="load-resource"><span class="rider-capacity"></span><meter class="load-meter" min="0" max="100"></meter></label></div><div class="rider-wellbeing" hidden><button class="wellbeing-toggle" aria-haspopup="dialog"><span class="wellbeing-heading"><span class="rider-satisfaction"></span><strong class="rider-wellbeing-band"></strong></span><meter class="satisfaction-meter" min="0" max="100"></meter></button><p class="rider-waiting"></p><p class="rider-retention" hidden></p></div><p class="rider-activity"></p><div class="rider-jobs"></div>';
      content.querySelector('.wellbeing-toggle').addEventListener('click',()=>openRiderWellbeing(rider));
      card.append(content); $('#team-list').append(card); riderCards.set(rider.id, card);
      card.style.setProperty('--courier',rider.color);
    }
    const job = game.deliveryById(rider.deliveryId);
    setWithin(card, '.rider-head strong', rider.name);
    const wellbeing=game.wellbeing?game.riderWellbeing(rider):null;
    const activity=riderActivity(game,rider);
    card.dataset.phase=rider.phase;
    card.dataset.selected=String(game.selectedCourierId===rider.id);
    setWithin(card, '.rider-head span', rider.bikeType?bikeVisual(rider).label:rider.personality.name);
    const preference = { sprinter: 'Likes short, urgent jobs', earner: 'Likes a worthwhile fee', local: 'Likes work in their district' };
    const profile=game.logistics?game.riderProfile(rider):null;
    setWithin(card, '.rider-preferences', profile?.preferences??preference[rider.personality.id]);
    const accepts=profile?.acceptedTypes??profile?.accepts??(rider.bikeType==='road'?['document']:['document','fragile','grocery']);
    setWithin(card, '.rider-accepts', rider.bikeType?`${accepts.map(type=>CARGO_FAMILIES[type]?.name??type).join(' / ')} · up to ${rider.capacityKg} kg`:'');
    const energy=riderEndurance(rider),load=riderLoad(game,rider);
    setWithin(card, '.rider-endurance', `Endurance ${energy.current} / ${energy.max}`);
    card.querySelector('.endurance-meter').value=energy.current;card.querySelector('.endurance-meter').max=energy.max;
    card.querySelector('.endurance-meter').setAttribute('aria-label', `${rider.name}: endurance ${energy.current} of ${energy.max}`);
    card.querySelector('.load-resource').hidden=!game.logistics;
    setWithin(card, '.rider-capacity', `Load ${load.currentKg} / ${load.capacityKg} kg`);
    card.querySelector('.load-meter').value=load.currentKg;card.querySelector('.load-meter').max=load.capacityKg||1;
    card.querySelector('.load-meter').setAttribute('aria-label', `${rider.name}: carrying ${load.currentKg} of ${load.capacityKg} kg`);
    setWithin(card, '.rider-activity', wellbeing?.offDuty?'Radio off · back next shift':rider.phase==='break'?`Resting · ${time(game.breakRemaining(rider))}`:activity?.detail??(job?`${job.id.toUpperCase()} · ${rider.phase==='pickup'?'To pickup':'To delivery'} · ~${time(game.logistics?game.jobETA(rider,job):game.courierETA(rider))}`:rider.deliberation?`Considering ${rider.deliberation.deliveryId.toUpperCase()}`:'Listening for work'));
    card.title=`${rider.completed} delivered · ${rider.lastDecision}`;
    const jobs=game.logistics?game.riderJobs(rider):job?[job]:[];
    card.querySelector('.rider-wellbeing').hidden=!wellbeing;
    card.dataset.wellbeing=wellbeing?.band??'legacy';
    if(wellbeing){
      const satisfaction=Math.floor(wellbeing.satisfaction);
      setWithin(card,'.rider-satisfaction',`Satisfaction ${satisfaction} / ${wellbeing.max}`);
      setWithin(card,'.rider-wellbeing-band',wellbeing.label);
      const meter=card.querySelector('.satisfaction-meter');meter.value=wellbeing.satisfaction;meter.max=wellbeing.max;
      meter.setAttribute('aria-label',`${rider.name}: satisfaction ${satisfaction} of ${wellbeing.max}, ${wellbeing.label}`);
      const waiting=wellbeing.offDuty?'Finished for today':jobs.length?'On tour':wellbeing.lastTourAgo===null?`Waiting for first tour · ${time(wellbeing.idleSeconds)}`:`Last tour ${time(wellbeing.lastTourAgo)} ago`;
      setWithin(card,'.rider-waiting',waiting);
      const leaving=Number.isFinite(wellbeing.leaveIn);
      const retention=card.querySelector('.rider-retention');retention.hidden=!leaving;
      setWithin(card,'.rider-retention',leaving?`Leaves after ${time(wellbeing.leaveIn)} more waiting`:'');
      const toggle=card.querySelector('.wellbeing-toggle');
      toggle.setAttribute('aria-label',`${rider.name}: satisfaction ${satisfaction} of ${wellbeing.max}, ${wellbeing.label}. ${waiting}. ${leaving?`Leaves after ${time(wellbeing.leaveIn)} more waiting. `:''}Inspect patience, effects and recovery.`);
      toggle.title=`${wellbeing.reason} ${wellbeing.effect} ${wellbeing.recovery}`;
    }
    const invitation=Array.from($('#preferred-rider').options).find(option=>option.value===rider.id);
    if(invitation){invitation.disabled=Boolean(wellbeing?.offDuty);invitation.dataset.offDuty=String(Boolean(wellbeing?.offDuty));invitation.textContent=`${rider.name} · ${wellbeing?.offDuty?'finished for today':bikeVisual(rider).label}`;}
    const jobLinks=card.querySelector('.rider-jobs');
    if(jobLinks.dataset.ids!==jobs.map(j=>j.id).join(',')){
      jobLinks.dataset.ids=jobs.map(j=>j.id).join(',');jobLinks.replaceChildren();
      for(const accepted of jobs){const b=document.createElement('button');b.textContent=accepted.id.toUpperCase();b.title=`Inspect ${accepted.id.toUpperCase()}`;b.addEventListener('click',()=>select(accepted.id));jobLinks.append(b);}
    }
  }
  renderRiderWellbeing();
}

function openRiderWellbeing(rider){
  if(!game.wellbeing)return;
  wellbeingWasPaused=game.paused;wellbeingRiderId=rider.id;
  act({type:'pause',paused:true});renderRiderWellbeing();$('#rider-wellbeing-dialog').showModal();
}

function renderRiderWellbeing(){
  const rider=game?.courierById(wellbeingRiderId),wellbeing=rider&&game.wellbeing?game.riderWellbeing(rider):null;
  if(!wellbeing)return;
  text('#wellbeing-rider',`${rider.name} · ${wellbeing.label}`);
  text('#wellbeing-value',`${Math.floor(wellbeing.satisfaction)} / ${wellbeing.max}`);
  $('#rider-wellbeing-dialog').dataset.wellbeing=wellbeing.band;
  text('#wellbeing-reason',wellbeing.reason);text('#wellbeing-effect',wellbeing.effect);text('#wellbeing-recovery',wellbeing.recovery);
  text('#wellbeing-timing',wellbeing.offDuty?'Finished for today. Available again in a new shift.':`Waiting without a tour: ${time(wellbeing.idleSeconds)}. ${wellbeing.lastTourAgo===null?'No tour finished yet.':`Last tour ended ${time(wellbeing.lastTourAgo)} ago.`} Patience before satisfaction falls: ${time(wellbeing.graceSeconds)}. ${wellbeing.untilDecay>0?`${time(wellbeing.untilDecay)} patience remains.`:'Patience used up.'}${Number.isFinite(wellbeing.leaveIn)?` Leaves after ${time(wellbeing.leaveIn)} more waiting.`:''}`);
}

function select(id) {
  if (game.selectedDeliveryId !== id) {
    broadcastDraft=null;inspectedRiderId=null;
    $('#offer-options').open = false;
    $('#decision-details').open = false;
    $('#forecast-route').open = false;
    $('#accepted-tour').open = false;
  }
  game.selectedDeliveryId = id;
  game.selectedCourierId = null;
  render();
  const d = game.deliveryById(id);
  if (d) { focusContract(d); renderer.draw(true); }
  if (innerWidth<=850) {
    $('#contract-title').scrollIntoView({block:'start',behavior:'instant'});
    $('#contract-title').focus({preventScroll:true});
  }
}

function renderSelection() {
  const d = game.deliveryById(game.selectedDeliveryId);
  $('#selection-empty').hidden = Boolean(d); $('#contract-detail').hidden = !d;
  if (!d) {
    broadcastDraft=null;$('#broadcast-preview').hidden=true;
    const rider = game.courierById(game.selectedCourierId);
    text('#contract-title', rider ? rider.name : 'Choose a job');
    const wellbeing=rider&&game.wellbeing?game.riderWellbeing(rider):null;
    text('#selection-empty', rider ? `${riderCards.get(rider.id)?.querySelector('p').textContent ?? 'Listening for work'}. Endurance ${Math.round((1-rider.fatigue)*100)} / 100. ${wellbeing?`Satisfaction ${Math.floor(wellbeing.satisfaction)} / ${wellbeing.max} · ${wellbeing.label}. ${wellbeing.effect} ${wellbeing.recovery}`:rider.lastDecision}` : 'Select a job or rider on the map.');
    return;
  }
  const state = jobState(game, d), waiting = d.status === 'waiting';
  if(!waiting || broadcastDraft?.jobId!==d.id)broadcastDraft=null;
  text('#contract-title', `Job ${d.id.toUpperCase()}`);
  text('#selected-stage', state.label); $('#selected-stage').dataset.state = state.id;
  text('#selected-owner', game.courierById(d.courierId)?.name ?? '');
  for (const step of document.querySelectorAll('[data-step]')) {
    step.dataset.current = String(Number(step.dataset.step) === state.step);
    step.dataset.done = String(Number(step.dataset.step) < state.step);
    if (Number(step.dataset.step) === state.step) step.setAttribute('aria-current', 'step');
    else step.removeAttribute('aria-current');
  }
  $('#job-actions').hidden = !waiting || game.gameOver;
  $('#job-outcome').hidden = !state.terminal || game.gameOver || !game.activeDeliveries().length;
  $('#next-job').disabled = game.gameOver || !game.activeDeliveries().length;
  const cargo = $('#selected-cargo');
  if (cargo.dataset.type !== d.type) {
    cargo.replaceChildren(createCargoIconElement(d.type, { className: 'cargo-icon', title: CARGO_FAMILIES[d.type].name }), document.createTextNode(CARGO_FAMILIES[d.type].name));
    cargo.dataset.type = d.type;
  }
  text('#selected-reward', `€${d.reward}`); text('#selected-pickup', d.pickupAddress); text('#selected-drop', d.dropoffAddress);
  text('#selected-time', state.terminal ? state.label : `${time(d.deadlineAt - game.elapsed)} until deadline`);
  text('#selected-distance', `${(d.plannedDistance / 100).toFixed(1)} km`);
  if(game.logistics){
    text('#selected-weight',`${d.weightKg} kg`);
    text('#delivery-window',d.deliverAfter>game.elapsed?`Pickup now · delivery opens in ${time(d.deliverAfter-game.elapsed)}`:'Pickup & delivery open now');
    $('#preferred-rider').value=d.preferredRiderId??'';
    const invited=game.courierById(d.preferredRiderId);
    text('#preference-effect',invited?.offDuty?`${invited.name} has finished for today. Choose another invitation; other riders can still volunteer.`:invited?`${invited.name} gets a personal invitation. Others can still volunteer.`:'Give one rider extra reason to choose this offer.');
  }
  const regionName=id=>game.districts.find(r=>r.id===id)?.name??id;
  text('#selected-regions',`${regionName(d.pickupDistrict)} → ${regionName(d.dropoffDistrict)}`);
  const handling=game.handoffTime(d);
  text('#selected-handling', CARGO_FAMILIES[d.type].detail+(game.refined?` Stops: ${handling.pickup}s collection + ${handling.dropoff}s handover.`:''));
  const advice = estimates.get(d.id);
  const rider = game.courierById(d.courierId);
  let explanation = state.terminal ? state.detail : rider ? `${rider.name} volunteered · ~${time(game.logistics?game.jobETA(rider,d):game.courierETA(rider))} to finish. ${state.detail}` : state.detail;
  if (advice) explanation = `${advice.label}${Number.isFinite(advice.finishIn) ? ` · ~${time(advice.finishIn)} to finish` : ''}. ${advice.detail}`;
  text('#selected-state', advice ? `${advice.label}${Number.isFinite(advice.finishIn) ? ` · ~${time(advice.finishIn)} to finish` : ''}` : explanation);
  $('#selected-state').title = explanation;
  text('#timing-detail', explanation);
  const tour=game.logistics&&d.status==='claimed'&&rider&&game.riderTour?game.riderTour(rider):null;
  $('#accepted-tour').hidden=!tour?.feasible;
  if(tour?.feasible){
    renderItinerary($('#accepted-tour'),tour.itinerary,d);
    const next=tour.itinerary[0];
    text('#accepted-next-stop',next?`Next: ${next.kind==='pickup'?'pickup':'delivery'} ${next.jobId.toUpperCase()} · ~${time(next.doneIn)}`:'Tour complete');
  }
  $('#selected-state').dataset.state = advice?.state ?? state.id;
  text('#offer-instruction', d.called ? 'On the radio' : 'Make an offer');
  text('#radio-effect', broadcastDraft?'':d.called?CHANNEL_EFFECTS[d.channel]:'Click once to preview · again to broadcast');
  $('#radio-effect').hidden=Boolean(broadcastDraft);
  for (const button of document.querySelectorAll('[data-radio]')) {
    const channel = button.dataset.radio, cost = channel === 'priority' ? 2 : 1;
    button.disabled = game.gameOver || d.status !== 'waiting' || game.radioUsed() - game.radioCost(d) + cost > game.radioSlots;
    button.title = button.disabled && d.status === 'waiting' ? `${channel.toUpperCase()} needs ${cost} ${cost === 1 ? 'slot' : 'slots'}. Withdraw another call to make room.` : CHANNEL_EFFECTS[channel];
    button.setAttribute('aria-pressed', String(d.called && d.channel === channel));
    const previewing=broadcastDraft?.channel===channel;
    button.dataset.preview=String(previewing);
    setWithin(button,'strong',previewing?'Confirm ↗':{open:'All riders',local:'Nearby',priority:'Priority'}[channel]);
    const name = {open:'Broadcast OPEN to all riders',local:'Broadcast LOCAL to nearby riders',priority:'Broadcast PRIORITY for more attention'}[channel];
    button.setAttribute('aria-label', `${previewing?'Confirm: ': 'Preview: '}${name} · ${cost} ${cost===1?'slot':'slots'}${d.called&&d.channel===channel?' · on air':''}`);
  }
  renderBroadcastPreview(d);
  $('#withdraw').hidden = !d.called || d.status !== 'waiting';
  $('#bonus').disabled = game.gameOver || d.status !== 'waiting' || d.sweetened || game.cash < 5;
  text('#bonus', d.sweetened ? '€5 courier bonus paid' : 'Offer €5 courier bonus');
  text('#bonus-explanation', d.sweetened ? `Paid once. The client fee stays €${d.reward}.` : game.cash < 5 ? `You need €5 cash; you have €${game.cash}.` : `Costs €5 now, even if delivery fails. The client fee stays €${d.reward}.`);
  const extension=game.extensionOffer(d);
  $('#client-call').disabled=!extension.available;
  text('#client-call',d.extended?'Client extension agreed':extension.available?`Ask for +${Math.round(extension.seconds)}s · fee −€${extension.fee}`:'Call client for more time');
  text('#client-call-detail',d.extended?`+${Math.round(d.deadlineAdded??0)}s agreed; fee reduced by €${d.feeConcession??0}.`:extension.available?`One time. Fee €${d.reward} → €${extension.newReward}. More time, less pay; no rider is assigned.`:extension.reason);
  $('#decision-details').hidden=d.status!=='waiting';
  if($('#decision-details').open&&d.status==='waiting')renderDecisions(d);
}

function renderBroadcastPreview(d) {
  const panel=$('#broadcast-preview');panel.hidden=!broadcastDraft;
  if(!broadcastDraft)return;
  const forecast=forecastBroadcast(game,d,broadcastDraft.channel);
  const row=forecast.rows.find(item=>item.rider.id===forecast.rider?.id);
  const changed=previewKey(d,broadcastDraft.channel,forecast)!==broadcastDraft.key;
  panel.dataset.changed=String(changed);
  panel.style.setProperty('--courier',forecast.rider?.color??'#9e684a');
  text('#forecast-rider',forecast.rider?`${forecast.rider.name} · ${bikeVisual(forecast.rider).label}`:'No likely volunteer');
  const mode={'on the way':'Along the way',next:'After current work',ready:'Next pickup',direct:'Next pickup'}[row?.mode];
  const consequences=forecast.rider&&game.offerConsequences?game.offerConsequences(forecast.rider,d):null;
  text('#forecast-detail',consequences?.feasible?`Estimated outcome · ${mode??'Next pickup'} · ~${time(consequences.finishIn)} to deliver. ${forecast.cost} ${forecast.cost===1?'slot':'slots'} until accepted.`:`${row?.reason??forecast.reason??'Riders compare all live offers.'}${Number.isFinite(row?.finishIn)?` · ~${time(row.finishIn)} to deliver`:''}. ${broadcastDraft.channel==='priority'?'2 slots':'1 slot'} until accepted.`);
  renderConsequences($('#forecast-consequences'),consequences?{...consequences,appealReasons:row?.appealReasons??consequences.appealReasons}:null,d);
  text('#forecast-confirm',changed?'The outlook changed. Click again to review it.':forecast.rider?'Click the same option again to broadcast. Riders still choose.':'Broadcasting will not make an unsuitable route fit.');
}

function renderConsequences(root,consequences,offeredJob) {
  root.hidden=!consequences?.feasible;
  if(root.hidden)return;
  const c=consequences, rounded=n=>Number.isFinite(n)?String(Math.round(n*10)/10):'—', signed=n=>`${n<0?'−':'+'}${time(Math.abs(n))}`;
  setWithin(root,'.appeal-reasons',(c.appealReasons??[]).join(' · '));
  setWithin(root,'[data-impact="margin"]',`${time(Math.abs(c.margin))} ${c.margin>=0?'spare':'late'}`);
  root.querySelector('[data-impact="margin"]').dataset.tight=String(c.margin<15);
  setWithin(root,'[data-impact="endurance"]',`${Math.round(c.endurance.current)} → ${Math.round(c.endurance.projected)} / ${c.endurance.max}`);
  setWithin(root,'[data-impact="load"]',`${rounded(c.load.currentKg)} → ${rounded(c.load.peakKg)} / ${rounded(c.load.capacityKg)} kg`);
  setWithin(root,'[data-impact="tour"]',c.baselineTourSeconds>0?signed(c.addedTourSeconds):`${time(c.tourSeconds)} total`);
  setWithin(root,'[data-impact-label="tour"]',c.baselineTourSeconds>0?'Tour time change':'New tour time');
  const commitments=c.commitments??[], shifted=commitments.filter(item=>Math.abs(item.delaySeconds)>=.5);
  setWithin(root,'.commitment-impact',shifted.length?`Existing work: ${shifted.map(item=>`${item.jobId.toUpperCase()} ${signed(item.delaySeconds)}`).join(' · ')}. All still fit.`:commitments.length?'Existing deliveries keep their timing.':'No other deliveries on this tour.');
  root.querySelector('.commitment-impact').hidden=!commitments.length;
  renderItinerary(root,c.itinerary,offeredJob);
}

function renderItinerary(root,itinerary,selectedJob) {
  const list=root.querySelector('.itinerary-stops'),rounded=n=>Number.isFinite(n)?String(Math.round(n*10)/10):'—';
  const steps=(itinerary??[]).map(stop=>{
    const job=game.deliveryById(stop.jobId),pickup=stop.kind==='pickup';
    return {...stop,label:pickup?'Pickup':'Delivery',address:stop.address??(pickup?job?.pickupAddress:job?.dropoffAddress)??'',arrival:time(stop.arrivalIn),wait:Math.ceil(stop.waitSeconds??0),done:time(stop.doneIn)};
  });
  setWithin(root,'.stop-count',`${steps.length} stops`);
  const signature=JSON.stringify(steps);
  if(list.dataset.signature!==signature){
    list.dataset.signature=signature;list.replaceChildren();
    for(const stop of steps){
      const li=document.createElement('li');li.dataset.job=stop.jobId;li.dataset.kind=stop.kind;li.dataset.offered=String(stop.jobId===selectedJob.id);
      const marker=document.createElement('span');marker.className='stop-marker';marker.textContent=stop.kind==='pickup'?'P':'D';marker.setAttribute('aria-hidden','true');
      const info=document.createElement('span');info.className='stop-info';
      const title=document.createElement('strong');title.textContent=`${stop.label} ${stop.jobId.toUpperCase()}`;
      const address=document.createElement('small');address.textContent=stop.address;
      info.append(title,address);
      if(stop.wait>0){const wait=document.createElement('small');wait.className='stop-wait';wait.textContent=`Wait ${time(stop.wait)} for delivery window`;info.append(wait);}
      const timing=document.createElement('span');timing.className='stop-time';timing.textContent=`~${stop.done}`;timing.title=`Arrive in ${stop.arrival} · finish stop in ${stop.done} · carry ${rounded(stop.loadAfterKg)} kg afterwards`;
      li.append(marker,info,timing);list.append(li);
    }
  }
}

function previewOrBroadcast(channel) {
  const d=game?.deliveryById(game.selectedDeliveryId);
  if(!d||d.status!=='waiting'||game.gameOver)return;
  const forecast=forecastBroadcast(game,d,channel),key=previewKey(d,channel,forecast);
  if(broadcastDraft?.key===key){act({type:'radio',jobId:d.id,channel});return;}
  broadcastDraft={jobId:d.id,channel,key};
  renderSelection();
  $('#broadcast-preview').scrollIntoView({block:'nearest',behavior:'instant'});
}

function renderDecisions(d) {
  if(game.logistics){
    const forecast=game.broadcastForecast(d,broadcastDraft?.channel??d.channel??'open');
    const outlook=$('#rider-outlook');
    if(!outlook.children.length)for(const c of game.couriers){
      const row=document.createElement('div');row.className='outlook-row';row.innerHTML='<strong></strong><span></span><small></small><button class="inspect-rider" type="button"></button>';row.style.setProperty('--courier',c.color);
      row.querySelector('button').addEventListener('click',event=>{const id=event.currentTarget.dataset.rider;inspectedRiderId=inspectedRiderId===id?null:id;const selected=game.deliveryById(game.selectedDeliveryId);if(selected)renderDecisions(selected);if(inspectedRiderId)$('#rider-comparison').scrollIntoView({block:'nearest',behavior:'instant'});});outlook.append(row);
    }
    forecast.rows.forEach((row,i)=>{
      const el=outlook.children[i];el.style.setProperty('--courier',row.rider.color);el.dataset.state=row.eligible?'possible':'pass';setWithin(el,'strong',row.rider.name);setWithin(el,'span',row.reason);setWithin(el,'small',Number.isFinite(row.finishIn)?`~${time(row.finishIn)} to finish · ${row.margin>=0?`${time(row.margin)} buffer`:`${time(-row.margin)} late`}`:'Cannot fit this offer now');
      const button=el.querySelector('.inspect-rider');button.dataset.rider=row.rider.id;button.textContent=inspectedRiderId===row.rider.id?'Close route':'Inspect route';button.setAttribute('aria-pressed',String(inspectedRiderId===row.rider.id));button.setAttribute('aria-label',`${inspectedRiderId===row.rider.id?'Close':'Inspect'} ${row.rider.name}'s estimated route`);button.setAttribute('aria-controls','rider-comparison');
    });
    const inspected=game.courierById(inspectedRiderId),comparison=$('#rider-comparison');comparison.hidden=!inspected;
    if(inspected){
      const c=game.offerConsequences?.(inspected,d);comparison.style.setProperty('--courier',inspected.color);
      text('#comparison-rider',`${inspected.name} · estimated outcome`);text('#comparison-reason',c?.feasible?'If this rider volunteers. Inspecting does not send an invitation.':c?.reason??'No feasible route now.');
      const row=forecast.rows.find(item=>item.rider.id===inspected.id);
      renderConsequences($('#comparison-consequences'),c?{...c,appealReasons:row?.appealReasons??c.appealReasons}:null,d);
    }
    $('#channel-effects').replaceChildren();
    return;
  }
  $('#rider-comparison').hidden=true;
  const brief=decisionBrief(game,d,feasibility.get(d.id));if(!brief)return;
  const outlook=$('#rider-outlook');
  if(!outlook.children.length)for(const c of game.couriers){const row=document.createElement('div');row.className='outlook-row';row.innerHTML='<strong></strong><span></span><small></small>';row.style.setProperty('--courier',c.color);outlook.append(row);}
  brief.rows.forEach((row,i)=>{const el=outlook.children[i];el.dataset.state=row.state;setWithin(el,'strong',row.rider.name);setWithin(el,'span',row.detail);setWithin(el,'small',Number.isFinite(row.finishIn)?`~${time(row.finishIn)} to finish · ${row.margin>=0?`${time(row.margin)} buffer`:`${time(-row.margin)} late`}`:'No finish within the estimate window');});
  const effects=$('#channel-effects');if(!effects.children.length)for(const channel of brief.channels){const p=document.createElement('p');p.innerHTML='<strong></strong><span></span>';effects.append(p);}
  brief.channels.forEach((channel,i)=>{const el=effects.children[i];setWithin(el,'strong',`${channel.id.toUpperCase()} · ${channel.eligible} ready ${channel.eligible===1?'rider':'riders'} can consider`);setWithin(el,'span',channel.detail);});
}
$('#decision-details').addEventListener('toggle',()=>{if($('#decision-details').open){const d=game?.deliveryById(game.selectedDeliveryId);if(d?.status==='waiting')renderDecisions(d);}});
$('#desk-focus').addEventListener('click',()=>{const {job:id,rider:riderId}=$('#desk-focus').dataset;if(id&&game.deliveryById(id))select(id);else if(riderId){const rider=game.courierById(riderId);if(rider)openRiderWellbeing(rider);}});

function showReview() {
  const review = game.shiftReview(), success = review.outcome === 'success', teamLeft=review.outcome==='team-left';
  $('#review-dialog').dataset.outcome=review.outcome;
  text('#result-label', success ? 'A GOOD DAY ON THE DESK' : 'EVERY SHIFT TEACHES SOMETHING');
  text('#result-title', success ? 'You kept Berlin moving.' : teamLeft?'The team called it a day.':review.outcome === 'collapse' ? 'The desk lost its rhythm.' : 'Close the desk. Try again.');
  text('#result-description', `${review.completed} of ${review.target} target deliveries. ${success ? 'The team made it through with reputation to spare.' : teamLeft?`Every rider signed off after waiting too long without work. The shift ends here with ${review.unserved} ${review.unserved===1?'offer':'offers'} left unserved. A new shift brings the full team back.`:'A fresh attempt gives you the same opening and another chance to read the city.'}`);
  const stats = $('#result-stats'); stats.replaceChildren();
  const results=[[review.completed, 'Delivered'], [review.failed, 'Missed deadlines'], ...(teamLeft?[[review.unserved,'Unserved offers']]:[]), [`€${review.profit}`, 'Net earned']];
  for (const [value, label] of results) {
    const box = document.createElement('div'), strong = document.createElement('strong'), small = document.createElement('small');
    strong.textContent = value; small.textContent = label; box.append(strong, small); stats.append(box);
  }
  text('#result-rider', `${review.topRider} completed ${review.topDeliveries} deliveries.`);
  text('#result-flow', `Best flow: ${game.bestChain} deliveries in a row without a miss.`+(game.refined?` ${review.clientExtensions} client extensions · €${review.feesConceded} in fee concessions · €${review.bonusesPaid} in bonuses.`:''));
  text('#result-lesson', teamLeft?'Watch who is between tours. Offer suitable work across the team, and consider a personal invitation before a waiting rider loses patience. Only actual acceptance cancels a departure warning.':review.lesson);
  const timeline = $('#result-timeline'); timeline.replaceChildren();
  for (const entry of game.dispatchLog.filter(e => ['claim', 'complete', 'fail', 'event-start', 'event-end', 'upgrade', 'rider-restless', 'rider-warning', 'rider-recovered', 'rider-left'].includes(e.action)).slice(-12)) {
    const li = document.createElement('li');
    const descriptions = { claim: `${entry.rider} took ${entry.deliveryId?.toUpperCase()}`, complete: `${entry.rider} delivered ${entry.deliveryId?.toUpperCase()}`, fail: `${entry.deliveryId?.toUpperCase()} missed · ${entry.kind?.replaceAll('-', ' ')}`, 'event-start': `Roadworks on ${entry.place}`, 'event-end': `${entry.place} cleared`, upgrade: entry.upgrade, 'rider-restless':`${entry.rider} grew restless`, 'rider-warning':`${entry.rider} warned they would leave after ${Math.ceil(entry.leaveIn??20)} more seconds waiting`, 'rider-recovered':`${entry.rider} recovered satisfaction through ${entry.reason==='completed'?'delivery':'accepted work'}`, 'rider-left':`${entry.rider} finished for today` };
    li.textContent = `${time(entry.at)} — ${descriptions[entry.action]}`; timeline.append(li);
  }
  $('#review-dialog').showModal();
}

function render() {
  const end = game.config.arrivals + game.config.closing, phase = game.phase();
  const status = deskState(game);
  text('#desk-state', status.label); $('#desk-state').dataset.state = status.id;
  text('#reputation', Math.ceil(game.reputation)); $('#rep-meter').value = game.reputation;
  text('#cash', `€${game.cash}`); text('#radio-count', `${game.radioUsed()} / ${game.radioSlots}`);
  const freeSlots = game.radioSlots - game.radioUsed();
  text('#radio-hint', freeSlots === 0 ? 'Radio full. Withdraw a call or wait for a volunteer.' : `${freeSlots} ${freeSlots === 1 ? 'slot' : 'slots'} free`);
  $('#radio-hint').dataset.full = String(freeSlots === 0);
  text('#phase-name', phase.label); text('#phase-detail', status.detail);
  $('.shift-context').title = status.detail;
  const demand=game.demandRegion();
  text('#demand-region',game.closing?'Finishing the queue':game.capacityDemand?'Work follows riders with room':`Demand favors ${demand.name}`);
  text('#flow-count',game.cleanChain>1?`${game.cleanChain} clean deliveries in a row`:'');
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
  text('#seed-label', game.mode === 'training' ? '3-minute first shift' : '9-minute full shift');
  text('#session-identity', `Shift ${game.seed} · ${game.ruleset}`);
  const introductoryNotice = game.notice === 'Choose a contract. Put it on the radio. Let a courier decide.';
  text('#notice', !introductoryNotice && game.elapsed <= game.noticeUntil ? game.notice : '');
  const ev = game.currentEvent;
  $('#event-banner').hidden = !ev;
  if (ev) {
    text('#event-state', ev.state === 'forecast' ? 'ROADWORKS AHEAD' : 'SLOWER STREET');
    text('#event-place', ev.place); text('#event-time', ev.state === 'forecast' ? `Starts in ${time(ev.startsAt - game.elapsed)}` : `Clears in ${time(ev.endsAt - game.elapsed)}`);
  }
  $('#coach-panel').hidden = game.mode !== 'training' || game.completed >= 3;
  if (game.mode === 'training') {
    const first = game.deliveries[0];
    text('#coach', game.completed > 0 ? 'First delivery done. Select another job. Nearby favors close pickups; Priority uses two radio slots for attention.' : first.status === 'failed' ? 'The first deadline passed. Select another job and compare its finish estimate before broadcasting.' : first.status === 'claimed' ? `${game.courierById(first.courierId).name} chose the job. Watch the pickup, then the delivery. You shape the call; the rider chooses.` : first.called ? 'Your call is on air. Start or resume the clock at the top, and watch a courier volunteer.' : 'Click All riders to preview a volunteer, then click Confirm to broadcast. Start shift at the top.');
  }
  estimates.clear();feasibility.clear();
  for (const d of game.activeDeliveries()) if (d.status === 'waiting') {const value=game.deliveryFeasibility(d);feasibility.set(d.id,value);estimates.set(d.id,timingAdvice(value));}
  renderQueue(); renderTeam(); renderSelection();
  if (game.upgradePending && !dialogs.some(id => $(id).open)) {
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
  // The simulation caps its log at 300 entries; an array-length cursor stalls
  // when old entries roll off. Object identity keeps presentation on new events.
  const events = game.dispatchLog.slice(lastLog?game.dispatchLog.indexOf(lastLog)+1:0);
  lastLog = game.dispatchLog.at(-1)??null;
  radioDesk.observe(game,events);
  $('.map-surface').classList.toggle('radio-speaking',Boolean(radioDesk.current));
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
      audio.cue(name,{jobId:job?.id,rider:event.rider,cargo:job?.type,mode:event.mode,pan:soundPan(point),success:game.outcome==='success'});
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

document.querySelectorAll('[data-radio]').forEach(button => button.addEventListener('click', () => previewOrBroadcast(button.dataset.radio)));
$('#cancel-preview').addEventListener('click',()=>{broadcastDraft=null;renderSelection();});
$('#preferred-rider').addEventListener('change',event=>act({type:'prefer',jobId:game.selectedDeliveryId,riderId:event.target.value||null}));
$('#next-job').addEventListener('click', () => {
  const next = game.activeDeliveries().find(d => d.status === 'waiting') ?? game.activeDeliveries()[0];
  if (next) select(next.id);
});
$('#withdraw').addEventListener('click', () => act({ type: 'radio', jobId: game.selectedDeliveryId, channel: 'off' }));
$('#bonus').addEventListener('click', () => act({ type: 'bonus', jobId: game.selectedDeliveryId }));
$('#client-call').addEventListener('click', () => act({ type: 'client-call', jobId: game.selectedDeliveryId }));
$('#pause').addEventListener('click', () => act({ type: 'pause', paused: !game.paused }));
$('#speed').addEventListener('click', () => act({ type: 'speed', speed: game.speed === 1 ? 2 : 1 }));
function setSound(enabled){sound=audio.setEnabled(enabled);text('#sound',sound?'Sound on':'Sound off');$('#sound').setAttribute('aria-pressed',String(sound));text('#studio-toggle',sound?'Mute sound':'Enable sound');text('#sound-status',enabled&&!sound?'Audio is unavailable in this browser. The desk remains fully playable.':sound?'Sound on. Rider previews and event cues use the same original score.':'Muted. Every event is still shown visually.');}
$('#sound').addEventListener('click',()=>setSound(!sound));
$('#open-sound-studio').addEventListener('click',()=>{soundWasPaused=game.paused;act({type:'pause',paused:true});$('#sound-dialog').showModal();});
$('#dismiss-radio').addEventListener('click',()=>{radioDesk.dismiss();$('.map-surface').classList.remove('radio-speaking');});
$('#radio-job').addEventListener('click',()=>{if(radioDesk.current?.jobId)select(radioDesk.current.jobId);else if(radioDesk.current?.riderId)riderCards.get(radioDesk.current.riderId)?.querySelector('.rider-locate').click();});
function closeRiderWellbeing(){$('#rider-wellbeing-dialog').close();act({type:'pause',paused:wellbeingWasPaused});}
$('#close-rider-wellbeing').addEventListener('click',closeRiderWellbeing);
$('#rider-wellbeing-dialog').addEventListener('cancel',event=>{event.preventDefault();closeRiderWellbeing();});
$('#open-radio-log').addEventListener('click',()=>{radioWasPaused=game.paused;act({type:'pause',paused:true});radioDesk.renderLog();$('#radio-log-dialog').showModal();});
function closeRadioLog(){$('#radio-log-dialog').close();act({type:'pause',paused:radioWasPaused});}
$('#close-radio-log').addEventListener('click',closeRadioLog);
$('#radio-log-dialog').addEventListener('cancel',event=>{event.preventDefault();closeRadioLog();});
function closeSound(){$('#sound-dialog').close();act({type:'pause',paused:soundWasPaused});}
$('#close-sound').addEventListener('click',closeSound);$('#sound-dialog').addEventListener('cancel',event=>{event.preventDefault();closeSound();});
$('#studio-toggle').addEventListener('click',()=>setSound(!sound));
$('#sound-volume').addEventListener('input',event=>audio.setVolume(Number(event.target.value)/100));
$('#sound-mix').addEventListener('change',event=>audio.setMix(event.target.value));
$('#task-rhythms').addEventListener('change',event=>audio.setRhythms(event.target.checked));
document.querySelectorAll('[data-rhythm]').forEach(button=>button.addEventListener('click',()=>{setSound(true);audio.previewRhythm(Number(button.dataset.rhythm));}));
document.querySelectorAll('[data-listen]').forEach(button=>button.addEventListener('click',()=>{setSound(true);audio.cancel();audio.cue('rider',{rider:button.dataset.listen});}));
// Keep secondary controls out of the working desk, without hover-only navigation.
const deskMenu = $('#desk-menu');
deskMenu.addEventListener('click', event => {
  if (event.target.closest('button')) deskMenu.open = false;
});
document.addEventListener('pointerdown', event => {
  if (!deskMenu.contains(event.target)) deskMenu.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && deskMenu.open) {
    deskMenu.open = false;
    deskMenu.querySelector('summary').focus();
    event.stopPropagation();
  }
});
$('#new-shift').addEventListener('click', () => { act({ type: 'pause', paused: true }); $('#continue-shift').hidden = false; $('#resume-saved').hidden=true; $('#intro').showModal(); });
$('#continue-shift').addEventListener('click', () => $('#intro').close());
$('#shift-length').addEventListener('change', () => { $('#prepare-shift').dataset.start = $('#shift-length').value; });
$('#prepare-shift').addEventListener('click', () => {
  saveEnabled=true;
  const seed = game.tick === 0 ? game.seed : createSeed(); begin($('#shift-length').value, seed);
  saveShift();
  if (sound) {audio.ensure();audio.cue('start');}
});
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
$('#fit-map').addEventListener('click', () => { renderer.resetView(); $('#region-view').value=''; renderer.focusRegionId=null; renderer.draw(true); });
$('#region-view').addEventListener('change',event=>{
  const region=city.regions.find(r=>r.id===event.target.value);
  renderer.focusRegionId=region?.id??null;
  if(region)renderer.focusBounds(region.bounds);else renderer.resetView();
  renderer.draw(true);render();
});
function focusContract(d) {
  $('#region-view').value='route';renderer.focusRegionId=null;
  const rider=game.courierById(d.courierId);
  const route=game.routeBetween(d.pickupId,d.dropoffId);
  const points=route.map(id=>game.nodeById(id));
  if(rider){points.push(rider);if(rider.deliveryId===d.id)for(const id of rider.path.slice(rider.pathIndex))points.push(game.nodeById(id));}
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
    else if (hit?.type === 'courier') {
      game.selectedCourierId = hit.id;
      game.selectedDeliveryId = game.courierById(hit.id)?.deliveryId ?? null;
      render();
    }
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
  if (event.key === '0') $('#fit-map').click();
  if (event.key === 'Escape') { game.selectedDeliveryId = game.selectedCourierId = null; render(); }
});
document.addEventListener('visibilitychange', () => {
  if (!game) return;
  accumulator = 0; lastTime = performance.now();
  if (document.hidden) { act({ type: 'pause', paused: true }); saveShift();audio.suspend(); }
  else { game.flash('The desk paused while you were away. Resume when ready.', 8); render(); }
});
window.addEventListener('pagehide', () => { game?.dispatch({ type: 'pause', paused: true });saveShift(); });
window.addEventListener('send-it:pause-and-save',()=>{if(!game)return;act({type:'pause',paused:true});saveShift();audio.suspend();});
const params = new URLSearchParams(location.search);
try {
  const inner=params.get('city')==='inner-ring';
  text('#loading-detail',inner?'Loading the Inner Ring street map.':'Loading Berlin’s complete street map. The first visit may take a moment.');
  city=await (inner?loadInnerRing:loadBerlinCity)({signal:AbortSignal.timeout(120000)});
  text('#scope-name',inner?'⌁ BERLIN · INNER RING':'⌁ BERLIN · FULL CITY');
  text('#scope-eyebrow',inner?'BERLIN / INNER RING':'BERLIN / FULL CITY');
  text('#map-credits',inner?'© OpenStreetMap · Berlin Open Data':'Berlin Open Data');
  $('#map-credits').title = 'Map sources, attribution and accuracy';
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
  $('#shift-length').value = Object.hasOwn(SHIFT_MODES, params.get('mode')) ? params.get('mode') : 'training';
  $('#prepare-shift').dataset.start = $('#shift-length').value;
  begin(Object.hasOwn(SHIFT_MODES, params.get('mode')) ? params.get('mode') : 'training', params.get('seed') || createSeed());
  try {const record=JSON.parse(localStorage.getItem(`send-it:shift:${city.metadata.id}`));if(record?.city===city.metadata.id&&record.ticks>0&&!record.review?.outcome){savedRecord=record;$('#resume-saved').hidden=false;text('#resume-saved',`Resume saved ${record.mode==='training'?'first shift':'Berlin shift'} · paused`);}}catch{}
  $('#map-loading').hidden=true;$('#intro').showModal();requestAnimationFrame(frame);
} catch(error) {
  console.error('Berlin map startup failed',error);
  $('#map-loading').hidden=true;
  $('#fatal-error').hidden=false;
  $('#fatal-message').textContent='The Berlin map could not load. Check your connection and reload; this desk needs its local city data.';
}
