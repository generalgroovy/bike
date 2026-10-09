import test from 'node:test';
import assert from 'node:assert/strict';
import { bikeRouteSegments,sampleBikeMotion } from '../src/bike-motion.js';

test('bicycle wheels follow observed road distance without changing rider state',()=>{
  const rider={id:'c0',x:10,y:12,heading:Math.PI/2,phase:'pickup'},before=structuredClone(rider);
  const first=sampleBikeMotion(rider,5),next=sampleBikeMotion({...rider,x:12},5.2,first);
  assert.equal(first.moving,false);assert.equal(first.wheelAngle,0);
  assert.equal(next.moving,true);assert.equal(next.wheelAngle,1.9);assert.equal(next.pedalAngle,.96);
  assert.equal(next.faceLeft,false);assert.deepEqual(rider,before);
  const still=sampleBikeMotion({...rider,x:12},5.4,next);
  assert.equal(still.moving,false);assert.equal(still.wheelAngle,next.wheelAngle);
});

test('pause, reduced motion and handoffs cannot animate bicycle motion',()=>{
  const rider={x:0,y:0,heading:-Math.PI/2,phase:'dropoff'},first=sampleBikeMotion(rider,1);
  for(const option of[{paused:true},{reduced:true}]){
    const frame=sampleBikeMotion({...rider,x:2},1.2,first,option);
    assert.equal(frame.moving,false);assert.equal(frame.wheelAngle,0);assert.equal(frame.pedalAngle,0);
  }
  for(const phase of['loading','handover','waiting-window','idle','break']){
    const frame=sampleBikeMotion({...rider,x:2,phase},1.2,first);
    assert.equal(frame.riding,false);assert.equal(frame.moving,false);assert.equal(frame.wheelAngle,0);
  }
  assert.equal(first.faceLeft,true);
});

test('resuming or restoring does not turn a clock gap into invented pedalling',()=>{
  const rider={x:0,y:0,phase:'pickup'},first=sampleBikeMotion(rider,10);
  for(const elapsed of[9,12]){
    const frame=sampleBikeMotion({...rider,x:30},elapsed,first);
    assert.equal(frame.moving,false);assert.equal(frame.wheelAngle,0);
  }
  const paused=sampleBikeMotion({...rider,x:2},10.2,first,{paused:true});
  const resumed=sampleBikeMotion({...rider,x:2},10.4,paused);
  assert.equal(resumed.moving,false);assert.equal(resumed.wheelAngle,0);
});

test('route ink preserves the full leg and separates travelled from upcoming streets',()=>{
  const nodes=[{id:'a',x:0,y:0},{id:'b',x:10,y:0},{id:'c',x:10,y:10}],game={nodeById:id=>nodes.find(n=>n.id===id)};
  const rider={path:['a','b','c'],pathIndex:1,x:4,y:0},before=structuredClone(rider),parts=bikeRouteSegments(game,rider);
  assert.deepEqual(parts.whole,nodes);
  assert.deepEqual(parts.travelled,[nodes[0],{x:4,y:0}]);
  assert.deepEqual(parts.upcoming,[{x:4,y:0},nodes[1],nodes[2]]);
  assert.deepEqual(rider,before);
  const later=bikeRouteSegments(game,{...rider,pathIndex:2,x:10,y:4});
  assert.deepEqual(later.whole,parts.whole);
  assert.deepEqual(later.travelled,[nodes[0],nodes[1],{x:10,y:4}]);
});
