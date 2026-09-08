// Native app acceptance, including the installed runtime when an executable is passed.
// node desktop/smoke.mjs [path/to/Send It.exe]
import {_electron as electron} from 'playwright';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),exe=process.argv[2]&&path.resolve(process.argv[2]);
const folder=path.join(root,'reports/desktop',exe?'packaged':'development');await mkdir(folder,{recursive:true});
const profile=await mkdtemp(path.join(tmpdir(),'send-it-app-test-'));
const env={...process.env,SEND_IT_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;
const result={platform:process.platform,executable:exe??'development',checks:[],pageErrors:[],externalRequests:[],failedResources:[]};
let app,page;
async function launch(){
  app=await electron.launch({...(exe?{executablePath:exe}:{}),args:[...(exe?[]:[root]),'--host-resolver-rules=MAP * ~NOTFOUND'],cwd:root,env,timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(30000);
  page.on('pageerror',e=>result.pageErrors.push(String(e)));
  page.on('request',r=>{if(/^https?:/.test(r.url()))result.externalRequests.push(r.url());});
  page.on('response',r=>{if(r.status()>=400)result.failedResources.push(r.url());});
  await expect(page.locator('#intro')).toBeVisible({timeout:60000});
}
const state=()=>page.evaluate(async()=>{const {Game}=await import('/src/game.js');const g=Game.lastInstance;return {tick:g.tick,seed:g.seed,cash:g.cash,completed:g.completed,positions:g.couriers.map(c=>[c.x,c.y,c.deliveryId]),jobs:g.deliveries.map(d=>[d.id,d.status])};});
try{
  await launch();
  assert.ok(page.url().startsWith('sendit://app/'));
  assert.deepEqual(await page.evaluate(()=>[typeof require,typeof process]),['undefined','undefined']);
  result.checks.push('local custom origin loads with sandboxed renderer and no Node integration');
  await page.context().setOffline(true);
  await page.locator('#start-region').selectOption('spandau');await page.locator('[data-start=training]').click();
  const info=await page.evaluate(async()=>{const {Game}=await import('/src/game.js');const g=Game.lastInstance;return {nodes:g.nodes.length,city:g.cityData.metadata.id,rules:g.ruleset,start:g.startRegion};});
  assert.deepEqual(info,{nodes:198430,city:'berlin-city-v1-b81f2dddf012',rules:'berlin-dispatch-v5',start:'spandau'});
  assert.equal(await page.locator('#start-region option').count(),98);
  result.checks.push('complete Berlin and all locality choices load with networking offline');
  await page.locator('.rider-locate').first().click();
  await page.waitForFunction(async()=>{const {Renderer}=await import('/src/render.js');const b=Renderer.lastInstance.buildingDetails;return b?.cache.size>0&&!b.pending.size&&!b.queue.length;});
  await expect(page.locator('#map-detail-status')).toContainText('Official building footprints');
  await page.screenshot({path:path.join(folder,'berlin.png')});
  result.checks.push('building detail and courier portraits render from bundled assets while offline');
  const before=await state();
  await page.locator('#open-sound-studio').click();
  for(const rider of ['Kira','Mauro','Brian'])await page.locator(`[data-listen=${rider}]`).click();
  for(let i=0;i<4;i++)await page.locator(`[data-rhythm="${i}"]`).click();
  assert.equal(await page.evaluate(async()=>{const {DeskScore}=await import('/src/playtest-score.js');return DeskScore.lastInstance.ctx.state;}),'running');
  await page.locator('#studio-toggle').click();
  assert.equal(await page.evaluate(async()=>{const {DeskScore}=await import('/src/playtest-score.js');return DeskScore.lastInstance.voices.size;}),0);
  await page.locator('#close-sound').click();assert.deepEqual(await state(),before);
  result.checks.push('three rider themes, four task rhythms and exact mute work without changing simulation');
  await page.locator('.job-select').click();await page.locator('#client-call').click();
  await expect(page.locator('#client-call-detail')).toContainText('fee reduced');
  await page.locator('.quick-call').click();await page.locator('#pause').click();
  await expect(page.locator('.job-status')).toContainText('is on it',{timeout:12000});
  await expect(page.locator('#delivery-receipt')).toBeVisible({timeout:30000});
  await page.locator('#pause').click();
  result.checks.push('client tradeoff, autonomous acceptance and real-time collection/delivery complete offline');
  const snapshot=await state();await page.screenshot({path:path.join(folder,'delivery.png')});
  await app.close();app=null;
  await launch();await page.context().setOffline(true);
  await expect(page.locator('#resume-saved')).toBeVisible();await page.locator('#resume-saved').click();
  assert.deepEqual(await state(),snapshot);
  result.checks.push('closing and relaunching the app restores the exact saved shift, paused');
  await page.locator('#pause').click();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());
  await page.waitForFunction(async()=>{const {Game}=await import('/src/game.js');return Game.lastInstance.paused;});
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.restore();w.focus();});
  result.checks.push('minimize pauses and saves the running desk');
  // Exercise the real native-menu callback and its separate sandboxed window.
  const newWindow=app.waitForEvent('window');
  await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(i=>i.label==='Help').submenu.items[0].click());
  const sources=await newWindow;
  await expect(sources.locator('h1')).toContainText('One city');
  await sources.screenshot({path:path.join(folder,'map-sources.png')});
  await sources.close();await page.bringToFront();
  result.checks.push('offline map provenance opens from the app menu');
  // Test Chromium downloads using the same blob mechanism as the review button.
  const downloadPath=path.join(profile,'shift-export.json');
  await app.evaluate(({session},dest)=>session.defaultSession.once('will-download',(_e,item)=>item.setSavePath(dest)),downloadPath);
  await page.evaluate(async()=>{const {Game}=await import('/src/game.js');const a=document.createElement('a');a.download='shift-export.json';a.href=URL.createObjectURL(new Blob([JSON.stringify(Game.lastInstance.exportRun())],{type:'application/json'}));a.click();});
  await expect.poll(async()=>{try{return JSON.parse(await readFile(downloadPath,'utf8')).ruleset;}catch{return null;}}).toBe('berlin-dispatch-v5');
  result.checks.push('a shift record exports to a normal local file');
  assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.failedResources,[]);assert.deepEqual(result.externalRequests,[]);
  result.checks.push('no game requests to external services, missing resources or renderer errors');
  result.passed=true;
}finally{
  if(app){await page.screenshot({path:path.join(folder,'last-state.png')}).catch(()=>{});await app.close().catch(()=>{});}
  await writeFile(path.join(folder,'acceptance.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
