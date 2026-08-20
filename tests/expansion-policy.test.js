import test from 'node:test';
import assert from 'node:assert/strict';
import { Game,EXPANSION_POLICIES } from '../src/game.js';

function expanded(seed='POLICY'){const game=new Game({seed});game.completed=6;assert.equal(game.maybeAdvanceCity(),true);return game;}

test('city expansion offers three operating doctrines without pausing simulation state',()=>{const game=expanded();assert.equal(game.cityLevel,2);assert.equal(game.paused,false);assert.deepEqual(game.expansionPolicyChoices().map(p=>p.id),['signal','team','clients']);assert.equal(EXPANSION_POLICIES.length,3);});

test('Signal Desk increases radio and focus capacity only after player choice',()=>{const game=expanded('POLICY-SIGNAL'),radio=game.radioSlots,max=game.dispatchFocusMax;assert.equal(game.applyExpansionPolicy('signal'),true);assert.equal(game.radioSlots,radio+1);assert.equal(game.dispatchFocusMax,max+1);assert.equal(game.expansionPolicies.at(-1).id,'signal');assert.equal(game.expansionPolicyPending,null);});

test('Rider Care and Client Network modify different existing systems',()=>{const team=expanded('POLICY-TEAM'),fatigue=team.modifiers.fatigue;assert.equal(team.applyExpansionPolicy('team'),true);assert.ok(team.modifiers.fatigue<fatigue);assert.ok(team.modifiers.breakRelief>0);const clients=expanded('POLICY-CLIENTS'),reward=clients.modifiers.reward,deadline=clients.modifiers.deadline;assert.equal(clients.applyExpansionPolicy('clients'),true);assert.ok(clients.modifiers.reward>reward);assert.ok(clients.modifiers.deadline>deadline);assert.equal(clients.modifiers.breakRelief??0,0);});

test('a resolved first expansion can offer a fresh doctrine at full Ring expansion',()=>{const game=expanded('POLICY-TWO');game.applyExpansionPolicy('signal');game.completed=30;assert.equal(game.maybeAdvanceCity(),true);assert.equal(game.cityLevel,3);assert.equal(game.expansionPolicyPending.level,3);assert.equal(game.expansionPolicies.length,1);assert.equal(game.applyExpansionPolicy('clients'),true);assert.deepEqual(game.expansionPolicies.map(p=>p.id),['signal','clients']);});
