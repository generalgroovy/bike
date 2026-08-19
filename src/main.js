import { Game, DELIVERY_TYPES } from './game.js';
import { createSeed } from './rng.js';
import { Renderer } from './render.js';

const FIXED_STEP = 1 / 60;
const canvas = document.querySelector('#game-canvas');
const stats = {
  score: document.querySelector('#score'),
  cash: document.querySelector('#cash'),
  rep: document.querySelector('#rep'),
  wave: document.querySelector('#wave'),
  seed: document.querySelector('#seed'),
  active: document.querySelector('#active-count'),
  trait: document.querySelector('#trait'),
  traitDesc: document.querySelector('#trait-desc'),
  surge: document.querySelector('#surge')
};
const deliveriesEl = document.querySelector('#deliveries');
const couriersEl = document.querySelector('#couriers');
const noticeEl = document.querySelector('#notice');
const upgradeModal = document.querySelector('#upgrade-modal');
const upgradeChoices = document.querySelector('#upgrade-choices');
const gameoverModal = document.querySelector('#gameover-modal');
const summaryEl = document.querySelector('#run-summary');
const bestEl = document.querySelector('#best-score');
const helpModal = document.querySelector('#help-modal');

let game;
let renderer;
let lastTime = performance.now();
let accumulator = 0;
let lastUiRender = 0;
let shownUpgradeAt = -1;

function openDialog(dialog) {
  dialog.hidden = false;
  if (dialog.open) return;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeDialog(dialog) {
  if (dialog.open && typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  dialog.hidden = true;
}

function currentSeed() {
  const raw = new URLSearchParams(location.search).get('seed');
  if (!raw) return createSeed();
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  return cleaned || createSeed();
}

function loadBestScore() {
  try { return Number(localStorage.getItem('bike.bestScore') || 0); }
  catch { return 0; }
}

function saveBestScore(value) {
  try { localStorage.setItem('bike.bestScore', String(value)); }
  catch { /* persistence is optional */ }
}

function start(seed = currentSeed()) {
  game = new Game({ seed });
  renderer = new Renderer(canvas, game);
  lastTime = performance.now();
  accumulator = 0;
  lastUiRender = 0;
  shownUpgradeAt = -1;
  closeDialog(upgradeModal);
  closeDialog(gameoverModal);
  closeDialog(helpModal);
  syncUrl(seed);
  renderUI();
}

function syncUrl(seed) {
  const url = new URL(location.href);
  url.searchParams.set('seed', seed);
  history.replaceState(null, '', url);
}

function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function renderUI() {
  stats.score.textContent = Math.round(game.score).toLocaleString();
  stats.cash.textContent = `€${game.cash}`;
  stats.rep.textContent = `${Math.round(game.reputation)}%`;
  stats.rep.dataset.level = game.reputation < 35 ? 'danger' : game.reputation < 65 ? 'warn' : 'good';
  stats.wave.textContent = game.wave;
  stats.seed.textContent = game.seed;
  stats.active.textContent = game.activeDeliveries().length;
  stats.trait.textContent = game.runTrait.title;
  stats.traitDesc.textContent = game.runTrait.desc;
  const hot = game.districts.find((district) => district.id === game.hotDistrictId);
  stats.surge.textContent = hot ? `SURGE · ${hot.name.toUpperCase()}` : '';
  noticeEl.textContent = game.elapsed <= game.noticeUntil ? game.notice : '';

  const active = game.activeDeliveries().sort((a, b) => a.deadlineAt - b.deadlineAt).slice(0, 10);
  deliveriesEl.innerHTML = active.map((delivery) => {
    const type = DELIVERY_TYPES[delivery.type];
    const remaining = delivery.deadlineAt - game.elapsed;
    const selected = game.selectedDeliveryId === delivery.id;
    const phase = delivery.pickedUp ? 'On bike' : delivery.status === 'assigned' ? 'Assigned' : 'Waiting';
    return `<button class="delivery-card ${selected ? 'selected' : ''}" data-delivery="${delivery.id}" style="--accent:${type.color}">
      <span class="glyph">${delivery.pickedUp ? '◎' : type.glyph}</span>
      <span><strong>${type.label}</strong><small>${phase} · €${delivery.reward}</small></span>
      <time class="${remaining < 12 ? 'urgent' : ''}">${formatTime(remaining)}</time>
    </button>`;
  }).join('') || '<p class="empty">City is quiet. For now.</p>';

  couriersEl.innerHTML = game.couriers.map((courier) => {
    const selected = game.selectedCourierId === courier.id;
    return `<button class="courier-card ${selected ? 'selected' : ''}" data-courier="${courier.id}" style="--accent:${courier.color}">
      <span class="courier-dot"></span>
      <span><strong>${courier.name}</strong><small>${courier.phase === 'idle' ? 'Available' : courier.phase === 'pickup' ? 'To pickup' : 'Delivering'}</small></span>
      <span class="status-pill ${courier.phase}">${courier.phase === 'idle' ? 'READY' : 'BUSY'}</span>
    </button>`;
  }).join('');
}

function showUpgrade() {
  if (!game.upgradePending || shownUpgradeAt === game.nextUpgradeAt) return;
  shownUpgradeAt = game.nextUpgradeAt;
  const choices = game.getUpgradeChoices();
  upgradeChoices.innerHTML = choices.map((upgrade) => `<button class="upgrade-card" data-upgrade="${upgrade.id}"><strong>${upgrade.title}</strong><span>${upgrade.desc}</span></button>`).join('');
  openDialog(upgradeModal);
}

function showGameOver() {
  const summary = game.summary();
  const best = Math.max(loadBestScore(), summary.score);
  saveBestScore(best);
  bestEl.textContent = best.toLocaleString();
  summaryEl.replaceChildren();
  const items = [
    [summary.score.toLocaleString(), 'Score'],
    [summary.completed, 'Delivered'],
    [summary.failed, 'Missed'],
    [summary.wave, 'Wave'],
    [`${summary.distanceKm} km`, 'Ridden'],
    [summary.seed, 'Seed']
  ];
  for (const [value, label] of items) {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = String(value);
    span.textContent = label;
    box.append(strong, span);
    summaryEl.append(box);
  }
  openDialog(gameoverModal);
}

function frame(now) {
  const frameDt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  accumulator += frameDt;
  let steps = 0;
  while (accumulator >= FIXED_STEP && steps < 15) {
    game.update(FIXED_STEP);
    accumulator -= FIXED_STEP;
    steps += 1;
  }
  if (steps === 15) accumulator = 0;
  renderer.draw();
  if (now - lastUiRender >= 100) {
    renderUI();
    lastUiRender = now;
  }
  showUpgrade();
  if (game.gameOver && !gameoverModal.open) showGameOver();
  requestAnimationFrame(frame);
}

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const point = renderer.screenToWorld(event.clientX - rect.left, event.clientY - rect.top);
  const entity = game.nearestEntity(point.x, point.y, 24 / renderer.scale);
  if (!entity) return;
  if (entity.type === 'delivery') game.selectDelivery(entity.id);
  if (entity.type === 'courier') game.selectCourier(entity.id);
  renderUI();
});

deliveriesEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delivery]');
  if (button) { game.selectDelivery(button.dataset.delivery); renderUI(); }
});

couriersEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-courier]');
  if (button) { game.selectCourier(button.dataset.courier); renderUI(); }
});

upgradeChoices.addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade]');
  if (!button) return;
  game.applyUpgrade(button.dataset.upgrade);
  closeDialog(upgradeModal);
  renderUI();
});

document.querySelector('#pause').addEventListener('click', () => { game.paused = !game.paused; });
document.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => { game.speed = Number(button.dataset.speed); game.paused = false; }));
document.querySelector('#new-run').addEventListener('click', () => start(createSeed()));
document.querySelector('#same-seed').addEventListener('click', () => start(game.seed));
document.querySelector('#random-seed').addEventListener('click', () => start(createSeed()));
document.querySelector('#help').addEventListener('click', () => { openDialog(helpModal); game.paused = true; });
document.querySelector('#close-help').addEventListener('click', () => { closeDialog(helpModal); game.paused = false; });

window.addEventListener('keydown', (event) => {
  if (event.key === ' ') { event.preventDefault(); game.paused = !game.paused; }
  if (event.key === '1') { game.speed = 1; game.paused = false; }
  if (event.key === '2') { game.speed = 2; game.paused = false; }
  if (event.key === '3') { game.speed = 4; game.paused = false; }
  if (event.key === 'Escape') { game.selectedDeliveryId = null; game.selectedCourierId = null; renderUI(); }
});

window.addEventListener('resize', () => renderer.resize());
start();
requestAnimationFrame(frame);
