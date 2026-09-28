import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('help moves keyboard focus inside, restores it and preserves pause state',()=>{
  let focused='';
  const origin={isConnected:true,focus(){focused='origin';}};
  const game={paused:false};const helpPanel={hidden:true};
  const context=vm.createContext({game,helpPanel,document:{activeElement:origin,body:{}},$:id=>({focus(){focused=id;}}),helpPauseWas:false,writeLocal(){},renderUI(){}});
  vm.runInContext(source.slice(source.indexOf('let helpReturnFocus'),source.indexOf("canvas.addEventListener('wheel'")),context);
  vm.runInContext('toggleHelp()',context);
  assert.equal(helpPanel.hidden,false);assert.equal(focused,'#help-close');assert.equal(game.paused,true);
  vm.runInContext('toggleHelp()',context);
  assert.equal(helpPanel.hidden,true);assert.equal(focused,'origin');assert.equal(game.paused,false);
  game.paused=true;vm.runInContext('toggleHelp();toggleHelp()',context);assert.equal(game.paused,true);
});

test('Escape consumed by help is marked handled for an embedding workspace',()=>{
  let keydown,closed=false;
  const helpPanel={hidden:false};
  const context=vm.createContext({window:{addEventListener(name,fn){if(name==='keydown')keydown=fn;}},isGameShortcut:()=>true,helpPanel,toggleHelp(show){closed=!show;helpPanel.hidden=!show;}});
  vm.runInContext(source.slice(source.indexOf("window.addEventListener('keydown'"),source.indexOf("window.addEventListener('resize'")),context);
  const event={key:'Escape',defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
  keydown(event);
  assert.equal(closed,true);assert.equal(event.defaultPrevented,true);
});
