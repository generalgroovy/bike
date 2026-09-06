import { mapZoomBand } from './map-zoom.js';

export const BERLIN_RUNTIME_URL='./generated/berlin-runtime-v2.json';
const BANDS=['overview','district','street','detail'];
const LABEL_PRIORITY=Object.freeze({arterial:0,bridge:0,primary:1,secondary:2,local:3});
const validBounds=b=>b&&[b.x1,b.y1,b.x2,b.y2].every(Number.isFinite)&&b.x1<=b.x2&&b.y1<=b.y2;
const intersects=(a,b)=>a.x2>=b.x1&&a.x1<=b.x2&&a.y2>=b.y1&&a.y1<=b.y2;
const fail=message=>{throw new Error(`Invalid Berlin runtime asset: ${message}`);};

// Validate before converting to typed arrays: conversion silently accepts NaN,
// wraps negative IDs, and otherwise lets corrupt assets fail inside a draw loop.
export function decodeBerlinRuntime(raw){
  if(!raw||raw.version!==2||!Array.isArray(raw.geometry)||!raw.geometry.length||!Array.isArray(raw.names))fail('unsupported or empty geometry');
  if(!Number.isFinite(raw.q)||raw.q<=0)fail('quantization must be positive');
  if(!raw.names.every(name=>typeof name==='string')||!Array.isArray(raw.classes)||!raw.classes.length||!raw.classes.every(c=>typeof c==='string'))fail('invalid name or class table');
  if(raw.metadata?.runtimeNetworkRequired!==false)fail('asset must be self-contained');
  const q=raw.q,cellSize=raw.grid?.cellSize;
  if(!Number.isFinite(cellSize)||cellSize<=0||!raw.grid?.cells||typeof raw.grid.cells!=='object'||Array.isArray(raw.grid.cells))fail('invalid spatial grid');
  const validName=id=>Number.isInteger(id)&&id>=0&&id<raw.names.length;
  const validClass=id=>Number.isInteger(id)&&id>=0&&id<raw.classes.length;
  const geometry=raw.geometry.map((item,index)=>{
    if(!Array.isArray(item)||!validName(item[0])||!validClass(item[1]))fail(`road ${index} identity`);
    const packed=item[2],box=item[3];
    if(!Array.isArray(packed)||packed.length<4||packed.length%2||!packed.every(Number.isSafeInteger))fail(`road ${index} coordinates`);
    if(!Array.isArray(box)||box.length!==4||!box.every(Number.isSafeInteger)||!Number.isSafeInteger(item[4])||item[4]<0)fail(`road ${index} bounds or length`);
    const bounds={x1:box[0]/q,y1:box[1]/q,x2:box[2]/q,y2:box[3]/q};
    if(!validBounds(bounds)||!Number.isFinite(item[4]/q))fail(`road ${index} scale`);
    for(let i=0;i<packed.length;i+=2)if(packed[i]<box[0]||packed[i]>box[2]||packed[i+1]<box[1]||packed[i+1]>box[3])fail(`road ${index} bounds exclude geometry`);
    // Float64 avoids overflow and edge-of-viewport rounding beyond validated bounds.
    return {index,nameId:item[0],roadClass:raw.classes[item[1]],points:Float64Array.from(packed,v=>v/q),bounds,length:item[4]/q};
  });
  const validId=id=>Number.isInteger(id)&&id>=0&&id<geometry.length;
  const lod={};
  for(const band of BANDS){
    if(!Array.isArray(raw.lod?.[band])||!raw.lod[band].every(validId))fail(`invalid ${band} LOD`);
    lod[band]=new Set(raw.lod[band]);
  }
  if(lod.detail.size!==geometry.length)fail('detail LOD must cover every road');
  if(!Array.isArray(raw.labels??[]))fail('invalid labels');
  const labels=(raw.labels??[]).map(item=>{
    if(!Array.isArray(item)||item.length!==6||!validName(item[0])||!validClass(item[1])||!item.slice(2).every(Number.isSafeInteger)||item[5]<0||!item.slice(2).every(v=>Number.isFinite(v/q)))fail('invalid label');
    return {nameId:item[0],roadClass:raw.classes[item[1]],x:item[2]/q,y:item[3]/q,angle:item[4]/10000,length:item[5]/q};
  }).sort((a,b)=>(LABEL_PRIORITY[a.roadClass]??9)-(LABEL_PRIORITY[b.roadClass]??9)||b.length-a.length||a.nameId-b.nameId);
  const grid=new Map(),indexed=new Set();
  for(const[key,ids]of Object.entries(raw.grid.cells)){
    if(!/^-?\d+:-?\d+$/.test(key)||!key.split(':').every(v=>Number.isSafeInteger(Number(v)))||!Array.isArray(ids)||!ids.every(validId))fail('invalid grid cell');
    grid.set(key,Uint32Array.from(ids));for(const id of ids)indexed.add(id);
  }
  if(indexed.size!==geometry.length)fail('spatial grid must cover every road');
  return {version:2,metadata:raw.metadata,projection:raw.projection??null,classes:raw.classes,names:raw.names,geometry,lod,labels,grid,cellSize,addresses:raw.addresses??[],querySeen:new Uint32Array(geometry.length),queryToken:0};
}

