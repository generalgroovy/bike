import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('v11 stylesheet stack is static and deterministic before browser modules start',()=>{
  const html=read('../index.html'),shell=read('../src/ui-shell.js');
  const a=html.indexOf('ui-minimal-map-context.css'),b=html.indexOf('ui-map-overview.css'),c=html.indexOf('ui-v10-stable-map.css'),d=html.indexOf('ui-v11-kinetic.css'),script=html.indexOf('src/main.js');
  assert.ok(a>=0&&b>a&&c>b&&d>c&&script>d);
  assert.doesNotMatch(shell,/createElement\(['"]link['"]\)/);
  assert.doesNotMatch(shell,/append\(link\)/);
});

test('v11 establishes a coherent courier-zine palette and map-first hierarchy',()=>{
  const css=read('../ui-v11-kinetic.css');
  assert.match(css,/--v11-ink:#151a20/);
  assert.match(css,/--v11-coral:#ff6b62/);
  assert.match(css,/--v11-cyan:#35c2dc/);
  assert.match(css,/--left-rail:164px/);
  assert.match(css,/--right-rail:176px/);
  assert.match(css,/--top-strip:34px/);
  assert.match(css,/\.task-rail,\.team-dock[\s\S]*background:linear-gradient/);
  assert.match(css,/\.map-stage[\s\S]*radial-gradient/);
});

test('v11 primary radio actions remain legible and strongly differentiated',()=>{
  const css=read('../ui-v11-kinetic.css');
  assert.match(css,/\.task-actions button\{[^}]*font-size:7px/s);
  assert.match(css,/data-channel=open[^}]*--v11-cyan/s);
  assert.match(css,/data-channel=priority[^}]*--v11-amber/s);
  assert.match(css,/data-channel=local[^}]*--v11-mint/s);
  assert.match(css,/data-channel=off[^}]*#4a4f53/s);
});

test('kinetic HUD exposes flow pressure and demand as read-only game energy',()=>{
  const js=read('../src/ui-vibe.js');
  assert.match(js,/serviceFlowState/);
  assert.match(js,/cityPressure/);
  assert.match(js,/demandPhase/);
  assert.match(js,/registerUiTask\('v11-vibe'/);
  for(const forbidden of ['setChannel(','selectCourier(','spawnDelivery(','applyUpgrade(','respondToCityEvent(','game.update('])assert.doesNotMatch(js,new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});

test('dynamic polish respects reduced motion and high contrast',()=>{
  const css=read('../ui-v11-kinetic.css');
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/animation:none!important/);
  assert.match(css,/@media\(prefers-contrast:more\)/);
  assert.match(css,/\.flow-pips i\.on/);
});

test('help and shell agree on the current rail and map-focus controls',()=>{
  const html=read('../index.html'),shell=read('../src/ui-shell.js');
  assert.match(html,/<b>Q<\/b> contracts rail/);
  assert.match(html,/<b>R<\/b> rider rail/);
  assert.match(html,/<b>M<\/b> full map focus/);
  assert.match(shell,/event\.key==='q'/);
  assert.match(shell,/event\.key==='r'/);
  assert.match(shell,/event\.key==='m'/);
});

test('v10 click stability remains loaded before v11 observer and shell work',()=>{
  const shell=read('../src/ui-shell.js');
  const stability=shell.indexOf("import './ui-stability.js'");
  const vibe=shell.indexOf("import './ui-vibe.js'");
  const register=shell.indexOf("registerUiTask('operator-shell'");
  assert.ok(stability>=0&&vibe>stability&&register>vibe);
});
