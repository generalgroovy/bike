export const BERLIN_WFS={
  streets:'https://gdi.berlin.de/services/wfs/detailnetz',
  addresses:'https://gdi.berlin.de/services/wfs/adressen_berlin'
};

export const INNER_RING_BBOX=[13.27,52.45,13.51,52.57];

// Exact documented Adressen RBS field names. Keep these canonical and only use
// aliases as compatibility fallbacks for other/older exported representations.
export const OFFICIAL_ADDRESS_SCHEMA={
  id:'adr_ident',
  street:'strnam',
  streetNumber:'strnr',
  streetType:'str_typ',
  houseNumber:'hausnr',
  houseNumberSuffix:'hausnrz',
  postcode:'postleit',
  district:'bez_name',
  locality:'ot_name',
  planningArea:'plr_name'
};

// The Detailnetz technical description documents these semantics but does not
// publish the WFS property identifiers in that document. These are therefore
// ordered compatibility candidates, not asserted canonical schema keys.
export const DETAILNETZ_PROPERTY_CANDIDATES={
  id:['detailnetz-id','detailnetz_id','link_id','id'],
  elementNumber:['detailnetz-nr','detailnetz_nr','elem_nr','org_elemnr'],
  streetNumber:['strassennummer','strnr','strschl'],
  streetName:['strassenname','str_name','strname','name'],
  roadDesignation:['strassenbezeichnung','str_bez'],
  stepClass:['step-klasse','strklasse1','kat_step16'],
  okstraClass:['okstra-klasse','strklasse'],
  rbsClass:['rbs-klasse','strklasse2'],
  direction:['verkehrsrichtung','vricht'],
  fromNode:['vp_von','von_vp','from_node'],
  toNode:['vp_bis','bis_vp','to_node'],
  length:['laenge','länge in m','length']
};

