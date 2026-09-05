import { Game } from './game.js';
import { registerUiTask } from './ui-runtime.js';

const formatTime=seconds=>{const value=Math.max(0,Math.ceil(seconds));return `${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;};
let note=null;
function inspectorNote(){if(note?.isConnected)return note;const streets=document.querySelector('#inspect-streets');if(!streets)return null;note=document.createElement('div');note.className='scheduled-note';note.hidden=true;streets.after(note);return note;}
function render(){
  const game=Game.lastInstance;if(!game)return;
  const selected=game.deliveryById(game.selectedDeliveryId),selectedNote=inspectorNote();if(selectedNote){const active=selected?.specialId==='scheduled'&&!selected.pickedUp&&selected.pickupReadyAt!=null;selectedNote.hidden=!active;if(active){const remaining=Math.max(0,selected.pickupReadyAt-game.elapsed);selectedNote.dataset.ready=String(remaining<=0);selectedNote.textContent=remaining>0?`PICKUP WINDOW · client ready in ${formatTime(remaining)}`:'PICKUP WINDOW · client ready now';}}
  for(const rider of game.couriers){const card=document.querySelector(`[data-courier="${rider.id}"]`);if(!card)continue;const task=card.querySelector('.rider-task'),waiting=rider.phase==='waiting-pickup',delivery=waiting?game.deliveryById(rider.deliveryId):null;if(waiting&&delivery){card.dataset.scheduledWait='true';task.dataset.scheduledWait='true';task.dataset.waitLabel=`${delivery.id.toUpperCase()} · AT PICKUP`;task.dataset.waitTime=`OPENS ${formatTime(Math.max(0,(delivery.pickupReadyAt??game.elapsed)-game.elapsed))}`;}else{delete card.dataset.scheduledWait;if(task){delete task.dataset.scheduledWait;delete task.dataset.waitLabel;delete task.dataset.waitTime;}}}
}
registerUiTask('scheduled-pickups',render,{interval:120,hiddenInterval:1200});