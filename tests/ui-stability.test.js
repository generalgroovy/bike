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

test('main delegated click wiring remains present for contracts riders and map entities',()=>{
  const main=read('../src/main.js');
  assert.match(main,/deliveriesEl\.addEventListener\('click'/);
  assert.match(main,/game\.setChannel\(d\.id,channel\.dataset\.channel\)/);
  assert.match(main,/couriersEl\.addEventListener\('click'/);
  assert.match(main,/game\.selectCourier\(card\.dataset\.courier\)/);
  assert.match(main,/canvas\.addEventListener\('click'/);
  assert.match(main,/inspectDelivery\(entity\.id\)/);
});

test('v10 map stability contracts remain available under v11',()=>{
  const css=read('../ui-v10-stable-map.css');
  assert.match(css,/--left-rail:156px/);
  assert.match(css,/--right-rail:168px/);
  assert.match(css,/--top-strip:30px/);
  assert.match(css,/\.map-stage::before[^}]*pointer-events:none/s);
  assert.match(css,/\.map-stage::after[^}]*pointer-events:none/s);
  assert.match(css,/\.hover-tip\{pointer-events:none/);
  assert.match(css,/#game-canvas[^}]*touch-action:none/);
});

test('interactive map overlays explicitly retain pointer input',()=>{
  const css=read('../ui-v10-stable-map.css');
  assert.match(css,/\.map-tools,\.time-tools,\.map-city,\.map-context,\.event-chip,\.job-inspector,\.notice\{pointer-events:auto\}/);
  assert.match(css,/button,\[role=button\]\{cursor:pointer\}/);
  assert.match(css,/button\[data-pressed=true\]/);
});

test('operator shell loads stability before v11 observer and no longer injects stylesheets',()=>{
  const shell=read('../src/ui-shell.js'),html=read('../index.html');
  const stabilityAt=shell.indexOf("import './ui-stability.js'");
  const vibeAt=shell.indexOf("import './ui-vibe.js'");
  const registerAt=shell.indexOf("registerUiTask('operator-shell'");
  assert.ok(stabilityAt>=0);
  assert.ok(vibeAt>stabilityAt);
  assert.ok(registerAt>vibeAt);
  assert.doesNotMatch(shell,/createElement\(['"]link['"]\)/);
  assert.match(html,/ui-v10-stable-map\.css/);
  assert.match(html,/ui-v11-kinetic\.css/);
});
