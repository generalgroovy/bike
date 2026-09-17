#!/usr/bin/env node
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { buildBerlinRuntime,runtimeAssetStats } from './berlin-runtime-lib.mjs';

const args=new Map();
for(let i=2;i<process.argv.length;i++){
  const arg=process.argv[i];
  if(!arg.startsWith('--'))continue;
  const[key,value]=arg.slice(2).split('=');
  args.set(key,value??process.argv[++i]??'true');
}

const input=resolve(args.get('input')??'generated/berlin-official.json');
const output=resolve(args.get('output')??'generated/berlin-runtime-v2.json');
const options={
  quantization:Number(args.get('quantization')??10),
  cellSize:Number(args.get('cell-size')??128),
  addressStep:Number(args.get('address-step')??1)
};
const raw=JSON.parse(await readFile(input,'utf8'));
const runtime=buildBerlinRuntime(raw,options);
const text=`${JSON.stringify(runtime)}\n`;
const gzip=gzipSync(text,{level:9});
const stats=runtimeAssetStats(runtime);
runtime.metadata.bytes=Buffer.byteLength(text);
runtime.metadata.gzipBytes=gzip.byteLength;
const finalText=`${JSON.stringify(runtime)}\n`;

await mkdir(dirname(output),{recursive:true});
await writeFile(output,finalText,'utf8');

const mib=value=>(value/1024/1024).toFixed(2);
console.log(`Runtime Berlin: ${stats.polylines} polylines · ${stats.streetNames} names · ${stats.labels} label anchors · ${stats.addresses} addresses · ${stats.cells} spatial cells`);
console.log(`Asset: ${mib(Buffer.byteLength(finalText))} MiB raw · ${mib(gzipSync(finalText,{level:9}).byteLength)} MiB gzip`);
if(gzip.byteLength>2*1024*1024)console.warn('WARN: runtime asset is above the ~2 MiB compressed target; preserve topology correctness and tune LOD/packing before dropping source detail.');
console.log(`Wrote ${output}`);
