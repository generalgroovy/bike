import { CARGO_FAMILIES } from './game-berlin-playtest.js';
import { createCargoIconElement } from './cargo-icons.js';
import { createRiderPortraitElement } from './rider-identity.js';
import { createBikeIconElement, bikeVisual, riderEndurance, riderLoad } from './bike-display.js';
import { riderActivity } from './playtest-decisions.js';

const actions = new WeakMap();
const preference = { sprinter: 'Likes short, urgent jobs', earner: 'Likes a worthwhile fee', local: 'Likes work in their district' };
const setText = (root, selector, value) => {
  const element = root.querySelector(selector), next = String(value);
  if (element.textContent !== next) element.textContent = next;
};
const metric = (name, label, meter, extra = '') => `<span class="${name}"><span class="metric-label">${label}</span> <strong class="metric-value"></strong></span><meter class="${meter}" min="0" max="100"></meter>${extra}`;

function createCard(rider) {
  const card = document.createElement('article');
  card.className = 'rider';
  card.dataset.rider = rider.id;
  card.style.setProperty('--courier', rider.color);
  card.innerHTML = `<div class="rider-info">
    <div class="rider-head"><button type="button" class="rider-locate"><strong class="rider-name"></strong></button><span class="rider-bike"></span><strong class="rider-wellbeing-band" hidden></strong></div>
    <p class="rider-preferences"></p><p class="rider-accepts"></p>
    <div class="rider-resources">
      <label class="endurance-resource">${metric('rider-endurance', 'Endurance', 'endurance-meter')}</label>
      <label class="load-resource">${metric('rider-capacity', 'Load · kg', 'load-meter')}</label>
      <button type="button" class="wellbeing-toggle rider-wellbeing" aria-haspopup="dialog" hidden>${metric('rider-satisfaction', 'Satisfaction', 'satisfaction-meter')}</button>
    </div>
    <div class="rider-status"><p class="rider-waiting" hidden></p><p class="rider-activity"></p><div class="rider-jobs" hidden></div></div>
    <p class="rider-retention" hidden></p>
  </div>`;
  const locate = card.querySelector('.rider-locate');
  locate.prepend(rider.bikeType ? createBikeIconElement(rider, { className: 'bike-icon' }) : createRiderPortraitElement(rider));
  locate.addEventListener('click', () => {
    const current = actions.get(card);
    current.onLocate(current.rider);
  });
  card.querySelector('.wellbeing-toggle').addEventListener('click', () => {
    const current = actions.get(card);
    current.onWellbeing(current.rider);
  });
  return card;
}

function renderAcceptedCargo(card, rider, profile) {
  const accepts = profile?.acceptedTypes ?? profile?.accepts ?? (rider.bikeType === 'road' ? ['document'] : ['document', 'fragile', 'grocery']);
  const element = card.querySelector('.rider-accepts');
  element.hidden = !rider.bikeType;
  const signature = accepts.join(',');
  if (element.dataset.types === signature) return;
  element.dataset.types = signature;
  element.replaceChildren();
  element.setAttribute('aria-label', `Accepts ${accepts.map(type => CARGO_FAMILIES[type]?.name ?? type).join(', ')} cargo`);
  element.title = `Accepted cargo: ${accepts.map(type => CARGO_FAMILIES[type]?.name ?? type).join(', ')}. Maximum load appears below.`;
  for (const type of accepts) {
    const item = document.createElement('span');
    item.className = 'rider-cargo';
    item.append(createCargoIconElement(type), document.createTextNode(CARGO_FAMILIES[type]?.name ?? type));
    element.append(item);
  }
}

function renderJobs(card, jobs) {
  const links = card.querySelector('.rider-jobs'), signature = jobs.map(job => job.id).join(',');
  links.hidden = jobs.length === 0;
  if (links.dataset.ids === signature) return;
  links.dataset.ids = signature;
  links.replaceChildren();
  for (const job of jobs) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = job.id.toUpperCase();
    button.title = `Inspect accepted job ${job.id.toUpperCase()}`;
    button.setAttribute('aria-label', `Inspect accepted job ${job.id.toUpperCase()}`);
    button.addEventListener('click', () => actions.get(card).onSelectJob(job.id));
    links.append(button);
  }
}

