import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');

test('Send It operational hierarchy is task rail then map plus rider dock',()=>{
  assert.match(html,/<title>Send It \/\/ Berlin Dispatch<\/title>/);
  const rail=html.indexOf('class="task-rail"'),workspace=html.indexOf('class="workspace"'),map=html.indexOf('class="map-stage"'),team=html.indexOf('class="team-dock"');
  assert.ok(rail>0&&workspace>rail&&map>workspace&&team>map);
  assert.match(html,/id="job-inspector"/);
  assert.match(html,/id="hover-tip"/);
  assert.match(html,/id="help-panel"/);
});

test('normal-play explanations are outsourced to hover/help while rider instruments stay live',()=>{
  assert.match(html,/data-tip="Dispatch focus powers client calls/);
  assert.match(html,/data-tool="sweeten"/);
  assert.match(html,/data-tool="extend"/);
  assert.match(html,/data-tool="rebroadcast"/);
  assert.match(main,/courierTaskProgress/);
  assert.match(main,/courierETA/);
  assert.match(main,/1-c\.fatigue/);
});

test('dynamic task rider and goal lists use persistent keyed nodes',()=>{
  assert.match(main,/const taskEls=new Map\(\),riderEls=new Map\(\),goalEls=new Map\(\)/);
  assert.match(main,/sort\(\(a,b\)=>a\.createdAt-b\.createdAt\)/);
  assert.doesNotMatch(main,/deliveriesEl\.innerHTML\s*=/);
  assert.doesNotMatch(main,/couriersEl\.innerHTML\s*=/);
  assert.doesNotMatch(main,/goalsEl\.innerHTML\s*=/);
});
