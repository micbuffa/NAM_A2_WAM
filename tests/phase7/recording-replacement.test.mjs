import test from 'node:test';import assert from 'node:assert/strict';
import {RecordingHistory} from '../../examples/wam/projects/recording/RecordingHistory.js';
import {StudioHistory} from '../../examples/wam/projects/StudioHistory.js';
import {StudioRecording} from '../../examples/wam/projects/recording/StudioRecording.js';
import {ProjectPlayer} from '../../examples/wam/projects/ProjectPlayer.js';
const base=()=>({id:1,name:'Solo',origin:'personal',instrument:'guitar',volume:80,pan:0,audio:null,updatedAt:'base'});
function setup(){
 const r={pending:new Map(),releaseMeter(){},workspace:{project:{id:9,tracks:[base()]},saved:{tracks:[base()]},accountLoadEpoch:1,player:{base:{pause(){}}},timeline:{setWave(){}},render(){}}};
 const w=r.workspace,h=r.takeHistory=new RecordingHistory(r);w.history=new StudioHistory({changed:()=>h.collect()});return{r,w,h};
}
function capture(f,n){const{r,w,h}=f,before=structuredClone(w.project.tracks[0]),beforeTake=r.pending.get(1),file=new File([`samples${n}`],`${n}.wav`),take={file,url:URL.createObjectURL(file),metadata:{sessionId:`session${n}`,compensationFrames:14}};
 const after={...before,audio:{url:take.url},recording:take.metadata,presetSnapshot:{version:2,a:{sound:n}},snapshotId:`session${n}`,recordingVersionId:null};w.project.tracks=[after];r.pending.set(1,take);h.remember(before,after,take,beforeTake,null,{peaks:[n],duration:n});return take;}
test('RAM replacement Undo/Redo retains the exact WAV and compensation without capturing or copying PCM again',async()=>{
 const f=setup(),a=capture(f,1),b=capture(f,2),fileA=a.file,fileB=b.file;
 await f.w.history.step();assert.equal(f.r.pending.get(1),a);assert.equal(f.w.project.tracks[0].audio.url,a.url);assert.equal(a.file,fileA);assert.equal(a.metadata.compensationFrames,14);
 await f.w.history.step();assert.equal(f.r.pending.size,0);assert.equal(f.w.project.tracks[0].audio,null);
 await f.w.history.step(true);await f.w.history.step(true);assert.equal(f.r.pending.get(1),b);assert.equal(b.file,fileB);assert.equal(f.w.project.tracks[0].snapshotId,'session2');f.h.clear();
});
test('saving the latest of two RAM takes links the original baseline, allowing Undo past an unpublished earlier take',async()=>{
 const f=setup(),a=capture(f,1),b=capture(f,2),saved={...f.w.project.tracks[0],audio:{url:'/b',checksum:'b'},recordingVersionId:'server-b',previousRecordingVersionId:'blank',updatedAt:'b'};
 f.h.published(b,saved,f.w.saved.tracks[0]);f.w.saved.tracks=[saved];f.r.pending.clear();f.w.api={restoreRecording:async(id,trackId,versionId)=>{assert.equal(versionId,'blank');return{...base(),recordingVersionId:'blank',updatedAt:'undo'};}};
 await f.w.history.step();assert.equal(f.r.pending.get(1),a);
 await f.w.history.step();assert.equal(f.w.saved.tracks[0].audio,null);assert.equal(f.w.project.tracks[0].audio,null);
 await f.w.history.step(true);assert.equal(f.r.pending.get(1),a);f.h.clear();
});
test('only two audio commands survive; clearing/branching releases unreachable Blob URLs and WAV references',async()=>{
 const f=setup(),a=capture(f,1);capture(f,2);capture(f,3);const fourth=capture(f,4);
 assert.equal(f.w.history.entries.length,2);assert.equal(a.file,null);assert.equal(a.linkPreviousId,null);assert.equal(f.h.resources.has(a),false);
 await f.w.history.step();capture(f,5);assert.equal(f.w.history.redoLabel,'');assert.equal(fourth.file,null);f.w.history.clear();f.r.pending.clear();f.h.collect();assert.equal(f.h.resources.size,0);
});
test('a saved take undo uses the immutable server version and leaves the cursor on failure or project change',async()=>{
 const f=setup(),t=capture(f,1);const saved={...f.w.project.tracks[0],audio:{url:'/one',checksum:'one'},recordingVersionId:'one',previousRecordingVersionId:'blank',updatedAt:'one'};f.h.published(t,saved,f.w.saved.tracks[0]);f.r.pending.clear();f.w.saved.tracks=[saved];
 f.w.api={restoreRecording:async()=>{throw Error('conflict');}};await assert.rejects(f.w.history.step(),/conflict/);assert.equal(f.w.history.cursor,1);assert.equal(f.w.project.tracks[0].snapshotId,'session1');
 let finish;f.w.api.restoreRecording=()=>new Promise(resolve=>finish=resolve);const pending=f.w.history.step();f.w.project={id:10,tracks:[]};finish({...base(),recordingVersionId:'blank'});await assert.rejects(pending,/Project changed/);assert.equal(f.w.project.id,10);f.h.clear();
});
test('Record starts without confirmation and repeated clicks cannot prepare two captures',async()=>{
 const r=Object.create(StudioRecording.prototype),track={...base(),audio:{url:'/old',checksum:'old'}};let pauses=0,dialogs=0,release;
 Object.assign(r,{state:'idle',pending:new Map(),armedId:1,source:{},context:{sampleRate:48000,resume:()=>new Promise(done=>release=done)}});
 r.workspace={owned:true,selectedId:1,project:{id:2,tracks:[track]},get selectedTrack(){return this.project.tracks[0];},accountLoadEpoch:1,player:{position:0,base:{pause(){pauses++;}}},$:()=>({value:'14'}),timeline:{}};
 r.confirmReplace=()=>{dialogs++;throw Error('must not ask');};r.setState=state=>r.state=state;
 r.waitForBacking=async()=>{throw Error('capture sentinel');};r.abort=()=>r.active=null;
 const pending=r.start();assert.equal(r.state,'preparing');assert.equal(pauses,1);await r.start();assert.equal(pauses,1);
 release();await pending;assert.equal(dialogs,0);assert.equal(track.audio.url,'/old','preparing does not destructively replace old audio');
});
test('recording backing excludes the replaced track even with monitoring disabled',()=>{
 const node=()=>({gain:{setTargetAtTime(){}},connect(){return this;},disconnect(){}}),context={currentTime:1,createGain:node,createBufferSource:()=>({...node(),start(){},stop(){}})},player=new ProjectPlayer(context);
 for(const id of [1,2])player.channels.set(id,{buffer:{duration:2},playback:node(),voices:new Set(),monitoring:false});
 player.startRecording(1.5,0,1);assert.equal(player.channels.get(1).voices.size,0);assert.equal(player.channels.get(2).voices.size,1);player.pause();
});

