import { Game } from './game.js';
import { registerUiTask } from './ui-runtime.js';

if(!document.querySelector('link[href="pressure.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='pressure.css';document.head.append(link);}

const host=document.querySelector('.task-summary');
const root=document.createElement('div');root.className='service-load';root.dataset.state='calm';root.innerHTML='<span>CITY LOAD</span><strong>0</strong><i><b></b></i><small>balanced</small>';
if(host)host.append(root);
const valueEl=root.querySelector('strong'),bar=root.querySelector('i b'),detail=root.querySelector('small');
let last='';

function stateFor(value){return value>=82?'overload':value>=60?'strain':value>=35?'busy':'calm';}
function render(){
  const game=Game.lastInstance;if(!game||typeof game.mostPressuredDistrict!=='function')return;
  const top=game.mostPressuredDistrict(),value=Math.round(top?.pressure??0),state=stateFor(value),district=top?.district?.name??'balanced',key=`${value}|${state}|${district}|${Math.round(top?.overload??0)}`;if(key===last)return;last=key;
  root.dataset.state=state;valueEl.textContent=String(value);bar.style.width=`${Math.max(0,Math.min(100,value))}%`;detail.textContent=state==='calm'?'balanced':`${district}${state==='overload'?` · breach in ${Math.max(0,18-Math.floor(top.overload))}s`:''}`;
  root.dataset.tip=`Local service load. Unheard and urgent pickups raise pressure in their district. Sustained overload causes a service breach. Highest now: ${district} ${value}/100.`;
  for(const card of document.querySelectorAll('[data-delivery]')){const delivery=game.deliveryById(card.dataset.delivery);if(!delivery)continue;const pressure=game.districtPressure(delivery.pickupDistrict);card.dataset.pickupLoad=String(Math.round(pressure?.pressure??0));}
}
registerUiTask('service-pressure',render,{interval:180,hiddenInterval:1400});