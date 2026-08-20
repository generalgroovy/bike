const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
export class Camera{
constructor(canvas,game){this.canvas=canvas;this.game=game;this.dpr=Math.min(2,window.devicePixelRatio||1);this.zoom=1;this.fitScale=1;this.scale=1;this.offsetX=0;this.offsetY=0;this.viewWidth=0;this.viewHeight=0;this.resize(true);}
resize(reset=false){const old=!reset&&this.viewWidth?this.screenToWorld(this.viewWidth/2,this.viewHeight/2):null,rect=this.canvas.getBoundingClientRect(),w=Math.max(320,rect.width),h=Math.max(420,rect.height);this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);this.viewWidth=w;this.viewHeight=h;this.fitScale=Math.min((w-36)/this.game.width,(h-36)/this.game.height);this.scale=this.fitScale*this.zoom;if(reset||!old){this.offsetX=(w-this.game.width*this.scale)/2;this.offsetY=(h-this.game.height*this.scale)/2;}else{this.offsetX=w/2-old.x*this.scale;this.offsetY=h/2-old.y*this.scale;}this.clampView();}
resetView(){this.zoom=1;this.scale=this.fitScale;this.offsetX=(this.viewWidth-this.game.width*this.scale)/2;this.offsetY=(this.viewHeight-this.game.height*this.scale)/2;this.clampView();}
worldToScreen(x,y){return{x:this.offsetX+x*this.scale,y:this.offsetY+y*this.scale};}
screenToWorld(x,y){return{x:(x-this.offsetX)/this.scale,y:(y-this.offsetY)/this.scale};}
zoomAt(x,y,factor){const before=this.screenToWorld(x,y);this.zoom=clamp(this.zoom*factor,.78,5.5);this.scale=this.fitScale*this.zoom;this.offsetX=x-before.x*this.scale;this.offsetY=y-before.y*this.scale;this.clampView();return this.zoom;}
pan(dx,dy){this.offsetX+=dx;this.offsetY+=dy;this.clampView();}
clampView(){if(!this.viewWidth)return;const mapW=this.game.width*this.scale,mapH=this.game.height*this.scale,pad=88,minX=this.viewWidth-mapW-pad,maxX=pad,minY=this.viewHeight-mapH-pad,maxY=pad;if(mapW<this.viewWidth-pad*2)this.offsetX=(this.viewWidth-mapW)/2;else this.offsetX=clamp(this.offsetX,minX,maxX);if(mapH<this.viewHeight-pad*2)this.offsetY=(this.viewHeight-mapH)/2;else this.offsetY=clamp(this.offsetY,minY,maxY);}
px(value){return value/this.scale;}
}
