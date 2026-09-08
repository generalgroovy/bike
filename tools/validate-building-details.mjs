import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const folder=new URL('../generated/berlin-buildings/',import.meta.url);
const meta=JSON.parse(readFileSync(new URL('index.json',folder)));
const city=JSON.parse(readFileSync(new URL('../generated/berlin-city-sources.json',import.meta.url)));
assert.equal(meta.city,city.id);for(const key of ['crs','origin','padding','metersPerUnit'])assert.deepEqual(meta[key],city[key]);
let polygons=0,vertices=0,features=0,bytes=0,gzipBytes=0,maxTile=0;
const names=new Set();
for(const tile of meta.tiles){
  assert.match(tile.file,/^\d+-\d+\.json$/);assert.ok(!names.has(tile.file));names.add(tile.file);
  const raw=readFileSync(new URL(tile.file,folder)),compressed=readFileSync(new URL(tile.file+'.gz',folder));
  assert.equal(createHash('sha256').update(raw).digest('hex'),tile.sha256,tile.file);assert.deepEqual(gunzipSync(compressed),raw);
  assert.equal(raw.length,tile.bytes);assert.equal(compressed.length,tile.gzipBytes);
  const value=JSON.parse(raw);assert.equal(value.polygons.length,tile.polygons);
  for(const poly of value.polygons){assert.ok(poly.length);for(const ring of poly){assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));for(const [x,y] of ring){assert.ok(Number.isFinite(x)&&Number.isFinite(y));assert.ok(x>=tile.bounds[0]&&x<=tile.bounds[2]&&y>=tile.bounds[1]&&y<=tile.bounds[3]);vertices++;}}}
  polygons+=tile.polygons;features+=tile.features;bytes+=raw.length;gzipBytes+=compressed.length;maxTile=Math.max(maxTile,compressed.length);
}
assert.equal(polygons,meta.polygons);assert.equal(features,meta.features);assert.equal(bytes,meta.rawBytes);assert.equal(gzipBytes,meta.gzipBytes);
assert.ok(meta.maxProcessingDeviationMeters<.5);
const report={passed:true,id:meta.id,city:meta.city,tiles:meta.tiles.length,sourceFeatures:meta.sourceFeatures,features,polygons,vertices,rawBytes:bytes,gzipBytes,maxGzipTileBytes:maxTile,sourceProcessingDeviationMeters:meta.maxProcessingDeviationMeters,checks:['Every tile SHA-256','Every gzip equals its JSON','All closed rings and finite coordinates','Every vertex stays inside its indexed bounds','Full counts and city projection match']};
const reports=new URL('../reports/',import.meta.url);mkdirSync(reports,{recursive:true});writeFileSync(new URL('building-details-audit.json',reports),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
