import { canonicalStreetName } from './berlin-import-lib.mjs';

const keyPair=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function pointSegmentProjection(point,a,b){const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy;if(len2<=1e-12)return{x:a.x,y:a.y,t:0,distance:Math.hypot(point.x-a.x,point.y-a.y)};const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/len2)),x=a.x+dx*t,y=a.y+dy*t;return{x,y,t,distance:Math.hypot(point.x-x,point.y-y)};}
function snapKey(x,y,tolerance){return`${Math.round(x/tolerance)}:${Math.round(y/tolerance)}`;}

export function buildStreetSkeleton(streets,{snapTolerance=1.5}={}){
  const nodes=[],edges=[],buckets=new Map(),sourceNodes=new Map(),edgeSeen=new Set();let nodeSerial=0,edgeSerial=0;
  function newNode(x,y,sourceNodeId=null){const node={id:nodeSerial++,x,y,kind:'street',sourceNodeId:sourceNodeId??null};nodes.push(node);if(sourceNodeId!=null)sourceNodes.set(String(sourceNodeId),node.id);return node;}
  function nodeFor(x,y,sourceNodeId=null){
    if(sourceNodeId!=null){const known=sourceNodes.get(String(sourceNodeId));if(known!=null)return nodes[known];return newNode(x,y,sourceNodeId);}
    const key=snapKey(x,y,snapTolerance),candidates=buckets.get(key)??[];for(const id of candidates){const node=nodes[id];if(Math.hypot(node.x-x,node.y-y)<=snapTolerance)return node;}const node=newNode(x,y);candidates.push(node.id);buckets.set(key,candidates);return node;
  }
  for(const street of streets??[]){
    const lines=street.lines??[];
    for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
      const line=lines[lineIndex];let previous=null;
      for(let pointIndex=0;pointIndex<line.length;pointIndex++){
        const point=line[pointIndex];if(!Array.isArray(point)||point.length<2||!point.every(Number.isFinite)){previous=null;continue;}
        const isFirst=lineIndex===0&&pointIndex===0,isLast=lineIndex===lines.length-1&&pointIndex===line.length-1,sourceNodeId=isFirst?street.fromNode:isLast?street.toNode:null,current=nodeFor(point[0],point[1],sourceNodeId);
        if(previous&&previous.id!==current.id){const pair=keyPair(previous.id,current.id),name=street.name??'Unnamed',streetNumber=street.streetNumber??null,identity=streetNumber??canonicalStreetName(name);if(!edgeSeen.has(`${pair}|${identity}`)){const d=distance(previous,current);if(d>.01){edges.push({id:`e${edgeSerial++}`,a:previous.id,b:current.id,streetName:name,streetKey:street.streetKey??canonicalStreetName(name),streetNumber,sourceId:street.sourceId??null,distance:d});edgeSeen.add(`${pair}|${identity}`);}}}previous=current;
      }
    }
  }
  return{nodes,edges};
}

function edgeIdentityMatches(address,edge,mode){
  if(mode==='number')return Boolean(address.streetNumber&&edge.streetNumber&&String(address.streetNumber)===String(edge.streetNumber));
  if(mode==='name')return Boolean(address.streetKey&&edge.streetKey&&address.streetKey===edge.streetKey)||canonicalStreetName(address.street)===canonicalStreetName(edge.streetName);
  return true;
}

export function nearestStreetEdge(address,nodes,edges,{sameStreetOnly=true,maxDistance=30,matchMode=null}={}){
  const mode=matchMode??(sameStreetOnly?'name':'any');let best=null;for(const edge of edges){if(!edgeIdentityMatches(address,edge,mode))continue;const a=nodes[edge.a],b=nodes[edge.b];if(!a||!b)continue;const projection=pointSegmentProjection(address,a,b);if(projection.distance>maxDistance)continue;if(!best||projection.distance<best.distance)best={edge,projection,distance:projection.distance,matchKind:mode==='any'?'fallback':mode};}return best;
}

