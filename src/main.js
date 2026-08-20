import { Game, DELIVERY_TYPES, RADIO_CHANNELS } from './game.js';
import { createSeed } from './rng.js';
import { Renderer } from './render.js';

const FIXED_STEP=1/60;
const $=(selector)=>document.querySelector(selector);
const canvas=$('#game-canvas');
const stats={score:$('#score'),cash:$('#cash'),rep:$('#rep'),wave:$('#wave'),seed:$('#seed'),active:$('#active-count'),called:$('#called-count'),slots:$('#radio-slots'),trait:$('#trait'),traitDesc:$('#trait-desc')};
const deliveriesEl=$('#deliveries'),couriersEl=$('#couriers'),goalsEl=$('#goals'),noticeEl=$('#notice');
const eventChip=$('#event-chip'),eventState=$('#event-state'),eventTitle=$('#event-title'),eventDetail=$('#event-detail'),eventTime=$('#event-time');
const controlsOverview=$('#controls-overview'),upgradeModal=$('#upgrade-modal'),upgradeChoices=$('#upgrade-choices'),gameoverModal=$('#gameover-modal'),summaryEl=$('#run-summary'),bestEl=$('#best-score'),reviewMetrics=$('#review-metrics'),reviewAdvice=$('#review-advice');
const jobEls=new Map(),riderEls=new Map(),goalEls=new Map();
let game,renderer,lastTime=performance.now(),accumulator=0,lastUiRender=0,shownUpgradeAt=-1,drag=null,suppressCanvasClick=false;

