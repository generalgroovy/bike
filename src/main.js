import { Game, DELIVERY_TYPES } from './game.js';
import { createSeed } from './rng.js';
import { Renderer } from './render.js';

const canvas = document.querySelector('#game-canvas');
const stats = { score: document.querySelector('#score'), cash: document.querySelector('#cash'), rep: document.querySelector('#rep'), wave: document.querySelector('#wave'), seed: document.querySelector('#seed'), active: document.querySelector('#active-count') };
const deliveriesEl = document.querySelector('#deliveries');
const couriersEl = document.querySelector('#couriers');
const noticeEl = document.querySelector('#notice');
const upgradeModal = document.querySelector('#upgrade-modal');
const upgradeChoices = document.querySelector('#upgrade-choices');
const gameoverModal = document.querySelector('#gameover-modal');
const summaryEl = document.querySelector('#run-summary');
const bestEl = document.querySelector('#best-score');
const helpModal = document.querySelector('#help-modal');

let game; let renderer; let lastTime = performance.now(); let shownUpgradeAt = -1;

function currentSeed() { const params = new URLSearchParams(location.search); return params.get('seed') || createSeed(); }
function start(seed = currentSeed()) { game = new Game({ seed }); renderer = new Renderer(canvas, game); lastTime = performance.now(); shownUpgradeAt = -1; upgradeModal.hidden = true; gameoverModal.hidden = true; syncUrl(seed); renderUI(); }
function syncUrl(seed) { const url = new URL(location.href); url.searchParams.set('seed', seed); history.replaceState(null, '', url); }
function formatTime(seconds) { const value = Math.max(0, Math.ceil(seconds)); return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }

function renderUI() {
  stats.score.textContent = Math.round(game.score).toLocaleString();
  stats.cash.textContent = `€${game.cash}`;
  stats.rep.textContent = `${Math.round(game.reputation)}%`;
  stats.rep.dataset.level = game.reputation < 35 ? 'danger' : game.reputation < 65 ? 'warn' : 'good';
  stats.wave.textContent = game.wave; stats.seed.textContent = game.seed; stats.active.textContent = game.activeDeliveries().length;
  noticeEl.textContent = game.elapsed <= game.noticeUntil ? game.notice : '';
  const active = game.activeDeliveries().sort((a, b) => a.deadlineAt - b.deadlineAt).slice(0, 10);
  deliveriesEl.innerHTML = active.map((delivery) => {
    const type = DELIVERY_TYPES[delivery.type]; const remaining = delivery.deadlineAt - game.elapsed; const selected = game.selectedDeliveryId === delivery.id;
    return `<button class="delivery-card ${selected ? 'selected' : ''}" data-delivery="${delivery.id}" style="--accent:${type.color}"><span class="glyph">${type.glyph}</span><span><strong>${type.label}</strong><small>${delivery.status === 'assigned' ? 'Assigned' : 'Waiting'} · €${delivery.reward}</small></span><time class="${remaining < 12 ? 'urgent' : ''}">${formatTime(remaining)}</time></button>`;
  }).join('') || '<p class="empty">City is quiet. For now.</p>';
  couriersEl.innerHTML = game.couriers.map((courier) => {
    const selected = game.selectedCourierId === courier.id;
    return `<button class="courier-card ${selected ? 'selected' : ''}" data-courier="${courier.id}" style="--accent:${courier.color}"><span class="courier-dot"></span><span><strong>${courier.name}</strong><small>${courier.phase === 'idle' ? 'Available' : courier.phase === 'pickup' ? 'To pickup' : 'Delivering'}</small></span><span class="status-pill ${courier.phase}">${courier.phase === 'idle' ? 'READY' : 'BUSY'}</span></button>`;
  }).join('');
}

function showUpgrade() {
  if (!game.upgradePending || shownUpgradeAt === game.nextUpgradeAt) return;
  shownUpgradeAt = game.nextUpgradeAt;
  const choices = game.getUpgradeChoices();
  upgradeChoices.innerHTML = choices.map((upgrade) => `<button class="upgrade-card" data-upgrade="${upgrade.id}"><strong>${upgrade.title}</strong><span>${upgrade.desc}</span></button>`).join('');
  upgradeModal.hidden = false;
}

function showGameOver() {
  const summary = game.summary(); const best = Math.max(Number(localStorage.getItem('bike.bestScore') || 0), summary.score); localStorage.setItem('bike.bestScore', String(best)); bestEl.textContent = best.toLocaleString();
  summaryEl.innerHTML = `<div><strong>${summary.score.toLocaleString()}</strong><span>Score</span></div><div><strong>${summary.completed}</strong><span>Delivered</span></div><div><strong>${summary.failed}</strong><span>Missed</span></div><div><strong>${summary.wave}</strong><span>Wave</span></div><div><strong>${summary.distanceKm} km</strong><span>Ridden</span></div><div><strong>${summary.seed}</strong><span>Seed</span></div>`;
  gameoverModal.hidden = false;
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000); lastTime = now; game.update(dt); renderer.draw(); renderUI(); showUpgrade(); if (game.gameOver && gameoverModal.hidden) showGameOver(); requestAnimationFrame(frame);
}

canvas.addEventListener('click', (event) => { const rect = canvas.getBoundingClientRect(); const point = renderer.screenToWorld(event.clientX - rect.left, event.clientY - rect.top); const entity = game.nearestEntity(point.x, point.y, 24 / renderer.scale); if (!entity) return; if (entity.type === 'delivery') game.selectDelivery(entity.id); if (entity.type === 'courier') game.selectCourier(entity.id); });
deliveriesEl.addEventListener('click', (event) => { const button = event.target.closest('[data-delivery]'); if (button) game.selectDelivery(button.dataset.delivery); });
couriersEl.addEventListener('click', (event) => { const button = event.target.closest('[data-courier]'); if (button) game.selectCourier(button.dataset.courier); });
upgradeChoices.addEventListener('click', (event) => { const button = event.target.closest('[data-upgrade]'); if (!button) return; game.applyUpgrade(button.dataset.upgrade); upgradeModal.hidden = true; });
document.querySelector('#pause').addEventListener('click', () => { game.paused = !game.paused; });
document.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => { game.speed = Number(button.dataset.speed); game.paused = false; }));
document.querySelector('#new-run').addEventListener('click', () => start(createSeed()));
document.querySelector('#same-seed').addEventListener('click', () => start(game.seed));
document.querySelector('#random-seed').addEventListener('click', () => start(createSeed()));
document.querySelector('#help').addEventListener('click', () => { helpModal.hidden = false; game.paused = true; });
document.querySelector('#close-help').addEventListener('click', () => { helpModal.hidden = true; game.paused = false; });
window.addEventListener('keydown', (event) => { if (event.key === ' ') { event.preventDefault(); game.paused = !game.paused; } if (event.key === '1') { game.speed = 1; game.paused = false; } if (event.key === '2') { game.speed = 2; game.paused = false; } if (event.key === '3') { game.speed = 4; game.paused = false; } if (event.key === 'Escape') { game.selectedDeliveryId = null; game.selectedCourierId = null; } });
window.addEventListener('resize', () => renderer.resize());
start();
requestAnimationFrame(frame);
