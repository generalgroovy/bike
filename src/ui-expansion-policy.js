import { Game } from './game.js';

if(!document.querySelector('link[href="policy.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='policy.css';document.head.append(link);}
const dialog=document.createElement('dialog');dialog.id='policy-modal';dialog.className='modal policy-modal';dialog.hidden=true;dialog.innerHTML='<span class="eyebrow">CITY EXPANSION</span><h2>How will the desk scale?</h2><p class="policy-stage"></p><div class="policy-grid"></div>';
document.body.append(dialog);
const stageEl=dialog.querySelector('.policy-stage'),grid=dialog.querySelector('.policy-grid');let shownKey='',pauseWas=false;
function open(game){if(dialog.hidden){pauseWas=game.paused;game.paused=true;}dialog.hidden=false;if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}}
function close(game,restore=true){if(dialog.open&&typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');dialog.hidden=true;if(restore&&game)game.paused=pauseWas;pauseWas=false;}
function render(){const game=Game.lastInstance,pending=game?.expansionPolicyPending;if(!game||!pending){if(!dialog.hidden)close(game);shownKey='';return;}const key=`${pending.level}:${pending.stage}`;if(key===shownKey&&dialog.open)return;shownKey=key;stageEl.textContent=`${pending.stage} is live. Choose one operating doctrine for the larger territory.`;grid.replaceChildren();for(const policy of game.expansionPolicyChoices()){const button=document.createElement('button');button.dataset.policy=policy.id;const title=document.createElement('strong'),desc=document.createElement('span');title.textContent=policy.title;desc.textContent=policy.desc;button.append(title,desc);grid.append(button);}open(game);}
grid.addEventListener('click',event=>{const button=event.target.closest('[data-policy]'),game=Game.lastInstance;if(!button||!game)return;if(game.applyExpansionPolicy(button.dataset.policy)){close(game);shownKey='';}});
setInterval(render,90);render();
