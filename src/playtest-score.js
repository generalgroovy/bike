// Original score: “Spokes & Postcards”. No recordings, network, simulation RNG
// or hidden audio clock. Event phrases share the existing D-minor/102 BPM identity.
export const SCORE=Object.freeze({title:'Spokes & Postcards',bpm:102,key:'D minor pentatonic'});
export const RIDER_PHRASES=Object.freeze({
  Kira:{instrument:'bell',notes:[74,81,77],beats:[0,.25,.75],pan:-.3,label:'Kira · bright bicycle bell'},
  Mauro:{instrument:'pluck',notes:[50,57,62],beats:[0,.5,.75],pan:.3,label:'Mauro · warm bass pluck'},
  Brian:{instrument:'reed',notes:[67,65,62],beats:[0,.5,1],pan:0,label:'Brian · soft reed phrase'}
});
const beat=60/SCORE.bpm;
export const TASK_RHYTHMS=Object.freeze([{name:'half notes',division:'1/2',steps:8},{name:'quarter notes',division:'1/4',steps:4},{name:'eighth notes',division:'1/8',steps:2},{name:'sixteenth notes',division:'1/16',steps:1}]);
export function taskRhythm(remaining,window,finishIn=0){
  const ratio=remaining/Math.max(1,window),slack=remaining-finishIn;
  const index=ratio<=.15||slack<=4?3:ratio<=.3||slack<=12?2:ratio<=.55||slack<=25?1:0;
  return{...TASK_RHYTHMS[index],pressure:index,slack};
}
export function taskPulse(d,{ordinal=0,pan=0,volume=1,rider=null}={}){
  const roots={document:74,fragile:77,grocery:57},types={document:'pluck',fragile:'bell',grocery:'reed'};
  const variant=(Number(String(d.id).replace(/\D/g,''))||0)%3;
  const intervals=({document:[0,5,7],fragile:[0,2,4],grocery:[0,3,5]})[d.type]??[0,5,7];
  const pitch=(roots[d.type]??74)+(ordinal%4===3?intervals[variant]:0);
  return[note(pitch,0,rider?(RIDER_PHRASES[rider]?.instrument??types[d.type]):types[d.type],.10,(d.called?.028:d.status==='claimed'?.025:.018)*volume,pan)];
}
const note=(midi,at=0,instrument='bell',duration=.24,volume=.13,pan=0)=>({midi,at:at*beat,instrument,duration,volume,pan});
export function eventPhrase(name,{rider='Kira',cargo='document',success=true}={}) {
  const voice=RIDER_PHRASES[rider]??RIDER_PHRASES.Kira;
  const signature=voice.notes.map((n,i)=>note(n,voice.beats[i],voice.instrument,.25,.11,voice.pan));
  if(name==='rider'||name==='claim')return signature;
  if(name==='pickup')return[...signature.slice(0,1),note(voice.notes[1],.5,voice.instrument,.18,.08,voice.pan)];
  if(name==='pickup-arrival')return[note(voice.notes[0],0,'pluck',.07,.08,voice.pan),note(voice.notes[0],.25,'pluck',.07,.05,voice.pan)];
  if(name==='dropoff-arrival')return[note(voice.notes[1],0,'reed',.7,.07,voice.pan)];
  if(name==='complete')return[...signature,note(74,1.5,'bell',.55,.1),note(69,1.5,'reed',.65,.05),note(50,1.5,'pluck',.55,.09)];
  if(name==='fail'){const notes=({document:[74,69,62],fragile:[77,72,65],grocery:[57,55,50]})[cargo]??[74,69,62];return notes.map((n,i)=>note(n,i*.5,'reed',.5,.075));}
  if(name==='break')return[...signature.slice(-2).map((n,i)=>({...n,at:i*.5*beat,volume:.06})),note(50,1.5,'pluck',.4,.045)];
  if(name==='radio-on')return signature.slice(0,2);
  if(name==='spawn')return cargo==='grocery'?[note(57,0,'pluck'),note(62,.5,'pluck')]:cargo==='fragile'?[note(69,0),note(77,.5)]:[note(74,0),note(81,.25)];
  const motifs={
    'call-open':[62,67],'call-local':[67,65,62],'call-priority':[74,74,81],'call-off':[65,62],
    'bonus':[69,74,77],'client-call':[57,62,65,69],'fail':[65,62,57],
    'event-forecast':[55,60],'event-start':[50,55,60],'event-end':[57,62,69],
    'break':[65,62,57],'radio-on':[57,62],'upgrade':[62,65,69,74],
    'start':[50,57,62,65,69,74],'pause':[62,57],'finish':success?[62,65,69,74,81,74]:[65,62,57,50]
  };
  return(motifs[name]??[]).map((midi,i)=>note(midi,i*.25,['fail','break','event-forecast'].includes(name)?'reed':'pluck',.32,.09));
}

