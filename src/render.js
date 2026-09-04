import { Camera } from './camera.js';
import { drawBackdrop,drawMap } from './render-map.js';
import { drawEntities } from './render-entities.js';
export class Renderer extends Camera{
  static lastInstance=null;
  constructor(canvas,game){super(canvas,game);this.ctx=canvas.getContext('2d');this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);Renderer.lastInstance=this;}
  resize(reset=false){super.resize(reset);if(this.ctx)this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);}
  draw(){const c=this.ctx;c.clearRect(0,0,this.viewWidth,this.viewHeight);drawBackdrop(this);c.save();c.translate(this.offsetX,this.offsetY);c.scale(this.scale,this.scale);drawMap(this);drawEntities(this);c.restore();}
}