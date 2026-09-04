import { Game } from './game.js';
import { audio,AUDIO_THEME } from './audio-engine.js';

const style=document.createElement('link');style.rel='stylesheet';style.href='sensory.css';document.head.append(style);
const soundToggle=document.querySelector('#sound-toggle');
const readSound=()=>{try{return localStorage.getItem('sendit.sound.v6')!=='0';}catch{return true;}};
const writeSound=value=>{try{localStorage.setItem('sendit.sound.v6',value?'1':'0');}catch{}};
audio.enabled=readSound();
function syncSoundButton(){if(!soundToggle)return;soundToggle.dataset.muted=String(!audio.enabled);soundToggle.textContent=audio.enabled?'♫ SOUND':'× SOUND';soundToggle.setAttribute('aria-pressed',String(audio.enabled));}
syncSoundButton();

document.documentElement.dataset.audioKey=AUDIO_THEME.key;document.documentElement.dataset.audioBpm=String(AUDIO_THEME.bpm);
const unlock=()=>audio.ensure();document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock,{passive:true});
soundToggle?.addEventListener('click',()=>{audio.enabled=!audio.enabled;writeSound(audio.enabled);syncSoundButton();if(audio.enabled){audio.ensure();audio.cue('radio-on');}});

let game=null,logIndex=0,lastHovered='',lastSelectedDelivery=null,lastSelectedCourier=null,lastPressureCue=0;
const deliveryPings=new Map(),riderMotion=new Map();
const now=()=>typeof performance!=='undefined'?performance.now()/1000:Date.now()/1000;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function worldPan(g,nodeId){const n=g.nodeById(nodeId);return n?clamp((n.x/g.width)*2-1,-.8,.8):0;}
function riderIndex(name){return Math.max(0,game?.couriers.findIndex(c=>c.name===name)??0);}
function cueLog(entry){const data={riderIndex:riderIndex(entry.rider),flow:entry.flow};switch(entry.action){
  case'call':case'channel':audio.cue(`call-${entry.channel??'open'}`,data);break;
  case'uncall':audio.cue('call-off',data);break;
  case'radio-denied':audio.cue('radio-denied',data);break;
  case'claim':audio.cue('claim',data);break;
  case'pickup':audio.cue('pickup',data);break;
  case'complete':audio.cue('complete',data);break;
  case'fail':audio.cue('fail',data);break;
  case'service-breach':audio.cue('breach',data);break;
  case'district-brief':audio.cue('brief',data);break;
  case'event-forecast':audio.cue('event-forecast',data);break;
  case'event-start':audio.cue('event-start',data);break;
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
function pingDeliveries(t){const jobs=game.activeDeliveries().filter(d=>d.status==='waiting').sort((a,b)=>game.urgency(a)-game.urgency(b));for(const d of jobs){const urgency=game.urgency(d),urgent=urgency<.3,interval=urgent?.72:d.called?1.8:3.4,last=deliveryPings.get(d.id)??-Infinity;if(t-last<interval)continue;deliveryPings.set(d.id,t);audio.ping({urgent,pan:worldPan(game,d.pickupId)});break;}for(const id of deliveryPings.keys())if(!game.deliveryById(id)||!jobs.some(d=>d.id===id))deliveryPings.delete(id);}
function riderNotes(t){for(let i=0;i<game.couriers.length;i++){const c=game.couriers[i],prev=riderMotion.get(c.id);riderMotion.set(c.id,{x:c.x,y:c.y,t});if(!prev||c.phase==='break'||!c.radioOn)continue;const dt=Math.max(.02,t-prev.t),speed=Math.hypot(c.x-prev.x,c.y-prev.y)/dt,relative=speed/Math.max(1,c.baseSpeed);if(relative<.42)continue;audio.riderSpeed(i,relative);}}
function pressureTone(t){const pressure=typeof game.cityPressure==='function'?game.cityPressure():0;if(pressure<58||t-lastPressureCue<Math.max(.85,3.4-pressure/34))return;lastPressureCue=t;audio.cue('pressure',{pressure});}
function selectionCues(){if(game.selectedDeliveryId!==lastSelectedDelivery){lastSelectedDelivery=game.selectedDeliveryId;if(lastSelectedDelivery){const d=game.deliveryById(lastSelectedDelivery);audio.cue('select-job',{pan:d?worldPan(game,d.pickupId):0});}}if(game.selectedCourierId!==lastSelectedCourier){lastSelectedCourier=game.selectedCourierId;if(lastSelectedCourier){const i=game.couriers.findIndex(c=>c.id===lastSelectedCourier);audio.cue('select-rider',{riderIndex:Math.max(0,i)});}}}
function exposeFlow(){const flow=typeof game.serviceFlowState==='function'?game.serviceFlowState():null;document.documentElement.dataset.flow=String(flow?.streak??0);}
function reset(next){game=next;logIndex=next.dispatchLog.length;deliveryPings.clear();riderMotion.clear();lastSelectedDelivery=next.selectedDeliveryId;lastSelectedCourier=next.selectedCourierId;lastPressureCue=0;exposeFlow();}
function tick(){const next=Game.lastInstance;if(!next)return;if(next!==game)reset(next);const t=now();processLogs();selectionCues();exposeFlow();if(!game.paused&&!game.gameOver&&audio.enabled){pingDeliveries(t);riderNotes(t);pressureTone(t);}}
setInterval(tick,90);

function hoverTarget(event){return event.target.closest?.('.task-card,.rider-card,.goal-card,#event-chip,[data-channel],[data-tool],[data-speed],.client-hub-chip,.demand-chip,.service-load,.district-brief,.map-tools button,.time-tools button,.top-actions button');}
document.addEventListener('pointerover',event=>{const target=hoverTarget(event);if(!target)return;const key=target.dataset.delivery?`job:${target.dataset.delivery}`:target.dataset.courier?`rider:${target.dataset.courier}`:target.dataset.channel?`channel:${target.dataset.channel}`:target.dataset.tool?`tool:${target.dataset.tool}`:target.id||String(target.className);if(key===lastHovered)return;lastHovered=key;if(target.dataset.delivery)audio.cue('hover-job');else if(target.dataset.courier){const i=game?.couriers.findIndex(c=>c.id===target.dataset.courier)??0;audio.cue('hover-rider',{riderIndex:Math.max(0,i)});}else audio.cue('ui-hover');});
document.addEventListener('pointerout',event=>{if(!event.relatedTarget||!hoverTarget({target:event.relatedTarget}))lastHovered='';});
document.addEventListener('click',event=>{const target=event.target.closest?.('[data-tool],[data-speed],#pause,#zoom-in,#zoom-out,#zoom-reset,#help-toggle,#new-run,#same-seed,#random-seed,#event-advisory');if(!target)return;if(target===soundToggle)return;audio.cue(target.dataset.tool?`tool-${target.dataset.tool}`:target.id==='event-advisory'?'brief':'ui-click');});
