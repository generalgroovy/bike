const tasks=new Map();
let running=false,rafId=null;
const now=()=>typeof performance!=='undefined'?performance.now():Date.now();
const raf=callback=>typeof requestAnimationFrame==='function'?requestAnimationFrame(callback):setTimeout(()=>callback(now()),32);

function effectiveInterval(task){if(typeof document!=='undefined'&&document.hidden)return Math.max(task.hiddenInterval,task.interval*4);return task.interval;}
function loop(time){for(const task of tasks.values()){if(time-task.last<effectiveInterval(task))continue;task.last=time;try{task.fn(time);}catch(error){if(!task.failed){task.failed=true;console.error(`[ui-runtime] ${task.name}`,error);}}}rafId=raf(loop);}
function start(){if(running||typeof window==='undefined')return;running=true;rafId=raf(loop);}

export function registerUiTask(name,fn,{interval=200,hiddenInterval=1200,immediate=true}={}){const task={name,fn,interval,hiddenInterval,last:immediate?-Infinity:now(),failed:false};tasks.set(name,task);start();if(immediate){try{fn(now());task.last=now();}catch(error){task.failed=true;console.error(`[ui-runtime] ${name}`,error);}}return()=>tasks.delete(name);}
export function runUiTask(name){const task=tasks.get(name);if(!task)return false;task.last=now();task.fn(task.last);return true;}
export function uiRuntimeStats(){return{tasks:tasks.size,running,rafId};}

const insightCache=new WeakMap();
function riderSignature(game){return game.couriers.map(c=>`${c.id}:${c.phase}:${c.radioOn?1:0}:${c.nodeId}:${c.pathIndex}:${Math.round((c.fatigue??0)*20)}:${c.deliveryId??''}:${c.deliberation?.deliveryId??''}`).join(';');}
function deliverySignature(game,d){const event=game.currentEvent;return`${Math.floor(game.elapsed*5)}|${game.cityLevel}|${game.dispatchFocus}|${game.cash}|${game.radioUsed()}|${event?.id??''}:${event?.state??''}:${event?.advisory?1:0}|${d.id}:${d.status}:${d.called?1:0}:${d.channel??''}:${d.pickedUp?1:0}:${Math.round(d.deadlineAt*5)}:${d.reward}:${d.sweetened?1:0}:${d.extended?1:0}:${Math.round((d.rebroadcastUntil??0)*5)}|${riderSignature(game)}`;}
export function cachedDeliveryInsight(game,d){if(!game||!d||typeof game.deliveryDispatchInsight!=='function')return null;let cache=insightCache.get(game);if(!cache){cache=new Map();insightCache.set(game,cache);}const signature=deliverySignature(game,d),entry=cache.get(d.id);if(entry?.signature===signature)return entry.value;const value=game.deliveryDispatchInsight(d);cache.set(d.id,{signature,value});if(cache.size>64){for(const id of cache.keys())if(!game.deliveryById(id)||!game.activeDeliveries().some(item=>item.id===id))cache.delete(id);}return value;}
export function clearUiProjectionCache(game){if(game)insightCache.delete(game);}
