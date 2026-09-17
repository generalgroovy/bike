export const RIDER_IDENTITIES=Object.freeze({
  Kira:Object.freeze({asset:'assets/riders/kira.svg',color:'#378eb8',alt:'Kira courier portrait'}),
  Mauro:Object.freeze({asset:'assets/riders/mauro.svg',color:'#d65c70',alt:'Mauro courier portrait'}),
  Brian:Object.freeze({asset:'assets/riders/brian.svg',color:'#76a64e',alt:'Brian courier portrait'}),
  Sam:Object.freeze({asset:'assets/riders/sam.svg',color:'#d9a233',alt:'Sam courier portrait'}),
  Michail:Object.freeze({asset:'assets/riders/michail.svg',color:'#806cc2',alt:'Michail courier portrait'}),
  Zorro:Object.freeze({asset:'assets/riders/zorro.svg',color:'#d56f43',alt:'Zorro courier portrait'})
});

const imageCache=new Map();

export function riderIdentity(value){
  const name=typeof value==='string'?value:value?.name;
  return RIDER_IDENTITIES[name]??null;
}

export function riderPortraitUrl(value){
  const identity=riderIdentity(value);
  return identity?`./${identity.asset}`:null;
}

export function createRiderPortraitElement(value,{className='rider-portrait'}={}){
  if(typeof document==='undefined')return null;
  const identity=riderIdentity(value),name=typeof value==='string'?value:value?.name;
  const img=document.createElement('img');
  img.className=className;
  img.width=48;img.height=48;
  img.decoding='async';img.loading='eager';img.draggable=false;
  img.alt=identity?.alt??`${name??'Courier'} portrait`;
  if(identity)img.src=`./${identity.asset}`;
  if(identity?.color)img.style.setProperty('--rider-color',identity.color);
  img.dataset.riderPortrait=name??'unknown';
  return img;
}

export function riderPortraitImage(value){
  if(typeof Image==='undefined')return null;
  const identity=riderIdentity(value);if(!identity)return null;
  let image=imageCache.get(identity.asset);
  if(!image){image=new Image();image.decoding='async';image.src=`./${identity.asset}`;imageCache.set(identity.asset,image);}
  return image;
}

export function preloadRiderPortraits(){
  for(const name of Object.keys(RIDER_IDENTITIES))riderPortraitImage(name);
}

export function portraitReady(image){return Boolean(image?.complete&&image.naturalWidth>0&&image.naturalHeight>0);}
