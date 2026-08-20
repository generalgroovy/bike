import { BERLIN } from './berlin.js';

const GRID_PATCHES = [
  {id:'charlottenburg',districtId:'charlottenburg',xs:[135,195,255,320],ys:[400,455,515,575],vertical:['Kaiser-Friedrich-Straße','Wilmersdorfer Straße','Leibnizstraße','Joachimsthaler Straße'],horizontal:['Bismarckstraße','Kantstraße','Kurfürstendamm','Lietzenburger Straße'],anchors:['charl_west','savigny','zoo','wittenberg']},
  {id:'moabit',districtId:'moabit',xs:[410,475,540,605],ys:[255,310,365],vertical:['Beusselstraße','Stromstraße','Lübecker Straße','Lehrter Straße'],horizontal:['Siemensstraße','Turmstraße','Alt-Moabit'],anchors:['jungfernheide_e','moabit_w','turmstr','hbf']},
  {id:'wedding',districtId:'wedding',xs:[570,635,700,765],ys:[145,205,265],vertical:['Müllerstraße','Reinickendorfer Straße','Chausseestraße','Brunnenstraße'],horizontal:['Seestraße','Leopoldplatz','Bernauer Straße'],anchors:['leopold','gesundbrunnen','naturkunde']},
  {id:'mitte',districtId:'mitte',xs:[690,755,820,885,950],ys:[320,390,455,525,585],vertical:['Chausseestraße','Friedrichstraße','Charlottenstraße','Alexanderstraße','Littenstraße'],horizontal:['Invalidenstraße','Torstraße','Unter den Linden','Leipziger Straße','Köpenicker Straße'],anchors:['naturkunde','rosenthaler','friedrich_ul','friedrich_leipzig','alex','spittelmarkt','jannowitz']},
  {id:'prenzlauer',districtId:'prenzlauer',xs:[805,870,935,1000],ys:[185,245,305,355],vertical:['Schönhauser Allee','Kollwitzstraße','Prenzlauer Allee','Greifswalder Straße'],horizontal:['Eberswalder Straße','Danziger Straße','Stargarder Straße','Torstraße'],anchors:['eberwalder','mauerpark','prenzlauer_n','greifswalder','prenzlauer_s']},
  {id:'friedrichshain',districtId:'friedrichshain',xs:[1010,1080,1150,1220,1290],ys:[390,445,500,555],vertical:['Petersburger Straße','Warschauer Straße','Simon-Dach-Straße','Neue Bahnhofstraße','Marktstraße'],horizontal:['Karl-Marx-Allee','Grünberger Straße','Boxhagener Straße','Revaler Straße'],anchors:['strausberger','frankfurter_tor','samariter','warschauer','boxi','ostkreuz']},
  {id:'kreuzberg',districtId:'kreuzberg',xs:[650,720,790,860,930,1000],ys:[585,635,690,745],vertical:['Mehringdamm','Zossener Straße','Adalbertstraße','Kottbusser Straße','Mariannenstraße','Görlitzer Straße'],horizontal:['Oranienstraße','Gneisenaustraße','Urbanstraße','Skalitzer Straße'],anchors:['checkpoint','mehringplatz','mehringdamm','moritzplatz','kotti','oranienplatz','goerlitzer','schlesisches']},
  {id:'schoeneberg',districtId:'schoeneberg',xs:[350,420,490,555],ys:[590,650,710,770],vertical:['Potsdamer Straße','Hauptstraße','Martin-Luther-Straße','Dominicusstraße'],horizontal:['Bülowstraße','Grunewaldstraße','Belziger Straße','Kolonnenstraße'],anchors:['nollendorf','kleistpark','bayerischer','schoeneberg','gleisdreieck']},
  {id:'neukoelln',districtId:'neukoelln',xs:[825,895,965,1035,1105],ys:[735,790,845,900],vertical:['Hermannstraße','Karl-Marx-Straße','Pannierstraße','Weichselstraße','Treptower Straße'],horizontal:['Flughafenstraße','Sonnenallee','Weserstraße','Saalestraße'],anchors:['hermannstr','hermannplatz','karl_marx_nk','rathaus_nk','sonnenallee','neukoelln_s','treptower']}
];

function slug(value){return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
function nearestNode(nodes,x,y){let best=null;for(const node of nodes){const d=Math.hypot(node.x-x,node.y-y);if(!best||d<best.d)best={node,d};}return best?.node??null;}
function addressNumber(index,streetIndex,vertical=false){const base=vertical?3:2;const step=vertical?12:14;const parity=(streetIndex%2)+(vertical?1:0);return base+index*step+parity;}

export function buildDetailedBerlin(){
  const nodes=BERLIN.nodes.map((node)=>({...node,addresses:node.addresses?[...node.addresses]:[]}));
  const streets=BERLIN.streets.map((street)=>({...street,nodes:[...street.nodes]}));
  const gridNodes=[];
  for(const patch of GRID_PATCHES){
    const matrix=[];
    for(let yi=0;yi<patch.ys.length;yi+=1){const row=[];for(let xi=0;xi<patch.xs.length;xi+=1){
      const horizontal=patch.horizontal[yi],vertical=patch.vertical[xi],id=`grid-${patch.id}-${yi}-${xi}`;
      const node={id,name:`${horizontal} / ${vertical}`,short:horizontal,districtId:patch.districtId,x:patch.xs[xi],y:patch.ys[yi],kind:'address',addresses:[
        {street:horizontal,number:addressNumber(xi,yi,false)},{street:vertical,number:addressNumber(yi,xi,true)}
      ]};
      nodes.push(node);gridNodes.push(node);row.push(id);
    }matrix.push(row);}
    for(let yi=0;yi<matrix.length;yi+=1)streets.push({name:patch.horizontal[yi],class:'local',nodes:[...matrix[yi]],detail:true});
    for(let xi=0;xi<patch.xs.length;xi+=1)streets.push({name:patch.vertical[xi],class:'local',nodes:matrix.map((row)=>row[xi]),detail:true});
    const patchNodes=gridNodes.filter((node)=>node.id.startsWith(`grid-${patch.id}-`));
    for(const anchorId of patch.anchors){const anchor=nodes.find((node)=>node.id===anchorId);if(!anchor)continue;const nearest=nearestNode(patchNodes,anchor.x,anchor.y);if(!nearest)continue;streets.push({name:`${anchor.short??anchor.name} access`,class:'connector',nodes:[anchor.id,nearest.id],detail:true});}
  }
  return {nodes,streets,gridNodeCount:gridNodes.length,gridPatches:GRID_PATCHES};
}

export { GRID_PATCHES };
