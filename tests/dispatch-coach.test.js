import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {DispatchCoach} from '../src/dispatch-coach.js';

test('coach follows an actual broadcast and autonomous claim without changing the simulation',()=>{
 const game=new Game({seed:'COACH'}),coach=new DispatchCoach(),first=coach.observe(game);
 assert.equal(first.phase,'choose');assert.equal(game.radioUsed(),0);
 const d=game.deliveryById(first.deliveryId);
 game.setChannel(d.id,'open');assert.equal(coach.observe(game).phase,'live');
 for(const rider of game.couriers)rider.decisionAt=0;
 for(let i=0;i<180&&d.status==='waiting';i++)game.update(1/30);
 assert.equal(d.status,'claimed');assert.equal(coach.observe(game).phase,'claimed');
 assert.equal(game.radioUsed(),0);assert.match(coach.observe(game).text,/slot is free/);
 const other=game.activeDeliveries().find(x=>x.id!==d.id);game.selectedDeliveryId=other?.id;
 d.status='completed';assert.equal(coach.observe(game).phase,'complete');assert.match(coach.observe(game).text,new RegExp(d.id.toUpperCase()));
});

test('removed broadcasts and failed contracts get actionable feedback without inventing success',()=>{
 const game=new Game({seed:'COACH-FAIL'}),coach=new DispatchCoach(),d=game.activeDeliveries()[0];
 game.setChannel(d.id,'local');coach.observe(game);game.setChannel(d.id,'off');
 assert.equal(coach.observe(game).phase,'choose');d.status='failed';
 assert.equal(coach.observe(game).phase,'failed');assert.match(coach.observe(game).text,/better-fit broadcast/);
 d.claimedAt=3;assert.match(coach.observe(game).text,/more time/);
});
