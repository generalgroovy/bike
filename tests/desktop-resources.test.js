import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {resourceName,externalLink,appNavigation,createResourceHandler}=require('../desktop/resources.cjs');
const root=fileURLToPath(new URL('../',import.meta.url)),handler=createResourceHandler(root);
test('app URLs resolve only public game resources on the local app origin',()=>{
  assert.equal(resourceName('sendit://app/?mode=training'),'index.html');
  assert.equal(resourceName('sendit://app/generated/berlin-buildings/10-10.json.gz'),'generated/berlin-buildings/10-10.json.gz');
  for(const url of ['file:///etc/passwd','https://app/index.html','sendit://other/index.html','sendit://user@app/index.html','sendit://app/desktop/main.cjs','sendit://app/package.json','sendit://app/src/%2e%2e%2fdesktop/main.cjs','sendit://app/src/%5c..%5cpackage.json','sendit://app/src/%00x.js','sendit://app/src/%zz.js'])assert.equal(resourceName(url),null,url);
  assert.equal(appNavigation('sendit://app/map-data.html'),true);assert.equal(appNavigation('sendit://app/src/playtest-main.js'),false);
});
test('custom protocol serves exact map bytes and proper script MIME without exposing native code',async()=>{
  const file='generated/berlin-city.json.gz',response=await handler({url:'sendit://app/'+file,method:'GET'});
  assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),await readFile(new URL('../'+file,import.meta.url)));
  const script=await handler({url:'sendit://app/src/playtest-main.js',method:'GET'});
  assert.match(script.headers.get('content-type'),/^text\/javascript/);assert.match(script.headers.get('content-security-policy'),/script-src 'self'/);
  assert.equal((await handler({url:'sendit://app/desktop/main.cjs',method:'GET'})).status,404);
  assert.equal((await handler({url:'sendit://app/index.html',method:'POST'})).status,405);
  assert.equal((await handler({url:'sendit://app/src/missing.js',method:'GET'})).status,404);
});
test('external source links allow only expected HTTPS publishers',()=>{
  assert.equal(externalLink('https://daten.berlin.de/datensaetze/alkis'),true);
  for(const url of ['javascript:alert(1)','file:///C:/Windows','http://github.com/','https://github.com.evil.test/','https://user:secret@github.com/','https://unrelated.test/'])assert.equal(externalLink(url),false,url);
});
