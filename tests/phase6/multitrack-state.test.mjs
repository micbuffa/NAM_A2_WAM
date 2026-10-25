import test from 'node:test';
import assert from 'node:assert/strict';
import {saveSession,restoreSession,validateSession,packAudio,unpackTracks,sameSource} from '../../examples/wam/source-separation/MultitrackState.js';
import {MultitrackEngine} from '../../examples/wam/source-separation/MultitrackEngine.js';
import {ProgressiveMultitrackEngine} from '../../examples/wam/source-separation/ProgressiveMultitrackEngine.js';
import {MultitrackSession} from '../../examples/wam/source-separation/MultitrackSession.js';
import {PeakNormalization} from '../../examples/wam/source-separation/PeakNormalization.js';
import {SessionAudioStore} from '../../examples/wam/source-separation/SessionAudioStore.js';
import {SeparationWorkflow} from '../../examples/wam/source-separation/SeparationWorkflow.js';
function context(){
 const param=()=>({value:1,setTargetAtTime(v){this.value=v;}}),node=()=>({gain:param(),pan:param(),connections:new Set(),connect(n){this.connections.add(n);return n;},disconnect(){this.connections.clear();},start(){},stop(){}});
 return {state:'running',currentTime:0,destination:{},resume:async()=>{},createGain:node,createStereoPanner:node,createBufferSource:node,createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {length,sampleRate,duration:length/sampleRate,numberOfChannels:channels,getChannelData:c=>data[c],copyToChannel:(pcm,c)=>data[c].set(pcm)};}};
}
function fixture(){
 const ctx=context(),store={records:new Map(),async put(record){this.records.set(record.key,structuredClone(record));},async get(key){return structuredClone(this.records.get(key));}},mixer={state:{volumeDb:-12,mix:.7,guitarPan:.2,muted:false},getState(){return {...this.state};},update(s){this.state={...s};}},flow=new SeparationWorkflow();
 const tracks=(roles=['original'],n=100)=>roles.map((role,i)=>{const buffer=ctx.createBuffer(2,n,44100);buffer.getChannelData(0).fill(.1*(i+1));buffer.getChannelData(1).fill(-.2*(i+1));return {id:`${role}-${i}`,role,buffer};});
 const createDeck=(tracks,title,{progressive=false,totalFrames,roles}={})=>{const engine=progressive?new ProgressiveMultitrackEngine(ctx):new MultitrackEngine(ctx);if(progressive)engine.startStream({roles,totalFrames});else engine.load(tracks);engine.outputNode.gain.value=.7;const session=new MultitrackSession(engine.tracks),normalization=new PeakNormalization(engine,session);return {engine,session,normalization,title,cleanup(){normalization.destroy();}};};
 flow.setOriginal(createDeck(tracks(),'Original'));const source={kind:'file',name:'song.wav',size:100,lastModified:123};
 return {ctx,store,mixer,workflow:flow,tracks,createDeck,source,save:()=>saveSession({workflow:flow,mixer,store,source,key:'snapshot'}),restore:s=>restoreSession(s,{context:ctx,store,createDeck,workflow:flow,mixer})};
}
test('metadata is lightweight JSON, PCM lives in a separate atomic record, and pack does not modify samples',async()=>{
 const f=fixture(),before=f.workflow.original.engine.tracks[0].buffer.getChannelData(0).slice(),state=await f.save();
 assert.equal(state.version,2);assert.equal(state.audioKey,'snapshot');assert.equal(state.original.tracks[0].buffer,undefined);assert.ok(JSON.stringify(state).length<3000);assert.equal(f.store.records.size,1);assert.deepEqual(f.store.records.get('snapshot').original.tracks[0].channels[0],before);f.workflow.destroy();
});
test('full state restores two decks, original/result mode, mix view, zoom, A/B, position, bypassed normalization and global mix without playback',async()=>{
 const f=fixture(),o=f.workflow.original;await o.normalization.analyze({targetDb:-3});o.normalization.setEnabled(false);o.session.setZoom(4);o.engine.setLoopRegion(10/44100,90/44100);o.engine.seek(30/44100);
 const r=f.createDeck(f.tracks(['bass','guitar']),'Result');await f.workflow.begin(r);await f.workflow.showResult();r.session.updateTrack('bass-0',{volume:.3,pan:-.4,solo:true});r.session.setViewMode('mix');await r.normalization.analyze({targetDb:-6});r.engine.seek(40/44100);
 const state=await f.save();f.mixer.update({volumeDb:0,mix:0,guitarPan:0,muted:true});await f.workflow.active.engine.play();const old=f.workflow.active.engine;
 await f.restore(JSON.parse(JSON.stringify(state)));assert.equal(old.destroyed,true);assert.equal(f.workflow.active,f.workflow.result);assert.equal(f.workflow.active.engine.playing,false);assert.equal(f.workflow.original.engine.playing,false);
 assert.equal(f.workflow.result.session.viewMode,'mix');assert.equal(f.workflow.original.session.zoom,4);assert.equal(f.workflow.result.session.tracks[0].volume,.3);assert.equal(f.workflow.result.session.tracks[0].solo,true);assert.equal(f.workflow.result.normalization.enabled,true);assert.equal(f.workflow.original.normalization.enabled,false);assert.ok(f.workflow.original.normalization.result);assert.equal(f.workflow.original.normalization.targetDb,-3);assert.equal(f.workflow.result.normalization.targetDb,-6);
 assert.deepEqual(f.mixer.getState(),state.global);assert.equal(f.workflow.result.engine.position,40/44100);assert.deepEqual(f.workflow.original.engine.loopRegion,state.original.region);f.workflow.destroy();
});
test('progressive complete and retained partial audio restore aligned blocks and allow paused native A/B playback',async()=>{
 const f=fixture(),r=f.createDeck([],'Progressive',{progressive:true,roles:['bass','guitar'],totalFrames:200});r.engine.append(0,f.tracks(['bass','guitar'],50));r.engine.append(50,f.tracks(['bass','guitar'],50));
 assert.throws(()=>packAudio(r.engine),/Terminez/);r.engine.finish(true);await f.workflow.begin(r);await f.workflow.showResult();r.engine.setLoopRegion(20/44100,80/44100);
 const state=await f.save();await f.restore(state);const restored=f.workflow.result.engine;assert.equal(restored.progressive,true);assert.equal(restored.duration,100/44100);assert.equal(restored.chunks.length,2);assert.equal(restored.complete,true);assert.equal(restored.partial,true);assert.equal(restored.playing,false);await restored.play();assert.equal(restored.regionPlaying,true);f.workflow.destroy();
});
test('missing cache returns reselect metadata and pauses the old player without destroying it',async()=>{
 const f=fixture(),s=await f.save(),old=f.workflow.original;f.store.records.clear();await old.engine.play();const result=await f.restore(s);assert.equal(result.missing,true);assert.deepEqual(result.state.source,f.source);assert.equal(old.engine.playing,false);assert.equal(f.workflow.original,old);f.workflow.destroy();
});
test('missing result restores original and reports unavailable stems instead of silently selecting unrelated audio',async()=>{
 const f=fixture(),r=f.createDeck(f.tracks(['bass']),'Result');await f.workflow.begin(r);await f.workflow.showResult();const s=await f.save();f.store.records.get('snapshot').result=null;const result=await f.restore(s);assert.equal(result.missingResult,true);assert.equal(f.workflow.active,f.workflow.original);assert.equal(f.workflow.result,null);f.workflow.destroy();
});
test('corrupt metadata rejects before transport mutation; corrupt PCM leaves original graph intact',async()=>{
 const f=fixture(),s=await f.save(),old=f.workflow.original;await old.engine.play();
 for(const mutate of [x=>x.version=99,x=>x.original.tracks[0].pan=Infinity,x=>x.original.position=-1,x=>x.original.region={start:2,end:1},x=>x.global.volumeDb=100,x=>x.original.normalization.targetDb=1]){const invalid=structuredClone(s);mutate(invalid);await assert.rejects(f.restore(invalid));assert.equal(old.engine.playing,true);assert.equal(f.workflow.original,old);}
 f.store.records.get('snapshot').original.tracks[0].channels[0][0]=NaN;await assert.rejects(f.restore(s),/PCM/);assert.equal(old.engine.destroyed,undefined);assert.equal(f.workflow.original,old);f.workflow.destroy();
});
test('cache PCM rate, channels, lengths and metadata identity are checked before publication',async()=>{
 const f=fixture(),s=await f.save(),record=f.store.records.get('snapshot');const packed=record.original.tracks;
 assert.throws(()=>unpackTracks(f.ctx,[{...packed[0],sampleRate:48000}]),/Canaux/);assert.throws(()=>unpackTracks(f.ctx,[{...packed[0],channels:[new Float32Array(3),new Float32Array(4)]}]),/PCM/);
 record.original.tracks[0].id='wrong';await assert.rejects(f.restore(s),/correspond/);assert.equal(f.workflow.original.title,'Original');f.workflow.destroy();
});
test('storage quota failure never returns success metadata or changes active audio',async()=>{
 const f=fixture(),old=f.workflow.original;f.store.put=async()=>{throw Error('QuotaExceededError');};await assert.rejects(f.save(),/Quota/);assert.equal(f.workflow.original,old);assert.equal(f.store.records.size,0);f.workflow.destroy();
});
test('local file matching requires name, size and timestamp; library matching uses catalogue ID',()=>{
 const file={kind:'file',name:'song.wav',size:20,lastModified:123};assert.equal(sameSource(file,{...file}),true);assert.equal(sameSource(file,{...file,size:21}),false);assert.equal(sameSource(file,{...file,lastModified:124}),false);assert.equal(sameSource(file,{...file,kind:'library'}),false);assert.equal(sameSource({kind:'library',id:'a',name:'old'},{kind:'library',id:'a',name:'new'}),true);
});
test('session serialization does not trust a saved playing flag or arbitrary gain corrections',async()=>{
 const f=fixture(),s=await f.save();s.original.playing=true;s.original.normalization.gain=9999;await f.restore(s);assert.equal(f.workflow.original.engine.playing,false);assert.equal(f.workflow.original.engine.normalizationGain,1);f.workflow.destroy();
});


