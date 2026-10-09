import test from 'node:test';
import assert from 'node:assert/strict';
import {RadioDesk} from '../src/radio-desk.js';

const make=()=>({seed:'RADIO-DESK',elapsed:0,couriers:[],deliveries:[{id:'d0',weightKg:1,reward:15,type:'document',pickupAddress:'Mitte'}]});
const desk=()=>new RadioDesk({querySelector:()=>null});
test('separate confirmed calls at one paused timestamp remain distinct immutable history snapshots',()=>{
  const view=desk(),game=make(),first={action:'call',at:0,deliveryId:'d0',channel:'open'};
  view.observe(game,[first]);const snapshot=structuredClone(view.history[0]);
  view.observe(game,[first]);assert.equal(view.history.length,1);
  game.deliveries[0].reward=12;
  view.observe(game,[{action:'uncall',at:0,deliveryId:'d0'},{...first}]);
  assert.equal(view.history.length,3);assert.notEqual(view.history[0].id,view.history[2].id);
  assert.deepEqual(view.history[0],snapshot);assert.equal(view.current.id,view.history[1].id);
});
test('outcomes outrank arrivals and expiry uses only simulation time',()=>{
  const view=desk(),game=make();game.elapsed=10;
  view.observe(game,[{action:'fail',at:10,deliveryId:'d0',kind:'never-called'},{action:'spawn',at:10,deliveryId:'d0'}]);
  assert.equal(view.current.action,'fail');const current=view.current;
  view.observe(game,[]);assert.equal(view.current,current);
  game.elapsed=20;view.observe(game,[]);assert.equal(view.current,null);
});
test('opening arrivals do not cover the map and a new run clears presentation history',()=>{
  const view=desk(),game=make();view.observe(game,[{action:'spawn',at:0,deliveryId:'d0'}]);
  assert.equal(view.current,null);assert.equal(view.history.length,1);
  view.reset();assert.deepEqual(view.history,[]);assert.equal(view.current,null);
});
