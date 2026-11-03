import test from 'node:test';import assert from 'node:assert/strict';
import {StudioRecording} from '../../examples/wam/projects/recording/StudioRecording.js';
import {RecordingHistory} from '../../examples/wam/projects/recording/RecordingHistory.js';
import {LoopReview} from '../../examples/wam/projects/recording/LoopReview.js';
import {StudioHistory} from '../../examples/wam/projects/StudioHistory.js';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';
function setup(){
 const before={id:1,name:'Solo',origin:'personal',instrument:'guitar',audio:{url:'/original'},presetSnapshot:{version:2,a:{}},snapshotId:'original',volume:80,pan:0,updatedAt:'base'},project={id:2,name:'Session',bpm:120,timeSignature:'4/4',owned:true,tracks:[before]};
 const w={owned:true,project,saved:structuredClone(project),accountLoadEpoch:1,selectedId:1,player:{position:0,base:{pause(){},seek(){}}},timeline:{setWave(){}},render(){},replaceSummary(){},messages:[],report(text){this.messages.push(text);},$:()=>null};
 const r=Object.create(StudioRecording.prototype);Object.assign(r,{workspace:w,context:{sampleRate:8000},pending:new Map(),state:'idle',releaseMeter(){},render(){}});w.recording=r;r.takeHistory=new RecordingHistory(r);w.history=new StudioHistory({changed:()=>r.takeHistory.collect()});
 const active={trackId:1,before,beforeTake:null,beforeWave:null,project,epoch:1,metadata:{sampleRate:8000,compensationFrames:0,capturePresetSnapshot:{version:2,a:{}},rangeRecording:{mode:'cycle',startFrame:2,endFrame:6}}};
 const result=number=>({audio:new Blob(['take'+number]),frames:8,capturedFrames:100,peaks:Float32Array.of(.5),rangeTake:{takeNumber:number},loopSelection:number,loopOptions:[{number:1,complete:true,frames:4},{number:2,complete:false,frames:2}],takeLimit:3});
 const version=r.buildVersion(active,result(1));project.tracks=[version.track];r.pending.set(1,version.take);version.history=r.takeHistory.remember(before,version.track,version.take,null,null,version.wave);
 const recorder={closed:0,selectLoopTake:async number=>result(number),destroy(){this.closed++;}};
 const review=r.loopReview=new LoopReview(r,recorder,active,result(1),version);return {r,w,review,recorder,version};
}
test('a failed Worker selection or WAV allocation preserves the selected take and history cursor',async()=>{
 const f=setup(),file=f.version.take.file,url=f.w.project.tracks[0].audio.url;
 f.recorder.selectLoopTake=async()=>{throw Error('Worker failed');};await assert.rejects(f.review.choose(2),/Worker failed/);
 assert.equal(f.r.pending.get(1).file,file);assert.equal(f.w.history.cursor,1);assert.equal(f.w.saving,false);
 f.recorder.selectLoopTake=async()=>({});f.r.buildVersion=()=>{throw Error('WAV allocation failed');};await assert.rejects(f.review.choose(2),/allocation/);
 assert.equal(f.w.project.tracks[0].audio.url,url);assert.equal(f.w.history.cursor,1);assert.equal(f.review.selected,1);f.r.clear();
});
test('failed replay rolls back to the previous selected file, keeps one command, and reports no success',async()=>{
 const f=setup(),file=f.version.take.file,url=f.version.take.url;let fail=true;
 f.w.runHistory=async redo=>{if(redo&&fail){fail=false;return false;}return f.w.history.step(redo);};
 await assert.rejects(f.review.choose(2),/interrupted/);
 assert.equal(f.w.history.cursor,1);assert.equal(f.w.project.tracks[0].audio.url,url);assert.equal(f.r.pending.get(1).file,file);assert.equal(f.review.selected,1);assert.equal(f.w.history.entries.length,1);assert.equal(f.w.messages.length,0);assert.equal(f.r.takeHistory.resources.size,1);f.r.clear();
});
test('late Worker replies cannot replace another project or unlock its in-progress save',async()=>{
 const f=setup();let done;f.recorder.selectLoopTake=()=>new Promise(resolve=>done=resolve);const selecting=f.review.choose(2);
 const project={id:3,tracks:[]};f.w.project=project;f.w.accountLoadEpoch++;f.w.saving=true;done({});
 await assert.rejects(selecting,/Project changed/);assert.equal(f.w.project,project);assert.equal(f.w.saving,true);assert.equal(project.tracks.length,0);f.r.clear();
});
test('uploaded loop audio survives a failed project save; alternatives close only after a successful retry',async()=>{
 const f=setup();Object.setPrototypeOf(f.w,ProjectsWorkspace.prototype);delete f.w.owned;
 let uploads=0,updates=0;f.w.project.name='Renamed session';
 f.w.api={saveRecording:async()=>{uploads++;return {...f.w.project.tracks[0],audio:{url:'/saved',checksum:'saved'},recordingVersionId:'saved-take',previousRecordingVersionId:'original',updatedAt:'uploaded'};},updateProject:async()=>{if(++updates===1)throw Error('Project update failed');return {...f.w.project};}};
 assert.equal(await f.w.save(),false);assert.equal(uploads,1);assert.equal(f.r.pending.size,0);assert.equal(f.r.loopReview,f.review);assert.equal(f.recorder.closed,0);assert.equal(f.w.dirty,true);
 assert.equal(await f.w.save(),true);assert.equal(uploads,1);assert.equal(f.r.loopReview,null);assert.equal(f.recorder.closed,1);assert.equal(f.w.project.tracks[0].audio.url,'/saved');f.r.clear();
});

