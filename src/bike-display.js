// One silhouette for each bicycle, shared by the map and rider cards.
export const BIKE_VISUALS=Object.freeze({
  road:Object.freeze({id:'road',label:'Road bike',short:'Road',path:'M5 18a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M25 18a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M10 18l7-11 5 11H10 M17 7l-2-3 M16 7h10l4 11 M24 3h6c3 0 3 4 0 4 M13 4h6'}),
  city:Object.freeze({id:'city',label:'City bike',short:'City',path:'M5 18a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M25 18a5 5 0 1 0 10 0 5 5 0 1 0-10 0 M10 18l7-11-2-3 M17 7l3 11h-10 M20 18l7-10 M30 18l-5-15h5 M13 4h6 M4 10h9 M4 10v3 M27 6h8l-1 5h-5'}),
  cargo:Object.freeze({id:'cargo',label:'Cargo bike',short:'Cargo',path:'M2 19a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M29 19a4 4 0 1 0 8 0 4 4 0 1 0-8 0 M6 19l6-12 6 12H6 M12 7h8l3 12h10 M20 3l3 16 M9 4h6 M18 3h5 M24 7h13l-2 9H26z M27 7V5h7v2'})
});

const SVG_NS='http://www.w3.org/2000/svg';
const paths=new Map();
const finite=(value,fallback)=>Number.isFinite(value)?value:fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function bikeVisual(value){const id=typeof value==='string'?value:value?.bikeType;return BIKE_VISUALS[id]??BIKE_VISUALS.city;}

export function createBikeIconElement(value,{className='bike-icon',title=null}={}){
  if(typeof document==='undefined')return null;
  const visual=bikeVisual(value),svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('viewBox','0 0 40 26');svg.setAttribute('width','40');svg.setAttribute('height','26');
  svg.setAttribute('class',String(className).trim());svg.setAttribute('focusable','false');
  svg.setAttribute('aria-hidden',title?'false':'true');
  if(title){svg.setAttribute('role','img');svg.setAttribute('aria-label',title);const text=document.createElementNS(SVG_NS,'title');text.textContent=title;svg.append(text);}
  if(typeof value==='object'&&value?.color)svg.style.color=value.color;
  svg.dataset.bikeType=visual.id;
  const path=document.createElementNS(SVG_NS,'path');path.setAttribute('d',visual.path);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);
  return svg;
}

export function drawBikeIcon(ctx,value,x,y,size,color=null){
  if(!ctx)return;
  const visual=bikeVisual(value),Path=globalThis.Path2D;
  ctx.save();ctx.translate(x-size/2,y-size*13/40);ctx.scale(size/40,size/40);
  ctx.strokeStyle=color??value?.color??'#303c43';ctx.lineWidth=1.9;ctx.lineCap='round';ctx.lineJoin='round';
  if(Path){let path=paths.get(visual.id);if(!path){path=new Path(visual.path);paths.set(visual.id,path);}ctx.stroke(path);}
  else{for(const wheel of[10,30]){ctx.beginPath();ctx.arc(wheel,18,5,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(10,18);ctx.lineTo(17,7);ctx.lineTo(22,18);ctx.lineTo(10,18);ctx.moveTo(17,7);ctx.lineTo(26,7);ctx.lineTo(30,18);ctx.stroke();}
  ctx.restore();
}

export function riderEndurance(rider){
  const max=Math.max(1,finite(rider?.enduranceMax,100)),ratio=1-clamp(finite(rider?.fatigue,0),0,1);
  return{current:Math.round(ratio*max),max,ratio};
}

export function riderLoad(game,rider){
  const jobs=(game?.deliveries??[]).filter(d=>d.courierId===rider?.id&&d.status==='claimed');
  const currentKg=jobs.filter(d=>d.pickedUp).reduce((sum,d)=>sum+Math.max(0,finite(d.weightKg,0)),0);
  const capacityKg=Math.max(0,finite(rider?.capacityKg,0));
  return{currentKg:Math.round(currentKg*100)/100,capacityKg,ratio:capacityKg>0?clamp(currentKg/capacityKg,0,1):0,jobs};
}
