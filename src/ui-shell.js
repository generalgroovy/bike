import { Game } from './game.js';
import { registerUiTask } from './ui-runtime.js';

for(const href of ['ui-minimal-map-context.css','ui-map-overview.css']){
  if(!document.querySelector(`link[href="${href}"]`)){const link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link);}
}

const root=document.documentElement,actions=document.querySelector('.top-actions'),summary=document.querySelector('.task-summary'),dockHead=document.querySelector('.dock-head'),deliveries=document.querySelector('#deliveries'),mapStage=document.querySelector('.map-stage'),workspace=document.querySelector('.workspace'),taskRail=document.querySelector('.task-rail'),teamDock=document.querySelector('.team-dock');
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};

let density=read('sendit.uiDensity.v9',read('sendit.uiDensity.v8','comfortable'));
if(!['comfortable','compact'].includes(density))density='comfortable';
let mapFocus=false;
let leftCollapsed=read('sendit.leftRail.v9','false')==='true';
let rightCollapsed=read('sendit.rightRail.v9','false')==='true';

function makeButton(id,label,tip){const button=document.createElement('button');button.id=id;button.type='button';button.className='ghost ui-icon-button';button.textContent=label;button.dataset.tip=tip;button.setAttribute('aria-label',tip);button.setAttribute('aria-pressed','false');return button;}
const densityButton=makeButton('ui-density',density==='compact'?'▦':'▤','Toggle compact / comfortable information density (D)');
const focusButton=makeButton('ui-map-focus','⌗','Toggle full map focus (M)');
if(actions){actions.insertBefore(focusButton,actions.firstChild);actions.insertBefore(densityButton,actions.firstChild);}

if(workspace&&taskRail&&taskRail.parentElement!==workspace)workspace.insertBefore(taskRail,mapStage);
taskRail?.setAttribute('aria-label','Contract rail');
teamDock?.setAttribute('aria-label','Rider rail');

const leftToggle=makeButton('left-rail-toggle','‹','Collapse / expand contract rail (Q)');
leftToggle.classList.add('rail-toggle','rail-toggle-left');
taskRail?.append(leftToggle);
const rightToggle=makeButton('right-rail-toggle','›','Collapse / expand rider rail (R)');
rightToggle.classList.add('rail-toggle','rail-toggle-right');
teamDock?.append(rightToggle);

const queueStatus=document.createElement('div');queueStatus.className='queue-status';queueStatus.innerHTML='<span><b data-risk-count>0</b> attention</span><span><b data-live-count>0</b> live</span>';
summary?.append(queueStatus);
const riskCount=queueStatus.querySelector('[data-risk-count]'),liveCount=queueStatus.querySelector('[data-live-count]');

const context=document.createElement('aside');context.className='queue-context map-context';context.setAttribute('aria-label','Operating context');context.innerHTML='<div class="queue-context-items"></div>';
mapStage?.append(context);
const contextItems=context.querySelector('.queue-context-items');
function adoptContext(){for(const selector of['.service-load','.demand-rhythm']){const node=document.querySelector(selector);if(node&&node.parentElement!==contextItems)contextItems.append(node);}}
adoptContext();

const channelLabels={open:'OPEN radio · 1 bandwidth · neutral broadcast',priority:'PRIORITY radio · 2 bandwidth · stronger rider attention',local:'LOCAL radio · 1 bandwidth · favors nearby riders',off:'OFF radio · remove this contract from broadcast'};
function labelRadioControls(scope=document){for(const button of scope.querySelectorAll?.('.task-actions [data-channel]')??[]){const label=channelLabels[button.dataset.channel];if(label)button.setAttribute('aria-label',label);}}
labelRadioControls();
if(deliveries&&typeof MutationObserver!=='undefined')new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)labelRadioControls(node);}).observe(deliveries,{childList:true,subtree:true});

