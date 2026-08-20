import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

test('critical timeline keeps causal milestones and late failures in chronological order',()=>{
  const g=new Game({seed:'TIMELINE'});g.elapsed=180;g.dispatchLog=[
    {at:10,action:'call',deliveryId:'d1',radioUsed:1,cityLevel:1},
    {at:35,action:'city-expand',stage:'Inner City',radioUsed:2,cityLevel:2},
    {at:62,action:'event-forecast',title:'HEAVY RAIN',place:'Mitte',radioUsed:2,cityLevel:2},
    {at:70,action:'event-response',kind:'route',place:'Mitte',radioUsed:2,cityLevel:2},
    {at:84,action:'event-start',title:'HEAVY RAIN',place:'Mitte',radioUsed:3,cityLevel:2},
    {at:112,action:'break',rider:'Kira',radioUsed:3,cityLevel:2},
    {at:138,action:'radio-denied',deliveryId:'d8',radioUsed:4,cityLevel:2},
    {at:150,action:'fail',deliveryId:'d6',kind:'called-unclaimed',radioUsed:4,cityLevel:2},
    {at:176,action:'collapse',deliveryId:'d9',radioUsed:4,cityLevel:2}
  ];
  const timeline=g.criticalTimeline({limit:12,window:80});
  assert.ok(timeline.some(x=>x.action==='city-expand'));
  assert.ok(timeline.some(x=>x.action==='event-response'));
  assert.ok(timeline.some(x=>x.action==='radio-denied'));
  assert.equal(timeline.at(-1).action,'collapse');
  for(let i=1;i<timeline.length;i++)assert.ok(timeline[i].at>=timeline[i-1].at);
  assert.ok(timeline.every(x=>typeof x.label==='string'&&x.label.length>3));
});

test('critical timeline trims low-value radio chatter and repeated duplicates',()=>{
  const g=new Game({seed:'TIMELINE-TRIM'});g.elapsed=120;g.dispatchLog=[];
  for(let i=0;i<30;i++)g.dispatchLog.push({at:i,action:'call',deliveryId:`d${i}`,radioUsed:i%4,cityLevel:1});
  g.dispatchLog.push({at:92,action:'break',rider:'Mauro',radioUsed:3,cityLevel:1});
  g.dispatchLog.push({at:92.2,action:'break',rider:'Mauro',radioUsed:3,cityLevel:1});
  g.dispatchLog.push({at:111,action:'fail',deliveryId:'d20',kind:'never-called',radioUsed:4,cityLevel:1});
  const timeline=g.criticalTimeline({limit:8,window:60});
  assert.equal(timeline.filter(x=>x.action==='break').length,1);
  assert.equal(timeline.some(x=>x.action==='call'),false);
  assert.ok(timeline.length<=8);
});
