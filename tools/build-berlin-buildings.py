"""Presentation-only official building outlines, spatially sharded for zoomed views.
Usage: python tools/build-berlin-buildings.py SOURCE_FOLDER OUTPUT_FOLDER SCRATCH_FOLDER
The audited routing pack is never rewritten. New/empty output and scratch required.
"""
from pathlib import Path
from collections import OrderedDict
import gzip, hashlib, json, math, sys
from pyproj import Transformer
from shapely.geometry import shape, Polygon
from shapely.ops import transform
from shapely.prepared import prep
from shapely import make_valid
from city_source import iter_features

root=Path(__file__).resolve().parents[1]
source,out,scratch=map(Path,sys.argv[1:4])
for folder in [out,scratch]:
    if folder.exists() and any(folder.iterdir()): raise ValueError(f'Expected new or empty directory: {folder}')
    folder.mkdir(parents=True,exist_ok=True)
meta=json.loads((root/'generated/berlin-city-sources.json').read_text())
source_meta=json.loads((source/'buildings.source.json').read_text())
def file_hash(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()
assert file_hash(source/'buildings.geojson')==source_meta['sha256']
project=Transformer.from_crs(4326,25833,always_xy=True)
boundary=transform(project.transform,shape(json.loads((root/'generated/berlin-city-boundary.geojson').read_text())['geometry']))
prepared=prep(boundary)
x0,y1=meta['origin'];unit=meta['metersPerUnit'];pad=meta['padding']
def polygon_parts(g):
    if g.geom_type=='Polygon':yield g
    elif hasattr(g,'geoms'):
        for part in g.geoms:yield from polygon_parts(part)
def encode(poly,digits=2):
    return [[[round((x-x0)/unit+pad,digits),round((y1-y)/unit+pad,digits)] for x,y,*_ in ring.coords] for ring in [poly.exterior,*poly.interiors]]
tiles={};handles=OrderedDict();seen=kept=polygons=invalid=fine_precision=0;max_error=0
try:
    for feature in iter_features(source/'buildings.geojson'):
        seen+=1
        g=transform(project.transform,shape(feature['geometry']))
        if not g.is_valid:g=make_valid(g);invalid+=1
        if not prepared.intersects(g):continue
        if not prepared.covers(g):g=g.intersection(boundary)
        parts=[]
        for poly in polygon_parts(g):
            simple=poly.simplify(.35,preserve_topology=True)
            for attempt,(geometry,digits) in enumerate([(simple,2),*[(poly,d) for d in [2,3,4,5,6,8]]]):
                encoded=encode(geometry,digits)
                decoded=[[(x0+(x-pad)*unit,y1-(y-pad)*unit) for x,y in ring] for ring in encoded]
                candidate=Polygon(decoded[0],decoded[1:])
                if candidate.is_empty or not candidate.is_valid:continue
                error=poly.boundary.hausdorff_distance(candidate.boundary)
                if error<.5:break
            else:raise ValueError(f'Could not preserve building polygon: {feature["id"]}')
            if attempt:fine_precision+=1
            max_error=max(max_error,error)
            parts.append(encoded)
        if not parts:continue
        points=[p for poly in parts for ring in poly for p in ring]
        bounds=[min(p[0] for p in points),min(p[1] for p in points),max(p[0] for p in points),max(p[1] for p in points)]
        key=f'{math.floor((bounds[0]+bounds[2])/200)}-{math.floor((bounds[1]+bounds[3])/200)}'
        entry=tiles.setdefault(key,{'file':key+'.json','bounds':bounds[:],'features':0,'polygons':0})
        for i in [0,1]:entry['bounds'][i]=min(entry['bounds'][i],bounds[i])
        for i in [2,3]:entry['bounds'][i]=max(entry['bounds'][i],bounds[i])
        entry['features']+=1;entry['polygons']+=len(parts);kept+=1;polygons+=len(parts)
        if key not in handles:
            if len(handles)>=64:handles.popitem(last=False)[1].close()
            handles[key]=(scratch/(key+'.jsonl')).open('a',encoding='utf-8')
        handles.move_to_end(key)
        handles[key].write(json.dumps(parts,separators=(',',':'))+'\n')
        if seen%50000==0:print(f'{seen}/{source_meta["features"]} buildings; {len(tiles)} detail tiles',flush=True)
finally:
    for stream in handles.values():stream.close()
assert seen==source_meta['features']
raw_total=compressed_total=0
for key,entry in sorted(tiles.items()):
    shapes=[]
    for line in (scratch/(key+'.jsonl')).read_text().splitlines():shapes.extend(json.loads(line))
    raw=json.dumps({'polygons':shapes},separators=(',',':')).encode();compressed=gzip.compress(raw,mtime=0)
    (out/entry['file']).write_bytes(raw);(out/(entry['file']+'.gz')).write_bytes(compressed)
    entry.update(bytes=len(raw),gzipBytes=len(compressed),sha256=hashlib.sha256(raw).hexdigest())
    raw_total+=len(raw);compressed_total+=len(compressed)
index={'schema':1,'city':meta['id'],'id':'berlin-buildings-v1-'+source_meta['sha256'][:12],
       'crs':meta['crs'],'origin':meta['origin'],'padding':pad,'metersPerUnit':unit,
       'license':'dl-de-zero-2.0','source':source_meta,'sourceFeatures':seen,'features':kept,'polygons':polygons,
       'repairedSourceGeometries':invalid,'finePrecisionPolygons':fine_precision,'simplificationMeters':.35,'roundingMeters':.1,
       'maxProcessingDeviationMeters':max_error,'rawBytes':raw_total,'gzipBytes':compressed_total,
       'authority':'Presentation only; no route, address, cost or rider state changes.', 'tiles':list(v for _,v in sorted(tiles.items()))}
(out/'index.json').write_text(json.dumps(index,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in index.items() if k not in ['source','tiles']},indent=2),flush=True)
