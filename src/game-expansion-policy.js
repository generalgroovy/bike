import { Game } from './game-core.js';

export const EXPANSION_POLICIES=[
  {id:'signal',title:'Signal Desk',desc:'+1 radio bandwidth and +1 maximum Dispatch Focus.',apply(game){game.radioSlots+=1;game.dispatchFocusMax+=1;game.dispatchFocus=Math.min(game.dispatchFocusMax,game.dispatchFocus+1);}},
  {id:'team',title:'Rider Care',desc:'15% slower fatigue growth and 12% shorter future breaks.',apply(game){game.modifiers.fatigue*=.85;game.modifiers.breakRelief=Math.min(.6,(game.modifiers.breakRelief??0)+.12);}},
  {id:'clients',title:'Client Network',desc:'Future contracts pay 8% more and receive 5% more deadline room.',apply(game){game.modifiers.reward*=1.08;game.modifiers.deadline*=1.05;}}
];

const baseAdvance=Game.prototype.maybeAdvanceCity;
Game.prototype.maybeAdvanceCity=function(){
  const changed=baseAdvance.call(this);if(!changed)return false;
  this.expansionPolicyPending={level:this.cityLevel,stage:this.currentStage().name,choices:EXPANSION_POLICIES.map(policy=>policy.id)};
  this.expansionPauseWas=this.paused;this.paused=true;this.logDispatch('policy-offer',null,{level:this.cityLevel,stage:this.currentStage().name});
  return true;
};

Game.prototype.expansionPolicyChoices=function(){if(!this.expansionPolicyPending)return[];return EXPANSION_POLICIES.filter(policy=>this.expansionPolicyPending.choices.includes(policy.id));};
Game.prototype.applyExpansionPolicy=function(id){
  const pending=this.expansionPolicyPending,policy=EXPANSION_POLICIES.find(item=>item.id===id);if(!pending||!policy||!pending.choices.includes(id))return false;
  policy.apply(this);this.expansionPolicies??=[];this.expansionPolicies.push({level:pending.level,stage:pending.stage,id:policy.id,title:policy.title});this.expansionPolicyPending=null;const restore=Boolean(this.expansionPauseWas);this.expansionPauseWas=false;this.paused=restore;this.logDispatch('policy',null,{level:pending.level,stage:pending.stage,policy:policy.title});this.flash(`${policy.title.toUpperCase()} · operating doctrine active`,5);return true;
};
