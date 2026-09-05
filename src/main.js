import { Game,DELIVERY_TYPES,RADIO_CHANNELS } from './game.js';
import { createSeed } from './rng.js';
import { Renderer } from './render.js';
import { createCargoIconElement,cargoVisual } from './cargo-icons.js';
import { assessRoute } from './route-assessment.js';
import { createRiderPortraitElement,preloadRiderPortraits } from './rider-identity.js';

const FIXED_STEP=1/60,$=selector=>document.querySelector(selector),canvas=$('#game-canvas');
const stats={score:$('#score'),cash:$('#cash'),rep:$('#rep'),seed:$('#seed'),active:$('#active-count'),called:$('#called-count'),slots:$('#radio-slots'),trait:$('#trait'),traitDesc:$('#trait-desc'),contract:$('#contract'),contractDesc:$('#contract-desc'),focus:$('#focus'),focusMax:$('#focus-max'),city:$('#city-stage'),cityProgress:$('#city-progress'),cityNext:$('#city-next')};
const deliveriesEl=$('#deliveries'),couriersEl=$('#couriers'),goalsEl=$('#goals'),noticeEl=$('#notice'),goalCount=$('#goal-count');
const eventChip=$('#event-chip'),eventState=$('#event-state'),eventTitle=$('#event-title'),eventDetail=$('#event-detail'),eventTime=$('#event-time'),eventAdvisory=$('#event-advisory');
const inspector=$('#job-inspector'),inspectGlyph=$('#inspect-glyph'),inspectId=$('#inspect-id'),inspectSpecial=$('#inspect-special'),inspectPickup=$('#inspect-pickup'),inspectDropoff=$('#inspect-dropoff'),inspectTime=$('#inspect-time'),inspectDistance=$('#inspect-distance'),inspectReward=$('#inspect-reward'),inspectLikely=$('#inspect-likely'),inspectAdvice=$('#inspect-advice'),inspectStreets=$('#inspect-streets');
const helpPanel=$('#help-panel'),hoverTip=$('#hover-tip'),upgradeModal=$('#upgrade-modal'),upgradeChoices=$('#upgrade-choices'),gameoverModal=$('#gameover-modal'),summaryEl=$('#run-summary'),bestEl=$('#best-score'),reviewMetrics=$('#review-metrics'),reviewAdvice=$('#review-advice'),reviewTimeline=$('#review-timeline');
const taskEls=new Map(),riderEls=new Map(),goalEls=new Map();
let game,renderer,lastTime=performance.now(),accumulator=0,lastUiRender=0,shownUpgradeAt=-1,drag=null,suppressCanvasClick=false,helpPauseWas=false,tooltipOwner=null;

