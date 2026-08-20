import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

function runSample(seed){const g=new Game({seed});for(let step=0;step<1800&&!g.gameOver;step++){if(step%6===0){for(const d of g.activeDeliveries().filter(d=>d.status==='waiting'&&!d.called)){if(g.radioUsed()>=g.radioSlots)break;g.setChannel(d.id,'open');}}if(g.upgradePending){const u=g.getUpgradeChoices()[0];if(u)g.applyUpgrade(u.id);}g.update(.1);}return g;}

test('telemetry exposes finite pressure timing and throughput measures',()=>{
  const g=runSample('TELEMETRY-A'),t=g.runTelemetry();
  for(const value of[t.elapsed,t.throughputPerMinute,t.averageCallDelay,t.averageAcceptanceDelay,t.averageDeliveryTime,t.peakQueue,t.peakRadio,t.radioPressure,t.toolsUsed,t.breaks,t.eventsPrepared,t.distanceKm])assert.ok(Number.isFinite(value),String(value));
  assert.ok(t.elapsed>0);assert.ok(t.completed>=0);assert.ok(t.failed>=0);assert.ok(t.peakQueue>=1);assert.ok(t.radioPressure>=0);assert.ok(t.radioPressure<=1.5);
  assert.deepEqual(Object.keys(t.failures).sort(),['calledUnclaimed','claimedLate','neverCalled'].sort());
});

test('telemetry is deterministic for identical seed and dispatcher policy',()=>{
  const a=runSample('TELEMETRY-SAME').runTelemetry(),b=runSample('TELEMETRY-SAME').runTelemetry();
  assert.equal(a.completed,b.completed);assert.equal(a.failed,b.failed);assert.equal(a.peakQueue,b.peakQueue);assert.equal(a.peakRadio,b.peakRadio);
  assert.ok(Math.abs(a.averageCallDelay-b.averageCallDelay)<1e-9);assert.ok(Math.abs(a.averageAcceptanceDelay-b.averageAcceptanceDelay)<1e-9);assert.deepEqual(a.failures,b.failures);assert.deepEqual(a.expansions,b.expansions);
});

test('city expansion telemetry records stage and time',()=>{
  const g=new Game({seed:'TELEMETRY-EXPAND'});g.completed=6;assert.equal(g.maybeAdvanceCity(),true);g.completed=30;g.elapsed=240;assert.equal(g.maybeAdvanceCity(),true);const t=g.runTelemetry();
  assert.equal(t.expansions.length,2);assert.equal(t.expansions[0].stage,'Inner City');assert.equal(t.expansions[1].stage,'Inside the Ring');assert.ok(t.expansions[1].at>=t.expansions[0].at);
});
