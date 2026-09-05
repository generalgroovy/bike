import { mapZoomBand } from './map-zoom.js';

export const BERLIN_RUNTIME_URL='./generated/berlin-runtime-v2.json';
const LABEL_PRIORITY=Object.freeze({arterial:0,bridge:0,primary:1,secondary:2,local:3});

function decodeLine(packed,q){
  const points=new Float32Array(packed.length);
  for(let i=0;i<packed.length;i++)points[i]=packed[i]/q;
  return points;
}

export function decodeBerlinRuntime(raw){
  if(!raw||raw.version!==2||!Array.isArray(raw.geometry)||!Array.isArray(raw.names))throw new Error('Unsupported Berlin runtime asset');
  const q=Number(raw.q)||10;
  const geometry=raw.geometry.map((item,index)=>({
    index,
    nameId:item[0],
    roadClass:raw.classes?.[item[1]]??'secondary',
    points:decodeLine(item[2],q),
    bounds:{x1:item[3][0]/q,y1:item[3][1]/q,x2:item[3][2]/q,y2:item[3][3]/q},
    length:item[4]/q
  }));
  const lod={};
  for(const band of ['overview','district','street','detail'])lod[band]=new Set(raw.lod?.[band]??[]);
  const labels=(raw.labels??[])
    .map(item=>({nameId:item[0],roadClass:raw.classes?.[item[1]]??'secondary',x:item[2]/q,y:item[3]/q,angle:item[4]/10000,length:item[5]/q}))
    .sort((a,b)=>(LABEL_PRIORITY[a.roadClass]??9)-(LABEL_PRIORITY[b.roadClass]??9)||b.length-a.length||a.nameId-b.nameId);
  const grid=new Map(Object.entries(raw.grid?.cells??{}).map(([key,value])=>[key,Uint32Array.from(value)]));
  const asset={
    version:2,
    metadata:raw.metadata??{},
    projection:raw.projection??null,
    classes:raw.classes??[],
    names:raw.names,
    geometry,lod,labels,grid,
    cellSize:Number(raw.grid?.cellSize)||128,
    addresses:raw.addresses??[],
    querySeen:new Uint32Array(geometry.length),
    queryToken:0
  };
  return asset;
}

export async function loadBerlinRuntime(url=BERLIN_RUNTIME_URL){
  const response=await fetch(url,{cache:'force-cache',credentials:'same-origin'});
  if(!response.ok)throw new Error(`Berlin runtime asset unavailable (${response.status})`);
  return decodeBerlinRuntime(await response.json());
}

export function queryVisibleStreets(asset,bounds,bandOrZoom,out=[]){
  out.length=0;
  if(!asset?.geometry?.length||!bounds)return out;
  const band=typeof bandOrZoom==='string'?bandOrZoom:mapZoomBand(bandOrZoom);
  const allowed=asset.lod[band]??asset.lod.detail;
  const size=asset.cellSize,ix1=Math.floor(bounds.x1/size),iy1=Math.floor(bounds.y1/size),ix2=Math.floor(bounds.x2/size),iy2=Math.floor(bounds.y2/size);
  let token=(asset.queryToken+1)>>>0;
  if(token===0){asset.querySeen.fill(0);token=1;}
  asset.queryToken=token;
  for(let y=iy1;y<=iy2;y++)for(let x=ix1;x<=ix2;x++){
    const ids=asset.grid.get(`${x}:${y}`);if(!ids)continue;
    for(const id of ids){
      if(asset.querySeen[id]===token||!allowed.has(id))continue;
      asset.querySeen[id]=token;
      const road=asset.geometry[id],b=road.bounds;
      if(b.x2<bounds.x1||b.x1>bounds.x2||b.y2<bounds.y1||b.y1>bounds.y2)continue;
      out.push(road);
    }
  }
  return out;
}

export function runtimeStreetName(asset,road){return asset?.names?.[road?.nameId]??'';}
export function runtimeMapReady(asset){return Boolean(asset?.metadata?.runtimeNetworkRequired===false&&asset?.geometry?.length);}
