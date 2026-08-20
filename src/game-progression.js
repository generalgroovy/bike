import { Game } from './game-core.js';

const baseMaybeAdvanceCity=Game.prototype.maybeAdvanceCity;
Game.prototype.maybeAdvanceCity=function(){
  const changed=baseMaybeAdvanceCity.call(this);
  if(!changed)return false;
  this.addExpansionGoals?.();
  for(let i=0;i<2;i++)this.spawnDelivery();
  return true;
};
