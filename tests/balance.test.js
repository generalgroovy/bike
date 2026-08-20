import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

function radioAutopilot(game){
  if(game.upgradePending){const choice=game.getUpgradeChoices()[0];if(choice)game.applyUpgrade(choice.id);}
  const waiting=game.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called).sort((a,b)=>game.urgency(a)-game.urgency(b));
  for(const delivery of waiting){if(game.radioUsed()>=game.radioSlots)break;game.setChannel(delivery.id,'open');}
}

function adaptiveDispatcher(game){
  if(game.upgradePending){const choices=game.getUpgradeChoices(),priority=['rider','radio','briefing','coffee','speed','grace'],choice=priority.map(id=>choices.find(c=>c.id===id)).find(Boolean)??choices[0];if(choice)game.applyUpgrade(choice.id);}
  if(game.currentEvent&&!game.currentEvent.prepared&&game.dispatchFocus>1)game.respondToCityEvent();
  const waiting=game.activeDeliveries().filter(d=>d.status==='waiting').sort((a,b)=>game.urgency(a)-game.urgency(b));
  for(const d of waiting){const urgency=game.urgency(d);if(urgency<.22&&!d.extended&&game.dispatchFocus>1)game.extendJob(d.id);if(urgency<.28&&!d.sweetened&&game.cash>=10)game.sweetenJob(d.id);}
  for(const d of waiting.filter(d=>!d.called)){const urgency=game.urgency(d),channel=urgency<.32?'priority':'open',cost=channel==='priority'?2:1;if(game.radioUsed()+cost<=game.radioSlots)game.setChannel(d.id,channel);else if(game.radioUsed()<game.radioSlots)game.setChannel(d.id,'open');}
}

test('a reasonable dispatcher can survive and learn during the opening two minutes',()=>{
  for(const seed of['PACE-A','PACE-B','PACE-C','PACE-D']){
    const game=new Game({seed});
    for(let step=0;step<1200&&!game.gameOver;step++){if(step%5===0)radioAutopilot(game);game.update(.1);}
    assert.ok(game.elapsed>=115,`${seed} collapsed too early at ${game.elapsed.toFixed(1)}s`);
    assert.ok(game.completed>=3,`${seed} completed only ${game.completed} jobs`);
    assert.ok(game.reputation>0,`${seed} lost all reputation during onboarding window`);
  }
});

test('adaptive dispatch naturally reaches the first city expansion',()=>{
  for(const seed of['EXPAND-A','EXPAND-B','EXPAND-C','EXPAND-D']){
    const game=new Game({seed});
    for(let step=0;step<3600&&!game.gameOver&&game.cityLevel<2;step++){if(step%4===0)adaptiveDispatcher(game);game.update(.1);}
    assert.ok(game.completed>=6,`${seed} only completed ${game.completed} jobs in ${game.elapsed.toFixed(1)}s`);
    assert.ok(game.cityLevel>=2,`${seed} never reached Inner City`);
    assert.ok(game.elapsed<=360,`${seed} expansion took ${game.elapsed.toFixed(1)}s`);
  }
});

test('adaptive dispatch can earn the full Ring under meaningful pressure',()=>{
  for(const seed of['RING-A','RING-B','RING-C','RING-D']){
    const game=new Game({seed});
    for(let step=0;step<9000&&!game.gameOver&&game.cityLevel<3;step++){if(step%4===0)adaptiveDispatcher(game);game.update(.1);}
    assert.equal(game.cityLevel,3,`${seed} stopped at level ${game.cityLevel} after ${game.completed} deliveries / ${game.elapsed.toFixed(1)}s`);
    assert.ok(game.completed>=16);
    assert.ok(game.elapsed>=180,`${seed} unlocked full Ring implausibly fast at ${game.elapsed.toFixed(1)}s`);
    assert.ok(game.elapsed<=900,`${seed} full Ring took ${game.elapsed.toFixed(1)}s`);
    assert.ok(game.runStats.peakActive>=5,`${seed} never experienced queue pressure`);
    assert.ok(game.runStats.toolsUsed>=1,`${seed} never needed a dispatch intervention`);
    assert.ok(game.reputation>0,`${seed} collapsed on expansion`);
  }
});

test('six-rider high-density simulation keeps all state finite across city expansion',()=>{
  const game=new Game({seed:'MAX-LOAD'});game.cityLevel=3;
  while(game.couriers.length<6)game.addCourier();
  while(game.activeDeliveries().length<30)game.spawnDelivery();
  for(let step=0;step<1800&&!game.gameOver;step++){if(step%4===0)radioAutopilot(game);game.update(1/15);}
  assert.equal(game.couriers.length,6);
  assert.ok(Number.isFinite(game.score));
  assert.ok(Number.isFinite(game.reputation));
  assert.ok(game.activeDeliveries().length<=36);
  for(const rider of game.couriers){assert.ok(Number.isFinite(rider.x));assert.ok(Number.isFinite(rider.y));assert.ok(rider.fatigue>=0&&rider.fatigue<=1);}
});
