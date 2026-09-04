import { Camera } from './camera.js';
import { drawBackdrop,drawMap } from './render-map.js';
import { drawEntities } from './render-entities.js';
export class Renderer extends Camera{
  static lastInstance=null;
  constructor(canvas,game){super(canvas,game);this.ctx=canvas.getContext('2d');this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.riderTrails=new Map();Renderer.lastInstance=this;}
  resize(reset=false){super.resize(reset);if(this.ctx)this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);}
  sampleRiderTrails(){const t=typeof performance!=='undefined'?performance.now()/1000:0,active=new Set(this.game.couriers.map(c=>c.id));for(const rider of this.game.couriers){let trail=this.riderTrails.get(rider.id);if(!trail){trail=[];this.riderTrails.set(rider.id,trail);}const last=trail.at(-1),moved=!last||Math.hypot(rider.x-last.x,rider.y-last.y)>.7;if(moved&&(!last||t-last.t>.045))trail.push({x:rider.x,y:rider.y,t,phase:rider.phase});while(trail.length>22||trail[0]&&t-trail[0].t>1.25)trail.shift();}for(const id of this.riderTrails.keys())if(!active.has(id))this.riderTrails.delete(id);}
  draw(){this.sampleRiderTrails();const c=this.ctx;c.clearRect(0,0,this.viewWidth,this.viewHeight);drawBackdrop(this);c.save();c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);drawMap(this);drawEntities(this);c.restore();}
}