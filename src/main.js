import { Game, DELIVERY_TYPES, RADIO_CHANNELS } from './game.js';
import { createSeed } from './rng.js';
import { Renderer } from './render.js';

const FIXED_STEP=1/60;
const canvas=document.querySelector('#game-canvas');
const stats={score:document.querySelector('#score'),cash:document.querySelector('#cash'),rep:document.querySelector('#rep'),wave:document.querySelector('#wave'),seed:document.querySelector('#seed'),active:document.querySelector('#active-count'),called:document.querySelector('#called-count'),slots:document.querySelector('#radio-slots'),trait:document.querySelector('#trait'),traitDesc:document.querySelector('#trait-desc')};
const deliveriesEl=document.querySelector('#deliveries'),couriersEl=document.querySelector('#couriers'),goalsEl=document.querySelector('#goals'),noticeEl=document.querySelector('#notice');
const upgradeModal=document.querySelector('#upgrade-modal'),upgradeChoices=document.querySelector('#upgrade-choices'),gameoverModal=document.querySelector('#gameover-modal'),summaryEl=document.querySelector('#run-summary'),bestEl=document.querySelector('#best-score'),helpModal=document.querySelector('#help-modal');
const eventChip=document.querySelector('#event-chip'),eventState=document.querySelector('#event-state'),eventTitle=document.querySelector('#event-title'),eventDetail=document.querySelector('#event-detail'),eventTime=document.querySelector('#event-time');
const reviewMetrics=document.querySelector('#review-metrics'),reviewAdvice=document.querySelector('#review-advice'),reviewTimeline=document.querySelector('#review-timeline');
let game,renderer,lastTime=performance.now(),accumulator=0,lastUiRender=0,shownUpgradeAt=-1,helpWasPaused=false;

