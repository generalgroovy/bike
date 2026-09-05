import { Game } from './game.js';

const root=document.documentElement,actions=document.querySelector('.top-actions'),summary=document.querySelector('.task-summary'),dockHead=document.querySelector('.dock-head'),taskRail=document.querySelector('.task-rail'),deliveries=document.querySelector('#deliveries');
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};

let density=read('sendit.uiDensity.v6','comfortable');
if(!['comfortable','compact'].includes(density))density='comfortable';
let mapFocus=false;

function makeButton(id,label,tip){const button=document.createElement('button');button.id=id;button.type='button';button.className='ghost ui-icon-button';button.textContent=label;button.dataset.tip=tip;button.setAttribute('aria-label',tip);button.setAttribute('aria-pressed','false');return button;}
const densityButton=makeButton('ui-density',density==='compact'?'▦':'▤','Toggle compact / comfortable information density (D)');
const focusButton=makeButton('ui-map-focus','⌗','Toggle distraction-free map focus (M)');
if(actions){actions.insertBefore(focusButton,actions.firstChild);actions.insertBefore(densityButton,actions.firstChild);}

const queueStatus=document.createElement('div');queueStatus.className='queue-status';queueStatus.innerHTML='<span><b data-risk-count>0</b> need attention</span><span><b data-live-count>0</b> live</span>';
summary?.append(queueStatus);
const riskCount=queueStatus.querySelector('[data-risk-count]'),liveCount=queueStatus.querySelector('[data-live-count]');

const context=document.createElement('aside');context.className='queue-context';context.setAttribute('aria-label','Operating context');context.innerHTML='<span class="eyebrow">CONTEXT</span><div class="queue-context-items"></div>';
if(taskRail&&deliveries)taskRail.insertBefore(context,deliveries);
const contextItems=context.querySelector('.queue-context-items');
function adoptContext(){for(const selector of['.service-load','.demand-rhythm']){const node=document.querySelector(selector);if(node&&node.parentElement!==contextItems)contextItems.append(node);}}
adoptContext();

const teamStatus=document.createElement('div');teamStatus.className='team-status';teamStatus.innerHTML='<span><b data-ready>0</b> listening</span><span><b data-riding>0</b> riding</span><span><b data-rest>0</b> rest</span>';
dockHead?.querySelector('div')?.append(teamStatus);
const readyEl=teamStatus.querySelector('[data-ready]'),ridingEl=teamStatus.querySelector('[data-riding]'),restEl=teamStatus.querySelector('[data-rest]');

function applyDensity(){root.dataset.density=density;densityButton.textContent=density==='compact'?'▦':'▤';densityButton.classList.toggle('active',density==='compact');densityButton.setAttribute('aria-pressed',String(density==='compact'));densityButton.dataset.tip=`Information density: ${density}. Press D to toggle.`;}
function applyFocus(){root.dataset.mapFocus=String(mapFocus);focusButton.classList.toggle('active',mapFocus);focusButton.setAttribute('aria-pressed',String(mapFocus));focusButton.dataset.tip=mapFocus?'Map focus on · show rider dock (M)':'Map focus off · hide rider dock (M)';}
function toggleDensity(){density=density==='compact'?'comfortable':'compact';write('sendit.uiDensity.v6',density);applyDensity();}
function toggleFocus(){mapFocus=!mapFocus;applyFocus();}
applyDensity();applyFocus();

densityButton.addEventListener('click',toggleDensity);focusButton.addEventListener('click',toggleFocus);

document.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;const tag=event.target?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;if(event.key==='d'||event.key==='D'){toggleDensity();event.preventDefault();}else if(event.key==='m'||event.key==='M'){toggleFocus();event.preventDefault();}});

let last='';
function render(){const game=Game.lastInstance;if(!game)return;adoptContext();const jobs=game.activeDeliveries(),risk=document.querySelectorAll('.task-card[data-risk="risk"],.task-card[data-risk="tight"]').length,live=jobs.filter(d=>d.called).length,ready=game.couriers.filter(c=>c.radioOn&&c.phase==='idle').length,riding=game.couriers.filter(c=>c.phase==='pickup'||c.phase==='dropoff').length,rest=game.couriers.length-ready-riding,key=[risk,live,ready,riding,rest,jobs.length,game.radioUsed(),game.radioSlots].join('|');if(key===last)return;last=key;riskCount.textContent=String(risk);riskCount.dataset.level=risk?'danger':'good';liveCount.textContent=String(live);readyEl.textContent=String(ready);ridingEl.textContent=String(riding);restEl.textContent=String(rest);root.dataset.queuePressure=risk>=4?'high':risk>=2?'medium':'low';root.dataset.radioState=game.radioUsed()>=game.radioSlots?'full':'available';}
setInterval(render,180);render();
