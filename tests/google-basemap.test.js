import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GEO_ANCHORS,gameToLatLng,latLngToGame,googleZoomForScale,scaleForGoogleZoom } from '../src/geo-reference.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Ringbahn control points round-trip between game plane and geographic coordinates',()=>{
  for(const anchor of GEO_ANCHORS){
    const geo=gameToLatLng(anchor.game.x,anchor.game.y);
    assert.ok(Math.abs(geo.lat-anchor.geo.lat)<1e-7,anchor.id);
    assert.ok(Math.abs(geo.lng-anchor.geo.lng)<1e-7,anchor.id);
    const game=latLngToGame(geo.lat,geo.lng);
    assert.ok(Math.abs(game.x-anchor.game.x)<1e-5,anchor.id);
    assert.ok(Math.abs(game.y-anchor.game.y)<1e-5,anchor.id);
  }
});

test('geographic transform stays finite and reversible inside the operating board',()=>{
  for(const point of [[770,520],[500,300],[1100,700],[300,850],[1300,250]]){
    const geo=gameToLatLng(...point),back=latLngToGame(geo.lat,geo.lng);
    assert.ok(Number.isFinite(geo.lat)&&Number.isFinite(geo.lng));
    assert.ok(Math.abs(back.x-point[0])<1e-4);
    assert.ok(Math.abs(back.y-point[1])<1e-4);
  }
});

test('Google fractional zoom conversion is finite and monotonic through overview to detail',()=>{
  const x=770,y=520,center=gameToLatLng(x,y);let previous=0;
  for(const zoom of [11,12,13,14,15,16,17,18,19]){
    const scale=scaleForGoogleZoom(zoom,center.lat,x,y);
    assert.ok(Number.isFinite(scale)&&scale>previous);previous=scale;
    assert.ok(Math.abs(googleZoomForScale(scale,x,y)-zoom)<1e-8);
  }
});

test('Google basemap is presentation-only and never becomes rider or simulation authority',()=>{
  const js=read('../src/google-basemap.js');
  assert.match(js,/Game\.lastInstance/);
  assert.match(js,/Renderer\.lastInstance/);
  assert.match(js,/selectedDeliveryId/);
  assert.doesNotMatch(js,/setChannel\(/);
  assert.doesNotMatch(js,/claimDelivery|claim\(/);
  assert.doesNotMatch(js,/spawnDelivery\(/);
  assert.doesNotMatch(js,/game\.update\(/);
  assert.doesNotMatch(js,/assign/i);
});

test('API key remains browser-local and no production key is committed',()=>{
  const js=read('../src/google-basemap.js'),html=read('../index.html');
  assert.match(js,/sendit\.googleMapsApiKey\.v1/);
  assert.match(js,/localStorage/);
  assert.match(js,/maps\.googleapis\.com\/maps\/api\/js/);
  assert.doesNotMatch(js,/AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(html,/AIza[0-9A-Za-z_-]{20,}/);
  assert.match(js,/Restrict it in Google Cloud/);
});

test('Google mode statically layers exact basemap below transparent game canvas',()=>{
  const html=read('../index.html'),css=read('../ui-v12-google-map.css'),map=read('../src/render-map.js');
  assert.ok(html.indexOf('id="google-map"')<html.indexOf('id="game-canvas"'));
  assert.match(html,/ui-v12-google-map\.css/);
  assert.match(html,/src\/google-basemap\.js/);
  assert.match(css,/\.google-map\{position:absolute;inset:0;z-index:0/);
  assert.match(css,/html\[data-basemap=google\] #game-canvas[^}]*pointer-events:none/s);
  assert.match(map,/if\(googleBasemapActive\(\)\)return/);
  assert.match(map,/drawOperationalDisruptions/);
});

test('Google mode reserves attribution space and exposes public privacy and terms',()=>{
  const html=read('../index.html'),css=read('../ui-v12-google-map.css'),privacy=read('../privacy.html'),terms=read('../terms.html');
  assert.match(css,/html\[data-basemap=google\] \.job-inspector\{bottom:36px/);
  assert.match(css,/html\[data-basemap=google\] \.time-tools\{bottom:34px/);
  assert.match(html,/href="privacy\.html"/);
  assert.match(html,/href="terms\.html"/);
  assert.match(privacy,/Google Privacy Policy/);
  assert.match(terms,/Google Maps Platform Terms of Service/);
});

test('Google mode keeps native game fallback and supports overview district street detail bands',()=>{
  const js=read('../src/google-basemap.js'),css=read('../ui-v12-google-map.css');
  assert.match(js,/read\(MODE_STORE,'game'\)/);
  assert.match(js,/minZoom:11,maxZoom:19/);
  assert.match(js,/overview.*district.*street.*detail/);
  assert.match(js,/fitBounds\(bounds,34\)/);
  assert.match(css,/data-google-zoom-band=overview/);
  assert.match(css,/data-google-zoom-band=detail/);
});
