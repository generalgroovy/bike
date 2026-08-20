const DATA_SOURCES={
  detailNetwork:'Berlin Open Data · Detailnetz Berlin',
  addresses:'Berlin Open Data · Adressen Berlin',
  ringReference:'BVG S41/S42 Ringbahn',
  license:'Datenlizenz Deutschland – Zero – Version 2.0'
};

const DISTRICTS=[
  {id:'charlottenburg',name:'Charlottenburg',unlockLevel:2,color:'#d7a94e',postcode:['10623','10625','10627','10629'],polygon:[[120,300],[520,290],[560,680],[150,700]],center:[335,500]},
  {id:'wilmersdorf',name:'Wilmersdorf',unlockLevel:3,color:'#b59b59',postcode:['10707','10709','10713','10715'],polygon:[[180,640],[620,625],[650,950],[215,970]],center:[420,800]},
  {id:'moabit',name:'Moabit',unlockLevel:3,color:'#6ca8d4',postcode:['10551','10553','10555','10557'],polygon:[[320,170],[750,160],[760,470],[330,490]],center:[540,325]},
  {id:'wedding',name:'Wedding / Gesundbrunnen',unlockLevel:3,color:'#9b86c5',postcode:['13347','13349','13353','13355'],polygon:[[520,70],[880,70],[900,335],[540,340]],center:[710,205]},
  {id:'prenzlauer',name:'Prenzlauer Berg',unlockLevel:2,color:'#d57d8c',postcode:['10405','10407','10435','10437'],polygon:[[800,65],[1180,70],[1190,360],[815,370]],center:[995,215]},
  {id:'mitte',name:'Mitte / Tiergarten',unlockLevel:1,color:'#55adb4',postcode:['10115','10117','10119','10178','10179'],polygon:[[470,275],[1060,270],[1090,665],[470,675]],center:[770,475]},
  {id:'friedrichshain',name:'Friedrichshain',unlockLevel:2,color:'#c777a1',postcode:['10243','10245','10247','10249'],polygon:[[1010,275],[1430,285],[1435,650],[1010,655]],center:[1220,465]},
  {id:'kreuzberg',name:'Kreuzberg',unlockLevel:1,color:'#d98455',postcode:['10961','10963','10967','10997','10999'],polygon:[[545,570],[1140,560],[1160,835],[560,845]],center:[850,705]},
  {id:'schoeneberg',name:'Schöneberg',unlockLevel:2,color:'#719bc5',postcode:['10777','10779','10823','10827'],polygon:[[310,625],[790,620],[810,955],[320,960]],center:[560,790]},
  {id:'neukoelln',name:'Neukölln',unlockLevel:3,color:'#76ab67',postcode:['12043','12045','12047','12049'],polygon:[[840,720],[1285,710],[1300,995],[860,1005]],center:[1070,855]},
  {id:'tempelhof',name:'Tempelhof',unlockLevel:3,color:'#91a653',postcode:['12099','12101','12103'],polygon:[[590,790],[1010,785],[1025,1040],[590,1045]],center:[805,915]},
  {id:'treptow',name:'Alt-Treptow',unlockLevel:3,color:'#69a194',postcode:['12435','12437'],polygon:[[1160,600],[1480,600],[1490,880],[1180,900]],center:[1330,750]}
];

