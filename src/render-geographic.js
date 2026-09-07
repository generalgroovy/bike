// All layers share EPSG:25833 coordinates from one CityPack. No warped basemap.
function line(path, points, close=false) {
  if (!points.length) return;
  path.moveTo(...points[0]);for (let i=1;i<points.length;i++) path.lineTo(...points[i]);
  if (close) path.closePath();
}
function polygonsPath(polygons) {
  const path=new Path2D();for (const poly of polygons) for (const ring of poly) line(path,ring,true);return path;
}
function prepare(r) {
  const g=r.game,city=g.cityData,ctx=city.context;
  const layers={water:polygonsPath(ctx.water),vegetation:polygonsPath(ctx.vegetation),buildings:polygonsPath(ctx.buildings),
    parks:polygonsPath(ctx.parks.flatMap(p=>p.polygons)),boundary:new Path2D(),regions:city.regions.map(d=>({...d,path:polygonsPath(d.polygons)})),
    local:new Path2D(),arterial:new Path2D(),restricted:new Path2D(),streets:[],labels:[]};
  line(layers.boundary,g.ringPath,true);
  const labels=new Map();
  for (const e of g.visualEdges) {
    const points=e.nodeIds.map(id=>g.nodeById(id)).map(n=>[n.x,n.y]),path=new Path2D();line(path,points);
    layers.streets.push(path);layers[e.routable?e.roadClass:'restricted'].addPath(path);
    if (!e.routable||['-','Unnamed path'].includes(e.streetName)) continue;
    for (let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],length=Math.hypot(a[0]-b[0],a[1]-b[1]);
      const prev=labels.get(e.streetName);
      if (!prev||length>prev.length) labels.set(e.streetName,{name:e.streetName,a,b,length,major:e.roadClass==='arterial'});
    }
  }
  layers.labels=[...labels.values()].sort((a,b)=>Number(b.major)-Number(a.major)||b.length-a.length);
  layers.canvas=document.createElement('canvas');r.geographicLayers=layers;return layers;
}
function stroke(c,path,color,width,dash=[]) {c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke(path);c.setLineDash([]);}

export function drawGeographicMap(r) {
  const layers=r.geographicLayers??prepare(r),g=r.game,s=r.scale;
  const hot=g.demandRegion(),key=[r.viewWidth,r.viewHeight,r.dpr,s,r.offsetX,r.offsetY,hot.id,r.focusRegionId].join(':');
  if (layers.key!==key) {
    const canvas=layers.canvas;canvas.width=r.canvas.width;canvas.height=r.canvas.height;
    const c=canvas.getContext('2d');c.setTransform(r.dpr,0,0,r.dpr,0,0);
    c.fillStyle='#e3e5df';c.fillRect(0,0,r.viewWidth,r.viewHeight);
    c.translate(r.offsetX,r.offsetY);c.scale(s,s);
    c.fillStyle='#f4f0e6';c.fill(layers.boundary);
    c.save();c.clip(layers.boundary);
    const hotRegion=layers.regions.find(d=>d.id===hot.id);
    if (hotRegion) {c.fillStyle='#eee6cf';c.fill(hotRegion.path,'evenodd');}
    c.fillStyle='#d4dfc7';c.fill(layers.vegetation,'evenodd');
    c.fillStyle='#c9d9b8';c.fill(layers.parks,'evenodd');
    c.fillStyle='#a9d3d5';c.fill(layers.water,'evenodd');
    if (r.zoom>1.5) {c.fillStyle='#dfd8c9';c.fill(layers.buildings,'evenodd');}
    c.lineCap='round';c.lineJoin='round';
    stroke(c,layers.restricted,'#b5b6ac',Math.max(.7/s,1.5),[3/s,3/s]);
    stroke(c,layers.local,'#c8c4b8',Math.max(.65/s,1.3));
    if (r.zoom>1.4) stroke(c,layers.local,'#fffdf5',Math.max(.55/s,.75));
    stroke(c,layers.arterial,'#c6bca6',Math.max(1.5/s,2.5));
    stroke(c,layers.arterial,'#fff7db',Math.max(.8/s,1.5));
    for (const d of layers.regions) stroke(c,d.path,d.id===r.focusRegionId?'#417b7b':'#aab4ab',d.id===r.focusRegionId?1.8/s:.65/s,[4/s,5/s]);
    c.restore();
    stroke(c,layers.boundary,'#597b60',2/s,[6/s,4/s]);
    // Place labels in screen coordinates so type remains legible at every scale.
    c.setTransform(r.dpr,0,0,r.dpr,0,0);
    const occupied=[],reserve=(x,y,w,h)=> {
      const box={x:x-w/2,y:y-h/2,w,h};
      if (box.x<8||box.y<85||box.x+w>r.viewWidth-8||box.y+h>r.viewHeight-105||occupied.some(b=>box.x<b.x+b.w+6&&box.x+w>b.x-6&&box.y<b.y+b.h+6&&box.y+h>b.y-6)) return false;
      occupied.push(box);return true;
    };
    const label=(name,p,size,color,weight=600)=> {
      const xy=r.worldToScreen(...p);c.font=`${weight} ${size}px system-ui`;
      if (!reserve(xy.x,xy.y,c.measureText(name).width,size+4)) return;
      c.textAlign='center';c.textBaseline='middle';c.lineWidth=3;c.strokeStyle='#f4f0e6';c.strokeText(name,xy.x,xy.y);c.fillStyle=color;c.fillText(name,xy.x,xy.y);
    };
    for (const d of layers.regions) if (d.areaKm2>.2) label(d.name.toLocaleUpperCase('de'),d.center,r.zoom<1.5?10:12,'#536b64',750);
    if (r.zoom>1.3) for (const p of [...g.cityData.context.parks].sort((a,b)=>b.area-a.area)) if (p.area*s*s/100>4000) label(p.name,p.center,10,'#51704a');
    if (r.zoom>1.8) for (const l of layers.labels) {
      if (l.length*s<35) continue;
      const a=r.worldToScreen(...l.a),b=r.worldToScreen(...l.b),x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      c.font=`${l.major?600:450} 10px system-ui`;const w=c.measureText(l.name).width;
      if (w>l.length*s*2.5) continue;
      let angle=Math.atan2(b.y-a.y,b.x-a.x);if (angle>Math.PI/2||angle<-Math.PI/2) angle+=Math.PI;
      if (!reserve(x,y,Math.abs(Math.cos(angle))*w+Math.abs(Math.sin(angle))*12,Math.abs(Math.sin(angle))*w+Math.abs(Math.cos(angle))*12)) continue;
      c.save();c.translate(x,y);c.rotate(angle);c.textAlign='center';c.textBaseline='middle';
      c.lineWidth=3;c.strokeStyle='#faf6ec';c.strokeText(l.name,0,0);c.fillStyle='#626358';c.fillText(l.name,0,0);c.restore();
    }
    const depot=g.nodeById(g.depotNodeId);label('DISPATCH DESK',[depot.x,depot.y+15/s],9,'#355b5c',800);
    layers.key=key;r.renderStats.mapRepaints=(r.renderStats.mapRepaints??0)+1;
  }
  const c=r.ctx;c.save();c.setTransform(r.dpr,0,0,r.dpr,0,0);c.drawImage(layers.canvas,0,0,r.viewWidth,r.viewHeight);c.restore();
  if (g.currentEvent) for (const id of g.currentEvent.visualIds) {
    const path=layers.streets[Number(id.slice(1))];
    if (path) stroke(c,path,g.currentEvent.state==='active'?'#c6693c':'#c69851',4/s,[4/s,3/s]);
  }
}
