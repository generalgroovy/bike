#!/usr/bin/env node
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { buildBerlinCandidate } from './berlin-graph-lib.mjs';

const args=new Map();for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg.startsWith('--')){const[key,value]=arg.slice(2).split('=');args.set(key,value??process.argv[++i]??'true');}}
const input=resolve(args.get('input')??'generated/berlin-official.json'),output=resolve(args.get('output')??'generated/berlin-candidate-graph.json'),raw=JSON.parse(await readFile(input,'utf8'));
const options={snapTolerance:Number(args.get('snap-tolerance')??1.5),maxDistance:Number(args.get('address-snap')??28),maxComponents:Number(args.get('max-components')??12),minLargestShare:Number(args.get('min-largest-share')??.9),minAddressMatch:Number(args.get('min-address-match')??.8),maxFallbackShare:Number(args.get('max-fallback-share')??.08)};
for(const[key,value]of Object.entries(options))if(!Number.isFinite(value))throw new Error(`Invalid numeric option ${key}`);
const candidate=buildBerlinCandidate(raw,options),quality=candidate.metadata.quality;
console.log(`Candidate: ${quality.nodeCount} nodes · ${quality.edgeCount} edges · ${quality.addressNodes}/${raw.addresses?.length??0} addresses · ${quality.components} components`);
console.log(`Largest component ${(quality.largestShare*100).toFixed(1)}% · address match ${(quality.addressMatch*100).toFixed(1)}% · geometric fallback ${(quality.fallbackShare*100).toFixed(1)}%`);
console.log(`Address identity: ${quality.matchCounts.number} street-number · ${quality.matchCounts.name} name · ${quality.matchCounts.fallback} fallback`);
if(!quality.valid&&args.get('allow-fragmented')!=='true')throw new Error(`Candidate quality gate failed: ${quality.errors.join('; ')}`);
candidate.metadata.generatedAt=new Date().toISOString();candidate.metadata.generator='tools/build-berlin-candidate.mjs';await mkdir(dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(candidate,null,2)}\n`,'utf8');console.log(`Wrote ${output}`);