const ZONES=[
  {id:'charlottenburg',x:[180,520],h:[['Kaiserdamm',350,'primary'],['Bismarckstraße',410,'primary'],['Kantstraße',485,'secondary'],['Hardenbergstraße',535,'primary'],['Kurfürstendamm',600,'arterial'],['Lietzenburger Straße',665,'primary']],v:[['Sophie-Charlotten-Straße',190,'primary'],['Wilmersdorfer Straße',265,'primary'],['Leibnizstraße',340,'secondary'],['Fasanenstraße',415,'secondary'],['Joachimsthaler Straße',495,'secondary']]},
  {id:'wilmersdorf',x:[230,610],h:[['Hohenzollerndamm',700,'arterial'],['Berliner Straße',760,'primary'],['Güntzelstraße',820,'secondary'],['Mecklenburgische Straße',885,'primary'],['Wexstraße',935,'secondary']],v:[['Konstanzer Straße',250,'primary'],['Brandenburgische Straße',330,'primary'],['Bundesallee',430,'arterial'],['Blissestraße',520,'secondary'],['Detmolder Straße',600,'secondary']]},
  {id:'moabit',x:[350,730],h:[['Siemensstraße',210,'primary'],['Huttenstraße',270,'secondary'],['Turmstraße',335,'arterial'],['Alt-Moabit',405,'primary'],['Invalidenstraße',465,'primary']],v:[['Beusselstraße',365,'primary'],['Stromstraße',445,'primary'],['Gotzkowskystraße',515,'secondary'],['Rathenower Straße',595,'secondary'],['Lehrter Straße',690,'primary']]},
  {id:'wedding',x:[550,865],h:[['Osloer Straße',105,'primary'],['Seestraße',165,'arterial'],['Schulstraße',220,'secondary'],['Badstraße',275,'primary'],['Bernauer Straße',325,'primary']],v:[['Reinickendorfer Straße',570,'primary'],['Müllerstraße',645,'arterial'],['Prinzenallee',725,'secondary'],['Brunnenstraße',805,'arterial'],['Pankstraße',855,'secondary']]},
  {id:'prenzlauer',x:[825,1170],h:[['Bornholmer Straße',105,'primary'],['Wisbyer Straße',160,'secondary'],['Danziger Straße',220,'arterial'],['Eberswalder Straße',280,'primary'],['Stargarder Straße',335,'secondary']],v:[['Schönhauser Allee',845,'arterial'],['Pappelallee',920,'secondary'],['Prenzlauer Allee',995,'arterial'],['Greifswalder Straße',1075,'arterial'],['Kniprodestraße',1150,'secondary']]},
  {id:'mitte',x:[500,1030],h:[['Invalidenstraße',310,'primary'],['Torstraße',375,'primary'],['Oranienburger Straße',430,'secondary'],['Unter den Linden',505,'arterial'],['Leipziger Straße',575,'arterial'],['Stresemannstraße',635,'primary']],v:[['Lehrter Straße',530,'secondary'],['Friedrichstraße',635,'arterial'],['Charlottenstraße',720,'secondary'],['Spandauer Straße',835,'primary'],['Alexanderstraße',950,'primary'],['Lichtenberger Straße',1020,'secondary']]},
  {id:'friedrichshain',x:[1030,1410],h:[['Landsberger Allee',315,'arterial'],['Karl-Marx-Allee',390,'arterial'],['Frankfurter Allee',455,'arterial'],['Grünberger Straße',520,'secondary'],['Boxhagener Straße',580,'primary'],['Revaler Straße',635,'secondary']],v:[['Petersburger Straße',1050,'primary'],['Warschauer Straße',1130,'arterial'],['Samariterstraße',1210,'secondary'],['Proskauer Straße',1290,'secondary'],['Gürtelstraße',1380,'primary']]},
  {id:'kreuzberg',x:[575,1135],h:[['Oranienstraße',600,'primary'],['Wiener Straße',650,'secondary'],['Skalitzer Straße',705,'arterial'],['Gneisenaustraße',760,'primary'],['Urbanstraße',800,'secondary'],['Yorckstraße',835,'primary']],v:[['Mehringdamm',600,'arterial'],['Zossener Straße',690,'secondary'],['Prinzenstraße',785,'primary'],['Kottbusser Straße',885,'arterial'],['Görlitzer Straße',1010,'secondary'],['Schlesische Straße',1120,'primary']]},
  {id:'schoeneberg',x:[340,780],h:[['Kleiststraße',655,'primary'],['Grunewaldstraße',715,'secondary'],['Hauptstraße',775,'arterial'],['Kolonnenstraße',835,'secondary'],['Dominicusstraße',900,'primary'],['Sachsendamm',945,'primary']],v:[['Potsdamer Straße',365,'arterial'],['Martin-Luther-Straße',455,'primary'],['Bundesallee',545,'arterial'],['Innsbrucker Straße',645,'secondary'],['Tempelhofer Weg',750,'secondary']]},
  {id:'neukoelln',x:[865,1260],h:[['Flughafenstraße',750,'primary'],['Donaustraße',800,'secondary'],['Sonnenallee',855,'arterial'],['Weserstraße',905,'secondary'],['Saalestraße',955,'secondary']],v:[['Hermannstraße',885,'arterial'],['Schillerpromenade',965,'secondary'],['Karl-Marx-Straße',1055,'arterial'],['Pannierstraße',1140,'secondary'],['Wildenbruchstraße',1235,'primary']]},
  {id:'tempelhof',x:[620,1000],h:[['Columbiadamm',825,'arterial'],['Dudenstraße',875,'primary'],['Ringbahnstraße',935,'primary'],['Albrechtstraße',990,'secondary']],v:[['Manfred-von-Richthofen-Straße',650,'secondary'],['Boelckestraße',735,'secondary'],['Tempelhofer Damm',825,'arterial'],['Manteuffelstraße',920,'secondary'],['Gottlieb-Dunkel-Straße',990,'secondary']]},
  {id:'treptow',x:[1180,1470],h:[['Puschkinallee',650,'primary'],['Elsenstraße',710,'arterial'],['Kiefholzstraße',780,'primary'],['Bouchéstraße',835,'secondary']],v:[['Elsenstraße',1210,'arterial'],['Am Treptower Park',1300,'primary'],['Kiefholzstraße',1390,'primary'],['Elbestraße',1460,'secondary']]}
];

