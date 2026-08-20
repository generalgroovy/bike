export const DELIVERY_TYPES={
  food:{label:'Food',glyph:'▲',color:'#e96873',baseDeadline:74,reward:10,weight:1.25,unlockLevel:1,desc:'Fast-turnaround restaurant run'},
  parcel:{label:'Parcel',glyph:'●',color:'#d99b35',baseDeadline:96,reward:12,weight:1.2,unlockLevel:1,desc:'Steady general courier work'},
  document:{label:'Docs',glyph:'■',color:'#46aeb0',baseDeadline:82,reward:15,weight:1,unlockLevel:1,desc:'Business documents and signatures'},
  grocery:{label:'Grocery',glyph:'⬢',color:'#83ad54',baseDeadline:102,reward:13,weight:1,unlockLevel:1,desc:'Forgiving local household run'},
  fragile:{label:'Fragile',glyph:'◆',color:'#9e73c6',baseDeadline:90,reward:18,weight:.75,unlockLevel:2,desc:'Higher value, careful timing'},
  flowers:{label:'Flowers',glyph:'✿',color:'#c96a9f',baseDeadline:86,reward:17,weight:.72,unlockLevel:2,desc:'Time-sensitive delicate delivery'},
  keys:{label:'Keys',glyph:'⌑',color:'#728ab9',baseDeadline:72,reward:19,weight:.52,unlockLevel:2,desc:'Small, urgent access handoff'},
  medical:{label:'Medical',glyph:'✚',color:'#d94b62',baseDeadline:62,reward:24,weight:.55,unlockLevel:2,desc:'Urgent medical courier job'},
  catering:{label:'Catering',glyph:'♨',color:'#c9783e',baseDeadline:112,reward:27,weight:.46,unlockLevel:3,desc:'Longer high-value event run'},
  coldchain:{label:'Cold',glyph:'❄',color:'#54a6cf',baseDeadline:70,reward:29,weight:.38,unlockLevel:3,desc:'Strict temperature-sensitive courier run'}
};

export const RADIO_CHANNELS={
  open:{id:'open',label:'Open',short:'OPEN',cost:1,color:'#4fa6c3',appeal:0,desc:'Neutral broadcast to every listening rider'},
  priority:{id:'priority',label:'Priority',short:'PRIORITY',cost:2,color:'#d6a83f',appeal:.56,desc:'Stronger signal; still not an order'},
  local:{id:'local',label:'Local',short:'LOCAL',cost:1,color:'#4fac91',appeal:0,desc:'Favours riders already close to pickup'}
};

export const PERSONALITIES=[
  {id:'sprinter',title:'Sprinter',icon:'⚡',desc:'Close + urgent',weights:{distance:1.55,urgency:1.45,reward:.25}},
  {id:'earner',title:'Earner',icon:'€',desc:'Best payout',weights:{distance:.55,urgency:.5,reward:1.25}},
  {id:'guardian',title:'Guardian',icon:'✚',desc:'Urgent + medical',weights:{distance:.72,urgency:1.55,reward:.35,medical:1.45}},
  {id:'local',title:'Local',icon:'⌂',desc:'Nearby familiar work',weights:{distance:1.75,urgency:.6,reward:.25,sameDistrict:1.05}},
  {id:'tourer',title:'Tourer',icon:'◎',desc:'Longer city runs',weights:{distance:.38,urgency:.55,reward:.55,longRide:1.2}},
  {id:'steady',title:'Steady',icon:'≋',desc:'Balanced',weights:{distance:1,urgency:.95,reward:.78}}
];

export const EXPERIENCE=[
  {level:1,title:'Rookie',speed:.94,think:1.42,noise:.34,fatigue:1.08},
  {level:2,title:'Regular',speed:1,think:1.16,noise:.22,fatigue:1},
  {level:3,title:'Experienced',speed:1.06,think:.94,noise:.13,fatigue:.94},
  {level:4,title:'Veteran',speed:1.11,think:.78,noise:.07,fatigue:.9}
];

export const COURIER_NAMES=['Kira','Mauro','Brian','Sam','Michail','Zorro'];
export const COURIER_COLORS=['#378eb8','#d65c70','#76a64e','#d9a233','#806cc2','#d56f43'];

