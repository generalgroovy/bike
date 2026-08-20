export const RINGBAHN_RELATIONS={S41:14981,S42:14983};
export const OSM_API='https://api.openstreetmap.org/api/0.6';

export function relationFullJsonUrl(relationId){return `${OSM_API}/relation/${Number(relationId)}/full.json`;}

export function indexOsmElements(osm){const nodes=new Map(),ways=new Map(),relations=new Map();for(const element of osm?.elements??[]){if(element.type==='node')nodes.set(element.id,element);else if(element.type==='way')ways.set(element.id,element);else if(element.type==='relation')relations.set(element.id,element);}return{nodes,ways,relations};}

function coordinatesForWay(way,nodes){const result=[];for(const id of way?.nodes??[]){const node=nodes.get(id);if(node&&Number.isFinite(node.lon)&&Number.isFinite(node.lat))result.push([node.lon,node.lat]);}return result;}
function samePoint(a,b,tolerance=1e-9){return Boolean(a&&b&&Math.abs(a[0]-b[0])<=tolerance&&Math.abs(a[1]-b[1])<=tolerance);}

export function stitchRelationWays(osm,relationId){
  const{nodes,ways,relations}=indexOsmElements(osm),relation=relations.get(Number(relationId));if(!relation)throw new Error(`Relation ${relationId} not present in OSM payload`);
  const pieces=relation.members.filter(member=>member.type==='way').map(member=>({id:member.ref,coords:coordinatesForWay(ways.get(member.ref),nodes)})).filter(piece=>piece.coords.length>=2);if(!pieces.length)throw new Error(`Relation ${relationId} contains no usable way geometry`);
  const unused=[...pieces],chains=[];
  while(unused.length){const first=unused.shift(),chain=[...first.coords];let changed=true;while(changed&&unused.length){changed=false;for(let i=0;i<unused.length;i++){const coords=unused[i].coords,start=chain[0],end=chain.at(-1),a=coords[0],b=coords.at(-1);if(samePoint(end,a)){chain.push(...coords.slice(1));unused.splice(i,1);changed=true;break;}if(samePoint(end,b)){chain.push(...coords.slice(0,-1).reverse());unused.splice(i,1);changed=true;break;}if(samePoint(start,b)){chain.unshift(...coords.slice(0,-1));unused.splice(i,1);changed=true;break;}if(samePoint(start,a)){chain.unshift(...coords.slice(1).reverse());unused.splice(i,1);changed=true;break;}}}chains.push(chain);}
  chains.sort((a,b)=>b.length-a.length);return{relation,chains,primary:chains[0]};
}

export function closeRing(points){if(!points?.length)return[];const result=[...points];if(!samePoint(result[0],result.at(-1)))result.push([...result[0]]);return result;}

export function ringPolygonFromRelation(osm,relationId){const{relation,chains,primary}=stitchRelationWays(osm,relationId),ring=closeRing(primary);if(ring.length<4)throw new Error(`Relation ${relationId} did not yield a polygon-capable line`);return{type:'Feature',properties:{source:'OpenStreetMap',relationId:Number(relationId),ref:relation.tags?.ref??null,name:relation.tags?.name??null,license:'ODbL 1.0',chainCount:chains.length},geometry:{type:'Polygon',coordinates:[ring]}};}

export function polygonArea(ring){let area=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++)area+=(ring[j][0]*ring[i][1]-ring[i][0]*ring[j][1]);return Math.abs(area)/2;}

export function validateRingPolygon(feature,{minVertices=20,minArea=.002}={}){const ring=feature?.geometry?.type==='Polygon'?feature.geometry.coordinates?.[0]:null,errors=[];if(!ring)errors.push('geometry must be Polygon');else{if(ring.length<minVertices)errors.push(`expected at least ${minVertices} vertices`);if(!samePoint(ring[0],ring.at(-1)))errors.push('ring is not closed');const area=polygonArea(ring);if(area<minArea)errors.push(`polygon area ${area} below ${minArea}`);}return{valid:errors.length===0,errors};}
