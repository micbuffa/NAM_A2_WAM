import test from 'node:test';
import assert from 'node:assert/strict';
import {TrackSoundEditor} from '../../examples/wam/projects/TrackSoundEditor.js';
import {copiedTrackSound,soundLabel} from '../../examples/wam/projects/TrackSoundState.js';
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
    async save(){if(!await this.prepareSoundSave())return false;events.push({save:true});if(failSave)return false;this.saved=clone(this.project);try{await this.completeSoundSave();return true;}catch(error){this.report(error.message,true);return false;}},
    tones:{resolvePreset:async()=>clone(library),setOverride(id,insert){events.push({override:insert});}}};
  const rack={a:{input:new Node()},output:new Node(),value:clone(originalTone),async getState(){return clone(this.value);}};
  const source={trimDb:{live:0},holds:0,suspendMonitoring(){this.holds++;return()=>this.holds--;}};
  const panel={externalEditor:null,activeId:9,modified:true,baseline:'original-global-preset',setExternalEditor(e){this.externalEditor=e;},render(){},scheduleCheck(){},scheduleDraft(){},
    async applyState(value){rack.value=clone(value);},find:()=>({id:9,factory:false,name:'British Edge'}),store:{get:async()=>({state:clone(library)}),create:async(name,value,options)=>{events.push({create:{name,state:clone(value),options}});return{id:20};}},uniqueName:name=>name,refresh:async()=>{}};
  const spaces={current:'projects',show(value){this.current=value;}},context={currentTime:0,createGain:()=>new Node()};
  const editor=new TrackSoundEditor({workspace:w,rack,source,presets:panel,workspaces:spaces,context,route:()=>events.push({route:true}),ask:async()=>({reusable,name:'My solo'}),confirm:async()=>true});
  return {editor,w,rack,source,panel,spaces,events,library,originalTone,buffer};
}
test('the dock follows the selected track without pausing, applies a local sound and gives the Play rack back',async()=>{
  const {editor,w,rack,source,panel,spaces,library,originalTone,events,buffer}=setup();
  w.player.playing=true;await editor.sync();
  assert.equal(editor.active.trackId,1);assert.equal(spaces.current,'projects');assert.equal(panel.activeId,9);assert.equal(source.holds,0);
  assert.equal(w.player.playing,true,'showing a track never pauses the project');assert.deepEqual(w.player.loop,{enabled:false,start:1,end:2});
  assert.equal(events.find(e=>e.override)?.override.output,rack.output);assert.equal(w.player.channels.get(1).buffer,buffer);
  rack.value.a.entries[0].state.gain=3;await editor.checkModified();assert.equal(editor.modified,true);await editor.apply();
  assert.equal(editor.active.trackId,1,'Apply keeps the track shown');assert.equal(editor.modified,false);
  assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,3);assert.deepEqual(w.project.tracks[0].audio,{url:'/dry.wav'});
  assert.deepEqual(w.project.tracks[0].recording.capturePresetSnapshot,library);assert.equal(library.a.entries[0].state.gain,2);
  assert.equal(events.filter(e=>e.save).length,0);assert.equal(w.saved.tracks[0].presetSnapshot.a.entries[0].state.gain,2);assert.equal(events.filter(e=>e.create).length,0);assert.equal(panel.modified,true);assert.equal(panel.activeId,9);assert.equal(panel.baseline,'original-global-preset');
  spaces.current='tone';await editor.sync();
  assert.equal(editor.active,null);assert.deepEqual(rack.value,originalTone);assert.equal(events.filter(e=>'override' in e).at(-1).override,null);assert.equal(panel.externalEditor,null);
  assert.equal(w.player.playing,true);assert.equal(w.player.channels.get(1).buffer,buffer);
});
test('selecting another track applies pending edits and keeps the Play rack to restore later',async()=>{
  const {editor,w,rack,originalTone,spaces}=setup();
  w.project.tracks.push({id:2,name:'Bass',origin:'personal',instrument:'bass',presetSnapshot:state(7),snapshotId:'bass'});
  w.tones.resolvePreset=async track=>clone(track.presetSnapshot);
  await editor.sync();rack.value.a.entries[0].state.gain=5;await editor.checkModified();
  w.selectedId=2;await editor.sync();
  assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,5,'the edits went to the first track');
  assert.equal(editor.active.trackId,2);assert.equal(rack.value.a.entries[0].state.gain,7);
  spaces.current='tone';await editor.sync();assert.deepEqual(rack.value,originalTone);
});
test('Revert reloads the applied sound; tracks that play as recorded show nothing',async()=>{
  const {editor,w,rack,events}=setup();
  await editor.sync();rack.value.a.entries[0].state.gain=8;await editor.checkModified();await editor.revert();
  assert.equal(rack.value.a.entries[0].state.gain,2);assert.equal(editor.modified,false);assert.equal(events.some(e=>e.update),false);
  w.project.tracks.push({id:3,name:'Drums',origin:'separated',instrument:'drums',audio:{url:'/drums.wav'}});w.selectedId=3;await editor.sync();
  assert.equal(editor.active,null);
});
test('the track remembers the preset its sound comes from and whether it changed since',async()=>{
  const {editor,w,rack}=setup();await editor.sync();
  assert.equal(editor.origin,null);assert.equal(soundLabel(w.project.tracks[0].presetSnapshot),'Own sound');
  await editor.loadPreset(9);assert.deepEqual(editor.origin,{name:'British Edge'});assert.equal(editor.originModified,false);assert.equal(editor.selectedPreset,'9');
  rack.value.a.entries[0].state.gain=2.5;await editor.checkModified();await editor.apply();
  assert.equal(editor.selectedPreset,'','the picker goes back to "Load a preset…"');
  assert.deepEqual(w.project.tracks[0].presetSnapshot.origin,{name:'British Edge',modified:true});
  assert.equal(soundLabel(w.project.tracks[0].presetSnapshot),'British Edge (modified)');
  await editor.loadPreset(9);await editor.apply();assert.deepEqual(w.project.tracks[0].presetSnapshot.origin,{name:'British Edge',modified:false});
});
test('the last selection wins while a track sound is loading',async()=>{
  const {editor,w,rack}=setup(),wait=deferred();
  w.project.tracks.push({id:2,name:'Bass',origin:'personal',instrument:'bass',presetSnapshot:state(7),snapshotId:'bass'});
  w.tones.resolvePreset=track=>track.id===1?wait.promise:Promise.resolve(clone(track.presetSnapshot));
  const first=editor.sync();await new Promise(r=>setImmediate(r));w.selectedId=2;const last=editor.sync();
  wait.resolve(state(99));await first;await last;
  assert.equal(editor.active.trackId,2);assert.equal(rack.value.a.entries[0].state.gain,7);assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,2);
});
test('only Studio save asks about reusable export; a lost response reuses the idempotency token without asking again',async()=>{
  const {editor,w,rack,panel,events}=setup({reusable:true});let attempts=0,questions=0;const keys=[];
  editor.ask=async()=>{questions++;return{reusable:true,name:'My solo'};};
  panel.store.create=async(name,value,{requestId})=>{keys.push(requestId);if(++attempts===1)throw Error('response lost');return{id:20};};
  await editor.sync();rack.value.a.entries[0].state.gain=4;await editor.checkModified();await editor.apply();
  assert.equal(questions,0);assert.equal(keys.length,0);
  assert.equal(await w.save(),false);assert.equal(w.saved.tracks[0].presetSnapshot.a.entries[0].state.gain,4);assert.equal(w.hasPendingSoundExport(),true);
  assert.equal(await w.save(),true);assert.equal(questions,1);assert.deepEqual(keys,[keys[0],keys[0]]);assert.equal(events.filter(e=>e.update).length,1);assert.equal(w.hasPendingSoundExport(),false);
});
test('failed project save creates no preset and leaves local sound and RAM take available for retry',async()=>{
  const {editor,w,rack,events}=setup({reusable:true,failSave:true});const take={file:new Blob(['DI'])};w.recording.pending.set(1,take);
  await editor.sync();rack.value.a.entries[0].state.gain=9;await editor.apply();
  assert.equal(await w.save(),false);assert.equal(events.some(e=>e.create),false);assert.equal(w.saved.tracks[0].snapshotId,'captured');
  assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,9);assert.equal(w.recording.pending.get(1),take);
});
test('RAM takes are shown without saving; shared viewers and an unpublished separation show nothing',async()=>{
  const {editor,w,events}=setup();w.recording.pending.set(1,{});await editor.sync();assert.ok(editor.active);assert.equal(events.some(e=>e.save),false);await editor.cancel();
  w.owned=false;await editor.sync();assert.equal(editor.active,null);w.owned=true;w.separation={result:{}};await editor.sync();assert.equal(editor.active,null);
});
test('unchanged FX return creates no edit, no dirty snapshot and no save question',async()=>{
  const {editor,w,events}=setup();editor.ask=async()=>{throw Error('Unexpected question');};
  await editor.sync();await editor.apply();assert.equal(events.some(e=>e.update||e.save||e.create),false);assert.equal(w.project.tracks[0].snapshotId,'captured');
  assert.equal(await editor.prepareSave(),true);assert.equal(editor.edits().length,0);
});
test('cancel project save keeps the local edited sound; Revert drops only the edits not applied',async()=>{
  const {editor,w,rack}=setup();await editor.sync();rack.value.a.entries[0].state.gain=4;await editor.apply();
  editor.ask=async()=>null;assert.equal(await w.save(),false);assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,4);
  w.tones.resolvePreset=async()=>clone(w.project.tracks[0].presetSnapshot);rack.value.a.entries[0].state.gain=8;await editor.checkModified();await editor.revert();
  assert.equal(w.project.tracks[0].presetSnapshot.a.entries[0].state.gain,4);assert.equal(rack.value.a.entries[0].state.gain,4);
});
test('Save project applies the edits still in the rack',async()=>{
  const {editor,w,rack}=setup();await editor.sync();rack.value.a.entries[0].state.gain=6;await editor.checkModified();
  assert.equal(await w.save(),true);assert.equal(w.saved.tracks[0].presetSnapshot.a.entries[0].state.gain,6);assert.equal(editor.modified,false);
});
test('project changes while save question is open cannot export or save the previous sound',async()=>{
  const {editor,w,rack}=setup(),wait=deferred();await editor.sync();rack.value.a.entries[0].state.gain=4;await editor.apply();editor.ask=()=>wait.promise;
  const pending=w.save();w.project={...w.project,id:99};w.accountLoadEpoch++;wait.resolve({reusable:true,name:'Wrong project'});
  assert.equal(await pending,false);assert.equal(editor.edits().length,0);
});
test('undo or a later preset change cannot export stale Tone edits',async()=>{
  const {editor,w,rack}=setup();await editor.sync();rack.value.a.entries[0].state.gain=4;await editor.apply();w.project.tracks[0].presetSnapshot=state(8);
  editor.ask=async()=>{throw Error('Stale sound offered');};assert.equal(await editor.prepareSave(),true);assert.equal(editor.edits().length,0);
});
test('the dock waits for a global preset load or save to finish',async()=>{
  const {editor,panel}=setup();panel.busy=true;await editor.sync();assert.equal(editor.active,undefined);
  panel.busy=false;await editor.sync();assert.equal(editor.active.trackId,1);
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

test('real project save asks before uploads, then publishes the edited snapshot after DI capture metadata',async()=>{
 const {editor,w,rack,events}=setup();await editor.sync();rack.value.a.entries[0].state.gain=6;await editor.apply();
 Object.setPrototypeOf(w,ProjectsWorkspace.prototype);w.project.owned=true;delete w.owned;
 w.saved.name=w.project.name;w.render=()=>{};w.replaceSummary=()=>{};w.api={updateTrack:async(id,trackId,changes)=>{events.push({api:clone(changes)});return{...w.project.tracks[0],...changes};}};
 w.recording.save=async()=>events.push({audioUpload:true});
 editor.ask=async()=>{events.push({question:true});return{reusable:false,name:'Solo'};};
 assert.equal(await ProjectsWorkspace.prototype.save.call(w),true,JSON.stringify(events));
 const question=events.findIndex(e=>e.question),upload=events.findIndex(e=>e.audioUpload),sound=events.findIndex(e=>e.api);
 assert.ok(question<upload&&upload<sound);assert.equal(w.saved.tracks[0].presetSnapshot.a.entries[0].state.gain,6);assert.equal(w.dirty,false);
});
test('real project save distinguishes a saved project from a failed reusable export and retries without asking twice',async()=>{
 const {editor,w,rack,panel,events}=setup();await editor.sync();rack.value.a.entries[0].state.gain=6;await editor.apply();
 Object.setPrototypeOf(w,ProjectsWorkspace.prototype);w.project.owned=true;delete w.owned;w.saved.name=w.project.name;
 w.render=()=>{};w.replaceSummary=()=>{};w.api={updateTrack:async()=>clone(w.project.tracks[0])};w.recording.save=async()=>{};
 let asks=0,attempts=0;const tokens=[];editor.ask=async()=>{asks++;return{reusable:true,name:'New solo'};};
 panel.store.create=async(name,state,{requestId})=>{tokens.push(requestId);if(++attempts===1)throw Error('Lost response');return{id:20};};
 assert.equal(await ProjectsWorkspace.prototype.save.call(w),false);assert.equal(w.saved.tracks[0].presetSnapshot.a.entries[0].state.gain,6);assert.equal(w.dirty,true);
 assert.match(events.at(-1).text,/Project and audio saved; reusable preset not created yet/);
 assert.equal(await ProjectsWorkspace.prototype.save.call(w),true);assert.equal(w.dirty,false);assert.equal(asks,1);assert.equal(tokens[0],tokens[1]);
});
