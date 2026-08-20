import test from 'node:test';
import assert from 'node:assert/strict';
import { compareBerlinGraphs,summarizeBerlinComparison } from '../tools/berlin-compare-lib.mjs';

function grid(names=['Alpha Straße','Beta Straße','Gamma Straße']){
  const nodes=[],edges=[];let id=0;for(let y=0;y<3;y++)for(let x=0;x<3;x++)nodes.push({id:id++,x:200+x*500,y:160+y*350,kind:'street'});
  let e=0;for(let y=0;y<3;y++)for(let x=1;x<3;x++)edges.push({id:`h${e++}`,a:y*3+x-1,b:y*3+x,streetName:names[y%names.length],distance:500});
  for(let x=0;x<3;x++)for(let y=1;y<3;y++)edges.push({id:`v${e++}`,a:(y-1)*3+x,b:y*3+x,streetName:names[(x+1)%names.length],distance:350});
  return{width:1600,height:1120,nodes,edges};
}
function candidate(overrides={}){return{...grid(),metadata:{quality:{largestShare:1,addressMatch:.96,fallbackShare:.02,components:1,...overrides}}};}

test('shadow comparison passes a connected identity-rich candidate with comparable route scale',()=>{const runtime=grid(),report=compareBerlinGraphs(runtime,candidate(),{minStreetOverlap:.8,maxRouteScaleRatio:1.1});assert.equal(report.valid,true,report.errors.join('; '));assert.equal(report.streetOverlap.score,1);assert.equal(report.routeScale.ratio,1);assert.equal(report.candidateQuality.fallbackShare,.02);assert.match(summarizeBerlinComparison(report),/shadow candidate PASS/);});

test('shadow comparison rejects high geometric fallback even when connectivity is perfect',()=>{const report=compareBerlinGraphs(grid(),candidate({fallbackShare:.3}),{minStreetOverlap:.8,maxRouteScaleRatio:1.2,maxFallbackShare:.08});assert.equal(report.valid,false);assert.ok(report.errors.some(error=>error.includes('fallback share')));});

test('shadow comparison rejects a candidate that loses recognizable street vocabulary',()=>{const report=compareBerlinGraphs(grid(),{...candidate(),edges:grid(['Unknown One','Unknown Two','Unknown Three']).edges},{minStreetOverlap:.5,maxRouteScaleRatio:1.2});assert.equal(report.valid,false);assert.ok(report.errors.some(error=>error.includes('street overlap')));});

test('shadow comparison catches route-scale distortion independently of name overlap',()=>{const distorted=grid();distorted.edges=distorted.edges.map(edge=>({...edge,distance:edge.distance*4}));distorted.metadata={quality:{largestShare:1,addressMatch:.97,fallbackShare:0,components:1}};const report=compareBerlinGraphs(grid(),distorted,{minStreetOverlap:.8,maxRouteScaleRatio:1.75});assert.equal(report.valid,false);assert.ok(report.routeScale.ratio>3.9);assert.ok(report.errors.some(error=>error.includes('route scale ratio')));});
