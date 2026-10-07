import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';

test('public entry uses the shared desktop desk; classic and offline files remain complete', () => {
  const dir=mkdtempSync(join(tmpdir(),'send-it-publication-'));
  try {
    const released=join(dir,'released'),preview=join(dir,'preview'),output=join(dir,'site');
    const fixture=(path,files)=>{
      mkdirSync(path);
      for(const [name,bytes] of Object.entries(files)){mkdirSync(join(path,name,'..'),{recursive:true});writeFileSync(join(path,name),bytes);}
      const git=(...args)=>execFileSync('git',args,{cwd:path,stdio:'pipe'});
      git('init');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','fixture');
    };
    const icon=Buffer.alloc(24);icon.writeUInt32BE(256,16);icon.writeUInt32BE(256,20);
    const modern='<!doctype html><head></head><body>Berlin game<script type="module" src="src/game.js"></script></body>';
    fixture(released,{'index.html':'classic desk','src/game.js':'classic simulation'});
    fixture(preview,{'index.html':modern,'playtest.html':'compatibility entry','playtest.css':'game style','map-data.html':'attribution','package.json':'{"version":"0.16.0"}','desktop/icon.png':icon,'src/game.js':'shared simulation','generated/city.gz':'map bytes','assets/portrait.png':'portrait bytes'});
    writeFileSync(join(preview,'assets/private-untracked.txt'),'must not publish');
    execFileSync(process.execPath,[resolve('tools/build-pages.mjs'),released,preview,output]);
    assert.equal(readFileSync(join(output,'classic.html'),'utf8'),'classic desk');
    for(const [path,target] of [['index.html','/bike/preview/berlin/'],['preview/index.html','/bike/preview/berlin/']]){
      const html=readFileSync(join(output,path),'utf8');let navigated;
      const href=`https://example.test/bike/${path}?city=inner-ring&seed=A%26B#route`;
      runInNewContext(html.match(/<script>(.*?)<\/script>/s)[1],{URL,location:{href,search:'?city=inner-ring&seed=A%26B',hash:'#route',replace:value=>{navigated=value;}}});
      assert.equal(navigated,`https://example.test${target}?city=inner-ring&seed=A%26B#route`);
    }
    const root=join(output,'preview/berlin');
    assert.equal(readFileSync(join(root,'src/game.js'),'utf8'),'shared simulation');
    const document=readFileSync(join(root,'index.html'),'utf8');
    assert.ok(document.includes('src="web-platform.js"'));
    const integrity=JSON.parse(readFileSync(join(root,'desktop-source.json')));
    assert.equal(integrity.files.find(f=>f.path==='index.html').sha256,createHash('sha256').update(modern).digest('hex'));
    const pack=JSON.parse(readFileSync(join(root,'offline-pack.json')));
    assert.ok(pack.files.some(f=>f.path==='generated/city.gz'));
    assert.ok(pack.files.some(f=>f.path==='app.webmanifest'));
    assert.ok(!pack.files.some(f=>f.path.includes('private-untracked')));
    for(const file of pack.files){const bytes=readFileSync(join(root,file.path));assert.equal(file.bytes,bytes.length);assert.equal(file.sha256,createHash('sha256').update(bytes).digest('hex'));}
    assert.equal(pack.bytes,pack.files.reduce((n,f)=>n+f.bytes,0));
    assert.ok(readFileSync(join(root,'service-worker.js'),'utf8').includes(pack.version));
  } finally {rmSync(dir,{recursive:true,force:true});}
});
