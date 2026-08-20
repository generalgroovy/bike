import test from 'node:test';
import assert from 'node:assert/strict';
import { BERLIN_WFS,INNER_RING_BBOX,capabilitiesUrl,featureTypeNames,chooseFeatureType,getFeatureUrl,projectPoint,simplifyLine,normalizeStreetFeature,normalizeAddressFeature,stableSortImported } from '../tools/berlin-import-lib.mjs';

test('official Berlin importer endpoints and WFS capability URL stay explicit',()=>{
  assert.match(BERLIN_WFS.streets,/gdi\.berlin\.de\/services\/wfs\/detailnetz/);
  assert.match(BERLIN_WFS.addresses,/gdi\.berlin\.de\/services\/wfs\/adressen_berlin/);
  const url=new URL(capabilitiesUrl(BERLIN_WFS.streets));
  assert.equal(url.searchParams.get('service'),'WFS');
  assert.equal(url.searchParams.get('request'),'GetCapabilities');
  assert.equal(url.searchParams.get('version'),'2.0.0');
});

test('feature type discovery parses namespaced capabilities and picks hinted layer',()=>{
  const xml=`<wfs:WFS_Capabilities xmlns:wfs="x"><wfs:FeatureTypeList><wfs:FeatureType><wfs:Name>fis:verkehr_knoten</wfs:Name></wfs:FeatureType><wfs:FeatureType><wfs:Name>fis:strassenabschnitt</wfs:Name></wfs:FeatureType></wfs:FeatureTypeList></wfs:WFS_Capabilities>`;
  const names=featureTypeNames(xml);
  assert.deepEqual(names,['fis:verkehr_knoten','fis:strassenabschnitt']);
  assert.equal(chooseFeatureType(names,['strassenabschnitt','strasse']),'fis:strassenabschnitt');
});

test('GetFeature URL requests deterministic GeoJSON in WGS84 within supplied bbox',()=>{
  const url=new URL(getFeatureUrl(BERLIN_WFS.addresses,'fis:adresse',{bbox:[13.3,52.48,13.4,52.54],count:1234}));
  assert.equal(url.searchParams.get('service'),'WFS');
  assert.equal(url.searchParams.get('request'),'GetFeature');
  assert.equal(url.searchParams.get('typeNames'),'fis:adresse');
  assert.equal(url.searchParams.get('outputFormat'),'application/json');
  assert.equal(url.searchParams.get('srsName'),'EPSG:4326');
  assert.equal(url.searchParams.get('count'),'1234');
  assert.match(url.searchParams.get('bbox'),/^13\.3,52\.48,13\.4,52\.54,/);
});

test('coordinate projection maps bbox corners deterministically into game space',()=>{
  assert.deepEqual(projectPoint([INNER_RING_BBOX[0],INNER_RING_BBOX[1]]),[0,1120]);
  assert.deepEqual(projectPoint([INNER_RING_BBOX[2],INNER_RING_BBOX[3]]),[1600,0]);
  const center=projectPoint([(INNER_RING_BBOX[0]+INNER_RING_BBOX[2])/2,(INNER_RING_BBOX[1]+INNER_RING_BBOX[3])/2]);
  assert.ok(Math.abs(center[0]-800)<1e-8);assert.ok(Math.abs(center[1]-560)<1e-8);
});

test('line simplifier preserves endpoints while removing redundant collinear points',()=>{
  const source=[[13.30,52.50],[13.31,52.50],[13.32,52.50],[13.33,52.50]];
  const simplified=simplifyLine(source,.00001);
  assert.deepEqual(simplified[0],source[0]);
  assert.deepEqual(simplified.at(-1),source.at(-1));
  assert.equal(simplified.length,2);
});

test('street feature normalization extracts name and projected simplified geometry',()=>{
  const feature={id:'street.7',type:'Feature',properties:{STRASSENNAME:'Oranienstraße'},geometry:{type:'LineString',coordinates:[[13.35,52.50],[13.351,52.50001],[13.36,52.505]]}};
  const result=normalizeStreetFeature(feature,{tolerance:.0001});
  assert.equal(result.name,'Oranienstraße');
  assert.equal(result.sourceId,'street.7');
  assert.equal(result.lines.length,1);
  assert.ok(result.lines[0].length>=2);
  assert.ok(result.lines[0].flat().every(Number.isFinite));
});

test('address normalization extracts street house number postcode and projected point',()=>{
  const feature={id:'addr.9',type:'Feature',properties:{str_name:'Skalitzer Straße',hausnummer:'127 A',plz:'10999'},geometry:{type:'Point',coordinates:[13.43,52.50]}};
  const result=normalizeAddressFeature(feature);
  assert.equal(result.street,'Skalitzer Straße');
  assert.equal(result.houseNumber,'127 A');
  assert.equal(result.postcode,'10999');
  assert.ok(Number.isFinite(result.x)&&Number.isFinite(result.y));
});

test('import output stable sort is deterministic independent of feature arrival order',()=>{
  const data={streets:[{name:'Zossener Straße',sourceId:'2'},{name:'Akazienstraße',sourceId:'7'}],addresses:[{street:'Zossener Straße',houseNumber:'10',sourceId:'2'},{street:'Akazienstraße',houseNumber:'12',sourceId:'3'},{street:'Akazienstraße',houseNumber:'2',sourceId:'1'}]};
  stableSortImported(data);
  assert.deepEqual(data.streets.map(x=>x.name),['Akazienstraße','Zossener Straße']);
  assert.deepEqual(data.addresses.map(x=>`${x.street} ${x.houseNumber}`),['Akazienstraße 2','Akazienstraße 12','Zossener Straße 10']);
});
