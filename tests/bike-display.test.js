import test from 'node:test';
import assert from 'node:assert/strict';
import { bikeVisual,riderEndurance,riderLoad } from '../src/bike-display.js';

test('endurance presents current points against the actual maximum',()=>{
  assert.deepEqual(riderEndurance({fatigue:.25,enduranceMax:80}),{current:60,max:80,ratio:.75});
  assert.deepEqual(riderEndurance({fatigue:1.2}),{current:0,max:100,ratio:0});
  assert.deepEqual(riderEndurance({fatigue:-.1}),{current:100,max:100,ratio:1});
});

test('load display counts carried parcels and retains future jobs separately',()=>{
  const rider={id:'c0',capacityKg:12},deliveries=[
    {id:'carried',courierId:'c0',status:'claimed',pickedUp:true,weightKg:3.2},
    {id:'later',courierId:'c0',status:'claimed',pickedUp:false,weightKg:7},
    {id:'finished',courierId:'c0',status:'delivered',pickedUp:true,weightKg:8},
    {id:'other',courierId:'c1',status:'claimed',pickedUp:true,weightKg:5}
  ];
  const load=riderLoad({deliveries},rider);
  assert.equal(load.currentKg,3.2);assert.equal(load.capacityKg,12);assert.equal(load.ratio,3.2/12);
  assert.deepEqual(load.jobs.map(d=>d.id),['carried','later']);
});

test('bike identity is independent of rider name and supports an unknown-type fallback',()=>{
  assert.equal(bikeVisual({name:'Kira',bikeType:'cargo'}).label,'Cargo bike');
  assert.equal(bikeVisual('road').label,'Road bike');
  assert.equal(bikeVisual({}).id,'city');
});
