import { Game } from './game.js';

const inspector=document.querySelector('#job-inspector'),streets=document.querySelector('#inspect-streets');
const client=document.createElement('div');client.id='inspect-client';client.className='inspect-client';client.hidden=true;if(streets)streets.before(client);
let last='';
function render(){const game=Game.lastInstance;if(!game)return;for(const card of document.querySelectorAll('[data-delivery]')){const d=game.deliveryById(card.dataset.delivery);if(!d)continue;if(d.clientName){card.dataset.client=d.clientHubId;card.dataset.tip=`Recurring client · ${d.clientName} · ${d.clientKind} · ${d.clientEndpoint==='pickup'?'pickup':'drop-off'} at ${d.clientEndpoint==='pickup'?d.pickupAddress:d.dropoffAddress}`;}else{delete card.dataset.client;if(card.dataset.tip?.startsWith('Recurring client'))delete card.dataset.tip;}}
 const d=game.deliveryById(game.selectedDeliveryId),key=d?.clientHubId?`${d.id}:${d.clientHubId}:${d.clientEndpoint}`:'';if(key===last)return;last=key;if(!d?.clientHubId){client.hidden=true;client.textContent='';return;}client.hidden=false;client.textContent=`${d.clientGlyph??'•'} ${d.clientName} · ${d.clientKind} · recurring ${d.clientEndpoint}`;client.dataset.tip=`A fictional recurring Berlin client anchored to ${d.clientEndpoint==='pickup'?d.pickupAddress:d.dropoffAddress}. Learning recurring clients helps anticipate cargo and local pressure.`;}
setInterval(render,180);render();