function setText(el,value){const text=String(value??'');if(el.textContent!==text)el.textContent=text;}
function setClass(el,value){if(el.className!==value)el.className=value;}
function openDialog(dialog){dialog.hidden=false;if(dialog.open)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
function closeDialog(dialog){if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;}
function currentSeed(){const raw=new URLSearchParams(location.search).get('seed');if(!raw)return createSeed();const cleaned=raw.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);return cleaned||createSeed();}
function readLocal(key,fallback=''){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function writeLocal(key,value){try{localStorage.setItem(key,String(value));}catch{}}
function syncUrl(seed){const url=new URL(location.href);url.searchParams.set('seed',seed);history.replaceState(null,'',url);}
function formatTime(seconds){const value=Math.max(0,Math.ceil(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;}
function kmFromWorld(value){return `${Math.max(.1,value/170).toFixed(1)} km`;}
function endpointLabel(node){return node.short??node.name??node.id;}

function clearDynamic(){for(const el of jobEls.values())el.remove();for(const el of riderEls.values())el.remove();for(const el of goalEls.values())el.remove();jobEls.clear();riderEls.clear();goalEls.clear();}
function start(seed=currentSeed()){
  game=new Game({seed});renderer=new Renderer(canvas,game);lastTime=performance.now();accumulator=0;lastUiRender=0;shownUpgradeAt=-1;clearDynamic();
  closeDialog(upgradeModal);closeDialog(gameoverModal);syncUrl(seed);renderUI(true);
  const seen=readLocal('bike.mapFirstControls')==='1';toggleControls(!seen,true);if(!seen)game.paused=true;
}

function createJobElement(delivery){
  const el=document.createElement('article');el.className='job-card';el.dataset.delivery=delivery.id;
  el.innerHTML=`<span class="job-glyph"></span><div class="job-main"><strong><span class="job-id"></span><em class="job-type"></em></strong><span class="job-route"></span><span class="job-meta"></span></div><time class="job-time"></time><div class="channel-actions"><button class="channel-btn" data-channel="open">OPEN<small>1</small></button><button class="channel-btn" data-channel="priority">PRIORITY<small>2</small></button><button class="channel-btn" data-channel="local">LOCAL<small>1</small></button><button class="channel-btn" data-channel="off">OFF</button><span class="taken-note" hidden>RIDER COMMITTED</span></div>`;
  deliveriesEl.append(el);jobEls.set(delivery.id,el);return el;
}
function updateJobElement(el,d){
  const type=DELIVERY_TYPES[d.type],pickup=game.nodeById(d.pickupId),dropoff=game.nodeById(d.dropoffId),remaining=d.deadlineAt-game.elapsed,claimed=d.status==='claimed',nearest=game.nearestIdleDistance(d),channel=d.called?d.channel:'off';
  el.style.setProperty('--type',type.color);el.dataset.channel=channel;el.dataset.claimed=String(claimed);setText(el.querySelector('.job-glyph'),d.pickedUp?'◎':type.glyph);setText(el.querySelector('.job-id'),d.id.toUpperCase());setText(el.querySelector('.job-type'),type.label);setText(el.querySelector('.job-route'),`${endpointLabel(pickup)} → ${endpointLabel(dropoff)}`);
  const state=claimed?`${game.courierById(d.courierId)?.name??'rider'} committed`:d.called?`${RADIO_CHANNELS[d.channel].short} radio`:nearest==null?'no rider listening':`${kmFromWorld(nearest)} nearest`;
  setText(el.querySelector('.job-meta'),`${state} · €${d.reward}`);const time=el.querySelector('.job-time');setText(time,formatTime(remaining));setClass(time,`job-time${remaining<18?' urgent':''}`);
  for(const button of el.querySelectorAll('[data-channel]')){const id=button.dataset.channel;button.hidden=claimed||(id==='off'&&!d.called);button.classList.toggle('active',d.called&&d.channel===id);}
  el.querySelector('.taken-note').hidden=!claimed;
}
function syncJobs(){
  const active=game.activeDeliveries().sort((a,b)=>{if(a.status!==b.status)return a.status==='waiting'?-1:1;if(a.called!==b.called)return a.called?-1:1;return a.deadlineAt-b.deadlineAt;}).slice(0,20),ids=new Set(active.map((d)=>d.id));
  for(const [id,el] of jobEls)if(!ids.has(id)){el.remove();jobEls.delete(id);}for(const d of active){const el=jobEls.get(d.id)??createJobElement(d);updateJobElement(el,d);deliveriesEl.append(el);}
}

function createRiderElement(c){
  const el=document.createElement('button');el.className='rider-card';el.dataset.courier=c.id;el.innerHTML=`<span class="rider-icon"></span><span class="rider-main"><strong></strong><small class="profile"></small><small class="decision"></small></span><span class="rider-status"></span><span class="fatigue"><i></i></span>`;couriersEl.append(el);riderEls.set(c.id,el);return el;
}
function updateRiderElement(el,c){
  const onBreak=c.phase==='break'||!c.radioOn,busy=c.phase==='pickup'||c.phase==='dropoff',thinking=Boolean(c.deliberation),predicted=game.predictCall(c);el.style.setProperty('--rider',c.color);el.dataset.break=String(onBreak);el.classList.toggle('selected',game.selectedCourierId===c.id);
  setText(el.querySelector('.rider-icon'),onBreak?'Ⅱ':c.experience.level);setText(el.querySelector('.rider-main strong'),c.name);setText(el.querySelector('.profile'),`${c.personality.icon} ${c.personality.title} · ${c.experience.title}`);
  let decision=c.lastDecision,status='LISTENING',statusClass='listening';if(onBreak){decision=`Radio off · break ${formatTime(game.breakRemaining(c))}`;status='BREAK';statusClass='break';}else if(busy){decision=c.phase==='pickup'?'Riding to pickup':'Delivering';status='RIDING';statusClass='busy';}else if(thinking){const d=game.deliveryById(c.deliberation.deliveryId);decision=`Considering ${d?.id.toUpperCase()??'job'} · ${Math.round(game.deliberationProgress(c)*100)}%`;status='THINKING';statusClass='thinking';}else if(predicted){decision=`Likely ${predicted.delivery.id.toUpperCase()} · ${c.personality.title.toLowerCase()}`;}
  setText(el.querySelector('.decision'),decision);const badge=el.querySelector('.rider-status');setText(badge,status);setClass(badge,`rider-status ${statusClass}`);el.querySelector('.fatigue i').style.width=`${Math.round(c.fatigue*100)}%`;
}
function syncRiders(){const ids=new Set(game.couriers.map((c)=>c.id));for(const[id,el]of riderEls)if(!ids.has(id)){el.remove();riderEls.delete(id);}for(const c of game.couriers){const el=riderEls.get(c.id)??createRiderElement(c);updateRiderElement(el,c);couriersEl.append(el);}}

function createGoalElement(g){const el=document.createElement('article');el.className='goal-card';el.dataset.goal=g.id;el.innerHTML='<div><strong></strong><span></span></div><p></p><div class="goal-bar"><i></i></div><small></small>';goalsEl.append(el);goalEls.set(g.id,el);return el;}
function syncGoals(){for(const g of game.goals){const el=goalEls.get(g.id)??createGoalElement(g);el.classList.toggle('complete',g.complete);setText(el.querySelector('strong'),`${g.complete?'✓ ':''}${g.label}`);setText(el.querySelector('div span'),`${g.progress}/${g.target}`);setText(el.querySelector('p'),g.detail);el.querySelector('.goal-bar i').style.width=`${Math.min(100,g.progress/g.target*100)}%`;setText(el.querySelector('small'),g.complete?'Complete':`€${g.reward} + REP`);}}

function renderEvent(){const ev=game.currentEvent;if(!ev){eventChip.hidden=true;return;}eventChip.hidden=false;eventChip.dataset.state=ev.state;setText(eventState,ev.state==='active'?'ACTIVE NOW':'FORECAST');setText(eventTitle,`${ev.title} · ${ev.place}`);setText(eventDetail,ev.state==='active'?'Affected street is slower. Riders reroute at nodes.':ev.detail);setText(eventTime,ev.state==='active'?`${formatTime(ev.endsAt-game.elapsed)} left`:`starts ${formatTime(ev.startsAt-game.elapsed)}`);}
function renderUI(force=false){setText(stats.score,Math.round(game.score).toLocaleString());setText(stats.cash,`€${game.cash}`);setText(stats.rep,`${Math.round(game.reputation)}%`);stats.rep.dataset.level=game.reputation<35?'danger':game.reputation<65?'warn':'good';setText(stats.wave,game.wave);setText(stats.seed,game.seed);setText(stats.active,game.activeDeliveries().length);setText(stats.called,game.radioUsed());setText(stats.slots,game.radioSlots);setText(stats.trait,game.runTrait.title);setText(stats.traitDesc,game.runTrait.desc);setText(noticeEl,game.elapsed<=game.noticeUntil?game.notice:'');renderEvent();syncJobs();syncRiders();syncGoals();if(force)setText($('#zoom-label'),`${Math.round(renderer.zoom*100)}%`);}

function showUpgrade(){if(!game.upgradePending||shownUpgradeAt===game.nextUpgradeAt)return;shownUpgradeAt=game.nextUpgradeAt;upgradeChoices.replaceChildren();for(const u of game.getUpgradeChoices()){const button=document.createElement('button');button.dataset.upgrade=u.id;const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=u.title;span.textContent=u.desc;button.append(strong,span);upgradeChoices.append(button);}openDialog(upgradeModal);}
function showGameOver(){const s=game.summary(),best=Math.max(Number(readLocal('bike.bestScore','0'))||0,s.score);writeLocal('bike.bestScore',best);setText(bestEl,best.toLocaleString());summaryEl.replaceChildren();for(const[value,label]of[[s.score.toLocaleString(),'Score'],[s.completed,'Delivered'],[s.failed,'Missed'],[`${s.goals}/${game.goals.length}`,'Goals'],[s.review.breaks,'Rider breaks'],[s.seed,'Seed']]){const box=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=String(value);span.textContent=label;box.append(strong,span);summaryEl.append(box);}reviewMetrics.replaceChildren();for(const[value,label]of[[s.review.neverCalled,'Never called'],[s.review.calledUnclaimed,'No taker'],[s.review.claimedLate,'Accepted late'],[s.review.radioDenied,'Radio blocked']]){const box=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;box.append(strong,span);reviewMetrics.append(box);}reviewAdvice.replaceChildren();const top=document.createElement('p');top.textContent=`Top rider: ${s.review.topRider}`;reviewAdvice.append(top);for(const advice of s.review.advice){const p=document.createElement('p');p.textContent=advice;reviewAdvice.append(p);}openDialog(gameoverModal);}

function frame(now){const frameDt=Math.min(.25,(now-lastTime)/1000);lastTime=now;accumulator+=frameDt;let steps=0;while(accumulator>=FIXED_STEP&&steps<15){game.update(FIXED_STEP);accumulator-=FIXED_STEP;steps+=1;}if(steps===15)accumulator=0;renderer.draw();if(now-lastUiRender>=120){renderUI();lastUiRender=now;}showUpgrade();if(game.gameOver&&!gameoverModal.open)showGameOver();requestAnimationFrame(frame);}

function updateZoomLabel(){setText($('#zoom-label'),`${Math.round(renderer.zoom*100)}%`);}
canvas.addEventListener('wheel',(event)=>{event.preventDefault();const rect=canvas.getBoundingClientRect();renderer.zoomAt(event.clientX-rect.left,event.clientY-rect.top,event.deltaY<0?1.14:.88);updateZoomLabel();},{passive:false});
canvas.addEventListener('pointerdown',(event)=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
canvas.addEventListener('pointermove',(event)=>{if(!drag||drag.id!==event.pointerId)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5)suppressCanvasClick=true;renderer.pan(dx,dy);});
canvas.addEventListener('pointerup',(event)=>{if(!drag||drag.id!==event.pointerId)return;drag=null;canvas.releasePointerCapture(event.pointerId);canvas.classList.remove('dragging');setTimeout(()=>{suppressCanvasClick=false;},0);});
canvas.addEventListener('click',(event)=>{if(suppressCanvasClick)return;const rect=canvas.getBoundingClientRect(),point=renderer.screenToWorld(event.clientX-rect.left,event.clientY-rect.top),entity=game.nearestEntity(point.x,point.y,24/renderer.scale);if(!entity)return;if(entity.type==='delivery')game.selectDelivery(entity.id);if(entity.type==='courier')game.selectCourier(entity.id);renderUI();});

deliveriesEl.addEventListener('click',(event)=>{const card=event.target.closest('[data-delivery]');if(!card)return;const d=game.deliveryById(card.dataset.delivery);if(!d)return;const channel=event.target.closest('[data-channel]');if(channel){game.setChannel(d.id,channel.dataset.channel);renderUI();return;}game.selectDelivery(d.id);renderUI();});
couriersEl.addEventListener('click',(event)=>{const card=event.target.closest('[data-courier]');if(card){game.selectCourier(card.dataset.courier);renderUI();}});
upgradeChoices.addEventListener('click',(event)=>{const button=event.target.closest('[data-upgrade]');if(!button)return;if(game.applyUpgrade(button.dataset.upgrade)){closeDialog(upgradeModal);renderUI(true);}});
$('#pause').addEventListener('click',()=>{game.paused=!game.paused;});document.querySelectorAll('[data-speed]').forEach((button)=>button.addEventListener('click',()=>{game.speed=Number(button.dataset.speed);game.paused=false;}));
$('#new-run').addEventListener('click',()=>start(createSeed()));$('#same-seed').addEventListener('click',()=>start(game.seed));$('#random-seed').addEventListener('click',()=>start(createSeed()));
$('#zoom-in').addEventListener('click',()=>{renderer.zoomAt(renderer.viewWidth/2,renderer.viewHeight/2,1.18);updateZoomLabel();});$('#zoom-out').addEventListener('click',()=>{renderer.zoomAt(renderer.viewWidth/2,renderer.viewHeight/2,.84);updateZoomLabel();});$('#zoom-reset').addEventListener('click',()=>{renderer.resetView();updateZoomLabel();});$('#reset-view').addEventListener('click',()=>{renderer.resetView();updateZoomLabel();});
function toggleControls(open=!controlsOverview.hidden,initial=false){const show=typeof open==='boolean'?open:controlsOverview.hidden;controlsOverview.hidden=!show;$('#controls-toggle').setAttribute('aria-expanded',String(show));if(show&&!initial)game.paused=true;if(!show&&!initial){writeLocal('bike.mapFirstControls','1');game.paused=false;}}
$('#controls-toggle').addEventListener('click',()=>toggleControls(controlsOverview.hidden));$('#controls-close').addEventListener('click',()=>toggleControls(false));
window.addEventListener('keydown',(event)=>{if(upgradeModal.open||gameoverModal.open)return;if(event.key==='?'||event.key==='h'||event.key==='H'){event.preventDefault();toggleControls(controlsOverview.hidden);return;}if(!controlsOverview.hidden&&event.key==='Escape'){toggleControls(false);return;}if(!controlsOverview.hidden)return;if(event.key===' '){event.preventDefault();game.paused=!game.paused;}if(event.key==='1'){game.speed=1;game.paused=false;}if(event.key==='2'){game.speed=2;game.paused=false;}if(event.key==='3'){game.speed=4;game.paused=false;}if(event.key==='0'){renderer.resetView();updateZoomLabel();}if(event.key==='Escape'){game.selectedDeliveryId=null;game.selectedCourierId=null;renderUI();}});
window.addEventListener('resize',()=>{renderer.resize();updateZoomLabel();});
start();requestAnimationFrame(frame);
