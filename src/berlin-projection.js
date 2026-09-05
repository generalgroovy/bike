// Send It v13 canonical Berlin projection.
//
// Official data arrives in WGS84. Runtime simulation/rendering remains in the
// established 1600×1120 game plane, but the transform is now derived from a
// documented Berlin-local metric plane rather than presentation anchors.
// The local plane uses an equirectangular tangent approximation around central
// Berlin. At Ringbahn scale its distortion is small, deterministic and easy to
// round-trip without a projection library or runtime network dependency.

export const BERLIN_GEO_BOUNDS=Object.freeze([13.27,52.45,13.51,52.57]);
export const BERLIN_GAME_SIZE=Object.freeze({width:1600,height:1120});
export const BERLIN_REFERENCE=Object.freeze({lon:13.405,lat:52.52});
export const BERLIN_PROJECTION_ID='sendit-berlin-local-metric-v1';

const EARTH_RADIUS=6378137;
const DEG=Math.PI/180;
const COS_REF=Math.cos(BERLIN_REFERENCE.lat*DEG);

export function lonLatToLocalMeters(lon,lat){
  return{
    x:EARTH_RADIUS*(lon-BERLIN_REFERENCE.lon)*DEG*COS_REF,
    y:EARTH_RADIUS*(lat-BERLIN_REFERENCE.lat)*DEG
  };
}

export function localMetersToLonLat(x,y){
  return{
    lon:BERLIN_REFERENCE.lon+x/(EARTH_RADIUS*DEG*COS_REF),
    lat:BERLIN_REFERENCE.lat+y/(EARTH_RADIUS*DEG)
  };
}

function metricBounds(bbox=BERLIN_GEO_BOUNDS){
  const sw=lonLatToLocalMeters(bbox[0],bbox[1]);
  const ne=lonLatToLocalMeters(bbox[2],bbox[3]);
  return{x1:sw.x,y1:sw.y,x2:ne.x,y2:ne.y};
}

export function lonLatToGame(lon,lat,{bbox=BERLIN_GEO_BOUNDS,width=BERLIN_GAME_SIZE.width,height=BERLIN_GAME_SIZE.height}={}){
  const p=lonLatToLocalMeters(lon,lat),b=metricBounds(bbox);
  const x=(p.x-b.x1)/(b.x2-b.x1)*width;
  const y=height-(p.y-b.y1)/(b.y2-b.y1)*height;
  return[x,y];
}

export function gameToLonLat(x,y,{bbox=BERLIN_GEO_BOUNDS,width=BERLIN_GAME_SIZE.width,height=BERLIN_GAME_SIZE.height}={}){
  const b=metricBounds(bbox);
  const mx=b.x1+(x/width)*(b.x2-b.x1);
  const my=b.y1+((height-y)/height)*(b.y2-b.y1);
  return localMetersToLonLat(mx,my);
}

export function gameUnitsPerMeter({bbox=BERLIN_GEO_BOUNDS,width=BERLIN_GAME_SIZE.width,height=BERLIN_GAME_SIZE.height}={}){
  const b=metricBounds(bbox);
  return{x:width/(b.x2-b.x1),y:height/(b.y2-b.y1)};
}

export function projectionRoundTripError(lon,lat,options){
  const[x,y]=lonLatToGame(lon,lat,options),p=gameToLonLat(x,y,options);
  const meters=lonLatToLocalMeters(p.lon,p.lat),source=lonLatToLocalMeters(lon,lat);
  return Math.hypot(meters.x-source.x,meters.y-source.y);
}

export function projectionMetadata(){
  const units=gameUnitsPerMeter();
  return{
    id:BERLIN_PROJECTION_ID,
    reference:{...BERLIN_REFERENCE},
    bbox:[...BERLIN_GEO_BOUNDS],
    gameSize:{...BERLIN_GAME_SIZE},
    gameUnitsPerMeter:{x:units.x,y:units.y},
    runtimeNetworkRequired:false
  };
}
