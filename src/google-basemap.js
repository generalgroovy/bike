import { Game } from './game.js';
import { Renderer } from './render.js';
import { gameBoundsToGeo,gameToLatLng,latLngToGame,scaleForGoogleZoom } from './geo-reference.js';

const root=document.documentElement,mapStage=document.querySelector('.map-stage'),mapHost=document.querySelector('#google-map'),canvas=document.querySelector('#game-canvas'),mapTools=document.querySelector('.map-tools');
const KEY_STORE='sendit.googleMapsApiKey.v1',MODE_STORE='sendit.basemap.v12';
const read=(key,fallback='')=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
const remove=key=>{try{localStorage.removeItem(key);}catch{}};

let map=null,active=false,loading=null,lastGame=null,lastStage=null,syncPending=false,resizeObserver=null;

function announce(message){const notice=document.querySelector('#notice');if(!notice)return;notice.textContent=message;}
function apiKey(){return read(KEY_STORE,'').trim();}
function setApiKey(value){const key=String(value??'').trim();if(key)write(KEY_STORE,key);else remove(KEY_STORE);return key;}

function loadGoogleMaps(key){
  if(window.google?.maps?.importLibrary)return Promise.resolve(window.google.maps);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const callback=`__sendItGoogleMapsReady_${Math.random().toString(36).slice(2)}`;
    const cleanup=()=>{try{delete window[callback];}catch{window[callback]=undefined;}};
    window[callback]=()=>{cleanup();resolve(window.google.maps);};
    const script=document.createElement('script');script.id='sendit-google-maps-loader';script.async=true;script.defer=true;
    script.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${callback}`;
    script.onerror=()=>{cleanup();loading=null;reject(new Error('Google Maps JavaScript API failed to load'));};
    document.head.append(script);
  });
  return loading;
}

function modeButton(){
  let button=document.querySelector('#basemap-toggle');if(button)return button;
  button=document.createElement('button');button.id='basemap-toggle';button.type='button';button.textContent='G';button.title='Google vector basemap (G)';button.setAttribute('aria-label','Toggle Google Maps basemap');button.setAttribute('aria-pressed','false');
  mapTools?.prepend(button);return button;
}
const toggleButton=modeButton();

function zoomBand(zoom){return zoom<12.7?'overview':zoom<14.5?'district':zoom<16.5?'street':'detail';}
function updateModeUi(){
  root.dataset.basemap=active?'google':'game';toggleButton?.setAttribute('aria-pressed',String(active));toggleButton?.classList.toggle('active',active);toggleButton.textContent=active?'G✓':'G';
  if(mapHost)mapHost.hidden=!active;
  if(canvas)canvas.setAttribute('aria-hidden',active?'true':'false');
  if(!active)delete root.dataset.googleZoomBand;
}

function gameEntityAt(x,y){
  const game=Game.lastInstance,r=Renderer.lastInstance;if(!game||!r)return null;
  const threshold=Math.max(6,20/Math.max(.001,r.scale));let best=null,bestDistance=Infinity;
  for(const rider of game.couriers){const d=Math.hypot(rider.x-x,rider.y-y);if(d<threshold&&d<bestDistance){best={type:'rider',id:rider.id};bestDistance=d;}}
  for(const delivery of game.activeDeliveries()){
    const node=game.nodeById(delivery.pickedUp?delivery.dropoffId:delivery.pickupId);if(!node)continue;const d=Math.hypot(node.x-x,node.y-y);if(d<threshold&&d<bestDistance){best={type:'delivery',id:delivery.id};bestDistance=d;}
  }
  return best;
}
function applySelection(entity){
  const game=Game.lastInstance;if(!game)return;
  if(entity?.type==='delivery'){game.selectedDeliveryId=entity.id;game.selectedCourierId=null;}
  else if(entity?.type==='rider'){game.selectedCourierId=entity.id;game.selectedDeliveryId=null;}
  else{game.selectedDeliveryId=null;game.selectedCourierId=null;}
}
function applyHover(entity){const game=Game.lastInstance;if(!game)return;game.hoveredDeliveryId=entity?.type==='delivery'?entity.id:null;game.hoveredCourierId=entity?.type==='rider'?entity.id:null;}

function syncRendererFromMap(){
  syncPending=false;if(!active||!map)return;const r=Renderer.lastInstance;if(!r)return;const c=map.getCenter?.(),zoom=map.getZoom?.();if(!c||!Number.isFinite(zoom))return;
  const lat=c.lat(),lng=c.lng(),gameCenter=latLngToGame(lat,lng),scale=scaleForGoogleZoom(zoom,lat,gameCenter.x,gameCenter.y);
  r.fitScale=r.computeFitScale();r.scale=scale;r.zoom=scale/Math.max(1e-6,r.fitScale);r.offsetX=r.viewWidth/2-gameCenter.x*scale;r.offsetY=r.viewHeight/2-gameCenter.y*scale;r.frameWorldBounds=r.visibleWorldBounds(90);
  root.dataset.googleZoomBand=zoomBand(zoom);const label=document.querySelector('#zoom-label');if(label)label.textContent=`Z${zoom.toFixed(1)}`;
}
function requestSync(){if(syncPending)return;syncPending=true;requestAnimationFrame(syncRendererFromMap);}

function fitPlayable(){
  const game=Game.lastInstance;if(!map||!game)return;const bounds=gameBoundsToGeo(game.playableBounds());map.fitBounds(bounds,34);lastGame=game;lastStage=game.cityLevel;requestSync();
}
function moveZoom(delta){if(!map)return;const z=map.getZoom?.();if(Number.isFinite(z))map.moveCamera({zoom:Math.max(11,Math.min(19,z+delta))});}

async function createMap(key){
  const maps=await loadGoogleMaps(key);const {Map,RenderingType}=await maps.importLibrary('maps');
  if(map)return map;
  map=new Map(mapHost,{
    center:gameToLatLng(770,520),zoom:12.4,renderingType:RenderingType.VECTOR,mapTypeId:'roadmap',
    disableDefaultUI:true,clickableIcons:false,gestureHandling:'greedy',keyboardShortcuts:false,
    heading:0,tilt:0,minZoom:11,maxZoom:19,
    restriction:{latLngBounds:{north:52.575,south:52.445,west:13.225,east:13.515},strictBounds:false},
    backgroundColor:'#ece5d7',draggableCursor:'grab',draggingCursor:'grabbing'
  });
  map.addListener('bounds_changed',requestSync);
  map.addListener('click',event=>{if(!event.latLng)return;const p=latLngToGame(event.latLng.lat(),event.latLng.lng());applySelection(gameEntityAt(p.x,p.y));});
  map.addListener('mousemove',event=>{if(!event.latLng)return;const p=latLngToGame(event.latLng.lat(),event.latLng.lng());applyHover(gameEntityAt(p.x,p.y));});
  map.addListener('mouseout',()=>applyHover(null));
  resizeObserver=new ResizeObserver(()=>requestSync());if(mapStage)resizeObserver.observe(mapStage);
  return map;
}

async function enableGoogle({promptForKey=true}={}){
  let key=apiKey();
  if(!key&&promptForKey){
    key=window.prompt('Google Maps JavaScript API key\n\nThe key is stored only in this browser. Restrict it in Google Cloud to https://generalgroovy.github.io/* (or this site origin) and to Maps JavaScript API.','')?.trim()??'';
    if(key)setApiKey(key);
  }
  if(!key){announce('GOOGLE MAP · add a restricted Maps JavaScript API key to enable');return false;}
  try{await createMap(key);active=true;write(MODE_STORE,'google');updateModeUi();fitPlayable();announce('GOOGLE MAP · exact live basemap active · game simulation remains deterministic');return true;}
  catch(error){active=false;write(MODE_STORE,'game');updateModeUi();announce(`GOOGLE MAP unavailable · ${error.message}`);return false;}
}
function disableGoogle(){active=false;write(MODE_STORE,'game');updateModeUi();applyHover(null);const r=Renderer.lastInstance;if(r){r.fitPlayable();const label=document.querySelector('#zoom-label');if(label)label.textContent=`${Math.round(r.zoom*100)}%`;}}
async function toggle(){if(active)disableGoogle();else await enableGoogle();}

function interceptMapButton(id,action){const el=document.querySelector(id);if(!el)return;el.addEventListener('click',event=>{if(!active)return;event.preventDefault();event.stopImmediatePropagation();action();},{capture:true});}
interceptMapButton('#zoom-in',()=>moveZoom(.7));interceptMapButton('#zoom-out',()=>moveZoom(-.7));interceptMapButton('#zoom-reset',fitPlayable);
toggleButton?.addEventListener('click',toggle);
document.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey)return;const tag=event.target?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
  if(event.key==='g'||event.key==='G'){event.preventDefault();event.stopImmediatePropagation();toggle();return;}
  if(!active)return;
  if(event.key==='0'){event.preventDefault();event.stopImmediatePropagation();fitPlayable();}
  else if(event.key==='+'||event.key==='='){event.preventDefault();event.stopImmediatePropagation();moveZoom(.7);}
  else if(event.key==='-'||event.key==='_'){event.preventDefault();event.stopImmediatePropagation();moveZoom(-.7);}
},{capture:true});

function lifecycleTick(){
  if(active&&map){const game=Game.lastInstance;if(game&&(game!==lastGame||game.cityLevel!==lastStage))fitPlayable();requestSync();}
  requestAnimationFrame(lifecycleTick);
}
requestAnimationFrame(lifecycleTick);

updateModeUi();
if(read(MODE_STORE,'game')==='google'&&apiKey())enableGoogle({promptForKey:false});

window.__sendItGoogleBasemap={enable:enableGoogle,disable:disableGoogle,toggle,setApiKey,clearApiKey:()=>setApiKey(''),isActive:()=>active,fit:fitPlayable};
