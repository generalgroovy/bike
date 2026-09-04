import { Game } from './game.js';
import { audio,AUDIO_THEME } from './audio-engine.js';

const style=document.createElement('link');style.rel='stylesheet';style.href='sensory.css';document.head.append(style);
const soundToggle=document.querySelector('#sound-toggle');
const metricEls={rep:document.querySelector('#rep')?.parentElement,cash:document.querySelector('#cash')?.parentElement,score:document.querySelector('#score')?.parentElement,focus:document.querySelector('#focus')?.closest('div')};
const readSound=()=>{try{return localStorage.getItem('sendit.sound.v6')!=='0';}catch{return true;}};
const writeSound=value=>{try{localStorage.setItem('sendit.sound.v6',value?'1':'0');}catch{}};
audio.enabled=readSound();
function syncSoundButton(){if(!soundToggle)return;soundToggle.dataset.muted=String(!audio.enabled);soundToggle.textContent=audio.enabled?'♫ SOUND':'× SOUND';soundToggle.setAttribute('aria-pressed',String(audio.enabled));}
syncSoundButton();

document.documentElement.dataset.audioKey=AUDIO_THEME.key;document.documentElement.dataset.audioBpm=String(AUDIO_THEME.bpm);
const unlock=()=>audio.ensure();document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock,{passive:true});
soundToggle?.addEventListener('click',()=>{audio.enabled=!audio.enabled;writeSound(audio.enabled);syncSoundButton();if(audio.enabled){audio.ensure();audio.cue('radio-on');}});

