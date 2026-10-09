import test from 'node:test';
import assert from 'node:assert/strict';
import {DeskScore,SCORE,DISPATCHER_VOICE,TASK_RHYTHMS,taskRhythm,taskPulse,eventPhrase,scoreBar,scheduleNote} from '../src/playtest-score.js';

const tick=60/SCORE.bpm/4;
function fixture({remaining=100,window=100,finishIn=5,count=1}={}){
  const jobs=Array.from({length:count},(_,i)=>Object.freeze({id:`d${i}`,type:'document',status:'waiting',deadlineAt:remaining,createdAt:remaining-window,pickupId:'n0',called:true}));
  const game=Object.freeze({elapsed:0,paused:false,gameOver:false,upgradePending:false,couriers:[],activeDeliveries:()=>jobs,courierById:()=>null,nodeById:()=>({x:15,y:40}),phase:()=>({id:'opening'})});
  const feasibility=new Map(jobs.map(d=>[d.id,{best:{finishIn}}]));
  const score=new DeskScore(),calls=[];score.enabled=true;score.ctx={currentTime:0};score.ensure=()=>score.ctx;score.play=(notes,at,id)=>calls.push({notes,at,id});
  return{score,calls,game,feasibility,jobs};
}

test('task pressure accelerates at the deadline fractions and real finish buffers',()=>{
  assert.deepEqual([100,50,25,10].map(left=>taskRhythm(left,100,0).division),['1/2','1/4','1/8','1/16']);
  assert.deepEqual([70,80,90,98].map(eta=>taskRhythm(100,100,eta).division),['1/2','1/4','1/8','1/16']);
  assert.equal(taskRhythm(100,100,Infinity).division,'1/16');
  assert.equal(taskRhythm(10,100,7).division,'1/16');
  assert.equal(taskRhythm(30,120,7).division,'1/8','negotiation releases some pressure');
});

test('transport produces 2, 4, 8 and 16 task notes per bar on one grid',()=>{
  for(const [i,remaining] of [100,50,25,10].entries()){
    const {score,calls,game,feasibility}=fixture({remaining,finishIn:0});score.mix='events';
    for(let step=0;step<16;step++){score.ctx.currentTime=step*tick;score.update(game,{feasibility,panFor:()=>-.7});}
    const pulses=calls.filter(c=>c.id&&c.at<16*tick+.00001);
    assert.equal(pulses.length,16/TASK_RHYTHMS[i].steps);
    assert.ok(pulses.every(c=>Math.abs(c.at/tick-Math.round(c.at/tick))<1e-8));
    assert.ok(pulses.every(c=>c.notes[0].pan===-.7));
    assert.equal(score.listened[0].division,TASK_RHYTHMS[i].division);
  }
});

test('only three urgent tasks enter the foreground and stale task voices are removed',()=>{
  const {score,game,feasibility,jobs}=fixture({count:10,remaining:80});
  feasibility.set('d7',{best:{finishIn:78}});feasibility.set('d9',{best:{finishIn:75}});
  const snapshot=JSON.stringify(jobs),stopped=[];score.stopTask=id=>{stopped.push(id);score.taskVoices.delete(id);};score.taskVoices.set('finished',new Set());
  score.update(game,{feasibility});assert.equal(score.listened.length,3);assert.equal(score.listened[0].id,'d7');assert.equal(score.listened[1].id,'d9');assert.deepEqual(stopped,['finished']);
  assert.equal(JSON.stringify(jobs),snapshot);
  score.setRhythms(false);score.update(game,{feasibility});assert.deepEqual(score.listened,[]);
});

test('missing forecast does not invent an impossible trip and pause schedules nothing',()=>{
  const {score,calls,game}=fixture();score.update(game);assert.equal(score.listened[0].division,'1/2');
  calls.length=0;score.update({...game,paused:true});assert.equal(calls.length,0);
  score.enabled=false;score.update(game);assert.equal(calls.length,0);
});

