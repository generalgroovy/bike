import { Game, DELIVERY_TYPES } from './game.js';
import { createSeed } from './rng.js';
import { Renderer } from './render.js';

const FIXED_STEP = 1/60;
const canvas = document.querySelector('#game-canvas');
const stats = {
  score:document.querySelector('#score'), cash:document.querySelector('#cash'), rep:document.querySelector('#rep'), wave:document.querySelector('#wave'),
  seed:document.querySelector('#seed'), active:document.querySelector('#active-count'), called:document.querySelector('#called-count'), slots:document.querySelector('#radio-slots'),
  trait:document.querySelector('#trait'), traitDesc:document.querySelector('#trait-desc')
};
const deliveriesEl=document.querySelector('#deliveries');
const couriersEl=document.querySelector('#couriers');
const goalsEl=document.querySelector('#goals');
const noticeEl=document.querySelector('#notice');
const upgradeModal=document.querySelector('#upgrade-modal');
const upgradeChoices=document.querySelector('#upgrade-choices');
const gameoverModal=document.querySelector('#gameover-modal');
const summaryEl=document.querySelector('#run-summary');
const bestEl=document.querySelector('#best-score');
const helpModal=document.querySelector('#help-modal');

let game,renderer,lastTime=performance.now(),accumulator=0,lastUiRender=0,shownUpgradeAt=-1,helpWasPaused=false;

function openDialog(dialog){ dialog.hidden=false; if(dialog.open)return; if(typeof dialog.showModal==='function')dialog.showModal(); else dialog.setAttribute('open',''); }
function closeDialog(dialog){ if(dialog.open&&typeof dialog.close==='function')dialog.close(); else dialog.removeAttribute('open'); dialog.hidden=true; }
function currentSeed(){ const raw=new URLSearchParams(location.search).get('seed'); if(!raw)return createSeed(); const cleaned=raw.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32); return cleaned||createSeed(); }
function readLocal(key,fallback=''){ try{return localStorage.getItem(key)??fallback;}catch{return fallback;} }
function writeLocal(key,value){ try{localStorage.setItem(key,String(value));}catch{} }
function loadBestScore(){ return Number(readLocal('bike.bestScore','0'))||0; }

