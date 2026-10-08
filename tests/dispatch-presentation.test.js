import test from 'node:test';
import assert from 'node:assert/strict';
import { jobState } from '../src/desk-state.js';
import { previewKey } from '../src/broadcast-preview.js';
import { timingAdvice } from '../src/playtest-advice.js';

test('no feasible candidate still explains an expired window instead of a missing estimate',()=>{
  const impossible={best:null,label:'NO FIT',remaining:.5};
  assert.equal(timingAdvice(impossible).label,'Too little time');
  assert.match(timingAdvice(impossible).detail,/cannot extend the deadline/);
  assert.equal(timingAdvice({...impossible,remaining:80}).label,'No rider fits');
  assert.match(timingAdvice({...impossible,remaining:80}).detail,/capacity, endurance/);
});

test('queued and carried parcels do not inherit another job’s current handoff',()=>{
  const rider={id:'c0',name:'Kira',deliveryId:'d0',phase:'handover'};
  const game={logistics:true,elapsed:30,courierById:()=>rider};
  const queued={id:'d1',courierId:'c0',status:'claimed',pickedUp:false};
  assert.equal(jobState(game,queued).id,'queued');
  assert.equal(jobState(game,{...queued,pickedUp:true}).id,'carried');
  rider.phase='waiting-window';rider.deliveryId='d1';
  const state=jobState(game,{...queued,pickedUp:true,deliverAfter:55});
  assert.equal(state.id,'waiting-window');assert.match(state.detail,/25s/);
});

test('confirmation identity changes when the forecast, invitation or offer changes',()=>{
  const job={id:'d0',status:'waiting',reward:20,bonusPaid:0,deadlineAt:100};
  const forecast={rider:{id:'c0'}};
  const original=previewKey(job,'open',forecast);
  for(const [d,channel,f] of [
    [job,'local',forecast],[{...job,preferredRiderId:'c1'},'open',forecast],
    [{...job,deadlineAt:120},'open',forecast],[{...job,status:'claimed'},'open',forecast],
    [job,'open',{rider:{id:'c1'}}],[job,'open',{rider:null}]
  ])assert.notEqual(previewKey(d,channel,f),original);
});
