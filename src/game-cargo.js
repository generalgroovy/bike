import { Game } from './game-core.js';

export const CARGO_HANDLING={
  food:{speed:.98,fatigue:1.02,label:'Light load · normal pace'},
  parcel:{speed:.97,fatigue:1.05,label:'Standard parcel · slight load'},
  document:{speed:1,fatigue:.98,label:'Light documents · efficient ride'},
  grocery:{speed:.9,fatigue:1.28,label:'Heavy groceries · −10% loaded speed · higher fatigue'},
  fragile:{speed:.9,fatigue:1.12,label:'Fragile load · careful −10% loaded speed'},
  flowers:{speed:.93,fatigue:1.08,label:'Delicate flowers · careful −7% loaded speed'},
  keys:{speed:1,fatigue:.97,label:'Tiny handoff · no load penalty'},
  medical:{speed:1,fatigue:1.02,label:'Critical light cargo · no load penalty'},
  catering:{speed:.82,fatigue:1.48,label:'Bulky catering · −18% loaded speed · high fatigue'},
  coldchain:{speed:.95,fatigue:1.1,label:'Protected cold load · −5% loaded speed'}
};

Game.prototype.cargoHandlingFor=function(delivery){return CARGO_HANDLING[delivery?.type]??{speed:1,fatigue:1,label:'Standard load'};};

const baseSpawnDelivery=Game.prototype.spawnDelivery;
Game.prototype.spawnDelivery=function(options={}){
  const before=this.deliveries.length,result=baseSpawnDelivery.call(this,options);if(!result||this.deliveries.length<=before)return result;
  const delivery=this.deliveries.at(-1),handling=this.cargoHandlingFor(delivery);delivery.cargoSpeed=handling.speed;delivery.cargoFatigue=handling.fatigue;delivery.handlingLabel=handling.label;delivery.specialDesc=[delivery.specialDesc,handling.label].filter(Boolean).join(' · ');return result;
};