function start(seed=currentSeed()){
  game=new Game({seed}); renderer=new Renderer(canvas,game); lastTime=performance.now(); accumulator=0; lastUiRender=0; shownUpgradeAt=-1;
  closeDialog(upgradeModal); closeDialog(gameoverModal); closeDialog(helpModal); syncUrl(seed); renderUI();
  if(readLocal('bike.seenBerlinBrief')!=='1'){ helpWasPaused=game.paused; game.paused=true; openDialog(helpModal); }
}
function syncUrl(seed){ const url=new URL(location.href); url.searchParams.set('seed',seed); history.replaceState(null,'',url); }
function formatTime(seconds){ const value=Math.max(0,Math.ceil(seconds)); return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`; }
function kmFromWorld(value){ return `${Math.max(0.1,value/155).toFixed(1)} km`; }
function endpointLabel(node){ return node.short??node.name??node.id; }

function renderUI(){
  stats.score.textContent=Math.round(game.score).toLocaleString(); stats.cash.textContent=`€${game.cash}`; stats.rep.textContent=`${Math.round(game.reputation)}%`;
  stats.rep.dataset.level=game.reputation<35?'danger':game.reputation<65?'warn':'good'; stats.wave.textContent=game.wave; stats.seed.textContent=game.seed;
  stats.active.textContent=game.activeDeliveries().length; stats.called.textContent=game.calledCount(); stats.slots.textContent=game.radioSlots;
  stats.trait.textContent=game.runTrait.title; stats.traitDesc.textContent=game.runTrait.desc; noticeEl.textContent=game.elapsed<=game.noticeUntil?game.notice:'';

  const active=game.activeDeliveries().sort((a,b)=>a.status!==b.status?(a.status==='waiting'?-1:1):a.deadlineAt-b.deadlineAt).slice(0,14);
  deliveriesEl.innerHTML=active.map((delivery)=>{
    const type=DELIVERY_TYPES[delivery.type], remaining=delivery.deadlineAt-game.elapsed, pickup=game.nodeById(delivery.pickupId), dropoff=game.nodeById(delivery.dropoffId);
    const called=delivery.called, claimed=delivery.status==='claimed', nearest=game.nearestIdleDistance(delivery);
    const state=claimed?`${game.courierById(delivery.courierId)?.name??'Rider'} chose it`:called?'ON RADIO':'OFF RADIO';
    const distanceHint=claimed?'rider committed':nearest==null?'no free riders':`${kmFromWorld(nearest)} to nearest free rider`;
    return `<button class="delivery-card ${called?'called':''} ${claimed?'claimed':''}" data-delivery="${delivery.id}" style="--accent:${type.color}" aria-pressed="${called}">
      <span class="glyph">${delivery.pickedUp?'◎':type.glyph}</span><span class="job-copy"><span class="job-top"><strong>${delivery.id.toUpperCase()} · ${type.label}</strong><em>${state}</em></span>
      <small>${endpointLabel(pickup)} → ${endpointLabel(dropoff)}</small><small class="distance-hint">${distanceHint} · €${delivery.reward}</small></span>
      <time class="${remaining<16?'urgent':''}">${formatTime(remaining)}</time><span class="call-action">${claimed?'TAKEN':called?'UNCALL':'CALL'}</span></button>`;
  }).join('')||'<p class="empty">No open jobs. Watch the map.</p>';

  couriersEl.innerHTML=game.couriers.map((courier)=>{
    const selected=game.selectedCourierId===courier.id,busy=courier.phase!=='idle',home=game.districts.find((d)=>d.id===courier.homeDistrict)?.name??'Berlin';
    const predicted=game.predictCall(courier),confidence=courier.experience.level>=4?'high':courier.experience.level>=3?'good':courier.experience.level>=2?'medium':'low';
    const intent=predicted?`Likely ${predicted.delivery.id.toUpperCase()} · ${confidence} confidence`:courier.lastDecision;
    return `<button class="courier-card ${selected?'selected':''}" data-courier="${courier.id}" style="--accent:${courier.color}"><span class="courier-dot"></span>
      <span class="rider-copy"><span class="rider-name"><strong>${courier.name}</strong><em>${courier.experience.title} · Lv${courier.experience.level}</em></span>
      <small><b>${courier.personality.icon} ${courier.personality.title}</b> — ${courier.personality.desc}</small><small class="decision">${intent}</small></span>
      <span class="status-pill ${courier.phase}">${busy?(courier.phase==='pickup'?'PICKUP':'DELIVERY'):'LISTENING'}</span><span class="home-tag">${home}</span></button>`;
  }).join('');

  goalsEl.innerHTML=game.goals.map((goal)=>{ const pct=Math.min(100,goal.progress/goal.target*100); return `<article class="goal-card ${goal.complete?'complete':''}">
    <div><strong>${goal.complete?'✓ ':''}${goal.label}</strong><span>${goal.progress}/${goal.target}</span></div><p>${goal.detail}</p><div class="goal-bar"><i style="width:${pct}%"></i></div>
    <small>${goal.complete?'Complete':`Reward €${goal.reward} + reputation`}</small></article>`; }).join('');
}

function showUpgrade(){ if(!game.upgradePending||shownUpgradeAt===game.nextUpgradeAt)return; shownUpgradeAt=game.nextUpgradeAt; const choices=game.getUpgradeChoices();
  upgradeChoices.innerHTML=choices.map((u)=>`<button class="upgrade-card" data-upgrade="${u.id}"><strong>${u.title}</strong><span>${u.desc}</span></button>`).join(''); openDialog(upgradeModal); }
function showGameOver(){ const s=game.summary(),best=Math.max(loadBestScore(),s.score); writeLocal('bike.bestScore',best); bestEl.textContent=best.toLocaleString(); summaryEl.replaceChildren();
  for(const [value,label] of [[s.score.toLocaleString(),'Score'],[s.completed,'Delivered'],[s.failed,'Missed'],[s.goals+'/3','City goals'],[s.riderChoices,'Rider choices'],[s.seed,'Seed']]){
    const box=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span'); strong.textContent=String(value); span.textContent=label; box.append(strong,span); summaryEl.append(box); }
  openDialog(gameoverModal); }
function frame(now){ const frameDt=Math.min(0.25,(now-lastTime)/1000); lastTime=now; accumulator+=frameDt; let steps=0;
  while(accumulator>=FIXED_STEP&&steps<15){ game.update(FIXED_STEP); accumulator-=FIXED_STEP; steps+=1; } if(steps===15)accumulator=0; renderer.draw();
  if(now-lastUiRender>=100){ renderUI(); lastUiRender=now; } showUpgrade(); if(game.gameOver&&!gameoverModal.open)showGameOver(); requestAnimationFrame(frame); }

canvas.addEventListener('click',(event)=>{ const rect=canvas.getBoundingClientRect(),point=renderer.screenToWorld(event.clientX-rect.left,event.clientY-rect.top),entity=game.nearestEntity(point.x,point.y,26/renderer.scale);
  if(!entity)return; if(entity.type==='delivery')game.toggleCall(entity.id); if(entity.type==='courier')game.selectCourier(entity.id); renderUI(); });
deliveriesEl.addEventListener('click',(event)=>{ const button=event.target.closest('[data-delivery]'); if(!button)return; const delivery=game.deliveryById(button.dataset.delivery);
  if(delivery?.status==='waiting')game.toggleCall(delivery.id); else if(delivery)game.selectDelivery(delivery.id); renderUI(); });
couriersEl.addEventListener('click',(event)=>{ const button=event.target.closest('[data-courier]'); if(button){game.selectCourier(button.dataset.courier);renderUI();} });
upgradeChoices.addEventListener('click',(event)=>{ const button=event.target.closest('[data-upgrade]'); if(!button)return; game.applyUpgrade(button.dataset.upgrade); closeDialog(upgradeModal); renderUI(); });
document.querySelector('#pause').addEventListener('click',()=>{game.paused=!game.paused;});
document.querySelectorAll('[data-speed]').forEach((button)=>button.addEventListener('click',()=>{game.speed=Number(button.dataset.speed);game.paused=false;}));
document.querySelector('#new-run').addEventListener('click',()=>start(createSeed())); document.querySelector('#same-seed').addEventListener('click',()=>start(game.seed)); document.querySelector('#random-seed').addEventListener('click',()=>start(createSeed()));
document.querySelector('#help').addEventListener('click',()=>{helpWasPaused=game.paused;game.paused=true;openDialog(helpModal);});
document.querySelector('#close-help').addEventListener('click',()=>{writeLocal('bike.seenBerlinBrief','1');closeDialog(helpModal);game.paused=helpWasPaused;});
window.addEventListener('keydown',(event)=>{ if(helpModal.open||upgradeModal.open||gameoverModal.open)return; if(event.key===' '){event.preventDefault();game.paused=!game.paused;}
  if(event.key==='1'){game.speed=1;game.paused=false;} if(event.key==='2'){game.speed=2;game.paused=false;} if(event.key==='3'){game.speed=4;game.paused=false;}
  if(event.key==='Escape'){game.selectedDeliveryId=null;game.selectedCourierId=null;renderUI();} });
window.addEventListener('resize',()=>renderer.resize()); start(); requestAnimationFrame(frame);
