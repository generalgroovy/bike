import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('playback controls expose the current action and selected running speed',()=>{
  const attributes=()=>({attrs:{},setAttribute(name,value){this.attrs[name]=value;}});
  const pause=attributes();
  const speeds=[1,2,4].map(speed=>({...attributes(),dataset:{speed:String(speed)},classList:{toggle(name,on){this.active=on;}}}));
  const game={paused:false,speed:2};
  const context=vm.createContext({game,$:()=>pause,setText:(el,value)=>el.textContent=value,document:{querySelectorAll:()=>speeds}});
  const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  vm.runInContext(source.slice(source.indexOf('function syncPlaybackControls'),source.indexOf('function renderUI')),context);
  vm.runInContext('syncPlaybackControls()',context);
  assert.equal(pause.attrs['aria-label'],'Pause');assert.equal(pause.title,'Pause (Space)');
  assert.deepEqual(speeds.map(button=>button.attrs['aria-pressed']),['false','true','false']);
  game.paused=true;vm.runInContext('syncPlaybackControls()',context);
  assert.equal(pause.attrs['aria-label'],'Resume');assert.equal(pause.title,'Resume (Space)');
  assert.ok(speeds.every(button=>button.attrs['aria-pressed']==='false'&&!button.classList.active));
  game.paused=false;game.speed=4;vm.runInContext('syncPlaybackControls()',context);
  assert.deepEqual(speeds.map(button=>button.attrs['aria-pressed']),['false','false','true']);
});
