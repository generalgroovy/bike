import { Camera } from './camera.js';
import { drawBackdrop,drawMap } from './render-map.js';
import { drawEntities } from './render-entities.js';
import { loadBerlinRuntime } from './berlin-runtime.js';
import { mapZoomBand } from './map-zoom.js';

function prepareEdges(game){
  const edges=[];
  for(const e of game.visualEdges){
    const a=game.nodeById(e.a),b=game.nodeById(e.b);
    if(!a||!b)continue;
    edges.push({e,a,b,len:Math.hypot(a.x-b.x,a.y-b.y),x1:Math.min(a.x,b.x),y1:Math.min(a.y,b.y),x2:Math.max(a.x,b.x),y2:Math.max(a.y,b.y)});
  }
  return edges;
}

function prepareLabelGroups(edges){
  const groups=new Map();
  for(const entry of edges){
    if(entry.e.roadClass==='connector'||!entry.e.streetName)continue;
    let group=groups.get(entry.e.streetName);
    if(!group){group=[];groups.set(entry.e.streetName,group);}
    group.push(entry);
  }
  for(const group of groups.values())group.sort((a,b)=>b.len-a.len);
  return[...groups.values()];
}

export class Renderer extends Camera{
  static lastInstance=null;
  constructor(canvas,game){
    super(canvas,game);
    this.ctx=canvas.getContext('2d');
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.riderTrails=new Map();
    this.renderEdges=prepareEdges(game);
    this.streetLabelGroups=prepareLabelGroups(this.renderEdges);
    this.frameWorldBounds=this.visibleWorldBounds(80);
    this.lastDrawAt=-Infinity;
    this.renderStats={frames:0,culledEdges:0,drawnEdges:0};
    this.mapBand=mapZoomBand(this.zoom);
    this.berlinRuntime=null;
    this.berlinRuntimeState='loading';
    this.berlinVisible=[];
    this.disposed=false;
    this.runtimeAbort=new AbortController();
    Renderer.lastInstance=this;
    this.updateMapSource();
    loadBerlinRuntime(undefined,{signal:this.runtimeAbort.signal})
      .then(asset=>{if(this.disposed)return;this.berlinRuntime=asset;this.berlinRuntimeState='ready';this.updateMapSource();this.draw(true);})
      .catch(()=>{if(this.disposed)return;this.berlinRuntimeState='fallback';this.updateMapSource();});
  }
  dispose(){this.disposed=true;this.runtimeAbort?.abort();}
  updateMapSource(){
    if(this.disposed)return;
    const label=typeof document!=='undefined'?document.getElementById('map-source'):null;
    if(!label)return;
    label.dataset.state=this.berlinRuntimeState;
    label.textContent=this.berlinRuntimeState==='ready'?'NATIVE · LOCAL DATA':this.berlinRuntimeState==='loading'?'NATIVE · LOADING DETAIL':'NATIVE · CURATED MAP';
    label.title=this.berlinRuntimeState==='ready'?'Local street detail. Rider routes still use the curated deterministic game graph.':'The detailed Berlin asset is unavailable or loading. The bundled curated map remains fully playable without an API key.';
  }
  resize(reset=false){
    super.resize(reset);
    if(this.ctx)this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    this.mapBand=mapZoomBand(this.zoom);
  }
  sampleRiderTrails(){
    const t=typeof performance!=='undefined'?performance.now()/1000:0,active=new Set(this.game.couriers.map(c=>c.id));
    for(const rider of this.game.couriers){
      let trail=this.riderTrails.get(rider.id);
      if(!trail){trail=[];this.riderTrails.set(rider.id,trail);}
      const last=trail.at(-1),moved=!last||Math.hypot(rider.x-last.x,rider.y-last.y)>.7;
      if(moved&&(!last||t-last.t>.045))trail.push({x:rider.x,y:rider.y,t,phase:rider.phase});
      while(trail.length>22||trail[0]&&t-trail[0].t>1.25)trail.shift();
    }
    for(const id of this.riderTrails.keys())if(!active.has(id))this.riderTrails.delete(id);
  }
  draw(force=false){
    if(this.disposed)return false;
    const t=typeof performance!=='undefined'?performance.now():Date.now(),minInterval=this.game.paused?50:0;
    if(!force&&t-this.lastDrawAt<minInterval)return false;
    this.lastDrawAt=t;
    this.sampleRiderTrails();
    this.mapBand=mapZoomBand(this.zoom);
    this.frameWorldBounds=this.visibleWorldBounds(90);
    this.renderStats.frames+=1;
    this.renderStats.culledEdges=0;
    this.renderStats.drawnEdges=0;
    const c=this.ctx;
    c.clearRect(0,0,this.viewWidth,this.viewHeight);
    drawBackdrop(this);
    c.save();
    c.translate(this.offsetX,this.offsetY);
    c.scale(this.scale,this.scale);
    drawMap(this);
    drawEntities(this);
    c.restore();
    return true;
  }
}