test('empty session still validates master settings, while unavailable IndexedDB reports an actionable error',async()=>{
 assert.deepEqual(validateSession({version:2,empty:true,global:{volumeDb:-12,mix:.5,guitarPan:0,muted:false}}).global,{volumeDb:-12,mix:.5,guitarPan:0,muted:false});
 assert.throws(()=>validateSession({version:2,empty:true,global:{volumeDb:NaN,mix:.5,guitarPan:0,muted:false}}));
 const f=fixture();await f.restore({version:2,empty:true,global:{volumeDb:-9,mix:.2,guitarPan:0,muted:true}});assert.equal(f.workflow.original,null);assert.equal(f.mixer.getState().volumeDb,-9);
 await assert.rejects(new SessionAudioStore({indexedDB:null}).get('missing'),/IndexedDB/);
});

test('saving empty lanes after a model change stores only the preserved original',async()=>{
 const f=fixture(),empty=f.createDeck([],'New model',{progressive:true,totalFrames:100,roles:['drums','bass','other','vocals']});
 f.workflow.resetResult(empty);const state=await f.save();assert.equal(state.result,null);assert.equal(state.active,'original');
 assert.equal(f.store.records.get('snapshot').result,null);await f.restore(state);assert.equal(f.workflow.active,f.workflow.original);f.workflow.destroy();
});
test('imported YouTube provenance survives session save/restore independently of the temporary download job',async()=>{
 const f=fixture();f.source.provenance={kind:'youtube',videoId:'YE7VzlLtp-4',url:'https://www.youtube.com/watch?v=YE7VzlLtp-4',name:'Big Buck Bunny',extension:'m4a',duration:597,importedAt:'2026-10-24T22:03:32.612Z',sha256:'8296cfa389ea5e97aeace1f979ab236e9195b5363f1e0bc62309c18a9d4b41f3'};
 const state=await f.save();assert.deepEqual(state.source.provenance,f.source.provenance);assert.ok(!('jobId' in state.source.provenance));const serialized=JSON.parse(JSON.stringify(state));assert.deepEqual(validateSession(serialized).source.provenance,f.source.provenance);await f.restore(serialized);assert.equal(f.workflow.original.engine.duration,100/44100);f.workflow.destroy();
});
