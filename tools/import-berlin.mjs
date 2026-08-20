#!/usr/bin/env node
import { mkdir,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { BERLIN_WFS,INNER_RING_BBOX,capabilitiesUrl,featureTypeNames,chooseFeatureType,getFeatureUrl,normalizeStreetFeature,normalizeAddressFeature,stableSortImported } from './berlin-import-lib.mjs';

const args=new Map();for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg.startsWith('--')){const[key,value]=arg.slice(2).split('=');args.set(key,value??process.argv[++i]??'true');}}
const output=resolve(args.get('output')??'generated/berlin-official.json'),bbox=(args.get('bbox')??INNER_RING_BBOX.join(',')).split(',').map(Number);if(bbox.length!==4||bbox.some(Number.isNaN))throw new Error('Expected --bbox=minLon,minLat,maxLon,maxLat');

async function text(url){const response=await fetch(url,{headers:{accept:'application/xml,text/xml,*/*'}});if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);return response.text();}
async function json(url){const response=await fetch(url,{headers:{accept:'application/geo+json,application/json'}});if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);return response.json();}
async function resolveType(endpoint,hints,explicit){if(explicit)return explicit;const xml=await text(capabilitiesUrl(endpoint)),names=featureTypeNames(xml),selected=chooseFeatureType(names,hints);if(!selected)throw new Error(`No WFS feature type found at ${endpoint}. Available: ${names.join(', ')}`);return selected;}

const streetType=await resolveType(BERLIN_WFS.streets,['strassenabschnitt','netz','link','strasse'],args.get('street-type'));
const addressType=await resolveType(BERLIN_WFS.addresses,['adresse','address','hauskoord'],args.get('address-type'));
console.log(`Street type: ${streetType}`);console.log(`Address type: ${addressType}`);
const streetGeo=await json(getFeatureUrl(BERLIN_WFS.streets,streetType,{bbox,count:Number(args.get('street-count')??50000)}));
const addressGeo=await json(getFeatureUrl(BERLIN_WFS.addresses,addressType,{bbox,count:Number(args.get('address-count')??100000)}));
const streets=(streetGeo.features??[]).map(feature=>normalizeStreetFeature(feature,{bbox})).filter(Boolean),addresses=(addressGeo.features??[]).map(feature=>normalizeAddressFeature(feature,{bbox})).filter(Boolean);
const result=stableSortImported({metadata:{generatedAt:new Date().toISOString(),bbox,streetEndpoint:BERLIN_WFS.streets,addressEndpoint:BERLIN_WFS.addresses,streetType,addressType,license:'Datenlizenz Deutschland – Zero – Version 2.0',runtimeNetworkRequired:false},streets,addresses});
await mkdir(dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(result,null,2)}\n`,'utf8');console.log(`Wrote ${streets.length} street features and ${addresses.length} addresses to ${output}`);
