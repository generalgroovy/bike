import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,SCHEDULED_SPECIAL } from '../src/game.js';

function controlledJob(game,{deadline=120,type='parcel'}={}){const rider=game.couriers[0],addresses=game.playableAddressNodes(),pickup=addresses.slice().sort((a,b)=>game.routeTravelCost(rider.nodeId,a.id)-game.routeTravelCost(rider.nodeId,b.id))[0];const candidates=addresses.map(n=>({n,path:game.routeBetween(pickup.id,n.id)})).filter(x=>x.n.id!==pickup.id&&x.path.length>=2&&x.path.length<=5);const drop=candidates[0]?.n??addresses.find(n=>n.id!==pickup.id&&game.routeBetween(pickup.id,n.id).length>1);assert.ok(pickup&&drop);game.deliveries=[];assert.equal(game.spawnDelivery({pickupId:pickup.id,dropoffId:drop.id,typeKey:type,special:false}),true);const d=game.deliveries.at(-1);d.deadlineAt=game.elapsed+deadline;return d;}

test('feasibility classifies deliberately short generous work as safe',()=>{const g=new Game({seed:'FEAS-SAFE'}),d=controlledJob(g,{deadline:600}),f=g.deliveryFeasibility(d,{horizon:600});assert.equal(f.state,'safe');assert.ok(f.best);assert.ok(f.margin>=18);assert.ok(f.best.finishIn>0);});

test('feasibility marks impossible deadline as at risk without broadcasting or claiming',()=>{const g=new Game({seed:'FEAS-RISK'}),d=controlledJob(g,{deadline:.1,type:'grocery'}),before=g.radioUsed(),f=g.deliveryFeasibility(d,{horizon:600});assert.equal(f.state,'risk');assert.ok(f.margin<0);assert.equal(d.called,false);assert.equal(d.courierId,null);assert.equal(g.radioUsed(),before);});

test('future-only capacity is labelled FUTURE when all riders are temporarily resting',()=>{const g=new Game({seed:'FEAS-FUTURE'}),d=controlledJob(g,{deadline:600});for(const r of g.couriers)assert.equal(g.startBreak(r,10),true);const f=g.deliveryFeasibility(d,{horizon:700});assert.equal(f.state,'future');assert.ok(f.best&&!f.best.availableNow);assert.ok(f.margin>=18);});

test('scheduled pickup feasibility includes waiting for client ready time',()=>{const g=new Game({seed:'FEAS-WINDOW'});g.cityLevel=2;g.deliveries=[];const pickup=g.playableAddressNodes()[12],drop=g.playableAddressNodes().find(n=>n.id!==pickup.id&&g.routeBetween(pickup.id,n.id).length>3);assert.equal(g.spawnDelivery({pickupId:pickup.id,dropoffId:drop.id,typeKey:'document',special:SCHEDULED_SPECIAL}),true);const d=g.deliveries.at(-1),f=g.deliveryFeasibility(d,{horizon:900});assert.ok(f.best);assert.ok(f.best.pickupWait>=0);if(f.best.arrivalIn<d.pickupReadyAt-g.elapsed)assert.ok(f.best.pickupWait>0);assert.ok(f.best.finishIn>=f.best.arrivalIn+f.best.pickupWait);});
