import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('audio engine keeps UI and gameplay cues inside one tempo and harmonic palette',()=>{
  const audio=read('../src/audio-engine.js');
  assert.match(audio,/key:'D minor pentatonic'/);assert.match(audio,/bpm:102/);assert.match(audio,/beat\(div=2\)/);assert.match(audio,/cargoPitch/);assert.match(audio,/ping\(/);assert.match(audio,/riderSpeed\(/);assert.match(audio,/ambience\(/);assert.match(audio,/case'call-open'/);assert.match(audio,/case'call-priority'/);assert.match(audio,/case'call-local'/);assert.match(audio,/case'tool-sweeten'/);assert.match(audio,/case'tool-extend'/);assert.match(audio,/case'tool-rebroadcast'/);assert.match(audio,/case'phase-lunch'/);assert.match(audio,/case'pressure'/);assert.match(audio,/case'breach'/);assert.match(audio,/case'goal'/);assert.match(audio,/case'upgrade'/);assert.match(audio,/case'flow'/);assert.match(audio,/case'city-expand'/);
});

test('sensory controller observes deterministic state but never drives simulation',()=>{
  const ui=read('../src/ui-sensory.js');
  assert.match(ui,/dispatchLog/);assert.match(ui,/activeDeliveries\(\)/);assert.match(ui,/riderSpeed/);assert.match(ui,/cityPressure/);assert.match(ui,/audio\.ambience/);assert.match(ui,/type:d\.type/);assert.match(ui,/metricCues/);assert.match(ui,/clientPitch/);assert.match(ui,/data\.clientKind|dataset\.clientKind/);assert.match(ui,/sendit\.sound\.v6/);assert.match(ui,/sound-toggle/);
  assert.doesNotMatch(ui,/setChannel\(/);assert.doesNotMatch(ui,/claim\(/);assert.doesNotMatch(ui,/spawnDelivery\(/);assert.doesNotMatch(ui,/game\.update\(/);assert.doesNotMatch(ui,/dispatchFocus\s*[-+]=/);assert.doesNotMatch(ui,/reputation\s*=/);
});

test('map sensory layer renders sonar radio bursts tool memory and speed trails with reduced-motion fallback',()=>{
  const entities=read('../src/render-entities.js'),renderer=read('../src/render.js'),map=read('../src/render-map.js');
  assert.match(entities,/drawDeliveryRipple/);assert.match(entities,/drawBroadcastBurst/);assert.match(entities,/drawToolMarks/);assert.match(entities,/drawRiderTrails/);assert.match(entities,/speed\/Math\.max\(1,rider\.baseSpeed\)/);assert.match(entities,/prefers-reduced-motion/);assert.match(renderer,/riderTrails/);assert.match(renderer,/sampleRiderTrails/);assert.match(map,/drawServicePressure/);assert.match(map,/drawDistrictBriefs/);assert.match(map,/prefers-reduced-motion/);assert.doesNotMatch(renderer,/setChannel\(|claim\(|spawnDelivery\(/);
});

test('sound is explicit optional and recurring clients have distinct sensory identity',()=>{
  const html=read('../index.html'),css=read('../sensory.css'),clients=read('../src/ui-client-hubs.js');
  assert.match(html,/id="sound-toggle"/);assert.match(html,/Sensory language/);assert.match(html,/Delivery sonar = waiting work/);assert.match(css,/data-muted/);assert.match(css,/FLOW ×3/);assert.match(css,/data-client-kind="kitchen"/);assert.match(css,/data-kind="clinic"/);assert.match(clients,/dataset\.clientKind/);assert.match(clients,/client\.dataset\.kind/);
});
