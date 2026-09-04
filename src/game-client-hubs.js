import { Game } from './game-core.js';
import { RNG } from './rng.js';
import { DELIVERY_TYPES,weightedPick } from './game-data.js';

export const CLIENT_HUB_TYPES=[
  {id:'kitchen',title:'Kitchen',glyph:'◆',cargo:{food:5,catering:2,grocery:1,parcel:.5},prefix:['Corner','Night','Canal','Kiez']},
  {id:'clinic',title:'Clinic',glyph:'✚',cargo:{medical:5,coldchain:2,document:1,keys:.7},prefix:['City','Kiez','Spree','Ring']},
  {id:'office',title:'Office',glyph:'■',cargo:{document:4,keys:2,parcel:2,flowers:.4},prefix:['Desk','Works','Bureau','Studio']},
  {id:'market',title:'Market',glyph:'⬢',cargo:{grocery:5,food:2,parcel:1,flowers:.7},prefix:['Kiez','Corner','Halle','Markt']},
  {id:'studio',title:'Studio',glyph:'●',cargo:{fragile:3,flowers:2,document:2,parcel:1},prefix:['Signal','Frame','Mono','Werk']},
  {id:'workshop',title:'Workshop',glyph:'▲',cargo:{parcel:3,fragile:2,keys:2,document:.8},prefix:['Werk','Cycle','Bench','Yard']}
];

const suffix={kitchen:'Kitchen',clinic:'Clinic',office:'Office',market:'Market',studio:'Studio',workshop:'Workshop'};
const streetStem=name=>(name??'Berlin').replace(/straße|strasse|allee|damm|platz|ufer|weg|chaussee/gi,'').replace(/[-–]/g,' ').trim().split(/\s+/)[0]||'Berlin';

Game.prototype.ensureClientHubs=function(){
  if(this.clientHubs)return this.clientHubs;
  const rng=new RNG(`${this.seed}:client-hubs:v6`),used=new Set(),hubs=[];
  const districts=[...this.districts].sort((a,b)=>(a.unlockLevel??1)-(b.unlockLevel??1)||a.name.localeCompare(b.name));
  let serial=0;
  for(const district of districts){
    const pool=this.addressNodes.filter(n=>n.districtId===district.id&&!used.has(n.id));if(!pool.length)continue;
    const count=(district.unlockLevel??1)===1?2:1;
    for(let i=0;i<count;i++){
      const available=pool.filter(n=>!used.has(n.id));if(!available.length)break;const node=rng.pick(available);used.add(node.id);const type=CLIENT_HUB_TYPES[serial%CLIENT_HUB_TYPES.length],prefix=rng.pick(type.prefix),stem=streetStem(node.streetName),name=`${prefix} ${stem} ${suffix[type.id]}`;
      hubs.push({id:`hub-${serial++}`,name,typeId:type.id,typeTitle:type.title,glyph:type.glyph,nodeId:node.id,address:node.addressLabel,streetName:node.streetName,districtId:district.id,unlockLevel:node.unlockLevel??district.unlockLevel??1,cargo:{...type.cargo}});
    }
  }
  this.clientHubs=hubs;this.clientHubRng=new RNG(`${this.seed}:client-work:v6`);return hubs;
};
Game.prototype.activeClientHubs=function(){return this.ensureClientHubs().filter(h=>(h.unlockLevel??1)<=this.cityLevel);};
Game.prototype.clientHubById=function(id){return this.ensureClientHubs().find(h=>h.id===id)??null;};
Game.prototype.hubCargoType=function(hub){const available=Object.entries(DELIVERY_TYPES).filter(([id,type])=>(type.unlockLevel??1)<=this.cityLevel&&hub.cargo[id]>0);return available.length?weightedPick(this.clientHubRng,available,([id,type])=>type.weight*(hub.cargo[id]??0))[0]:this.weightedDeliveryType();};
Game.prototype.hubTrip=function(hub){
  const hubNode=this.nodeById(hub.nodeId),pool=this.playableAddressNodes().filter(n=>n.id!==hub.nodeId),min=this.runContract.minTrip??120,max=this.runContract.maxTrip??1000;if(!hubNode||!pool.length)return null;
  for(let attempt=0;attempt<24;attempt++){const other=this.clientHubRng.pick(pool),hubPickup=this.clientHubRng.chance(.68),pickup=hubPickup?hubNode:other,dropoff=hubPickup?other:hubNode,path=this.routeBetween(pickup.id,dropoff.id);if(!path.length)continue;const distance=this.routeDistance(path);if(distance>=min*.72&&distance<=max*1.12)return{pickup,dropoff,hubPickup};}
  return null;
};

const baseSpawn=Game.prototype.spawnDelivery;
Game.prototype.spawnDelivery=function(options={}){
  if(options.pickupId||options.dropoffId||options.clientHub===false)return baseSpawn.call(this,options);
  this.ensureClientHubs();const hubs=this.activeClientHubs(),useHub=hubs.length>0&&this.clientHubRng.chance(this.cityLevel>=3?.64:.56);if(!useHub)return baseSpawn.call(this,options);
  const hub=this.clientHubRng.pick(hubs),trip=this.hubTrip(hub);if(!trip)return baseSpawn.call(this,options);
  const before=this.deliveries.length,typeKey=options.typeKey??this.hubCargoType(hub),ok=baseSpawn.call(this,{...options,pickupId:trip.pickup.id,dropoffId:trip.dropoff.id,typeKey});if(!ok||this.deliveries.length===before)return ok;
  const delivery=this.deliveries.at(-1);delivery.clientHubId=hub.id;delivery.clientName=hub.name;delivery.clientKind=hub.typeTitle;delivery.clientGlyph=hub.glyph;delivery.clientEndpoint=trip.hubPickup?'pickup':'dropoff';return true;
};
