import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('stability layer prevents redundant keyed DOM reinsertion that can cancel clicks',()=>{
  const js=read('../src/ui-stability.js');
  assert.match(js,/stabilizeAppend\(deliveries\)/);
  assert.match(js,/stabilizeAppend\(couriers\)/);
  assert.match(js,/node\.parentNode===container/);
  assert.match(js,/stableAppend/);
  assert.doesNotMatch(js,/setChannel\(/);
  assert.doesNotMatch(js,/selectCourier\(/);
  assert.doesNotMatch(js,/game\.update\(/);
});

test('stability layer supplies immediate pointer feedback without changing simulation',()=>{
  const js=read('../src/ui-stability.js');
  assert.match(js,/pointerdown/);
  assert.match(js,/pointerup/);
  assert.match(js,/pointercancel/);
  assert.match(js,/data-pressed|dataset\.pressed/);
});

test('map polish makes the map larger and keeps decorative layers pointer-transparent',()=>{
  const css=read('../ui-v10-stable-map.css');
  assert.match(css,/--left-rail:156px/);
  assert.match(css,/--right-rail:168px/);
  assert.match(css,/--top-strip:30px/);
  assert.match(css,/\.map-stage::before[^}]*pointer-events:none/s);
  assert.match(css,/\.map-stage::after[^}]*pointer-events:none/s);
  assert.match(css,/\.hover-tip\{pointer-events:none/);
  assert.match(css,/#game-canvas[^}]*touch-action:none/);
  assert.match(css,/filter:saturate\(1\.12\) contrast\(1\.045\)/);
});

test('interactive map overlays explicitly retain pointer input',()=>{
  const css=read('../ui-v10-stable-map.css');
  assert.match(css,/\.map-tools,\.time-tools,\.map-city,\.map-context,\.event-chip,\.job-inspector,\.notice\{pointer-events:auto\}/);
  assert.match(css,/button,\[role=button\]\{cursor:pointer\}/);
  assert.match(css,/button\[data-pressed=true\]/);
});

test('operator shell loads stability logic and v10 stylesheet before registering refresh task',()=>{
  const shell=read('../src/ui-shell.js');
  const importAt=shell.indexOf("import './ui-stability.js'");
  const styleAt=shell.indexOf("'ui-v10-stable-map.css'");
  const registerAt=shell.indexOf("registerUiTask('operator-shell'");
  assert.ok(importAt>=0);
  assert.ok(styleAt>importAt);
  assert.ok(registerAt>styleAt);
  assert.match(shell,/\['ui-minimal-map-context\.css','ui-map-overview\.css','ui-v10-stable-map\.css'\]/);
});
