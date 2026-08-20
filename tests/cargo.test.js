import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,CARGO_HANDLING } from '../src/game.js';

function loadedScenario(seed,type){
  const g=new Game({seed});g.cityLevel=3;g.deliveries=[];
  const pickup=g.playableAddressNodes()[10],dropoff=g.playableAddressNodes().find(n=>n.id!==pickup.id&&g.routeBetween(pickup.id,n.id).length>4);
  assert.ok(pickup&&dropoff);assert.equal(g.spawnDelivery({pickupId:pickup.id,dropoffId:dropoff.id,typeKey:type,special:false}),true);
  const d=g.deliveries.at(-1),r=g.couriers[0],p=g.nodeById(d.pickupId);r.nodeId=p.id;r.x=p.x;r.y=p.y;r.phase='idle';r.path=[];r.pathIndex=0;r.fatigue=.1;
  assert.equal(g.claim(r,d),true);assert.equal(r.phase,'dropoff');return{g,r,d};
}

test('cargo handling catalogue differentiates light heavy and delicate loads',()=>{
  assert.equal(CARGO_HANDLING.document.speed,1);
  assert.ok(CARGO_HANDLING.catering.speed<CARGO_HANDLING.grocery.speed);
  assert.ok(CARGO_HANDLING.catering.fatigue>CARGO_HANDLING.document.fatigue);
  assert.ok(CARGO_HANDLING.fragile.speed<1);
  assert.ok(CARGO_HANDLING.keys.fatigue<=1);
});

test('spawned contracts expose concise handling consequences for hover detail',()=>{
  const g=new Game({seed:'CARGO-LABEL'});g.cityLevel=3;g.deliveries=[];assert.equal(g.spawnDelivery({typeKey:'catering',special:false}),true);const d=g.deliveries.at(-1);
  assert.match(d.handlingLabel,/Catering|catering|Bulky|loaded speed/i);
  assert.match(d.specialDesc,/loaded speed|fatigue/i);
});

test('heavy catering travels less distance and builds more fatigue than documents over equal time',()=>{
  const light=loadedScenario('CARGO-MOTION','document'),heavy=loadedScenario('CARGO-MOTION','catering');
  const lightStart=light.g.remainingPathDistance(light.r),heavyStart=heavy.g.remainingPathDistance(heavy.r);assert.ok(Math.abs(lightStart-heavyStart)<1e-6);
  const lightFatigue=light.r.fatigue,heavyFatigue=heavy.r.fatigue;
  for(let i=0;i<30;i++){light.g.update(1/30);heavy.g.update(1/30);}
  const lightTravel=lightStart-light.g.remainingPathDistance(light.r),heavyTravel=heavyStart-heavy.g.remainingPathDistance(heavy.r);
  assert.ok(lightTravel>heavyTravel,`light ${lightTravel} heavy ${heavyTravel}`);
  assert.ok((heavy.r.fatigue-heavyFatigue)>(light.r.fatigue-lightFatigue));
  assert.ok(heavy.g.courierETA(heavy.r)>light.g.courierETA(light.r));
});
