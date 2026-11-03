import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {downmix,logMel,windowStarts,featureWindow,aggregate,peakTimes,deduplicatePeaks,postprocess,CHUNK,MELS} from '../../examples/wam/projects/tempo/BeatThisDSP.js';
import {beatThisManifest} from '../../examples/wam/projects/tempo/BeatThisManifest.js';
import {BeatThisClient} from '../../examples/wam/projects/tempo/BeatThisClient.js';
const fixture=JSON.parse(await readFile(new URL('./beat-this-features.fixture.json',import.meta.url)));
const predictions=(beat=[],downbeat=[])=>({beat:Float32Array.from(beat),downbeat:Float32Array.from(downbeat)});
test('Beat This: mono uses arithmetic mean without mutating channels',()=>{
 const a=Float32Array.of(1,.5,-1),b=Float32Array.of(-1,.5,1);
 assert.deepEqual([...downmix([a,b])],[0,.5,0]);assert.deepEqual([...a],[1,.5,-1]);
 assert.throws(()=>downmix([]));assert.throws(()=>downmix([a,b.subarray(1)]));assert.throws(()=>downmix([Float32Array.of(NaN)]));
});
test('Beat This: Hann/reflect/STFT/magnitude normalization/log-mel matches independent PyTorch fixture',()=>{
 const pcm=Float32Array.from({length:fixture.length},(_,i)=>.3*Math.sin(i*.17)+.1*Math.cos(i*.071));
 const fb=new Float32Array(513*128);for(let m=0;m<128;m++)fb[(1+m*3)*128+m]=.25+m/256;
 const out=logMel(pcm,fb);assert.equal(out.frames,fixture.features.length);
 for(let t=0;t<out.frames;t++)for(let m=0;m<128;m++)assert.ok(Math.abs(out.data[t*128+m]-fixture.features[t][m])<.00015,`feature ${t}/${m}`);
});
test('Beat This: silence stays zero, frame count includes centred endpoint',()=>{
 const out=logMel(new Float32Array(882),new Float32Array(513*128));assert.equal(out.frames,3);assert.ok(out.data.every(v=>v===0));
 assert.throws(()=>logMel(new Float32Array(512),new Float32Array(513*128)));
 assert.throws(()=>logMel(new Float32Array(900),new Float32Array(128)));
});
test('Beat This: windows reproduce reference including shifted tail and near-boundary overlap',()=>{
 assert.deepEqual(windowStarts(601),[-6]);assert.deepEqual(windowStarts(1488),[-6]);
 assert.deepEqual(windowStarts(1489),[-6,-5]);assert.deepEqual(windowStarts(2000),[-6,506]);assert.deepEqual(windowStarts(4000),[-6,1482,2506]);assert.throws(()=>windowStarts(0));
});
test('Beat This: static feature window pads left/right without copying wrong frame offset',()=>{
 const f=new Float32Array(3*MELS);f[0]=1;f[MELS]=2;f[2*MELS]=3;
 const w=featureWindow(f,3,-6);assert.equal(w.length,CHUNK*MELS);assert.equal(w[0],0);assert.equal(w[6*MELS],1);assert.equal(w[8*MELS],3);assert.equal(w[9*MELS],0);
});
test('Beat This: aggregation discards borders and first window wins shifted overlaps',()=>{
 const p=[{beat:new Float32Array(CHUNK).fill(1),downbeat:new Float32Array(CHUNK).fill(2)},{beat:new Float32Array(CHUNK).fill(3),downbeat:new Float32Array(CHUNK).fill(4)}];
 p[0].beat[0]=999;p[1].beat[1499]=999;
 const out=aggregate(p,[-6,506],2000);assert.equal(out.beat[0],1);assert.equal(out.beat[1487],1);assert.equal(out.beat[1488],3);assert.equal(out.beat[1999],3);assert.equal(out.downbeat[1999],4);assert.throws(()=>aggregate([],[-6],100));
});
test('Beat This: local maxima use ±3 frames, strict positive threshold and reference plateau mean',()=>{
 assert.deepEqual(peakTimes(Float32Array.of(0,-1,2,2,2,-1,0,3)),[.05,.14]);
 assert.deepEqual(deduplicatePeaks([0,1,2]),[.5,2]);assert.deepEqual(deduplicatePeaks([]),[]);
 assert.throws(()=>peakTimes(Float32Array.of(NaN)));
});
test('Beat This: downbeats snap to nearest beat, tie chooses first, duplicates disappear',()=>{
 const b=new Float32Array(60).fill(-1),d=b.slice();b[0]=2;b[20]=3;b[40]=2;d[10]=3;d[15]=2;d[38]=4;
 const out=postprocess({beat:b,downbeat:d});assert.deepEqual(out.beats,[0,.4,.8]);assert.deepEqual(out.downbeats,[0,.4,.8]);assert.ok(Math.abs(out.medianBpm-150)<1e-10);
});
test('Beat This: trim endpoint padding, preserve source offset, silence has no invented BPM',()=>{
 const b=new Float32Array(80).fill(-1);b[10]=2;b[60]=2;
 const out=postprocess({beat:b,downbeat:b},{duration:1,offsetSeconds:7});assert.deepEqual(out.beats,[7.2]);assert.deepEqual(out.downbeats,[7.2]);assert.equal(out.medianBpm,null);
 assert.deepEqual(postprocess(predictions([-1,0],[-1,0])).beats,[]);
});
test('Beat This: manifest pins exact graph/filter bytes and supports same-origin qualification mirror',()=>{
 const m=beatThisManifest();assert.match(m.files[0].url,/25308706dda545c0d5950065bb0604ad71bcf1f5/);assert.equal(m.files[0].size,190649026);assert.equal(m.files[1].size,262656);assert.ok(m.files.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)));assert.equal(beatThisManifest('http://localhost/models/').files[0].url,'http://localhost/models/beat_this.onnx');
});
function harness(){const workers=[];const progress=[];const client=new BeatThisClient({workerFactory:()=>{const worker={sent:[],postMessage(m,t){this.sent.push({m,t});},terminate(){this.terminated=true;}};workers.push(worker);return worker;},onProgress:p=>progress.push(p)});return{client,workers,progress};}
test('Beat This: request forwards transfer, progress does not finish, stale messages ignored',async()=>{
 const {client,workers,progress}=harness(),buf=new ArrayBuffer(8),p=client.request('analyse',{sampleRate:22050},[buf]),w=workers[0],id=w.sent[0].m.id;
 assert.deepEqual(w.sent[0].t,[buf]);w.onmessage({data:{id:id-1,type:'result',result:'stale'}});w.onmessage({data:{id,type:'progress',state:'features'}});assert.equal(progress.length,1);
 await assert.rejects(client.request('status'),/already running/);w.onmessage({data:{id,type:'result',result:{beats:[1]}}});assert.deepEqual(await p,{beats:[1]});client.dispose();
});
test('Beat This: cancel terminates compute, rejects once and ignores late result; next job uses fresh worker',async()=>{
 const {client,workers}=harness(),p=client.request('analyse'),w=workers[0],old=w.sent[0].m.id;const rejected=assert.rejects(p,{name:'AbortError'});client.cancel();await rejected;assert.ok(w.terminated);
 const next=client.request('status');w.onmessage({data:{id:old,type:'result',result:'obsolete'}});const w2=workers[1];w2.onmessage({data:{id:w2.sent[0].m.id,type:'result',result:'installed'}});assert.equal(await next,'installed');client.dispose();
});
test('Beat This: worker failure releases busy state and recreates worker',async()=>{
 const {client,workers}=harness(),p=client.request('status');workers[0].onerror({message:'crash'});await assert.rejects(p,/crash/);assert.ok(workers[0].terminated);const next=client.request('status');workers[1].onmessage({data:{id:workers[1].sent[0].m.id,type:'result',result:1}});assert.equal(await next,1);client.dispose();
});

