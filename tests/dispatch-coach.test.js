import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {DispatchCoach} from '../src/dispatch-coach.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('coach follows an actual broadcast and autonomous claim without changing the simulation',()=>{
 const game=new Game({seed:'COACH'}),coach=new DispatchCoach(),first=coach.observe(game);
 assert.equal(first.phase,'choose');assert.equal(game.radioUsed(),0);
 const d=game.deliveryById(first.deliveryId);
 game.setChannel(d.id,'open');assert.equal(coach.observe(game).phase,'live');
 for(const rider of game.couriers)rider.decisionAt=0;
 for(let i=0;i<180&&d.status==='waiting';i++)game.update(1/30);
 assert.equal(d.status,'claimed');assert.equal(coach.observe(game).phase,'claimed');
 assert.equal(game.radioUsed(),0);assert.match(coach.observe(game).text,/slot is free/);
 const other=game.activeDeliveries().find(x=>x.id!==d.id);game.selectedDeliveryId=other?.id;
 d.status='completed';assert.equal(coach.observe(game).phase,'complete');assert.match(coach.observe(game).text,new RegExp(d.id.toUpperCase()));
});

test('removed broadcasts and failed contracts get actionable feedback without inventing success',()=>{
 const game=new Game({seed:'COACH-FAIL'}),coach=new DispatchCoach(),d=game.activeDeliveries()[0];
 game.setChannel(d.id,'local');coach.observe(game);game.setChannel(d.id,'off');
 assert.equal(coach.observe(game).phase,'choose');d.status='failed';
 assert.equal(coach.observe(game).phase,'failed');assert.match(coach.observe(game).text,/better-fit broadcast/);
 d.claimedAt=3;assert.match(coach.observe(game).text,/more time/);
});

test('first guide suggests a feasible opening and still respects the player selection',()=>{
 const game=new Game({seed:'SEND-IT-QUALITY'}),coach=new DispatchCoach(),first=coach.observe(game);
 assert.equal(game.deliveryDispatchInsight(game.deliveryById(first.deliveryId)).state,'safe');
 assert.equal(game.deliveryById(first.deliveryId).called,false);assert.equal(game.elapsed,0);
 game.selectedDeliveryId=game.deliveries[0].id;
 assert.equal(coach.observe(game).deliveryId,game.selectedDeliveryId);
});

test('guide handles no work and no initially safe option without starting time or inventing work',()=>{
 const game=new Game({seed:'COACH-EMPTY'}),coach=new DispatchCoach();
 for(const d of game.deliveries)d.deadlineAt=1;
 assert.equal(coach.observe(game).phase,'choose');assert.equal(game.elapsed,0);
 game.deliveries=[];assert.equal(coach.observe(game).phase,'empty');
 assert.equal(game.radioUsed(),0);
});

test('completed and failed dispatches offer a real unbroadcast next job and follow it only on request',()=>{
 for(const status of['completed','failed']){
  const game=new Game({seed:'NEXT-DISPATCH'}),coach=new DispatchCoach(),first=coach.observe(game);
  game.setChannel(first.deliveryId,'open');coach.observe(game);
  const d=game.deliveryById(first.deliveryId);d.status=status;
  const before=JSON.stringify({deliveries:game.deliveries,couriers:game.couriers,elapsed:game.elapsed,log:game.dispatchLog,rng:game.rng.state});
  const next=coach.observe(game);
  assert.equal(next.phase,status==='completed'?'complete':'failed');assert.equal(next.action,'Show next job');
  assert.notEqual(next.deliveryId,d.id);assert.equal(game.deliveryById(next.deliveryId).called,false);
  assert.equal(coach.deliveryId,d.id);
  assert.equal(coach.followNext(game,next.deliveryId),true);
  assert.equal(coach.observe(game).phase,'choose');assert.equal(coach.observe(game).deliveryId,next.deliveryId);
  assert.equal(JSON.stringify({deliveries:game.deliveries,couriers:game.couriers,elapsed:game.elapsed,log:game.dispatchLog,rng:game.rng.state}),before);
  game.setChannel(next.deliveryId,'local');assert.equal(coach.observe(game).phase,'live');
 }
});

test('next-job offer excludes claimed, expired and already called work and rejects stale choices',()=>{
 const game=new Game({seed:'NEXT-STALE'}),coach=new DispatchCoach(),[done,called,expired]=game.deliveries;
 coach.deliveryId=done.id;done.status='completed';game.setChannel(called.id,'open');
 for(const d of game.deliveries)if(d!==done&&d!==called)d.deadlineAt=game.elapsed;
 assert.equal(coach.observe(game).next,undefined);
 assert.match(coach.observe(game).text,/New jobs will arrive/);
 for(const id of['missing',done.id,called.id,expired.id])assert.equal(coach.followNext(game,id),false);
 assert.equal(coach.deliveryId,done.id);
 expired.deadlineAt=game.elapsed+100;
 assert.equal(coach.observe(game).deliveryId,expired.id);
 expired.status='claimed';assert.equal(coach.followNext(game,expired.id),false);
 expired.status='waiting';game.gameOver=true;assert.equal(coach.followNext(game,expired.id),false);
 assert.equal(coach.observe(game).next,undefined);
});

test('Show next job preserves pause and focuses an enabled inspector control even when radio is full',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const handler=source.slice(source.indexOf("$('#coach-action').addEventListener"),source.indexOf("$('#coach-dismiss').addEventListener"));
 for(const paused of[false,true])for(const full of[false,true]){
  const game=new Game({seed:'NEXT-UI'}),coach=new DispatchCoach(),[done,next]=game.deliveries;
  coach.deliveryId=done.id;done.status='completed';game.paused=paused;
  if(full){game.radioSlots=2;game.setChannel(game.deliveries[2].id,'priority');}
  const radio=game.radioUsed();
  const nodes=new Map();
  const $=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},hidden:false,addEventListener(_event,fn){this.click=fn;},focus(){this.focused=true;}});return nodes.get(id);};
  $('#coach-action').dataset={delivery:next.id,next:'true'};
  $('#inspect-broadcasts [data-broadcast="open"]').disabled=full;
  vm.runInNewContext(handler,{$,game,coach,coachPaused:false,hideTip(){},renderUI(){}});
  $('#coach-action').click();
  assert.equal(game.selectedDeliveryId,next.id);assert.equal(game.paused,paused);assert.equal(game.elapsed,0);
  assert.equal(game.radioUsed(),radio);assert.equal(game.deliveryById(next.id).called,false);
  assert.equal($(full?'#inspect-close':'#inspect-broadcasts [data-broadcast="open"]').focused,true);
  next.status='claimed';game.selectedDeliveryId=null;$('#coach-action').click();
  assert.equal(game.selectedDeliveryId,null);assert.equal(game.paused,paused);
  assert.equal($('#coach-action').focused,true);
 }
});
