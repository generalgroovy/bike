#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { BERLIN } from '../src/berlin.js';
import { compareBerlinGraphs,summarizeBerlinComparison } from './berlin-compare-lib.mjs';

const args=new Map();for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg.startsWith('--')){const[key,value]=arg.slice(2).split('=');args.set(key,value??process.argv[++i]??'true');}}
const input=resolve(args.get('input')??'generated/berlin-candidate-graph.json'),candidate=JSON.parse(await readFile(input,'utf8'));
const report=compareBerlinGraphs(BERLIN,candidate,{maxRouteScaleRatio:Number(args.get('max-route-scale-ratio')??1.75),minStreetOverlap:Number(args.get('min-street-overlap')??.35),minCandidateLargestShare:Number(args.get('min-largest-share')??.9),minAddressMatch:Number(args.get('min-address-match')??.8),maxFallbackShare:Number(args.get('max-fallback-share')??.08)});
console.log(summarizeBerlinComparison(report));
for(const error of report.errors)console.error(`- ${error}`);
if(!report.valid&&args.get('allow-fail')!=='true')process.exitCode=1;
