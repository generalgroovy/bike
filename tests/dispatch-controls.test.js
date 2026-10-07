import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {broadcastChoice,broadcastContract,renderBroadcastChoices,renderDispatchTools} from '../src/dispatch-controls.js';

test('replacing a signal budgets its existing slots and denied attempts preserve pause',()=>{
  const game=new Game({seed:'RADIO-PLANNING'}),[a,b,c]=game.activeDeliveries();
  game.radioSlots=3;game.setChannel(a.id,'priority');game.setChannel(b.id,'open');game.paused=true;
  assert.equal(broadcastChoice(game,a,'local',game.deliveryDispatchInsight(a)).available,true);
  assert.equal(broadcastChoice(game,c,'open',game.deliveryDispatchInsight(c)).available,false);
  assert.equal(broadcastContract(game,c.id,'open',{resumeOnSuccess:true}),false);
  assert.equal(game.paused,true);assert.equal(game.radioUsed(),3);
  assert.equal(broadcastContract(game,a.id,'local',{resumeOnSuccess:true}),true);
  assert.equal(game.paused,false);assert.equal(game.radioUsed(),2);
});

test('ordinary broadcasts and OFF respect intentional pause; only onboarding opts into resume',()=>{
  const game=new Game({seed:'RADIO-PAUSE'}),d=game.activeDeliveries()[0];game.paused=true;
  assert.equal(broadcastContract(game,d.id,'open'),true);assert.equal(game.paused,true);
  assert.equal(broadcastContract(game,d.id,'off',{resumeOnSuccess:true}),true);assert.equal(game.paused,true);
  assert.equal(broadcastContract(game,d.id,'local',{resumeOnSuccess:true}),true);assert.equal(game.paused,false);
});

test('expired, missing, completed and game-over contracts reject stale UI commands atomically',()=>{
  const game=new Game({seed:'RADIO-STALE'}),d=game.activeDeliveries()[0];game.paused=true;
  const before=JSON.stringify(d),log=game.dispatchLog.length;
  assert.equal(broadcastContract(game,'missing','open',{resumeOnSuccess:true}),false);
  assert.equal(broadcastContract(game,d.id,'invalid',{resumeOnSuccess:true}),false);
  assert.equal(JSON.stringify(d),before);assert.equal(game.dispatchLog.length,log);
  for(const status of['completed','claimed','failed']){d.status=status;assert.equal(broadcastContract(game,d.id,'open',{resumeOnSuccess:true}),false);}
  d.status='waiting';d.deadlineAt=game.elapsed;assert.equal(broadcastContract(game,d.id,'open',{resumeOnSuccess:true}),false);
  d.deadlineAt=100;game.gameOver=true;assert.equal(broadcastContract(game,d.id,'open',{resumeOnSuccess:true}),false);
  assert.equal(game.paused,true);assert.equal(d.called,false);assert.equal(d.courierId,null);
});

test('forecast counts preferences against current calls and excludes riders considering other jobs',()=>{
  const game=new Game({seed:'RADIO-COMPETITION'}),[a,b]=game.activeDeliveries();
  game.courierChoiceScore=(r,d)=>d.id===a.id?(d.channel==='priority'?3:1):2;
  assert.equal(game.deliveryDispatchInsight(a).channels.open.listeners,3);
  game.setChannel(b.id,'open');
  const comparison=game.deliveryDispatchInsight(a);
  assert.equal(comparison.channels.open.listeners,0);assert.equal(comparison.channels.priority.listeners,3);
  game.couriers[0].deliberation={deliveryId:b.id,score:2};
  assert.equal(game.deliveryDispatchInsight(a).channels.priority.listeners,2);
  assert.equal(game.deliveryDispatchInsight(a).channels.priority.consideringOther,1);
  game.setChannel(b.id,'off');
  assert.equal(game.deliveryDispatchInsight(a).channels.open.listeners,3);
});

test('same-tick competing channel and bonus changes invalidate comparisons',()=>{
  const game=new Game({seed:'RADIO-INVALIDATE'}),[a,b]=game.activeDeliveries();
  game.courierChoiceScore=(r,d)=>d.id===a.id?2:(d.channel==='priority'?3:1)+(d.bonusAppeal??0)*5;
  game.setChannel(b.id,'open');assert.equal(game.deliveryDispatchInsight(a).channels.open.listeners,3);
  game.setChannel(b.id,'priority');assert.equal(game.deliveryDispatchInsight(a).channels.open.listeners,0);
  game.setChannel(b.id,'open');game.cash=5;game.sweetenJob(b.id);
  assert.equal(game.deliveryDispatchInsight(a).channels.open.listeners,0);
  assert.equal(game.elapsed,0);
});

