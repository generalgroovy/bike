import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/ui-queue.js',import.meta.url),'utf8');
const outlook=readFileSync(new URL('../src/ui-outlook.js',import.meta.url),'utf8');

test('queue sorting offers arrival urgency payout and pickup-range views',()=>{assert.match(outlook,/import '\.\/ui-queue\.js'/);for(const mode of['arrival','urgent','payout','range'])assert.match(source,new RegExp(`'${mode}'`));assert.match(source,/nearestIdleDistance/);});

test('queue sorting reorders existing keyed cards through CSS order only',()=>{assert.match(source,/card\.style\.order/);assert.doesNotMatch(source,/createElement\('article'\)|replaceChildren\(|innerHTML\s*=/);assert.doesNotMatch(source,/setChannel|claim\(|assign\(|spawnDelivery|game\.update/);});

test('queue sort mode is a local UI preference and not part of deterministic simulation state',()=>{assert.match(source,/localStorage\.setItem\('sendit\.queueSort\.v5'/);assert.match(source,/aria-pressed/);});
