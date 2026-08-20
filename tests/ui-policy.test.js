import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/ui-expansion-policy.js',import.meta.url),'utf8');

test('expansion doctrine uses one compact choice overlay and existing AREA chip memory badge',()=>{assert.match(source,/policy-modal/);assert.match(source,/\.city-chip/);assert.match(source,/policy-status/);assert.match(source,/data-tip/);assert.doesNotMatch(source,/sidebar|drawer|tech-tree|techTree/);});

test('doctrine UI pauses at browser boundary and restores previous pause state',()=>{assert.match(source,/pauseWas=game\.paused/);assert.match(source,/game\.paused=true/);assert.match(source,/game\.paused=pauseWas/);});

test('doctrine memory badge is read-only with respect to simulation choices',()=>{assert.match(source,/expansionPolicies/);assert.doesNotMatch(source,/radioSlots\s*[+*\-]?=|modifiers\.|dispatchFocusMax\s*[+*\-]?=/);});
