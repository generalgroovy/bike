import { queryVisibleStreets,runtimeStreetName,runtimeMapReady } from './berlin-runtime.js';
import { roadVisibleAtBand,mapZoomAtLeast } from './map-zoom.js';

function googleBasemapActive(){return typeof document!=='undefined'&&document.documentElement.dataset.basemap==='google';}
export function drawBackdrop(r){if(googleBasemapActive())return;const c=r.ctx;c.fillStyle='#f4eedf';c.fillRect(0,0,r.viewWidth,r.viewHeight);c.fillStyle='#c9bfae';c.globalAlpha=.15;for(let x=0;x<r.viewWidth;x+=34)for(let y=0;y<r.viewHeight;y+=34)c.fillRect(x,y,1,1);c.globalAlpha=1;}
function polygon(c,points){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
function polyline(r,points,color,width,alpha=1,closed=false){const c=r.ctx;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));if(closed)c.closePath();c.strokeStyle=color;c.lineWidth=r.px(width);c.lineCap='round';c.lineJoin='round';c.globalAlpha=alpha;c.stroke();c.globalAlpha=1;}
function visualUnlocked(g,e){return typeof g.visualEdgePlayable==='function'?g.visualEdgePlayable(e.id):true;}
const motionQuery=typeof window!=='undefined'&&typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
function reducedMotion(){return Boolean(motionQuery?.matches);}
function motionTime(){return typeof performance!=='undefined'?performance.now()/1000:0;}
function renderEntries(r){if(r.renderEdges)return r.renderEdges;const result=[];for(const e of r.game.visualEdges){const a=r.game.nodeById(e.a),b=r.game.nodeById(e.b);if(!a||!b)continue;result.push({e,a,b,len:Math.hypot(a.x-b.x,a.y-b.y),x1:Math.min(a.x,b.x),y1:Math.min(a.y,b.y),x2:Math.max(a.x,b.x),y2:Math.max(a.y,b.y)});}return result;}
function visibleEntry(r,item){const b=r.frameWorldBounds;if(!b)return true;return item.x2>=b.x1&&item.x1<=b.x2&&item.y2>=b.y1&&item.y1<=b.y2;}
function visiblePoint(r,x,y,margin=0){const b=r.frameWorldBounds;if(!b)return true;const worldMargin=margin/Math.max(.001,r.scale);return x>=b.x1-worldMargin&&x<=b.x2+worldMargin&&y>=b.y1-worldMargin&&y<=b.y2+worldMargin;}

