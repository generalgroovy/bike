import test from 'node:test';
import assert from 'node:assert/strict';
import {DeskScore,SCORE,TASK_RHYTHMS,taskRhythm,taskPulse,eventPhrase,scoreBar} from '../src/playtest-score.js';

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

test('completion and failure stop their task and resolve on the same sixteenth grid',()=>{
  for(const name of ['complete','fail']){
    const {score,calls}=fixture();score.ctx.currentTime=.237;const stopped=[];score.stopTask=id=>stopped.push(id);
    score.cue(name,{jobId:'d4',rider:'Mauro',cargo:'grocery',pan:.65});
    assert.deepEqual(stopped,['d4']);assert.ok(score.duckUntil>score.ctx.currentTime+1);
    assert.ok(calls[0].at>=score.ctx.currentTime);assert.ok(calls[0].at-score.ctx.currentTime<tick+.012);
    assert.ok(calls[0].notes.every(n=>n.pan===.65));
  }
  assert.notDeepEqual(eventPhrase('fail'),eventPhrase('break'));
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
