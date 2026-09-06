import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBerlinRuntime } from '../tools/berlin-runtime-lib.mjs';
import { decodeBerlinRuntime,loadBerlinRuntime,queryVisibleStreets,runtimeMapReady,BERLIN_RUNTIME_URL } from '../src/berlin-runtime.js';
import { Renderer } from '../src/render.js';

const fixture=()=>buildBerlinRuntime({streets:[
  {name:'Karl-Marx-Allee',lines:[[[100,100],[260,100],[400,150]]]},
  {name:'Tiny road',lines:[[[160,160],[170,170]]]}
],addresses:[],metadata:{generatedAt:'fixture'}});

test('runtime decode preserves source and returns self-contained queryable roads',()=>{
  const raw=fixture(),before=JSON.stringify(raw),asset=decodeBerlinRuntime(raw);
  assert.equal(JSON.stringify(raw),before);assert.equal(runtimeMapReady(asset),true);
  assert.deepEqual([...asset.geometry[0].points],[100,100,260,100,400,150]);
  assert.equal(queryVisibleStreets(asset,{x1:0,y1:0,x2:500,y2:500},'overview').length,1);
  assert.equal(queryVisibleStreets(asset,{x1:0,y1:0,x2:500,y2:500},'detail').length,2);
});

const corruptions={
  'unsupported version':a=>a.version=1,
  'empty geometry':a=>a.geometry=[],
  'zero quantization':a=>a.q=0,
  'negative quantization':a=>a.q=-10,
  'nonfinite quantization':a=>a.q=Infinity,
  'unknown name':a=>a.geometry[0][0]=1000,
  'unknown class':a=>a.geometry[0][1]=-1,
  'odd coordinate array':a=>a.geometry[0][2].pop(),
  'NaN coordinate':a=>a.geometry[0][2][0]=NaN,
  'reversed bounds':a=>a.geometry[0][3][0]=999999,
  'negative length':a=>a.geometry[0][4]=-1,
  'invalid LOD ID':a=>a.lod.detail.push(-1),
  'incomplete detail LOD':a=>a.lod.detail.pop(),
  'invalid label':a=>a.labels[0][2]=NaN,
  'invalid cell size':a=>a.grid.cellSize=0,
  'invalid grid ID':a=>a.grid.cells['0:0']=[9999],
  'missing grid coverage':a=>a.grid.cells={},
  'network dependency':a=>a.metadata.runtimeNetworkRequired=true
};
for(const[name,corrupt]of Object.entries(corruptions))test(`runtime rejects ${name} before drawing`,()=>{
  const raw=fixture();corrupt(raw);assert.throws(()=>decodeBerlinRuntime(raw),/Invalid Berlin runtime asset/);
});

test('spatial query reuses output, removes duplicates and survives token wrap',()=>{
  const asset=decodeBerlinRuntime(fixture()),out=['stale'],box={x1:90,y1:90,x2:410,y2:175};
  assert.equal(queryVisibleStreets(asset,box,'detail',out),out);
  assert.equal(new Set(out.map(r=>r.index)).size,out.length);
  asset.queryToken=0xffffffff;asset.querySeen.fill(1);
  assert.equal(queryVisibleStreets(asset,box,'detail',out).length,2);
  assert.equal(asset.queryToken,1);
});

test('invalid and enormous viewports cannot create unbounded grid walks',()=>{
  const asset=decodeBerlinRuntime(fixture());
  for(const bounds of [null,{x1:0,y1:0,x2:Infinity,y2:1},{x1:20,y1:0,x2:10,y2:1}])assert.deepEqual(queryVisibleStreets(asset,bounds,'detail'),[]);
  assert.equal(queryVisibleStreets(asset,{x1:-1e100,y1:-1e100,x2:1e100,y2:1e100},'detail').length,2);
});

test('runtime loader requests a local asset and rejects HTTP and JSON failures',async()=>{
  let request;
  const asset=await loadBerlinRuntime(undefined,{fetchImpl:async(url,options)=>{request={url,options};return new Response(JSON.stringify(fixture()));}});
  assert.equal(runtimeMapReady(asset),true);assert.equal(request.url,BERLIN_RUNTIME_URL);
  assert.equal(request.options.credentials,'same-origin');assert.ok(request.options.signal);
  await assert.rejects(loadBerlinRuntime(undefined,{fetchImpl:async()=>new Response('',{status:404})}),/404/);
  await assert.rejects(loadBerlinRuntime(undefined,{fetchImpl:async()=>new Response('not JSON')}));
});

test('runtime loader supports cancellation and timeout without hanging a new shift',async()=>{
  const controller=new AbortController();controller.abort();let fetched=false;
  await assert.rejects(loadBerlinRuntime(undefined,{signal:controller.signal,fetchImpl:()=>{fetched=true;}}));
  assert.equal(fetched,false);
  const pending=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  await assert.rejects(loadBerlinRuntime(undefined,{timeoutMs:5,fetchImpl:pending}),/timed out/);
  const active=new AbortController(),load=loadBerlinRuntime(undefined,{signal:active.signal,fetchImpl:pending});
  active.abort(new Error('new shift'));await assert.rejects(load,/new shift/);
});

test('retired renderer ignores a late asset response and cannot overwrite the new source badge',async t=>{
  const saved={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch,last:Renderer.lastInstance};
  t.after(()=>{for(const key of ['window','document','fetch'])if(saved[key]===undefined)delete globalThis[key];else globalThis[key]=saved[key];Renderer.lastInstance=saved.last;});
  const badge={dataset:{}},pending=[];
  globalThis.window={devicePixelRatio:1};globalThis.document={getElementById:()=>badge};
  globalThis.fetch=()=>new Promise(resolve=>pending.push(resolve));
  const canvas={getBoundingClientRect:()=>({width:900,height:600}),getContext:()=>({setTransform(){}})};
  const game={cityLevel:1,width:1600,height:1120,visualEdges:[]};
  class ProbeRenderer extends Renderer{draw(){this.draws=(this.draws??0)+1;}}
  const old=new ProbeRenderer(canvas,game);old.dispose();
  const current=new ProbeRenderer(canvas,game);
  pending[1](new Response(JSON.stringify(fixture())));await new Promise(setImmediate);
  assert.equal(current.berlinRuntimeState,'ready');assert.equal(current.draws,1);
  pending[0](new Response(JSON.stringify(fixture())));await new Promise(setImmediate);
  assert.equal(old.berlinRuntime,null);assert.equal(old.draws,undefined);
  assert.equal(Renderer.prototype.draw.call(old),false);
  assert.equal(badge.dataset.state,'ready');current.dispose();
});