export async function loadBerlinRuntime(url=BERLIN_RUNTIME_URL,{signal,timeoutMs=8000,fetchImpl=globalThis.fetch}={}){
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new TypeError('timeoutMs must be positive');
  const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(()=>controller.abort(new Error('Berlin runtime request timed out')),timeoutMs);
  try{
    if(controller.signal.aborted)throw controller.signal.reason;
    const response=await fetchImpl(url,{cache:'force-cache',credentials:'same-origin',signal:controller.signal});
    if(!response.ok)throw new Error(`Berlin runtime asset unavailable (${response.status})`);
    const raw=await response.json();
    if(controller.signal.aborted)throw controller.signal.reason;
    return decodeBerlinRuntime(raw);
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}

export function queryVisibleStreets(asset,bounds,bandOrZoom,out=[]){
  out.length=0;
  if(!asset?.geometry?.length||!validBounds(bounds))return out;
  const band=typeof bandOrZoom==='string'?bandOrZoom:mapZoomBand(bandOrZoom);
  const allowed=asset.lod[band]??asset.lod.detail,size=asset.cellSize;
  const ix1=Math.floor(bounds.x1/size),iy1=Math.floor(bounds.y1/size),ix2=Math.floor(bounds.x2/size),iy2=Math.floor(bounds.y2/size);
  // Very large views and extremely fine bins must never create unbounded loops.
  const cells=(ix2-ix1+1)*(iy2-iy1+1);
  if(![ix1,iy1,ix2,iy2].every(Number.isSafeInteger)||!Number.isFinite(cells)||cells>Math.max(1,asset.grid.size)*2){
    for(const road of asset.geometry)if(allowed.has(road.index)&&intersects(road.bounds,bounds))out.push(road);
    return out;
  }
  let token=(asset.queryToken+1)>>>0;
  if(token===0){asset.querySeen.fill(0);token=1;}
  asset.queryToken=token;
  for(let y=iy1;y<=iy2;y++)for(let x=ix1;x<=ix2;x++){
    const ids=asset.grid.get(`${x}:${y}`);if(!ids)continue;
    for(const id of ids){
      if(asset.querySeen[id]===token||!allowed.has(id))continue;
      asset.querySeen[id]=token;
      const road=asset.geometry[id];if(intersects(road.bounds,bounds))out.push(road);
    }
  }
  return out;
}

export function runtimeStreetName(asset,road){return asset?.names?.[road?.nameId]??'';}
export function runtimeMapReady(asset){return Boolean(asset?.metadata?.runtimeNetworkRequired===false&&asset?.geometry?.length);}
