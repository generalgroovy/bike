import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

test('dispatch insight compares radio channels without mutating the contract',()=>{
  const game=new Game({seed:'INSIGHT-CHANNELS'}),delivery=game.activeDeliveries()[0],before={called:delivery.called,channel:delivery.channel,reward:delivery.reward,deadlineAt:delivery.deadlineAt,status:delivery.status};
  const insight=game.deliveryDispatchInsight(delivery);
  assert.ok(insight);
  for(const id of['open','local','priority']){
    assert.ok(insight.channels[id]);
    assert.ok(['STRONG','GOOD','FAIR','WEAK','NONE'].includes(insight.channels[id].fit));
  }
  assert.deepEqual({called:delivery.called,channel:delivery.channel,reward:delivery.reward,deadlineAt:delivery.deadlineAt,status:delivery.status},before);
  assert.equal(delivery.courierId,null);
});

test('dispatch insight exposes deadline risk as an option rather than auto acting',()=>{
  const game=new Game({seed:'INSIGHT-RISK'}),delivery=game.activeDeliveries()[0];
  delivery.deadlineAt=game.elapsed+1;game.dispatchFocus=2;
  const insight=game.deliveryDispatchInsight(delivery);
  assert.equal(insight.state,'risk');
  assert.equal(insight.recommendation.action,'CLIENT +20s');
  assert.equal(delivery.extended,false);
  assert.equal(game.dispatchFocus,2);
});

test('rider insight ranks live calls but never commits a rider',()=>{
  const game=new Game({seed:'INSIGHT-RIDER'}),rider=game.couriers[0],[a,b]=game.activeDeliveries();
  game.setChannel(a.id,'open');game.setChannel(b.id,'local');
  const insight=game.riderDispatchInsight(rider,{limit:2});
  assert.equal(insight.available,true);
  assert.ok(insight.calls.length>=1);
  assert.ok(insight.calls.length<=2);
  for(const item of insight.calls){assert.ok(['STRONG','GOOD','FAIR','WEAK'].includes(item.fit));assert.ok(item.reason);}
  assert.equal(rider.deliveryId,null);
  assert.equal(a.courierId,null);
  assert.equal(b.courierId,null);
});