test('Beat This: GPU parity gate rejects wrong/NaN/shape logits without speed-based acceptance',async()=>{
 const {compareLogits}=await import('../../examples/wam/projects/tempo/BeatThisParity.js');
 const a=predictions([1,2],[3,4]);assert.equal(compareLogits(a,predictions([1.00001,2],[3,4])).passed,true);
 assert.equal(compareLogits(a,predictions([1,2],[3,4.1])).passed,false);
 assert.equal(compareLogits(a,predictions([1,NaN],[3,4])).reason,'non-finite');assert.equal(compareLogits(a,predictions([1],[3,4])).reason,'shape');
});
test('Beat This: worker diagnostic failures retain the rejected backend evidence',async()=>{
 const {client,workers}=harness(),p=client.request('analyse');workers[0].onmessage({data:{id:workers[0].sent[0].m.id,type:'error',message:'parity failed',diagnostics:{maxAbs:8}}});
 await assert.rejects(p,error=>error.message==='parity failed'&&error.diagnostics.maxAbs===8);client.dispose();
});
test('Beat This: downloader model id cannot replace the progress request id',async()=>{
 const {beatThisResponse}=await import('../../examples/wam/projects/tempo/BeatThisClient.js');
 assert.deepEqual(beatThisResponse(17,'progress',{id:'beat-this-final0',state:'downloading',received:50,total:100}),{id:17,type:'progress',state:'downloading',received:50,total:100});
});
test('Beat This: numerical tolerance alone cannot approve GPU beats shifted by one frame',async()=>{
 const {sameEvents}=await import('../../examples/wam/projects/tempo/BeatThisParity.js');
 assert.equal(sameEvents({beats:[.2,.4],downbeats:[.2]},{beats:[.2,.4],downbeats:[.2]}),true);
 assert.equal(sameEvents({beats:[.2,.4],downbeats:[.2]},{beats:[.22,.4],downbeats:[.2]}),false);
 assert.equal(sameEvents({beats:[],downbeats:[]},{beats:[.2],downbeats:[]}),false);
});
function pcmWav({channels=1,rate=22050,encoding=1,bits=16}={}){const b=new ArrayBuffer(48),v=new DataView(b);for(const [offset,tag]of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<4;i++)v.setUint8(offset+i,tag.charCodeAt(i));v.setUint32(4,40,true);v.setUint32(16,16,true);v.setUint16(20,encoding,true);v.setUint16(22,channels,true);v.setUint32(24,rate,true);v.setUint16(32,channels*bits/8,true);v.setUint16(34,bits,true);v.setUint32(40,4,true);v.setInt16(44,-32768,true);v.setInt16(46,16384,true);return b;}
test('Beat This: PCM16 WAV input uses exact signed sample conversion and channel order',async()=>{
 const {readPcm16Wav}=await import('../../examples/wam/projects/tempo/BeatThisInput.js');
 assert.deepEqual([...readPcm16Wav(pcmWav()).channels[0]],[-1,.5]);const stereo=readPcm16Wav(pcmWav({channels:2}));assert.deepEqual(stereo.channels.map(c=>[...c]),[[-1],[.5]]);
});
test('Beat This: other audio encodings/rates fall back to browser decoder',async()=>{
 const {readPcm16Wav}=await import('../../examples/wam/projects/tempo/BeatThisInput.js');
 assert.equal(readPcm16Wav(new ArrayBuffer(4)),null);assert.equal(readPcm16Wav(pcmWav({rate:44100})),null);assert.equal(readPcm16Wav(pcmWav({encoding:3,bits:32})),null);
});
test('Beat This: malformed/truncated exact WAV cannot silently alter frame alignment',async()=>{
 const {readPcm16Wav}=await import('../../examples/wam/projects/tempo/BeatThisInput.js');
 assert.throws(()=>readPcm16Wav(pcmWav().slice(0,47)),/Truncated/);const b=pcmWav();new DataView(b).setUint16(32,7,true);assert.throws(()=>readPcm16Wav(b),/layout/);
});