test('two parcels on one rider keep independent musical deadline pressure',()=>{
  const {score,game}=fixture({count:2,remaining:100});
  const rider={id:'c0',name:'Kira',phase:'waiting-window'};
  const logistics={...game,logistics:true,couriers:[rider],courierById:()=>rider,
    jobETA:(_c,d)=>d.id==='d0'?5:98,courierETA:()=>98};
  score.update(logistics);
  assert.equal(score.listened.find(task=>task.id==='d0').division,'1/2');
  assert.equal(score.listened.find(task=>task.id==='d1').division,'1/16');
});

test('window cues describe actual transitions once and never replay muted or saved history',()=>{
  const {score,game}=fixture(),cues=[];
  score.cue=(name,data)=>cues.push({name,...data});
  const rider={id:'c0',name:'Mauro',phase:'dropoff',deliveryId:'d0'};
  const scene={...game,couriers:[rider]};
  score.observeField(scene,()=>.3,true);
  rider.phase='waiting-window';score.observeField(scene,()=>.3,true);score.observeField(scene,()=>.3,true);
  rider.phase='handover';score.observeField(scene,()=>.3,true);
  assert.deepEqual(cues.map(c=>c.name),['window-wait','window-open']);
  assert.ok(cues.every(c=>c.jobId==='d0'&&c.rider==='Mauro'&&c.pan===.3));
  rider.phase='waiting-window';score.observeField(scene,()=>0,false);
  rider.phase='handover';score.observeField(scene,()=>0,false);score.observeField(scene,()=>0,true);
  assert.equal(cues.length,2);
  score.observeField({...scene},()=>0,true);assert.equal(cues.length,2,'new run establishes a silent baseline');
});

test('a second accepted parcel answers the rider signature without hiding their identity',()=>{
  for(const rider of ['Kira','Mauro','Brian']){
    const normal=eventPhrase('claim',{rider});
    const combined=eventPhrase('claim',{rider,mode:'on the way'});
    assert.deepEqual(combined.slice(0,normal.length),normal);
    assert.equal(combined.length,normal.length+2);
  }
  assert.notDeepEqual(eventPhrase('window-wait'),eventPhrase('window-open'));
  assert.ok(['window-wait','window-open'].flatMap(name=>eventPhrase(name)).every(n=>[0,2,5,7,9].includes(n.midi%12)&&n.volume<=.1));
});

test('completion and failure stop their task and resolve on the same sixteenth grid',()=>{
  for(const name of ['complete','fail']){
    const {score,calls}=fixture();score.ctx.currentTime=.237;const stopped=[];score.stopTask=id=>stopped.push(id);
    score.cue(name,{jobId:'d4',rider:'Mauro',cargo:'grocery',pan:.65});
    assert.deepEqual(stopped,['d4']);assert.ok(score.duckUntil>score.ctx.currentTime+1);
    assert.ok(calls[0].at>=score.ctx.currentTime);assert.ok(calls[0].at-score.ctx.currentTime<tick+.012);
    assert.ok(calls[0].notes.every(n=>n.pan===(n.source==='dispatcher'?0:.65)),'the rider stays on the map while dispatch answers at the desk');
  }
  assert.notDeepEqual(eventPhrase('fail'),eventPhrase('break'));
});

