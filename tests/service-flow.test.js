import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

function completeClean(game){const d=game.activeDeliveries().find(x=>x.status==='waiting');assert.ok(d);assert.equal(game.setChannel(d.id,'open'),true);const c=game.availableRiders()[0];assert.ok(c);assert.equal(game.claim(c,d),true);game.completeDelivery(c,d);return d;}

test('clean deliveries build a capped positive FLOW streak and score bonus',()=>{
  const g=new Game({seed:'FLOW-CLEAN'});g.ensureServiceFlow();const before=g.score;completeClean(g);completeClean(g);completeClean(g);const state=g.serviceFlowState();assert.equal(state.streak,3);assert.ok(state.best>=3);assert.ok(state.cleanDeliveries>=3);assert.ok(g.score>before);assert.equal(g.dispatchLog.some(e=>e.action==='flow'&&e.flow===3),true);
});

test('a missed delivery breaks FLOW without adding a new spendable resource',()=>{
  const g=new Game({seed:'FLOW-MISS'});g.ensureServiceFlow();g.serviceFlow=4;g.bestServiceFlow=4;const d=g.activeDeliveries().find(x=>x.status==='waiting');assert.ok(d);g.failDelivery(d);assert.equal(g.serviceFlowState().streak,0);assert.equal(g.dispatchLog.some(e=>e.action==='flow-break'),true);assert.equal('flowCurrency' in g,false);
});

test('district service breach also breaks FLOW',()=>{
  const g=new Game({seed:'FLOW-BREACH'});g.ensureServiceFlow();g.serviceFlow=5;g.deliveries=[];g.cityLevel=1;g.elapsed=10;for(let i=0;i<12;i++)g.deliveries.push({id:`flow-p${i}`,status:'waiting',called:false,channel:null,pickupDistrict:'mitte',dropoffDistrict:'kreuzberg',createdAt:0,deadlineAt:12});g.ensureServicePressure();for(let i=0;i<120&&(g.runStats.districtBreaches??0)<1;i++)g.updateServicePressure(.5);assert.ok(g.runStats.districtBreaches>=1);assert.equal(g.serviceFlowState().streak,0);
});
