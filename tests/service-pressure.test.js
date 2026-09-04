import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.js';

function overloadDistrict(game,id,count=10){
  game.deliveries=[];game.cityLevel=1;game.elapsed=10;
  for(let i=0;i<count;i++)game.deliveries.push({id:`p${i}`,status:'waiting',called:false,channel:null,pickupDistrict:id,dropoffDistrict:'kreuzberg',createdAt:0,deadlineAt:12});
}

test('district service pressure turns unresolved local work into spatial strain',()=>{
  const g=new Game({seed:'PRESSURE-LOAD'});overloadDistrict(g,'mitte');for(let i=0;i<20;i++)g.updateServicePressure(.5);
  const state=g.districtPressure('mitte');assert.ok(state.pressure>55,`pressure ${state.pressure}`);assert.ok(state.waiting>=8);assert.ok(state.urgent>=8);assert.ok(g.cityPressure()>=state.pressure-.001);
});

test('sustained overload causes an explicit service breach instead of an invisible loss',()=>{
  const g=new Game({seed:'PRESSURE-BREACH'});overloadDistrict(g,'mitte',12);const before=g.reputation;for(let i=0;i<120&&g.runStats.districtBreaches<1;i++)g.updateServicePressure(.5);
  assert.ok(g.runStats.districtBreaches>=1);assert.equal(g.reputation,before-5);const state=g.districtPressure('mitte');assert.ok(state.breaches>=1);assert.equal(g.dispatchLog.at(-1).type,'service-breach');
});

test('service pressure snapshot is a read-only projection sorted by pressure',()=>{
  const g=new Game({seed:'PRESSURE-SNAPSHOT'});overloadDistrict(g,'mitte');for(let i=0;i<12;i++)g.updateServicePressure(.5);const before=g.districtPressure('mitte').pressure,snapshot=g.servicePressureSnapshot();assert.equal(snapshot[0].district.id,'mitte');snapshot[0].pressure=0;assert.equal(g.districtPressure('mitte').pressure,before);
});

test('pressure UI remains a compact read-only instrument and map rendering exposes load',()=>{
  const ui=readFileSync(new URL('../src/ui-service-pressure.js',import.meta.url),'utf8'),map=readFileSync(new URL('../src/render-map.js',import.meta.url),'utf8');assert.match(ui,/CITY LOAD/);assert.match(ui,/mostPressuredDistrict/);assert.match(ui,/dataset\.pickupLoad/);assert.doesNotMatch(ui,/setChannel\(|spawnDelivery\(|claim\(|sweetenJob\(|game\.update\(/);assert.match(map,/drawServicePressure/);assert.match(map,/LOAD \$\{Math\.round\(pressure\)\}/);
});