const setText=(el,value)=>{if(!el)return;const text=String(value??'');if(el.textContent!==text)el.textContent=text;};
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function formatTime(seconds){const value=Math.max(0,Math.ceil(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;}
function formatKm(world){return `${Math.max(.1,world/100).toFixed(1)} km`;}
function formatMeters(meters){return `${Math.max(.1,(Number(meters)||0)/1000).toFixed(1)} km`;}
function readLocal(key,fallback=''){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function writeLocal(key,value){try{localStorage.setItem(key,String(value));}catch{}}
function currentSeed(){const raw=new URLSearchParams(location.search).get('seed');if(!raw)return createSeed();const cleaned=raw.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);return cleaned||createSeed();}
function syncUrl(seed){const url=new URL(location.href);url.searchParams.set('seed',seed);history.replaceState(null,'',url);}
function openDialog(dialog){dialog.hidden=false;if(dialog.open)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
function closeDialog(dialog){if(!dialog)return;if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;}
function clearDynamic(){for(const el of taskEls.values())el.remove();for(const el of riderEls.values())el.remove();for(const el of goalEls.values())el.remove();taskEls.clear();riderEls.clear();goalEls.clear();}

function start(seed=currentSeed()){
  preloadRiderPortraits();game=new Game({seed});renderer=new Renderer(canvas,game);lastTime=performance.now();accumulator=0;lastUiRender=0;shownUpgradeAt=-1;tooltipOwner=null;clearDynamic();closeDialog(upgradeModal);closeDialog(gameoverModal);inspector.hidden=true;hideTip();syncUrl(seed);renderUI(true);
  const first=readLocal('sendit.help.v5')!=='1';if(first)toggleHelp(true,true);else helpPanel.hidden=true;
}

function createTaskElement(d){
  const el=document.createElement('article');el.className='task-card';el.dataset.delivery=d.id;
  el.innerHTML=`<button class="task-select" data-select><span class="task-glyph"></span><span class="task-main"><span class="task-top"><strong class="task-id"></strong><em class="task-special" hidden></em><time class="task-time"></time></span><span class="task-route pickup"></span><span class="task-route drop"></span><span class="task-meta"><span class="task-distance"></span><span class="task-difficulty"></span><span class="task-state"></span></span></span></button><div class="task-actions"><button data-channel="open" data-tip="OPEN · 1 bandwidth · neutral broadcast">O</button><button data-channel="priority" data-tip="PRIORITY · 2 bandwidth · stronger rider attention">!</button><button data-channel="local" data-tip="LOCAL · 1 bandwidth · favours nearby riders">L</button><button data-channel="off" data-tip="OFF · remove this job from radio">×</button><span class="task-claimed" hidden>RIDER COMMITTED</span></div>`;
  const icon=createCargoIconElement(d.type,{title:cargoVisual(d.type).label});if(icon)el.querySelector('.task-glyph').append(icon);
  deliveriesEl.append(el);taskEls.set(d.id,el);return el;
}
function likelyRiders(d,limit=2){return game.availableRiders().map(c=>({c,score:game.courierChoiceScore(c,d,false)})).filter(x=>Number.isFinite(x.score)).sort((a,b)=>b.score-a.score).slice(0,limit);}
function updateTaskElement(el,d){
  const type=DELIVERY_TYPES[d.type],cargo=cargoVisual(d.type),assessment=assessRoute(game,d),remaining=d.deadlineAt-game.elapsed,claimed=d.status==='claimed',channel=d.called?d.channel:'off',likely=likelyRiders(d,1)[0]?.c,insight=game.deliveryDispatchInsight?.(d);
  el.style.setProperty('--type',cargo.color);el.style.setProperty('--cargo',cargo.color);el.style.setProperty('--distance',assessment?.distanceColor??'#4f7fc4');el.style.setProperty('--difficulty',assessment?.difficultyColor??'#d3a33f');el.dataset.channel=channel;el.dataset.claimed=String(claimed);el.dataset.urgent=String(remaining<18);el.dataset.risk=insight?.state??'';el.dataset.distance=assessment?.distanceBand??'';el.dataset.difficulty=assessment?.difficultyBand??'';el.classList.toggle('selected',game.selectedDeliveryId===d.id);
  setText(el.querySelector('.task-id'),d.id.toUpperCase());
  const special=el.querySelector('.task-special');special.hidden=!d.specialLabel;if(d.specialLabel)setText(special,d.specialLabel);
  const time=el.querySelector('.task-time');setText(time,formatTime(remaining));time.classList.toggle('urgent',remaining<18);
  setText(el.querySelector('.pickup'),`P ${d.pickupAddress}`);setText(el.querySelector('.drop'),`D ${d.dropoffAddress}`);
  const state=claimed?`${game.courierById(d.courierId)?.name??'rider'} riding`:d.called?`${RADIO_CHANNELS[d.channel]?.short??'LIVE'}`:likely?`likely ${likely.name}`:'no free rider';
  setText(el.querySelector('.task-distance'),`${formatMeters(assessment?.distanceMeters??d.plannedDistance*10)} · ${assessment?.distanceLabel??'MID'}`);
  setText(el.querySelector('.task-difficulty'),assessment?.difficultyLabel??'NORMAL');
  setText(el.querySelector('.task-state'),`${formatTime(assessment?.slackSeconds??remaining)} slack · ${state}`);
  for(const button of el.querySelectorAll('[data-channel]')){const id=button.dataset.channel;button.hidden=claimed||(id==='off'&&!d.called);button.classList.toggle('active',d.called&&d.channel===id);}
  el.querySelector('.task-claimed').hidden=!claimed;
}
function syncTasks(){
  const active=[...game.activeDeliveries()].sort((a,b)=>a.createdAt-b.createdAt),ids=new Set(active.map(d=>d.id));
  for(const[id,el]of taskEls)if(!ids.has(id)){el.remove();taskEls.delete(id);}
  for(const d of active){const el=taskEls.get(d.id)??createTaskElement(d);updateTaskElement(el,d);deliveriesEl.append(el);}
}

function createRiderElement(c){
  const el=document.createElement('button');el.className='rider-card';el.dataset.courier=c.id;
  el.innerHTML=`<span class="rider-face"></span><span class="rider-main"><span class="rider-name"></span><span class="rider-profile"></span><span class="rider-location"></span></span><span class="rider-status"></span><span class="rider-task"><b></b><span class="meter"><i></i></span><em></em></span><span class="rider-energy"><b>ENERGY</b><span class="meter"><i></i></span><em></em></span>`;
  const portrait=createRiderPortraitElement(c);if(portrait)el.querySelector('.rider-face').append(portrait);
  couriersEl.append(el);riderEls.set(c.id,el);return el;
}
function riderLocation(c){const n=game.nodeById(c.nodeId);if(n?.addressLabel)return n.addressLabel;if(c.path?.length>c.pathIndex){const next=game.nodeById(c.path[c.pathIndex]),edge=game.edgeByIds(c.nodeId,next?.id);if(edge?.streetName)return edge.streetName;}return game.districts.find(d=>d.id===n?.districtId)?.name??'Berlin';}
function updateRiderElement(el,c){
  const onBreak=c.phase==='break'||!c.radioOn,busy=c.phase==='pickup'||c.phase==='dropoff',thinking=Boolean(c.deliberation),progress=busy?game.courierTaskProgress(c):thinking?game.deliberationProgress(c):0,energy=clamp(1-c.fatigue,0,1),eta=game.courierETA(c),d=c.deliveryId?game.deliveryById(c.deliveryId):null;
  el.style.setProperty('--rider',c.color);el.dataset.break=String(onBreak);el.dataset.state=onBreak?'break':busy?'riding':thinking?'thinking':'listening';el.classList.toggle('selected',game.selectedCourierId===c.id);
  setText(el.querySelector('.rider-name'),c.name);setText(el.querySelector('.rider-profile'),`${c.personality.icon} ${c.personality.title} · L${c.experience.level}`);setText(el.querySelector('.rider-location'),riderLocation(c));
  let status='LISTENING',statusClass='listening',taskLabel='READY',taskEta='—';
  if(onBreak){status='BREAK';statusClass='break';taskLabel='RADIO OFF';taskEta=formatTime(game.breakRemaining(c));}
  else if(busy){status='RIDING';statusClass='busy';taskLabel=`${d?.id.toUpperCase()??'JOB'} · ${c.phase==='pickup'?'PICKUP':'DROP'}`;taskEta=eta==null?'—':formatTime(eta);}
  else if(thinking){status='THINKING';statusClass='thinking';taskLabel=`${c.deliberation.deliveryId.toUpperCase()} · ${Math.round(progress*100)}%`;taskEta='CHOOSING';}
  else{const predicted=game.predictCall(c);if(predicted)taskLabel=`EYE ${predicted.delivery.id.toUpperCase()}`;}
  const badge=el.querySelector('.rider-status');setText(badge,status);badge.className=`rider-status ${statusClass}`;
  setText(el.querySelector('.rider-task b'),taskLabel);el.querySelector('.rider-task .meter i').style.width=`${Math.round(progress*100)}%`;setText(el.querySelector('.rider-task em'),taskEta);
  el.querySelector('.rider-energy .meter i').style.width=`${Math.round(energy*100)}%`;setText(el.querySelector('.rider-energy em'),`${Math.round(energy*100)}%`);
}
function syncRiders(){const ids=new Set(game.couriers.map(c=>c.id));for(const[id,el]of riderEls)if(!ids.has(id)){el.remove();riderEls.delete(id);}for(const c of game.couriers){const el=riderEls.get(c.id)??createRiderElement(c);updateRiderElement(el,c);couriersEl.append(el);}}

function createGoalElement(g){const el=document.createElement('article');el.className='goal-card';el.dataset.goal=g.id;el.innerHTML='<div><strong></strong><span></span></div><p></p><div class="goal-bar"><i></i></div><small></small>';goalsEl.append(el);goalEls.set(g.id,el);return el;}
function syncGoals(){const ids=new Set(game.goals.map(g=>g.id));for(const[id,el]of goalEls)if(!ids.has(id)){el.remove();goalEls.delete(id);}for(const g of game.goals){const el=goalEls.get(g.id)??createGoalElement(g);el.classList.toggle('complete',g.complete);setText(el.querySelector('strong'),`${g.complete?'✓ ':''}${g.label}`);setText(el.querySelector('div span'),`${g.progress}/${g.target}`);setText(el.querySelector('p'),g.detail);el.querySelector('.goal-bar i').style.width=`${Math.min(100,g.progress/g.target*100)}%`;setText(el.querySelector('small'),g.complete?'DONE':`€${g.reward} + REP`);}setText(goalCount,game.goals.filter(g=>!g.complete).length);}

function syncProgression(){
  const stage=game.currentStage(),next=game.unlockStages.find(s=>s.level===game.cityLevel+1),from=stage.threshold??0,to=next?.threshold??from+1,pct=next?clamp((game.completed-from)/(to-from),0,1):1;
  setText(stats.city,stage.short);stats.cityProgress.style.width=`${Math.round(pct*100)}%`;setText(stats.cityNext,next?`${Math.max(0,next.threshold-game.completed)} deliveries → ${next.name}`:'FULL RING ACTIVE');setText($('#map-stage-label'),stage.name.toUpperCase());
}
function renderEvent(){
  const ev=game.currentEvent;if(!ev){eventChip.hidden=true;return;}eventChip.hidden=false;eventChip.dataset.state=ev.state;eventChip.dataset.kind=ev.kind??'route';setText(eventState,ev.state==='active'?'ACTIVE':'FORECAST');setText(eventTitle,`${ev.title} · ${ev.place}`);
  let detail=ev.detail,action='RESPOND · 1 FOCUS';
  if(ev.kind==='demand'){
    if(ev.state==='active')detail=ev.prepared?`${ev.generatedJobs} event jobs · client windows buffered.`:`${ev.generatedJobs} extra jobs hit the desk.`;
    action=ev.prepared?'CAPACITY PLAN ACTIVE':ev.state==='forecast'?'CAPACITY PLAN · 1 FOCUS':'STAGGER CLIENTS · 1 FOCUS';
  }else{
    if(ev.state==='active')detail=ev.prepared?'Prepared routing softens the slowdown.':'Streets are slow · riders reroute at intersections.';
    action=ev.prepared?'ROUTE PLAN ACTIVE':ev.state==='forecast'?'PRE-BRIEF · 1 FOCUS':'DETOUR · 1 FOCUS';
  }
  setText(eventDetail,detail);setText(eventTime,ev.state==='active'?`${formatTime(ev.endsAt-game.elapsed)} left`:`in ${formatTime(ev.startsAt-game.elapsed)}`);eventAdvisory.disabled=ev.prepared||game.dispatchFocus<1;eventAdvisory.dataset.used=String(Boolean(ev.prepared));setText(eventAdvisory,action);
}

function renderInspector(){
  const d=game.deliveryById(game.selectedDeliveryId);if(!d||!game.activeDeliveries().includes(d)){inspector.hidden=true;return;}inspector.hidden=false;
  const type=DELIVERY_TYPES[d.type],cargo=cargoVisual(d.type),assessment=assessRoute(game,d),remaining=d.deadlineAt-game.elapsed,insight=game.deliveryDispatchInsight?.(d),likely=(insight?.bestFinisher?.name??likelyRiders(d,2).map(x=>x.c.name).join(' · '))||'no free rider';
  if(inspectGlyph.dataset.cargo!==d.type){inspectGlyph.replaceChildren();const icon=createCargoIconElement(d.type,{className:'cargo-icon inspector-cargo-icon',title:cargo.label});if(icon)inspectGlyph.append(icon);inspectGlyph.dataset.cargo=d.type;}
  inspectGlyph.style.color=cargo.color;setText(inspectId,d.id.toUpperCase());inspectSpecial.hidden=!d.specialLabel;setText(inspectSpecial,d.specialLabel??'');setText(inspectPickup,d.pickupAddress);setText(inspectDropoff,d.dropoffAddress);setText(inspectTime,`${formatTime(remaining)} left · ${formatTime(assessment?.slackSeconds??remaining)} slack`);setText(inspectDistance,`${formatMeters(assessment?.distanceMeters??d.plannedDistance*10)} · ${assessment?.distanceLabel??'MID'} · ${assessment?.difficultyLabel??'NORMAL'}`);inspectDistance.style.setProperty('--distance',assessment?.distanceColor??'#4f7fc4');inspectDistance.style.setProperty('--difficulty',assessment?.difficultyColor??'#d3a33f');setText(inspectReward,`€${d.reward}`);setText(inspectLikely,insight?`${insight.label} · ${likely} · ${insight.slack}`:`likely: ${likely}`);setText(inspectAdvice,insight?`${insight.recommendation.action} · ${insight.recommendation.reason}`:'');inspectAdvice.dataset.state=insight?.state??'';setText(inspectStreets,d.plannedStreets?.length?d.plannedStreets.slice(0,8).join(' → '):'route pending');const state=game.deliveryToolState(d.id);for(const button of inspector.querySelectorAll('[data-tool]'))button.disabled=!state?.[button.dataset.tool];
}

function renderUI(force=false){
  if(renderer.syncPlayableStage()){updateZoomLabel();force=true;}
  setText(stats.score,Math.round(game.score).toLocaleString());setText(stats.cash,game.cash);setText(stats.rep,Math.round(game.reputation));stats.rep.dataset.level=game.reputation<35?'danger':game.reputation<65?'warn':'good';setText(stats.seed,game.seed);setText(stats.active,game.activeDeliveries().length);setText(stats.called,game.radioUsed());setText(stats.slots,game.radioSlots);setText(stats.trait,game.runTrait.title);setText(stats.traitDesc,game.runTrait.desc);setText(stats.contract,game.runContract.title);setText(stats.contractDesc,game.runContract.desc);setText(stats.focus,game.dispatchFocus);setText(stats.focusMax,game.dispatchFocusMax);setText(noticeEl,game.elapsed<=game.noticeUntil?game.notice:'');setText($('#pause'),game.paused?'▶':'Ⅱ');document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',!game.paused&&Number(b.dataset.speed)===game.speed));syncProgression();renderEvent();syncTasks();syncRiders();syncGoals();renderInspector();if(force)updateZoomLabel();
}

function showUpgrade(){if(!game.upgradePending||shownUpgradeAt===game.nextUpgradeAt)return;shownUpgradeAt=game.nextUpgradeAt;upgradeChoices.replaceChildren();for(const u of game.getUpgradeChoices()){const button=document.createElement('button');button.dataset.upgrade=u.id;const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=u.title;span.textContent=u.desc;button.append(strong,span);upgradeChoices.append(button);}openDialog(upgradeModal);}
function showGameOver(){
  const s=game.summary(),best=Math.max(Number(readLocal('sendit.bestScore','0'))||0,s.score);writeLocal('sendit.bestScore',best);setText(bestEl,best.toLocaleString());summaryEl.replaceChildren();
  for(const[value,label]of[[s.score.toLocaleString(),'Score'],[s.completed,'Delivered'],[s.failed,'Missed'],[s.review.stage,'Area'],[s.review.toolsUsed,'Tools used'],[s.seed,'Seed']]){const box=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=String(value);span.textContent=label;box.append(strong,span);summaryEl.append(box);}
  reviewMetrics.replaceChildren();for(const[value,label]of[[s.review.neverCalled,'Never called'],[s.review.calledUnclaimed,'No taker'],[s.review.claimedLate,'Accepted late'],[s.review.radioDenied,'Radio blocked'],[s.review.breaks,'Breaks'],[s.review.eventsPrepared,'Events prepared']]){const box=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;box.append(strong,span);reviewMetrics.append(box);}
  reviewAdvice.replaceChildren();const top=document.createElement('p');top.textContent=`Top rider: ${s.review.topRider}`;reviewAdvice.append(top);for(const advice of s.review.advice){const p=document.createElement('p');p.textContent=advice;reviewAdvice.append(p);}
  reviewTimeline.replaceChildren();for(const item of game.criticalTimeline()){const row=document.createElement('article');row.className='timeline-item';row.dataset.tone=item.tone;const time=document.createElement('time'),dot=document.createElement('i'),copy=document.createElement('span'),radio=document.createElement('small');time.textContent=formatTime(item.at);copy.textContent=item.label;radio.textContent=`R ${item.radioUsed}/${game.radioSlots}`;row.append(time,dot,copy,radio);reviewTimeline.append(row);}
  openDialog(gameoverModal);
}

function frame(now){const frameDt=Math.min(.25,(now-lastTime)/1000);lastTime=now;accumulator+=frameDt;let steps=0;while(accumulator>=FIXED_STEP&&steps<15){game.update(FIXED_STEP);accumulator-=FIXED_STEP;steps++;}if(steps===15)accumulator=0;if(renderer.syncPlayableStage())updateZoomLabel();renderer.draw();if(now-lastUiRender>=125){renderUI();lastUiRender=now;}showUpgrade();if(game.gameOver&&!gameoverModal.open)showGameOver();requestAnimationFrame(frame);}
function updateZoomLabel(){setText($('#zoom-label'),`${Math.round(renderer.zoom*100)}%`);}
function inspectDelivery(id){game.selectedDeliveryId=game.selectedDeliveryId===id?null:id;game.selectedCourierId=null;renderUI();}

function tipPosition(x,y){const pad=12,rect=hoverTip.getBoundingClientRect(),left=Math.min(window.innerWidth-rect.width-pad,x+14),top=Math.min(window.innerHeight-rect.height-pad,y+14);hoverTip.style.left=`${Math.max(pad,left)}px`;hoverTip.style.top=`${Math.max(pad,top)}px`;}
function showTip(title,lines,x,y,owner=null){hoverTip.replaceChildren();const strong=document.createElement('strong');strong.textContent=title;hoverTip.append(strong);for(const line of lines.filter(Boolean)){const div=document.createElement('small');div.textContent=line;div.style.display='block';hoverTip.append(div);}hoverTip.hidden=false;tooltipOwner=owner;requestAnimationFrame(()=>tipPosition(x,y));}
function hideTip(owner=null){if(owner&&tooltipOwner!==owner)return;hoverTip.hidden=true;hoverTip.replaceChildren();tooltipOwner=null;}
function channelSummary(insight){if(!insight)return null;return ['open','local','priority'].map(id=>{const item=insight.channels[id];return `${id==='open'?'O':id==='local'?'L':'!'} ${item.bestRider?.name??'—'} ${item.fit}`;}).join(' · ');}
function taskTip(d,x,y){
  if(!d)return;const type=DELIVERY_TYPES[d.type],assessment=assessRoute(game,d),insight=game.deliveryDispatchInsight?.(d),nearest=likelyRiders(d,2).map(v=>v.c.name).join(', ')||'none free';
  showTip(`${d.id.toUpperCase()} · ${type.label}${d.specialLabel?` · ${d.specialLabel}`:''}`,[`${d.pickupAddress} → ${d.dropoffAddress}`,`${formatMeters(assessment?.distanceMeters??d.plannedDistance*10)} · ${assessment?.distanceLabel??'MID'} · ${assessment?.difficultyLabel??'NORMAL'} · ${formatTime(d.deadlineAt-game.elapsed)} left`,`${formatTime(assessment?.slackSeconds??0)} slack · event ${Math.round((assessment?.eventExposure??0)*100)}% · bike lane ${Math.round((assessment?.bikeLaneShare??0)*100)}%`,insight?`${insight.label} · ${insight.slack} · best ${insight.bestFinisher?.name??'none'}`:`Likely riders: ${nearest}`,channelSummary(insight),insight?`${insight.recommendation.action}: ${insight.recommendation.reason}`:null,d.specialDesc,d.plannedStreets?.slice(0,6).join(' → ')],x,y,`task:${d.id}`);
}
function riderTip(c,x,y){
  if(!c)return;const d=c.deliveryId?game.deliveryById(c.deliveryId):null,predicted=game.predictCall(c),progress=Math.round(game.courierTaskProgress(c)*100),energy=Math.round((1-c.fatigue)*100),insight=game.riderDispatchInsight?.(c),calls=insight?.calls?.map(item=>`${item.delivery.id.toUpperCase()} ${item.fit.toLowerCase()} · ${item.reason}`).join(' | ');
  showTip(`${c.name} · ${c.experience.title}`,[`${c.personality.icon} ${c.personality.title}: ${c.personality.desc}`,`Location: ${riderLocation(c)}`,d?`${d.id.toUpperCase()} · ${progress}% · ETA ${formatTime(game.courierETA(c)??0)}`:predicted?`Likely to consider ${predicted.delivery.id.toUpperCase()}`:'Listening',`Energy ${energy}%${c.phase==='break'?` · back ${formatTime(game.breakRemaining(c))}`:''}`,calls?`Live fit: ${calls}`:null],x,y,`rider:${c.id}`);
}

function toggleHelp(show=!helpPanel.hidden,first=false){if(show){helpPauseWas=first?false:game.paused;game.paused=true;helpPanel.hidden=false;}else{helpPanel.hidden=true;writeLocal('sendit.help.v5','1');game.paused=helpPauseWas;}renderUI();}

canvas.addEventListener('wheel',event=>{event.preventDefault();const rect=canvas.getBoundingClientRect();renderer.zoomAt(event.clientX-rect.left,event.clientY-rect.top,event.deltaY<0?1.14:.88);updateZoomLabel();},{passive:false});
canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');hideTip();});
canvas.addEventListener('pointermove',event=>{if(drag&&drag.id===event.pointerId){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;drag.x=event.clientX;drag.y=event.clientY;if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5)suppressCanvasClick=true;renderer.pan(dx,dy);return;}const rect=canvas.getBoundingClientRect(),point=renderer.screenToWorld(event.clientX-rect.left,event.clientY-rect.top),entity=game.nearestEntity(point.x,point.y,23/renderer.scale);game.hoveredDeliveryId=entity?.type==='delivery'?entity.id:null;game.hoveredCourierId=entity?.type==='courier'?entity.id:null;if(entity?.type==='delivery')taskTip(game.deliveryById(entity.id),event.clientX,event.clientY);else if(entity?.type==='courier')riderTip(game.courierById(entity.id),event.clientX,event.clientY);else hideTip();});
canvas.addEventListener('pointerleave',()=>{if(!drag){game.hoveredDeliveryId=null;game.hoveredCourierId=null;hideTip();}});
canvas.addEventListener('pointerup',event=>{if(!drag||drag.id!==event.pointerId)return;drag=null;canvas.releasePointerCapture(event.pointerId);canvas.classList.remove('dragging');setTimeout(()=>{suppressCanvasClick=false;},0);});
canvas.addEventListener('click',event=>{if(suppressCanvasClick)return;const rect=canvas.getBoundingClientRect(),point=renderer.screenToWorld(event.clientX-rect.left,event.clientY-rect.top),entity=game.nearestEntity(point.x,point.y,24/renderer.scale);if(!entity)return;if(entity.type==='delivery')inspectDelivery(entity.id);else{game.selectCourier(entity.id);game.selectedDeliveryId=null;renderUI();}});

deliveriesEl.addEventListener('click',event=>{const card=event.target.closest('[data-delivery]');if(!card)return;const d=game.deliveryById(card.dataset.delivery);if(!d)return;const channel=event.target.closest('[data-channel]');if(channel){game.setChannel(d.id,channel.dataset.channel);renderUI();return;}inspectDelivery(d.id);});
deliveriesEl.addEventListener('pointerover',event=>{const card=event.target.closest('[data-delivery]');if(!card)return;game.hoveredDeliveryId=card.dataset.delivery;taskTip(game.deliveryById(card.dataset.delivery),event.clientX,event.clientY);});
deliveriesEl.addEventListener('pointermove',event=>{if(game.hoveredDeliveryId)tipPosition(event.clientX,event.clientY);});
deliveriesEl.addEventListener('pointerout',event=>{const card=event.target.closest('[data-delivery]');if(card&&event.relatedTarget&&!card.contains(event.relatedTarget)){game.hoveredDeliveryId=null;hideTip(`task:${card.dataset.delivery}`);}});

couriersEl.addEventListener('click',event=>{const card=event.target.closest('[data-courier]');if(!card)return;game.selectCourier(card.dataset.courier);game.selectedDeliveryId=null;renderUI();});
couriersEl.addEventListener('pointerover',event=>{const card=event.target.closest('[data-courier]');if(!card)return;game.hoveredCourierId=card.dataset.courier;riderTip(game.courierById(card.dataset.courier),event.clientX,event.clientY);});
couriersEl.addEventListener('pointermove',event=>{if(game.hoveredCourierId)tipPosition(event.clientX,event.clientY);});
couriersEl.addEventListener('pointerout',event=>{const card=event.target.closest('[data-courier]');if(card&&event.relatedTarget&&!card.contains(event.relatedTarget)){game.hoveredCourierId=null;hideTip(`rider:${card.dataset.courier}`);}});

document.addEventListener('pointerover',event=>{const target=event.target.closest?.('[data-tip]');if(!target||target.closest('.task-card'))return;showTip(target.textContent.trim(),[target.dataset.tip],event.clientX,event.clientY,target);});
document.addEventListener('pointermove',event=>{if(tooltipOwner instanceof Element)tipPosition(event.clientX,event.clientY);});
document.addEventListener('pointerout',event=>{const target=event.target.closest?.('[data-tip]');if(target&&tooltipOwner===target&&(!event.relatedTarget||!target.contains(event.relatedTarget)))hideTip(target);});

inspector.addEventListener('click',event=>{const button=event.target.closest('[data-tool]');if(!button)return;const d=game.deliveryById(game.selectedDeliveryId);if(!d)return;let changed=false;if(button.dataset.tool==='sweeten')changed=game.sweetenJob(d.id);if(button.dataset.tool==='extend')changed=game.extendJob(d.id);if(button.dataset.tool==='rebroadcast')changed=game.rebroadcastJob(d.id);if(changed)renderUI();});
$('#inspect-close').addEventListener('click',()=>{game.selectedDeliveryId=null;renderUI();});
eventAdvisory.addEventListener('click',()=>{if(game.respondToCityEvent())renderUI();});
upgradeChoices.addEventListener('click',event=>{const button=event.target.closest('[data-upgrade]');if(button&&game.applyUpgrade(button.dataset.upgrade)){closeDialog(upgradeModal);renderUI(true);}});
$('#pause').addEventListener('click',()=>{game.paused=!game.paused;renderUI();});document.querySelectorAll('[data-speed]').forEach(button=>button.addEventListener('click',()=>{game.speed=Number(button.dataset.speed);game.paused=false;renderUI();}));
$('#new-run').addEventListener('click',()=>start(createSeed()));$('#same-seed').addEventListener('click',()=>start(game.seed));$('#random-seed').addEventListener('click',()=>start(createSeed()));
$('#zoom-in').addEventListener('click',()=>{renderer.zoomAt(renderer.viewWidth/2,renderer.viewHeight/2,1.18);updateZoomLabel();});$('#zoom-out').addEventListener('click',()=>{renderer.zoomAt(renderer.viewWidth/2,renderer.viewHeight/2,.84);updateZoomLabel();});$('#zoom-reset').addEventListener('click',()=>{renderer.resetView();updateZoomLabel();});
$('#help-toggle').addEventListener('click',()=>toggleHelp(helpPanel.hidden));$('#help-close').addEventListener('click',()=>toggleHelp(false));$('#help-done').addEventListener('click',()=>toggleHelp(false));
window.addEventListener('keydown',event=>{if(upgradeModal.open||gameoverModal.open)return;if(event.key==='?'||event.key==='h'||event.key==='H'){event.preventDefault();toggleHelp(helpPanel.hidden);return;}if(!helpPanel.hidden){if(event.key==='Escape')toggleHelp(false);return;}if(event.key===' '){event.preventDefault();game.paused=!game.paused;renderUI();}if(event.key==='1'){game.speed=1;game.paused=false;}if(event.key==='2'){game.speed=2;game.paused=false;}if(event.key==='3'){game.speed=4;game.paused=false;}if(event.key==='0'){renderer.resetView();updateZoomLabel();}if(event.key==='Escape'){game.selectedDeliveryId=null;game.selectedCourierId=null;renderUI();}});
window.addEventListener('resize',()=>renderer.resize());

start();requestAnimationFrame(frame);