let game=null,logIndex=0,lastHovered='',lastSelectedDelivery=null,lastSelectedCourier=null,lastPressureCue=0,lastDemandPhase=null,lastMetrics=null;
const deliveryPings=new Map(),riderMotion=new Map(),pulseTimers=new WeakMap();
const now=()=>typeof performance!=='undefined'?performance.now()/1000:Date.now()/1000;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function worldPan(g,nodeId){const n=g.nodeById(nodeId);return n?clamp((n.x/g.width)*2-1,-.8,.8):0;}
function riderIndex(name){return Math.max(0,game?.couriers.findIndex(c=>c.name===name)??0);}
function pulse(el,kind='neutral',duration=360){if(!el)return;el.dataset.sensory=kind;el.classList.remove('sensory-pop');void el.offsetWidth;el.classList.add('sensory-pop');const old=pulseTimers.get(el);if(old)clearTimeout(old);pulseTimers.set(el,setTimeout(()=>el.classList.remove('sensory-pop'),duration));}
function cueLog(entry){const data={riderIndex:riderIndex(entry.rider),flow:entry.flow};switch(entry.action){
  case'call':case'channel':audio.cue(`call-${entry.channel??'open'}`,data);break;
  case'uncall':audio.cue('call-off',data);break;
  case'radio-denied':audio.cue('radio-denied',data);break;
  case'sweeten':audio.cue('tool-sweeten',data);break;
  case'client-call':audio.cue('tool-extend',data);break;
  case'rebroadcast':audio.cue('tool-rebroadcast',data);break;
  case'claim':audio.cue('claim',data);break;
  case'pickup':audio.cue('pickup',data);break;
  case'complete':audio.cue('complete',data);break;
  case'fail':audio.cue('fail',data);break;
  case'service-breach':audio.cue('breach',data);break;
  case'district-brief':case'event-response':audio.cue('brief',data);break;
  case'event-forecast':audio.cue('event-forecast',data);break;
  case'event-start':audio.cue(entry.kind==='demand'?'event-demand':entry.kind==='route'?'event-route':'event-start',data);break;
  case'event-end':audio.cue('event-end',data);break;
  case'break':audio.cue('break',data);break;
  case'radio-on':audio.cue('radio-on',data);break;
  case'goal':audio.cue('goal',data);break;
  case'upgrade':audio.cue('upgrade',data);break;
  case'flow':audio.cue('flow',data);break;
  case'flow-break':audio.cue('flow-break',data);break;
  case'city-expand':audio.cue('city-expand',data);break;
}}
function processLogs(){for(;logIndex<game.dispatchLog.length;logIndex++)cueLog(game.dispatchLog[logIndex]);}
function pingDeliveries(t){const jobs=game.activeDeliveries().filter(d=>d.status==='waiting').sort((a,b)=>game.urgency(a)-game.urgency(b));for(const d of jobs){const urgency=game.urgency(d),urgent=urgency<.3,interval=urgent?.72:d.called?1.8:3.4,last=deliveryPings.get(d.id)??-Infinity;if(t-last<interval)continue;deliveryPings.set(d.id,t);audio.ping({urgent,pan:worldPan(game,d.pickupId),type:d.type});const card=document.querySelector(`[data-delivery="${d.id}"]`);if(card){card.dataset.ping=urgent?'urgent':'normal';pulse(card,urgent?'danger':'sonar',urgent?330:240);}break;}for(const id of deliveryPings.keys())if(!game.deliveryById(id)||!jobs.some(d=>d.id===id))deliveryPings.delete(id);}
function riderNotes(t){for(let i=0;i<game.couriers.length;i++){const c=game.couriers[i],prev=riderMotion.get(c.id),card=document.querySelector(`[data-courier="${c.id}"]`);riderMotion.set(c.id,{x:c.x,y:c.y,t});if(!prev||c.phase==='break'||!c.radioOn){if(card)card.dataset.motion=c.phase==='break'||!c.radioOn?'rest':'idle';continue;}const dt=Math.max(.02,t-prev.t),speed=Math.hypot(c.x-prev.x,c.y-prev.y)/dt,relative=speed/Math.max(1,c.baseSpeed);if(card)card.dataset.motion=relative>1.12?'fast':relative>.42?'moving':'idle';if(relative<.42)continue;audio.riderSpeed(i,relative);}}
function pressureTone(t){const pressure=typeof game.cityPressure==='function'?game.cityPressure():0;if(pressure<58||t-lastPressureCue<Math.max(.85,3.4-pressure/34))return;lastPressureCue=t;audio.cue('pressure',{pressure});}
function demandCue(){if(typeof game.demandPhase!=='function')return;const phase=game.demandPhase().id;if(lastDemandPhase==null){lastDemandPhase=phase;return;}if(phase!==lastDemandPhase){lastDemandPhase=phase;audio.cue(`phase-${phase}`);}}
function metricCues(){const next={rep:Math.round(game.reputation),cash:game.cash,score:Math.round(game.score),focus:game.dispatchFocus,radio:game.radioUsed(),slots:game.radioSlots};if(!lastMetrics){lastMetrics=next;return;}if(next.cash!==lastMetrics.cash){pulse(metricEls.cash,next.cash>lastMetrics.cash?'good':'warn');audio.cue(next.cash>lastMetrics.cash?'metric-cash-up':'metric-cash-down');}if(next.rep!==lastMetrics.rep){pulse(metricEls.rep,next.rep>lastMetrics.rep?'good':'danger');audio.cue(next.rep>lastMetrics.rep?'metric-rep-up':'metric-rep-down');}if(next.focus!==lastMetrics.focus){pulse(metricEls.focus,next.focus>lastMetrics.focus?'good':'focus');audio.cue(next.focus>lastMetrics.focus?'metric-focus-up':'metric-focus-down');}if(next.score!==lastMetrics.score)pulse(metricEls.score,'score',260);if(next.radio>=next.slots&&lastMetrics.radio<lastMetrics.slots)audio.cue('metric-radio-full');lastMetrics=next;}
function selectionCues(){if(game.selectedDeliveryId!==lastSelectedDelivery){lastSelectedDelivery=game.selectedDeliveryId;if(lastSelectedDelivery){const d=game.deliveryById(lastSelectedDelivery);audio.cue('select-job',{pan:d?worldPan(game,d.pickupId):0});}}if(game.selectedCourierId!==lastSelectedCourier){lastSelectedCourier=game.selectedCourierId;if(lastSelectedCourier){const i=game.couriers.findIndex(c=>c.id===lastSelectedCourier);audio.cue('select-rider',{riderIndex:Math.max(0,i)});}}}
function exposeFlow(){const flow=typeof game.serviceFlowState==='function'?game.serviceFlowState():null;document.documentElement.dataset.flow=String(flow?.streak??0);return flow?.streak??0;}
function reset(next){game=next;logIndex=next.dispatchLog.length;deliveryPings.clear();riderMotion.clear();lastSelectedDelivery=next.selectedDeliveryId;lastSelectedCourier=next.selectedCourierId;lastPressureCue=0;lastDemandPhase=typeof next.demandPhase==='function'?next.demandPhase().id:null;lastMetrics={rep:Math.round(next.reputation),cash:next.cash,score:Math.round(next.score),focus:next.dispatchFocus,radio:next.radioUsed(),slots:next.radioSlots};exposeFlow();}
function tick(){const next=Game.lastInstance;if(!next)return;if(next!==game)reset(next);const t=now();processLogs();selectionCues();demandCue();metricCues();const flow=exposeFlow();if(!game.paused&&!game.gameOver&&audio.enabled){pingDeliveries(t);riderNotes(t);pressureTone(t);audio.ambience({phase:lastDemandPhase??'quiet',pressure:typeof game.cityPressure==='function'?game.cityPressure():0,flow});}}
setInterval(tick,90);

