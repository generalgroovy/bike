export const CITY_EVENT_TYPES=[
  {id:'rain-cell',kind:'route',title:'HEAVY RAIN',factor:.7,duration:[32,48],forecast:'A rain cell will slow a cluster of streets.',weatherCell:true,edgeCount:[5,8]},
  {id:'venue-release',kind:'demand',title:'VENUE RELEASE',duration:[28,40],forecast:'A venue lets out soon; short-hop courier demand will jump.',burst:3,label:'VENUE',glyph:'◎'},
  {id:'transit-outage',kind:'demand',title:'TRANSIT OUTAGE',duration:[34,50],forecast:'A local transit outage will push urgent handoffs onto bikes.',burst:4,label:'TRANSIT',glyph:'S'}
];

export function allCityEventTypes(roadEvents){
  return[
    ...roadEvents.map(event=>({...event,kind:'route'})),
    ...CITY_EVENT_TYPES
  ];
}
