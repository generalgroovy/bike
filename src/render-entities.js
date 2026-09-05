import { DELIVERY_TYPES,RADIO_CHANNELS } from './game-data.js';
import { drawCargoIcon,cargoVisual } from './cargo-icons.js';
import { assessRoute } from './route-assessment.js';
import { riderPortraitImage,portraitReady } from './rider-identity.js';
import { mapZoomBand,mapZoomAtLeast } from './map-zoom.js';

export function drawEntities(r){drawJobPreview(r);drawAttention(r);drawRoutes(r);drawRiderTrails(r);drawDeliveries(r);drawCouriers(r);}
function reducedMotion(){return typeof window!=='undefined'&&typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
function band(r){return r.mapBand??mapZoomBand(r.zoom);}
function drawPath(r,path,color,width=2,dash=[],alpha=1){if(!path?.length)return;const c=r.ctx,g=r.game,first=g.nodeById(path[0]);if(!first)return;c.beginPath();c.moveTo(first.x,first.y);for(let i=1;i<path.length;i++){const n=g.nodeById(path[i]);if(n)c.lineTo(n.x,n.y);}c.strokeStyle=color;c.lineWidth=r.px(width);c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';c.setLineDash(dash.map(v=>r.px(v)));c.stroke();c.setLineDash([]);c.globalAlpha=1;}
function focusedDelivery(g){return g.deliveryById(g.selectedDeliveryId)??g.deliveryById(g.hoveredDeliveryId);}

function drawRouteEndpoint(r,node,label,color){if(!node)return;const c=r.ctx,size=r.px(7);c.save();c.translate(node.x,node.y);c.beginPath();c.arc(0,0,size,0,Math.PI*2);c.fillStyle='#fffaf0';c.fill();c.strokeStyle=color;c.lineWidth=r.px(1.6);c.stroke();c.fillStyle='#3f4140';c.font=`900 ${r.px(6.2)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(label,0,r.px(.25));c.restore();}

function drawJobPreview(r){
  const g=r.game,d=focusedDelivery(g);if(!d||!g.activeDeliveries().includes(d))return;
  const selected=g.selectedDeliveryId===d.id,p=g.nodeById(d.pickupId),q=g.nodeById(d.dropoffId),assessment=assessRoute(g,d);if(!p||!q)return;
  if(d.plannedPath){
    drawPath(r,d.plannedPath,assessment?.distanceColor??'#657279',selected?7:4.5,[],selected?.18:.09);
    drawPath(r,d.plannedPath,assessment?.difficultyColor??'#303c43',selected?3.1:1.9,selected?[]:[5,5],selected?.96:.7);
  }
  if(selected){
    drawRouteEndpoint(r,p,'P',cargoVisual(d.type).color);
    drawRouteEndpoint(r,q,'D',assessment?.difficultyColor??'#555b5c');
    drawCargoIcon(r.ctx,d.type,p.x,p.y,r.px(10));
  }
  const c=r.ctx;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=assessment?.distanceColor??'#3f4b50';c.lineWidth=r.px(.7);c.setLineDash([r.px(2),r.px(8)]);c.globalAlpha=selected?.2:.08;c.stroke();c.setLineDash([]);c.globalAlpha=1;
  if(selected&&mapZoomAtLeast(band(r),'street')){drawAddressTag(r,p.x,p.y,d.pickupAddress,'PICKUP',-1);drawAddressTag(r,q.x,q.y,d.dropoffAddress,'DROP',1);}
}

function drawAddressTag(r,x,y,address,kicker,side){const c=r.ctx;if(r.zoom<.82)return;const pad=r.px(5),w=Math.max(r.px(94),c.measureText(address).width+pad*2),h=r.px(24),ox=side<0?-w-r.px(12):r.px(12),oy=-h/2;c.fillStyle='#fffaf0';c.strokeStyle='#77736b';c.lineWidth=r.px(1);c.beginPath();c.roundRect(x+ox,y+oy,w,h,r.px(4));c.fill();c.stroke();c.textAlign='left';c.textBaseline='top';c.font=`800 ${r.px(6.3)}px system-ui`;c.fillStyle='#8b857a';c.fillText(kicker,x+ox+pad,y+oy+r.px(3));c.font=`750 ${r.px(8.4)}px system-ui`;c.fillStyle='#292d2e';c.fillText(address,x+ox+pad,y+oy+r.px(11));}

function drawAttention(r){const zoomBand=band(r),c=r.ctx,g=r.game;for(const rider of g.couriers){if(rider.phase!=='idle'||!rider.radioOn)continue;const predicted=g.predictCall(rider);if(!predicted)continue;if(zoomBand==='overview'&&!rider.deliberation)continue;const pickup=g.nodeById(predicted.delivery.pickupId),progress=rider.deliberation?g.deliberationProgress(rider):0;if(!pickup)continue;c.beginPath();c.moveTo(rider.x,rider.y);c.lineTo(pickup.x,pickup.y);c.strokeStyle=rider.color;c.lineWidth=r.px(rider.deliberation?2:1.1);c.globalAlpha=rider.deliberation?.2+.34*progress:zoomBand==='district'?.06:.09;c.setLineDash([r.px(3),r.px(7)]);c.stroke();c.setLineDash([]);c.globalAlpha=1;}}

function drawRoutes(r){
  const zoomBand=band(r),c=r.ctx,g=r.game;
  for(const rider of g.couriers){
    if(rider.path.length<2)continue;
    const focused=g.selectedCourierId===rider.id||g.hoveredCourierId===rider.id,overview=zoomBand==='overview',district=zoomBand==='district',delivery=rider.deliveryId?g.deliveryById(rider.deliveryId):null,assessment=delivery?assessRoute(g,delivery):null;
    c.beginPath();c.moveTo(rider.x,rider.y);for(let i=rider.pathIndex;i<rider.path.length;i++){const n=g.nodeById(rider.path[i]);if(n)c.lineTo(n.x,n.y);}
    c.strokeStyle=assessment?.difficultyColor??'#fffaf0';c.lineWidth=r.px(focused?7.2:overview?4.1:district?4.8:5.7);c.globalAlpha=focused?.34:overview?.12:district?.18:.24;c.lineCap='round';c.lineJoin='round';c.stroke();
    c.strokeStyle='#fffaf0';c.lineWidth=r.px(focused?5.8:overview?3.1:district?3.8:4.8);c.globalAlpha=focused?.92:overview?.32:district?.52:.78;c.stroke();
    c.strokeStyle=rider.color;c.lineWidth=r.px(focused?3.4:overview?1.55:district?2.05:2.7);c.globalAlpha=focused?.98:overview?.4:district?.58:.76;c.setLineDash(overview&&!focused?[r.px(5),r.px(6)]:[r.px(6),r.px(4)]);c.stroke();c.setLineDash([]);c.globalAlpha=1;
  }
}

function drawRiderTrails(r){if(reducedMotion()||!r.riderTrails||band(r)==='overview')return;const c=r.ctx,t=performance.now()/1000;for(const rider of r.game.couriers){const trail=r.riderTrails.get(rider.id);if(!trail||trail.length<2||rider.phase==='break')continue;for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i],age=t-b.t;if(age>1.2)continue;const dt=Math.max(.02,b.t-a.t),speed=Math.hypot(b.x-a.x,b.y-a.y)/dt,relative=Math.max(0,Math.min(1.65,speed/Math.max(1,rider.baseSpeed))),life=Math.max(0,1-age/1.2),hot=Math.max(0,(relative-.72)/.75);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineCap='round';c.strokeStyle='#e66a3f';c.lineWidth=r.px(1.4+hot*4.6);c.globalAlpha=.03+life*hot*.22;c.stroke();c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.strokeStyle=rider.color;c.lineWidth=r.px(.7+relative*1.65);c.globalAlpha=life*(.12+.38*Math.min(1,relative));c.stroke();}c.globalAlpha=1;}}

function drawDropMarker(r,d,focused){const c=r.ctx,node=r.game.nodeById(d.dropoffId);if(!node)return;c.save();c.translate(node.x,node.y);const s=r.px(focused?7:5.5);c.beginPath();c.moveTo(0,-s);c.lineTo(s,0);c.lineTo(0,s);c.lineTo(-s,0);c.closePath();c.fillStyle='#fffaf0';c.fill();c.strokeStyle='#555b5c';c.lineWidth=r.px(focused?1.5:1.1);c.stroke();c.fillStyle='#555b5c';c.font=`900 ${r.px(4.8)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('D',0,0);c.restore();}
function drawDeliveryRipple(r,d,node,type,urgency,reduced,time){if(d.status!=='waiting')return;const zoomBand=band(r);if(zoomBand==='overview'&&!d.called&&urgency>=.28)return;const c=r.ctx,seed=Number(d.id.replace(/\D/g,''))||0,period=urgency<.28?.72:d.called?1.75:3.25,phase=reduced?.22:((time+seed*.173)%period)/period,alpha=reduced?.12:(1-phase)*(urgency<.28?.28:.13),radius=r.px(13+phase*(urgency<.28?28:20));c.save();c.translate(node.x,node.y);c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.strokeStyle=urgency<.28?'#ce4556':d.called?(RADIO_CHANNELS[d.channel]?.color??type.color):cargoVisual(d.type).color;c.lineWidth=r.px(urgency<.28?1.7:1.1);c.globalAlpha=alpha;c.stroke();if(!reduced&&urgency<.2){c.beginPath();c.arc(0,0,Math.max(r.px(10),radius-r.px(8)),0,Math.PI*2);c.globalAlpha=alpha*.58;c.stroke();}c.restore();}
function drawBroadcastBurst(r,d,node,reduced){const last=d.callHistory?.at(-1);if(!last?.channel||d.status!=='waiting')return;const age=r.game.elapsed-last.at;if(age<0||age>1.05)return;const c=r.ctx,p=reduced?.45:Math.min(1,age/1.05),channel=RADIO_CHANNELS[last.channel];c.save();c.translate(node.x,node.y);c.beginPath();c.arc(0,0,r.px(14+p*45),0,Math.PI*2);c.strokeStyle=channel?.color??'#4fa6c3';c.lineWidth=r.px(2-p);c.globalAlpha=reduced?.22:(1-p)*.52;c.stroke();if(!reduced&&last.channel==='priority'){c.beginPath();c.arc(0,0,r.px(11+p*31),0,Math.PI*2);c.globalAlpha=(1-p)*.28;c.stroke();}c.restore();}
function drawToolMarks(r,d,radius){const c=r.ctx,marks=[];if(d.sweetened)marks.push({glyph:'€',color:'#d99b35'});if(d.extended)marks.push({glyph:'+',color:'#46aeb0'});if((d.rebroadcastUntil??0)>r.game.elapsed)marks.push({glyph:'↻',color:'#806cc2'});if(!marks.length)return;for(let i=0;i<marks.length;i++){const x=(-marks.length+1+i*2)*r.px(4.2),y=radius+r.px(5);c.beginPath();c.arc(x,y,r.px(3.5),0,Math.PI*2);c.fillStyle='#fffaf0';c.fill();c.strokeStyle=marks[i].color;c.lineWidth=r.px(.9);c.stroke();c.fillStyle=marks[i].color;c.font=`900 ${r.px(4.3)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(marks[i].glyph,x,y);}}

function drawDeliveries(r){
  const zoomBand=band(r),c=r.ctx,g=r.game,reduced=reducedMotion(),time=reduced?0:performance.now()/1000;
  for(const d of g.activeDeliveries()){
    const node=g.nodeById(d.pickedUp?d.dropoffId:d.pickupId),type=DELIVERY_TYPES[d.type],cargo=cargoVisual(d.type),urgency=g.urgency(d),selected=g.selectedDeliveryId===d.id,hovered=g.hoveredDeliveryId===d.id,focused=selected||hovered,called=d.called,claimed=d.status==='claimed',channel=RADIO_CHANNELS[d.channel],radius=r.px(focused?14:10.7);if(!node)continue;
    drawDeliveryRipple(r,d,node,type,urgency,reduced,time);drawBroadcastBurst(r,d,node,reduced);if((focused||called||claimed)&&!d.pickedUp&&zoomBand!=='overview')drawDropMarker(r,d,focused);
    c.save();c.translate(node.x,node.y);c.globalAlpha=claimed?.8:1;c.beginPath();c.arc(0,0,radius+r.px(3),0,Math.PI*2);c.fillStyle='#fffaf0';c.fill();c.strokeStyle=called?(channel?.color??cargo.color):'#686a66';c.lineWidth=r.px(focused?3.1:called?2.45:1.3);c.stroke();
    c.beginPath();c.arc(0,0,radius+r.px(6),-Math.PI/2,-Math.PI/2+Math.PI*2*urgency);c.strokeStyle=urgency<.28?'#ce4556':'#6f716d';c.lineWidth=r.px(1.55);c.stroke();
    if(d.pickedUp){c.fillStyle=cargo.color;c.font=`900 ${r.px(9)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('D',0,0);}else drawCargoIcon(c,d.type,0,0,r.px(15),cargo.color);
    if(d.specialGlyph){c.beginPath();c.arc(-radius*.82,-radius*.82,r.px(5.2),0,Math.PI*2);c.fillStyle='#303638';c.fill();c.fillStyle='#fff';c.font=`900 ${r.px(5.8)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(d.specialGlyph,-radius*.82,-radius*.82);}
    if(called&&!claimed){const pulses=d.channel==='priority'?3:2;for(let i=0;i<pulses;i++){c.beginPath();const rr=radius+r.px(9+i*4+(reduced?0:Math.sin(time*4+i)));c.arc(0,0,rr,-.58,.58);c.strokeStyle=channel.color;c.lineWidth=r.px(1.2);c.globalAlpha=.36-i*.08;c.stroke();c.beginPath();c.arc(0,0,rr,Math.PI-.58,Math.PI+.58);c.stroke();}c.globalAlpha=1;c.beginPath();c.arc(radius*.75,-radius*.75,r.px(5),0,Math.PI*2);c.fillStyle=channel.color;c.fill();c.fillStyle='#fff';c.font=`900 ${r.px(5.5)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(d.channel==='priority'?'!':d.channel==='local'?'L':'O',radius*.75,-radius*.75);}
    drawToolMarks(r,d,radius);
    const showLabel=focused||(zoomBand==='district'&&(called||urgency<.28))||zoomBand==='street'||zoomBand==='detail';if(showLabel){c.font=`800 ${r.px(7.4)}px ui-monospace,monospace`;c.fillStyle='#343838';c.textAlign='center';c.textBaseline='middle';c.fillText(d.id.toUpperCase(),0,radius+r.px(10));}
    c.restore();
  }
}

function drawMotionCue(r,rider,radius,reduced){if(reduced||!(rider.phase==='pickup'||rider.phase==='dropoff')||!Number.isFinite(rider.heading)||band(r)==='overview')return;const c=r.ctx,t=performance.now()/1000,pulse=.72+.18*Math.sin(t*8+rider.id.length);c.save();c.rotate(rider.heading);c.strokeStyle=rider.color;c.lineWidth=r.px(1.25);c.globalAlpha=.18*pulse;for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(r.px(i*3.2),radius+r.px(4));c.lineTo(r.px(i*3.2),radius+r.px(8+Math.abs(i)*2));c.stroke();}c.restore();}
function drawMilestoneCue(r,rider,radius,reduced){if(!rider.lastMilestone||!Number.isFinite(rider.lastMilestoneAt))return;const age=r.game.elapsed-rider.lastMilestoneAt;if(age<0||age>1.15)return;const c=r.ctx,progress=Math.max(0,Math.min(1,age/1.15)),alpha=reduced?.34:.42*(1-progress),ring=radius+r.px(reduced?7:5+progress*15);c.save();c.strokeStyle=rider.color;c.lineWidth=r.px(reduced?1.4:1.8-progress*.8);c.globalAlpha=alpha;c.beginPath();c.arc(0,0,ring,0,Math.PI*2);c.stroke();if(!reduced){c.beginPath();c.arc(0,0,radius+r.px(4+progress*8),0,Math.PI*2);c.globalAlpha=alpha*.55;c.stroke();}c.globalAlpha=Math.max(.22,alpha);c.fillStyle=rider.color;c.font=`900 ${r.px(6.2)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(rider.lastMilestone==='pickup'?'P':'✓',radius+r.px(8),-radius-r.px(5));c.restore();}

function drawHeadingChevron(r,rider,radius,onBreak){
  if(onBreak||!Number.isFinite(rider.heading))return;
  const c=r.ctx;c.save();c.rotate(rider.heading);c.beginPath();c.moveTo(0,-radius-r.px(8));c.lineTo(r.px(4),-radius-r.px(2));c.lineTo(-r.px(4),-radius-r.px(2));c.closePath();c.fillStyle=rider.color;c.globalAlpha=.95;c.fill();c.restore();c.globalAlpha=1;
}
function drawPortraitFallback(r,rider,radius,onBreak){const c=r.ctx;c.fillStyle=onBreak?'#8e908c':rider.color;c.beginPath();c.arc(0,-radius*.16,radius*.34,0,Math.PI*2);c.fill();c.beginPath();c.arc(0,radius*.62,radius*.55,Math.PI,Math.PI*2);c.fill();c.fillStyle='#fffaf0';c.font=`900 ${r.px(6.8)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText(rider.name.slice(0,1),0,r.px(.5));}
function drawPortrait(r,rider,radius,onBreak){const c=r.ctx,image=riderPortraitImage(rider);c.save();c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.clip();c.globalAlpha=onBreak?.48:1;if(portraitReady(image))c.drawImage(image,-radius,-radius,radius*2,radius*2);else drawPortraitFallback(r,rider,radius,onBreak);c.restore();}

function drawCouriers(r){
  const zoomBand=band(r),c=r.ctx,g=r.game,reduced=reducedMotion();
  for(const rider of g.couriers){
    const selected=g.selectedCourierId===rider.id,hovered=g.hoveredCourierId===rider.id,focused=selected||hovered,onBreak=rider.phase==='break'||!rider.radioOn,thinking=g.deliberationProgress(rider),task=g.courierTaskProgress(rider),radius=r.px(focused?15.4:12.6);
    c.save();c.translate(rider.x,rider.y);drawMilestoneCue(r,rider,radius,reduced);drawMotionCue(r,rider,radius,reduced);
    if(rider.deliberation&&!onBreak){c.beginPath();c.arc(0,0,radius+r.px(6),-Math.PI/2,-Math.PI/2+Math.PI*2*thinking);c.strokeStyle='#313535';c.lineWidth=r.px(1.8);c.stroke();if(!reduced){const pulse=.5+.5*Math.sin(performance.now()/130);c.beginPath();c.arc(0,0,radius+r.px(8+pulse*3),0,Math.PI*2);c.strokeStyle=rider.color;c.globalAlpha=.08+.08*pulse;c.stroke();c.globalAlpha=1;}}
    else if(rider.deliveryId&&!onBreak){c.beginPath();c.arc(0,0,radius+r.px(6),-Math.PI/2,-Math.PI/2+Math.PI*2*task);c.strokeStyle=rider.color;c.globalAlpha=.85;c.lineWidth=r.px(2);c.stroke();c.globalAlpha=1;}
    if(focused){c.beginPath();c.arc(0,0,radius+r.px(5),0,Math.PI*2);c.strokeStyle=rider.color;c.lineWidth=r.px(2.5);c.globalAlpha=.25;c.stroke();c.globalAlpha=1;}
    c.beginPath();c.arc(0,0,radius+r.px(2),0,Math.PI*2);c.fillStyle='#fffaf0';c.fill();c.strokeStyle=onBreak?'#999b97':rider.color;c.lineWidth=r.px(focused?3.2:2.2);c.stroke();
    drawHeadingChevron(r,rider,radius,onBreak);
    drawPortrait(r,rider,radius,onBreak);
    if(onBreak){c.beginPath();c.arc(radius*.62,-radius*.62,r.px(5),0,Math.PI*2);c.fillStyle='#696c68';c.fill();c.fillStyle='#fffaf0';c.font=`900 ${r.px(5)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.fillText('Ⅱ',radius*.62,-radius*.62);}
    const showName=focused||zoomBand==='street'||zoomBand==='detail';if(showName){c.font=`800 ${r.px(8.2)}px system-ui`;c.textAlign='center';c.textBaseline='middle';c.strokeStyle='#f4eedf';c.lineWidth=r.px(2.8);c.strokeText(rider.name,0,radius+r.px(12));c.fillStyle=onBreak?'#777a76':'#303535';c.fillText(rider.name,0,radius+r.px(12));}
    c.restore();
  }
}