function hoverTarget(event){return event.target.closest?.('.task-card,.rider-card,.goal-card,#event-chip,[data-channel],[data-tool],[data-speed],.client-hub-chip,.demand-rhythm,.service-load,.district-brief,.map-tools button,.time-tools button,.top-actions button,.brand,.shift-chip,.city-chip,.metrics>div');}
document.addEventListener('pointerover',event=>{const target=hoverTarget(event);if(!target)return;const key=target.dataset.delivery?`job:${target.dataset.delivery}`:target.dataset.courier?`rider:${target.dataset.courier}`:target.dataset.channel?`channel:${target.dataset.channel}`:target.dataset.tool?`tool:${target.dataset.tool}`:target.id||String(target.className);if(key===lastHovered)return;lastHovered=key;if(target.dataset.delivery)audio.cue('hover-job');else if(target.dataset.courier){const i=game?.couriers.findIndex(c=>c.id===target.dataset.courier)??0;audio.cue('hover-rider',{riderIndex:Math.max(0,i)});}else if(target.dataset.channel)audio.cue(`hover-radio-${target.dataset.channel}`);else if(target.dataset.tool)audio.cue(`hover-tool-${target.dataset.tool}`);else if(target.classList.contains('shift-chip'))audio.cue('hover-shift');else if(target.classList.contains('city-chip'))audio.cue('hover-city');else if(target.classList.contains('service-load'))audio.cue('hover-load');else if(target.classList.contains('goal-card'))audio.cue('hover-goal');else audio.cue('ui-hover');});
document.addEventListener('pointerout',event=>{if(!event.relatedTarget||!hoverTarget({target:event.relatedTarget}))lastHovered='';});
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-tool],[data-speed],#pause,#zoom-in,#zoom-out,#zoom-reset,#help-toggle,#new-run,#same-seed,#random-seed,#event-advisory');if(!target||target===soundToggle)return;let cue='ui-click';if(target.dataset.speed)cue=`control-speed-${target.dataset.speed}`;else if(target.id==='pause')cue='control-pause';else if(target.id==='zoom-in')cue='control-zoom-in';else if(target.id==='zoom-out')cue='control-zoom-out';else if(target.id==='zoom-reset')cue='control-fit';else if(target.id==='help-toggle')cue='control-help';else if(['new-run','same-seed','random-seed'].includes(target.id))cue='control-new';else if(target.id==='event-advisory')cue='brief';audio.cue(cue);});