export function attachAddresses(skeleton,addresses,{maxDistance=28,allowCrossStreetFallback=true}={}){
  const baseNodes=skeleton.nodes.map(node=>({...node})),baseEdges=skeleton.edges.map(edge=>({...edge})),attachments=new Map(),unmatched=[],matchCounts={number:0,name:0,fallback:0};
  for(const sourceAddress of addresses??[]){const address={...sourceAddress,streetKey:sourceAddress.streetKey??canonicalStreetName(sourceAddress.street)};let match=null;if(address.streetNumber)match=nearestStreetEdge(address,baseNodes,baseEdges,{matchMode:'number',maxDistance});if(!match)match=nearestStreetEdge(address,baseNodes,baseEdges,{matchMode:'name',maxDistance});if(!match&&allowCrossStreetFallback)match=nearestStreetEdge(address,baseNodes,baseEdges,{matchMode:'any',maxDistance});if(!match){unmatched.push(address);continue;}matchCounts[match.matchKind]+=1;const list=attachments.get(match.edge.id)??[];list.push({address,projection:match.projection,distance:match.distance,matchKind:match.matchKind});attachments.set(match.edge.id,list);}
  const nodes=[...baseNodes],edges=[];let addressSerial=0,edgeSerial=0;
  for(const edge of baseEdges){const attached=(attachments.get(edge.id)??[]).sort((a,b)=>a.projection.t-b.projection.t),chain=[edge.a];for(const item of attached){const a=baseNodes[edge.a],b=baseNodes[edge.b],nearStart=item.projection.t<.015,nearEnd=item.projection.t>.985;let node;if(nearStart)node=nodes[edge.a];else if(nearEnd)node=nodes[edge.b];else{node={id:nodes.length,x:item.projection.x,y:item.projection.y,kind:'address-anchor'};nodes.push(node);}const addressNode={id:nodes.length,x:item.address.x,y:item.address.y,kind:'address',streetName:item.address.street,streetKey:item.address.streetKey,streetNumber:item.address.streetNumber??null,houseNumber:item.address.houseNumber,postcode:item.address.postcode??null,addressLabel:`${item.address.street} ${item.address.houseNumber}`,district:item.address.district??null,locality:item.address.locality??null,sourceId:item.address.sourceId??null,anchorId:node.id,snapDistance:item.distance,matchKind:item.matchKind};nodes.push(addressNode);edges.push({id:`a${addressSerial++}`,a:node.id,b:addressNode.id,streetName:item.address.street,distance:Math.max(.05,distance(node,addressNode)),kind:'address-link'});if(chain.at(-1)!==node.id)chain.push(node.id);}
    if(chain.at(-1)!==edge.b)chain.push(edge.b);for(let i=1;i<chain.length;i++){const a=nodes[chain[i-1]],b=nodes[chain[i]];if(!a||!b||a.id===b.id)continue;edges.push({id:`r${edgeSerial++}`,a:a.id,b:b.id,streetName:edge.streetName,streetKey:edge.streetKey,streetNumber:edge.streetNumber??null,distance:distance(a,b),kind:'street',sourceId:edge.sourceId});}}
  return{nodes,edges,unmatched,matchedCount:(addresses?.length??0)-unmatched.length,matchCounts};
}

export function connectedComponents(graph){const adjacency=new Map(graph.nodes.map(node=>[node.id,[]]));for(const edge of graph.edges){adjacency.get(edge.a)?.push(edge.b);adjacency.get(edge.b)?.push(edge.a);}const visited=new Set(),components=[];for(const node of graph.nodes){if(visited.has(node.id))continue;const queue=[node.id],ids=[];visited.add(node.id);while(queue.length){const id=queue.pop();ids.push(id);for(const next of adjacency.get(id)??[])if(!visited.has(next)){visited.add(next);queue.push(next);}}components.push(ids);}components.sort((a,b)=>b.length-a.length);return components;}

export function graphQuality(graph,{maxComponents=12,minLargestShare=.9,minAddressMatch=.8,totalAddresses=null,matchCounts=null,maxFallbackShare=.08}={}){const components=connectedComponents(graph),largest=components[0]?.length??0,nodeCount=graph.nodes.length,addressNodes=graph.nodes.filter(node=>node.kind==='address').length,denominator=totalAddresses??addressNodes,largestShare=nodeCount?largest/nodeCount:0,addressMatch=denominator?addressNodes/denominator:1,matched=(matchCounts?.number??0)+(matchCounts?.name??0)+(matchCounts?.fallback??0),fallbackShare=matched?(matchCounts?.fallback??0)/matched:0,errors=[];if(components.length>maxComponents)errors.push(`components ${components.length} > ${maxComponents}`);if(largestShare<minLargestShare)errors.push(`largest component share ${largestShare.toFixed(3)} < ${minLargestShare}`);if(addressMatch<minAddressMatch)errors.push(`address match ${addressMatch.toFixed(3)} < ${minAddressMatch}`);if(fallbackShare>maxFallbackShare)errors.push(`fallback match share ${fallbackShare.toFixed(3)} > ${maxFallbackShare}`);return{valid:errors.length===0,errors,components:components.length,largestShare,addressMatch,fallbackShare,nodeCount,edgeCount:graph.edges.length,addressNodes,matchCounts:matchCounts??{number:0,name:0,fallback:0}};}

export function buildBerlinCandidate(imported,options={}){const skeleton=buildStreetSkeleton(imported?.streets??[],options),graph=attachAddresses(skeleton,imported?.addresses??[],options),quality=graphQuality(graph,{...options,totalAddresses:imported?.addresses?.length??0,matchCounts:graph.matchCounts});return{metadata:{...(imported?.metadata??{}),candidate:true,sourceStreetFeatures:imported?.streets?.length??0,sourceAddresses:imported?.addresses?.length??0,matchedAddresses:graph.matchedCount,unmatchedAddresses:graph.unmatched.length,addressMatchKinds:graph.matchCounts,quality},nodes:graph.nodes,edges:graph.edges,unmatchedAddresses:graph.unmatched};}