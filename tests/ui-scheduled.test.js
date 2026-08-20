import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/ui-scheduled.js',import.meta.url),'utf8');
const outlook=readFileSync(new URL('../src/ui-outlook.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../outlook.css',import.meta.url),'utf8');

test('scheduled pickup UI loads through existing read-only outlook layer',()=>{assert.match(outlook,/import '\.\/ui-scheduled\.js'/);assert.match(source,/Game\.lastInstance/);assert.match(source,/waiting-pickup/);assert.match(source,/PICKUP WINDOW/);assert.doesNotMatch(source,/setChannel|claim\(|assign\(|spawnDelivery|update\(/);});

test('scheduled rider wait uses data attributes and CSS rather than fighting main text renderer',()=>{assert.match(source,/dataset\.scheduledWait/);assert.match(source,/dataset\.waitLabel/);assert.match(source,/dataset\.waitTime/);assert.match(css,/data-scheduled-wait=true/);assert.match(css,/content:'WAITING'/);assert.match(css,/width:35%!important/);});
