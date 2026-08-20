import { Game } from './game-core.js';

Game.prototype.spawnEventDemand=function(ev){
  if(!ev||ev.kind!=='demand')return 0;
  const pickups=this.playableAddressNodes().filter(n=>n.districtId===ev.districtId);if(!pickups.length)return 0;
  const target=Math.max(1,(ev.burst??3)-(ev.prepared?1:0));let spawned=0,attempts=0;
  while(spawned<target&&attempts<target*8){attempts++;const pickup=this.rng.pick(pickups),dropoff=this.randomAddress(pickup?.id);if(!pickup||!dropoff)continue;const typeKey=this.weightedDeliveryType(),ok=this.spawnDelivery({pickupId:pickup.id,dropoffId:dropoff.id,typeKey,special:false,specialId:`event-${ev.type}`,specialLabel:ev.label??'SURGE',specialGlyph:ev.glyph??'+',specialDesc:ev.detail});if(!ok)continue;const d=this.deliveries.at(-1);d.eventId=ev.id;d.eventPrepared=Boolean(ev.prepared);d.reward+=ev.type==='transit-outage'?4:2;if(ev.prepared)d.deadlineAt+=14;spawned++;}
  ev.generatedJobs=spawned;this.logDispatch('event-demand',null,{title:ev.title,place:ev.place,jobs:spawned,prepared:ev.prepared});return spawned;
};
