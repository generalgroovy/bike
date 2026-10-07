import test from 'node:test';
import assert from 'node:assert/strict';
import {isGameShortcut} from '../src/keyboard-shortcuts.js';

test('game shortcuts leave typing, native button activation and browser commands alone',()=>{
  globalThis.document={querySelector:()=>null};
  for(const property of ['repeat','ctrlKey','metaKey','altKey','defaultPrevented'])assert.equal(isGameShortcut({key:'h',[property]:true}),false);
  assert.equal(isGameShortcut({key:'h',target:{isContentEditable:true}}),false);
  assert.equal(isGameShortcut({key:'2',target:{closest:selector=>selector.startsWith('input')?{}:null}}),false);
  assert.equal(isGameShortcut({key:' ',target:{closest:selector=>selector.startsWith('button')?{}:null}}),false);
  assert.equal(isGameShortcut({key:' ',target:{closest:selector=>selector.split(',').includes('summary')?{}:null}}),false);
  assert.equal(isGameShortcut({key:' ',target:{}}),true);
});
test('open dialogs and help isolate underlying game controls',()=>{
  globalThis.document={querySelector:selector=>selector==='dialog[open]'?{}:null};
  assert.equal(isGameShortcut({key:'1'},{allowHelp:true}),false);
  globalThis.document={querySelector:selector=>selector.startsWith('#help')?{}:null};
  assert.equal(isGameShortcut({key:'g'}),false);
  assert.equal(isGameShortcut({key:'Escape'},{allowHelp:true}),true);
  delete globalThis.document;
});
