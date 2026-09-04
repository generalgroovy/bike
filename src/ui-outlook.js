import { Game } from './game.js';
import './ui-telemetry.js';
import './ui-scheduled.js';
import './ui-queue.js';
import './ui-feasibility.js';
import './ui-service-pressure.js';
import './ui-client-hubs.js';
import './ui-demand-rhythm.js';
import './ui-district-brief.js';
import './ui-map-lens.js';

const root=document.querySelector('#inspect-outlook');
const formatTime=seconds=>{const value=Math.max(0,Math.ceil(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;};
let lastKey='';

function render(){
  const game=Game.lastInstance;if(!root||!game)return;
  const delivery=game.deliveryById(game.selectedDeliveryId);
  if(!delivery||!game.activeDeliveries().includes(delivery)){root.hidden=true;lastKey='';return;}
  const outlook=game.deliveryRiderOutlook(delivery,{limit:5,horizon:90}),key=outlook.map(item=>`${item.rider.id}:${item.state}:${Math.round(item.arrivalIn)}`).join('|');
  root.hidden=false;if(key===lastKey)return;lastKey=key;root.replaceChildren();
  const label=document.createElement('span');label.className='outlook-label';label.textContent='RIDER OUTLOOK';root.append(label);
  if(!outlook.length){const empty=document.createElement('strong');empty.textContent='No rider within 90s';root.append(empty);return;}
  for(const item of outlook){const chip=document.createElement('span');chip.className='outlook-chip';chip.dataset.state=item.state;const name=document.createElement('b'),state=document.createElement('em');name.textContent=item.rider.name;state.textContent=item.availableNow?'NOW':`${item.state.toUpperCase()} · ${formatTime(item.arrivalIn)}`;chip.append(name,state);root.append(chip);}
}
setInterval(render,180);render();