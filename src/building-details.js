// Lazy, bounded presentation cache. This module never receives a mutable game.
export class BuildingDetails {
  constructor(cityId,signal,onChange=()=>{}){this.cityId=cityId;this.signal=signal;this.onChange=onChange;this.index=null;this.indexPending=false;this.cache=new Map();this.pending=new Set();this.failures=new Map();this.queue=[];this.revision=0;this.state='idle';this.maxTiles=48;this.disposed=false;signal?.addEventListener('abort',()=>{this.disposed=true;this.cache.clear();this.queue=[];},{once:true});}
  async loadIndex(){if(this.indexPending||this.index||this.state==='unavailable')return;this.indexPending=true;this.state='loading';
    try{const response=await fetch(new URL('../generated/berlin-buildings/index.json',import.meta.url),{signal:this.signal});if(!response.ok)throw new Error('index');const value=await response.json();if(value.schema!==1||value.city!==this.cityId||!Array.isArray(value.tiles))throw new Error('city');if(this.disposed)return;this.index=value;this.state='ready';}
    catch{if(!this.disposed)this.state='unavailable';}finally{this.indexPending=false;if(!this.disposed){this.revision++;this.onChange();}}
  }
  visible(bounds,scale){
    if(this.disposed||scale<2)return[];
    if(!this.index){this.loadIndex();return[];}
    const tiles=this.index.tiles.filter(t=>{const b=t.bounds;return b[0]<=bounds.x2&&b[2]>=bounds.x1&&b[1]<=bounds.y2&&b[3]>=bounds.y1;});
    const x=(bounds.x1+bounds.x2)/2,y=(bounds.y1+bounds.y2)/2;
    tiles.sort((a,b)=>Math.hypot((a.bounds[0]+a.bounds[2])/2-x,(a.bounds[1]+a.bounds[3])/2-y)-Math.hypot((b.bounds[0]+b.bounds[2])/2-x,(b.bounds[1]+b.bounds[3])/2-y));
    this.wanted=new Set(tiles.slice(0,this.maxTiles).map(t=>t.file));
    this.queue=tiles.slice(0,this.maxTiles).filter(t=>!this.cache.has(t.file)&&!this.pending.has(t.file)&&performance.now()>(this.failures.get(t.file)??-Infinity)+15000);
    this.pump();
    const result=[];for(const t of tiles){const path=this.cache.get(t.file);if(path){this.cache.delete(t.file);this.cache.set(t.file,path);result.push(path);}}
    return result;
  }
  pump(){while(!this.disposed&&this.pending.size<2&&this.queue.length){const tile=this.queue.shift();this.pending.add(tile.file);this.loadTile(tile);}}
  async loadTile(tile){
    try{const compressed=typeof DecompressionStream!=='undefined',url=new URL(`../generated/berlin-buildings/${tile.file}${compressed?'.gz':''}`,import.meta.url);
      const response=await fetch(url,{signal:this.signal});if(!response.ok)throw new Error('tile');
      const value=await(compressed?new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json():response.json());if(this.disposed)return;
      const path=new Path2D();for(const poly of value.polygons)for(let ri=0;ri<poly.length;ri++){
        const ring=poly[ri];if(!ring.length)continue;
        const area=ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
        const points=(ri===0?area<0:area>0)?ring.slice().reverse():ring;
        path.moveTo(...points[0]);for(let i=1;i<points.length;i++)path.lineTo(...points[i]);path.closePath();
      }
      if(this.wanted?.has(tile.file)){this.cache.set(tile.file,path);while(this.cache.size>this.maxTiles)this.cache.delete(this.cache.keys().next().value);}
      this.failures.delete(tile.file);
    }catch{if(!this.disposed)this.failures.set(tile.file,performance.now());}
    finally{this.pending.delete(tile.file);if(!this.disposed){this.revision++;this.onChange();this.pump();}}
  }
  status(scale){if(scale<2)return'Zoom in for official building footprints';if(this.state==='unavailable'||[...this.failures.keys()].some(key=>this.wanted?.has(key)))return'Building detail unavailable · street routes remain usable';if(!this.index||this.pending.size)return'Loading official building detail…';return'Official building footprints · Berlin ALKIS';}
}
