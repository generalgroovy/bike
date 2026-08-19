export const BERLIN = {
  name: 'Berlin',
  width: 1200,
  height: 800,
  river: [
    [40, 310], [150, 300], [250, 325], [350, 315], [455, 280], [540, 285],
    [625, 315], [705, 340], [790, 355], [875, 400], [960, 418], [1160, 440]
  ],
  parks: [
    { id: 'tiergarten', name: 'Tiergarten', color: '#5fcf84', polygon: [[315,305],[420,270],[535,290],[560,370],[455,405],[335,385]] },
    { id: 'tempelhofer-feld', name: 'Tempelhofer Feld', color: '#7bd67f', polygon: [[565,615],[720,595],[765,690],[705,755],[555,730],[520,660]] }
  ],
  districts: [
    { id: 'charlottenburg', name: 'Charlottenburg', color: '#f59e0b', polygon: [[80,245],[310,225],[345,380],[285,515],[85,495],[45,350]], center:[185,365] },
    { id: 'moabit', name: 'Moabit', color: '#38bdf8', polygon: [[300,195],[515,175],[545,300],[455,340],[325,315]], center:[410,255] },
    { id: 'wedding', name: 'Wedding', color: '#a78bfa', polygon: [[430,55],[650,60],[690,210],[535,250],[430,185]], center:[555,145] },
    { id: 'prenzlauer', name: 'Prenzlauer Berg', color: '#fb7185', polygon: [[650,75],[900,95],[900,275],[760,315],[680,205]], center:[790,185] },
    { id: 'tiergarten', name: 'Tiergarten', color: '#34d399', polygon: [[300,300],[520,260],[585,405],[505,470],[320,455],[275,365]], center:[430,395] },
    { id: 'mitte', name: 'Mitte', color: '#22d3ee', polygon: [[520,215],[770,205],[835,390],[690,475],[560,405]], center:[685,320] },
    { id: 'friedrichshain', name: 'Friedrichshain', color: '#f472b6', polygon: [[800,250],[1080,260],[1120,450],[930,505],[830,405]], center:[955,365] },
    { id: 'kreuzberg', name: 'Kreuzberg', color: '#fb923c', polygon: [[510,420],[845,390],[930,545],[790,625],[535,585]], center:[705,500] },
    { id: 'schoeneberg', name: 'Schöneberg', color: '#60a5fa', polygon: [[285,480],[535,430],[550,610],[445,665],[250,610]], center:[400,555] },
    { id: 'tempelhof', name: 'Tempelhof', color: '#84cc16', polygon: [[470,565],[760,550],[800,720],[690,790],[500,745]], center:[625,680] },
    { id: 'neukoelln', name: 'Neukölln', color: '#4ade80', polygon: [[745,520],[990,480],[1080,690],[905,760],[770,675]], center:[900,610] }
  ],
  landmarks: [
    { id:'zoo', name:'Zoologischer Garten', short:'Zoo', glyph:'●', districtId:'charlottenburg', x:270, y:355 },
    { id:'kudamm', name:'Kurfürstendamm', short:"Ku'damm", glyph:'◆', districtId:'charlottenburg', x:220, y:420 },
    { id:'victory', name:'Siegessäule', short:'Siegessäule', glyph:'✦', districtId:'tiergarten', x:430, y:350 },
    { id:'hauptbahnhof', name:'Hauptbahnhof', short:'Hbf', glyph:'▣', districtId:'moabit', x:520, y:280 },
    { id:'reichstag', name:'Reichstag', short:'Reichstag', glyph:'▥', districtId:'mitte', x:560, y:320 },
    { id:'brandenburg', name:'Brandenburger Tor', short:'Brandenburger Tor', glyph:'Π', districtId:'mitte', x:590, y:352 },
    { id:'potsdamer', name:'Potsdamer Platz', short:'Potsdamer Platz', glyph:'◇', districtId:'tiergarten', x:590, y:420 },
    { id:'checkpoint', name:'Checkpoint Charlie', short:'Checkpoint Charlie', glyph:'✚', districtId:'kreuzberg', x:655, y:465 },
    { id:'museuminsel', name:'Museumsinsel', short:'Museumsinsel', glyph:'▤', districtId:'mitte', x:720, y:340 },
    { id:'alex', name:'Alexanderplatz', short:'Alexanderplatz', glyph:'◎', districtId:'mitte', x:790, y:330 },
    { id:'fernsehturm', name:'Fernsehturm', short:'TV Tower', glyph:'▲', districtId:'mitte', x:775, y:305 },
    { id:'mauerpark', name:'Mauerpark', short:'Mauerpark', glyph:'♧', districtId:'prenzlauer', x:760, y:170 },
    { id:'eastside', name:'East Side Gallery', short:'East Side Gallery', glyph:'▰', districtId:'friedrichshain', x:890, y:425 },
    { id:'oberbaum', name:'Oberbaumbrücke', short:'Oberbaumbrücke', glyph:'⌁', districtId:'friedrichshain', x:915, y:470 },
    { id:'goerlitzer', name:'Görlitzer Park', short:'Görli', glyph:'♧', districtId:'kreuzberg', x:830, y:525 },
    { id:'hermannplatz', name:'Hermannplatz', short:'Hermannplatz', glyph:'◈', districtId:'neukoelln', x:835, y:600 },
    { id:'tempelhofer', name:'Tempelhofer Feld', short:'Tempelhofer Feld', glyph:'▱', districtId:'tempelhof', x:650, y:655 }
  ],
  hubs: [
    { id:'savigny', name:'Savignyplatz', districtId:'charlottenburg', x:205, y:350 },
    { id:'ernst-reuter', name:'Ernst-Reuter-Platz', districtId:'charlottenburg', x:300, y:310 },
    { id:'turmstrasse', name:'Turmstraße', districtId:'moabit', x:405, y:260 },
    { id:'gesundbrunnen', name:'Gesundbrunnen', districtId:'wedding', x:610, y:140 },
    { id:'leopoldplatz', name:'Leopoldplatz', districtId:'wedding', x:510, y:150 },
    { id:'eberwalder', name:'Eberswalder Straße', districtId:'prenzlauer', x:770, y:220 },
    { id:'rosenthaler', name:'Rosenthaler Platz', districtId:'mitte', x:700, y:270 },
    { id:'warschauer', name:'Warschauer Straße', districtId:'friedrichshain', x:940, y:410 },
    { id:'boxi', name:'Boxhagener Platz', districtId:'friedrichshain', x:1000, y:390 },
    { id:'kotti', name:'Kottbusser Tor', districtId:'kreuzberg', x:760, y:500 },
    { id:'mehringdamm', name:'Mehringdamm', districtId:'kreuzberg', x:610, y:540 },
    { id:'nollendorf', name:'Nollendorfplatz', districtId:'schoeneberg', x:430, y:485 },
    { id:'rathaus-schoeneberg', name:'Rathaus Schöneberg', districtId:'schoeneberg', x:390, y:590 },
    { id:'sonnenallee', name:'Sonnenallee', districtId:'neukoelln', x:900, y:600 },
    { id:'rathaus-neukoelln', name:'Rathaus Neukölln', districtId:'neukoelln', x:835, y:560 }
  ],
  roads: [
    ['kudamm','savigny'],['savigny','zoo'],['zoo','ernst-reuter'],['ernst-reuter','victory'],
    ['victory','reichstag'],['reichstag','brandenburg'],['brandenburg','potsdamer'],['reichstag','hauptbahnhof'],
    ['hauptbahnhof','turmstrasse'],['turmstrasse','ernst-reuter'],['hauptbahnhof','leopoldplatz'],
    ['leopoldplatz','gesundbrunnen'],['gesundbrunnen','mauerpark'],['mauerpark','eberwalder'],
    ['eberwalder','rosenthaler'],['rosenthaler','alex'],['alex','fernsehturm'],['fernsehturm','museuminsel'],
    ['museuminsel','brandenburg'],['museuminsel','checkpoint'],['potsdamer','checkpoint'],
    ['checkpoint','kotti'],['kotti','goerlitzer'],['goerlitzer','oberbaum'],['oberbaum','eastside'],
    ['eastside','warschauer'],['warschauer','boxi'],['alex','warschauer'],['rosenthaler','museuminsel'],
    ['nollendorf','potsdamer'],['nollendorf','mehringdamm'],['mehringdamm','checkpoint'],['mehringdamm','tempelhofer'],
    ['tempelhofer','rathaus-schoeneberg'],['rathaus-schoeneberg','nollendorf'],
    ['tempelhofer','hermannplatz'],['hermannplatz','rathaus-neukoelln'],['rathaus-neukoelln','kotti'],
    ['hermannplatz','sonnenallee'],['sonnenallee','warschauer'],['kotti','oberbaum']
  ]
};

export function districtById(id) {
  return BERLIN.districts.find((district) => district.id === id);
}

export function landmarkById(id) {
  return BERLIN.landmarks.find((landmark) => landmark.id === id);
}
