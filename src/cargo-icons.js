export const CARGO_VISUALS=Object.freeze({
  food:Object.freeze({label:'Food',color:'#d96558',path:'M6 8h12l-1 12H7L6 8 M9 8V6a3 3 0 0 1 6 0v2 M10 12v5 M13 12v5 M16 12v5'}),
  parcel:Object.freeze({label:'Parcel',color:'#c88b32',path:'M4 7l8-4 8 4v10l-8 4-8-4V7 M4 7l8 4 8-4 M12 11v10 M8 5l8 4'}),
  document:Object.freeze({label:'Documents',color:'#359da4',path:'M6 3h9l3 3v15H6V3 M15 3v4h4 M9 11h6 M9 15h6 M9 18h4'}),
  grocery:Object.freeze({label:'Grocery',color:'#6f9f4c',path:'M5 9h14l-2 10H7L5 9 M8 9l2-5 M16 9l-2-5 M9 13v3 M12 13v3 M15 13v3'}),
  fragile:Object.freeze({label:'Fragile',color:'#9566b5',path:'M8 3h8l-1 6a3 3 0 0 1-2 2v6h3v2H8v-2h3v-6a3 3 0 0 1-2-2L8 3 M10 7l2 2 2-3'}),
  flowers:Object.freeze({label:'Flowers',color:'#c45d94',path:'M12 10c-4 0-4-5-1-5 0-4 5-4 5-1 4 0 4 5 1 5 0 4-5 4-5 1 M12 10v11 M12 15c-3-3-6-1-6 2 3 0 5 1 6 3 M12 16c3-3 6-1 6 2-3 0-5 1-6 3'}),
  keys:Object.freeze({label:'Keys',color:'#667fb0',path:'M9 14a5 5 0 1 1 3-4l8 0v3h-2v2h-3v-2h-3a5 5 0 0 1-3 1 M6 9h.01'}),
  medical:Object.freeze({label:'Medical',color:'#d54862',path:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3'}),
  catering:Object.freeze({label:'Catering',color:'#bd6b34',path:'M4 16h16 M6 16a6 6 0 0 1 12 0 M12 8V5 M10 5h4 M4 19h16'}),
  coldchain:Object.freeze({label:'Cold-chain',color:'#4198c0',path:'M12 2v20 M4 6l16 12 M20 6L4 18 M9 4l3 3 3-3 M9 20l3-3 3 3 M5 9l4 1-1-4 M19 15l-4-1 1 4 M19 9l-4 1 1-4 M5 15l4-1-1 4'})
});

const SVG_NS='http://www.w3.org/2000/svg';
const pathCache=new Map();

export function cargoVisual(type){return CARGO_VISUALS[type]??CARGO_VISUALS.parcel;}

export function createCargoIconElement(type,{className='cargo-icon',title=null}={}){
  if(typeof document==='undefined')return null;
  const visual=cargoVisual(type),svg=document.createElementNS(SVG_NS,'svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden',title?'false':'true');svg.setAttribute('focusable','false');svg.classList.add(className);svg.style.color=visual.color;
  if(title){const titleEl=document.createElementNS(SVG_NS,'title');titleEl.textContent=title;svg.append(titleEl);}
  const path=document.createElementNS(SVG_NS,'path');path.setAttribute('d',visual.path);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.append(path);return svg;
}

export function drawCargoIcon(ctx,type,x,y,size,color=null){
  const visual=cargoVisual(type);if(!ctx)return;
  const Path=globalThis.Path2D;
  ctx.save();ctx.translate(x-size/2,y-size/2);ctx.scale(size/24,size/24);ctx.strokeStyle=color??visual.color;ctx.fillStyle='none';ctx.lineWidth=1.9;ctx.lineCap='round';ctx.lineJoin='round';
  if(Path){let path=pathCache.get(type);if(!path){path=new Path(visual.path);pathCache.set(type,path);}ctx.stroke(path);}else{ctx.strokeRect(5,5,14,14);ctx.font='700 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color??visual.color;ctx.fillText(visual.label.slice(0,1),12,12);}
  ctx.restore();
}
