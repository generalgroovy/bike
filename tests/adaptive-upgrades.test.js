import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.js';

test('low reputation guarantees a goodwill option and explains why',()=>{const g=new Game({seed:'UPGRADE-REP'});g.reputation=42;const diagnosis=g.upgradeDiagnosis(),choices=g.getUpgradeChoices();assert.equal(diagnosis.id,'goodwill');assert.ok(choices.some(u=>u.id==='goodwill'&&u.recommended));assert.match(choices.find(u=>u.id==='goodwill').reason,/REP is 42/);});

test('radio congestion produces a radio capacity recommendation without bypassing the normal three-choice briefing',()=>{const g=new Game({seed:'UPGRADE-RADIO'});g.runStats.radioDenied=4;const choices=g.getUpgradeChoices();assert.equal(choices.length,3);assert.equal(new Set(choices.map(u=>u.id)).size,3);assert.ok(choices.some(u=>u.id==='radio'&&u.recommended));});

test('district strain recommends spatial capacity tooling',()=>{const g=new Game({seed:'UPGRADE-PRESSURE'});g.ensureServicePressure();g.ensureServicePressure().get('mitte').pressure=78;const diagnosis=g.upgradeDiagnosis(),choices=g.getUpgradeChoices();assert.ok(['local-repeater','focus'].includes(diagnosis.id));assert.ok(choices.some(u=>u.id===diagnosis.id&&u.recommended));});

test('same seed and same observed state produce the same adaptive choices',()=>{const a=new Game({seed:'UPGRADE-REPRO'}),b=new Game({seed:'UPGRADE-REPRO'});a.runStats.radioDenied=b.runStats.radioDenied=3;assert.deepEqual(a.getUpgradeChoices().map(u=>[u.id,u.recommended]),b.getUpgradeChoices().map(u=>[u.id,u.recommended]));});

test('adaptive briefing UI explains choices but cannot apply upgrades itself',()=>{const ui=readFileSync(new URL('../src/ui-adaptive-upgrades.js',import.meta.url),'utf8'),game=readFileSync(new URL('../src/game-adaptive-upgrades.js',import.meta.url),'utf8');assert.match(ui,/DESK READ/);assert.match(ui,/RUN FIT/);assert.match(game,/upgradeDiagnosis/);assert.doesNotMatch(ui,/applyUpgrade\(|setChannel\(|claim\(|spawnDelivery\(/);});