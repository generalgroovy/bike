#!/usr/bin/env node
// Complete official Berlin datasets. Pages are cached for explicit, resumable
// offline builds; the browser never calls WFS. Use a new folder to refresh.
import { mkdir, readFile, writeFile, open, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const folder = resolve(process.argv[2] ?? '../berlin-city-source');
const requested = process.argv.slice(3);
const datasets = [
  ['boundary','alkis_land','landesgrenze'],
  ['regions','alkis_ortsteile','ortsteile'], ['boroughs','alkis_bezirke','bezirksgrenzen'],
  ['streets','detailnetz','c_strassenabschnitte'], ['addresses','adressen_berlin','adressen_berlin'],
  ['parks','gruenanlagen','gruenanlagen'], ['landcover','lc_alkis','LandCoverUnit']
];
await mkdir(folder,{recursive:true});
async function sha(path) {const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');}
for (const [name,service,type] of datasets.filter(([name])=>!requested.length||requested.includes(name))) {
  const target=join(folder,`${name}.geojson`),metadataPath=join(folder,`${name}.source.json`);
  try {const existing=JSON.parse(await readFile(metadataPath,'utf8'));if(await sha(target)===existing.sha256){console.log(`${name}: verified cached ${existing.features}`);continue;}}catch{}
  const endpoint=`https://gdi.berlin.de/services/wfs/${service}`,pages=join(folder,`${name}-pages`);
  await mkdir(pages,{recursive:true});
  const output=await open(target+'.partial','w'),ids=new Set(),urls=[];let start=0,matched;
  await output.write('{"type":"FeatureCollection","features":[');
  try {
    do {
      const url=new URL(endpoint);
      for(const [key,value] of Object.entries({service:'WFS',request:'GetFeature',version:'2.0.0',typeNames:`${service}:${type}`,outputFormat:'application/json',srsName:'EPSG:4326',count:5000,startIndex:start}))url.searchParams.set(key,String(value));
      const cached=join(pages,`${start}.json`);let page;
      try {page=JSON.parse(await readFile(cached,'utf8'));}catch {
        for(let attempt=0;attempt<3;attempt++) {
          try {const response=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error(`${response.status}`);page=await response.json();break;}
          catch(error){console.log(`${name} page ${start} attempt ${attempt+1}: ${error.message}`);if(attempt===2)throw error;}
        }
        await writeFile(cached,JSON.stringify(page));
      }
      const count=Number(page.numberMatched??page.totalFeatures);
      if(!Number.isFinite(count)||matched!==undefined&&matched!==count)throw new Error(`${name}: source count changed; refresh into a new folder`);
      matched=count;
      if(!Array.isArray(page.features)||!page.features.length&&start<matched)throw new Error(`${name}: incomplete page`);
      for(const feature of page.features) {
        if(!feature.id||ids.has(feature.id))throw new Error(`${name}: duplicate/missing ID`);
        await output.write(`${ids.size?',':''}${JSON.stringify(feature)}`);ids.add(feature.id);
      }
      start+=page.features.length;urls.push(url.href);console.log(`${name}: ${start}/${matched}`);
    }while(start<matched);
    await output.write(']}\n');
  }finally{await output.close();}
  await rename(target+'.partial',target);
  await writeFile(metadataPath,JSON.stringify({name,endpoint,type:`${service}:${type}`,scope:'complete service',fetchedAt:new Date().toISOString(),features:ids.size,sha256:await sha(target),urls,license:'dl-de-zero-2.0'},null,2)+'\n');
}