const ARTERIALS=[
  {name:'Straße des 17. Juni',class:'arterial',points:[[415,535],[530,520],[635,505]]},
  {name:'Invalidenstraße',class:'primary',points:[[690,465],[760,390],[835,310]]},
  {name:'Torstraße',class:'primary',points:[[635,375],[805,375],[950,375],[1050,390]]},
  {name:'Unter den Linden',class:'arterial',points:[[530,505],[635,505],[720,505],[835,505]]},
  {name:'Karl-Marx-Allee',class:'arterial',points:[[835,505],[950,455],[1050,420],[1130,390]]},
  {name:'Frankfurter Allee',class:'arterial',points:[[1130,455],[1210,455],[1380,455]]},
  {name:'Friedrichstraße',class:'arterial',points:[[635,310],[635,505],[635,600],[600,760]]},
  {name:'Müllerstraße',class:'arterial',points:[[645,165],[645,220],[645,335]]},
  {name:'Schönhauser Allee',class:'arterial',points:[[845,280],[845,220],[845,105]]},
  {name:'Prenzlauer Allee',class:'arterial',points:[[995,335],[995,220],[995,105]]},
  {name:'Potsdamer Straße',class:'arterial',points:[[635,575],[545,655],[455,715]]},
  {name:'Mehringdamm',class:'arterial',points:[[600,600],[600,705],[600,835]]},
  {name:'Kottbusser Damm',class:'arterial',points:[[885,705],[900,750],[930,855]]},
  {name:'Karl-Marx-Straße',class:'arterial',points:[[1055,750],[1055,855],[1060,955]]},
  {name:'Warschauer Straße',class:'arterial',points:[[1130,390],[1130,520],[1120,650]]},
  {name:'Sonnenallee',class:'arterial',points:[[885,855],[1055,855],[1235,855]]},
  {name:'Bundesallee',class:'arterial',points:[[430,700],[480,760],[545,835],[545,900]]},
  {name:'Hohenzollerndamm',class:'arterial',points:[[250,700],[330,700],[430,700]]},
  {name:'Seestraße',class:'arterial',points:[[570,165],[645,165],[805,165]]},
  {name:'Danziger Straße',class:'arterial',points:[[845,220],[995,220],[1075,220],[1150,220]]},
  {name:'Landsberger Allee',class:'arterial',points:[[1020,375],[1090,340],[1200,315],[1380,315]]},
  {name:'Columbiadamm',class:'arterial',points:[[600,825],[735,825],[885,825]]},
  {name:'Oberbaumbrücke',class:'bridge',bridgeId:'oberbaumbruecke',points:[[1120,650],[1130,580]]},
  {name:'Jannowitzbrücke',class:'bridge',bridgeId:'jannowitzbruecke',points:[[950,505],[1020,560]]},
  {name:'Moltkebrücke',class:'bridge',bridgeId:'moltkebruecke',points:[[590,420],[635,455]]}
];

