#!/usr/bin/env node
// Refresh source snapshots explicitly; the game never contacts these services.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { getFeatureUrl } from './berlin-import-lib.mjs';
const folder = resolve(process.argv[2] ?? '../inner-ring-source');
await mkdir(folder, { recursive: true });
const ring = JSON.parse(await readFile(join(folder, 'ringbahn-boundary.geojson'), 'utf8'));
const points = ring.geometry.coordinates[0];
const bbox = [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])), Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))];
const datasets = [
  ['streets', 'detailnetz', 'c_strassenabschnitte'],
  ['addresses', 'adressen_berlin', 'adressen_berlin'],
  ['regions', 'alkis_ortsteile', 'ortsteile'],
  ['parks', 'gruenanlagen', 'gruenanlagen'],
  ['landcover', 'lc_alkis', 'LandCoverUnit']
];
const results = await Promise.allSettled(datasets.map(async ([name, service, type]) => {
  const endpoint = `https://gdi.berlin.de/services/wfs/${service}`;
  let features = [], start = 0, matched, urls = [];
  do {
    const url = new URL(getFeatureUrl(endpoint, `${service}:${type}`, { bbox, count: 10000 }));
    url.searchParams.set('startIndex', String(start));
    const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page.features)) throw new Error(`${name}: no GeoJSON features`);
    if (!Number.isFinite(Number(page.numberMatched ?? page.totalFeatures))) throw new Error(`${name}: missing total count`);
    matched = Number(page.numberMatched ?? page.totalFeatures);
    if (!page.features.length && start < matched) throw new Error(`${name}: truncated page at ${start}/${matched}`);
    features.push(...page.features); start += page.features.length; urls.push(url.href);
  } while (start < matched);
  if (new Set(features.map(f=>f.id)).size !== features.length) throw new Error(`${name}: duplicate feature IDs`);
  const value = JSON.stringify({ type: 'FeatureCollection', features });
  await writeFile(join(folder, `${name}.geojson`), value + '\n');
  const metadata = { name, endpoint, type: `${service}:${type}`, bbox, fetchedAt: new Date().toISOString(), features: features.length,
    sha256: createHash('sha256').update(value+'\n').digest('hex'), urls };
  await writeFile(join(folder, `${name}.source.json`), JSON.stringify(metadata, null, 2)+'\n');
  console.log(`${name}: ${features.length} features`);
  return metadata;
}));
for (const result of results) if (result.status === 'rejected') { console.error(result.reason); process.exitCode = 1; }
