import { Game } from './game.js';
import { registerUiTask } from './ui-runtime.js';

const root=document.documentElement,mapStage=document.querySelector('.map-stage');
const hud=document.createElement('div');
hud.className='kinetic-hud';
hud.setAttribute('aria-label','Shift momentum');
hud.innerHTML='<span class="flow">FLOW <b data-flow>×0</b><span class="flow-pips" aria-hidden="true"></span></span><span class="pressure">CITY <b data-pressure>0</b></span><span class="phase">PHASE <b data-phase>QUIET</b></span>';
const flash=document.createElement('div');flash.className='vibe-flash';flash.setAttribute('aria-hidden','true');
mapStage?.append(hud,flash);
const flowEl=hud.querySelector('[data-flow]'),pressureEl=hud.querySelector('[data-pressure]'),phaseEl=hud.querySelector('[data-phase]'),pips=hud.querySelector('.flow-pips');
for(let i=0;i<7;i++){const dot=document.createElement('i');pips.append(dot);}

let lastFlow=-1,lastBreaches=-1,lastPressureBand='';let flashTimer=0;
function pulse(kind){root.dataset.vibeFlash=kind;clearTimeout(flashTimer);flashTimer=setTimeout(()=>{if(root.dataset.vibeFlash===kind)delete root.dataset.vibeFlash;},700);}
function render(){
  const game=Game.lastInstance;if(!game)return;
  const flow=typeof game.serviceFlowState==='function'?game.serviceFlowState().streak??0:0;
  const pressure=Math.round(typeof game.cityPressure==='function'?game.cityPressure():0);
  const phase=typeof game.demandPhase==='function'?game.demandPhase():null;
  const breaches=game.runStats?.districtBreaches??0;
  flowEl.textContent=`×${flow}`;pressureEl.textContent=String(pressure);phaseEl.textContent=(phase?.title??'QUIET').replace(' START','').replace(' WINDOW','');
  [...pips.children].forEach((dot,i)=>dot.classList.toggle('on',i<flow));
  root.dataset.flowTier=flow>=5?'hot':flow>=3?'warm':'base';
  const pressureBand=pressure>=82?'high':pressure>=55?'medium':'low';root.dataset.cityPressure=pressureBand;
  root.dataset.demandPhase=phase?.id??'quiet';
  if(lastFlow>=0&&flow>lastFlow&&flow>=3)pulse('flow');
  if(lastBreaches>=0&&breaches>lastBreaches)pulse('alert');
  lastFlow=flow;lastBreaches=breaches;lastPressureBand=pressureBand;
}
registerUiTask('v11-vibe',render,{interval:160,hiddenInterval:1200});