// Presentation only. Actions are supplied by the desk, so inspecting a card
// cannot change rider choices, patience, the clock or replay state.
export function renderRiderCards({ game, container, cards, onLocate, onSelectJob, onWellbeing, time }) {
  for (const rider of game.couriers) {
    let card = cards.get(rider.id);
    if (!card) {
      card = createCard(rider);
      cards.set(rider.id, card);
      container.append(card);
    }
    actions.set(card, { rider, onLocate, onSelectJob, onWellbeing });
    const job = game.deliveryById(rider.deliveryId);
    const jobs = game.logistics ? game.riderJobs(rider) : job ? [job] : [];
    const wellbeing = game.wellbeing ? game.riderWellbeing(rider) : null;
    const activity = riderActivity(game, rider);
    const profile = game.logistics ? game.riderProfile(rider) : null;
    const energy = riderEndurance(rider), load = riderLoad(game, rider);
    const visual = bikeVisual(rider);
    card.dataset.phase = rider.phase;
    card.dataset.selected = String(game.selectedCourierId === rider.id);
    card.dataset.wellbeing = wellbeing?.band ?? 'legacy';
    card.dataset.working = String(jobs.length > 0);
    card.title = `${rider.completed} delivered · ${rider.lastDecision}`;
    setText(card, '.rider-name', rider.name);
    setText(card, '.rider-bike', rider.bikeType ? visual.short : rider.personality.name);
    card.querySelector('.rider-bike').title = rider.bikeType ? visual.label : rider.personality.name;
    const locate = card.querySelector('.rider-locate');
    locate.title = `Locate ${rider.name} · ${visual.label}`;
    locate.setAttribute('aria-label', `Locate ${rider.name} on the map · ${visual.label}`);
    locate.setAttribute('aria-pressed', String(game.selectedCourierId === rider.id));
    setText(card, '.rider-preferences', profile?.preferences ?? preference[rider.personality.id] ?? 'Chooses suitable work');
    renderAcceptedCargo(card, rider, profile);

    setText(card, '.rider-endurance .metric-value', `${energy.current} / ${energy.max}`);
    const endurance = card.querySelector('.endurance-meter');
    endurance.value = energy.current; endurance.max = energy.max;
    endurance.setAttribute('aria-label', `${rider.name}: endurance ${energy.current} of ${energy.max}`);
    card.querySelector('.endurance-resource').title = 'Current endurance / maximum. Riding and carrying weight use endurance; breaks restore it.';
    card.querySelector('.load-resource').hidden = !game.logistics;
    setText(card, '.rider-capacity .metric-value', `${load.currentKg} / ${load.capacityKg}`);
    const capacity = card.querySelector('.load-meter');
    capacity.value = load.currentKg; capacity.max = load.capacityKg || 1;
    capacity.setAttribute('aria-label', `${rider.name}: carrying ${load.currentKg} of ${load.capacityKg} kg`);
    card.querySelector('.load-resource').title = 'Cargo currently on the bike / maximum carrying capacity. Accepted pickups are shown as job links.';

    const waiting = wellbeing?.offDuty ? 'Finished for today' : jobs.length ? 'On tour' : wellbeing?.lastTourAgo === null ? `Waiting for first tour · ${time(wellbeing.idleSeconds)}` : wellbeing ? `Last tour ${time(wellbeing.lastTourAgo)} ago` : '';
    const onBreak = rider.phase === 'break';
    let status = wellbeing?.offDuty ? '' : onBreak ? `Resting · ${time(game.breakRemaining(rider))}` : activity?.detail ?? (job ? `${rider.phase === 'pickup' ? 'To pickup' : 'To delivery'} · ~${time(game.logistics ? game.jobETA(rider, job) : game.courierETA(rider))}` : rider.deliberation ? `Considering ${rider.deliberation.deliveryId.toUpperCase()}` : wellbeing ? '' : 'Listening for work');
    // The accepted-job buttons already identify the parcels. Keep this line
    // about the next action, rather than repeating the same job identifier.
    if (job && activity?.detail?.startsWith(`${job.id.toUpperCase()} · `)) status = activity.detail.slice(job.id.length + 3);
    setText(card, '.rider-activity', status);
    card.querySelector('.rider-activity').hidden = !status;
    setText(card, '.rider-waiting', waiting);
    card.querySelector('.rider-waiting').hidden = !wellbeing;
    card.querySelector('.rider-waiting').title = wellbeing?.offDuty ? 'Radio off · available again next shift' : jobs.length ? 'This tour ends after the final accepted parcel.' : wellbeing?.reason ?? '';
    renderJobs(card, jobs);

    const toggle = card.querySelector('.wellbeing-toggle'), band = card.querySelector('.rider-wellbeing-band');
    toggle.hidden = !wellbeing; band.hidden = !wellbeing;
    const retention = card.querySelector('.rider-retention');
    const leaving = Boolean(wellbeing && Number.isFinite(wellbeing.leaveIn));
    retention.hidden = !leaving;
    setText(card, '.rider-retention', leaving ? `Leaves after ${time(wellbeing.leaveIn)} more waiting` : '');
    if (wellbeing) {
      const satisfaction = Math.floor(wellbeing.satisfaction);
      setText(card, '.rider-satisfaction .metric-value', `${satisfaction} / ${wellbeing.max}`);
      setText(card, '.rider-wellbeing-band', wellbeing.label);
      const meter = card.querySelector('.satisfaction-meter');
      meter.value = wellbeing.satisfaction; meter.max = wellbeing.max;
      meter.setAttribute('aria-label', `${rider.name}: satisfaction ${satisfaction} of ${wellbeing.max}, ${wellbeing.label}`);
      toggle.setAttribute('aria-label', `${rider.name}: satisfaction ${satisfaction} of ${wellbeing.max}, ${wellbeing.label}. ${waiting}. ${leaving ? `Leaves after ${time(wellbeing.leaveIn)} more waiting. ` : ''}Inspect patience, effects and recovery.`);
      toggle.title = `${wellbeing.reason} ${wellbeing.effect} ${wellbeing.recovery}`;
      band.title = `${wellbeing.label}. Select satisfaction to inspect patience, effects and recovery.`;
    }
  }
}
