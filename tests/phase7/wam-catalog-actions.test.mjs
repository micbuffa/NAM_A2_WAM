import test from 'node:test';
import assert from 'node:assert/strict';
import {FxChainView} from '../../examples/wam/FxChainView.js';

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};}
 append(...children){for(const child of children){if(typeof child==='string')continue;child.parent=this;this.children.push(child);}}
 setAttribute(key,value){this.attributes[key]=value;}
 removeAttribute(key){delete this.attributes[key];}
 addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
 emit(type){const event={preventDefault(){this.defaultPrevented=true;}};for(const callback of this.listeners[type]??[])callback(event);return event;}
 querySelectorAll(selector){const selectors=selector.split(',');return this.children.flatMap(child=>[...(selectors.includes(child.tagName)?[child]:[]),...child.querySelectorAll(selector)]);}
 closest(selector){return selector.split(',').includes(this.tagName)?this:this.parent?.closest(selector);}
 showModal(){this.open=true;}
 close(){this.open=false;this.emit('close');}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
 focus(){}
}
function setup(){
 const previous=globalThis.document;globalThis.document={createElement:tag=>new Element(tag),body:new Element('body')};
 const record={name:'Test delay',category:'delay',thumbnailUrl:'/test.png',entryUrl:'/test/index.js'};
 const entry={id:'same-slot',record,inputDb:-7,outputDb:2};const calls=[];
 const view=Object.assign(Object.create(FxChainView.prototype),{options:{},chain:{entries:[entry],registry:{records:[record]},find:()=>entry,
  insert:async(...args)=>calls.push(['insert',...args])},
  report:(...args)=>calls.push(['error',...args]),cards:new Map(),container:{querySelector:()=>null},open:async(...args)=>calls.push(['open',...args]),
  dialog:{open:true},activeId:entry.id});
 return {view,record,entry,calls,restore:()=>{globalThis.document=previous;}};
}
function card(dialog){const item=dialog.querySelectorAll('article')[0];return {item,preview:item.children[0],insert:item.children[1],uri:item.children[2]};}
test('catalog double-click and Insert share one guarded operation; URI double-click does not insert',async()=>{
 const f=setup();try{
  let resolve;f.view.chain.insert=(...args)=>{f.calls.push(['insert',...args]);return new Promise(done=>resolve=done);};
  const dialog=f.view.showMenu('before-slot'),{item,preview,insert,uri}=card(dialog);
  item.ondblclick({target:uri});assert.equal(f.calls.length,0);
  const pending=item.ondblclick({target:preview.children[0]});
  await insert.onclick();await item.ondblclick({target:preview});
  assert.deepEqual(f.calls,[['insert',f.record,'before-slot','after']]);
  assert.equal(dialog.emit('cancel').defaultPrevented,true);
  resolve();await pending;assert.equal(dialog.open,false);
 }finally{f.restore();}
});
test('the GUI main action (amp: Change amp model) is the editor bar primary button',()=>{
 const f=setup();try{
  const button=new Element('tl-button');button.hidden=true;let runs=0;f.view.primaryAction=button;
  button.onclick=()=>f.view.gui?.editorPrimaryAction?.run();
  f.view.gui={editorPrimaryAction:{label:'Change amp model',icon:'audio',run:()=>runs++}};f.view.syncPrimaryAction();
  assert.equal(button.hidden,false);assert.equal(button.textContent,'Change amp model');assert.equal(button.attributes.icon,'audio');
  button.onclick();assert.equal(runs,1);
  f.view.gui={};f.view.syncPrimaryAction();assert.equal(button.hidden,true);
 }finally{f.restore();}
});
test('editor settings key summarises large payloads but still sees a model or parameter change',()=>{
 const model='x'.repeat(5000),key=FxChainView.settingsKey;
 const a={state:{model:{data:model+'a'},parameterValues:{gain:{value:1}},ir:new Float32Array([1,2,3,4])},inputDb:0};
 assert.ok(key(a).length<1000);assert.equal(key(a),key(structuredClone(a)));
 assert.notEqual(key(a),key({...a,state:{...a.state,model:{data:model+'b'}}}));
 assert.notEqual(key(a),key({...a,state:{...a.state,parameterValues:{gain:{value:2}}}}));
 assert.notEqual(key(a),key({...a,inputDb:-1}));
});
test('editor bar shows the rack card picture',()=>{
 const f=setup();try{
  const photo=new Element('img');photo.hidden=true;photo.getAttribute=key=>photo.attributes[key]??null;f.view.photo=photo;
  f.view.cards.set(f.entry.id,{image:{currentSrc:'/models/fender/cover.jpg'}});
  f.view.syncEditorPhoto(f.entry,'Fender Deluxe');assert.equal(photo.hidden,false);assert.equal(photo.attributes.src,'/models/fender/cover.jpg');assert.equal(photo.title,'Fender Deluxe');
  f.view.cards.set(f.entry.id,{image:{currentSrc:''}});f.view.syncEditorPhoto(f.entry,'x');assert.equal(photo.hidden,true);assert.equal(photo.attributes.src,undefined);
 }finally{f.restore();}
});
test('editor bar subtitle uses the GUI credit, with the amp / cabinet defaults',()=>{
 const f=setup();try{
  const text=()=>{const e=new Element('p');e.textContent='';return e;};
  Object.assign(f.view,{title:text(),subtitle:text(),syncEditorPhoto(){},syncEditorState(){},dialog:{open:true}});
  const nam={id:'amp',kind:'nam',record:{name:'NeuralWAMp Amp Sim'},plugin:{audioNode:{getModelSnapshot:()=>({provenance:{title:'Fender'}})}}};
  f.view.chain.find=()=>nam;f.view.activeId='amp';
  nam.gui=f.view.gui={editorCredit:'Factory · Modeled by amalgamaudio'};f.view.syncEditorHeader();
  assert.equal(f.view.title.textContent,'Fender');assert.equal(f.view.subtitle.textContent,'NeuralWAMp Amp Sim · Factory · Modeled by amalgamaudio');
  nam.gui=f.view.gui={editorCredit:''};f.view.syncEditorHeader();assert.equal(f.view.subtitle.textContent,'NeuralWAMp Amp Sim · Active model');
  // A GUI still loading for another module does not lend its credit.
  nam.gui={};f.view.gui={editorCredit:'Other'};f.view.syncEditorHeader();assert.equal(f.view.subtitle.textContent,'NeuralWAMp Amp Sim · Active model');
 }finally{f.restore();}
});
test('amp and cabinet GUIs implement the host editor contract and hide what the bar shows',async()=>{
 const {readFile}=await import('node:fs/promises');
 const nam=await readFile(new URL('../../src/nam-wam/gui.js',import.meta.url),'utf8'),cab=await readFile(new URL('../../src/cabinet-wam/gui.js',import.meta.url),'utf8');
 for(const source of [nam,cab]){assert.match(source,/get editorPrimaryAction\(\)/u);assert.match(source,/get editorCredit\(\)/u);}
 assert.match(nam,/label:'Change amp model'/u);assert.match(cab,/label:'Change cabinet model'/u);
 assert.match(nam,/nam-a2-gui\[host-tabs\] \.change-model,nam-a2-gui\[host-tabs\] \.editor-navigation/u);
 for(const hidden of ['.current-artwork','.currentIr','.change-ir'])assert.ok(cab.includes(`nam-cabinet-gui[host-tabs] ${hidden}`),hidden);
});
