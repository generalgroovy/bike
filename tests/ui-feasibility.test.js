import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/ui-feasibility.js',import.meta.url),'utf8');
const outlook=readFileSync(new URL('../src/ui-outlook.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../outlook.css',import.meta.url),'utf8');

test('feasibility UI loads through the read-only outlook layer and exposes compact projected states',()=>{assert.match(outlook,/import '\.\/ui-feasibility\.js'/);assert.match(source,/deliveryDispatchInsight/);for(const label of['AT RISK','delivery slack','No rider projected'])assert.match(source,new RegExp(label));for(const state of['future','tight','risk'])assert.match(css,new RegExp(`data-feasibility=${state}`));});

test('feasibility UI only projects data attributes and inspector text',()=>{assert.match(source,/dataset\.feasibility/);assert.match(source,/dataset\.feasibilityLabel/);assert.doesNotMatch(source,/setChannel|claim\(|assign\(|spawnDelivery|sweetenJob|extendJob|rebroadcastJob|respondToCityEvent/);});