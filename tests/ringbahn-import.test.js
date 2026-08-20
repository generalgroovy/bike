import test from 'node:test';
import assert from 'node:assert/strict';
import { RINGBAHN_RELATIONS,relationFullJsonUrl,indexOsmElements,stitchRelationWays,ringPolygonFromRelation,polygonArea,validateRingPolygon } from '../tools/ringbahn-import-lib.mjs';

function fixture(){return{elements:[
  {type:'node',id:1,lon:13.30,lat:52.48},{type:'node',id:2,lon:13.42,lat:52.48},{type:'node',id:3,lon:13.42,lat:52.56},{type:'node',id:4,lon:13.30,lat:52.56},
  {type:'way',id:12,nodes:[1,2]},{type:'way',id:23,nodes:[3,2]},{type:'way',id:34,nodes:[3,4]},{type:'way',id:41,nodes:[1,4]},
  {type:'relation',id:14981,tags:{type:'route',route:'train',ref:'S41',name:'Ringbahn S41'},members:[{type:'node',ref:1,role:'stop'},{type:'way',ref:23,role:''},{type:'way',ref:12,role:''},{type:'way',ref:41,role:''},{type:'way',ref:34,role:''}]}
]};}

test('Ringbahn source relations are pinned to documented OSM S41/S42 ids',()=>{
  assert.deepEqual(RINGBAHN_RELATIONS,{S41:14981,S42:14983});
  assert.equal(relationFullJsonUrl(14981),'https://api.openstreetmap.org/api/0.6/relation/14981/full.json');
});

test('OSM element index separates nodes ways and relations',()=>{
  const index=indexOsmElements(fixture());assert.equal(index.nodes.size,4);assert.equal(index.ways.size,4);assert.equal(index.relations.size,1);
});

test('relation way stitcher reconstructs a closed primary chain despite reversed/disordered members',()=>{
  const result=stitchRelationWays(fixture(),14981);assert.equal(result.relation.tags.ref,'S41');assert.equal(result.chains.length,1);assert.equal(result.primary.length,5);assert.deepEqual(result.primary[0],result.primary.at(-1));
});

test('Ringbahn relation converts to validated polygon with ODbL source metadata',()=>{
  const feature=ringPolygonFromRelation(fixture(),14981),ring=feature.geometry.coordinates[0];assert.equal(feature.geometry.type,'Polygon');assert.equal(feature.properties.relationId,14981);assert.equal(feature.properties.ref,'S41');assert.equal(feature.properties.license,'ODbL 1.0');assert.ok(polygonArea(ring)>.009);
  assert.deepEqual(validateRingPolygon(feature,{minVertices:5,minArea:.009}),{valid:true,errors:[]});
});

test('Ringbahn polygon validation rejects open or implausibly tiny geometry',()=>{
  const bad={type:'Feature',geometry:{type:'Polygon',coordinates:[[[13.3,52.5],[13.31,52.5],[13.31,52.501],[13.3,52.501]]]}};const validation=validateRingPolygon(bad,{minVertices:5,minArea:.002});assert.equal(validation.valid,false);assert.ok(validation.errors.some(error=>error.includes('vertices')));assert.ok(validation.errors.some(error=>error.includes('closed')));assert.ok(validation.errors.some(error=>error.includes('area')));
});
