export const MAP_ZOOM_BANDS=Object.freeze(['overview','district','street','detail']);

export function mapZoomBand(zoom){
  const z=Number.isFinite(zoom)?zoom:1;
  if(z<1.2)return'overview';
  if(z<2)return'district';
  if(z<3.35)return'street';
  return'detail';
}

export function mapZoomRank(value){
  const band=MAP_ZOOM_BANDS.includes(value)?value:mapZoomBand(value);
  return MAP_ZOOM_BANDS.indexOf(band);
}

export function mapZoomAtLeast(value,minimum){return mapZoomRank(value)>=mapZoomRank(minimum);}

export const ROAD_MIN_BAND=Object.freeze({
  arterial:'overview',
  bridge:'overview',
  primary:'district',
  secondary:'street',
  local:'detail',
  connector:'detail'
});

export function roadVisibleAtBand(roadClass,band){return mapZoomAtLeast(band,ROAD_MIN_BAND[roadClass]??'street');}
export function screenStableWorldSize(renderer,pixels){return pixels/Math.max(.000001,renderer?.scale??1);}