export const RUN_TRAITS=[
  {id:'express',title:'Express Berlin',desc:'Tighter windows · better pay',apply(g){g.modifiers.deadline*=.9;g.modifiers.reward*=1.18;}},
  {id:'green-wave',title:'Green Wave',desc:'Fast bike corridors from the start',apply(g){g.promoteBikeLanes(18,1.34);}},
  {id:'rain',title:'Rain Shift',desc:'Slower streets · larger tips',apply(g){g.modifiers.speed*=.92;g.modifiers.reward*=1.2;}},
  {id:'radio-discipline',title:'Tight Radio',desc:'Less bandwidth · slower demand',apply(g){g.radioSlots=Math.max(3,g.radioSlots-1);g.modifiers.spawnRate*=.9;}},
  {id:'rush',title:'Berlin Rush',desc:'More jobs · slightly more deadline room',apply(g){g.modifiers.spawnRate*=1.18;g.modifiers.deadline*=1.08;}},
  {id:'fresh-team',title:'Fresh Team',desc:'Riders fatigue more slowly',apply(g){g.modifiers.fatigue*=.78;}}
];

export const RUN_CONTRACTS=[
  {id:'mixed',title:'Mixed Desk',desc:'Balanced trip lengths and cargo.',minTrip:130,maxTrip:1150,reward:1,typeWeights:{}},
  {id:'short-hop',title:'Short-Hop Day',desc:'Dense neighborhood work; faster turnover.',minTrip:85,maxTrip:620,reward:.92,spawnRate:1.12,typeWeights:{food:1.2,grocery:1.15,flowers:1.15}},
  {id:'crosstown',title:'Cross-Town',desc:'Longer runs across Berlin.',minTrip:340,maxTrip:1450,reward:1.18,deadline:1.14,spawnRate:.9,typeWeights:{parcel:1.15,document:1.15,catering:1.2}},
  {id:'high-stakes',title:'High Stakes',desc:'More critical and delicate calls.',minTrip:120,maxTrip:1050,reward:1.15,typeWeights:{medical:2.1,fragile:1.7,coldchain:1.8,keys:1.45}}
];

export const SPECIAL_CONTRACTS=[
  {id:'rush',label:'RUSH',glyph:'⚑',minLevel:2,weight:.62,reward:1.32,deadline:.7,appeal:.18,desc:'Client-paid rush window'},
  {id:'return',label:'RETURN',glyph:'↩',minLevel:2,weight:.38,reward:1.16,deadline:1.04,appeal:.08,desc:'Successful drop creates a paid reverse leg'}
];

export const UPGRADES=[
  {id:'radio',title:'Radio Bandwidth',desc:'+1 broadcast bandwidth.',apply(g){g.radioSlots+=1;}},
  {id:'rider',title:'Extra Rider',desc:'The next named rider joins.',apply(g){g.addCourier();}},
  {id:'briefing',title:'Team Briefing',desc:'Faster, clearer rider decisions.',apply(g){g.modifiers.teamSkill*=1.2;}},
  {id:'speed',title:'Street Legs',desc:'Riders travel 9% faster.',apply(g){g.modifiers.speed*=1.09;}},
  {id:'grace',title:'Client Buffer',desc:'New deadlines are 13% longer.',apply(g){g.modifiers.deadline*=1.13;}},
  {id:'bikeLane',title:'Bike-Lane Grant',desc:'Ten street blocks become faster.',apply(g){g.promoteBikeLanes(10,1.42);}},
  {id:'coffee',title:'Team Coffee',desc:'Riders fatigue 20% more slowly.',apply(g){g.modifiers.fatigue*=.8;}},
  {id:'focus',title:'Second Line',desc:'+1 maximum Dispatch Focus and refill one.',apply(g){g.dispatchFocusMax+=1;g.dispatchFocus=Math.min(g.dispatchFocusMax,g.dispatchFocus+1);}},
  {id:'goodwill',title:'Local Goodwill',desc:'+16 reputation now.',apply(g){g.reputation=Math.min(100,g.reputation+16);}}
];

export const ROAD_EVENT_TYPES=[
  {id:'roadworks',title:'ROADWORKS',factor:.5,duration:[30,46],forecast:'One street section narrows soon.'},
  {id:'demo',title:'DEMONSTRATION',factor:.58,duration:[24,40],forecast:'Crowds slow a central corridor.'},
  {id:'bridge',title:'BRIDGE SQUEEZE',factor:.45,duration:[24,38],forecast:'A Spree crossing slows down.',bridgeOnly:true}
];

export const edgeKey=(a,b)=>[a,b].sort().join('|');
export function weightedPick(rng,items,weightFn){if(!items.length)return undefined;const weights=items.map(item=>Math.max(0,Number(weightFn(item))||0)),total=weights.reduce((a,b)=>a+b,0);if(total<=0)return rng.pick(items);let roll=rng.float(0,total);for(let i=0;i<items.length;i++){roll-=weights[i];if(roll<=0)return items[i];}return items.at(-1);}
