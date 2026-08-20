import { Game } from './game-core.js';

Game.prototype.visualEdgeUnlockLevel=function visualEdgeUnlockLevel(id){
  if(!this._visualUnlockLevels){
    this._visualUnlockLevels=new Map();
    for(const edge of this.edges){
      const a=this.nodeById(edge.a),b=this.nodeById(edge.b),level=Math.max(a?.unlockLevel??1,b?.unlockLevel??1),current=this._visualUnlockLevels.get(edge.visualId)??1;
      this._visualUnlockLevels.set(edge.visualId,Math.max(current,level));
    }
  }
  return this._visualUnlockLevels.get(id)??1;
};
Game.prototype.visualEdgePlayable=function visualEdgePlayable(id){return this.visualEdgeUnlockLevel(id)<=this.cityLevel;};

const baseMaybeAdvanceCity=Game.prototype.maybeAdvanceCity;
Game.prototype.maybeAdvanceCity=function(){
  const changed=baseMaybeAdvanceCity.call(this);
  if(!changed)return false;
  this.addExpansionGoals?.();
  for(let i=0;i<2;i++)this.spawnDelivery();
  return true;
};