test('Beat This: WebGPU byte patch preserves untouched bytes and never mutates cached source',async()=>{
 const {applyBytePatch}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');
 const source=Uint8Array.of(0,1,2,3,4,5).buffer;
 const target=applyBytePatch(source,{version:1,sourceSize:6,targetSize:7,changes:[{offset:1,remove:2,data:btoa(String.fromCharCode(9,8,7))},{offset:5,remove:1,data:btoa(String.fromCharCode(6))}]});
 assert.deepEqual([...new Uint8Array(target)],[0,9,8,7,3,4,6]);assert.deepEqual([...new Uint8Array(source)],[0,1,2,3,4,5]);
});
test('Beat This: malformed, overlapping or wrong-length graph patches are rejected',async()=>{
 const {applyBytePatch}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');const source=new ArrayBuffer(8),base={version:1,sourceSize:8,targetSize:8,changes:[{offset:1,remove:1,data:'AA=='}]};
 assert.throws(()=>applyBytePatch(source,{...base,sourceSize:9}));
 assert.throws(()=>applyBytePatch(source,{...base,changes:[{offset:8,remove:1,data:'AA=='}]}));
 assert.throws(()=>applyBytePatch(source,{...base,changes:[{offset:3,remove:2,data:'AAA='},{offset:4,remove:1,data:'AA=='}]}));
 assert.throws(()=>applyBytePatch(source,{...base,targetSize:9}));assert.throws(()=>applyBytePatch(source,{...base,changes:[{offset:-1,remove:1,data:'AA=='}]}));
});
test('Beat This: GPU patch manifest is pinned, bounded and has exactly the 25 normalization replacements',async()=>{
 const {BEAT_THIS_GPU_PATCH_SHA,BEAT_THIS_SOURCE_SHA,BEAT_THIS_GPU_GRAPH_SHA}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');
 const {createHash}=await import('node:crypto');const raw=await readFile(new URL('../../examples/wam/projects/tempo/beat-this-webgpu-patch.json',import.meta.url));
 assert.equal(createHash('sha256').update(raw).digest('hex'),BEAT_THIS_GPU_PATCH_SHA);const patch=JSON.parse(raw);
 assert.equal(patch.sourceSha256,BEAT_THIS_SOURCE_SHA);assert.equal(patch.targetSha256,BEAT_THIS_GPU_GRAPH_SHA);assert.equal(patch.reductionCount,25);assert.equal(patch.changes.length,26);assert.equal(patch.nodes.length,25);assert.ok(raw.length<100000);
});
test('Beat This: graph preparation refuses unpinned source bytes before requesting a GPU patch',async()=>{
 const {prepareBeatThisGraph}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');let fetched=false;
 await assert.rejects(prepareBeatThisGraph(new ArrayBuffer(8),'webgpu',{fetchImpl:async()=>{fetched=true;}}),/source graph SHA/);assert.equal(fetched,false);
});

