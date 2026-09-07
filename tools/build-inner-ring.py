"""Build one geographic city pack. Python 3.11+, shapely 2.1.2, pyproj 3.7.2.

Usage: python tools/build-inner-ring.py [source-folder] [output-folder]
Fetch with fetch-inner-ring.mjs first. No network, credentials or randomness here.
"""
import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

from pyproj import Transformer
from shapely import STRtree, make_valid
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import transform, unary_union

source = Path(sys.argv[1] if len(sys.argv) > 1 else '../inner-ring-source')
output = Path(sys.argv[2] if len(sys.argv) > 2 else 'generated')
output.mkdir(parents=True, exist_ok=True)
read = lambda name: json.loads((source / name).read_text(encoding='utf-8'))
ring_source = read('ringbahn-boundary.geojson')
to_meters = Transformer.from_crs('EPSG:4326', 'EPSG:25833', always_xy=True)
to_geo = Transformer.from_crs('EPSG:25833', 'EPSG:4326', always_xy=True)
ring = transform(to_meters.transform, shape(ring_source['geometry']))
assert ring.is_valid and 70e6 < ring.area < 120e6, 'Unexpected Ringbahn area'
x0, y0, x1, y1 = ring.bounds
meters_per_unit = 10

def point(p):
    return [round((p[0]-x0)/meters_per_unit+30, 2), round((y1-p[1])/meters_per_unit+30, 2)]

def parts(g, kind):
    if g.is_empty:
        return []
    if g.geom_type == kind:
        return [g]
    return [p for member in getattr(g, 'geoms', []) for p in parts(member, kind)]

def polygons(g, tolerance=1):
    return [[[point(c) for c in poly.exterior.coords]] + [[point(c) for c in hole.coords] for hole in poly.interiors]
            for poly in parts(g.simplify(tolerance, preserve_topology=True), 'Polygon')]

regions = []
for f in sorted(read('regions.geojson')['features'], key=lambda f: f['properties']['nam']):
    g = make_valid(transform(to_meters.transform, shape(f['geometry']))).intersection(ring)
    if g.area < 1000:
        continue
    name = f['properties']['nam']
    slug = name.lower().replace('ö', 'oe').replace('ü', 'ue').replace('ä', 'ae').replace('ß', 'ss').replace(' ', '-')
    b = g.bounds
    regions.append(dict(id=slug, name=name, sourceId=f['id'], polygons=polygons(g), center=point(g.representative_point().coords[0]),
                        bounds=dict(zip(['x1','y1','x2','y2'], [*point((b[0],b[3])), *point((b[2],b[1]))])), areaKm2=round(g.area/1e6,3)))
region_ids = {r['name']: r['id'] for r in regions}

context = {'water': [], 'vegetation': [], 'buildings': [], 'parks': []}
water_geometries = []
for f in read('landcover.geojson')['features']:
    code = f['properties']['landCoverObservation']['class']['@href'].split('/')[-1]
    layer = 'water' if code.startswith('4') else 'vegetation' if code.startswith('3') else 'buildings' if code == '1-1' else None
    if not layer:
        continue
    g = make_valid(transform(to_meters.transform, shape(f['geometry']))).intersection(ring)
    if g.area < 15:
        continue
    context[layer].extend(polygons(g))
    if layer == 'water':
        water_geometries.append(g)
water = unary_union(water_geometries)
for f in read('parks.geojson')['features']:
    g = make_valid(transform(to_meters.transform, shape(f['geometry']))).intersection(ring)
    if g.area < 300:
        continue
    context['parks'].append(dict(name=f['properties']['namenr'], polygons=polygons(g), area=g.area,
                                 center=point(g.representative_point().coords[0])))

