import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

function radioAutopilot(game){
  if(game.upgradePending){const choice=game.getUpgradeChoices()[0];if(choice)game.applyUpgrade(choice.id);}
  const waiting=game.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called).sort((a,b)=>game.urgency(a)-game.urgency(b));
  for(const delivery of waiting){if(game.radioUsed()>=game.radioSlots)break;game.setChannel(delivery.id,'open');}
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
