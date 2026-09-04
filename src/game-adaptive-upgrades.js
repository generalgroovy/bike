import { Game } from './game-core.js';
import { COURIER_NAMES,UPGRADES } from './game-data.js';

const byId=id=>UPGRADES.find(u=>u.id===id)??null;
const fallbackReason={radio:'More room for simultaneous calls.',rider:'More human capacity on the street.',briefing:'Shorter, clearer rider deliberation.',speed:'Reduces time riders stay unavailable.',grace:'Creates more recovery room on new work.',bikeLane:'Improves recurring cross-city movement.',coffee:'Protects capacity from overlapping breaks.',focus:'More room for interventions and Kiez Briefs.',goodwill:'Repairs a fragile reputation buffer.','cargo-racks':'Reduces heavy-load capacity loss.','local-repeater':'Strengthens LOCAL response in familiar areas.','event-feed':'Creates more time to prepare city disruptions.','relief-roster':'Shortens future autonomous breaks.'};

Game.prototype.upgradeDiagnosis=function(){
  const pressure=typeof this.cityPressure==='function'?this.cityPressure():0,avgFatigue=this.couriers.length?this.couriers.reduce((s,c)=>s+c.fatigue,0)/this.couriers.length:0,active=this.activeDeliveries().length,heavy=this.activeDeliveries().filter(d=>['grocery','fragile','catering','coldchain'].includes(d.type)).length;
  if(this.reputation<55)return{id:'goodwill',severity:1,reason:`REP is ${Math.round(this.reputation)}. Rebuild failure margin before another bad wave.`};
  if(pressure>=68){const preferred=byId('local-repeater')?'local-repeater':'focus';return{id:preferred,severity:.95,reason:`Local service load peaked at ${Math.round(pressure)}/100. Improve district response.`};}
  if((this.runStats.radioDenied??0)>=2||this.radioUsed()>=this.radioSlots)return{id:'radio',severity:.9,reason:`Radio has blocked ${this.runStats.radioDenied??0} changes. Preserve one flexible slot.`};
  if((this.runStats.breaks??0)>=3||avgFatigue>=.62){const preferred=byId('relief-roster')?'relief-roster':'coffee';return{id:preferred,severity:.82,reason:`Team energy averages ${Math.round((1-avgFatigue)*100)}%. Reduce overlapping recovery gaps.`};
  if(this.courierSerial<COURIER_NAMES.length&&active>=this.couriers.length*2.4)return{id:'rider',severity:.78,reason:`${active} live jobs for ${this.couriers.length} riders. Add street capacity.`};
  if((this.runStats.eventExposure??0)>260&&byId('event-feed'))return{id:'event-feed',severity:.7,reason:'Recent disruption exposure is high. Earlier forecasts create cheaper responses.'};
  if(heavy>=3&&byId('cargo-racks'))return{id:'cargo-racks',severity:.66,reason:`${heavy} heavy/delicate jobs are tying up riders. Improve load handling.`};
  return{id:'briefing',severity:.35,reason:'No single bottleneck dominates. Improve decision throughput.'};
};
Game.prototype.upgradeReasonFor=function(id){const diagnosis=this.upgradeDiagnosis();return id===diagnosis.id?diagnosis.reason:(fallbackReason[id]??'A different operating style for this run.');};

const baseChoices=Game.prototype.getUpgradeChoices;
Game.prototype.getUpgradeChoices=function(){
  const rolled=baseChoices.call(this),diagnosis=this.upgradeDiagnosis(),recommended=byId(diagnosis.id),eligible=recommended&&(recommended.id!=='rider'||this.courierSerial<COURIER_NAMES.length);let choices=[...rolled];
  if(eligible&&!choices.some(u=>u.id===recommended.id)){const replace=Math.max(0,choices.length-1);choices[replace]=recommended;}
  const seen=new Set();choices=choices.filter(u=>u&&!seen.has(u.id)&&seen.add(u.id));for(const candidate of UPGRADES){if(choices.length>=3)break;if(candidate.id==='rider'&&this.courierSerial>=COURIER_NAMES.length)continue;if(!seen.has(candidate.id)){seen.add(candidate.id);choices.push(candidate);}}
  return choices.slice(0,3).map(u=>({...u,reason:this.upgradeReasonFor(u.id),recommended:u.id===diagnosis.id}));
};