test('an Undo failure during selection releases the prepared WAV without changing the current take',async()=>{
 const f=setup(),build=f.r.buildVersion.bind(f.r);let prepared;
 f.r.buildVersion=(...args)=>(prepared=build(...args));f.w.runHistory=async()=>{throw Error('Restore conflict');};
 await assert.rejects(f.review.choose(2),/Restore conflict/);
 assert.equal(prepared.take.file,null);assert.equal(f.r.pending.get(1),f.version.take);assert.equal(f.w.history.cursor,1);assert.equal(f.review.selected,1);f.r.clear();
});

test('failed audio upload and failed reusable-preset export both retain the loop choices for retry',async()=>{
 const f=setup();Object.setPrototypeOf(f.w,ProjectsWorkspace.prototype);delete f.w.owned;
 let uploads=0,exports=0;const file=f.version.take.file;
 f.w.api={saveRecording:async()=>{if(++uploads===1)throw Error('Upload interrupted');return {...f.w.project.tracks[0],audio:{url:'/saved',checksum:'saved'},recordingVersionId:'saved',previousRecordingVersionId:'original',updatedAt:'uploaded'};},updateTrack:async()=>({...f.w.project.tracks[0]})};
 f.w.completeSoundSave=async()=>{if(++exports===1)throw Error('Preset export interrupted');};
 assert.equal(await f.w.save(),false);assert.equal(f.r.pending.get(1).file,file);assert.equal(f.recorder.closed,0);
 assert.equal(await f.w.save(),false);assert.equal(f.r.pending.size,0);assert.equal(f.r.loopReview,f.review);assert.equal(f.recorder.closed,0);
 assert.equal(await f.w.save(),true);assert.equal(uploads,2);assert.equal(f.recorder.closed,1);assert.equal(f.r.loopReview,null);f.r.clear();
});

test('another retained take remains selectable after its predecessor uploaded but the project save failed',async()=>{
 const f=setup();Object.setPrototypeOf(f.w,ProjectsWorkspace.prototype);delete f.w.owned;
 f.w.project.name='Renamed session';let uploads=0,fail=true;const baselines=[];
 f.w.api={saveRecording:async(id,trackId,metadata,file,expected,checksum)=>{baselines.push({expected,checksum});uploads++;return {...f.w.project.tracks[0],recording:metadata,audio:{url:'/saved-'+uploads,checksum:'saved-'+uploads},recordingVersionId:metadata.sessionId,previousRecordingVersionId:'original',updatedAt:'uploaded-'+uploads};},
  restoreRecording:async()=>({...f.review.active.before,audio:{url:'/original',checksum:'original'},recordingVersionId:'original',updatedAt:'restored'}),
  updateProject:async()=>{if(fail)throw Error('Project update interrupted');return {...f.w.project};},updateTrack:async()=>({...f.w.project.tracks[0]})};
 assert.equal(await f.w.save(),false);assert.equal(uploads,1);
 await f.review.choose(2);assert.equal(f.r.pending.get(1).metadata.rangeTake.takeNumber,2);assert.equal(f.r.pending.get(1).expectedUpdatedAt,'restored');
 fail=false;assert.equal(await f.w.save(),true);assert.equal(uploads,2);assert.deepEqual(baselines[1],{expected:'restored',checksum:'original'});assert.equal(f.w.project.tracks[0].recording.rangeTake.takeNumber,2);assert.equal(f.recorder.closed,1);f.r.clear();
});
