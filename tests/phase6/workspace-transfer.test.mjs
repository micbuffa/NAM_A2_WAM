import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WorkspaceAudioRouter} from '../../examples/wam/source-separation/WorkspaceAudioRouter.js';
import {ExportTrackLibrary} from '../../examples/wam/source-separation/ExportTrackLibrary.js';
import {prepareExport,mixBlock,encodeMixMp3,exportSnapshot} from '../../examples/wam/source-separation/Mp3ExportCore.js';
import {Mp3Exporter} from '../../examples/wam/source-separation/Mp3Exporter.js';
import {MediaRepository} from '../../examples/wam/source-separation/MediaRepository.js';
const node=()=>({connections:new Set(),gain:{value:1},connect(to){this.connections.add(to);return to;},disconnect(to){to?this.connections.delete(to):this.connections.clear();}});
function provider(){const events=new EventTarget(),outputNode=node(),state={playing:true,mix:.8,guitarPan:-.3};let pauses=0;return {events,outputNode,state:()=>state,pause(){state.playing=false;pauses++;},get pauses(){return pauses;}};}
test('one stable backing output gates the two workspaces and never routes guitar or autoplays on switch',()=>{
 const router=new WorkspaceAudioRouter({createGain:node}),a=provider(),b=provider();router.attach('tracks',a);router.attach('multitracks',b);const output=router.engine.outputNode;
 assert.equal(router.sources.get('tracks').gate.gain.value,1);assert.equal(router.sources.get('multitracks').gate.gain.value,0);
 router.select('multitracks');assert.equal(a.pauses,1);assert.equal(router.sources.get('tracks').gate.gain.value,0);assert.equal(router.engine.outputNode,output);assert.equal(router.engine.mix,.8);
 router.select('tone');assert.equal(router.active,'multitracks');assert.equal(b.pauses,0);router.select('tracks');assert.equal(b.pauses,1);assert.equal(a.state().playing,false);router.destroy();
});
test('inactive player events cannot change active routing; removing a source disconnects only its own gate',()=>{
 const r=new WorkspaceAudioRouter({createGain:node}),a=provider(),b=provider();const detach=r.attach('tracks',a);r.attach('multitracks',b);let changes=0;r.addEventListener('transport-change',()=>changes++);b.events.dispatchEvent(new Event('mix-change'));assert.equal(changes,0);a.events.dispatchEvent(new Event('mix-change'));assert.equal(changes,1);detach();assert.equal(a.outputNode.connections.size,0);assert.equal(b.outputNode.connections.size,1);r.destroy();
});
const settings=[{id:'a',volume:1,pan:0,solo:false,muted:false},{id:'b',volume:.5,pan:0,solo:false,muted:false}];
function input(n=5000){return {totalFrames:n,outputGain:.7,settings:structuredClone(settings),segments:[{startFrame:0,tracks:[{id:'a',sampleRate:44100,channels:[new Float32Array(n).fill(.2),new Float32Array(n).fill(.4)]},{id:'b',sampleRate:44100,channels:[new Float32Array(n).fill(.2),new Float32Array(n).fill(-.2)]}]}]};}
test('MP3 render uses the PCM stereo sum with per-stem controls, excludes guitar and does not mutate sources',()=>{
 const data=input(4),[left,right]=mixBlock(prepareExport(data)[0],0,4);assert.ok(Math.abs(left[0]-.21)<1e-6);assert.ok(Math.abs(right[0]-.21)<1e-6);assert.equal(data.segments[0].tracks[0].channels[0][0],Math.fround(.2));data.settings[1].solo=true;const [l,r]=mixBlock(prepareExport(data)[0],0,4);assert.ok(l[0]>0&&r[0]<0);
 data.settings[1].muted=true;assert.equal(mixBlock(prepareExport(data)[0],0,4)[0][0],0);
});
test('export snapshots copy instead of detaching engine PCM, include common normalization and refuse unfinished streams',()=>{
 const data=Float32Array.of(.2,.3),buffer={numberOfChannels:1,sampleRate:44100,length:2,getChannelData:()=>data},engine={tracks:[{id:'a',buffer}],outputNode:{gain:{value:.7}},normalizationGain:2};const snapshot=exportSnapshot(engine,[settings[0]]);assert.equal(snapshot.outputGain,1.4);snapshot.segments[0].tracks[0].channels[0][0]=0;assert.equal(data[0],Math.fround(.2));assert.throws(()=>exportSnapshot({...engine,progressive:true,complete:false},[settings[0]]),/Terminez/);
});
test('aligned progressive segments are rendered exactly once; malformed rates, holes and nonfinite PCM are rejected',()=>{
 const data=input(4);data.segments.push({...input(3).segments[0],startFrame:4});data.totalFrames=7;assert.equal(prepareExport(data).length,2);data.segments[1].startFrame=5;assert.throws(()=>prepareExport(data));
 const bad=input();bad.segments[0].tracks[0].sampleRate=48000;assert.throws(()=>prepareExport(bad));const nan=input(2);nan.segments[0].tracks[0].channels[0][0]=NaN;assert.throws(()=>mixBlock(prepareExport(nan)[0],0,2));
});
test('pinned real lamejs encodes stereo MP3 bytes, reports progress, and lowers over-range mixes instead of hard-clipping',async()=>{
 const path=new URL('../../examples/wam/source-separation/vendor/lamejs/',import.meta.url),source=await readFile(new URL('lame.min.js',path),'utf8'),integrity=JSON.parse(await readFile(new URL('integrity.json',path),'utf8'));assert.equal(createHash('sha256').update(source).digest('hex'),integrity.sha256);
 const sandbox={};vm.runInNewContext(source,sandbox);const data=input(44100);data.segments[0].tracks[0].channels.forEach(c=>c.fill(2));const progress=[];const result=encodeMixMp3(data,sandbox.lamejs.Mp3Encoder,p=>progress.push(p));
 assert.ok(result.bytes.length>1000);assert.equal(result.bytes[0],255);assert.ok((result.bytes[1]&224)===224);assert.ok(result.attenuation<1);assert.equal(progress.at(-1).percent,100);assert.equal(result.duration,1);assert.equal(data.segments[0].tracks[0].channels[0][0],2);
});
test('worker export cancellation terminates promptly, rejects old work and ignores its late messages',async()=>{
 const workers=[],exporter=new Mp3Exporter({workerFactory:()=>{const w={postMessage(){},terminate(){this.terminated=true;}};workers.push(w);return w;}});const first=exporter.export(input());assert.throws(()=>exporter.export(input()),/cours/);exporter.cancel();await assert.rejects(first,{name:'AbortError'});assert.equal(workers[0].terminated,true);const next=exporter.export(input());workers[0].onmessage({data:{type:'done',bytes:new Uint8Array(3)}});assert.equal(exporter.worker,workers[1]);workers[1].onmessage({data:{type:'done',bytes:new Uint8Array(100),duration:1}});assert.equal((await next).blob.type,'audio/mpeg');
});
test('export library lists only metadata, fetches assets only on explicit selection, and preserves static tracks when local storage is unavailable',async()=>{
 let assets=0;const repository={async list(kind){assert.equal(kind,'track');return [{id:'generated',title:'Mix.mp3'}];},async getTrackFile(id){assets++;return new Blob([id]);}},library=new ExportTrackLibrary(repository);const oldFetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>({version:1,tracks:[{id:'factory',title:'Original',url:'https://example.com/test.mp3'}]})});
 try{await library.list();assert.equal(assets,0);assert.equal(library.resolve('generated').generated,true);await library.loadFile('generated');assert.equal(assets,1);repository.list=async()=>{throw Error('No storage');};await library.list();assert.equal(library.resolve('factory').title,'Original');}finally{globalThis.fetch=oldFetch;}
});
test('project index reads metadata only; writing a project never reads cached PCM or encoded assets',async()=>{
 const repository=new MediaRepository(),reads=[];repository.read=async store=>{reads.push(store);return [{id:'p',kind:'project',title:'One',updatedAt:1,state:{audioKey:'separate-audio'}}];};assert.equal((await repository.list('project'))[0].title,'One');assert.deepEqual(reads,['entries']);let saved;repository.write=async e=>{saved=e;return e;};await repository.putProject({id:'p',title:'One',state:{version:2,result:{tracks:[{id:'a'}],duration:1}}});assert.equal(saved.kind,'project');assert.equal(saved.blob,undefined);await assert.rejects(async()=>repository.putTrack({title:'Wrong',blob:new Blob(['wav'],{type:'audio/wav'})}));
});

test('router destruction removes subscriptions and both player connections',()=>{
 const r=new WorkspaceAudioRouter({createGain:node}),a=provider(),b=provider();r.attach('tracks',a);r.attach('multitracks',b);r.destroy();assert.equal(a.outputNode.connections.size,0);assert.equal(b.outputNode.connections.size,0);let events=0;r.addEventListener('transport-change',()=>events++);a.events.dispatchEvent(new Event('mix-change'));b.events.dispatchEvent(new Event('transport-change'));assert.equal(events,0);
});
