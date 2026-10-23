import test from 'node:test';
import assert from 'node:assert/strict';
import {StreamPublisher,StreamingWorker,streamStorage,isVerifiedStreamChunk,READ_BUDGET,STREAM_BINS} from '../../examples/wam/source-separation/StreamTransport.js';
import {makeTracks} from '../../examples/wam/source-separation/AudioData.js';
import {InstrumentWaveformJob} from '../../examples/wam/source-separation/WaveformAnalysis.js';
import {buildWaveformPeaks} from '../../examples/wam/source-separation/CompactWaveform.js';
function fixture(channels,length,{shared=true,seconds=1}={}){
 const tasks=[],packets=[],errors=[],raw={postMessage(m){this.message=m;},terminate(){this.dead=true;}},consumer=new StreamingWorker(raw,channels,{shared,schedule:f=>tasks.push(f)});
 consumer.postMessage({left:new Float32Array(length),right:new Float32Array(length)});
 const config=streamStorage(channels,{shared,seconds});consumer.config=config;consumer.ring=config.sab?new (consumer.ring.constructor)(config.sab,Float32Array):null;
 let turns=0;const flush=()=>{while(tasks.length){turns++;tasks.shift()();}};
 consumer.onmessage=({data})=>packets.push(data);consumer.onerror=e=>errors.push(e.message);
 const publisher=new StreamPublisher(config,{totalFrames:length,post:(message,transfers)=>{const m=structuredClone(message,{transfer:transfers});raw.onmessage({data:m});},yieldControl:async()=>flush()});
 return {publisher,consumer,raw,packets,errors,tasks,flush,get turns(){return turns;}};
}
for(const shared of [true,false])test(`transport ${shared?'SAB ring':'transfer fallback'} preserves all channels, order and short final tail`,async()=>{
 const n=44100*3+19,f=fixture(12,n,{shared}),stems=Array.from({length:12},(_,c)=>Float32Array.from({length:n},(_,i)=>Math.sin(i*.007+c)*.1));
 await f.publisher.publish({startFrame:0,stems,sampleRate:44100,chunkIndex:0,totalChunks:1});f.raw.onmessage({data:{type:'done'}});f.flush();
 assert.deepEqual(f.errors,[]);assert.equal(f.packets.length,5);assert.equal(f.packets.at(-1).type,'done');
 let offset=0;for(const p of f.packets.slice(0,-1)){assert.equal(isVerifiedStreamChunk(p),true);assert.equal(p.startFrame,offset);assert.ok(p.frames<=44100);for(let c=0;c<12;c++)assert.deepEqual(p.stems[c],stems[c].slice(offset,offset+p.frames));offset+=p.frames;}
 assert.equal(offset,n);if(shared)assert.ok(f.turns>=Math.ceil(n*12/READ_BUDGET));assert.equal(stems[0].length,n);assert.equal(f.consumer.ring?.available_read()||0,0);
});
test('full queue applies backpressure; wraparound never overwrites unread PCM',async()=>{
 const f=fixture(2,100000),stems=[Float32Array.from({length:100000},(_,i)=>i/100000),new Float32Array(100000)];
 await f.publisher.publish({startFrame:0,stems,sampleRate:44100});f.flush();assert.equal(f.errors.length,0);assert.equal(f.packets.length,3);assert.deepEqual(f.packets[2].stems[0],stems[0].slice(88200));
});
test('worker producer rejects nonfinite data before publishing any part of that packet',async()=>{
 const f=fixture(2,3);await assert.rejects(f.publisher.publish({startFrame:0,sampleRate:44100,stems:[Float32Array.of(0,NaN,1),new Float32Array(3)]}),/non fini/);assert.equal(f.consumer.ring.available_read(),0);assert.equal(f.packets.length,0);
});
test('truncated ring packets, gaps and invalid metadata are rejected before playback',()=>{
 for(const change of [p=>p,p=>({...p,startFrame:1}),p=>({...p,sequence:2}),p=>({...p,frames:44101}),p=>({...p,peaks:[]})]){
  const f=fixture(2,44100);f.raw.onmessage({data:change({type:'stream-chunk',startFrame:0,frames:2,sampleRate:44100,totalFrames:44100,sequence:0,peaks:[new Float32Array(STREAM_BINS)]})});f.flush();assert.equal(f.errors.length,1);assert.equal(f.packets.length,0);
 }
});
test('termination during a partial read drops queued packets, done and late replies without idle polling',async()=>{
 const f=fixture(12,44100);await f.publisher.publish({startFrame:0,sampleRate:44100,stems:Array.from({length:12},()=>new Float32Array(44100))});
 f.tasks.shift()();assert.equal(f.packets.length,0);f.consumer.terminate();f.raw.onmessage({data:{type:'done'}});f.flush();assert.equal(f.packets.length,0);assert.equal(f.raw.dead,true);assert.equal(f.tasks.length,0);
});
test('producer envelopes paint the same peaks without sending audible PCM to a waveform worker',async()=>{
 const n=44100+17,f=fixture(2,n),left=Float32Array.from({length:n},(_,i)=>Math.sin(i*.03)),right=Float32Array.from(left,v=>v*.3);
 await f.publisher.publish({startFrame:0,sampleRate:44100,stems:[left,right]});f.flush();
 const context={createBuffer(channels,length){const a=Array.from({length:channels},()=>new Float32Array(length));return {length,numberOfChannels:channels,copyToChannel:(x,c)=>a[c].set(x),getChannelData:c=>a[c]};}};
 const chunks=f.packets.map(p=>{p.roles=['guitar'];return {tracks:makeTracks(context,p)};});
 const expected=buildWaveformPeaks(chunks.map(c=>c.tracks[0].buffer),n);
 for(const c of chunks)c.tracks[0].buffer.getChannelData=()=>assert.fail('UI scanned audible PCM');
 let result;const job=new InstrumentWaveformJob({computer:{compute:()=>assert.fail('redundant waveform worker')},onResult:r=>result=r});
 await job.request({tracks:chunks[0].tracks,chunks,totalFrames:n});assert.deepEqual(result[0],expected);
});
test('real producer thread wakes from shared backpressure and delivers bit-exact twelve-channel PCM',async()=>{
 const {Worker}=await import('node:worker_threads'),worker=new Worker(new URL('./fixtures/stream-producer.mjs',import.meta.url)),raw={postMessage:(...args)=>worker.postMessage(...args),terminate:()=>worker.terminate()};
 worker.on('message',data=>raw.onmessage({data}));worker.on('error',e=>raw.onerror(e));
 const consumer=new StreamingWorker(raw,12,{shared:true});let offset=0;
 try{await new Promise((resolve,reject)=>{
  consumer.onerror=e=>reject(Error(e.message));consumer.onmessage=({data})=>{
   if(data.type==='error')reject(Error(data.message));
   if(data.type==='chunk'){assert.equal(data.startFrame,offset);for(let c=0;c<12;c++)for(let i=0;i<data.frames;i++)assert.equal(data.stems[c][i],Math.fround(((offset+i)%100-c)/100));offset+=data.frames;}
   if(data.type==='done')resolve();
  };
  consumer.postMessage({left:new Float32Array(44100*7+3),right:new Float32Array(44100*7+3)});
 });assert.equal(offset,44100*7+3);}finally{consumer.terminate();}
});
test('invalid channel counts cannot create a misaligned multitrack ring',()=>{
 for(const channels of [0,1,3,13,Infinity])assert.throws(()=>streamStorage(channels));
});
