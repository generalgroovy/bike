import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { assessRoute,DISTANCE_BANDS,DIFFICULTY_BANDS } from '../src/route-assessment.js';

function snapshotDelivery(delivery){return JSON.stringify(delivery);}

test('route assessment is deterministic finite and read-only across many seeds',()=>{
  for(let seed=0;seed<24;seed++){
    const a=new Game({seed:`v13-assessment-${seed}`}),b=new Game({seed:`v13-assessment-${seed}`});
    for(let i=0;i<a.activeDeliveries().length;i++){
      const da=a.activeDeliveries()[i],db=b.activeDeliveries()[i],before=snapshotDelivery(da),aa=assessRoute(a,da),ab=assessRoute(b,db);
      assert.deepEqual(aa,ab);
      assert.equal(snapshotDelivery(da),before);
      assert.ok(Number.isFinite(aa.distanceMeters)&&aa.distanceMeters>0);
      assert.ok(Number.isFinite(aa.difficultyScore)&&aa.difficultyScore>=0&&aa.difficultyScore<=100);
      assert.ok(DISTANCE_BANDS.some(band=>band.id===aa.distanceBand));
      assert.ok(DIFFICULTY_BANDS.some(band=>band.id===aa.difficultyBand));
    }
  }
});

test('cargo handling changes difficulty without changing distance semantics',()=>{
  const game=new Game({seed:'v13-cargo-route'}),source=game.activeDeliveries()[0];
  const document={...source,type:'document',cargoSpeed:1,cargoFatigue:.98},catering={...source,type:'catering',cargoSpeed:.82,cargoFatigue:1.48};
  const light=assessRoute(game,document),heavy=assessRoute(game,catering);
  assert.equal(light.distanceMeters,heavy.distanceMeters);
  assert.equal(light.distanceBand,heavy.distanceBand);
  assert.ok(heavy.cargoPenalty>light.cargoPenalty);
  assert.ok(heavy.difficultyScore>=light.difficultyScore);
});

test('active route disruption raises event exposure and route difficulty without assigning a rider',()=>{
  const game=new Game({seed:'v13-event-route'}),delivery=game.activeDeliveries()[0],beforeCourierIds=game.couriers.map(c=>c.deliveryId),base=assessRoute(game,delivery),edgeIds=[];
  for(let i=1;i<delivery.plannedPath.length;i++){const edge=game.edgeByIds(delivery.plannedPath[i-1],delivery.plannedPath[i]);if(edge)edgeIds.push(edge.id);}
  game.currentEvent={kind:'route',state:'active',edgeIds,visualIds:[]};
  const disrupted=assessRoute(game,delivery);
  assert.ok(disrupted.eventExposure>0);
  assert.ok(disrupted.difficultyScore>=base.difficultyScore);
  assert.deepEqual(game.couriers.map(c=>c.deliveryId),beforeCourierIds);
});

test('difficulty is not a synonym for distance',()=>{
  const game=new Game({seed:'v13-not-just-distance'}),delivery=game.activeDeliveries()[0];
  const generous={...delivery,plannedDistance:Math.max(420,delivery.plannedDistance),deadlineAt:game.elapsed+180,type:'document',cargoSpeed:1,cargoFatigue:.98};
  const pressured={...delivery,plannedDistance:Math.min(220,delivery.plannedDistance),deadlineAt:game.elapsed+4,type:'medical',cargoSpeed:1,cargoFatigue:1.02};
  const longRoute=assessRoute(game,generous),shortRoute=assessRoute(game,pressured);
  assert.ok(longRoute.distanceMeters>=shortRoute.distanceMeters);
  assert.ok(shortRoute.deadlinePressure>=longRoute.deadlinePressure);
});
