import { BERLIN_PROJECTION_ID,projectionMetadata } from '../src/berlin-projection.js';

const CLASSES=Object.freeze(['arterial','primary','secondary','local','bridge']);
const MAJOR=new Set([
  'straße des 17. juni','kurfürstendamm','bismarckstraße','kaiserdamm','seestraße','müllerstraße','schönhauser allee','prenzlauer allee','danziger straße','landsberger allee','karl-marx-allee','frankfurter allee','warschauer straße','skalitzer straße','kottbusser damm','mehringdamm','potsdamer straße','hauptstraße','bundesallee','tempelhofer damm','hermannstraße','karl-marx-straße','sonnenallee','invalidenstraße','leipziger straße','friedrichstraße','unter den linden','alt-moabit','torstraße'
]);
const PRIMARY_HINTS=['hauptverkehr','übergeordnet','bundesstraße','landesstraße','straße i','strasse i','stufe i','stufe 1','stufe ii','stufe 2'];
const SECONDARY_HINTS=['ergänzungsstraße','ergänzungsstrasse','stufe iii','stufe 3','sammelstraße','sammelstrasse'];

const norm=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\bstrasse\b/g,'straße').replace(/[.·]/g,' ').replace(/\s+/g,' ').trim();
const lineLength=line=>{let total=0;for(let i=1;i<line.length;i++)total+=Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]);return total;};

export function classifyRuntimeStreet(street,line){
  const name=norm(street?.name),meta=norm([street?.roadDesignation,street?.stepClass,street?.okstraClass,street?.rbsClass].filter(Boolean).join(' ')),length=lineLength(line??[]);
  if(name.includes('brücke')||name.includes('bruecke'))return'bridge';
  if(MAJOR.has(name)||PRIMARY_HINTS.some(token=>meta.includes(token))||length>=150)return'arterial';
  if(SECONDARY_HINTS.some(token=>meta.includes(token))||length>=80)return'primary';
  if(length>=30)return'secondary';
  return'local';
}

function quantizeLine(line,factor){const out=[];for(const point of line){out.push(Math.round(point[0]*factor),Math.round(point[1]*factor));}return out;}
function lineBounds(line){const xs=line.map(p=>p[0]),ys=line.map(p=>p[1]);return{x1:Math.min(...xs),y1:Math.min(...ys),x2:Math.max(...xs),y2:Math.max(...ys)};}
function representativeSegment(line){let best=null;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(!best||len>best.len)best={a,b,len};}return best;}
function lodIncludes(roadClass,band){if(band==='overview')return roadClass==='arterial'||roadClass==='bridge';if(band==='district')return roadClass!=='secondary'&&roadClass!=='local';if(band==='street')return roadClass!=='local';return true;}

export function buildBerlinRuntime(imported,{quantization=10,cellSize=128,addressStep=1}={}){
  if(!Number.isFinite(quantization)||quantization<=0)throw new Error('quantization must be positive');
  if(!Number.isFinite(cellSize)||cellSize<=0)throw new Error('cellSize must be positive');
  if(!Number.isInteger(addressStep)||addressStep<1)throw new Error('addressStep must be a positive integer');
  const names=[],nameIndex=new Map(),geometry=[],labelsByName=new Map();
  const nameId=name=>{const key=String(name??'Unnamed');if(nameIndex.has(key))return nameIndex.get(key);const id=names.length;names.push(key);nameIndex.set(key,id);return id;};
  for(const street of imported?.streets??[]){for(const line of street.lines??[]){if(!Array.isArray(line)||line.length<2)continue;const ni=nameId(street.name),roadClass=classifyRuntimeStreet(street,line),ci=CLASSES.indexOf(roadClass),bounds=lineBounds(line),length=lineLength(line),index=geometry.length;geometry.push([ni,ci,quantizeLine(line,quantization),[bounds.x1,bounds.y1,bounds.x2,bounds.y2].map(v=>Math.round(v*quantization)),Math.round(length*quantization)]);const segment=representativeSegment(line),known=labelsByName.get(ni);if(segment&&(!known||segment.len>known.len))labelsByName.set(ni,{ni,ci,a:segment.a,b:segment.b,len:segment.len,index});}}
  const lod={overview:[],district:[],street:[],detail:[]};for(let i=0;i<geometry.length;i++){const roadClass=CLASSES[geometry[i][1]];for(const band of Object.keys(lod))if(lodIncludes(roadClass,band))lod[band].push(i);}
  const labels=[...labelsByName.values()].sort((a,b)=>a.ni-b.ni).map(item=>{const x=(item.a[0]+item.b[0])/2,y=(item.a[1]+item.b[1])/2,angle=Math.atan2(item.b[1]-item.a[1],item.b[0]-item.a[0]);return[item.ni,item.ci,Math.round(x*quantization),Math.round(y*quantization),Math.round(angle*10000),Math.round(item.len*quantization)];});
  const cells={};for(let i=0;i<geometry.length;i++){const b=geometry[i][3].map(v=>v/quantization),cx1=Math.floor(b[0]/cellSize),cy1=Math.floor(b[1]/cellSize),cx2=Math.floor(b[2]/cellSize),cy2=Math.floor(b[3]/cellSize);for(let cy=cy1;cy<=cy2;cy++)for(let cx=cx1;cx<=cx2;cx++){const key=`${cx}:${cy}`;(cells[key]??=[]).push(i);}}
  const addresses=[];for(let i=0;i<(imported?.addresses?.length??0);i+=addressStep){const address=imported.addresses[i],ni=nameId(address.street);addresses.push([ni,String(address.houseNumber??''),String(address.postcode??''),Math.round(address.x*quantization),Math.round(address.y*quantization)]);}
  const metadata={
    version:2,
    generatedAt:imported?.metadata?.generatedAt??null,
    source:'Berlin Open Data · Detailnetz Berlin + Adressen Berlin',
    license:imported?.metadata?.license??'Datenlizenz Deutschland – Zero – Version 2.0',
    runtimeNetworkRequired:false,
    projection:BERLIN_PROJECTION_ID,
    sourceStreetFeatures:imported?.streets?.length??0,
    sourceAddresses:imported?.addresses?.length??0,
    runtimeStreetPolylines:geometry.length,
    runtimeAddresses:addresses.length,
    addressStep,
    quantization,
    cellSize
  };
  return{version:2,metadata,projection:projectionMetadata(),q:quantization,classes:[...CLASSES],names,geometry,lod,labels,grid:{cellSize,cells},addresses};
}

export function runtimeAssetStats(asset){return{streetNames:asset?.names?.length??0,polylines:asset?.geometry?.length??0,labels:asset?.labels?.length??0,addresses:asset?.addresses?.length??0,cells:Object.keys(asset?.grid?.cells??{}).length};}
