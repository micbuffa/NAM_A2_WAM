import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackSoundEditor} from '../../examples/wam/projects/TrackSoundEditor.js';
import {copiedTrackSound} from '../../examples/wam/projects/TrackSoundState.js';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';
import PresetsPanel from '../../examples/wam/account/PresetsPanel.js';
import {TrackTones} from '../../examples/wam/projects/TrackTones.js';
import {StudioHistory,editCommand} from '../../examples/wam/projects/StudioHistory.js';
const state=gain=>({version:2,a:{entries:[{id:'gain',kind:'effect',state:{gain}}]},sourceTrim:{live:0,file:-18}});
const clone=value=>structuredClone(value);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Node{constructor(){this.edges=[];this.gain={value:1,setValueAtTime(value){this.value=value;}};}connect(node){this.edges.push(node);return node;}disconnect(){this.edges=[];}}
function setup({reusable=false,failSave=false}={}){
  const events=[],library=state(2),originalTone=state(.5),buffer={identity:'one decoded DI'},player=Object.assign(new EventTarget(),{playing:false,loop:{enabled:false,start:1,end:2},duration:3,ready:true,channels:new Map([[1,{buffer}]]),pause(){this.playing=false;},async play(){this.playing=true;},setLoop(loop){this.loop={...this.loop,...loop};}});
  const track={id:1,name:'Solo',origin:'personal',instrument:'guitar',volume:80,pan:0,presetSnapshot:clone(library),snapshotId:'captured',audio:{url:'/dry.wav'},recording:{capturePresetSnapshot:clone(library)}};
  const w={owned:true,selectedId:1,project:{id:4,name:'Rock song',tracks:[track]},saved:{tracks:[clone(track)]},accountLoadEpoch:1,recording:{pending:new Map()},player,report:(text,error)=>events.push({text,error}),
    updateTrack(id,fields){this.project.tracks=this.project.tracks.map(t=>t.id===id?{...t,...fields}:t);events.push({update:clone(fields)});},
    async save(){events.push({save:true});if(failSave)return false;this.saved=clone(this.project);return true;},
    tones:{resolvePreset:async()=>clone(library),setOverride(id,insert){events.push({override:insert});}}};
  const rack={a:{input:new Node()},output:new Node(),value:clone(originalTone),async getState(){return clone(this.value);}};
  const source={trimDb:{live:0},holds:0,suspendMonitoring(){this.holds++;return()=>this.holds--;}};
  const panel={externalEditor:null,activeId:9,modified:true,baseline:'original-global-preset',setExternalEditor(e){this.externalEditor=e;},render(){},scheduleCheck(){},scheduleDraft(){},
    async applyState(value){rack.value=clone(value);},find:()=>({id:9,factory:false}),store:{get:async()=>({state:clone(library)}),create:async(name,value,options)=>{events.push({create:{name,state:clone(value),options}});return{id:20};}},uniqueName:name=>name,refresh:async()=>{}};
  const spaces={current:'projects',show(value){this.current=value;}},context={currentTime:0,createGain:()=>new Node()};
  const editor=new TrackSoundEditor({workspace:w,rack,source,presets:panel,workspaces:spaces,context,route:()=>events.push({route:true}),ask:async()=>({reusable,name:'My solo'}),confirm:async()=>true});
  return {editor,w,rack,source,panel,spaces,events,library,originalTone,buffer};
}
test('FX audition borrows Tone, uses the existing DI buffer, saves an independent sound, then restores the unsaved Tone rack',async()=>{
  const {editor,w,rack,source,panel,spaces,library,originalTone,events,buffer}=setup();
  await editor.open(1);assert.equal(source.holds,1);assert.equal(spaces.current,'tone');assert.equal(panel.activeId,9);
  assert.equal(events.find(e=>e.override)?.override.output,rack.output);assert.equal(w.player.channels.get(1).buffer,buffer);
  rack.value.a.entries[0].state.gain=3;await editor.checkModified();assert.equal(editor.modified,true);await editor.togglePlay();assert.equal(w.player.playing,true);
  editor.toggleLoop();assert.equal(w.player.loop.enabled,true);await editor.finish();
  assert.equal(editor.active,null);assert.equal(source.holds,0);assert.equal(spaces.current,'projects');assert.deepEqual(rack.value,originalTone);
  assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,3);assert.deepEqual(w.project.tracks[0].audio,{url:'/dry.wav'});
  assert.deepEqual(w.project.tracks[0].recording.capturePresetSnapshot,library);assert.equal(library.a.entries[0].state.gain,2);
  assert.equal(events.filter(e=>e.create).length,0);assert.equal(panel.modified,true);assert.equal(panel.activeId,9);assert.equal(panel.baseline,'original-global-preset');
  assert.deepEqual(w.player.loop,{enabled:false,start:1,end:2});assert.equal(w.player.channels.get(1).buffer,buffer);
});
test('reusable export follows project save and reuses its request token after a lost response',async()=>{
  const {editor,w,rack,panel,events}=setup({reusable:true});let attempts=0;const keys=[];
  panel.store.create=async(name,value,{requestId})=>{keys.push(requestId);if(++attempts===1)throw Error('response lost');return{id:20};};
  await editor.open(1);rack.value.a.entries[0].state.gain=4;await editor.finish();
  assert.ok(editor.active);assert.equal(w.saved.tracks[0].presetSnapshot.a.entries[0].state.gain,4);assert.equal(keys.length,1);
  await editor.finish();assert.equal(editor.active,null);assert.deepEqual(keys,[keys[0],keys[0]]);assert.equal(events.filter(e=>e.update).length,1);
});
test('failed Save creates no library preset, retains editor, and Cancel restores the initial local sound',async()=>{
  const {editor,w,rack,events}=setup({reusable:true,failSave:true});const before=clone(w.project.tracks[0]);
  await editor.open(1);rack.value.a.entries[0].state.gain=9;await editor.checkModified();await editor.finish();assert.ok(editor.active);
  assert.equal(events.some(e=>e.create),false);assert.equal(w.saved.tracks[0].snapshotId,'captured');
  await editor.cancel();assert.deepEqual(w.project.tracks[0].presetSnapshot,before.presetSnapshot);assert.deepEqual(w.project.tracks[0].audio,before.audio);
});
test('pending takes, shared viewers and active separation cannot enter track sound editing',async()=>{
  const {editor,w}=setup();w.recording.pending.set(1,{});await assert.rejects(()=>editor.open(1),/Save project/);w.recording.pending.clear();
  w.owned=false;await assert.rejects(()=>editor.open(1),/personal/);w.owned=true;w.separation={result:{}};await assert.rejects(()=>editor.open(1),/Finish/);
});
test('FX waits for a global Tone load or save to finish',async()=>{
  const {editor,panel}=setup();panel.busy=true;await assert.rejects(()=>editor.open(1),/Tone preset operation/);assert.equal(editor.active,undefined);
});
test('real workspace edits preserve explicit sound copies while legacy library assignment clears an old copy',()=>{
  const w=Object.create(ProjectsWorkspace.prototype),audio={url:'dry'},recording={capturePresetSnapshot:state(1)};
  w.project={tracks:[{id:1,name:'Solo',audio,recording,...copiedTrackSound(state(1),'old')}]};
  w.setTracks=tracks=>{w.project.tracks=tracks;};
  w.updateTrack(1,copiedTrackSound(state(3),'new'));
  assert.equal(w.project.tracks[0].snapshotId,'new');assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,3);
  assert.equal(w.project.tracks[0].audio,audio);assert.equal(w.project.tracks[0].recording,recording);
  w.updateTrack(1,{presetId:9});assert.equal(w.project.tracks[0].presetSnapshot,null);
});
test('a cancelled late open cannot overwrite a newer editing session',async()=>{
  const {editor,w,rack}=setup(),wait=deferred();w.tones.resolvePreset=()=>wait.promise;
  const first=editor.open(1);await new Promise(r=>setImmediate(r));await editor.cancel({force:true});
  w.tones.resolvePreset=async()=>state(7);const next=editor.open(1);await next;const current=editor.active;wait.resolve(state(99));await assert.rejects(first,/Project changed/);
  assert.equal(editor.active,current);assert.equal(rack.value.a.entries[0].state.gain,7);await editor.cancel({force:true});
});
test('preset selection copies the last requested sound, not a library link; stale responses do not win',async()=>{
  const w=Object.create(ProjectsWorkspace.prototype),one=deferred(),two=deferred(),library=state(3);
  w.project={id:1,owned:true,tracks:[{id:1,origin:'personal',instrument:'guitar',presetSnapshot:state(1),snapshotId:'one'}]};w.accountLoadEpoch=1;w.recording={pending:new Map()};w.tones={resolvePreset:track=>track.presetId===1?one.promise:two.promise};
  w.updateTrack=(id,fields)=>{w.project.tracks[0]={...w.project.tracks[0],...fields};};
  const first=w.chooseTrackPreset(1,'account:1'),last=w.chooseTrackPreset(1,'account:2');two.resolve(library);await last;one.resolve(state(99));await first;
  const track=w.project.tracks[0];assert.equal(track.presetId,null);assert.equal(track.presetSnapshot.a.entries[0].state.gain,3);
  library.a.entries[0].state.gain=8;assert.equal(track.presetSnapshot.a.entries[0].state.gain,3);
});
test('external track editing cannot save/overwrite a global preset or its draft, including in-flight draft capture',async()=>{
  const panel=Object.create(PresetsPanel.prototype),wait=deferred(),writes=[];panel.render=()=>{};panel.draftStore={put:(...args)=>writes.push(args),delete:(...args)=>writes.push(args)};panel.account=null;panel.captureState=()=>wait.promise;panel.baseline='{}';panel.activeId=9;panel.loadingId=null;
  const draft=panel.writeDraft(),calls=[];panel.setExternalEditor({busy:false,save(){},finish:async choice=>calls.push(['save',choice]),loadPreset:async id=>calls.push(['load',id]),checkModified:async()=>{}});
  wait.resolve(state(2));await draft;assert.equal(writes.length,0);await panel.save();await panel.load(20);assert.deepEqual(calls,[['save',undefined],['load',20]]);assert.equal(panel.activeId,9);
});
test('a late headless build respects the visible Tone rack override, and returns to the headless insert afterwards',async()=>{
  const player={setInsert:(id,value)=>calls.push(value)},calls=[],wait=deferred(),context={currentTime:0,createGain:()=>new Node()};
  const rack={a:{entries:[],input:new Node()},output:new Node(),setState:()=>wait.promise,destroy(){},enqueue:fn=>fn()};
  const tones=new TrackTones({context,player,createRack:async()=>rack,resolvePreset:async()=>state(2)}),track={id:1,origin:'personal',instrument:'guitar',audio:{url:'dry'},presetSnapshot:state(2),snapshotId:'snapshot'};
  tones.setTracks([track],1,1);await new Promise(r=>setImmediate(r));const borrowed={input:new Node(),output:new Node()};tones.setOverride(1,borrowed);wait.resolve();await new Promise(r=>setImmediate(r));
  assert.equal(calls.at(-1),borrowed);tones.setOverride(1,null);assert.equal(calls.at(-1),tones.tones.get(1).insert);tones.destroy();
});
test('sound undo/redo changes only snapshots and keeps original DI/capture metadata',async()=>{
  const audio={url:'dry'},recording={capturePresetSnapshot:state(1)},before={name:'Project',tracks:[{id:1,audio,recording,...copiedTrackSound(state(1),'one')}]},after=clone(before);Object.assign(after.tracks[0],copiedTrackSound(state(2),'two'));
  let current=clone(after);const history=new StudioHistory();history.record(editCommand(before,after,{label:'Track sound',apply:(patch,side)=>{for(const change of patch.tracks)Object.assign(current.tracks[0],Object.fromEntries(Object.entries(change.fields).map(([key,values])=>[key,values[side]])));}}));
  await history.step();assert.equal(current.tracks[0].snapshotId,'one');await history.step(true);assert.equal(current.tracks[0].snapshotId,'two');assert.deepEqual(current.tracks[0].audio,audio);assert.deepEqual(current.tracks[0].recording,recording);
});
