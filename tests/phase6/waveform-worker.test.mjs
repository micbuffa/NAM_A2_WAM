import test from 'node:test';
import assert from 'node:assert/strict';
import {computeWaveformBlock,copyAudioChannels} from '../../examples/wam/source-separation/WaveformWorkerCore.js';
import {InstrumentWaveformJob,WaveformWorkerClient} from '../../examples/wam/source-separation/WaveformAnalysis.js';
import {buildWaveformPeaks} from '../../examples/wam/source-separation/CompactWaveform.js';
import {buildMixPeaks} from '../../examples/wam/source-separation/MixWaveform.js';
const buffer=(...channels)=>({length:channels[0].length,numberOfChannels:channels.length,getChannelData:c=>channels[c]});
const track=(id,b)=>({id,buffer:b});
const computer={compute:async block=>computeWaveformBlock(block)};
test('incremental instrument analysis reads each immutable buffer once; old PCM is never rescanned',async()=>{
 const first=buffer(Float32Array.of(.2,-.9),Float32Array.of(.8,.1)),next=buffer(Float32Array.of(-.3,.6),Float32Array.of(.4,-.7));let calls=0;
 const job=new InstrumentWaveformJob({computer:{compute:async b=>{calls++;return computeWaveformBlock(b);}}});
 const input={tracks:[{id:'a'}],chunks:[{tracks:[track('a',first)]}],totalFrames:4,bins:4};let result;
 job.onResult=p=>{result=p;};await job.request(input);assert.equal(calls,1);
 const expected=buildWaveformPeaks([first,next],4,4);first.getChannelData=()=>assert.fail('old published audio was read again');
 await job.request({...input,chunks:[...input.chunks,{tracks:[track('a',next)]}]});assert.equal(calls,2);assert.deepEqual(result[0],expected);
 await job.request({...input,chunks:[...input.chunks,{tracks:[track('a',next)]}]});assert.equal(calls,2);
});
test('worker bridge bounds copies, preserves the original buffer and handles offset/bin boundaries',async()=>{
 const length=40003,source=Float32Array.from({length},(_,i)=>Math.sin(i*.17)),right=Float32Array.from(source,v=>v*.6);let maximum=0;
 const b={length,numberOfChannels:2,getChannelData:()=>assert.fail('must not materialize a whole native channel'),copyFromChannel(out,c,start){maximum=Math.max(maximum,out.length);out.set((c?right:source).subarray(start,start+out.length));}};
 const job=new InstrumentWaveformJob({computer});let peaks;job.onResult=p=>{peaks=p[0];};await job.request({tracks:[track('a',b)],totalFrames:length,bins:23});
 assert.equal(maximum,16384);assert.deepEqual(peaks,buildWaveformPeaks([buffer(source,right)],length,23));assert.equal(source.length,length);assert.throws(()=>copyAudioChannels(b,0,20000));
});
test('worker mix matches exact PCM sum/panning, preserves cancellation, and caches whole published segments',async()=>{
 const a=buffer(Float32Array.of(.5,-.7),Float32Array.of(-.2,.1)),b=buffer(Float32Array.of(-.5,.7),Float32Array.of(.2,-.1));
 const input={tracks:[{id:'a'},{id:'b'}],chunks:[{startFrame:0,tracks:[track('a',a),track('b',b)]}],totalFrames:4,bins:4,settings:[{id:'a',volume:.8,pan:-.4,solo:false,muted:false},{id:'b',volume:1.2,pan:.7,solo:false,muted:false}]};
 let calls=0;const cache=new WeakMap(),options={cache,computeBlock:async x=>{calls++;return computeWaveformBlock(x);},yieldControl:()=>Promise.resolve()};
 const first=await buildMixPeaks(input,options),reference=await buildMixPeaks(input);assert.deepEqual(first,reference);assert.equal(calls,1);
 const oldA=a.getChannelData,oldB=b.getChannelData;a.getChannelData=b.getChannelData=()=>assert.fail('cached mix read old PCM');
 const second=await buildMixPeaks(input,options);assert.deepEqual(second,reference);assert.equal(calls,1);
 a.getChannelData=oldA;b.getChannelData=oldB;
 input.settings[0].muted=true;const changed=await buildMixPeaks(input,options);assert.equal(calls,2);assert.deepEqual(changed,await buildMixPeaks(input));
 input.outputGain=.2;assert.deepEqual(await buildMixPeaks(input,options),await buildMixPeaks(input));assert.equal(calls,3);
 const controller=new AbortController();await assert.rejects(buildMixPeaks({...input,outputGain:.3},{signal:controller.signal,computeBlock:async x=>{controller.abort();return computeWaveformBlock(x);}}),{name:'AbortError'});
});
test('a cancelled or superseded waveform cannot paint a different session',async()=>{
 let finish;const messages=[];const job=new InstrumentWaveformJob({computer:{compute:b=>new Promise(resolve=>{finish=()=>resolve(computeWaveformBlock(b));})},onResult:r=>messages.push(r)});
 const input={tracks:[track('a',buffer(Float32Array.of(1)))],totalFrames:1};const old=job.request(input);job.cancel();finish();await old;assert.equal(messages.length,0);
 const next=job.request(input);finish();await next;assert.equal(messages.length,1);
});
test('worker messages transfer only bounded owned copies; late replies and worker failures are harmless',async()=>{
 const workers=[];const client=new WaveformWorkerClient({workerFactory:()=>{const worker={terminate(){this.dead=true;},postMessage(data,transfer){const m=structuredClone(data,{transfer});queueMicrotask(()=>{if(!this.dead)this.onmessage({data:{id:m.id,...computeWaveformBlock(m.block)}});});}};workers.push(worker);return worker;}});
 const original=Float32Array.of(.1,-.4),block={kind:'instrument',channels:[original.slice()],startFrame:0,totalFrames:2,bins:2};const result=await client.compute(block);assert.equal(block.channels[0].byteLength,0);assert.equal(original.length,2);assert.equal(result.peaks[1],Math.fround(.4));
 workers[0].postMessage=()=>{};const pending=client.compute({...block,channels:[original.slice()]});workers[0].onerror({message:'worker failed'});await assert.rejects(pending,/worker failed/);
 const stopped=client.compute({...block,channels:[original.slice()]});client.destroy();await assert.rejects(stopped,{name:'AbortError'});workers.at(-1).onmessage({data:{id:99,peaks:new Float32Array(1)}});
});
test('bad sample data and unbounded jobs fail instead of producing misleading envelopes',()=>{
 assert.throws(()=>computeWaveformBlock({kind:'instrument',channels:[new Float32Array(16385)],startFrame:0,totalFrames:20000}));
 assert.throws(()=>computeWaveformBlock({kind:'instrument',channels:[Float32Array.of(NaN)],startFrame:0,totalFrames:1}));
 assert.throws(()=>computeWaveformBlock({kind:'mix',sources:[{left:Float32Array.of(1),matrix:[1,0,0,1],gain:NaN}],startFrame:0,totalFrames:1}));
});
