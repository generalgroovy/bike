// Presentation-only georeference between the curated Send It game plane and Berlin.
// The four control points are canonical Ringbahn stations. They are public
// geographic coordinates, not Google Maps content. Google Maps is only used as
// the live visual basemap; simulation state remains in deterministic game space.

export const GEO_ANCHORS=Object.freeze([
  {id:'westkreuz',game:{x:150,y:575},geo:{lat:52.5011111,lng:13.2838889}},
  {id:'gesundbrunnen',game:{x:760,y:95},geo:{lat:52.5486111,lng:13.3894444}},
  {id:'ostkreuz',game:{x:1390,y:585},geo:{lat:52.5031111,lng:13.4688889}},
  {id:'suedkreuz',game:{x:760,y:995},geo:{lat:52.4756111,lng:13.3643889}}
]);

function solveLinear(matrix,rhs){
  const n=rhs.length,a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;
    for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    if(Math.abs(a[pivot][col])<1e-12)throw new Error('Degenerate geographic control points');
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const div=a[col][col];for(let j=col;j<=n;j++)a[col][j]/=div;
    for(let row=0;row<n;row++)if(row!==col){const f=a[row][col];if(!f)continue;for(let j=col;j<=n;j++)a[row][j]-=f*a[col][j];}
  }
  return a.map(row=>row[n]);
}

function homography(from,to){
  const m=[],b=[];
  for(let i=0;i<4;i++){
    const x=from[i][0],y=from[i][1],u=to[i][0],v=to[i][1];
    m.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);
    m.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v);
  }
  return solveLinear(m,b);
}
function project(h,x,y){const q=h[6]*x+h[7]*y+1;return{x:(h[0]*x+h[1]*y+h[2])/q,y:(h[3]*x+h[4]*y+h[5])/q};}

const gamePoints=GEO_ANCHORS.map(a=>[a.game.x,a.game.y]);
const geoPoints=GEO_ANCHORS.map(a=>[a.geo.lng,a.geo.lat]);
const gameToGeoH=homography(gamePoints,geoPoints);
const geoToGameH=homography(geoPoints,gamePoints);

export function gameToLatLng(x,y){const p=project(gameToGeoH,x,y);return{lat:p.y,lng:p.x};}
export function latLngToGame(lat,lng){const p=project(geoToGameH,lng,lat);return{x:p.x,y:p.y};}

export function haversineMeters(a,b){
  const r=6371008.8,rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLng=(b.lng-a.lng)*rad,la1=a.lat*rad,la2=b.lat*rad;
  const s=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
  return 2*r*Math.asin(Math.min(1,Math.sqrt(s)));
}
export function metersPerGameUnit(x,y){
  const span=50,a=gameToLatLng(x-span/2,y),b=gameToLatLng(x+span/2,y),c=gameToLatLng(x,y-span/2),d=gameToLatLng(x,y+span/2);
  return (haversineMeters(a,b)+haversineMeters(c,d))/(span*2);
}

const MERCATOR_METERS_PER_PIXEL_Z0=156543.03392804097;
export function googleZoomForScale(scale,x,y){
  const center=gameToLatLng(x,y),metersPerPixel=metersPerGameUnit(x,y)/Math.max(1e-6,scale);
  return Math.log2((MERCATOR_METERS_PER_PIXEL_Z0*Math.cos(center.lat*Math.PI/180))/metersPerPixel);
}
export function scaleForGoogleZoom(zoom,lat,x,y){
  const metersPerPixel=(MERCATOR_METERS_PER_PIXEL_Z0*Math.cos(lat*Math.PI/180))/(2**zoom);
  return metersPerGameUnit(x,y)/Math.max(1e-6,metersPerPixel);
}

export function gameBoundsToGeo(bounds){
  const corners=[gameToLatLng(bounds.x1,bounds.y1),gameToLatLng(bounds.x2,bounds.y1),gameToLatLng(bounds.x2,bounds.y2),gameToLatLng(bounds.x1,bounds.y2)];
  return{north:Math.max(...corners.map(p=>p.lat)),south:Math.min(...corners.map(p=>p.lat)),east:Math.max(...corners.map(p=>p.lng)),west:Math.min(...corners.map(p=>p.lng))};
}