function openDialog(dialog){dialog.hidden=false;if(dialog.open)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
function closeDialog(dialog){if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;}
function currentSeed(){const raw=new URLSearchParams(location.search).get('seed');if(!raw)return createSeed();const cleaned=raw.toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,32);return cleaned||createSeed();}
function readLocal(key,fallback=''){try{return localStorage.getItem(key)??fallback;}catch{return fallback;}}
function writeLocal(key,value){try{localStorage.setItem(key,String(value));}catch{}}
function loadBestScore(){return Number(readLocal('bike.bestScore','0'))||0;}
function syncUrl(seed){const url=new URL(location.href);url.searchParams.set('seed',seed);history.replaceState(null,'',url);}
function formatTime(seconds){const value=Math.max(0,Math.ceil(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;}
function kmFromWorld(value){return `${Math.max(.1,value/155).toFixed(1)} km`;}
function endpointLabel(node){return node.short??node.name??node.id;}

function start(seed=currentSeed()){
  game=new Game({seed});renderer=new Renderer(canvas,game);lastTime=performance.now();accumulator=0;lastUiRender=0;shownUpgradeAt=-1;
  closeDialog(upgradeModal);closeDialog(gameoverModal);closeDialog(helpModal);syncUrl(seed);renderUI();
  if(readLocal('bike.seenDeepBrief')!=='1'){helpWasPaused=game.paused;game.paused=true;openDialog(helpModal);}
}

function renderEvent(){const event=game.currentEvent;if(!event){eventChip.hidden=true;return;}eventChip.hidden=false;eventChip.dataset.state=event.state;eventState.textContent=event.state==='active'?'ACTIVE NOW':'FORECAST';eventTitle.textContent=`${event.title} · ${event.place}`;eventDetail.textContent=event.state==='active'?'Affected corridor is slower. Riders re-evaluate routes at intersections.':event.detail;eventTime.textContent=event.state==='active'?`${formatTime(event.endsAt-game.elapsed)} remaining`:`starts in ${formatTime(event.startsAt-game.elapsed)}`;}

function channelButton(delivery,id){const channel=RADIO_CHANNELS[id],active=delivery.called&&delivery.channel===id;return `<button class="channel-btn ${active?'active':''} channel-${id}" data-channel="${id}" title="${channel.desc}">${channel.short}<small>${channel.cost}</small></button>`;}

function renderUI(){
  stats.score.textContent=Math.round(game.score).toLocaleString();stats.cash.textContent=`€${game.cash}`;stats.rep.textContent=`${Math.round(game.reputation)}%`;stats.rep.dataset.level=game.reputation<35?'danger':game.reputation<65?'warn':'good';stats.wave.textContent=game.wave;stats.seed.textContent=game.seed;stats.active.textContent=game.activeDeliveries().length;stats.called.textContent=game.radioUsed();stats.slots.textContent=game.radioSlots;stats.trait.textContent=game.runTrait.title;stats.traitDesc.textContent=game.runTrait.desc;noticeEl.textContent=game.elapsed<=game.noticeUntil?game.notice:'';renderEvent();

  const active=game.activeDeliveries().sort((a,b)=>a.status!==b.status?(a.status==='waiting'?-1:1):a.deadlineAt-b.deadlineAt).slice(0,16);
  deliveriesEl.innerHTML=active.map((delivery)=>{
    const type=DELIVERY_TYPES[delivery.type],remaining=delivery.deadlineAt-game.elapsed,pickup=game.nodeById(delivery.pickupId),dropoff=game.nodeById(delivery.dropoffId),claimed=delivery.status==='claimed',nearest=game.nearestIdleDistance(delivery),channel=RADIO_CHANNELS[delivery.channel];
    const state=claimed?`${game.courierById(delivery.courierId)?.name??'Rider'} took it`:delivery.called?`${channel?.short??'OPEN'} RADIO`:'UNCALLED';
    const distanceHint=claimed?'rider committed':nearest==null?'no free riders':`${kmFromWorld(nearest)} to nearest free rider`;
    const controls=claimed?'<span class="taken-note">RIDER COMMITTED</span>':`${channelButton(delivery,'open')}${channelButton(delivery,'priority')}${channelButton(delivery,'local')}${delivery.called?'<button class="channel-btn off" data-channel="off">OFF</button>':''}`;
    return `<article class="delivery-card ${delivery.called?'called':''} ${claimed?'claimed':''}" data-delivery="${delivery.id}" style="--accent:${type.color};--channel:${channel?.color??type.color}">
      <button class="job-inspect" data-inspect="${delivery.id}" aria-label="Inspect ${delivery.id}"><span class="glyph">${delivery.pickedUp?'◎':type.glyph}</span><span class="job-copy"><span class="job-top"><strong>${delivery.id.toUpperCase()} · ${type.label}</strong><em>${state}</em></span><small>${endpointLabel(pickup)} → ${endpointLabel(dropoff)}</small><small class="distance-hint">${distanceHint} · €${delivery.reward}</small></span><time class="${remaining<16?'urgent':''}">${formatTime(remaining)}</time></button>
      <div class="channel-actions">${controls}</div></article>`;
  }).join('')||'<p class="empty">No open jobs. Watch the map.</p>';

  couriersEl.innerHTML=game.couriers.map((courier)=>{
    const selected=game.selectedCourierId===courier.id,busy=courier.phase!=='idle',home=game.districts.find((d)=>d.id===courier.homeDistrict)?.name??'Berlin',predicted=game.predictCall(courier),confidence=courier.experience.level>=4?'high':courier.experience.level>=3?'good':courier.experience.level>=2?'medium':'low';
    let intent=courier.lastDecision,status=busy?(courier.phase==='pickup'?'PICKUP':'DELIVERY'):'LISTENING';
    if(courier.deliberation){const pct=Math.round(game.deliberationProgress(courier)*100),delivery=game.deliveryById(courier.deliberation.deliveryId);intent=`Considering ${delivery?.id.toUpperCase()??'call'} · ${pct}% · ${courier.deliberation.reason}`;status='THINKING';}
    else if(predicted&&!busy)intent=`Likely ${predicted.delivery.id.toUpperCase()} · ${confidence} confidence`;
    return `<button class="courier-card ${selected?'selected':''}" data-courier="${courier.id}" style="--accent:${courier.color}"><span class="courier-dot"></span><span class="rider-copy"><span class="rider-name"><strong>${courier.name}</strong><em>${courier.experience.title} · Lv${courier.experience.level}</em></span><small><b>${courier.personality.icon} ${courier.personality.title}</b> — ${courier.personality.desc}</small><small class="decision">${intent}</small></span><span class="status-pill ${courier.deliberation?'thinking':courier.phase}">${status}</span><span class="home-tag">home bias · ${home}</span></button>`;
  }).join('');

  goalsEl.innerHTML=game.goals.map((goal)=>{const pct=Math.min(100,goal.progress/goal.target*100);return `<article class="goal-card ${goal.complete?'complete':''}"><div><strong>${goal.complete?'✓ ':''}${goal.label}</strong><span>${goal.progress}/${goal.target}</span></div><p>${goal.detail}</p><div class="goal-bar"><i style="width:${pct}%"></i></div><small>${goal.complete?'Complete':`Reward €${goal.reward} + reputation`}</small></article>`;}).join('');
}

function showUpgrade(){if(!game.upgradePending||shownUpgradeAt===game.nextUpgradeAt)return;shownUpgradeAt=game.nextUpgradeAt;const choices=game.getUpgradeChoices();upgradeChoices.innerHTML=choices.map((u)=>`<button class="upgrade-card" data-upgrade="${u.id}"><strong>${u.title}</strong><span>${u.desc}</span></button>`).join('');openDialog(upgradeModal);}

function renderReview(review){
  const metricRows=[['Never called',review.neverCalled],['Called, no taker',review.calledUnclaimed],['Accepted too late',review.claimedLate],['Blocked by bandwidth',review.radioDenied],['Priority success',review.prioritySuccess==null?'—':`${review.prioritySuccess}%`],['Local success',review.localSuccess==null?'—':`${review.localSuccess}%`]];
  reviewMetrics.innerHTML=metricRows.map(([label,value])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  reviewAdvice.innerHTML=`<p class="top-rider"><b>Top rider:</b> ${review.topRider}</p>${review.advice.map((item)=>`<p>${item}</p>`).join('')}`;
  reviewTimeline.innerHTML=review.timeline.length?review.timeline.map((item)=>`<li>${item}</li>`).join(''):'<li>No critical events recorded.</li>';
}

function showGameOver(){const s=game.summary(),best=Math.max(loadBestScore(),s.score);writeLocal('bike.bestScore',best);bestEl.textContent=best.toLocaleString();summaryEl.replaceChildren();for(const[value,label]of[[s.score.toLocaleString(),'Score'],[s.completed,'Delivered'],[s.failed,'Missed'],[`${s.goals}/${game.goals.length}`,'City goals'],[s.riderChoices,'Rider choices'],[s.seed,'Seed']]){const box=document.createElement('div'),strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=String(value);span.textContent=label;box.append(strong,span);summaryEl.append(box);}renderReview(s.review);openDialog(gameoverModal);}

function frame(now){const frameDt=Math.min(.25,(now-lastTime)/1000);lastTime=now;accumulator+=frameDt;let steps=0;while(accumulator>=FIXED_STEP&&steps<15){game.update(FIXED_STEP);accumulator-=FIXED_STEP;steps+=1;}if(steps===15)accumulator=0;renderer.draw();if(now-lastUiRender>=100){renderUI();lastUiRender=now;}showUpgrade();if(game.gameOver&&!gameoverModal.open)showGameOver();requestAnimationFrame(frame);}

canvas.addEventListener('click',(event)=>{const rect=canvas.getBoundingClientRect(),point=renderer.screenToWorld(event.clientX-rect.left,event.clientY-rect.top),entity=game.nearestEntity(point.x,point.y,26/renderer.scale);if(!entity)return;if(entity.type==='delivery')game.toggleCall(entity.id);if(entity.type==='courier')game.selectCourier(entity.id);renderUI();});
deliveriesEl.addEventListener('click',(event)=>{const article=event.target.closest('[data-delivery]');if(!article)return;const delivery=game.deliveryById(article.dataset.delivery);if(!delivery)return;const channelButtonEl=event.target.closest('[data-channel]');if(channelButtonEl){game.setChannel(delivery.id,channelButtonEl.dataset.channel);renderUI();return;}if(event.target.closest('[data-inspect]')){game.selectDelivery(delivery.id);renderUI();}});
couriersEl.addEventListener('click',(event)=>{const button=event.target.closest('[data-courier]');if(button){game.selectCourier(button.dataset.courier);renderUI();}});
upgradeChoices.addEventListener('click',(event)=>{const button=event.target.closest('[data-upgrade]');if(!button)return;game.applyUpgrade(button.dataset.upgrade);closeDialog(upgradeModal);renderUI();});
document.querySelector('#pause').addEventListener('click',()=>{game.paused=!game.paused;});document.querySelectorAll('[data-speed]').forEach((button)=>button.addEventListener('click',()=>{game.speed=Number(button.dataset.speed);game.paused=false;}));
document.querySelector('#new-run').addEventListener('click',()=>start(createSeed()));document.querySelector('#same-seed').addEventListener('click',()=>start(game.seed));document.querySelector('#random-seed').addEventListener('click',()=>start(createSeed()));
document.querySelector('#help').addEventListener('click',()=>{helpWasPaused=game.paused;game.paused=true;openDialog(helpModal);});document.querySelector('#close-help').addEventListener('click',()=>{writeLocal('bike.seenDeepBrief','1');closeDialog(helpModal);game.paused=helpWasPaused;});
window.addEventListener('keydown',(event)=>{if(helpModal.open||upgradeModal.open||gameoverModal.open)return;if(event.key===' '){event.preventDefault();game.paused=!game.paused;}if(event.key==='1'){game.speed=1;game.paused=false;}if(event.key==='2'){game.speed=2;game.paused=false;}if(event.key==='3'){game.speed=4;game.paused=false;}if(event.key==='Escape'){game.selectedDeliveryId=null;game.selectedCourierId=null;renderUI();}});
window.addEventListener('resize',()=>renderer.resize());start();requestAnimationFrame(frame);
