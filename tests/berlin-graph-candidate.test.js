import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStreetSkeleton,nearestStreetEdge,attachAddresses,connectedComponents,graphQuality,buildBerlinCandidate } from '../tools/berlin-graph-lib.mjs';

function importedFixture(){return{metadata:{source:'fixture'},streets:[
  {name:'Alpha Straße',sourceId:'a',lines:[[[0,0],[50,0],[100,0]]]},
  {name:'Beta Straße',sourceId:'b',lines:[[[50,-50],[50,0],[50,50]]]},
  {name:'Gamma Straße',sourceId:'c',lines:[[[100,0],[140,0],[180,0]]]}
],addresses:[
  {street:'Alpha Straße',houseNumber:'10',postcode:'10000',x:20,y:2,sourceId:'p1'},
  {street:'Alpha Straße',houseNumber:'22',postcode:'10000',x:72,y:-3,sourceId:'p2'},
  {street:'Beta Straße',houseNumber:'5',postcode:'10000',x:52,y:35,sourceId:'p3'},
  {street:'Gamma Straße',houseNumber:'8',postcode:'10000',x:145,y:1,sourceId:'p4'}
]};}

test('street skeleton snaps shared Detailnetz-style intersection vertices into one connected node',()=>{
  const graph=buildStreetSkeleton(importedFixture().streets,{snapTolerance:1});assert.ok(graph.nodes.length>=6);assert.ok(graph.edges.length>=6);const center=graph.nodes.filter(n=>Math.hypot(n.x-50,n.y)<.01);assert.equal(center.length,1);assert.equal(connectedComponents(graph).length,1);
});

test('nearest address attachment prefers the same named street',()=>{
  const skeleton=buildStreetSkeleton(importedFixture().streets,{snapTolerance:1}),address={street:'Alpha Straße',houseNumber:'99',x:50,y:8};const match=nearestStreetEdge(address,skeleton.nodes,skeleton.edges,{sameStreetOnly:true,maxDistance:20});assert.ok(match);assert.equal(match.edge.streetName,'Alpha Straße');assert.ok(match.distance<9);
});

test('address attachment inserts service nodes while preserving connected street routing',()=>{
  const imported=importedFixture(),skeleton=buildStreetSkeleton(imported.streets,{snapTolerance:1}),graph=attachAddresses(skeleton,imported.addresses,{maxDistance:8});assert.equal(graph.unmatched.length,0);assert.equal(graph.matchedCount,4);const addressNodes=graph.nodes.filter(n=>n.kind==='address');assert.equal(addressNodes.length,4);assert.ok(addressNodes.every(n=>Number.isInteger(n.anchorId)));assert.equal(connectedComponents(graph).length,1);assert.ok(graph.edges.some(e=>e.kind==='address-link'));
});

test('candidate graph quality reports fragmentation and address coverage rather than hiding it',()=>{
  const imported=importedFixture(),candidate=buildBerlinCandidate(imported,{snapTolerance:1,maxDistance:8,maxComponents:2,minLargestShare:.8,minAddressMatch:.9});assert.equal(candidate.metadata.candidate,true);assert.equal(candidate.metadata.matchedAddresses,4);assert.equal(candidate.metadata.unmatchedAddresses,0);assert.equal(candidate.metadata.quality.valid,true);assert.ok(candidate.metadata.quality.largestShare>.9);
  const fragmented={nodes:[{id:0},{id:1},{id:2}],edges:[{a:0,b:1}]},quality=graphQuality(fragmented,{maxComponents:1,minLargestShare:.9,minAddressMatch:0});assert.equal(quality.valid,false);assert.ok(quality.errors.some(error=>error.includes('components')));
});

test('far unmatched addresses remain explicit for importer diagnostics',()=>{
  const imported=importedFixture();imported.addresses.push({street:'Missing Straße',houseNumber:'1',x:500,y:500,sourceId:'far'});const candidate=buildBerlinCandidate(imported,{snapTolerance:1,maxDistance:8,minAddressMatch:.7});assert.equal(candidate.metadata.matchedAddresses,4);assert.equal(candidate.metadata.unmatchedAddresses,1);assert.equal(candidate.unmatchedAddresses[0].sourceId,'far');assert.ok(candidate.metadata.quality.addressMatch>.79&&candidate.metadata.quality.addressMatch<.81);
});
