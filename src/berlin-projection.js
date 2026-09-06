// Send It v13 canonical Berlin projection.
//
// Official data arrives in WGS84. Runtime simulation/rendering remains in the
// established 1600×1120 game plane, but the transform is derived from one
// Berlin-local metric plane rather than presentation anchors. A single uniform
// meters→game scale is used on both axes, so street angles, lengths and spacing
// are not stretched merely to fill the frame.

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

export function projectionFrame({bbox=BERLIN_GEO_BOUNDS,width=BERLIN_GAME_SIZE.width,height=BERLIN_GAME_SIZE.height}={}){
  const b=metricBounds(bbox),metricWidth=b.x2-b.x1,metricHeight=b.y2-b.y1;
  const gameUnitsPerMeter=Math.min(width/metricWidth,height/metricHeight);
  const usedWidth=metricWidth*gameUnitsPerMeter,usedHeight=metricHeight*gameUnitsPerMeter;
  return{bounds:b,scale:gameUnitsPerMeter,offsetX:(width-usedWidth)/2,offsetY:(height-usedHeight)/2,width,height,usedWidth,usedHeight};
}

export function lonLatToGame(lon,lat,options={}){
  const p=lonLatToLocalMeters(lon,lat),f=projectionFrame(options);
  return[
    f.offsetX+(p.x-f.bounds.x1)*f.scale,
    f.offsetY+f.usedHeight-(p.y-f.bounds.y1)*f.scale
  ];
}

export function gameToLonLat(x,y,options={}){
  const f=projectionFrame(options);
  const mx=f.bounds.x1+(x-f.offsetX)/f.scale;
  const my=f.bounds.y1+(f.offsetY+f.usedHeight-y)/f.scale;
  return localMetersToLonLat(mx,my);
}

export function gameUnitsPerMeter(options={}){return projectionFrame(options).scale;}
export function metersPerGameUnit(options={}){return 1/projectionFrame(options).scale;}

export function projectionRoundTripError(lon,lat,options){
  const[x,y]=lonLatToGame(lon,lat,options),p=gameToLonLat(x,y,options);
  const meters=lonLatToLocalMeters(p.lon,p.lat),source=lonLatToLocalMeters(lon,lat);
  return Math.hypot(meters.x-source.x,meters.y-source.y);
}

export function projectionMetadata(){
  const frame=projectionFrame();
  return{
    id:BERLIN_PROJECTION_ID,
    reference:{...BERLIN_REFERENCE},
    bbox:[...BERLIN_GEO_BOUNDS],
    gameSize:{...BERLIN_GAME_SIZE},
    gameUnitsPerMeter:frame.scale,
    metersPerGameUnit:1/frame.scale,
    frame:{offsetX:frame.offsetX,offsetY:frame.offsetY,usedWidth:frame.usedWidth,usedHeight:frame.usedHeight},
    runtimeNetworkRequired:false
  };
}
