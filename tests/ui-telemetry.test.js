import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/ui-telemetry.js',import.meta.url),'utf8');
const outlook=readFileSync(new URL('../src/ui-outlook.js',import.meta.url),'utf8');

test('post-shift telemetry remains review-only and compact',()=>{
  assert.match(outlook,/import '\.\/ui-telemetry\.js'/);
  assert.match(source,/game\.gameOver/);
  assert.match(source,/throughputPerMinute/);
  assert.match(source,/averageCallDelay/);
  assert.match(source,/averageAcceptanceDelay/);
  assert.match(source,/peakQueue/);
  assert.match(source,/peakRadio/);
  assert.match(source,/eventsPrepared/);
  assert.match(source,/Area timing/);
  assert.doesNotMatch(source,/setChannel|claim\(|assign/i);
});
