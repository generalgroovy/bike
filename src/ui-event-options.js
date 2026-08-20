import { Game } from './game.js';

const chip=document.querySelector('#event-chip'),primary=document.querySelector('#event-advisory');
let secondary=null,lastKey='';

function ensureSecondary(){
  if(secondary?.isConnected)return secondary;
  if(!chip||!primary)return null;
  secondary=document.createElement('button');secondary.id='event-secondary';secondary.className='event-secondary';secondary.hidden=true;primary.after(secondary);
  secondary.addEventListener('click',()=>{const game=Game.lastInstance;if(!game)return;const option=game.cityEventResponseOptions?.().find(item=>item.id!=='prepare');if(option?.available&&game.respondToCityEvent(option.id))render(true);});
  return secondary;
}

function costText(option){return option.costType==='cash'?`€${option.cost}`:`${option.cost} FOCUS`;}

function render(force=false){
  const game=Game.lastInstance,button=ensureSecondary();if(!game||!button)return;
  const event=game.currentEvent,option=game.cityEventResponseOptions?.().find(item=>item.id!=='prepare');
  if(!event||!option){button.hidden=true;lastKey='';return;}
  const key=`${event.id}:${event.state}:${option.id}:${option.available}:${option.used}:${option.affected??0}:${game.cash}:${game.dispatchFocus}`;if(!force&&key===lastKey)return;lastKey=key;
  button.hidden=false;button.disabled=!option.available;button.dataset.used=String(Boolean(option.used));button.dataset.kind=event.kind;
  button.textContent=option.used?`${option.label} ACTIVE`:`${option.label} · ${costText(option)}`;
  button.dataset.tip=option.desc??(event.kind==='demand'?'Use cash instead of focus to make event jobs more attractive.':'Use client tolerance instead of route preparation.');
}

setInterval(render,140);render(true);