const teamStatus=document.createElement('div');teamStatus.className='team-status';teamStatus.innerHTML='<span><b data-ready>0</b> ready</span><span><b data-riding>0</b> ride</span><span><b data-rest>0</b> rest</span>';
dockHead?.querySelector('div')?.append(teamStatus);
const readyEl=teamStatus.querySelector('[data-ready]'),ridingEl=teamStatus.querySelector('[data-riding]'),restEl=teamStatus.querySelector('[data-rest]');

function applyDensity(){root.dataset.density=density;densityButton.textContent=density==='compact'?'▦':'▤';densityButton.classList.toggle('active',density==='compact');densityButton.setAttribute('aria-pressed',String(density==='compact'));densityButton.dataset.tip=`Information density: ${density}. Press D to toggle.`;}
function applyRails(){root.dataset.leftRail=leftCollapsed?'collapsed':'open';root.dataset.rightRail=rightCollapsed?'collapsed':'open';leftToggle.textContent=leftCollapsed?'›':'‹';rightToggle.textContent=rightCollapsed?'‹':'›';leftToggle.setAttribute('aria-pressed',String(leftCollapsed));rightToggle.setAttribute('aria-pressed',String(rightCollapsed));}
function applyFocus(){root.dataset.mapFocus=String(mapFocus);focusButton.classList.toggle('active',mapFocus);focusButton.setAttribute('aria-pressed',String(mapFocus));focusButton.dataset.tip=mapFocus?'Map focus on · restore rails (M)':'Map focus off · hide both rails (M)';}
function toggleDensity(){density=density==='compact'?'comfortable':'compact';write('sendit.uiDensity.v9',density);applyDensity();}
function toggleFocus(){mapFocus=!mapFocus;applyFocus();}
function toggleLeft(){leftCollapsed=!leftCollapsed;write('sendit.leftRail.v9',leftCollapsed);applyRails();}
function toggleRight(){rightCollapsed=!rightCollapsed;write('sendit.rightRail.v9',rightCollapsed);applyRails();}
applyDensity();applyRails();applyFocus();

densityButton.addEventListener('click',toggleDensity);focusButton.addEventListener('click',toggleFocus);leftToggle.addEventListener('click',toggleLeft);rightToggle.addEventListener('click',toggleRight);
document.addEventListener('keydown',event=>{if(event.ctrlKey||event.metaKey||event.altKey)return;const tag=event.target?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;if(event.key==='d'||event.key==='D'){toggleDensity();event.preventDefault();}else if(event.key==='m'||event.key==='M'){toggleFocus();event.preventDefault();}else if(event.key==='q'||event.key==='Q'){toggleLeft();event.preventDefault();}else if(event.key==='r'||event.key==='R'){toggleRight();event.preventDefault();}});

let last='';
function render(){const game=Game.lastInstance;if(!game)return;adoptContext();const jobs=game.activeDeliveries(),risk=document.querySelectorAll('.task-card[data-risk="risk"],.task-card[data-risk="tight"]').length,live=jobs.filter(d=>d.called).length,ready=game.couriers.filter(c=>c.radioOn&&c.phase==='idle').length,riding=game.couriers.filter(c=>c.phase==='pickup'||c.phase==='dropoff').length,rest=game.couriers.length-ready-riding,radioUsed=game.radioUsed(),key=[risk,live,ready,riding,rest,jobs.length,radioUsed,game.radioSlots].join('|');if(key===last)return;last=key;riskCount.textContent=String(risk);riskCount.dataset.level=risk?'danger':'good';liveCount.textContent=String(live);readyEl.textContent=String(ready);ridingEl.textContent=String(riding);restEl.textContent=String(rest);root.dataset.queuePressure=risk>=4?'high':risk>=2?'medium':'low';root.dataset.radioState=radioUsed>=game.radioSlots?'full':'available';}
registerUiTask('operator-shell',render,{interval:180,hiddenInterval:1200});