import { Game } from './game-core.js';

const baseGenerateBerlin=Game.prototype.generateBerlin;
Game.prototype.generateBerlin=function(){
  baseGenerateBerlin.call(this);
  const inner=this.unlockStages.find(stage=>stage.id==='inner'),ring=this.unlockStages.find(stage=>stage.id==='ring');
  if(inner)inner.threshold=6;
  if(ring)ring.threshold=30;
};