# Preserve junction identity. Crossings in the picture never create junctions.
roads = []
for f in sorted(read('streets.geojson')['features'], key=lambda f: f['id']):
    p = f['properties']
    assert all(p.get(k) is not None for k in ['beginnt_bei_vp','endet_bei_vp','verkehrsrichtung','verkehrsebene']), f['id']
    assert p['verkehrsrichtung'] in ['B','R','G']
    original = transform(to_meters.transform, shape(f['geometry']))
    assert original.geom_type == 'LineString', f['id']
    for i, clipped in enumerate(parts(original.intersection(ring), 'LineString')):
        if clipped.length < 1:
            continue
        # Keep the direction of digitisation, even if the clipping library reverses a piece.
        if original.project(Point(clipped.coords[0])) > original.project(Point(clipped.coords[-1])):
            clipped = LineString(list(clipped.coords)[::-1])
        line = clipped.simplify(1)
        start = f"vp:{p['beginnt_bei_vp']}" if Point(line.coords[0]).distance(Point(original.coords[0])) < .02 else f"cut:{f['id']}:{i}:a"
        end = f"vp:{p['endet_bei_vp']}" if Point(line.coords[-1]).distance(Point(original.coords[-1])) < .02 else f"cut:{f['id']}:{i}:b"
        # Midpoints distinguish parallel edges and loops in the simulation's pair index.
        if len(line.coords) == 2 or start == end:
            midpoint = line.interpolate(.5, normalized=True)
            coords = list(line.coords)
            distance = line.project(midpoint)
            cumulative = 0
            for j in range(1, len(coords)):
                length = Point(coords[j-1]).distance(Point(coords[j]))
                if cumulative+length >= distance:
                    coords.insert(j, midpoint.coords[0]); break
                cumulative += length
            line = LineString(coords)
        roads.append(dict(sourceId=f['id'], name=p['strassenname'] or 'Unnamed path', line=line,
                          start=start, end=end, direction=p['verkehrsrichtung'], level=p['verkehrsebene'],
                          region=region_ids.get(p['stadtteil'], 'mitte'), key=p['strassenschluessel'],
                          roadClass='arterial' if p['strassenklasse1'] in ['I','II','III'] else 'local',
                          routable=p['strassenklasse'] not in ['A','P','X','N','-'] and p['strassenklasse2'] not in ['AUBA','PSTR','KGA','-']))

# Address points retain their official coordinates. A short access connector is
# an explicit game abstraction; it is not claimed to survey a building entrance.
by_street = defaultdict(list)
for i, road in enumerate(roads):
    if road['routable'] and road['level'] == 0:
        by_street[road['key']].append(i)
trees = {key: (indices, STRtree([roads[i]['line'] for i in indices])) for key, indices in by_street.items()}
candidates = defaultdict(list)
address_inside = 0
for f in sorted(read('addresses.geojson')['features'], key=lambda f: f['id']):
    p = f['properties']
    location = transform(to_meters.transform, shape(f['geometry']))
    if not ring.covers(location):
        continue
    address_inside += 1
    if p['str_nr'] not in trees:
        continue
    indices, tree = trees[p['str_nr']]
    ri = indices[tree.nearest(location)]
    road = roads[ri]
    position = road['line'].project(location)
    snap = road['line'].interpolate(position)
    distance = snap.distance(location)
    if distance < .5 or distance > 60:
        continue
    access = LineString([snap, location])
    if not ring.covers(access) or access.intersection(water).length > .5:
        continue
    candidates[ri].append(dict(location=location, position=position, sourceId=f['id'],
                              label=f"{p['str_name']} {p['hnr']}{p['hnr_zusatz'] or ''}", postcode=p['plz'],
                              region=region_ids.get(p['ort_name'], road['region']), lonLat=f['geometry']['coordinates']))
for i, road in enumerate(roads):
    choices = candidates[i]
    selected = []
    for fraction in ([.33,.67] if road['line'].length > 150 else [.5]):
        if not choices:
            break
        best = min(choices, key=lambda a: abs(a['position']-road['line'].length*fraction))
        if best not in selected:
            selected.append(best)
    road['addresses'] = selected

nodes, edges, visuals, node_ids, names, name_ids = [], [], [], {}, [], {}
max_junction_displacement = 0
def name_id(name):
    if name not in name_ids:
        name_ids[name] = len(names); names.append(name)
    return name_ids[name]

def node(key, coordinates, region):
    global max_junction_displacement
    xy = point(coordinates)
    if key in node_ids:
        n = nodes[node_ids[key]]
        max_junction_displacement = max(max_junction_displacement, math.dist(n[:2], xy)*meters_per_unit)
        return node_ids[key]
    index = len(nodes); node_ids[key] = index
    nodes.append([*xy, region, key])
    return index

for ri, road in enumerate(roads):
    line = road['line']
    positions = [(line.project(Point(p)), p, f"shape:{ri}:{j}") for j,p in enumerate(line.coords)]
    positions[0] = (0, line.coords[0], road['start'])
    positions[-1] = (line.length, line.coords[-1], road['end'])
    for a in road['addresses']:
        # A junction within 10 cm is already a suitable access point.
        nearby = min(positions, key=lambda p: abs(p[0]-a['position']))
        if abs(nearby[0]-a['position']) < .1:
            a['snapKey'] = nearby[2]
        else:
            a['snapKey'] = f"access:{a['sourceId']}"
            positions.append((a['position'], line.interpolate(a['position']).coords[0], a['snapKey']))
    positions.sort(key=lambda p:p[0])
    ids = [node(key,xy,road['region']) for _,xy,key in positions]
    ni = name_id(road['name']); vi = len(visuals)
    visuals.append([ids, ni, road['roadClass'], road['sourceId'], road['routable'], road['level']])
    if not road['routable']:
        continue
    for a,b in zip(ids, ids[1:]):
        if a != b and math.dist(nodes[a][:2],nodes[b][:2]) > .001:
            edges.append([a,b,ni,vi,road['direction']])
    for a in road['addresses']:
        ai = node(a['sourceId'],a['location'].coords[0],a['region'])
        nodes[ai].extend([a['label'],a['postcode'],a['lonLat']])
        edges.append([node_ids[a['snapKey']],ai,ni,-1,'B'])

