#!/usr/bin/env node
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { RINGBAHN_RELATIONS,relationFullJsonUrl,ringPolygonFromRelation,validateRingPolygon } from './ringbahn-import-lib.mjs';

const args=new Map();for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg.startsWith('--')){const[key,value]=arg.slice(2).split('=');args.set(key,value??process.argv[++i]??'true');}}
const ref=String(args.get('ref')??'S41').toUpperCase(),relationId=Number(args.get('relation')??RINGBAHN_RELATIONS[ref]??RINGBAHN_RELATIONS.S41),output=resolve(args.get('output')??'generated/ringbahn-boundary.geojson');
if(!Number.isInteger(relationId)||relationId<=0)throw new Error('Expected a positive --relation=<OSM relation id>');
const url=relationFullJsonUrl(relationId),response=await fetch(url,{headers:{accept:'application/json','user-agent':'Send-It-Berlin-Importer/0.5 (+https://github.com/generalgroovy/bike)'}});if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);const osm=await response.json(),feature=ringPolygonFromRelation(osm,relationId),validation=validateRingPolygon(feature);if(!validation.valid)throw new Error(`Ringbahn polygon failed validation: ${validation.errors.join('; ')}`);
feature.properties.generatedAt=new Date().toISOString();feature.properties.sourceUrl=url;feature.properties.runtimeNetworkRequired=false;await mkdir(dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(feature,null,2)}\n`,'utf8');console.log(`Wrote ${feature.geometry.coordinates[0].length} Ringbahn vertices from relation ${relationId} to ${output}`);
