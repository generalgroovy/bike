import { Game } from './game-core.js';

const IMPORTANT=new Set(['event-forecast','event-start','event-response','event-demand','event-end','city-expand','break','radio-on','radio-denied','fail','collapse','sweeten','client-call','rebroadcast','goal','upgrade']);
const TONES={
  'event-forecast':'forecast','event-start':'event','event-response':'tool','event-demand':'event','event-end':'muted','city-expand':'progress',break:'rider','radio-on':'rider','radio-denied':'danger',fail:'danger',collapse:'danger',sweeten:'tool','client-call':'tool',rebroadcast:'tool',goal:'good',upgrade:'good'
};
function label(entry){
  const id=entry.deliveryId?.toUpperCase();
  switch(entry.action){
    case'event-forecast':return `${entry.title??'EVENT'} forecast · ${entry.place??'Berlin'}`;
    case'event-start':return `${entry.title??'EVENT'} active · ${entry.place??'Berlin'}`;
    case'event-response':return `${entry.kind==='demand'?'Capacity plan':'Route response'} · ${entry.place??'Berlin'}`;
    case'event-demand':return `${entry.jobs??0} surge jobs · ${entry.place??'Berlin'}${entry.prepared?' · prepared':''}`;
    case'event-end':return `${entry.title??'EVENT'} cleared · ${entry.place??'Berlin'}`;
    case'city-expand':return `Operating area expanded · ${entry.stage??'Berlin'}`;
    case'break':return `${entry.rider??'Rider'} took a break · radio off`;
    case'radio-on':return `${entry.rider??'Rider'} returned to radio`;
    case'radio-denied':return `${id??'Call'} blocked · radio full`;
    case'fail':return `${id??'Delivery'} missed · ${entry.kind??'deadline'}`;
    case'collapse':return `Shift collapsed`;
    case'sweeten':return `${id??'Delivery'} payout increased`;
    case'client-call':return `${id??'Delivery'} client window extended`;
    case'rebroadcast':return `${id??'Delivery'} rebroadcast`;
    case'goal':return `Goal completed · ${entry.goal??'shift objective'}`;
    case'upgrade':return `Upgrade · ${entry.upgrade??'desk improvement'}`;
    default:return entry.action;
  }
}

Game.prototype.criticalTimeline=function({limit=14,window=95}={}){
  const important=this.dispatchLog.filter(entry=>IMPORTANT.has(entry.action));
  if(!important.length)return[];
  const end=this.elapsed,lastStart=Math.max(0,end-window),late=important.filter(entry=>entry.at>=lastStart),milestones=important.filter(entry=>entry.at<lastStart&&['city-expand','event-response','goal','upgrade'].includes(entry.action));
  const selected=[...milestones.slice(-4),...late];
  const dedup=[];
  for(const entry of selected){const previous=dedup.at(-1);if(previous&&entry.action===previous.action&&entry.deliveryId===previous.deliveryId&&Math.abs(entry.at-previous.at)<1)continue;dedup.push(entry);}
  return dedup.slice(-limit).map(entry=>({at:entry.at,action:entry.action,tone:TONES[entry.action]??'muted',label:label(entry),radioUsed:entry.radioUsed??0,cityLevel:entry.cityLevel??1,deliveryId:entry.deliveryId??null,rider:entry.rider??null,place:entry.place??null}));
};