# Only choose work in the largest STRONGLY connected bicycle-game component.
# Forward/reverse source directions are respected; private roads are display-only.
adj, rev = defaultdict(list), defaultdict(list)
for a,b,_,_,d in edges:
    for s,t in ([(a,b),(b,a)] if d == 'B' else [(a,b)] if d == 'R' else [(b,a)]):
        adj[s].append(t); rev[t].append(s)
visited, order = set(), []
for start in list(adj):
    if start in visited:
        continue
    stack = [(start, False)]
    while stack:
        current, done = stack.pop()
        if done:
            order.append(current); continue
        if current in visited:
            continue
        visited.add(current); stack.append((current,True))
        stack.extend((n,False) for n in adj[current] if n not in visited)
visited, components = set(), []
for start in reversed(order):
    if start in visited:
        continue
    group, stack = [], [start]; visited.add(start)
    while stack:
        current = stack.pop(); group.append(current)
        for n in rev[current]:
            if n not in visited:
                visited.add(n); stack.append(n)
    components.append(group)
largest = set(max(components,key=len))
address_ids = [i for i,n in enumerate(nodes) if len(n)>4 and i in largest]
assert len(address_ids)>2500, 'Insufficient reachable addresses'
assert max_junction_displacement < 1, f'Inconsistent connection points: {max_junction_displacement} m'
assert len({tuple(sorted(e[:2])) for e in edges}) == len(edges), 'Parallel node pair'
depot_xy = point(to_meters.transform(13.3903,52.5075))
depot = min(address_ids,key=lambda i:math.dist(nodes[i][:2],depot_xy))
for r in regions:
    r['addresses'] = sum(nodes[i][2] == r['id'] for i in address_ids)
sources = [read(f'{name}.source.json') for name in ['streets','addresses','regions','parks','landcover']]
sources.append(dict(name='ringbahn',url=ring_source.get('properties',{}).get('sourceUrl','https://www.openstreetmap.org/relation/14981'),
                    sha256=hashlib.sha256((source/'ringbahn-boundary.geojson').read_bytes()).hexdigest(),license='ODbL-1.0'))
snapshot = hashlib.sha256(''.join(s['sha256'] for s in sources).encode()).hexdigest()[:12]
metadata = dict(id=f'berlin-inner-ring-v1-{snapshot}', schema=1, crs='EPSG:25833', origin=[x0,y1], padding=30, metersPerUnit=meters_per_unit,
                bounds=dict(x1=30,y1=30,x2=round((x1-x0)/10+30,2),y2=round((y1-y0)/10+30,2)),
                areaKm2=round(ring.area/1e6,3), simplificationMeters=1, coordinateRoundingMeters=.1,
                junctionMaxDisplacementMeters=round(max_junction_displacement,3), sourceAddressesInRing=address_inside,
                routingComponents=len(components), largestComponentNodes=len(largest), reachableAddresses=len(address_ids),
                regions=len(regions), streets=len(visuals), nodes=len(nodes), edges=len(edges),
                routingPolicy='Detailnetz B/R/G directions; no motorways/private/unclassified roads; pedestrian paths allowed as push-bike links. No turn restrictions or bicycle exceptions.',
                accessPolicy='Sampled official address points; access links of at most 60 m to the same named street. Access links are schematic, not surveyed entrances.',
                license='ODbL-1.0; Berlin source datasets dl-de-zero-2.0', sources=sources)
pack = dict(metadata=metadata, names=names, nodes=nodes, edges=edges, streets=visuals, addressIds=address_ids,
            depot=depot, boundary=polygons(ring,0)[0][0], regions=regions, context=context)
payload = json.dumps(pack, ensure_ascii=False, separators=(',',':'))+'\n'
path = output/'berlin-inner-ring.json'; path.write_text(payload,encoding='utf-8',newline='\n')
(output/'berlin-inner-ring-sources.json').write_text(json.dumps(dict(**metadata, sha256=hashlib.sha256(payload.encode()).hexdigest()),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(output/'berlin-inner-ring-boundary.geojson').write_bytes((source/'ringbahn-boundary.geojson').read_bytes())
print(json.dumps({k:v for k,v in metadata.items() if k!='sources'},ensure_ascii=False,indent=2))
print(f'{path}: {len(payload.encode())/1e6:.2f} MB')
