"""Independent source-to-pack geographic audit (requires the source snapshots)."""
import hashlib
import json
import math
import sys
from pathlib import Path
from pyproj import Transformer
from shapely.geometry import LineString, Point, shape
from shapely.ops import transform

source=Path(sys.argv[1] if len(sys.argv)>1 else '../inner-ring-source')
generated=Path(sys.argv[2] if len(sys.argv)>2 else 'generated')
pack=json.loads((generated/'berlin-inner-ring.json').read_text(encoding='utf-8'))
meta=pack['metadata'];nodes=pack['nodes']
projection=Transformer.from_crs('EPSG:4326',meta['crs'],always_xy=True)
inverse=Transformer.from_crs(meta['crs'],'EPSG:4326',always_xy=True)
def meters(n):
    return [(n[0]-meta['padding'])*meta['metersPerUnit']+meta['origin'][0],meta['origin'][1]-(n[1]-meta['padding'])*meta['metersPerUnit']]
addresses={f['id']:f for f in json.loads((source/'addresses.geojson').read_text(encoding='utf-8'))['features']}
errors=[]
for i in pack['addressIds']:
    node=nodes[i];actual=projection.transform(*addresses[node[3]]['geometry']['coordinates'])
    errors.append(math.dist(meters(node),actual))
assert max(errors)<.072
streets={f['id']:transform(projection.transform,shape(f['geometry'])) for f in json.loads((source/'streets.geojson').read_text(encoding='utf-8'))['features']}
geometry_error=0
for ids,_,_,source_id,_,_ in pack['streets']:
    line=LineString([meters(nodes[i]) for i in ids])
    # Densification tests the line between vertices as well as endpoints.
    for p in line.segmentize(5).coords:
        geometry_error=max(geometry_error,streets[source_id].distance(Point(p)))
assert geometry_error<1.15,geometry_error
manifest=json.loads((generated/'berlin-inner-ring-sources.json').read_text(encoding='utf-8'))
assert hashlib.sha256((generated/'berlin-inner-ring.json').read_bytes()).hexdigest()==manifest['sha256']
for entry in meta['sources']:
    file=source/('ringbahn-boundary.geojson' if entry['name']=='ringbahn' else entry['name']+'.geojson')
    assert hashlib.sha256(file.read_bytes()).hexdigest()==entry['sha256']
result=dict(city=meta['id'],checkedAddressPoints=len(errors),maxAddressPositionErrorMeters=max(errors),
            checkedStreetSections=len(pack['streets']),maxStreetGeometryDeviationMeters=geometry_error,
            sourceHashesVerified=len(meta['sources']),packHashVerified=True)
target=Path('reports/inner-ring-source-audit.json');target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result,indent=2))
