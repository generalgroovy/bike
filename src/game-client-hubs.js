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
  const districts=[...this.districts].sort((a,b)=>(a.unlockLevel??1)-(b.unlockLevel??1)||a.name.localeCompare(b.name));let serial=0;
  for(const district of districts){
    const pool=this.addressNodes.filter(n=>n.districtId===district.id&&!used.has(n.id));if(!pool.length)continue;const count=(district.unlockLevel??1)===1?2:1;
    for(let i=0;i<count;i++){
      const available=pool.filter(n=>!used.has(n.id));if(!available.length)break;const node=rng.pick(available);used.add(node.id);const type=CLIENT_HUB_TYPES[serial%CLIENT_HUB_TYPES.length],prefix=rng.pick(type.prefix),stem=streetStem(node.streetName),name=`${prefix} ${stem} ${suffix[type.id]}`;
      hubs.push({id:`hub-${serial++}`,name,typeId:type.id,typeTitle:type.title,glyph:type.glyph,nodeId:node.id,address:node.addressLabel,streetName:node.streetName,districtId:district.id,unlockLevel:node.unlockLevel??district.unlockLevel??1,cargo:{...type.cargo}});
    }
  }
  this.clientHubs=hubs;this.clientHubRng=new RNG(`${this.seed}:client-work:v6`);return hubs;
};
Game.prototype.activeClientHubs=function(){return this.ensureClientHubs().filter(h=>(h.unlockLevel??1)<=this.cityLevel);};
Game.prototype.clientHubById=function(id){return this.ensureClientHubs().find(h=>h.id===id)??null;};
Game.prototype.hubCargoType=function(hub){const available=Object.entries(DELIVERY_TYPES).filter(([id,type])=>(type.unlockLevel??1)<=this.cityLevel&&hub.cargo[id]>0);return available.length?weightedPick(this.clientHubRng,available,([id,type])=>type.weight*(hub.cargo[id]??0))[0]:'parcel';};
Game.prototype.applyClientHub=function(delivery,hub){
  if(!delivery||!hub)return false;const hubNode=this.nodeById(hub.nodeId);if(!hubNode)return false;const hubPickup=this.clientHubRng.chance(.68),other=this.nodeById(hubPickup?delivery.dropoffId:delivery.pickupId);if(!other||other.id===hubNode.id)return false;const pickup=hubPickup?hubNode:other,dropoff=hubPickup?other:hubNode,path=this.routeBetween(pickup.id,dropoff.id);if(!path.length)return false;
  const oldDistance=Math.max(1,delivery.plannedDistance),newDistance=this.routeDistance(path),oldType=DELIVERY_TYPES[delivery.type],newTypeKey=this.hubCargoType(hub),newType=DELIVERY_TYPES[newTypeKey];if(!oldType||!newType)return false;
  const waveFactor=1+(this.wave-1)*.014,oldDeadlineBase=oldType.baseDeadline*this.modifiers.deadline*(.82+oldDistance/900)/waveFactor,deadlineFactor=Math.max(.4,(delivery.deadlineAt-delivery.createdAt)/Math.max(1,oldDeadlineBase));
  const oldRewardBase=(oldType.reward+oldDistance/92)*this.modifiers.reward,rewardFactor=Math.max(.4,delivery.reward/Math.max(1,oldRewardBase));
  delivery.type=newTypeKey;delivery.pickupId=pickup.id;delivery.dropoffId=dropoff.id;delivery.pickupAddress=pickup.addressLabel;delivery.dropoffAddress=dropoff.addressLabel;delivery.pickupPostcode=pickup.postcode;delivery.dropoffPostcode=dropoff.postcode;delivery.pickupDistrict=pickup.districtId;delivery.dropoffDistrict=dropoff.districtId;delivery.plannedDistance=newDistance;delivery.plannedStreets=this.routeStreets(path);delivery.plannedPath=path;delivery.deadlineAt=delivery.createdAt+newType.baseDeadline*this.modifiers.deadline*(.82+newDistance/900)/waveFactor*deadlineFactor;delivery.reward=Math.round((newType.reward+newDistance/92)*this.modifiers.reward*rewardFactor);
  delivery.clientHubId=hub.id;delivery.clientName=hub.name;delivery.clientKind=hub.typeTitle;delivery.clientGlyph=hub.glyph;delivery.clientEndpoint=hubPickup?'pickup':'dropoff';return true;
};

const baseSpawn=Game.prototype.spawnDelivery;
Game.prototype.spawnDelivery=function(options={}){
  const before=this.deliveries.length,result=baseSpawn.call(this,options);if(!result||this.deliveries.length<=before||options.pickupId||options.dropoffId||options.clientHub===false)return result;
  this.ensureClientHubs();const hubs=this.activeClientHubs();if(!hubs.length||!this.clientHubRng.chance(this.cityLevel>=3?.64:.56))return result;this.applyClientHub(this.deliveries.at(-1),this.clientHubRng.pick(hubs));return result;
};