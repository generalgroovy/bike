import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const css=read('../ui-map-overview.css');
const shell=read('../src/ui-shell.js');

test('map overview layout uses full-height center canvas with narrow side rails',()=>{
  assert.match(css,/--left-rail:188px/);assert.match(css,/--right-rail:204px/);assert.match(css,/--top-strip:38px/);
  assert.match(css,/grid-template-columns:var\(--left-rail\) minmax\(0,1fr\) var\(--right-rail\)/);
  assert.match(css,/grid-template-rows:var\(--top-strip\) minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/100vh\s*-\s*120px/);
});

test('contract rail is vertical and moved into the workspace',()=>{
  assert.match(shell,/workspace\.insertBefore\(taskRail,mapStage\)/);
  assert.match(css,/\.task-strip\{[^}]*flex-direction:column/);
  assert.match(css,/overflow-y:auto/);
  assert.match(css,/\.task-card\{[^}]*width:100%/);
});

test('contract and rider rails collapse independently and persist locally',()=>{
  assert.match(shell,/sendit\.leftRail\.v9/);assert.match(shell,/sendit\.rightRail\.v9/);
  assert.match(shell,/left-rail-toggle/);assert.match(shell,/right-rail-toggle/);
  assert.match(css,/data-left-rail=collapsed/);assert.match(css,/data-right-rail=collapsed/);
  assert.match(css,/--rail-collapsed:24px/);
});

test('full map focus removes both side rails without dispatch authority',()=>{
  assert.match(css,/data-map-focus=true[^}]*\.workspace/);assert.match(css,/data-map-focus=true[^}]*\.task-rail/);assert.match(css,/data-map-focus=true[^}]*\.team-dock/);
  assert.doesNotMatch(shell,/setChannel\(/);assert.doesNotMatch(shell,/claim\(/);assert.doesNotMatch(shell,/assign\(/);assert.doesNotMatch(shell,/spawnDelivery\(/);assert.doesNotMatch(shell,/game\.update\(/);
});

test('map overview layout has desktop low-height and accessibility fallbacks',()=>{
  assert.match(css,/@media\(min-width:1700px\)/);assert.match(css,/@media\(max-width:1200px\)/);assert.match(css,/@media\(max-width:900px\)/);assert.match(css,/@media\(max-height:700px\)/);
  assert.match(css,/@media\(prefers-contrast:more\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