test('weak and tied estimates do not promise likely listeners',()=>{
  const game=new Game({seed:'RADIO-THRESHOLD'}),[a,b]=game.activeDeliveries();
  game.courierChoiceScore=()=>.2;
  assert.equal(game.deliveryDispatchInsight(a).channels.open.listeners,0);
  game.setChannel(b.id,'open');game.courierChoiceScore=()=>1;
  assert.equal(game.deliveryDispatchInsight(a).channels.open.listeners,0);
  game.couriers.forEach(c=>c.radioOn=false);
  assert.equal(broadcastChoice(game,a,'open',game.deliveryDispatchInsight(a)).feedback,'No free listeners');
});

test('repeated projections preserve autonomous deterministic delivery outcomes',()=>{
  const projected=new Game({seed:'RADIO-DETERMINISM'}),plain=new Game({seed:'RADIO-DETERMINISM'});
  for(const game of[projected,plain]){game.setChannel(game.deliveries[0].id,'open');game.setChannel(game.deliveries[1].id,'local');}
  for(let i=0;i<600;i++){
    if(i%6===0)for(const d of projected.activeDeliveries())projected.deliveryDispatchInsight(d);
    projected.update(1/30);plain.update(1/30);
  }
  assert.equal(projected.rng.state,plain.rng.state);
  assert.deepEqual(projected.deliveries,plain.deliveries);assert.deepEqual(projected.couriers,plain.couriers);
  assert.deepEqual(projected.dispatchLog,plain.dispatchLog);
});

test('inspector reuses controls and exposes live pressed, availability and uncertainty labels',()=>{
  const game=new Game({seed:'RADIO-CONTROLS'}),d=game.activeDeliveries()[0];
  const buttons=['open','local','priority','off'].map(id=>({dataset:{broadcast:id},attrs:{},title:{textContent:''},detail:{textContent:''},setAttribute(k,v){this.attrs[k]=v;},querySelector(s){return s==='strong'?this.title:this.detail;}}));
  const root={querySelectorAll(){return buttons;}};
  renderBroadcastChoices(root,game,d,game.deliveryDispatchInsight(d));
  assert.equal(buttons[3].hidden,true);assert.match(buttons[0].attrs['aria-label'],/Estimate, not a reservation/);
  game.setChannel(d.id,'open');renderBroadcastChoices(root,game,d,game.deliveryDispatchInsight(d));
  assert.equal(buttons[0].attrs['aria-pressed'],'true');assert.equal(buttons[3].hidden,false);
  game.radioSlots=1;renderBroadcastChoices(root,game,d,game.deliveryDispatchInsight(d));
  assert.equal(buttons[2].disabled,true);assert.equal(buttons[2].detail.textContent,'Radio full');
  d.status='claimed';renderBroadcastChoices(root,game,d,null);assert.equal(root.hidden,true);
});

test('tool prices and blocked reasons track resources and job state without replacing controls',()=>{
  const game=new Game({seed:'TOOL-CLARITY'}),d=game.activeDeliveries()[0];
  const buttons=['sweeten','extend','rebroadcast'].map(id=>({dataset:{tool:id},detail:{textContent:''},querySelector(){return this.detail;}}));
  const root={querySelectorAll:()=>buttons};
  game.cash=0;game.dispatchFocus=0;
  renderDispatchTools(root,game,d);
  assert.deepEqual(buttons.map(b=>b.detail.textContent),['Need €5','Need 1 focus','Broadcast first']);
  assert.ok(buttons.every(b=>b.disabled));
  game.cash=5;game.dispatchFocus=2;game.setChannel(d.id,'open');
  renderDispatchTools(root,game,d);
  assert.deepEqual(buttons.map(b=>b.detail.textContent),['Costs €5','Costs 1 focus','Costs 1 focus']);
  assert.ok(buttons.every(b=>!b.disabled));
  game.sweetenJob(d.id);game.extendJob(d.id);renderDispatchTools(root,game,d);
  assert.deepEqual(buttons.slice(0,2).map(b=>b.detail.textContent),['Bonus already added','Time already added']);
  assert.equal(buttons[2].disabled,false);
  d.status='claimed';renderDispatchTools(root,game,d);
  assert.ok(buttons.every(b=>b.disabled&&b.detail.textContent==='Job already taken'));
});
