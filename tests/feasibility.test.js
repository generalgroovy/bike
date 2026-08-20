import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,SCHEDULED_SPECIAL } from '../src/game.js';

function jobAt(game,{deadline=120,type='parcel',special=false}={}){const pickup=game.playableAddressNodes()[10],drop=game.playableAddressNodes().find(n=>n.id!==pickup.id&&game.routeBetween(pickup.id,n.id).length>2);game.deliveries=[];assert.equal(game.spawnDelivery({pickupId:pickup.id,dropoffId:drop.id,typeKey:type,special}),true);const d=game.deliveries.at(-1);d.deadlineAt=game.elapsed+deadline;return d;}

test('feasibility classifies generous work as safe with a best rider and positive slack',()=>{const g=new Game({seed:'FEAS-SAFE'}),d=jobAt(g,{deadline:300});const f=g.deliveryFeasibility(d,{horizon:400});assert.equal(f.state,'safe');assert.ok(f.best);assert.ok(f.margin>=18);assert.ok(f.best.finishIn>0);});

test('feasibility marks impossible deadline as at risk without broadcasting or claiming',()=>{const g=new Game({seed:'FEAS-RISK'}),d=jobAt(g,{deadline:1,type:'grocery'}),before=g.radioUsed(),f=g.deliveryFeasibility(d,{horizon:400});assert.equal(f.state,'risk');assert.ok(f.margin<0);assert.equal(d.called,false);assert.equal(d.courierId,null);assert.equal(g.radioUsed(),before);});

test('future-only capacity is labelled FUTURE when it still fits deadline',()=>{const g=new Game({seed:'FEAS-FUTURE'}),d=jobAt(g,{deadline:500});for(const r of g.couriers)g.startBreak(r,10);const f=g.deliveryFeasibility(d,{horizon:600});assert.equal(f.state,'future');assert.ok(f.best&&!f.best.availableNow);assert.ok(f.margin>=18);});

test('scheduled pickup feasibility includes waiting for client ready time',()=>{const g=new Game({seed:'FEAS-WINDOW'});g.cityLevel=2;g.deliveries=[];const pickup=g.playableAddressNodes()[12],drop=g.playableAddressNodes().find(n=>n.id!==pickup.id&&g.routeBetween(pickup.id,n.id).length>3);assert.equal(g.spawnDelivery({pickupId:pickup.id,dropoffId:drop.id,typeKey:'document',special:SCHEDULED_SPECIAL}),true);const d=g.deliveries.at(-1),f=g.deliveryFeasibility(d,{horizon:600});assert.ok(f.best);assert.ok(f.best.pickupWait>=0);if(f.best.arrivalIn<d.pickupReadyAt-g.elapsed)assert.ok(f.best.pickupWait>0);assert.ok(f.best.finishIn>=f.best.arrivalIn+f.best.pickupWait);});
