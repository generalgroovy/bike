import { Game } from './game-core.js';

export const DEMAND_CYCLE=280;
export const DEMAND_PHASES=[
  {id:'quiet',title:'QUIET START',start:0,end:55,spawnRate:.88,desc:'A softer opening. Documents and parcels lead.',typeWeights:{document:1.35,parcel:1.2,food:.85,grocery:.9}},
  {id:'lunch',title:'LUNCH RUSH',start:55,end:120,spawnRate:1.22,desc:'Food, groceries and catering cluster. Protect nearby capacity.',typeWeights:{food:2.15,grocery:1.7,catering:1.8,parcel:.85,document:.7}},
  {id:'office',title:'OFFICE SWEEP',start:120,end:190,spawnRate:1.08,desc:'Documents, keys and parcels spread across the inner city.',typeWeights:{document:1.9,keys:1.7,parcel:1.55,food:.8,grocery:.8}},
  {id:'evening',title:'EVENING HANDOFF',start:190,end:250,spawnRate:1.18,desc:'Food, flowers and fragile handoffs rise as riders tire.',typeWeights:{food:1.55,flowers:1.8,fragile:1.55,grocery:1.15,document:.75}},
  {id:'reset',title:'RESET WINDOW',start:250,end:280,spawnRate:.84,desc:'Demand eases briefly. Recover riders and clear local strain.',typeWeights:{parcel:1.15,document:1.1,medical:1.05}}
];

Game.prototype.demandPhase=function(at=this.elapsed){const t=((at%DEMAND_CYCLE)+DEMAND_CYCLE)%DEMAND_CYCLE,phase=DEMAND_PHASES.find(p=>t>=p.start&&t<p.end)??DEMAND_PHASES[0];return{...phase,cycleTime:t,remaining:phase.end-t,next:DEMAND_PHASES[(DEMAND_PHASES.indexOf(phase)+1)%DEMAND_PHASES.length]};};
Game.prototype.demandTempo=function(){return this.demandPhase().spawnRate;};
Game.prototype.demandForecast=function(){const now=this.demandPhase();return{current:now,next:now.next,in:now.remaining};};
