#!/usr/bin/env node
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { dirname,resolve } from 'node:path';
import { BERLIN_WFS,INNER_RING_BBOX,OFFICIAL_ADDRESS_SCHEMA,capabilitiesUrl,featureTypeNames,chooseFeatureType,getFeatureUrl,normalizeStreetFeature,normalizeAddressFeature,stableSortImported,validateOfficialAddressProperties } from './berlin-import-lib.mjs';

const args=new Map();for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg.startsWith('--')){const[key,value]=arg.slice(2).split('=');args.set(key,value??process.argv[++i]??'true');}}
const output=resolve(args.get('output')??'generated/berlin-official.json');
let bbox=(args.get('bbox')??INNER_RING_BBOX.join(',')).split(',').map(Number);if(bbox.length!==4||bbox.some(Number.isNaN))throw new Error('Expected --bbox=minLon,minLat,maxLon,maxLat');

function extractPolygon(value){if(Array.isArray(value)&&Array.isArray(value[0]))return value;if(value?.type==='Feature')return extractPolygon(value.geometry);if(value?.type==='Polygon')return value.coordinates?.[0]??null;if(value?.type==='MultiPolygon')return value.coordinates?.[0]?.[0]??null;return null;}
function polygonBounds(polygon){const xs=polygon.map(p=>p[0]),ys=polygon.map(p=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}
async function loadPolygon(path){if(!path)return null;const parsed=JSON.parse(await readFile(resolve(path),'utf8')),polygon=extractPolygon(parsed);if(!polygon||polygon.length<3)throw new Error(`No Polygon geometry found in ${path}`);return polygon;}
async function text(url){const response=await fetch(url,{headers:{accept:'application/xml,text/xml,*/*'}});if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);return response.text();}
async function json(url){const response=await fetch(url,{headers:{accept:'application/geo+json,application/json'}});if(!response.ok)throw new Error(`${response.status} ${response.statusText}: ${url}`);return response.json();}
async function resolveType(endpoint,hints,explicit){if(explicit)return explicit;const xml=await text(capabilitiesUrl(endpoint)),names=featureTypeNames(xml),selected=chooseFeatureType(names,hints);if(!selected)throw new Error(`No WFS feature type found at ${endpoint}. Available: ${names.join(', ')}`);return selected;}

const polygon=await loadPolygon(args.get('ring-polygon'));if(polygon&&!args.has('bbox'))bbox=polygonBounds(polygon);
const streetType=await resolveType(BERLIN_WFS.streets,['strassenabschnitt','netz','link','strasse'],args.get('street-type'));
const addressType=await resolveType(BERLIN_WFS.addresses,['adresse','address','hauskoord'],args.get('address-type'));
console.log(`Street type: ${streetType}`);console.log(`Address type: ${addressType}`);if(polygon)console.log(`Polygon clip: ${polygon.length} vertices`);
const streetGeo=await json(getFeatureUrl(BERLIN_WFS.streets,streetType,{bbox,count:Number(args.get('street-count')??50000)}));
const addressGeo=await json(getFeatureUrl(BERLIN_WFS.addresses,addressType,{bbox,count:Number(args.get('address-count')??100000)}));
const sampleAddress=(addressGeo.features??[]).find(feature=>feature?.properties)?.properties??null;
if(sampleAddress){const validation=validateOfficialAddressProperties(sampleAddress);if(!validation.valid){const message=`Official address schema mismatch: missing ${validation.missing.join(', ')}`;if(args.get('allow-address-aliases')==='true')console.warn(`WARN ${message}`);else throw new Error(`${message}. Pass --allow-address-aliases=true only for a reviewed alternate export.`);}}
const streets=(streetGeo.features??[]).map(feature=>normalizeStreetFeature(feature,{bbox,polygon})).filter(Boolean),addresses=(addressGeo.features??[]).map(feature=>normalizeAddressFeature(feature,{bbox,polygon})).filter(Boolean);
const result=stableSortImported({metadata:{generatedAt:new Date().toISOString(),bbox,polygonVertices:polygon?.length??0,streetEndpoint:BERLIN_WFS.streets,addressEndpoint:BERLIN_WFS.addresses,streetType,addressType,addressSchema:OFFICIAL_ADDRESS_SCHEMA,license:'Datenlizenz Deutschland – Zero – Version 2.0',runtimeNetworkRequired:false},streets,addresses});
await mkdir(dirname(output),{recursive:true});await writeFile(output,`${JSON.stringify(result,null,2)}\n`,'utf8');console.log(`Wrote ${streets.length} street features and ${addresses.length} addresses to ${output}`);
