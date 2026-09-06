import { BerlinPlaytest, CARGO_FAMILIES, FIXED_STEP, SHIFT_MODES } from './game-berlin-playtest.js';
import { Renderer } from './render.js';
import { createSeed } from './rng.js';
import { createCargoIconElement } from './cargo-icons.js';
import { createRiderPortraitElement } from './rider-identity.js';
import { audio } from './audio-engine.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#game-canvas');
const cards = new Map(), riderCards = new Map();
const time = seconds => { const n = Math.max(0, Math.ceil(seconds)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const text = (selector, value) => { const el = $(selector), next = String(value); if (el.textContent !== next) el.textContent = next; };
const dialogs = ['#intro', '#help-dialog', '#upgrade-dialog', '#review-dialog'];
let game, renderer, lastTime = performance.now(), accumulator = 0, lastUI = 0, lastLog = 0;
let sound = false, faulted = false, helpWasPaused = true, pointer = null;
audio.enabled = false;

function begin(mode, seed = createSeed()) {
  dialogs.forEach(id => { if ($(id).open) $(id).close(); });
  renderer?.dispose();
  game = new BerlinPlaytest({ seed, mode });
  renderer = new Renderer(canvas, game, { nativeMap: false, minimumMapBand: 'district' });
  cards.clear(); riderCards.clear();
  $('#work-list').replaceChildren(); $('#team-list').replaceChildren();
  lastLog = accumulator = 0; lastTime = performance.now(); faulted = false;
  const url = new URL(location.href);
  url.searchParams.set('seed', seed); url.searchParams.set('mode', mode);
  history.replaceState({}, '', url);
  render(true);
  renderer.draw(true);
}

function act(action) {
  const changed = game.dispatch(action);
  if (changed && sound) {
    audio.ensure();
    if (action.type === 'radio') audio.cue(`call-${action.channel}`);
    if (action.type === 'bonus') audio.cue('tool-sweeten');
  }
  render();
  return changed;
}

function newCard(d) {
  const card = document.createElement('article');
  card.className = 'job-card'; card.dataset.job = d.id;
  card.innerHTML = '<button class="job-select"><span class="job-top"><span class="job-family"></span><strong class="job-fee"></strong></span><span class="job-address"><small>P</small><span class="job-pickup"></span></span><span class="job-address"><small>D</small><span class="job-drop"></span></span><span class="job-meta"><span class="job-distance"></span><span class="job-time"></span></span></button><div class="job-action-row"><span class="job-status"></span><button class="quick-call">Broadcast OPEN</button></div>';
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
    setWithin(card, '.job-status', claimed ? `${rider?.name ?? 'Courier'} is on it` : d.called ? `${d.channel.toUpperCase()} on air` : 'Off the radio');
    const button = card.querySelector('.quick-call');
    button.hidden = claimed;
    button.disabled = game.gameOver || (!d.called && game.radioUsed() >= game.radioSlots);
    button.textContent = d.called ? 'Withdraw call' : 'Broadcast OPEN';
    button.setAttribute('aria-label', `${d.called ? 'Withdraw' : 'Broadcast OPEN for'} ${d.id.toUpperCase()}`);
    card.querySelector('.job-select').setAttribute('aria-label', `Inspect ${d.id.toUpperCase()}: ${d.pickupAddress} to ${d.dropoffAddress}, €${d.reward}`);
  }
  text('#work-count', jobs.length);
  $('#empty-queue').hidden = jobs.length > 0;
}

function renderTeam() {
  for (const rider of game.couriers) {
    let card = riderCards.get(rider.id);
    if (!card) {
      card = document.createElement('article'); card.className = 'rider';
      card.append(createRiderPortraitElement(rider));
      const content = document.createElement('div');
      content.innerHTML = '<div class="rider-head"><strong></strong><span></span></div><p></p><meter min="0" max="100"></meter>';
      card.append(content); $('#team-list').append(card); riderCards.set(rider.id, card);
    }
    const job = game.deliveryById(rider.deliveryId);
    setWithin(card, 'strong', rider.name);
    setWithin(card, '.rider-head span', rider.phase === 'break' ? `Rest ${time(game.breakRemaining(rider))}` : job ? `${job.id.toUpperCase()} · riding` : rider.deliberation ? 'Considering' : 'Listening');
    const preference = { sprinter: 'Likes short, urgent jobs', earner: 'Likes a worthwhile fee', local: 'Likes work in their district' };
    setWithin(card, 'p', preference[rider.personality.id]);
    card.title = `${rider.completed} delivered · ${rider.lastDecision}`;
    card.querySelector('meter').value = Math.round((1 - rider.fatigue) * 100);
    card.querySelector('meter').setAttribute('aria-label', `${rider.name} energy ${Math.round((1 - rider.fatigue) * 100)} percent`);
  }
}

function select(id) {
  game.selectedDeliveryId = id;
  game.selectedCourierId = null;
  render();
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
  text('#selected-handling', CARGO_FAMILIES[d.type].detail);
  const feasibility = d.status === 'waiting' ? game.deliveryFeasibility(d) : null;
  const rider = game.courierById(d.courierId);
  let explanation = rider ? `${rider.name} volunteered. ${rider.phase === 'pickup' ? 'Riding to the pickup.' : 'Cargo is on board.'}` : 'Couriers decide after they hear your call.';
  if (feasibility?.best) explanation = `Estimate ${time(feasibility.best.finishIn)} including pickup. ${feasibility.margin < 0 ? 'The deadline looks difficult.' : feasibility.margin < 18 ? 'A tight window.' : 'Couriers still choose.'}`;
  text('#selected-state', explanation);
  for (const button of document.querySelectorAll('[data-radio]')) {
    const channel = button.dataset.radio, cost = channel === 'priority' ? 2 : 1;
    button.disabled = game.gameOver || d.status !== 'waiting' || game.radioUsed() - game.radioCost(d) + cost > game.radioSlots;
    button.setAttribute('aria-pressed', String(d.called && d.channel === channel));
  }
  $('#withdraw').hidden = !d.called || d.status !== 'waiting';
  $('#bonus').disabled = game.gameOver || d.status !== 'waiting' || d.sweetened || game.cash < 5;
  text('#bonus', d.sweetened ? '€5 courier bonus paid' : 'Offer €5 courier bonus');
}

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
  text('#phase-name', phase.label); text('#phase-detail', phase.detail);
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
  $('#coach').hidden = game.mode !== 'training' || game.completed >= 3;
  if (game.mode === 'training') {
    const first = game.deliveries[0];
    text('#coach', game.completed > 0 ? 'First delivery done. Try LOCAL for nearby work. PRIORITY uses two radio slots when a job needs attention.' : first.status === 'claimed' ? `${game.courierById(first.courierId).name} chose the job. Watch the pickup, then the delivery. You shape the call; the rider chooses.` : first.called ? 'Your call is on air. Press Start shift or Resume if paused, and watch a courier volunteer.' : 'Your first call: select the light parcel and tap Broadcast OPEN. Start the shift when you are ready.');
  }
  renderQueue(); renderTeam(); renderSelection();
  if (game.upgradePending && !$('#upgrade-dialog').open && !$('#intro').open && !$('#help-dialog').open) {
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
  if (sound && !document.hidden) for (const event of events) {
    if (['complete', 'claim', 'pickup', 'fail', 'event-start', 'event-end', 'upgrade'].includes(event.action)) audio.cue(event.action);
  }
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
      if (now - lastUI > 125) { render(); lastUI = now; }
    }
  } catch (error) {
    faulted = true; game.paused = true; $('#fatal-error').hidden = false; throw error;
  }
}

