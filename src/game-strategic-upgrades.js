import { Game } from './game-core.js';
import { UPGRADES } from './game-data.js';

const strategic=[
  {id:'cargo-racks',title:'Cargo Racks',desc:'Heavy and delicate load penalties are 45% smaller.',apply(g){g.modifiers.cargoAssist=Math.max(g.modifiers.cargoAssist??0,.45);}},
  {id:'local-repeater',title:'Local Repeater',desc:'LOCAL calls pull same-area riders more strongly.',apply(g){g.modifiers.localRepeater=(g.modifiers.localRepeater??0)+.34;}},
  {id:'event-feed',title:'Event Feed',desc:'City disruptions and demand surges are forecast 6s earlier.',apply(g){g.modifiers.eventIntel=(g.modifiers.eventIntel??0)+6;}},
  {id:'relief-roster',title:'Relief Roster',desc:'Future autonomous rider breaks are 20% shorter.',apply(g){g.modifiers.breakRelief=Math.max(g.modifiers.breakRelief??0,.2);}}
];
for(const upgrade of strategic)if(!UPGRADES.some(existing=>existing.id===upgrade.id))UPGRADES.push(upgrade);

const baseCargoHandling=Game.prototype.cargoHandlingFor;
Game.prototype.cargoHandlingFor=function(delivery){const handling=baseCargoHandling.call(this,delivery),assist=Math.max(0,Math.min(.8,this.modifiers.cargoAssist??0));if(!assist)return handling;return{...handling,speed:handling.speed+(1-handling.speed)*assist,fatigue:1+(handling.fatigue-1)*(1-assist)};};

const baseChoiceScore=Game.prototype.courierChoiceScore;
Game.prototype.courierChoiceScore=function(c,d,withNoise=true){let score=baseChoiceScore.call(this,c,d,withNoise);if(!Number.isFinite(score)||d?.channel!=='local'||!this.modifiers.localRepeater)return score;const pickup=this.nodeById(d.pickupId),current=this.nodeById(c.nodeId);if(current?.districtId===pickup?.districtId)score+=this.modifiers.localRepeater;return score;};

const baseUpdate=Game.prototype.update;
Game.prototype.update=function(dt){const lead=10+(this.modifiers.eventIntel??0);if(!this.paused&&!this.gameOver&&!this.upgradePending&&!this.currentEvent&&this.elapsed>=this.nextEventAt-lead)this.scheduleRoadEvent();return baseUpdate.call(this,dt);};

const baseStartBreak=Game.prototype.startBreak;
Game.prototype.startBreak=function(c,duration=null){const relief=Math.max(0,Math.min(.6,this.modifiers.breakRelief??0));if(duration==null&&relief&&c?.phase==='idle'){const fatigueExtra=Math.max(0,c.fatigue-.72)*18;duration=(this.rng.float(13,20)+fatigueExtra)*(1-relief);}return baseStartBreak.call(this,c,duration);};