test('dispatcher questions have their own centered voice and only actual acceptance gets a rider answer',()=>{
  const actions=['call-open','call-local','call-priority','call-off','prefer','bonus','client-call'];
  const phrases=actions.map(action=>eventPhrase(action,{rider:'Mauro'}));
  assert.equal(DISPATCHER_VOICE.instrument,'desk');
  for(const phrase of phrases){
    assert.ok(phrase.length>=2&&phrase.length<=3);
    assert.ok(phrase.every(n=>n.instrument==='desk'&&n.source==='dispatcher'&&n.pan===0));
    assert.ok(phrase.every(n=>n.volume<.08&&[0,2,5,7,9].includes(n.midi%12)));
    assert.ok(phrase.every(n=>Math.abs(n.at/tick-Math.round(n.at/tick))<1e-8));
  }
  assert.equal(new Set(phrases.map(phrase=>JSON.stringify(phrase))).size,actions.length);
  for(const rider of ['Kira','Mauro','Brian'])for(const action of ['claim','complete']){
    const phrase=eventPhrase(action,{rider}),identity=eventPhrase('rider',{rider});
    assert.deepEqual(phrase.slice(0,identity.length),identity,'actual rider identity leads the response');
    const answer=phrase.filter(n=>n.source==='dispatcher');
    assert.equal(answer.length,2);
    assert.ok(answer[0].at>=Math.max(...identity.map(n=>n.at+n.duration)),'the desk leaves room for the rider to finish');
  }
  const {score,calls}=fixture();score.cue('call-local',{jobId:'d9',pan:.8});
  assert.ok(calls[0].notes.every(n=>n.pan===0));
  assert.ok(score.duckUntil>score.ctx.currentTime,'the accompaniment makes space for a real call');
});

test('busy radio is bounded and important outcomes replace routine chatter',()=>{
  const {score,calls}=fixture(),stopped=[];
  score.stopVoice=voice=>stopped.push(voice);
  assert.ok(score.cue('spawn',{jobId:'new1'}));
  const first=[...score.eventCues.values()][0],quietVoice={};first.voices.add(quietVoice);
  assert.ok(score.cue('spawn',{jobId:'new2'}));
  assert.equal(score.cue('spawn',{jobId:'new3'}),false);
  assert.equal(score.eventCues.size,2);
  assert.ok(score.cue('claim',{jobId:'accepted',rider:'Brian'}));
  assert.deepEqual(stopped,[quietVoice]);
  assert.ok(score.cue('complete',{jobId:'delivered',rider:'Mauro'}));
  assert.deepEqual([...score.eventCues.values()].map(group=>group.name).sort(),['claim','complete']);
  assert.equal(score.cue('pickup-arrival',{jobId:'another'}),false,'tiny handling steps cannot cover a delivery reply');
  assert.equal(score.eventCues.size,2);
  assert.equal(calls.length,4,'only admitted exchanges are scheduled');
  score.ctx.currentTime=5;
  assert.ok(score.cue('spawn',{jobId:'fresh'}),'routine cues return after the exchange');
  assert.equal(score.eventCues.size,1);
  score.cancel();assert.equal(score.eventCues.size,0);assert.equal(score.duckUntil,0);
});

test('a muted outcome still removes its old task pulse when the foreground is occupied',()=>{
  const {score}=fixture(),stopped=[];
  score.stopTask=id=>stopped.push(id);
  score.cue('complete',{jobId:'first'});score.cue('complete',{jobId:'second'});
  assert.equal(score.cue('complete',{jobId:'third'}),false);
  assert.deepEqual(stopped,['first','second','third']);
  assert.equal(score.eventCues.size,2);
});

function synthFixture(){
  const oscillators=[],filters=[];
  const parameter=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push({kind:'set',value,at});},exponentialRampToValueAtTime(value,at){this.events.push({kind:'ramp',value,at});},cancelScheduledValues(){},setTargetAtTime(){}});
  const node=()=>({connect(){},disconnect(){}});
  const ctx={currentTime:0,
    createOscillator(){const osc={...node(),frequency:parameter(),start(at){this.startedAt=at;},stop(at){this.stoppedAt=at;},addEventListener(){}};oscillators.push(osc);return osc;},
    createGain:()=>({...node(),gain:parameter()}),
    createBiquadFilter(){const filter={...node(),frequency:parameter()};filters.push(filter);return filter;},
    createStereoPanner:()=>({...node(),pan:parameter()})};
  return{ctx,oscillators,filters,output:node()};
}

