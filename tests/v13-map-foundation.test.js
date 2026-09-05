import test from 'node:test';
import assert from 'node:assert/strict';
import { BERLIN_GEO_BOUNDS,BERLIN_PROJECTION_ID,lonLatToGame,gameToLonLat,projectionRoundTripError,projectionMetadata } from '../src/berlin-projection.js';
import { MAP_ZOOM_BANDS,mapZoomBand,mapZoomAtLeast,roadVisibleAtBand } from '../src/map-zoom.js';
import { OFFICIAL_ADDRESS_ALIASES,validateOfficialAddressProperties,normalizeAddressFeature,normalizeStreetFeature } from '../tools/berlin-import-lib.mjs';
import { buildBerlinRuntime,classifyRuntimeStreet,runtimeAssetStats } from '../tools/berlin-runtime-lib.mjs';

test('v13 Berlin projection round-trips across the operating bounds with negligible metric error',()=>{
  const samples=[[13.27,52.45],[13.51,52.57],[13.405,52.52],[13.34,52.49],[13.47,52.55]];
  for(const[lon,lat]of samples){
    const[x,y]=lonLatToGame(lon,lat),p=gameToLonLat(x,y);
    assert.ok(Number.isFinite(x)&&Number.isFinite(y));
    assert.ok(Math.abs(p.lon-lon)<1e-10);
    assert.ok(Math.abs(p.lat-lat)<1e-10);
    assert.ok(projectionRoundTripError(lon,lat)<1e-5);
  }
  const metadata=projectionMetadata();
  assert.equal(metadata.id,BERLIN_PROJECTION_ID);
  assert.equal(metadata.runtimeNetworkRequired,false);
  assert.deepEqual(metadata.bbox,[...BERLIN_GEO_BOUNDS]);
});

test('v13 projection preserves the established 1600x1120 game-plane boundary contract',()=>{
  assert.deepEqual(lonLatToGame(BERLIN_GEO_BOUNDS[0],BERLIN_GEO_BOUNDS[1]).map(Math.round),[0,1120]);
  assert.deepEqual(lonLatToGame(BERLIN_GEO_BOUNDS[2],BERLIN_GEO_BOUNDS[3]).map(Math.round),[1600,0]);
});

test('native zoom bands are renderer semantics and do not require Google data attributes',()=>{
  assert.deepEqual(MAP_ZOOM_BANDS,['overview','district','street','detail']);
  assert.equal(mapZoomBand(.8),'overview');
  assert.equal(mapZoomBand(1.4),'district');
  assert.equal(mapZoomBand(2.5),'street');
  assert.equal(mapZoomBand(5),'detail');
  assert.equal(mapZoomAtLeast('street','district'),true);
  assert.equal(roadVisibleAtBand('arterial','overview'),true);
  assert.equal(roadVisibleAtBand('secondary','district'),false);
  assert.equal(roadVisibleAtBand('local','detail'),true);
});

test('official address aliases accept both reviewed historical and current service field names',()=>{
  assert.ok(OFFICIAL_ADDRESS_ALIASES.street.includes('str_name'));
  assert.ok(OFFICIAL_ADDRESS_ALIASES.houseNumber.includes('hnr'));
  assert.ok(OFFICIAL_ADDRESS_ALIASES.postcode.includes('plz'));
  assert.deepEqual(validateOfficialAddressProperties({strnam:'Skalitzer Straße',hausnr:'127'}),{valid:true,missing:[]});
  assert.deepEqual(validateOfficialAddressProperties({str_name:'Skalitzer Straße',hnr:'127'}),{valid:true,missing:[]});
  const current=normalizeAddressFeature({id:'addr-current',properties:{str_name:'Skalitzer Straße',str_nr:'12345',hnr:'127',hnr_zusatz:'A',plz:'10999',bez_name:'Friedrichshain-Kreuzberg',ort_name:'Kreuzberg'},geometry:{type:'Point',coordinates:[13.43,52.50]}});
  assert.equal(current.street,'Skalitzer Straße');
  assert.equal(current.streetNumber,'12345');
  assert.equal(current.houseNumber,'127 A');
  assert.equal(current.postcode,'10999');
  assert.equal(current.locality,'Kreuzberg');
});

test('street normalization carries official classification metadata into the static runtime build',()=>{
  const feature={id:'road-1',properties:{str_name:'Karl-Marx-Allee',str_nr:'1',str_bez:'Hauptverkehrsstraße',kat_step16:'Stufe I'},geometry:{type:'LineString',coordinates:[[13.40,52.515],[13.42,52.515],[13.44,52.515]]}};
  const road=normalizeStreetFeature(feature,{tolerance:.000001});
  assert.equal(road.roadDesignation,'Hauptverkehrsstraße');
  assert.equal(road.stepClass,'Stufe I');
  assert.equal(classifyRuntimeStreet(road,road.lines[0]),'arterial');
});

test('compact Berlin runtime asset contains deterministic LOD geometry labels grid and no network requirement',()=>{
  const imported={metadata:{generatedAt:'2026-09-05T00:00:00.000Z',license:'Datenlizenz Deutschland – Zero – Version 2.0'},streets:[
    {name:'Karl-Marx-Allee',streetKey:'karl-marx-allee',roadDesignation:'Hauptverkehrsstraße',lines:[[[100,100],[220,110],[380,140]]]},
    {name:'Localweg',streetKey:'localweg',lines:[[[400,400],[410,405],[420,410]]]}
  ],addresses:[{street:'Karl-Marx-Allee',houseNumber:'10',postcode:'10178',x:180,y:116}]};
  const a=buildBerlinRuntime(imported,{quantization:10,cellSize:128});
  const b=buildBerlinRuntime(imported,{quantization:10,cellSize:128});
  assert.deepEqual(a,b);
  assert.equal(a.metadata.runtimeNetworkRequired,false);
  assert.equal(a.metadata.projection,BERLIN_PROJECTION_ID);
  assert.equal(a.geometry.length,2);
  assert.ok(a.lod.overview.length>=1);
  assert.ok(a.lod.detail.length>=a.lod.overview.length);
  assert.ok(a.labels.length>=1);
  assert.ok(Object.keys(a.grid.cells).length>=1);
  assert.equal(a.addresses.length,1);
  assert.deepEqual(runtimeAssetStats(a),{streetNames:3,polylines:2,labels:2,addresses:1,cells:Object.keys(a.grid.cells).length});
});
