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

export function drawBikeIcon(ctx,value,x,y,size,color=null,motion=null){
  if(!ctx)return;
  const visual=bikeVisual(value),Path=globalThis.Path2D;
  ctx.save();ctx.translate(x,y);if(motion?.faceLeft)ctx.scale(-1,1);ctx.translate(-size/2,-size*13/40);ctx.scale(size/40,size/40);
  ctx.strokeStyle=color??value?.color??'#303c43';ctx.lineWidth=1.9;ctx.lineCap='round';ctx.lineJoin='round';
  if(Path){let path=paths.get(visual.id);if(!path){path=new Path(visual.path);paths.set(visual.id,path);}ctx.stroke(path);}
  else{for(const wheel of[10,30]){ctx.beginPath();ctx.arc(wheel,18,5,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(10,18);ctx.lineTo(17,7);ctx.lineTo(22,18);ctx.lineTo(10,18);ctx.moveTo(17,7);ctx.lineTo(26,7);ctx.lineTo(30,18);ctx.stroke();}
  if(motion){
    const cargo=visual.id==='cargo',wheels=cargo?[6,33]:[10,30],wheelY=cargo?19:18,wheelRadius=cargo?3.3:4.2;
    ctx.lineWidth=.85;ctx.globalAlpha=.52;
    for(const wheel of wheels){for(let spoke=0;spoke<3;spoke++){const angle=motion.wheelAngle+spoke*Math.PI/3,dx=Math.cos(angle)*wheelRadius,dy=Math.sin(angle)*wheelRadius;ctx.beginPath();ctx.moveTo(wheel-dx,wheelY-dy);ctx.lineTo(wheel+dx,wheelY+dy);ctx.stroke();}}
    ctx.globalAlpha=1;ctx.lineWidth=1.3;
    const crankX=cargo?18:20,crankY=cargo?19:18,dx=Math.cos(motion.pedalAngle)*2.6,dy=Math.sin(motion.pedalAngle)*2.6;
    ctx.beginPath();ctx.moveTo(crankX-dx,crankY-dy);ctx.lineTo(crankX+dx,crankY+dy);ctx.stroke();
    for(const sign of[-1,1]){ctx.beginPath();ctx.moveTo(crankX+sign*dx-1.4,crankY+sign*dy);ctx.lineTo(crankX+sign*dx+1.4,crankY+sign*dy);ctx.stroke();}
    // A tiny rider silhouette keeps these as bicycles in motion, not glowing dots.
    const lean=visual.id==='road'?3:visual.id==='cargo'?1:0,hipX=cargo?12:16,headX=hipX+3+lean;
    ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(hipX,7);ctx.lineTo(headX-1,2);ctx.lineTo(cargo?20:26,5);ctx.stroke();
    ctx.beginPath();ctx.arc(headX,-.3,1.7,0,Math.PI*2);ctx.fillStyle=ctx.strokeStyle;ctx.fill();
    ctx.beginPath();ctx.moveTo(hipX,7);ctx.lineTo(hipX+4,11);ctx.lineTo(crankX+dx,crankY+dy);ctx.stroke();
  }
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
