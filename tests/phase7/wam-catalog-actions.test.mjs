import test from 'node:test';
import assert from 'node:assert/strict';
import {FxChainView} from '../../examples/wam/FxChainView.js';

class Element {
 constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};}
 append(...children){for(const child of children){if(typeof child==='string')continue;child.parent=this;this.children.push(child);}}
 setAttribute(key,value){this.attributes[key]=value;}
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
  insert:async(...args)=>calls.push(['insert',...args]),replace:async(...args)=>{calls.push(['replace',...args]);return entry;}},
  report:(...args)=>calls.push(['error',...args]),cards:new Map(),container:{querySelector:()=>null},open:async(...args)=>calls.push(['open',...args]),
  dialog:{open:true},activeId:entry.id,replaceButton:new Element('tl-button')});
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
test('Replace opens catalog over editor, cancel keeps instance, success opens same slot',async()=>{
 const f=setup();try{
  const cancelled=f.view.replaceActive();assert.equal(f.view.replaceActive(),cancelled);cancelled.close();
  assert.equal(f.view.dialog.open,true);assert.equal(f.calls.length,0);
  const dialog=f.view.replaceActive(),{item,preview}=card(dialog);await item.ondblclick({target:preview});
  assert.deepEqual(f.calls,[['replace',f.entry.id,f.record],['open',f.entry.id,undefined]]);
  assert.equal(dialog.open,false);
 }finally{f.restore();}
});
test('failed replacement preserves editor and permits retry from Insert/Replace button',async()=>{
 const f=setup();try{
  f.view.chain.replace=async()=>{throw Error('Cannot load module');};
  const dialog=f.view.replaceActive(),{insert}=card(dialog);await insert.onclick();
  assert.equal(dialog.open,true);assert.equal(f.view.dialog.open,true);assert.equal(insert.disabled,false);
  assert.deepEqual(f.calls,[['error','Cannot load module',true]]);
  f.view.chain.replace=async()=>f.entry;await insert.onclick();assert.equal(dialog.open,false);
 }finally{f.restore();}
});