export function capabilitiesUrl(endpoint){const url=new URL(endpoint);url.searchParams.set('service','WFS');url.searchParams.set('request','GetCapabilities');url.searchParams.set('version','2.0.0');return url.toString();}
export function featureTypeNames(xml){return[...String(xml).matchAll(/<(?:\w+:)?FeatureType\b[\s\S]*?<(?:\w+:)?Name>([^<]+)<\/(?:\w+:)?Name>/g)].map(match=>match[1].trim());}
export function chooseFeatureType(names,hints=[]){const normalized=hints.map(h=>h.toLowerCase());return names.find(name=>normalized.some(h=>name.toLowerCase().includes(h)))??names[0]??null;}
export function getFeatureUrl(endpoint,typeName,{bbox=INNER_RING_BBOX,count=50000}={}){const url=new URL(endpoint);url.searchParams.set('service','WFS');url.searchParams.set('request','GetFeature');url.searchParams.set('version','2.0.0');url.searchParams.set('typeNames',typeName);url.searchParams.set('outputFormat','application/json');url.searchParams.set('srsName','EPSG:4326');url.searchParams.set('count',String(count));url.searchParams.set('bbox',`${bbox.join(',')},EPSG:4326`);return url.toString();}
export function pickProperty(properties,candidates){if(!properties)return null;const entries=Object.entries(properties),lower=new Map(entries.map(([key,value])=>[key.toLowerCase(),value]));for(const candidate of candidates){const value=lower.get(candidate.toLowerCase());if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;}return null;}
export function projectPoint([lon,lat],bbox=INNER_RING_BBOX,width=1600,height=1120){const[x1,y1,x2,y2]=bbox,x=(lon-x1)/(x2-x1)*width,y=height-(lat-y1)/(y2-y1)*height;return[x,y];}
export function pointInsideBbox([lon,lat],bbox=INNER_RING_BBOX){return lon>=bbox[0]&&lon<=bbox[2]&&lat>=bbox[1]&&lat<=bbox[3];}
export function pointInsidePolygon(point,polygon){if(!polygon?.length)return true;const[x,y]=point;let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const[xi,yi]=polygon[i],[xj,yj]=polygon[j],cross=((yi>y)!==(yj>y))&&x<(xj-xi)*(y-yi)/((yj-yi)||Number.EPSILON)+xi;if(cross)inside=!inside;}return inside;}
function segmentIntersectionT(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],cross=(u,v)=>u[0]*v[1]-u[1]*v[0],den=cross(r,s);if(Math.abs(den)<1e-12)return null;const ca=[c[0]-a[0],c[1]-a[1]],t=cross(ca,s)/den,u=cross(ca,r)/den;return t>1e-10&&t<1-1e-10&&u>=-1e-10&&u<=1+1e-10?t:null;}
export function clipLineToPolygon(points,polygon){if(!polygon?.length)return points.length>=2?[points]:[];const pieces=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],ts=[0,1];for(let j=0,k=polygon.length-1;j<polygon.length;k=j++){const t=segmentIntersectionT(a,b,polygon[k],polygon[j]);if(t!=null)ts.push(t);}ts.sort((x,y)=>x-y);for(let n=1;n<ts.length;n++){const t0=ts[n-1],t1=ts[n],mid=(t0+t1)/2,pMid=[a[0]+(b[0]-a[0])*mid,a[1]+(b[1]-a[1])*mid];if(!pointInsidePolygon(pMid,polygon))continue;const p0=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],p1=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1],last=pieces.at(-1);if(last&&Math.hypot(last.at(-1)[0]-p0[0],last.at(-1)[1]-p0[1])<1e-10)last.push(p1);else pieces.push([p0,p1]);}}return pieces.filter(line=>line.length>=2);}
export function simplifyLine(points,tolerance=.00008){if(points.length<=2)return points;const sq=tolerance*tolerance;function segmentDistance(p,a,b){let x=a[0],y=a[1],dx=b[0]-x,dy=b[1]-y;if(dx||dy){const t=((p[0]-x)*dx+(p[1]-y)*dy)/(dx*dx+dy*dy);if(t>1){x=b[0];y=b[1];}else if(t>0){x+=dx*t;y+=dy*t;}}dx=p[0]-x;dy=p[1]-y;return dx*dx+dy*dy;}function reduce(first,last,out){let max=sq,index=-1;for(let i=first+1;i<last;i++){const d=segmentDistance(points[i],points[first],points[last]);if(d>max){index=i;max=d;}}if(index>0){if(index-first>1)reduce(first,index,out);out.push(points[index]);if(last-index>1)reduce(index,last,out);}}const result=[points[0]];reduce(0,points.length-1,result);result.push(points.at(-1));return result;}
export function validateOfficialAddressProperties(properties){const required=[OFFICIAL_ADDRESS_SCHEMA.street,OFFICIAL_ADDRESS_SCHEMA.houseNumber],missing=required.filter(key=>properties?.[key]==null||String(properties[key]).trim()==='');return{valid:missing.length===0,missing};}
export function normalizeStreetFeature(feature,{bbox=INNER_RING_BBOX,polygon=null,width=1600,height=1120,tolerance=.00008}={}){const geometry=feature?.geometry;if(!geometry)return null;const lines=geometry.type==='LineString'?[geometry.coordinates]:geometry.type==='MultiLineString'?geometry.coordinates:[];if(!lines.length)return null;const name=String(pickProperty(feature.properties,DETAILNETZ_PROPERTY_CANDIDATES.streetName)??'').trim();if(!name)return null;const projected=[];for(const line of lines){const bboxSegments=[];let current=[];for(const point of line){if(pointInsideBbox(point,bbox))current.push(point);else if(current.length){if(current.length>=2)bboxSegments.push(current);current=[];}}if(current.length>=2)bboxSegments.push(current);for(const segment of bboxSegments){for(const clipped of clipLineToPolygon(segment,polygon)){if(clipped.length<2)continue;projected.push(simplifyLine(clipped,tolerance).map(point=>projectPoint(point,bbox,width,height)));}}}if(!projected.length)return null;return{name,lines:projected,sourceId:feature.id??null,streetNumber:pickProperty(feature.properties,DETAILNETZ_PROPERTY_CANDIDATES.streetNumber),fromNode:pickProperty(feature.properties,DETAILNETZ_PROPERTY_CANDIDATES.fromNode),toNode:pickProperty(feature.properties,DETAILNETZ_PROPERTY_CANDIDATES.toNode)};}
export function normalizeAddressFeature(feature,{bbox=INNER_RING_BBOX,polygon=null,width=1600,height=1120}={}){const geometry=feature?.geometry;if(geometry?.type!=='Point'||!pointInsideBbox(geometry.coordinates,bbox)||!pointInsidePolygon(geometry.coordinates,polygon))return null;const properties=feature.properties??{},street=pickProperty(properties,[OFFICIAL_ADDRESS_SCHEMA.street,'str_name','strname','strassenname','strasse','name']),number=pickProperty(properties,[OFFICIAL_ADDRESS_SCHEMA.houseNumber,'hausnummer','hnr','hnummer','nummer']),suffix=pickProperty(properties,[OFFICIAL_ADDRESS_SCHEMA.houseNumberSuffix]),postcode=pickProperty(properties,[OFFICIAL_ADDRESS_SCHEMA.postcode,'plz','postleitzahl']);if(!street||number==null)return null;const[x,y]=projectPoint(geometry.coordinates,bbox,width,height),houseNumber=`${String(number).trim()}${suffix?` ${String(suffix).trim()}`:''}`;return{street:String(street).trim(),houseNumber,postcode:postcode==null?null:String(postcode).trim(),district:pickProperty(properties,[OFFICIAL_ADDRESS_SCHEMA.district]),locality:pickProperty(properties,[OFFICIAL_ADDRESS_SCHEMA.locality]),x,y,sourceId:feature.id??pickProperty(properties,[OFFICIAL_ADDRESS_SCHEMA.id])??null};}
export function stableSortImported(data){data.streets.sort((a,b)=>a.name.localeCompare(b.name,'de')||String(a.sourceId).localeCompare(String(b.sourceId)));data.addresses.sort((a,b)=>a.street.localeCompare(b.street,'de')||a.houseNumber.localeCompare(b.houseNumber,'de',{numeric:true})||String(a.sourceId).localeCompare(String(b.sourceId)));return data;}