document.querySelectorAll('[data-radio]').forEach(button => button.addEventListener('click', () => act({ type: 'radio', jobId: game.selectedDeliveryId, channel: button.dataset.radio })));
$('#withdraw').addEventListener('click', () => act({ type: 'radio', jobId: game.selectedDeliveryId, channel: 'off' }));
$('#bonus').addEventListener('click', () => act({ type: 'bonus', jobId: game.selectedDeliveryId }));
$('#pause').addEventListener('click', () => act({ type: 'pause', paused: !game.paused }));
$('#speed').addEventListener('click', () => act({ type: 'speed', speed: game.speed === 1 ? 2 : 1 }));
$('#sound').addEventListener('click', () => { sound = !sound; audio.enabled = sound; if (sound) audio.ensure(); text('#sound', sound ? 'Sound on' : 'Sound off'); $('#sound').setAttribute('aria-pressed', String(sound)); });
$('#new-shift').addEventListener('click', () => { act({ type: 'pause', paused: true }); $('#continue-shift').hidden = false; $('#intro').showModal(); });
$('#continue-shift').addEventListener('click', () => $('#intro').close());
document.querySelectorAll('[data-start]').forEach(button => button.addEventListener('click', () => {
  const seed = game.tick === 0 ? game.seed : createSeed(); begin(button.dataset.start, seed);
  if (sound) audio.ensure();
}));
$('#help').addEventListener('click', () => { helpWasPaused = game.paused; act({ type: 'pause', paused: true }); $('#help-dialog').showModal(); });
function closeHelp() { $('#help-dialog').close(); act({ type: 'pause', paused: helpWasPaused }); }
$('#close-help').addEventListener('click', closeHelp);
$('#help-dialog').addEventListener('cancel', event => { event.preventDefault(); closeHelp(); });
['#intro', '#upgrade-dialog', '#review-dialog'].forEach(id => $(id).addEventListener('cancel', event => event.preventDefault()));
$('#retry').addEventListener('click', () => begin(game.mode, game.seed));
$('#next-shift').addEventListener('click', () => begin(game.mode === 'training' ? 'standard' : game.mode));
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
canvas.addEventListener('wheel', event => { event.preventDefault(); const rect = canvas.getBoundingClientRect(); renderer.zoomAt(event.clientX - rect.left, event.clientY - rect.top, event.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
canvas.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0) return;
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 6) pointer.moved = true;
  if (pointer.moved) renderer.pan(event.clientX - pointer.x, event.clientY - pointer.y);
  pointer.x = event.clientX; pointer.y = event.clientY;
});
canvas.addEventListener('pointerup', event => {
  if (!pointer || pointer.id !== event.pointerId) return;
  if (!pointer.moved) {
    const rect = canvas.getBoundingClientRect(), p = renderer.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
    const hit = game.nearestEntity(p.x, p.y, 24 / renderer.scale);
    if (hit?.type === 'delivery') select(hit.id);
    else if (hit?.type === 'courier') { game.selectedCourierId = hit.id; render(); }
  }
  pointer = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointercancel', () => { pointer = null; });
canvas.addEventListener('lostpointercapture', () => { pointer = null; });
window.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target.closest?.('input,textarea,select,[contenteditable=true]') || dialogs.some(id => $(id).open)) return;
  if (event.key === ' ' && event.target.closest?.('button,a,summary')) return;
  if (event.key === ' ') { event.preventDefault(); act({ type: 'pause', paused: !game.paused }); }
  if (event.key === '+' || event.key === '=') zoom(1.2);
  if (event.key === '-') zoom(1 / 1.2);
  if (event.key === '0') { renderer.resetView(); renderer.draw(true); }
  if (event.key === 'Escape') { game.selectedDeliveryId = game.selectedCourierId = null; render(); }
});
document.addEventListener('visibilitychange', () => {
  accumulator = 0; lastTime = performance.now();
  if (document.hidden) { act({ type: 'pause', paused: true }); audio.ctx?.suspend(); }
  else { game.flash('The desk paused while you were away. Resume when ready.', 8); render(); }
});
window.addEventListener('pagehide', () => { game.dispatch({ type: 'pause', paused: true }); });
const params = new URLSearchParams(location.search);
begin(Object.hasOwn(SHIFT_MODES, params.get('mode')) ? params.get('mode') : 'training', params.get('seed') || createSeed());
$('#intro').showModal();
requestAnimationFrame(frame);
