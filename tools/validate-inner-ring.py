"""Independent source-to-pack geographic audit (requires the source snapshots)."""
import hashlib
import json
import math
import sys
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform
from city_source import iter_features

source=Path(sys.argv[1] if len(sys.argv)>1 else '../inner-ring-source')
generated=Path(sys.argv[2] if len(sys.argv)>2 else 'generated')
full_city='--full-city' in sys.argv
stem='berlin-city' if full_city else 'berlin-inner-ring'
pack=json.loads((generated/(stem+'.json')).read_text(encoding='utf-8'))
meta=pack['metadata'];nodes=pack['nodes']
projection=Transformer.from_crs('EPSG:4326',meta['crs'],always_xy=True)
inverse=Transformer.from_crs(meta['crs'],'EPSG:4326',always_xy=True)
def meters(n):
    return [(n[0]-meta['padding'])*meta['metersPerUnit']+meta['origin'][0],meta['origin'][1]-(n[1]-meta['padding'])*meta['metersPerUnit']]
def features(name):
    if full_city:
        yield from iter_features(source/(name+'.geojson'))
    else: yield from json.loads((source/(name+'.geojson')).read_text(encoding='utf-8'))['features']
source_ids={nodes[i][3] for i in pack['addressIds']}
addresses={f['id']:f for f in features('addresses') if f['id'] in source_ids}
errors=[]
for i in pack['addressIds']:
    node=nodes[i];actual=projection.transform(*addresses[node[3]]['geometry']['coordinates'])
    errors.append(math.dist(meters(node),actual))
assert max(errors)<.072
streets={f['id']:transform(projection.transform,shape(f['geometry'])) for f in features('streets')}
geometry_error=0
for ids,_,_,source_id,_,_ in pack['streets']:
    line=LineString([meters(nodes[i]) for i in ids])
    # Densification tests the line between vertices as well as endpoints.
    for p in line.segmentize(5).coords:
        geometry_error=max(geometry_error,streets[source_id].distance(Point(p)))
assert geometry_error<1.15,geometry_error
manifest=json.loads((generated/(stem+'-sources.json')).read_text(encoding='utf-8'))
assert hashlib.sha256((generated/(stem+'.json')).read_bytes()).hexdigest()==manifest['sha256']
for entry in meta['sources']:
    file=source/('ringbahn-boundary.geojson' if entry['name']=='ringbahn' else entry['name']+'.geojson')
    with file.open('rb') as stream: assert hashlib.file_digest(stream,'sha256').hexdigest()==entry['sha256']
if full_city:
    boundary=transform(projection.transform,shape(next(features('boundary'))['geometry']))
    assert abs(boundary.area/1e6-meta['areaKm2'])<.001
    assert len(pack['regions'])==97 and len(pack['boroughs'])==12
    assert all(region['depot'] in pack['addressIds'] for region in pack['regions'])
result=dict(city=meta['id'],checkedAddressPoints=len(errors),maxAddressPositionErrorMeters=max(errors),
            checkedStreetSections=len(pack['streets']),maxStreetGeometryDeviationMeters=geometry_error,
            sourceHashesVerified=len(meta['sources']),packHashVerified=True)
target=Path('reports/'+('berlin-city' if full_city else 'inner-ring')+'-source-audit.json');target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,indent=2))