test('Beat This: short windows retain only the reference six-frame borders',async()=>{
 const {windowFrameCount}=await import('../../examples/wam/projects/tempo/BeatThisDSP.js');
 assert.equal(windowFrameCount(545),557);assert.equal(windowFrameCount(1487),1499);assert.equal(windowFrameCount(1488),1500);assert.equal(windowFrameCount(4000),1500);assert.throws(()=>windowFrameCount(NaN));
 const data=new Float32Array(5*128).fill(3),size=windowFrameCount(5),window=featureWindow(data,5,-6,size);
 assert.equal(size,17);assert.equal(window.length,17*128);assert.ok(window.subarray(0,6*128).every(x=>x===0));assert.ok(window.subarray(6*128,11*128).every(x=>x===3));assert.ok(window.subarray(11*128).every(x=>x===0));
});
test('Beat This: dynamic aggregation crops exactly the reference-length output and rejects silent static padding',()=>{
 const beat=Float32Array.from({length:557},(_,i)=>i),downbeat=beat.slice(),out=aggregate([{beat,downbeat}],[-6],545);
 assert.equal(out.beat.length,545);assert.equal(out.beat[0],6);assert.equal(out.beat[544],550);
 assert.throws(()=>aggregate([{beat:new Float32Array(1500),downbeat:new Float32Array(1500)}],[-6],545),/shape/);
});
test('Beat This: dynamic recipe reconstructs literals and tensor copies without modifying cached bytes',async()=>{
 const {applyGraphRecipe}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');const source=Uint8Array.of(1,2,3,4,5,6).buffer;
 const out=applyGraphRecipe(source,{version:1,sourceSize:6,targetSize:6,parts:[{offset:2,length:2},{data:btoa(String.fromCharCode(9,8))},{offset:2,length:2}]});
 assert.deepEqual([...new Uint8Array(out)],[3,4,9,8,3,4]);assert.deepEqual([...new Uint8Array(source)],[1,2,3,4,5,6]);
});
test('Beat This: dynamic recipe rejects bad bounds, ambiguous parts and incomplete reconstruction',async()=>{
 const {applyGraphRecipe}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');const source=new ArrayBuffer(8),base={version:1,sourceSize:8,targetSize:8,parts:[{offset:0,length:8}]};
 assert.throws(()=>applyGraphRecipe(source,{...base,parts:[{offset:7,length:2}]}));
 assert.throws(()=>applyGraphRecipe(source,{...base,parts:[{offset:0,length:8,data:'AA=='}]}));
 assert.throws(()=>applyGraphRecipe(source,{...base,targetSize:9}));assert.throws(()=>applyGraphRecipe(source,{...base,parts:[{offset:0,length:7}]}));
});
test('Beat This: dynamic recipe is hash-pinned and reuses every tensor payload from the cached export',async()=>{
 const {BEAT_THIS_DYNAMIC_RECIPE_SHA,BEAT_THIS_DYNAMIC_GRAPH_SHA,BEAT_THIS_SOURCE_SHA}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');const {createHash}=await import('node:crypto');
 const bytes=await readFile(new URL('../../examples/wam/projects/tempo/beat-this-dynamic-recipe.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),BEAT_THIS_DYNAMIC_RECIPE_SHA);
 const r=JSON.parse(bytes);assert.equal(r.sourceSha256,BEAT_THIS_SOURCE_SHA);assert.equal(r.targetSha256,BEAT_THIS_DYNAMIC_GRAPH_SHA);assert.equal(r.boundedTimeAttention.length,9);assert.equal(r.reusedFoldedConvolutions.length,8);assert.ok(r.reusedFoldedConvolutions.every(x=>x.maxAbsFromFreshFold<1e-6));
 assert.equal(r.parts.filter(x=>x.offset!==undefined).reduce((s,p)=>s+p.length,0),r.copiedTensorBytes);
 assert.equal(r.parts.filter(x=>x.data!==undefined).reduce((s,p)=>s+Buffer.from(p.data,'base64').length,0),r.literalBytes);
 assert.equal(r.targetSize,r.literalBytes+r.copiedTensorBytes);assert.ok(r.parts.every(p=>p.data!==undefined||(p.offset>=0&&p.offset+p.length<=r.sourceSize)));
});
test('Beat This: unsupported execution window lengths fail before downloading recipes',async()=>{
 const {prepareBeatThisGraph}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');let fetched=false;
 for(const frames of [13,1501,NaN,0])await assert.rejects(prepareBeatThisGraph(new ArrayBuffer(8),'wasm',{frames,fetchImpl:async()=>{fetched=true;}}),/window length/);assert.equal(fetched,false);
});
test('Beat This: dynamic WebGPU uses the qualified explicit NCHW layout while CPU and fixed graphs retain their provider',async()=>{
 const {beatThisSessionOptions}=await import('../../examples/wam/projects/tempo/BeatThisGraph.js');
 assert.deepEqual(beatThisSessionOptions('webgpu',{dynamic:true}),{executionProviders:[{name:'webgpu',preferredLayout:'NCHW'}]});
 assert.deepEqual(beatThisSessionOptions('wasm',{dynamic:true}),{executionProviders:['wasm']});assert.deepEqual(beatThisSessionOptions('webgpu'),{executionProviders:['webgpu']});assert.throws(()=>beatThisSessionOptions('unsupported'));
});
