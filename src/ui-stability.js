/* Browser-only interaction stability guard.
   Main UI owns state; this layer only prevents redundant DOM moves that can
   cancel click sequences and produce visual flicker under frequent refresh. */

const deliveries=document.querySelector('#deliveries');
const couriers=document.querySelector('#couriers');

function stabilizeAppend(container){
  if(!container||container.dataset.stableAppend==='true')return;
  const nativeAppend=container.append.bind(container);
  Object.defineProperty(container,'append',{
    configurable:true,
    value:(...nodes)=>{
      const fresh=[];
      for(const node of nodes){
        if(!(node instanceof Node)){fresh.push(node);continue;}
        // Existing keyed children are already in the correct DOM container.
        // Queue presentation uses CSS order, and rider roster order is stable.
        if(node.parentNode===container)continue;
        fresh.push(node);
      }
      if(fresh.length)nativeAppend(...fresh);
    }
  });
  container.dataset.stableAppend='true';
}

stabilizeAppend(deliveries);
stabilizeAppend(couriers);

document.documentElement.dataset.uiStable='true';

// Immediate tactile state confirms that a control received pointer input even
// when the resulting simulation state is visually subtle.
document.addEventListener('pointerdown',event=>{
  const target=event.target.closest?.('button,[role="button"],.task-card,.rider-card');
  if(!target||target.disabled)return;
  target.dataset.pressed='true';
},{passive:true});

const clearPressed=event=>{
  const target=event.target.closest?.('[data-pressed="true"]');
  if(target)delete target.dataset.pressed;
};
document.addEventListener('pointerup',clearPressed,{passive:true});
document.addEventListener('pointercancel',clearPressed,{passive:true});
window.addEventListener('blur',()=>document.querySelectorAll('[data-pressed="true"]').forEach(el=>delete el.dataset.pressed));
