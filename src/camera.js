const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

export class Camera{
  constructor(canvas,game){this.canvas=canvas;this.game=game;this.dpr=Math.min(2,window.devicePixelRatio||1);this.zoom=1;this.fitScale=1;this.scale=1;this.offsetX=0;this.offsetY=0;this.viewWidth=0;this.viewHeight=0;this.stageLevel=game.cityLevel??1;this.resize(true);}
  activeBounds(){return this.game.playableBounds?.()??{x1:0,y1:0,x2:this.game.width,y2:this.game.height};}
  resize(reset=false){const old=!reset&&this.viewWidth?this.screenToWorld(this.viewWidth/2,this.viewHeight/2):null,rect=this.canvas.getBoundingClientRect(),w=Math.max(320,rect.width),h=Math.max(360,rect.height);this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);this.viewWidth=w;this.viewHeight=h;if(reset||!old)this.fitPlayable();else{this.fitScale=this.computeFitScale();this.scale=this.fitScale*this.zoom;this.offsetX=w/2-old.x*this.scale;this.offsetY=h/2-old.y*this.scale;this.clampView();}}
  computeFitScale(){const b=this.activeBounds(),bw=Math.max(1,b.x2-b.x1),bh=Math.max(1,b.y2-b.y1);return Math.min((this.viewWidth-42)/bw,(this.viewHeight-42)/bh);}
  fitPlayable(){const b=this.activeBounds();this.stageLevel=this.game.cityLevel??1;this.fitScale=this.computeFitScale();this.zoom=1;this.scale=this.fitScale;this.offsetX=(this.viewWidth-(b.x1+b.x2)*this.scale)/2;this.offsetY=(this.viewHeight-(b.y1+b.y2)*this.scale)/2;this.clampView();}
  syncPlayableStage(){if((this.game.cityLevel??1)===this.stageLevel)return false;this.fitPlayable();return true;}
  resetView(){this.fitPlayable();}
  worldToScreen(x,y){return{x:this.offsetX+x*this.scale,y:this.offsetY+y*this.scale};}
  screenToWorld(x,y){return{x:(x-this.offsetX)/this.scale,y:(y-this.offsetY)/this.scale};}
  zoomAt(x,y,factor){const before=this.screenToWorld(x,y);this.zoom=clamp(this.zoom*factor,.72,6);this.scale=this.fitScale*this.zoom;this.offsetX=x-before.x*this.scale;this.offsetY=y-before.y*this.scale;this.clampView();return this.zoom;}
  pan(dx,dy){this.offsetX+=dx;this.offsetY+=dy;this.clampView();}
  clampView(){if(!this.viewWidth)return;const b=this.activeBounds(),pad=100,minX=this.viewWidth-b.x2*this.scale-pad,maxX=pad-b.x1*this.scale,minY=this.viewHeight-b.y2*this.scale-pad,maxY=pad-b.y1*this.scale,spanW=(b.x2-b.x1)*this.scale,spanH=(b.y2-b.y1)*this.scale;if(spanW<this.viewWidth-pad*2)this.offsetX=(this.viewWidth-(b.x1+b.x2)*this.scale)/2;else this.offsetX=clamp(this.offsetX,minX,maxX);if(spanH<this.viewHeight-pad*2)this.offsetY=(this.viewHeight-(b.y1+b.y2)*this.scale)/2;else this.offsetY=clamp(this.offsetY,minY,maxY);}
  px(value){return value/this.scale;}
}
