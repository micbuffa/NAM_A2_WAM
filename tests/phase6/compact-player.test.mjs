import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CompactMultitrackView} from '../../examples/wam/source-separation/CompactMultitrackView.js';
import {buildWaveformPeaks,timelineTicks} from '../../examples/wam/source-separation/CompactWaveform.js';
import {MultitrackSession} from '../../examples/wam/source-separation/MultitrackSession.js';
const buffer=channels=>({length:channels[0].length,numberOfChannels:channels.length,getChannelData:c=>channels[c]});
const pcm=(...values)=>buffer([Float32Array.from(values)]);
class Element {
  constructor(doc){this.ownerDocument=doc;this.children=[];this.attributes={};this.dataset={};this.style={setProperty:(key,value)=>{this.style[key]=value;}};this.clientWidth=600;this.scrollLeft=0;}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attributes[key]=value;}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);}
}
function fixture(){
  const document={createElement:()=>new Element(document)},root=new Element(document),renderers=[],seeks=[],changes=[],errors=[];
  const resize={observe(){},disconnect(){this.disconnected=true;}};
  const view=new CompactMultitrackView(root,{document,onSeek:s=>seeks.push(s),onChange:x=>changes.push(x),onError:e=>errors.push(e),observeResize:()=>resize,createRenderer:options=>{
    const renderer={options,draws:[],progress:[],render(data){this.draws.push(data);return Promise.resolve();},renderProgress(value){this.progress.push(value);},on(event,fn){this.click=fn;return()=>{this.unsubscribed=true;};},destroy(){this.destroyed=true;}};renderers.push(renderer);return renderer;
  }});
  const session=new MultitrackSession([{id:'a',role:'bass'},{id:'b',role:'guitar'}]);view.setSession(session);
  return {view,root,document,session,renderers,seeks,changes,errors,resize};
}
const audio={tracks:[{id:'a',buffer:pcm(.2,-.5)},{id:'b',buffer:pcm(.1,.3)}],totalFrames:2,duration:2};
test('peaks combine stereo channels and align progressive blocks on the full timeline',()=>{
  const left=Float32Array.of(.2,-.3),right=Float32Array.of(-.9,.1);
  const partial=buildWaveformPeaks([buffer([left,right])],4,4);
  assert.ok(Math.abs(partial[0]-.9)<1e-6);assert.equal(partial[2],0);
  const full=buildWaveformPeaks([buffer([left,right]),pcm(1.2,-.7)],4,4);
  assert.deepEqual([...full.slice(0,2)],[...partial.slice(0,2)]);assert.ok(full[2]>1);assert.equal(left[0],Math.fround(.2));
  assert.throws(()=>buildWaveformPeaks([pcm(NaN)],1));assert.throws(()=>buildWaveformPeaks([pcm(1,2)],1));assert.throws(()=>buildWaveformPeaks([],0));
});
test('one ruler uses readable intervals and zoom preserves time geometry',()=>{
  const normal=timelineTicks(30,600),zoom=timelineTicks(30,600,2);
  assert.ok(zoom.length>normal.length);assert.equal(normal[0].fraction,0);assert.equal(normal.at(-1).fraction,1);
  assert.deepEqual(timelineTicks(0,600),[]);
});
test('progressive arrival and zoom keep the mixer DOM, focus and horizontal scroll',async()=>{
  const f=fixture(),row=f.view.rows.get('a');f.document.activeElement=row.volume;row.volume.value='.8';f.view.viewport.scrollLeft=180;
  f.view.setAudio(audio);await Promise.resolve();f.session.setZoom(2);f.view.setSession(f.session);f.view.setAudio(audio);await Promise.resolve();
  assert.equal(f.view.rows.get('a'),row);assert.equal(f.document.activeElement,row.volume);assert.equal(row.volume.value,'.8');assert.equal(f.view.viewport.scrollLeft,180);assert.equal(f.view.content.style.width,'200%');assert.equal(f.renderers.length,2);
});
test('mixer changes reach session immediately without recreating renderers',()=>{
  const f=fixture(),row=f.view.rows.get('a');row.volume.value='.4';row.volume.oninput();row.pan.value='-.7';row.pan.oninput();row.solo.onclick();
  assert.equal(f.session.tracks[0].volume,.4);assert.equal(f.session.tracks[0].pan,-.7);assert.equal(row.volumeValue.textContent,'40%');assert.equal(row.panValue.textContent,'70L');
  assert.equal(f.view.rows.get('b').wave.style.opacity,'.35');row.mute.onclick();assert.equal(row.mute.attributes['aria-pressed'],'true');assert.equal(f.changes.length,4);assert.equal(f.renderers.length,2);
});
test('waveform click and keyboard seek are bounded to published audio',()=>{
  const f=fixture();f.view.setAudio({...audio,duration:10,availableDuration:3});f.renderers[0].click(.8);
  const row=f.view.rows.get('a');f.view.setPosition(2);let prevented=false;row.wave.onkeydown({key:'End',preventDefault(){prevented=true;}});row.wave.onkeydown({key:'Home',preventDefault(){}});
  assert.deepEqual(f.seeks,[3,3,0]);assert.ok(prevented);assert.equal(row.wave.attributes['aria-valuemax'],'3');assert.equal(row.wave.attributes['aria-valuenow'],'2.00');
});
test('display follows the common clock with one composited playhead and no extra audio transport',async()=>{
  const f=fixture();f.view.setAudio(audio);await f.view.pendingWaveforms;f.view.setPosition(1);
  assert.equal(f.view.playhead.style.transform,'translate3d(300px,0,0)');
  for(const renderer of f.renderers){assert.equal(renderer.progress.at(-1),0);assert.equal(renderer.options.cursorWidth,0);assert.equal(renderer.options.autoScroll,false);assert.equal(renderer.options.normalize,false);assert.equal(renderer.draws[0].length,2);}
  assert.equal(f.seeks.length,0);f.view.destroy();assert.ok(f.resize.disconnected);for(const renderer of f.renderers){assert.ok(renderer.destroyed);assert.ok(renderer.unsubscribed);}assert.equal(f.root.children.length,0);
});
test('session replacement destroys old renderers and resets scroll without changing session values',()=>{
  const f=fixture(),old=f.renderers.slice();f.view.viewport.scrollLeft=200;const next=new MultitrackSession([{id:'c',role:'vocals'}]);f.view.setSession(next);
  assert.ok(old.every(r=>r.destroyed));assert.equal(f.view.rows.size,1);assert.equal(f.view.viewport.scrollLeft,0);assert.equal(next.tracks[0].volume,1);
});
test('asynchronous peak updates serialize and discard stale queued drawings after destruction',async()=>{
  const f=fixture(),renderer=f.renderers[0];let finish;renderer.render=data=>{renderer.draws.push(data);return new Promise(resolve=>{finish=resolve;});};
  f.view.setAudio(audio);await f.view.pendingWaveforms;f.view.setAudio({...audio,duration:4});f.view.setAudio({...audio,duration:8});await f.view.pendingWaveforms;assert.equal(renderer.draws.length,1);
  finish();await Promise.resolve();assert.equal(renderer.draws.length,2);assert.equal(renderer.draws[1].duration,8);
  f.view.setAudio({...audio,duration:16});f.view.destroy();finish();await Promise.resolve();assert.equal(renderer.draws.length,2);assert.deepEqual(f.errors,[]);
});
test('local WaveSurfer renderer and dependency closure match pinned hashes, without player modules',async()=>{
  const base=new URL('../../examples/wam/source-separation/vendor/wavesurfer/',import.meta.url),manifest=JSON.parse(await readFile(new URL('integrity.json',base)));
  assert.equal(manifest.version,'7.12.4');assert.ok((await readFile(new URL('LICENSE',base),'utf8')).includes('BSD'));
  for(const [file,hash] of Object.entries(manifest.files)) {
    const bytes=await readFile(new URL(file,base));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
    for(const match of bytes.toString().matchAll(/from ['"](.+?)['"]/g)){
      const dependency=new URL(match[1],new URL(file,base));assert.ok(Object.keys(manifest.files).some(key=>new URL(key,base).href===dependency.href));
    }
    assert.doesNotMatch(bytes.toString(),/new AudioContext|new Audio\(|createElement\(['"]audio|\.\/player\.js/);
  }
});

test('shared viewport supports horizontal keyboard scrolling independently from waveform seeking',()=>{
  const f=fixture(),viewport=f.view.viewport;viewport.scrollWidth=1800;viewport.clientWidth=600;
  const press=key=>viewport.onkeydown({key,target:viewport,preventDefault(){}});
  press('End');assert.equal(viewport.scrollLeft,1200);press('ArrowLeft');assert.equal(viewport.scrollLeft,1120);press('Home');assert.equal(viewport.scrollLeft,0);press('ArrowRight');assert.equal(viewport.scrollLeft,80);assert.deepEqual(f.seeks,[]);
});
test('collapse hides instruments without destroying their controls, zoom or scroll; expand restores them',async()=>{
  const f=fixture();f.view.setAudio(audio);const row=f.view.rows.get('a');f.session.updateTrack('a',{volume:.4,pan:-.3,solo:true});f.view.viewport.scrollLeft=100;f.session.setZoom(2);f.session.setViewMode('mix');f.view.setSession(f.session);await f.view.mixJob.pending;await Promise.resolve();
  assert.ok(row.wave.hidden);assert.ok(row.controls.hidden);assert.equal(f.view.mixRow.wave.hidden,false);assert.equal(f.view.mixRow.renderer.draws.length,1);assert.equal(f.view.viewport.scrollLeft,100);assert.equal(f.view.content.style.width,'200%');
  f.view.setPosition(1);assert.equal(f.view.playhead.style.transform,'translate3d(600px,0,0)');f.session.setViewMode('instruments');f.view.setSession(f.session);assert.equal(f.view.rows.get('a'),row);assert.equal(row.wave.hidden,false);assert.equal(row.volume.value,.4);assert.equal(row.pan.value,-.3);assert.equal(row.solo.attributes['aria-pressed'],'true');assert.equal(f.view.mixRow.wave.hidden,true);f.view.destroy();
});
test('collapsed waveform refreshes for mix changes and progressive data without recreating controls',async()=>{
  const f=fixture();f.view.setAudio(audio);f.session.setViewMode('mix');f.view.setSession(f.session);await f.view.mixJob.pending;const row=f.view.mixRow,first=row.renderer.draws.at(-1).getChannelData(0).slice();
  f.session.updateTrack('a',{muted:true});f.session.updateTrack('b',{muted:true});f.view.setSession(f.session);await f.view.mixJob.pending;assert.ok(row.renderer.draws.at(-1).getChannelData(0).every(x=>x===0));assert.ok(first.some(x=>x!==0));assert.equal(row.note.textContent,'Mix silencieux');
  f.session.updateTrack('a',{muted:false});f.view.setSession(f.session);f.view.setAudio({...audio,totalFrames:4,duration:4,availableDuration:2,chunks:[{startFrame:0,tracks:audio.tracks}]});await f.view.mixJob.pending;assert.equal(row.wave.attributes['aria-valuemax'],'2');assert.equal(row.renderer.draws.at(-1).getChannelData(0).length,4);assert.equal(row.renderer.draws.at(-1).getChannelData(0)[3],0);assert.equal(f.view.mixRow,row);f.view.destroy();
});
test('session replacement cancels a pending collapsed mix and releases its renderer',async()=>{
  const f=fixture();f.view.setAudio(audio);f.session.setViewMode('mix');f.view.setSession(f.session);const pending=f.view.mixJob.pending,old=f.view.mixRow;f.view.setSession(new MultitrackSession([{id:'c'}]));await pending;assert.equal(old.renderer.destroyed,true);assert.equal(f.view.mixRow,null);assert.equal(f.view.rows.size,1);assert.deepEqual(f.errors,[]);f.view.destroy();
});
test('global backing gain refreshes only the collapsed peaks, retaining instrument controls and audio data',async()=>{
  const f=fixture();f.view.setAudio(audio);f.session.setViewMode('mix');f.view.setSession(f.session);await f.view.mixJob.pending;const row=f.view.rows.get('a'),before=row.renderer.draws.length;
  f.view.setOutputGain(0);await f.view.mixJob.pending;assert.ok(f.view.mixRow.renderer.draws.at(-1).getChannelData(0).every(x=>x===0));assert.equal(row.renderer.draws.length,before);assert.equal(f.view.rows.get('a'),row);f.view.setOutputGain(1);await f.view.mixJob.pending;assert.ok(f.view.mixRow.renderer.draws.at(-1).getChannelData(0).some(x=>x>0));f.view.destroy();
});

test('A/B overlay follows zoom, accepts pointer drag and keyboard, and survives reduced view',()=>{
  const f=fixture(),changes=[];f.view.onLoopChange=b=>changes.push({...b});f.view.setAudio(audio);f.view.setLoopRegion({start:.2,end:1.8});
  assert.equal(f.view.region.style.left,'10%');assert.equal(f.view.region.style.width,'80%');
  f.view.content.getBoundingClientRect=()=>({left:100,width:1000});
  const a=f.view.handles.start;a.setPointerCapture=()=>{};a.releasePointerCapture=()=>{};
  a.onpointerdown({button:0,pointerId:1,preventDefault(){}});a.onpointermove({pointerId:1,clientX:400});
  assert.equal(f.view.loopRegion.start,.6);assert.equal(changes.length,0);
  f.view.setLoopRegion({start:0,end:2});assert.equal(f.view.loopRegion.start,.6);
  a.onpointerup({pointerId:1});assert.equal(changes[0].start,.6);
  f.view.handles.end.onkeydown({key:'ArrowLeft',shiftKey:true,preventDefault(){}});assert.ok(Math.abs(changes[1].end-.8)<1e-8);
  f.session.setViewMode('mix');f.view.updateControls();assert.equal(f.view.region.hidden,false);f.view.destroy();
});


test('outside A/B is lightly shaded in both views, scales with zoom, and clears when loop is disabled',()=>{
  const f=fixture();f.view.setAudio(audio);f.view.setLoopRegion({start:.5,end:1.5});
  assert.equal(f.view.outsideBefore.hidden,false);assert.equal(f.view.outsideAfter.hidden,false);
  assert.equal(f.view.outsideBefore.style.width,'25%');assert.equal(f.view.outsideAfter.style.left,'75%');
  f.session.setZoom(4);f.session.setViewMode('mix');f.view.updateControls();assert.equal(f.view.content.style.width,'400%');assert.equal(f.view.outsideBefore.style.width,'25%');
  f.view.setLoopRegion({start:.5,end:1.5},false);assert.equal(f.view.outsideBefore.hidden,true);assert.equal(f.view.outsideAfter.hidden,true);
  f.view.setLoopRegion({start:0,end:2},true);assert.equal(f.view.outsideBefore.style.width,'0%');assert.equal(f.view.outsideAfter.style.left,'100%');f.view.destroy();
});

test('animation of a shared playhead does not repaint individual waveform renderers',async()=>{
 const f=fixture();f.view.setAudio(audio);await f.view.pendingWaveforms;
 for(const row of f.view.rows.values())row.renderer.renderProgress=()=>{throw Error('Per-frame waveform repaint');};
 for(let i=0;i<1000;i++)f.view.setPosition(i/1000);
 assert.equal(f.view.playhead.style.transform,'translate3d(299.7px,0,0)');
 f.view.destroy();
});