// Four short, authored bars; the harmony follows the shift's pressure/recovery.
const BARS={opening:[[50,57,62,65],[57,62,69,65],[53,60,65,69],[55,62,67,65]],
  build:[[50,62,69,74],[57,65,69,77],[53,65,72,69],[55,62,67,74]],
  recovery:[[53,60,65,69],[55,62,67,65],[50,57,62,65],[57,62,65,69]],
  push:[[50,57,69,74],[53,60,65,77],[55,62,67,74],[57,65,69,74]]};
export function scoreBar(phase,index,{riding=0,roadworks=false}={}){
  const notes=(BARS[phase]??BARS.recovery)[index%4],events=[note(notes[0],0,'pluck',.8,.055),note(notes[1],2,'pluck',.6,.035),note(notes[2],.75,'reed',.6,.025,.22)];
  if(riding)events.push(note(notes[3],2.5,'bell',.4,.03,-.2));
  if(riding>1)events.push(note(notes[2]+12,3.25,'bell',.16,.018,.2));
  if(roadworks)events.push(note(55,3,'pluck',.2,.028));
  return events;
}

// Exported for exact offline rendering and audio QA with OfflineAudioContext.
export function scheduleNote(ctx,output,n,when,onEnded=()=>{}) {
  const fundamental=440*2**((n.midi-69)/12),voices=[];
  const harmonics=n.instrument==='bell'?[[1,'sine',1],[2,'sine',.22],[3,'sine',.06]]:n.instrument==='reed'?[[1,'triangle',.72],[2,'sine',.1]]:[[1,'triangle',.8],[.5,'sine',.24]];
  for(const [ratio,type,level] of harmonics){
    const osc=ctx.createOscillator(),envelope=ctx.createGain(),filter=ctx.createBiquadFilter();
    osc.type=type;osc.frequency.value=fundamental*ratio;filter.type='lowpass';filter.frequency.value=n.instrument==='pluck'?1700:n.instrument==='reed'?2500:6500;
    const start=when+n.at,attack=n.instrument==='reed'?.035:.004;
    envelope.gain.setValueAtTime(.00001,start);envelope.gain.exponentialRampToValueAtTime(Math.max(.00002,n.volume*level*2.5),start+attack);envelope.gain.exponentialRampToValueAtTime(.00001,start+n.duration);
    osc.connect(filter);filter.connect(envelope);let tail=envelope;
    if(ctx.createStereoPanner){const pan=ctx.createStereoPanner();pan.pan.value=n.pan;envelope.connect(pan);tail=pan;}
    tail.connect(output);osc.deskEnvelope=envelope;osc.deskStart=start;osc.start(start);osc.stop(start+n.duration+.025);
    osc.addEventListener('ended',()=>{osc.disconnect();filter.disconnect();envelope.disconnect();if(tail!==envelope)tail.disconnect();onEnded(osc);});voices.push(osc);
  }
  return voices;
}

export function connectScoreOutput(ctx,master){const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=4;limiter.ratio.value=12;limiter.attack.value=.003;limiter.release.value=.14;master.connect(limiter);limiter.connect(ctx.destination);return limiter;}

