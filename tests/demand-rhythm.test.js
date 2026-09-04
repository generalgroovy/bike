import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game,DEMAND_CYCLE,DEMAND_PHASES } from '../src/game.js';

test('demand rhythm is cyclic, forecastable and contains recovery windows',()=>{
  const g=new Game({seed:'RHYTHM-PHASES'});assert.equal(DEMAND_CYCLE,280);assert.equal(DEMAND_PHASES.length,5);assert.equal(g.demandPhase(0).id,'quiet');assert.equal(g.demandPhase(70).id,'lunch');assert.equal(g.demandPhase(150).id,'office');assert.equal(g.demandPhase(220).id,'evening');assert.equal(g.demandPhase(265).id,'reset');assert.equal(g.demandPhase(280).id,'quiet');assert.ok(g.demandPhase(265).spawnRate<1);assert.ok(g.demandPhase(70).spawnRate>1);
});

test('forecast tells player what comes next without changing simulation state',()=>{
  const g=new Game({seed:'RHYTHM-FORECAST'});g.elapsed=108;const before=[g.elapsed,g.cash,g.dispatchFocus,g.deliveries.length],forecast=g.demandForecast();assert.equal(forecast.current.id,'lunch');assert.equal(forecast.next.id,'office');assert.equal(Math.round(forecast.in),12);assert.deepEqual([g.elapsed,g.cash,g.dispatchFocus,g.deliveries.length],before);
});

test('lunch and office phases create meaningfully different cargo mixes',()=>{
  const sample=(at)=>{const g=new Game({seed:'RHYTHM-MIX'});g.cityLevel=3;g.elapsed=at;const counts={};for(let i=0;i<240;i++){const type=g.weightedDeliveryType();counts[type]=(counts[type]??0)+1;}return counts;},lunch=sample(70),office=sample(150);const lunchCargo=(lunch.food??0)+(lunch.grocery??0)+(lunch.catering??0),officeLunch=(office.food??0)+(office.grocery??0)+(office.catering??0),officeCargo=(office.document??0)+(office.keys??0)+(office.parcel??0),lunchOffice=(lunch.document??0)+(lunch.keys??0)+(lunch.parcel??0);assert.ok(lunchCargo>officeLunch,`${lunchCargo} vs ${officeLunch}`);assert.ok(officeCargo>lunchOffice,`${officeCargo} vs ${lunchOffice}`);
});

test('demand UI is compact forecast information rather than an extra control surface',()=>{
  const ui=readFileSync(new URL('../src/ui-demand-rhythm.js',import.meta.url),'utf8');assert.match(ui,/DEMAND/);assert.match(ui,/demandForecast/);assert.match(ui,/Next:/);assert.doesNotMatch(ui,/setChannel\(|claim\(|spawnDelivery\(|sweetenJob\(|respondToCityEvent\(/);
});