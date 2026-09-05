import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const css=read('../ui-minimal.css'),context=read('../ui-minimal-map-context.css'),html=read('../index.html'),shell=read('../src/ui-shell.js');

test('minimal GUI reserves substantially more viewport for the map',()=>{
  assert.match(css,/\.commandbar\{height:42px;flex:0 0 42px/);
  assert.match(css,/\.task-rail\{height:78px;flex:0 0 78px/);
  assert.match(css,/\.workspace\{height:calc\(100vh - 120px\)/);
  assert.match(css,/grid-template-columns:minmax\(360px,1fr\) 228px/);
});

test('work and rider surfaces are compact instruments rather than large cards',()=>{
  assert.match(css,/\.task-card\{flex:0 0 178px;height:66px/);
  assert.match(css,/\.rider-card\{min-height:54px/);
  assert.match(css,/\.task-route\.drop\{display:none\}/);
  assert.match(html,/<details class="goals-drawer">/);
  assert.doesNotMatch(html,/<details class="goals-drawer" open>/);
});

test('city load and demand remain visible through a compact map HUD',()=>{
  assert.match(shell,/mapStage\?\.append\(context\)/);
  assert.match(shell,/service-load/);assert.match(shell,/demand-rhythm/);
  assert.match(context,/\.map-context\{/);
  assert.match(context,/position:absolute/);
  assert.doesNotMatch(shell,/setInterval\s*\(/);
});

test('minimal chrome preserves accessibility and core dispatch authority boundaries',()=>{
  assert.match(html,/aria-label="Toggle sound"/);assert.match(html,/aria-label="Help"/);assert.match(html,/aria-label="New shift"/);
  assert.match(shell,/aria-label','/);
  assert.doesNotMatch(shell,/assign\(|claim\(|setChannel\(|spawnDelivery\(/);
});

test('compact mode provides an even denser optional layout',()=>{
  assert.match(css,/html\[data-density=compact\] \.commandbar\{height:38px/);
  assert.match(css,/html\[data-density=compact\] \.task-rail\{height:70px/);
  assert.match(css,/html\[data-density=compact\] \.workspace\{height:calc\(100vh - 108px\)/);
});