export function drawMap(r){
  const c=r.ctx,g=r.game;
  if(googleBasemapActive()){
    drawServicePressure(r);drawDistrictBriefs(r);drawEventArea(r);drawOperationalDisruptions(r);drawClientHubs(r);return;
  }
  for(const d of g.districts){
    const unlocked=(d.unlockLevel??1)<=g.cityLevel;
    polygon(c,d.polygon);
    c.fillStyle=unlocked?`${d.color}${r.mapBand==='overview'?'0f':'09'}`:'#d7d2c720';c.fill();
    if(mapZoomAtLeast(r.mapBand,'district')&&unlocked){c.strokeStyle=`${d.color}20`;c.lineWidth=r.px(.8);c.stroke();}
    if(mapZoomAtLeast(r.mapBand,'district')&&unlocked&&visiblePoint(r,d.center[0],d.center[1],90)){c.fillStyle='#777167';c.font=`800 ${r.px(9)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.globalAlpha=.52;c.fillText(d.name.toUpperCase(),d.center[0],d.center[1]);c.globalAlpha=1;}
  }
  drawServicePressure(r);drawDistrictBriefs(r);drawEventArea(r);
  for(const p of g.parks){polygon(c,p.polygon);c.fillStyle='#dbe5cf';c.globalAlpha=.88;c.fill();c.globalAlpha=1;}
  polyline(r,g.river,'#a9d4e2',17,.88);polyline(r,g.river,'#6baac0',1.5,.88);
  polyline(r,g.canal,'#bddbe1',8,.85);polyline(r,g.canal,'#78b2bf',1,.86);
  if(runtimeMapReady(r.berlinRuntime)){drawOfficialStreets(r);drawOfficialStreetLabels(r);}else{drawStreets(r);drawStreetLabels(r);}
  drawRing(r);drawLandmarks(r);drawClientHubs(r);
}

function drawOfficialStreets(r){
  const c=r.ctx,roads=queryVisibleStreets(r.berlinRuntime,r.frameWorldBounds,r.mapBand,r.berlinVisible);
  const widths={arterial:3.7,bridge:3.3,primary:2.55,secondary:1.45,local:.85};
  const inks={arterial:'#807c73',bridge:'#4f8fa6',primary:'#aaa49a',secondary:'#c3bdb2',local:'#d3cdc2'};
  for(const road of roads){
    const pts=road.points;if(pts.length<4)continue;const width=widths[road.roadClass]??1.2;
    c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);
    c.lineCap='round';c.lineJoin='round';c.strokeStyle='#fffaf0';c.lineWidth=r.px(width+1.9);c.globalAlpha=.92;c.stroke();
    c.strokeStyle=inks[road.roadClass]??inks.secondary;c.lineWidth=r.px(width);c.globalAlpha=road.roadClass==='local'?.7:.88;c.stroke();
    if(r.renderStats)r.renderStats.drawnEdges++;
  }
  c.globalAlpha=1;
}

function labelCollision(occupied,x1,y1,x2,y2){for(const b of occupied)if(x1<b.x2&&x2>b.x1&&y1<b.y2&&y2>b.y1)return true;return false;}
function drawOfficialStreetLabels(r){
  if(r.mapBand==='overview')return;
  const c=r.ctx,asset=r.berlinRuntime,occupied=r.labelOccupied??(r.labelOccupied=[]);occupied.length=0;
  const margin=16,bounds=r.frameWorldBounds;
  for(const label of asset.labels){
    if(!roadVisibleAtBand(label.roadClass,r.mapBand))continue;
    if(label.roadClass==='local'&&r.mapBand!=='detail')continue;
    if(label.x<bounds.x1||label.x>bounds.x2||label.y<bounds.y1||label.y>bounds.y2)continue;
    const name=asset.names[label.nameId];if(!name)continue;
    const s=r.worldToScreen(label.x,label.y),fontPx=label.roadClass==='arterial'?10:label.roadClass==='primary'?8.7:7.6,screenW=Math.max(28,name.length*fontPx*.55),screenH=fontPx+5,x1=s.x-screenW/2-margin/2,y1=s.y-screenH/2-margin/3,x2=s.x+screenW/2+margin/2,y2=s.y+screenH/2+margin/3;
    if(labelCollision(occupied,x1,y1,x2,y2))continue;occupied.push({x1,y1,x2,y2});
    let angle=label.angle;if(angle>Math.PI/2||angle<-Math.PI/2)angle+=Math.PI;
    c.save();c.translate(label.x,label.y);c.rotate(angle);c.font=`700 ${r.px(fontPx)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=r.px(3);c.strokeStyle='#f4eedf';c.globalAlpha=.94;c.strokeText(name,0,-r.px(3));c.fillStyle=label.roadClass==='arterial'?'#4f4b45':'#68635c';c.fillText(name,0,-r.px(3));c.restore();
  }
  c.globalAlpha=1;
}

function drawServicePressure(r){const c=r.ctx,g=r.game;if(typeof g.servicePressureSnapshot!=='function')return;const reduced=reducedMotion(),t=motionTime();for(const item of g.servicePressureSnapshot()){const pressure=item.pressure??0;if(pressure<30)continue;const d=item.district,ratio=Math.max(0,Math.min(1,(pressure-30)/70));polygon(c,d.polygon);c.fillStyle=pressure>=82?'#d95f58':'#d69b4a';c.globalAlpha=.025+ratio*.13;c.fill();c.strokeStyle=pressure>=82?'#b54545':'#b8813c';c.lineWidth=r.px(pressure>=82?2.1:1.15);c.globalAlpha=.18+ratio*.5;c.stroke();if(pressure>=55){const phase=reduced?.38:(t*(.16+pressure/240)+d.center[0]*.001)%1;c.beginPath();c.arc(d.center[0],d.center[1],r.px(13+phase*(pressure>=82?34:25)),0,Math.PI*2);c.strokeStyle=pressure>=82?'#b54545':'#b8813c';c.lineWidth=r.px(pressure>=82?1.5:1);c.globalAlpha=(1-phase)*(pressure>=82?.28:.16);c.stroke();if(!reduced&&pressure>=82){const phase2=(phase+.5)%1;c.beginPath();c.arc(d.center[0],d.center[1],r.px(12+phase2*30),0,Math.PI*2);c.globalAlpha=(1-phase2)*.18;c.stroke();}}if(mapZoomAtLeast(r.mapBand,'district')&&pressure>=55&&visiblePoint(r,d.center[0],d.center[1],80)){c.font=`900 ${r.px(7.8)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillStyle=pressure>=82?'#9f3d3d':'#8f6a34';c.globalAlpha=.78;c.fillText(`LOAD ${Math.round(pressure)}`,d.center[0],d.center[1]+r.px(13));}c.globalAlpha=1;}}
function drawDistrictBriefs(r){const c=r.ctx,g=r.game;if(typeof g.districtBriefActive!=='function')return;const reduced=reducedMotion();for(const d of g.districts){if(!g.districtBriefActive(d.id))continue;const remaining=g.districtBriefRemaining(d.id),age=Math.max(0,24-remaining);polygon(c,d.polygon);c.strokeStyle='#4f9d7c';c.lineWidth=r.px(2);c.globalAlpha=.72;c.setLineDash([r.px(8),r.px(5)]);c.stroke();c.setLineDash([]);if(age<1.25){const p=reduced?.55:Math.min(1,age/1.25);c.beginPath();c.arc(d.center[0],d.center[1],r.px(12+p*62),0,Math.PI*2);c.strokeStyle='#4f9d7c';c.lineWidth=r.px(1.7-p*.7);c.globalAlpha=reduced?.24:(1-p)*.46;c.stroke();}if(!reduced){const breathe=.5+.5*Math.sin(motionTime()*Math.PI*2/1.176);c.beginPath();c.arc(d.center[0],d.center[1],r.px(11+breathe*4),0,Math.PI*2);c.fillStyle='#4f9d7c';c.globalAlpha=.035+breathe*.045;c.fill();}if(mapZoomAtLeast(r.mapBand,'district')&&visiblePoint(r,d.center[0],d.center[1],80)){c.fillStyle='#4a826c';c.font=`900 ${r.px(7.6)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.globalAlpha=.86;c.fillText(`KIEZ BRIEF · ${Math.ceil(remaining)}s`,d.center[0],d.center[1]-r.px(15));}c.globalAlpha=1;}}
function drawEventArea(r){const c=r.ctx,g=r.game,ev=g.currentEvent;if(!ev||ev.kind!=='demand'||!ev.districtId)return;const d=g.districts.find(item=>item.id===ev.districtId);if(!d||(d.unlockLevel??1)>g.cityLevel)return;polygon(c,d.polygon);c.fillStyle=ev.state==='active'?'#d79a3d':'#d9aa59';c.globalAlpha=ev.state==='active'?.13:.075;c.fill();c.globalAlpha=.8;c.strokeStyle=ev.state==='active'?'#c77932':'#bd9554';c.lineWidth=r.px(ev.state==='active'?2:1.35);if(ev.state==='forecast')c.setLineDash([r.px(8),r.px(6)]);c.stroke();c.setLineDash([]);if(ev.state==='active'){const reduced=reducedMotion(),phase=reduced?.4:(motionTime()*.38)%1;c.beginPath();c.arc(d.center[0],d.center[1],r.px(15+phase*30),0,Math.PI*2);c.strokeStyle='#c77932';c.lineWidth=r.px(1.2);c.globalAlpha=reduced?.16:(1-phase)*.22;c.stroke();}if(mapZoomAtLeast(r.mapBand,'district')&&visiblePoint(r,d.center[0],d.center[1],80)){c.font=`900 ${r.px(9)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#8a6630';c.globalAlpha=.78;c.fillText(ev.state==='active'?'DEMAND SURGE':'SURGE FORECAST',d.center[0],d.center[1]-r.px(14));}c.globalAlpha=1;}
function drawOperationalDisruptions(r){const c=r.ctx,g=r.game,ev=g.currentEvent,affected=new Set(ev?.visualIds??[]);if(!affected.size||ev?.kind==='demand')return;for(const item of renderEntries(r)){if(!affected.has(item.e.id)||!visibleEntry(r,item))continue;const{a,b}=item;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineCap='round';c.strokeStyle='#fffdf8';c.lineWidth=r.px(6);c.globalAlpha=.72;c.stroke();c.strokeStyle=ev.state==='active'?'#cf5360':'#d59b43';c.lineWidth=r.px(ev.state==='active'?3.4:2.5);c.globalAlpha=.92;if(ev.state==='forecast')c.setLineDash([r.px(7),r.px(5)]);c.stroke();c.setLineDash([]);}c.globalAlpha=1;}
function drawRing(r){const c=r.ctx,g=r.game;if(!g.ringPath?.length)return;polyline(r,g.ringPath,g.cityLevel>=3?'#667a70':'#9c9a93',g.cityLevel>=3?2.1:1.25,g.cityLevel>=3?.66:.24,true);for(const s of g.ringStations){if(!visiblePoint(r,s.x,s.y,60))continue;const radius=r.px(g.cityLevel>=3?3.2:2.4);c.beginPath();c.arc(s.x,s.y,radius,0,Math.PI*2);c.fillStyle='#faf6eb';c.fill();c.strokeStyle='#667a70';c.lineWidth=r.px(.9);c.globalAlpha=g.cityLevel>=3?.86:.3;c.stroke();if(g.cityLevel>=3&&mapZoomAtLeast(r.mapBand,'district')){c.font=`650 ${r.px(7.4)}px system-ui`;c.fillStyle='#5c625e';c.textAlign='center';c.textBaseline='bottom';c.fillText(s.name,s.x,s.y-r.px(6));}c.globalAlpha=1;}}

function drawStreets(r){const c=r.ctx,g=r.game,event=g.currentEvent,affectedIds=new Set(event?.visualIds??[]);for(const item of renderEntries(r)){const{e,a,b}=item;if(e.roadClass==='connector')continue;if(!visibleEntry(r,item)){if(r.renderStats)r.renderStats.culledEdges++;continue;}const unlocked=visualUnlocked(g,e);if(!unlocked&&r.mapBand!=='detail')continue;if(!roadVisibleAtBand(e.roadClass,r.mapBand))continue;const affected=affectedIds.has(e.id),base=e.roadClass==='arterial'?3.9:e.roadClass==='primary'?2.75:e.roadClass==='bridge'?3.2:1.55;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineCap='round';c.strokeStyle='#faf8f2';c.lineWidth=r.px(base+1.7);c.globalAlpha=unlocked?.92:.18;c.stroke();c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=!unlocked?'#cbc6bc':affected?(event.state==='active'?'#cf5360':'#d59b43'):e.bikeLane?'#56a990':e.roadClass==='arterial'?'#8e887e':e.roadClass==='primary'?'#b4aea4':e.roadClass==='bridge'?'#699fb4':'#cbc5ba';c.lineWidth=r.px(e.bikeLane?base+.8:base);c.globalAlpha=unlocked?(e.roadClass==='secondary'?.68:.88):.2;if(event?.state==='forecast'&&affected)c.setLineDash([r.px(7),r.px(5)]);c.stroke();c.setLineDash([]);if(e.bridgeId&&!affected&&unlocked){c.strokeStyle='#579ab0';c.lineWidth=r.px(1.15);c.globalAlpha=.9;c.stroke();}if(r.renderStats)r.renderStats.drawnEdges++;}c.globalAlpha=1;}
function labelEligible(r,g,item){const e=item.e;if(e.roadClass==='connector'||!visualUnlocked(g,e)||!visibleEntry(r,item))return false;return roadVisibleAtBand(e.roadClass,r.mapBand)&&r.mapBand!=='overview';}
function labelGroups(r){if(r.streetLabelGroups)return r.streetLabelGroups;const groups=new Map();for(const item of renderEntries(r)){if(item.e.roadClass==='connector'||!item.e.streetName)continue;let group=groups.get(item.e.streetName);if(!group){group=[];groups.set(item.e.streetName,group);}group.push(item);}for(const group of groups.values())group.sort((a,b)=>b.len-a.len);return[...groups.values()];}
function drawStreetLabels(r){if(r.mapBand==='overview')return;const c=r.ctx,g=r.game,occupied=r.labelOccupied??(r.labelOccupied=[]);occupied.length=0;for(const group of labelGroups(r)){const item=group.find(candidate=>labelEligible(r,g,candidate));if(!item)continue;const{e,a,b}=item,x=(a.x+b.x)/2,y=(a.y+b.y)/2,s=r.worldToScreen(x,y);if(occupied.some(p=>Math.hypot(p.x-s.x,p.y-s.y)<72))continue;occupied.push(s);const angle=Math.atan2(b.y-a.y,b.x-a.x);c.save();c.translate(x,y);c.rotate(angle>Math.PI/2||angle<-Math.PI/2?angle+Math.PI:angle);c.font=`650 ${r.px(e.roadClass==='arterial'?9.3:8)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.lineWidth=r.px(2.7);c.strokeStyle='#f4eedf';c.globalAlpha=.9;c.strokeText(e.streetName,0,-r.px(4));c.fillStyle='#69645d';c.fillText(e.streetName,0,-r.px(4));c.restore();}c.globalAlpha=1;}
function drawLandmarks(r){const c=r.ctx,g=r.game;for(const l of g.landmarks){if(!visiblePoint(r,l.x,l.y,100))continue;const district=g.districts.find(d=>d.id===l.districtId);if((district?.unlockLevel??1)>g.cityLevel)continue;const radius=r.px(mapZoomAtLeast(r.mapBand,'street')?6.5:5.1);c.beginPath();c.arc(l.x,l.y,radius,0,Math.PI*2);c.fillStyle='#fbf7ec';c.fill();c.strokeStyle='#454746';c.lineWidth=r.px(1.2);c.stroke();c.fillStyle='#292d2e';c.font=`800 ${r.px(8)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(l.glyph??'•',l.x,l.y);if(mapZoomAtLeast(r.mapBand,'district')){c.font=`700 ${r.px(8.1)}px system-ui`;c.textAlign='left';c.textBaseline='alphabetic';c.strokeStyle='#f4eedf';c.lineWidth=r.px(2.8);c.strokeText(l.short??l.name,l.x+r.px(8),l.y-r.px(6));c.fillStyle='#444745';c.fillText(l.short??l.name,l.x+r.px(8),l.y-r.px(6));}}}
function drawClientHubs(r){const c=r.ctx,g=r.game;if(typeof g.activeClientHubs!=='function')return;const activeJobs=g.activeDeliveries(),busy=new Map();for(const d of activeJobs)if(d.clientHubId)busy.set(d.clientHubId,(busy.get(d.clientHubId)??0)+1);for(const hub of g.activeClientHubs()){const n=g.nodeById(hub.nodeId);if(!n||!visiblePoint(r,n.x,n.y,80))continue;const load=busy.get(hub.id)??0,radius=r.px(load?5.2:3.8);c.save();c.translate(n.x,n.y);c.beginPath();c.arc(0,0,radius+r.px(2),0,Math.PI*2);c.fillStyle='#fffaf0';c.globalAlpha=load?.96:.72;c.fill();c.strokeStyle=load?'#444b4d':'#8b8982';c.lineWidth=r.px(load?1.3:.8);c.stroke();c.fillStyle=load?'#343a3c':'#77756f';c.font=`900 ${r.px(load?6.2:5.4)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(hub.glyph,0,0);if(load&&mapZoomAtLeast(r.mapBand,'district')){c.font=`750 ${r.px(7.1)}px system-ui`;c.strokeStyle='#f4eedf';c.lineWidth=r.px(2.4);c.strokeText(hub.name,0,-radius-r.px(6));c.fillStyle='#555856';c.fillText(hub.name,0,-radius-r.px(6));}c.restore();}}