test('the wooden dispatcher voice uses two filtered tonal oscillators and preserves the global ceiling',()=>{
  const {ctx,oscillators,filters,output}=synthFixture();
  const phrase=eventPhrase('call-open');
  const voices=scheduleNote(ctx,output,phrase[0],1);
  assert.equal(voices.length,2);
  assert.ok(voices.every(osc=>osc.type==='sine'));
  assert.ok(filters.every(filter=>filter.frequency.value===1800));
  for(const osc of voices){
    assert.equal(osc.frequency.events.length,2);
    assert.ok(osc.frequency.events[0].value>osc.frequency.events[1].value,'a tiny pitch fall gives the soft wooden attack');
    assert.ok(osc.stoppedAt-osc.startedAt<.2);
  }
  const score=new DeskScore();score.enabled=true;score.ctx=ctx;score.master=output;score.ensure=()=>ctx;
  score.play(Array.from({length:100},()=>phrase[0]),1);
  assert.equal(score.maxVoices,54);
  assert.ok(score.voices.size<=54);
  assert.ok(score.stats.dropped>0);
  score.cancel();assert.equal(score.voices.size,0);
  assert.ok(oscillators.every(osc=>Number.isFinite(osc.stoppedAt)));
});

test('all composed notes have finite, bounded synth parameters and distinct rider phrases',()=>{
  const names=['rider','claim','pickup','pickup-arrival','dropoff-arrival','complete','spawn','call-open','call-local','call-priority','call-off','bonus','client-call','fail','event-forecast','event-start','event-end','break','radio-on','upgrade','start','pause','finish'];
  const notes=names.flatMap(name=>eventPhrase(name)).concat(...['opening','build','recovery','push'].flatMap(phase=>[0,1,2,3].map(i=>scoreBar(phase,i,{riding:3,roadworks:true}))),...['document','fragile','grocery'].map(type=>taskPulse({id:'d0',type})));
  assert.ok(notes.length>100);assert.ok(notes.every(n=>[n.midi,n.at,n.duration,n.volume,n.pan].every(Number.isFinite)&&n.duration>0&&n.volume>=0&&n.volume<=.2&&Math.abs(n.pan)<=1));
  assert.equal(new Set(['Kira','Mauro','Brian'].map(rider=>JSON.stringify(eventPhrase('rider',{rider})))).size,3);
  for(const type of ['document','fragile','grocery'])for(let serial=0;serial<3;serial++){
    const phrase=[...taskPulse({id:`d${serial}`,type},{ordinal:3}),...eventPhrase('fail',{cargo:type})];
    assert.ok(phrase.every(n=>[0,2,5,7,9].includes(n.midi%12)),'task and resolution stay in D minor pentatonic');
  }
});

test('wellbeing motifs remain distinct, quiet and tied to each rider on the musical grid',()=>{
  const events=['rider-restless','rider-warning','rider-recovered','rider-left'];
  for(const rider of ['Kira','Mauro','Brian']){
    const phrases=events.map(name=>eventPhrase(name,{rider,pan:.7}));
    assert.equal(new Set(phrases.map(phrase=>JSON.stringify(phrase))).size,4);
    for(const phrase of phrases){
      assert.ok(phrase.length>=2&&phrase.length<=3);
      assert.ok(phrase.every(n=>[0,2,5,7,9].includes(n.midi%12)&&n.volume<=.08));
      assert.ok(phrase.every(n=>Math.abs(n.at/tick-Math.round(n.at/tick))<1e-8));
    }
  }
  const {score,calls}=fixture();
  score.cue('spawn',{jobId:'d1'});score.cue('spawn',{jobId:'d2'});
  assert.ok(score.cue('rider-warning',{rider:'Mauro',pan:.7}));
  assert.ok(score.cue('rider-left',{rider:'Kira',pan:-.6}));
  assert.equal(score.eventCues.size,2);
  assert.deepEqual([...score.eventCues.values()].map(c=>c.name).sort(),['rider-left','rider-warning']);
  assert.ok(calls.at(-2).notes.every(n=>n.pan===(n.source==='dispatcher'?0:.7)));
  assert.equal(score.cue('spawn',{jobId:'d3'}),false);
});
