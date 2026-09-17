import test from 'node:test';
import assert from 'node:assert/strict';
import { createCargoIconElement } from '../src/cargo-icons.js';
import { assessRoute,formatRouteMargin } from '../src/route-assessment.js';
import { Game } from '../src/game.js';

// Minimal DOM token behavior supplements (but does not replace) the browser suite.
class Element{
  constructor(tag){this.tag=tag;this.attributes={};this.children=[];this.style={};this.classList={add:(...tokens)=>{for(const token of tokens)if(/\s/.test(token))throw new Error('InvalidCharacterError');}};}
  setAttribute(name,value){this.attributes[name]=String(value);}
  append(child){this.children.push(child);}
}

test('cargo icon accepts the multi-class inspector call and has explicit dimensions',t=>{
  const previous=globalThis.document;
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  globalThis.document={createElementNS:(_ns,tag)=>new Element(tag)};
  const icon=createCargoIconElement('food',{className:'cargo-icon inspector-cargo-icon',title:'Food'});
  assert.equal(icon.attributes.class,'cargo-icon inspector-cargo-icon');
  assert.equal(icon.attributes.width,'24');assert.equal(icon.attributes.height,'24');
  assert.equal(icon.attributes.role,'img');assert.equal(icon.attributes['aria-label'],'Food');
  assert.equal(icon.children[0].tag,'title');assert.equal(icon.children[1].tag,'path');
});

test('ride margins retain deficits rather than becoming a zero countdown',()=>{
  assert.equal(formatRouteMargin(-65),'−1:05 ride margin');
  assert.equal(formatRouteMargin(65),'+1:05 ride margin');
  assert.equal(formatRouteMargin(-.1),'−0:01 ride margin');
  assert.equal(formatRouteMargin(0),'+0:00 ride margin');
  assert.equal(formatRouteMargin(NaN),'ride margin unknown');
  assert.equal(formatRouteMargin(Infinity),'ride margin unknown');
});

test('forecast route events do not pretend that streets are already disrupted',()=>{
  const game=new Game({seed:'v13-forecast-boundary'}),delivery=game.activeDeliveries()[0];
  const edges=delivery.plannedPath.slice(1).map((id,i)=>game.edgeByIds(delivery.plannedPath[i],id)).filter(Boolean);
  game.currentEvent={kind:'route',state:'forecast',edgeIds:edges.map(e=>e.id)};
  assert.equal(assessRoute(game,delivery).eventExposure,0);
  game.currentEvent.state='active';assert.ok(assessRoute(game,delivery).eventExposure>0);
});

test('route ride estimates observe speed upgrades and experience without changing riders',()=>{
  const game=new Game({seed:'v13-speed-estimate'}),delivery=game.activeDeliveries()[0];
  const base=assessRoute(game,delivery);
  game.modifiers.speed*=2;
  const before=JSON.stringify(game.couriers),faster=assessRoute(game,delivery);
  assert.ok(Math.abs(faster.estimatedRideSeconds-base.estimatedRideSeconds/2)<1e-8);
  assert.equal(JSON.stringify(game.couriers),before);
});

test('overdue deadlines remain part of the negative ride margin',()=>{
  const game=new Game({seed:'v13-overdue'}),delivery={...game.activeDeliveries()[0],deadlineAt:game.elapsed-12};
  const result=assessRoute(game,delivery);
  assert.ok(Math.abs(result.slackSeconds+result.estimatedRideSeconds+12)<1e-8);
  assert.equal(result.deadlinePressure,1);
});