const RING_STATIONS=[
  ['westkreuz','Westkreuz',150,575],['halensee','Halensee',195,690],['hohenzollerndamm','Hohenzollerndamm',255,805],
  ['heidelberger','Heidelberger Platz',345,900],['bundesplatz','Bundesplatz',455,940],['innsbrucker','Innsbrucker Platz',565,950],
  ['schoeneberg-ring','Schöneberg',650,965],['suedkreuz','Südkreuz',760,995],['tempelhof-ring','Tempelhof',850,970],
  ['hermannstr-ring','Hermannstraße',965,935],['neukoelln-ring','Neukölln',1075,890],['sonnenallee-ring','Sonnenallee',1165,835],
  ['treptower','Treptower Park',1275,735],['ostkreuz','Ostkreuz',1390,585],['frankfurter-ring','Frankfurter Allee',1380,455],
  ['storkower','Storkower Straße',1335,330],['landsberger-ring','Landsberger Allee',1240,235],['greifswalder-ring','Greifswalder Straße',1135,175],
  ['prenzlauer-ring','Prenzlauer Allee',1025,120],['schoenhauser-ring','Schönhauser Allee',890,105],['gesundbrunnen','Gesundbrunnen',760,95],
  ['wedding-ring','Wedding',650,100],['westhafen','Westhafen',535,135],['beussel','Beusselstraße',420,175],
  ['jungfernheide','Jungfernheide',305,225],['westend','Westend',210,315],['messe-nord','Messe Nord / ICC',165,430]
].map(([id,name,x,y])=>({id,name,x,y}));

const LANDMARKS=[
  ['zoo','Zoologischer Garten','Zoo','●','charlottenburg',400,535],['kudamm','Kurfürstendamm',"Ku'damm",'◆','charlottenburg',340,600],
  ['victory','Siegessäule','Siegessäule','✦','mitte',520,505],['hauptbahnhof','Hauptbahnhof','Hbf','▣','moabit',690,390],
  ['reichstag','Reichstag','Reichstag','▥','mitte',610,475],['brandenburg','Brandenburger Tor','Brandenburger Tor','Π','mitte',635,505],
  ['potsdamer','Potsdamer Platz','Potsdamer Platz','◇','mitte',620,575],['checkpoint','Checkpoint Charlie','Checkpoint Charlie','✚','kreuzberg',720,600],
  ['museuminsel','Museumsinsel','Museumsinsel','▤','mitte',835,485],['alex','Alexanderplatz','Alexanderplatz','◎','mitte',950,455],
  ['fernsehturm','Fernsehturm','TV Tower','▲','mitte',930,430],['mauerpark','Mauerpark','Mauerpark','♧','prenzlauer',845,280],
  ['eastside','East Side Gallery','East Side Gallery','▰','friedrichshain',1120,610],['oberbaum','Oberbaumbrücke','Oberbaumbrücke','⌁','friedrichshain',1125,615],
  ['goerlitzer','Görlitzer Park','Görli','♧','kreuzberg',1010,705],['hermannplatz','Hermannplatz','Hermannplatz','◈','neukoelln',930,800],
  ['tempelhofer','Tempelhofer Feld','Tempelhofer Feld','▱','tempelhof',820,875],['treptower-park','Treptower Park','Treptower Park','♧','treptow',1295,710]
].map(([id,name,short,glyph,districtId,x,y])=>({id,name,short,glyph,districtId,x,y}));

const PARKS=[
  {id:'tiergarten',name:'Tiergarten',polygon:[[330,420],[590,390],[720,500],[620,615],[350,600]]},
  {id:'tempelhofer-feld',name:'Tempelhofer Feld',polygon:[[690,820],[960,810],[1010,950],[690,975]]},
  {id:'goerlitzer-park',name:'Görlitzer Park',polygon:[[945,655],[1065,645],[1080,735],[960,745]]},
  {id:'treptower-park',name:'Treptower Park',polygon:[[1240,640],[1390,620],[1450,760],[1280,790]]}
];
const RIVER=[[340,400],[500,400],[635,430],[790,470],[950,510],[1110,570],[1260,600],[1450,620]];
const CANAL=[[330,610],[500,600],[650,620],[800,670],[940,700],[1100,690]];
const BRIDGES=[{id:'moltkebruecke',name:'Moltkebrücke',short:'Moltkebrücke'},{id:'jannowitzbruecke',name:'Jannowitzbrücke',short:'Jannowitzbrücke'},{id:'oberbaumbruecke',name:'Oberbaumbrücke',short:'Oberbaumbrücke'}];

