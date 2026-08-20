import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,PERSONALITIES } from '../src/game.js';

function baseDelivery(game,{pickupId,type='parcel',reward=16,distance=360,deadline=80,channel='open'}={}){
  const pickup=game.nodeById(pickupId)??game.playableAddressNodes()[0];
  return {id:'probe',type,pickupId:pickup.id,dropoffId:pickup.id,reward,plannedDistance:distance,createdAt:0,deadlineAt:deadline,called:true,channel,status:'waiting'};
}

function score(game,rider,personality,delivery){
  const previous=rider.personality;
  rider.personality=personality;
  const value=game.courierChoiceScore(rider,delivery,false);
  rider.personality=previous;
  return value;
}

test('each rider personality has a distinct decision niche',()=>{
  const game=new Game({seed:'PERSONALITY-NICHES'}),rider=game.couriers[0],here=game.nodeById(rider.nodeId),addresses=game.playableAddressNodes();
  const close=addresses.slice().sort((a,b)=>game.routeTravelCost(rider.nodeId,a.id)-game.routeTravelCost(rider.nodeId,b.id))[1];
  const far=addresses.slice().sort((a,b)=>game.routeTravelCost(rider.nodeId,b.id)-game.routeTravelCost(rider.nodeId,a.id))[0];
  const sameDistrict=addresses.find(n=>n.districtId===here.districtId&&n.id!==rider.nodeId)??close;
  const scenarios={
    sprinter:baseDelivery(game,{pickupId:close.id,reward:11,distance:180,deadline:18}),
    earner:baseDelivery(game,{pickupId:far.id,reward:44,distance:520,deadline:90}),
    guardian:baseDelivery(game,{pickupId:far.id,type:'medical',reward:18,distance:330,deadline:22}),
    local:baseDelivery(game,{pickupId:sameDistrict.id,reward:10,distance:160,deadline:70,channel:'local'}),
    tourer:baseDelivery(game,{pickupId:far.id,reward:18,distance:900,deadline:96}),
    steady:baseDelivery(game,{pickupId:close.id,reward:22,distance:380,deadline:55})
  };
  for(const personality of PERSONALITIES){
    const d=scenarios[personality.id];
    const own=score(game,rider,personality,d),others=PERSONALITIES.filter(p=>p.id!==personality.id).map(p=>score(game,rider,p,d));
    assert.ok(Number.isFinite(own));
    assert.ok(own>=Math.max(...others)-.18,`${personality.id} niche weak: ${own.toFixed(2)} vs ${Math.max(...others).toFixed(2)}`);
  }
});

test('generic deterministic job streams do not collapse to one personality',()=>{
  const wins=new Map(PERSONALITIES.map(p=>[p.id,0])),game=new Game({seed:'PERSONALITY-STREAM'}),rider=game.couriers[0];
  game.cityLevel=3;
  for(let i=0;i<140;i++){
    game.deliveries=[];game.spawnDelivery({special:false});const d=game.deliveries[0];if(!d)continue;
    const ranked=PERSONALITIES.map(p=>({id:p.id,score:score(game,rider,p,d)})).sort((a,b)=>b.score-a.score);
    wins.set(ranked[0].id,wins.get(ranked[0].id)+1);
  }
  const values=[...wins.values()],total=values.reduce((a,b)=>a+b,0),max=Math.max(...values),represented=values.filter(v=>v>0).length;
  assert.ok(total>=120);
  assert.ok(represented>=4,`only ${represented} personalities ever win: ${JSON.stringify(Object.fromEntries(wins))}`);
  assert.ok(max/total<.56,`one personality dominates ${(max/total*100).toFixed(1)}%: ${JSON.stringify(Object.fromEntries(wins))}`);
});