test('capture abort restores the previous waveform and never replaces the pending WAV',()=>{
 const r=Object.create(StudioRecording.prototype),wave={peaks:[.2],duration:2},old={file:new Blob(['old']),url:'blob:old'};let restored;
 r.active={trackId:1,beforeWave:wave};r.pending=new Map([[1,old]]);r.workspace={player:{base:{pause(){}}},timeline:{setWave(id,value){restored=value;}},report(){}};r.cleanup=()=>r.active=null;r.setState=()=>{};
 r.abort(Error('device lost'));assert.equal(restored,wave);assert.equal(r.pending.get(1),old);assert.equal(old.file.size,3);
});
test('publishing a take does not assign its baseline version to another empty track',()=>{
 const f=setup(),t=capture(f,1),unrelated=f.h.version({...base(),id:2});f.w.history.entries.push({recordingVersions:[unrelated]});
 f.h.published(t,{id:1,previousRecordingVersionId:'blank-one',recordingVersionId:'one'},f.w.saved.tracks[0]);assert.equal(unrelated.serverId,null);f.h.clear();
});

test('Record starts without an eviction dialog even at the bounded history limit',async()=>{
 const r=Object.create(StudioRecording.prototype),track=base();let prompt,failed;
 Object.assign(r,{state:'idle',pending:new Map(),armedId:1,source:{},context:{sampleRate:48000,resume:async()=>{}}});
 r.workspace={owned:true,selectedId:1,project:{id:2,tracks:[track]},get selectedTrack(){return this.project.tracks[0];},accountLoadEpoch:1,history:{audioLimit:2,cursor:2,entries:[{audio:true,label:'Old take'},{audio:true,label:'New take'}]},player:{position:0,base:{pause(){}}},$:()=>({value:'0'}),timeline:{}};
 r.confirmReplace=async options=>{prompt=options;return true;};r.setState=()=>{};r.waitForBacking=async()=>{throw Error('capture sentinel');};r.abort=error=>failed=error;
 await r.start();assert.equal(prompt,undefined);assert.equal(failed.message,'capture sentinel');
});