const UNLOCK_STAGES=[
  {level:1,id:'center',name:'Center Desk',short:'CENTER',threshold:0,bounds:{x1:470,y1:275,x2:1160,y2:845},districts:['mitte','kreuzberg'],desc:'Mitte + Kreuzberg · compact first shift'},
  {level:2,id:'inner',name:'Inner City',short:'INNER',threshold:6,bounds:{x1:120,y1:70,x2:1435,y2:965},districts:['mitte','kreuzberg','charlottenburg','schoeneberg','prenzlauer','friedrichshain'],desc:'West and east corridors unlock'},
  {level:3,id:'ring',name:'Inside the Ring',short:'RING',threshold:16,bounds:{x1:90,y1:55,x2:1510,y2:1045},districts:DISTRICTS.map(d=>d.id),desc:'Full S41/S42 interior operations'}
];

function districtAt(x,y){let best=DISTRICTS[0],score=Infinity;for(const d of DISTRICTS){const dx=x-d.center[0],dy=y-d.center[1],s=dx*dx+dy*dy;if(s<score){score=s;best=d;}}return best;}
const keyXY=(x,y)=>`${Math.round(x*10)}:${Math.round(y*10)}`;

function buildBerlin(){
  const intersections=[],visualEdges=[],nodeByKey=new Map(),edgeSeen=new Map();let nodeSerial=0,visualSerial=0;
  const getNode=(x,y,districtId=null)=>{const key=keyXY(x,y);if(nodeByKey.has(key))return nodeByKey.get(key);const district=DISTRICTS.find(d=>d.id===districtId)??districtAt(x,y);const node={id:`i${nodeSerial++}`,name:'intersection',districtId:district.id,unlockLevel:district.unlockLevel,x,y,kind:'intersection'};intersections.push(node);nodeByKey.set(key,node);return node;};
  const addVisual=(a,b,streetName,roadClass='secondary',bridgeId=null)=>{if(!a||!b||a.id===b.id)return null;const key=[a.id,b.id].sort().join('|'),existing=edgeSeen.get(key);if(existing){if(!existing.streetNames.includes(streetName))existing.streetNames.push(streetName);if(roadClass==='arterial')existing.roadClass='arterial';if(bridgeId)existing.bridgeId=bridgeId;return existing;}const e={id:`v${visualSerial++}`,a:a.id,b:b.id,streetName,streetNames:[streetName],roadClass,bridgeId,distance:Math.hypot(a.x-b.x,a.y-b.y),bikeLane:false};visualEdges.push(e);edgeSeen.set(key,e);return e;};
  for(const zone of ZONES){const rows=[],cols=new Map();for(const [hName,y,hClass] of zone.h){const row=[];for(const [vName,x,vClass] of zone.v){const n=getNode(x,y,zone.id);row.push(n);const col=cols.get(vName)??{nodes:[],class:vClass};col.nodes.push(n);cols.set(vName,col);}rows.push({name:hName,class:hClass,nodes:row});}for(const row of rows)for(let i=1;i<row.nodes.length;i++)addVisual(row.nodes[i-1],row.nodes[i],row.name,row.class);for(const [name,col] of cols)for(let i=1;i<col.nodes.length;i++)addVisual(col.nodes[i-1],col.nodes[i],name,col.class);}
  for(const arterial of ARTERIALS){const points=arterial.points.map(([x,y])=>getNode(x,y));for(let i=1;i<points.length;i++)addVisual(points[i-1],points[i],arterial.name,arterial.class,arterial.bridgeId??null);}
  const adjacency=()=>{const m=new Map(intersections.map(n=>[n.id,[]]));for(const e of visualEdges){m.get(e.a)?.push(e.b);m.get(e.b)?.push(e.a);}return m;};
  const components=()=>{const a=adjacency(),left=new Set(intersections.map(n=>n.id)),groups=[];while(left.size){const first=left.values().next().value,stack=[first],g=[];left.delete(first);while(stack.length){const id=stack.pop();g.push(id);for(const to of a.get(id)??[])if(left.has(to)){left.delete(to);stack.push(to);}}groups.push(g);}return groups;};
  let groups=components();while(groups.length>1){const main=groups[0].map(id=>intersections.find(n=>n.id===id));let best=null;for(let gi=1;gi<groups.length;gi++)for(const a of main)for(const id of groups[gi]){const b=intersections.find(n=>n.id===id),d=Math.hypot(a.x-b.x,a.y-b.y);if(!best||d<best.d)best={a,b,d};}addVisual(best.a,best.b,'connector','connector');groups=components();}
  const graphNodes=[...intersections],edges=[],streetNumbers=new Map();let addressSerial=0,edgeSerial=0;
  const districtPostcode=(districtId,index)=>{const d=DISTRICTS.find(item=>item.id===districtId)??DISTRICTS[0];return d.postcode[index%d.postcode.length];};
  for(const visual of visualEdges){const a=intersections.find(n=>n.id===visual.a),b=intersections.find(n=>n.id===visual.b);if(!a||!b)continue;const parts=visual.roadClass==='connector'?1:Math.max(2,Math.ceil(visual.distance/52)),chain=[a];for(let p=1;p<parts;p++){const t=p/parts,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,district=districtAt(x,y),current=streetNumbers.get(visual.streetName)??2;streetNumbers.set(visual.streetName,current+2);const node={id:`a${addressSerial++}`,name:visual.streetName,short:visual.streetName,streetName:visual.streetName,houseNumber:current,addressLabel:`${visual.streetName} ${current}`,postcode:districtPostcode(district.id,current),districtId:district.id,unlockLevel:district.unlockLevel,x,y,kind:'address',visualId:visual.id};graphNodes.push(node);chain.push(node);}chain.push(b);for(let i=1;i<chain.length;i++){const p=chain[i-1],q=chain[i];edges.push({id:`e${edgeSerial++}`,a:p.id,b:q.id,distance:Math.hypot(p.x-q.x,p.y-q.y),speed:visual.roadClass==='arterial'?1.03:visual.roadClass==='connector'?.94:1,bikeLane:false,eventMultiplier:1,roadClass:visual.roadClass,streetName:visual.streetName,streetNames:[...visual.streetNames],bridgeId:visual.bridgeId??null,visualId:visual.id});}}
  const addressNodes=graphNodes.filter(n=>n.kind==='address');
  const landmarks=LANDMARKS.map(landmark=>{let nearest=addressNodes[0],best=Infinity;for(const n of addressNodes){const d=Math.hypot(n.x-landmark.x,n.y-landmark.y);if(d<best){best=d;nearest=n;}}return{...landmark,addressNodeId:nearest?.id??null};});
  const streetCatalog=[...new Set(visualEdges.filter(e=>e.roadClass!=='connector').map(e=>e.streetName))].sort((a,b)=>a.localeCompare(b,'de'));
  return{name:'Berlin',width:1600,height:1120,dataSources:DATA_SOURCES,districts:DISTRICTS,parks:PARKS,river:RIVER,canal:CANAL,landmarks,bridges:BRIDGES,ringStations:RING_STATIONS,ringPath:RING_STATIONS.map(s=>[s.x,s.y]),unlockStages:UNLOCK_STAGES,nodes:graphNodes,edges,visualEdges,addressNodes,streetCatalog};
}

export const BERLIN=buildBerlin();
export function districtById(id){return BERLIN.districts.find(d=>d.id===id);}
export function landmarkById(id){return BERLIN.landmarks.find(l=>l.id===id);}
export function bridgeById(id){return BERLIN.bridges.find(b=>b.id===id);}
export function unlockStage(level){return BERLIN.unlockStages.find(s=>s.level===level)??BERLIN.unlockStages.at(-1);}
