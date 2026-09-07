// Compact, local CityPack adapter. Simulation and drawing use these same nodes.
export function decodeInnerRing(pack) {
  if (pack?.metadata?.schema !== 1 || pack.metadata.crs !== 'EPSG:25833' || pack.metadata.metersPerUnit !== 10 ||
      !Array.isArray(pack.nodes) || !Array.isArray(pack.edges) || !pack.addressIds?.length || !pack.regions?.length)
    throw new Error('Unsupported Berlin city pack');
  const addresses = new Set(pack.addressIds);
  const nodes = pack.nodes.map((n,i)=>({id:`n${i}`,x:n[0],y:n[1],districtId:n[2],sourceId:n[3],
    kind:addresses.has(i)?'address':'junction',unlockLevel:1,addressLabel:n[4],postcode:n[5],lonLat:n[6],streetNames:[]}));
  const edges = pack.edges.map(([a,b,name,visual,direction],i)=>({id:`e${i}`,a:`n${a}`,b:`n${b}`,
    distance:Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y),streetName:pack.names[name],
    visualId:visual<0?null:`v${visual}`,direction,speed:1,eventMultiplier:1,
    roadClass:visual<0?'connector':pack.streets[visual][2],level:visual<0?0:pack.streets[visual][5]}));
  const visualEdges = pack.streets.map(([ids,name,roadClass,sourceId,routable,level],i)=>({id:`v${i}`,a:`n${ids[0]}`,b:`n${ids.at(-1)}`,
    nodeIds:ids.map(id=>`n${id}`),streetName:pack.names[name],roadClass,sourceId,routable,level,unlockLevel:1}));
  const districts = pack.regions.map(r=>({...r,polygon:r.polygons[0][0],x:r.center[0],y:r.center[1],unlockLevel:1,color:'#e7e5d9'}));
  const bounds = pack.metadata.bounds;
  return {geographic:true,metadata:pack.metadata,width:bounds.x2+30,height:bounds.y2+30,nodes,edges,visualEdges,districts,
    parks:[],river:[],canal:[],ringPath:pack.boundary,ringStations:[],streetCatalog:pack.names,
    landmarks:[{id:'checkpoint',name:'Dispatch desk',addressNodeId:`n${pack.depot}`,x:nodes[pack.depot].x,y:nodes[pack.depot].y}],
    unlockStages:[{level:1,threshold:0,name:pack.metadata.name??'Berlin · Inner Ring',desc:pack.metadata.scope==='full-city'?'The full Berlin city boundary':'Inside the S41 / S42 Ringbahn',bounds,districts:districts.map(d=>d.id)}],
    context:pack.context,regions:pack.regions,boundaryPolygons:pack.boundaryPolygons,boroughs:pack.boroughs};
}

export async function loadInnerRing({signal}={}) {
  const response = await fetch(new URL('../generated/berlin-inner-ring.json',import.meta.url),{signal});
  if (!response.ok) throw new Error(`Berlin map could not load (${response.status})`);
  return decodeInnerRing(await response.json());
}

export async function loadBerlinCity({signal}={}) {
  // A separate gzip payload keeps the full city practical on a static host.
  // Browsers without streaming decompression can read the identical JSON pack.
  const compressed=typeof DecompressionStream!=='undefined';
  const response=await fetch(new URL(`../generated/berlin-city.json${compressed?'.gz':''}`,import.meta.url),{signal});
  if(!response.ok)throw new Error(`Berlin city map could not load (${response.status})`);
  const data=compressed?await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json():await response.json();
  return decodeInnerRing(data);
}
