import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackControlStyle,appendTrackControlGlyphs,appendTrackControlPreference} from '../../examples/wam/ui/TrackControlStyle.js';
function setup(saved=null,blocked=false){
 const events=new EventTarget(),writes=[],root={dataset:{theme:'warm'}};
 const style=new TrackControlStyle({root,events,storage:{getItem(){if(blocked)throw Error('denied');return saved;},setItem(k,v){if(blocked)throw Error('denied');writes.push([k,v]);}}});
 return{style,root,writes,storage(key,value){events.dispatchEvent(Object.assign(new Event('storage'),{key,newValue:value}));}};
}
test('track control styles restore with the current icon convention as default and reject unknown choices',()=>{
 for(const saved of [null,'unknown','logic','ableton','reaper']){const f=setup(saved);assert.equal(f.style.preference,['logic','ableton','reaper'].includes(saved)?saved:'reaper');assert.equal(f.root.dataset.trackControls,f.style.preference);assert.equal(f.root.dataset.theme,'warm');}
 const f=setup();f.style.set('logic');assert.deepEqual(f.writes,[['nam-a2.track-controls','logic']]);assert.throws(()=>f.style.set('other'),/Unknown/);assert.equal(f.style.preference,'logic');
});
test('blocked storage permits session changes and cross-tab events synchronize or reset styles independently from theme',()=>{
 const f=setup(null,true);f.style.set('ableton');assert.equal(f.root.dataset.trackControls,'ableton');assert.equal(f.writes.length,0);
 f.storage('unrelated','logic');assert.equal(f.style.preference,'ableton');f.storage('nam-a2.track-controls','logic');assert.equal(f.style.preference,'logic');
 f.storage(null,null);assert.equal(f.style.preference,'reaper');assert.equal(f.root.dataset.theme,'warm');
 f.style.destroy();f.storage('nam-a2.track-controls','ableton');assert.equal(f.root.dataset.trackControls,undefined);
});
function documentFixture(){
 const createElement=tag=>({tag,children:[],attrs:{},append(...children){this.children.push(...children);},setAttribute(k,v){this.attrs[k]=v;}});
 return{createElement,createTextNode:text=>({text})};
}
test('glyph variants preserve button identity, handler and accessible pressed state',()=>{
 const doc=documentFixture(),button=doc.createElement('button'),click=()=>{};button.onclick=click;button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','Arm recording Solo');
 appendTrackControlGlyphs(button,'arm',doc);assert.equal(button.children.length,3);assert.equal(button.children[0].textContent,'R');assert.equal(button.children[1].attrs.name,'record');assert.equal(button.children[2].attrs.name,'microphone');
 assert.ok(button.children.every(n=>n.attrs['aria-hidden']==='true'));assert.equal(button.onclick,click);assert.equal(button.attrs['aria-pressed'],'true');assert.equal(button.attrs['aria-label'],'Arm recording Solo');
 const monitor=doc.createElement('button');appendTrackControlGlyphs(monitor,'monitor',doc);assert.equal(monitor.children[0].textContent,'I');assert.equal(monitor.children[1].textContent,'IN');assert.equal(monitor.children[2].attrs.name,'speaker');
});
test('preference exposes labelled choices and a preview, applies immediately, and unsubscribes on close',()=>{
 const previous=globalThis.document;globalThis.document=documentFixture();
 try{
  const f=setup(),container=document.createElement('div'),dispose=appendTrackControlPreference(container,f.style),field=container.children[0],select=field.children[1];
  assert.equal(field.children[0].htmlFor,select.id);assert.deepEqual(select.children.map(n=>n.value),['logic','ableton','reaper']);assert.equal(select.value,'reaper');assert.equal(field.children[2].children.length,2);
  select.value='logic';select.onchange();assert.equal(f.style.preference,'logic');f.style.set('ableton');assert.equal(select.value,'ableton');
  dispose();f.style.set('reaper');assert.equal(select.value,'ableton');
 }finally{globalThis.document=previous;}
});
