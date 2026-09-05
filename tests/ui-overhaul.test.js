import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('operator shell adds density and map-focus controls without dispatch authority',()=>{
  const ui=read('../src/ui-shell.js');
  assert.match(ui,/sendit\.uiDensity\.v\d+/);assert.match(ui,/data\.density|dataset\.density/);assert.match(ui,/dataset\.mapFocus/);assert.match(ui,/queue-status/);assert.match(ui,/team-status/);assert.match(ui,/keydown/);
  assert.doesNotMatch(ui,/setChannel\(/);assert.doesNotMatch(ui,/claim\(/);assert.doesNotMatch(ui,/spawnDelivery\(/);assert.doesNotMatch(ui,/dispatchFocus\s*[-+]=/);assert.doesNotMatch(ui,/reputation\s*=/);assert.doesNotMatch(ui,/game\.update\(/);
});

test('overhaul CSS establishes map-first hierarchy responsive density and accessibility fallbacks',()=>{
  const css=read('../ui-overhaul.css');
  assert.match(css,/\.workspace\{[^}]*grid-template-columns:minmax\(500px,1fr\) 318px/);assert.match(css,/data-map-focus=true/);assert.match(css,/data-density=compact/);assert.match(css,/@media\(max-width:980px\)/);assert.match(css,/@media\(max-height:760px\)/);assert.match(css,/@media\(prefers-contrast:more\)/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/\.task-card\[data-risk=risk\]/);assert.match(css,/\.inspect-advice\[data-state=risk\]/);
});

test('index loads the new shell after existing gameplay and sensory surfaces',()=>{
  const html=read('../index.html');
  assert.match(html,/ui-overhaul\.css/);assert.match(html,/src\/ui-shell\.js/);assert.match(html,/Operator UI/);assert.match(html,/D · density/);assert.match(html,/M · map focus/);
});