export class DeskScore {
  static lastInstance=null;
  constructor(){this.ctx=null;this.master=null;this.enabled=false;this.volume=.35;this.mix='score';this.rhythms=true;this.voices=new Set();this.maxVoices=54;this.nextPulse=0;this.bar=0;this.lastCue=new Map();this.taskVoices=new Map();this.listened=[];this.duckUntil=0;this.stats={cues:0,bars:0,pulses:0,dropped:0};DeskScore.lastInstance=this;}
  ensure(){
    if(!this.enabled)return null;
    try{if(!this.ctx){const Context=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Context)return null;this.ctx=new Context();this.master=this.ctx.createGain();this.master.gain.value=this.volume;this.limiter=connectScoreOutput(this.ctx,this.master);}
      if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});return this.ctx;
    }catch{return null;}
  }
  setEnabled(enabled){this.enabled=enabled;if(!enabled){this.cancel();if(this.master)this.master.gain.value=0;this.ctx?.suspend().catch(()=>{});return false;}
    if(!this.ensure()){this.enabled=false;return false;}this.master.gain.value=this.volume;return true;
  }
  setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.master)this.master.gain.value=this.enabled?this.volume:0;}
  setMix(mix){this.mix=mix==='events'?'events':'score';this.cancel();}
  setRhythms(enabled){this.rhythms=Boolean(enabled);for(const id of this.taskVoices.keys())this.stopTask(id);this.listened=[];}
  previewRhythm(index){this.cancel();const ctx=this.ensure(),rhythm=TASK_RHYTHMS[index];if(!ctx||!rhythm)return;const start=Math.ceil((ctx.currentTime+.02)/beat)*beat;
    for(let step=0;step<16;step+=rhythm.steps)this.play(taskPulse({id:'d0',type:'document',called:true},{ordinal:step/rhythm.steps,volume:1.6}),start+step*beat/4,'preview');
  }
  stopVoice(osc){try{const now=this.ctx?.currentTime??0;if(osc.deskStart>now)osc.stop(now);else {osc.deskEnvelope.gain.cancelScheduledValues(now);osc.deskEnvelope.gain.setTargetAtTime(.00001,now,.006);osc.stop(now+.035);}}catch{}this.voices.delete(osc);}
  stopTask(id){for(const osc of this.taskVoices.get(id)??[])this.stopVoice(osc);this.taskVoices.delete(id);}
  cancel(){for(const osc of this.voices)this.stopVoice(osc);this.voices.clear();this.taskVoices.clear();this.nextPulse=0;this.listened=[];}
  suspend(){this.cancel();this.ctx?.suspend().catch(()=>{});}
  play(notes,when,taskId=null){const ctx=this.ensure();if(!ctx)return false;
    for(const n of notes){if(this.voices.size+3>this.maxVoices){this.stats.dropped++;continue;}for(const osc of scheduleNote(ctx,this.master,n,when??ctx.currentTime+.01,osc=>{this.voices.delete(osc);this.taskVoices.get(taskId)?.delete(osc);})){this.voices.add(osc);if(taskId){if(!this.taskVoices.has(taskId))this.taskVoices.set(taskId,new Set());this.taskVoices.get(taskId).add(osc);}}}return true;
  }
  cue(name,data={}){if(!this.enabled)return false;const now=performance.now()/1000,key=name+':'+(data.jobId??data.rider??'');if(now-(this.lastCue.get(key)??-Infinity)<.08)return false;this.lastCue.set(key,now);
    const notes=eventPhrase(name,data).map(n=>({...n,pan:data.pan??n.pan}));if(!notes.length)return false;
    const ctx=this.ensure();if(!ctx)return false;
    if(name==='finish')this.cancel();
    if(['complete','fail'].includes(name)){this.stopTask(data.jobId);this.duckUntil=ctx.currentTime+1.5;}
    const when=Math.ceil((ctx.currentTime+.012)/(beat/4))*(beat/4);
    this.stats.cues++;return this.play(notes,when);
  }
  update(game,{feasibility=new Map(),panFor=()=>0}={}){
    if(!this.enabled||game.paused||game.gameOver||game.upgradePending||globalThis.document?.hidden)return;
    const ctx=this.ensure();if(!ctx)return;
    const active=game.activeDeliveries(),ids=new Set(active.map(d=>d.id));for(const id of this.taskVoices.keys())if(!ids.has(id))this.stopTask(id);
    const ranked=active.map(d=>{const rider=game.courierById(d.courierId),remaining=d.deadlineAt-game.elapsed;
      const estimate=feasibility.get(d.id),finishIn=rider?game.courierETA(rider):estimate?estimate.best?.finishIn??Infinity:0;
      return{d,rider,...taskRhythm(remaining,d.deadlineAt-d.createdAt,finishIn)};
    }).sort((a,b)=>b.pressure-a.pressure||a.slack-b.slack||a.d.id.localeCompare(b.d.id)).slice(0,3);
    this.listened=this.rhythms?ranked.map(t=>({id:t.d.id,division:t.division,pressure:t.pressure,slack:t.slack})):[];
    const foreground=new Set(ranked.map(t=>t.d.id));for(const id of this.taskVoices.keys())if(!foreground.has(id))this.stopTask(id);
    const tick=beat/4,now=ctx.currentTime;if(!this.nextPulse||this.nextPulse<now-.3)this.nextPulse=Math.ceil((now+.015)/tick)*tick;
    const moving=game.couriers.filter(c=>['pickup','dropoff'].includes(c.phase));
    while(this.nextPulse<now+.20){
      const at=this.nextPulse,step=Math.round(at/tick),duck=at<this.duckUntil?.28:1;
      if(this.mix==='score'&&step%16===0){this.play(scoreBar(game.phase().id,this.bar++,{riding:moving.length,roadworks:game.currentEvent?.state==='active'}).map(n=>({...n,volume:n.volume*duck})),at);this.stats.bars++;}
      if(this.rhythms)for(let i=0;i<ranked.length;i++){
        const t=ranked[i];if(step%t.steps!==(i%t.steps))continue;
        const point=t.rider??game.nodeById(t.d.pickupId);
        this.play(taskPulse(t.d,{ordinal:Math.floor(step/t.steps),pan:panFor(point),volume:duck*(i===0?1:.52),rider:t.rider?.name}),at,t.d.id);this.stats.pulses++;
      }
      // One quiet pedal voice on each offbeat, cycling through actual moving riders.
      if(this.mix==='score'&&moving.length&&step%8===4){const rider=moving[Math.floor(step/8)%moving.length],voice=RIDER_PHRASES[rider.name],edge=game.edgeByIds(rider.path[rider.pathIndex-1],rider.path[rider.pathIndex]);
        this.play([note(voice.notes[0]-(edge?.eventMultiplier<1?12:0),0,voice.instrument,.085,.018*duck,panFor(rider))],at);
      }
      this.nextPulse+=tick;
    }
  }
}
