const DATA_SOURCES={detailNetwork:'Berlin Open Data · Detailnetz Berlin',addresses:'Berlin Open Data · Adressen Berlin',license:'Datenlizenz Deutschland – Zero – Version 2.0'};
const DISTRICTS=[
{id:'charlottenburg',name:'Charlottenburg',color:'#d8a94f',postcode:['10623','10625','10627','10707'],polygon:[[40,330],[330,320],[360,585],[80,610]],center:[190,470]},
{id:'moabit',name:'Moabit',color:'#6aa9d7',postcode:['10551','10553','10555','10557'],polygon:[[300,190],[565,180],[580,390],[315,405]],center:[430,295]},
{id:'wedding',name:'Wedding',color:'#9a86c9',postcode:['13347','13349','13353','13355'],polygon:[[390,35],[670,35],[690,245],[405,250]],center:[535,145]},
{id:'prenzlauer',name:'Prenzlauer Berg',color:'#d67f8e',postcode:['10405','10407','10435','10437'],polygon:[[650,35],[930,40],[935,300],[690,300]],center:[795,165]},
{id:'mitte',name:'Mitte',color:'#55aeb5',postcode:['10115','10117','10119','10178','10179'],polygon:[[520,205],[860,205],[885,455],[535,465]],center:[700,335]},
{id:'friedrichshain',name:'Friedrichshain',color:'#c778a4',postcode:['10243','10245','10247','10249'],polygon:[[840,260],[1190,270],[1180,545],[860,550]],center:[1015,405]},
{id:'kreuzberg',name:'Kreuzberg',color:'#d98455',postcode:['10961','10963','10967','10997','10999'],polygon:[[515,430],[940,420],[960,665],[530,675]],center:[730,550]},
{id:'schoeneberg',name:'Schöneberg',color:'#709bc7',postcode:['10777','10779','10823','10827'],polygon:[[270,470],[555,455],[565,705],[270,710]],center:[420,590]},
{id:'neukoelln',name:'Neukölln',color:'#76ab67',postcode:['12043','12045','12047','12049'],polygon:[[750,535],[1120,530],[1140,790],[760,790]],center:[930,660]},
{id:'tempelhof',name:'Tempelhof',color:'#91a654',postcode:['12099','12101','12103'],polygon:[[470,625],[805,620],[820,820],[470,820]],center:[645,725]}
];
const ZONES=[
{id:'charlottenburg',x:[70,320],y:[350,565],h:[['Bismarckstraße',365,'primary'],['Kantstraße',415,'secondary'],['Hardenbergstraße',455,'primary'],['Kurfürstendamm',505,'arterial'],['Lietzenburger Straße',555,'primary']],v:[['Wilmersdorfer Straße',95,'primary'],['Kaiser-Friedrich-Straße',155,'secondary'],['Leibnizstraße',215,'secondary'],['Fasanenstraße',275,'secondary']]},
{id:'moabit',x:[315,560],y:[205,390],h:[['Huttenstraße',220,'secondary'],['Invalidenstraße',260,'primary'],['Turmstraße',310,'primary'],['Alt-Moabit',365,'primary']],v:[['Beusselstraße',335,'primary'],['Stromstraße',395,'secondary'],['Lübecker Straße',445,'secondary'],['Lehrter Straße',500,'secondary'],['Rathenower Straße',545,'secondary']]},
{id:'wedding',x:[410,675],y:[55,235],h:[['Osloer Straße',70,'primary'],['Seestraße',115,'arterial'],['Luxemburger Straße',165,'secondary'],['Amrumer Straße',215,'secondary']],v:[['Reinickendorfer Straße',430,'primary'],['Müllerstraße',495,'arterial'],['Schulstraße',550,'secondary'],['Brunnenstraße',610,'primary'],['Pankstraße',660,'secondary']]},
{id:'prenzlauer',x:[675,920],y:[60,285],h:[['Danziger Straße',95,'arterial'],['Stargarder Straße',145,'secondary'],['Wichertstraße',195,'secondary'],['Eberswalder Straße',245,'primary']],v:[['Schönhauser Allee',700,'arterial'],['Pappelallee',755,'secondary'],['Prenzlauer Allee',815,'arterial'],['Dunckerstraße',865,'secondary'],['Greifswalder Straße',915,'primary']]},
{id:'mitte',x:[540,860],y:[225,445],h:[['Invalidenstraße',245,'primary'],['Torstraße',285,'primary'],['Oranienburger Straße',325,'secondary'],['Unter den Linden',365,'arterial'],['Leipziger Straße',415,'arterial']],v:[['Chausseestraße',565,'primary'],['Friedrichstraße',630,'arterial'],['Glinkastraße',685,'secondary'],['Rosenthaler Straße',745,'secondary'],['Alexanderstraße',825,'primary']]},
{id:'friedrichshain',x:[855,1170],y:[290,530],h:[['Karl-Marx-Allee',325,'arterial'],['Frankfurter Allee',370,'arterial'],['Grünberger Straße',415,'secondary'],['Boxhagener Straße',465,'primary'],['Revaler Straße',515,'secondary']],v:[['Warschauer Straße',885,'arterial'],['Petersburger Straße',965,'primary'],['Samariterstraße',1040,'secondary'],['Proskauer Straße',1115,'secondary']]},
{id:'kreuzberg',x:[535,935],y:[455,650],h:[['Oranienstraße',475,'primary'],['Wiener Straße',520,'secondary'],['Skalitzer Straße',560,'arterial'],['Gneisenaustraße',605,'primary'],['Yorckstraße',645,'primary']],v:[['Mehringdamm',575,'arterial'],['Prinzenstraße',675,'primary'],['Kottbusser Straße',770,'arterial'],['Görlitzer Straße',865,'secondary']]},
{id:'schoeneberg',x:[295,545],y:[490,695],h:[['Kleiststraße',505,'primary'],['Grunewaldstraße',550,'secondary'],['Hauptstraße',595,'arterial'],['Kolonnenstraße',640,'secondary'],['Dominicusstraße',685,'primary']],v:[['Potsdamer Straße',320,'arterial'],['Goltzstraße',385,'secondary'],['Akazienstraße',450,'secondary'],['Martin-Luther-Straße',520,'primary']]},
{id:'neukoelln',x:[775,1115],y:[550,775],h:[['Flughafenstraße',565,'primary'],['Donaustraße',610,'secondary'],['Sonnenallee',660,'arterial'],['Weserstraße',710,'secondary'],['Erkstraße',760,'secondary']],v:[['Kottbusser Damm',795,'arterial'],['Pannierstraße',865,'secondary'],['Karl-Marx-Straße',940,'arterial'],['Hermannstraße',1030,'arterial']]},
{id:'tempelhof',x:[490,795],y:[645,805],h:[['Columbiadamm',655,'arterial'],['Dudenstraße',705,'primary'],['Ringbahnstraße',755,'primary'],['Albrechtstraße',800,'secondary']],v:[['Manfred-von-Richthofen-Straße',515,'secondary'],['Boelckestraße',590,'secondary'],['Tempelhofer Damm',665,'arterial'],['Manteuffelstraße',750,'secondary']]}
];
const ARTERIALS=[
{name:'Straße des 17. Juni',class:'arterial',points:[[275,420],[390,400],[505,385],[590,370]]},
{name:'Invalidenstraße',class:'primary',points:[[480,260],[575,245],[690,245],[790,250]]},
{name:'Torstraße',class:'primary',points:[[610,285],[725,285],[845,300]]},
{name:'Unter den Linden',class:'arterial',points:[[590,370],[675,365],[760,365]]},
{name:'Karl-Marx-Allee',class:'arterial',points:[[800,365],[925,345],[1080,355]]},
{name:'Friedrichstraße',class:'arterial',points:[[630,240],[630,365],[640,475],[645,605]]},
{name:'Müllerstraße',class:'arterial',points:[[495,95],[495,210],[500,310]]},
{name:'Schönhauser Allee',class:'arterial',points:[[700,245],[720,175],[735,95]]},
{name:'Prenzlauer Allee',class:'arterial',points:[[815,280],[815,190],[815,95]]},
{name:'Potsdamer Straße',class:'arterial',points:[[590,420],[505,500],[420,590]]},
{name:'Mehringdamm',class:'arterial',points:[[575,475],[575,560],[590,655]]},
{name:'Kottbusser Damm',class:'arterial',points:[[770,560],[795,635],[820,715]]},
{name:'Karl-Marx-Straße',class:'arterial',points:[[940,565],[940,660],[955,750]]},
{name:'Warschauer Straße',class:'arterial',points:[[885,325],[895,430],[915,525]]},
{name:'Sonnenallee',class:'arterial',points:[[805,660],[940,660],[1080,680]]},
{name:'Oberbaumbrücke',class:'bridge',bridgeId:'oberbaumbruecke',points:[[865,545],[915,500]]},
{name:'Jannowitzbrücke',class:'bridge',bridgeId:'jannowitzbruecke',points:[[805,385],[835,430]]},
{name:'Moltkebrücke',class:'bridge',bridgeId:'moltkebruecke',points:[[520,300],[565,340]]}
];
const LANDMARKS=[
{id:'zoo',name:'Zoologischer Garten',short:'Zoo',glyph:'●',districtId:'charlottenburg',x:275,y:455},
{id:'kudamm',name:'Kurfürstendamm',short:"Ku'damm",glyph:'◆',districtId:'charlottenburg',x:220,y:505},
{id:'victory',name:'Siegessäule',short:'Siegessäule',glyph:'✦',districtId:'mitte',x:470,y:390},
{id:'hauptbahnhof',name:'Hauptbahnhof',short:'Hbf',glyph:'▣',districtId:'moabit',x:535,y:285},
{id:'reichstag',name:'Reichstag',short:'Reichstag',glyph:'▥',districtId:'mitte',x:570,y:350},
{id:'brandenburg',name:'Brandenburger Tor',short:'Brandenburger Tor',glyph:'Π',districtId:'mitte',x:600,y:370},
{id:'potsdamer',name:'Potsdamer Platz',short:'Potsdamer Platz',glyph:'◇',districtId:'mitte',x:610,y:430},
{id:'checkpoint',name:'Checkpoint Charlie',short:'Checkpoint Charlie',glyph:'✚',districtId:'kreuzberg',x:650,y:475},
{id:'museuminsel',name:'Museumsinsel',short:'Museumsinsel',glyph:'▤',districtId:'mitte',x:735,y:350},
{id:'alex',name:'Alexanderplatz',short:'Alexanderplatz',glyph:'◎',districtId:'mitte',x:820,y:350},
{id:'fernsehturm',name:'Fernsehturm',short:'TV Tower',glyph:'▲',districtId:'mitte',x:800,y:330},
{id:'mauerpark',name:'Mauerpark',short:'Mauerpark',glyph:'♧',districtId:'prenzlauer',x:720,y:205},
{id:'eastside',name:'East Side Gallery',short:'East Side Gallery',glyph:'▰',districtId:'friedrichshain',x:900,y:500},
{id:'oberbaum',name:'Oberbaumbrücke',short:'Oberbaumbrücke',glyph:'⌁',districtId:'friedrichshain',x:915,y:500},
{id:'goerlitzer',name:'Görlitzer Park',short:'Görli',glyph:'♧',districtId:'kreuzberg',x:850,y:555},
{id:'hermannplatz',name:'Hermannplatz',short:'Hermannplatz',glyph:'◈',districtId:'neukoelln',x:825,y:610},
{id:'tempelhofer',name:'Tempelhofer Feld',short:'Tempelhofer Feld',glyph:'▱',districtId:'tempelhof',x:665,y:700}
];
const PARKS=[
{id:'tiergarten',name:'Tiergarten',color:'#8bbf80',polygon:[[330,330],[515,310],[585,380],[525,455],[350,445]]},
{id:'tempelhofer-feld',name:'Tempelhofer Feld',color:'#91bd7e',polygon:[[555,665],[770,650],[800,780],[560,795]]},
{id:'goerlitzer-park',name:'Görlitzer Park',color:'#8bbf80',polygon:[[810,525],[900,515],[920,585],[825,595]]}
];
const RIVER=[[350,330],[470,325],[560,340],[650,365],[760,380],[845,410],[930,450],[1035,470],[1185,490]];
const CANAL=[[350,515],[470,505],[570,520],[690,545],[790,560],[890,555]];
const BRIDGES=[
{id:'moltkebruecke',name:'Moltkebrücke',short:'Moltkebrücke'},
{id:'jannowitzbruecke',name:'Jannowitzbrücke',short:'Jannowitzbrücke'},
{id:'oberbaumbruecke',name:'Oberbaumbrücke',short:'Oberbaumbrücke'}
];
function districtAt(x,y){let best=DISTRICTS[0],score=Infinity;for(const d of DISTRICTS){const dx=x-d.center[0],dy=y-d.center[1],s=dx*dx+dy*dy;if(s<score){score=s;best=d;}}return best;}
function keyXY(x,y){return `${Math.round(x*10)}:${Math.round(y*10)}`;}
function buildBerlin(){
  const nodes=[],baseEdges=[],nodeByKey=new Map(),edgeSeen=new Map(),streetNumbers=new Map();let nodeSerial=0,baseSerial=0;
  const getNode=(x,y,districtId=null)=>{const k=keyXY(x,y);if(nodeByKey.has(k))return nodeByKey.get(k);const d=DISTRICTS.find((item)=>item.id===districtId)??districtAt(x,y);const n={id:`i${nodeSerial++}`,name:'intersection',districtId:d.id,x,y,kind:'intersection'};nodes.push(n);nodeByKey.set(k,n);return n;};
  const addBase=(a,b,streetName,roadClass='secondary',bridgeId=null)=>{if(!a||!b||a.id===b.id)return;const k=[a.id,b.id].sort().join('|');const existing=edgeSeen.get(k);if(existing){if(!existing.streetNames.includes(streetName))existing.streetNames.push(streetName);if(roadClass==='arterial')existing.roadClass='arterial';if(bridgeId)existing.bridgeId=bridgeId;return existing;}const e={id:`v${baseSerial++}`,a:a.id,b:b.id,streetName,streetNames:[streetName],roadClass,bridgeId,distance:Math.hypot(a.x-b.x,a.y-b.y)};baseEdges.push(e);edgeSeen.set(k,e);return e;};
  for(const zone of ZONES){const rowNodes=new Map(),colNodes=new Map();for(const [hName,y,hClass] of zone.h){const row=[];for(const [vName,x] of zone.v){const n=getNode(x,y,zone.id);row.push(n);const col=colNodes.get(vName)??[];col.push(n);colNodes.set(vName,col);}rowNodes.set(hName,{nodes:row,class:hClass});}for(const [hName,row] of rowNodes){const ordered=[...row.nodes].sort((a,b)=>a.x-b.x);for(let i=1;i<ordered.length;i++)addBase(ordered[i-1],ordered[i],hName,row.class);}for(const [vName,x,vClass] of zone.v){const ordered=[...(colNodes.get(vName)??[])].sort((a,b)=>a.y-b.y);for(let i=1;i<ordered.length;i++)addBase(ordered[i-1],ordered[i],vName,vClass);}}
  for(const arterial of ARTERIALS){const line=arterial.points.map(([x,y])=>getNode(x,y));for(let i=1;i<line.length;i++)addBase(line[i-1],line[i],arterial.name,arterial.class,arterial.bridgeId??null);for(const n of line){let nearest=null;for(const candidate of nodes){if(candidate.id===n.id)continue;const d=Math.hypot(candidate.x-n.x,candidate.y-n.y);if(d<55&&(!nearest||d<nearest.d))nearest={candidate,d};}if(nearest)addBase(n,nearest.candidate,arterial.name,arterial.class,arterial.bridgeId??null);}}
  const graphNodes=[...nodes],edges=[];let edgeSerial=0,addressSerial=0;
  const postcodeFor=(districtId,index)=>{const list=DISTRICTS.find((d)=>d.id===districtId)?.postcode??['10115'];return list[index%list.length];};
  for(const base of baseEdges){const a=nodes.find((n)=>n.id===base.a),b=nodes.find((n)=>n.id===base.b);const counter=streetNumbers.get(base.streetName)??1;const points=[.34,.68].map((t,idx)=>{const district=districtAt(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);const parity=idx===0?1:2;const number=Math.max(1,counter+parity);const n={id:`a${addressSerial++}`,name:`${base.streetName} ${number}`,short:`${base.streetName} ${number}`,districtId:district.id,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,kind:'address',streetName:base.streetName,houseNumber:number,postcode:postcodeFor(district.id,addressSerial),addressLabel:`${base.streetName} ${number}`,fullAddress:`${base.streetName} ${number}, ${postcodeFor(district.id,addressSerial)} Berlin`};graphNodes.push(n);return n;});streetNumbers.set(base.streetName,counter+4);const chain=[a,...points,b];for(let i=1;i<chain.length;i++){const p=chain[i-1],q=chain[i];edges.push({id:`e${edgeSerial++}`,visualId:base.id,a:p.id,b:q.id,distance:Math.hypot(p.x-q.x,p.y-q.y),speed:base.roadClass==='arterial'?1.04:base.roadClass==='primary'?1:.96,bikeLane:false,eventMultiplier:1,roadClass:base.roadClass,streetName:base.streetName,streetNames:base.streetNames,bridgeId:base.bridgeId});}}
  const addressNodes=graphNodes.filter((n)=>n.kind==='address');
  const landmarks=LANDMARKS.map((landmark)=>{let nearest=addressNodes[0],best=Infinity;for(const n of addressNodes){const d=Math.hypot(n.x-landmark.x,n.y-landmark.y);if(d<best){best=d;nearest=n;}}return{...landmark,addressNodeId:nearest.id};});
  const streetCatalog=[...new Set(baseEdges.map((e)=>e.streetName))].sort((a,b)=>a.localeCompare(b,'de'));
  return{name:'Berlin',width:1220,height:840,dataSources:DATA_SOURCES,districts:DISTRICTS,parks:PARKS,river:RIVER,canal:CANAL,landmarks,bridges:BRIDGES,nodes:graphNodes,edges,visualEdges:baseEdges,addressNodes,streetCatalog};
}
export const BERLIN=buildBerlin();
export function districtById(id){return BERLIN.districts.find((d)=>d.id===id);}
export function landmarkById(id){return BERLIN.landmarks.find((l)=>l.id===id);}
export function bridgeById(id){return BERLIN.bridges.find((b)=>b.id===id);}
