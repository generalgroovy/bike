import { Game } from './game.js';

const tools=document.querySelector('#job-inspector .inspect-tools'),button=document.createElement('button');button.type='button';button.dataset.kiezBrief='';button.dataset.tip='KIEZ BRIEF · 1 Focus · temporarily increases rider interest in all live pickups from this district.';button.textContent='KIEZ BRIEF · 1 FOCUS';if(tools)tools.append(button);let last='';
function fmt(seconds){return `${Math.max(0,Math.ceil(seconds))}s`;}
function render(){const game=Game.lastInstance,d=game?.deliveryById(game.selectedDeliveryId);if(!game||!d){button.hidden=true;last='';return;}button.hidden=false;const remaining=game.districtBriefRemaining?.(d.pickupDistrict)??0,key=`${d.pickupDistrict}:${Math.ceil(remaining)}:${game.dispatchFocus}`;if(key===last)return;last=key;button.dataset.active=String(remaining>0);button.disabled=remaining>0||game.dispatchFocus<1;button.textContent=remaining>0?`KIEZ BRIEF · ${fmt(remaining)}`:'KIEZ BRIEF · 1 FOCUS';}
button.addEventListener('click',()=>{const game=Game.lastInstance,d=game?.deliveryById(game.selectedDeliveryId);if(d&&game.briefDistrict?.(d.pickupDistrict))render();});
setInterval(render,120);render();