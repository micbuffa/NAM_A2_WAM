import test from 'node:test';
import assert from 'node:assert/strict';
import {planChunks,OverlapAssembler} from '../../examples/wam/source-separation/ChunkTools.js';
import {ProgressiveMultitrackEngine} from '../../examples/wam/source-separation/ProgressiveMultitrackEngine.js';
import {ProgressiveDemucsRunner} from '../../examples/wam/source-separation/ProgressiveDemucsRunner.js';
import {progressiveWaveformPath} from '../../examples/wam/source-separation/AudioData.js';
import {SeparationProgress,transportState} from '../../examples/wam/source-separation/SeparationProgress.js';

test('chunk plan publishes every frame once, including short and trailing chunks',()=>{
  for(const n of [1,4,5,6,9,10,12,60]) {
    const plans=planChunks(n,5,1);let total=0;
    for(const p of plans){assert.equal(p.start,total);assert.ok(p.end<=n);total+=p.commitFrames;}
    assert.equal(total,n);assert.equal(plans.at(-1).final,true);
  }
  assert.deepEqual(planChunks(12,5,1).map(p=>[p.start,p.end,p.commitFrames]),[[0,5,4],[4,9,4],[8,12,4]]);
  for(const args of [[0,5,1],[1,1,1],[2,5,-1],[2.5,5,1]])assert.throws(()=>planChunks(...args));
});
test('overlap has identical gains for all stems, preserves sequence, never edits published audio',()=>{
  const assembler=new OverlapAssembler(2),results=[];
  for(const plan of planChunks(12,5,2)) {
    const original=Float32Array.from({length:plan.end-plan.start},(_,i)=>plan.start+i);
    results.push(assembler.push(plan,[original,original.map(x=>x*2)]));
  }
  assert.deepEqual(results.flatMap(r=>[...r[0]]),Array.from({length:12},(_,i)=>i));
  assert.deepEqual(results.flatMap(r=>[...r[1]]),Array.from({length:12},(_,i)=>i*2));
  const a=new OverlapAssembler(1),plans=planChunks(8,5,2);
  const first=a.push(plans[0],[new Float32Array(5).fill(1)]),snapshot=first[0].slice();
  const second=a.push(plans[1],[new Float32Array(5).fill(3)]);
  assert.deepEqual(first[0],snapshot);assert.deepEqual([...second[0]],[1,3,3,3,3]);
  assert.throws(()=>new OverlapAssembler(1).push(plans[0],[new Float32Array(5).fill(NaN)]),/désaligné/);
});
function context(){
  const param=()=>({value:0,setTargetAtTime(v){this.value=v;}});
  const node=()=>({gain:param(),pan:param(),connect(to){return to;},disconnect(){},start(...args){this.started=args;},stop(){this.stopped=true;}});
  return {state:'running',currentTime:0,resume:async()=>{},createGain:node,createStereoPanner:node,createBufferSource:node};
}
const chunk=(seconds=4)=>['bass','guitar'].map((role,i)=>({id:`${role}-${i}`,buffer:{length:seconds*44100,sampleRate:44100,duration:seconds}}));
function engine(){const ctx=context(),e=new ProgressiveMultitrackEngine(ctx);e.startStream({roles:['bass','guitar'],totalFrames:12*44100});e.sync([{id:'bass-0',volume:.3,pan:-.5},{id:'guitar-1',volume:1,pan:0}]);return [e,ctx];}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('play becomes available on first chunk, next chunk is scheduled without restarting current audio',async()=>{
  const [e,ctx]=engine();assert.equal(transportState(e,{busy:true}).disabled,true);
  e.append(0,chunk());assert.equal(transportState(e,{busy:true}).disabled,false);
  await e.play();const first=e.voices[0];assert.deepEqual(first.source.started,[.03,0]);
  assert.equal(first.gain.gain.value,.3);assert.equal(first.pan.pan.value,-.5);
  ctx.currentTime=1;e.append(4*44100,chunk());
  assert.equal(e.voices[0],first);assert.equal(e.voices.length,4);
  assert.deepEqual(e.voices.slice(2).map(v=>v.source.started),[[4.03,0],[4.03,0]]);
  first.source.onended();assert.equal(e.playing,true);
  e.destroy();
});
test('underflow waits then resumes automatically; manual pause prevents that resume',async()=>{
  const [e,ctx]=engine();e.append(0,chunk());await e.play();ctx.currentTime=4.03;e.voices[0].source.onended();
  assert.equal(e.waiting,true);assert.equal(e.playing,false);assert.equal(e.position,4);
  e.append(4*44100,chunk());await flush();assert.equal(e.playing,true);assert.equal(e.waiting,false);
  assert.deepEqual(e.voices.map(v=>v.source.started),[[4.0600000000000005,0],[4.0600000000000005,0]]);
  ctx.currentTime=8.06;e.voices[0].source.onended();e.pause();e.append(8*44100,chunk());e.finish();await flush();
  assert.equal(e.playing,false);assert.equal(e.waiting,false);e.destroy();
});
test('late chunk before delayed onended rebases its clock rather than scheduling in the past',async()=>{
  const [e,ctx]=engine();e.append(0,chunk());await e.play();ctx.currentTime=9;
  e.append(4*44100,chunk());await flush();assert.equal(e.playing,true);
  assert.deepEqual(e.voices[0].source.started,[9.03,0]);assert.equal(e.offset,4);e.destroy();
});
test('seek is clamped to available audio, partial cancel retains it, mixing covers all queued voices',async()=>{
  const [e]=engine();e.append(0,chunk());e.seek(99);assert.equal(e.offset,4);
  e.seek(-1);await e.play();e.append(4*44100,chunk());
  e.sync([{id:'bass-0',volume:1,pan:0,muted:true},{id:'guitar-1',volume:.5,pan:.2}]);
  assert.deepEqual(e.voices.map(v=>v.gain.gain.value),[0,.5,0,.5]);
  e.pause();e.finish(true);assert.equal(e.duration,8);assert.equal(e.complete,true);assert.equal(e.partial,true);
  assert.throws(()=>e.append(8*44100,chunk()),/désalignées/);e.destroy();
});
test('loop waits for complete stream, then restarts at zero',async()=>{
  const [e,ctx]=engine();e.append(0,chunk());await e.play();ctx.currentTime=4.03;e.voices[0].source.onended();
  assert.equal(e.waiting,true);assert.equal(e.offset,4);e.finish(true);await flush();
  assert.equal(e.playing,true);assert.equal(e.offset,0);e.destroy();
});
test('stop during deferred resume cancels pending progressive start, invalid append is atomic',async()=>{
  const [e,ctx]=engine();e.append(0,chunk());let resume;ctx.resume=()=>new Promise(r=>resume=r);
  const pending=e.play();e.stop();resume();await pending;assert.equal(e.playing,false);assert.equal(e.voices.length,0);
  assert.throws(()=>e.append(2,chunk()));assert.equal(e.availableDuration,4);
  assert.throws(()=>e.finish(),/manque/);e.destroy();
});
const model={id:'htdemucs_6s',roles:['drums','bass','other','vocals','guitar','piano'],files:[{sha256:'x'}]};
const channels=()=>[new Float32Array(8),new Float32Array(8)];
const block=(start=0,n=4)=>({type:'chunk',startFrame:start,stems:Array.from({length:12},()=>new Float32Array(n)),sampleRate:44100,chunkIndex:start?1:0,totalChunks:2});
function runnerSetup(){
  let checks=0;const workers=[];
  const manager={getStatus:async()=>{checks++;return {state:'installed'};},cache:{get:async()=>({files:[new ArrayBuffer(1)]})}};
  const runner=new ProgressiveDemucsRunner({manager,workerFactory:()=>{const w={postMessage(){},terminate(){this.terminated=true;},send(data){this.onmessage({data});}};workers.push(w);return w;}});
  return {runner,workers,checks:()=>checks};
}
test('runner exposes playable chunks before final result and verifies cache once per run',async()=>{
  const {runner,workers,checks}=runnerSetup(),seen=[];let done=false;
  const pending=runner.separate(model,channels(),{onChunk:d=>seen.push(d),onProgress:d=>seen.push(d.phase)}).then(x=>{done=true;return x;});
  await flush();workers[0].send(block());await flush();assert.equal(done,false);assert.ok(seen.includes('chunk-ready'));
  workers[0].send(block(4));workers[0].send({type:'done',elapsedMs:20,heapBytes:100});await pending;
  assert.equal(checks(),1);assert.equal(seen.filter(x=>x==='track-complete').length,6);assert.equal(workers[0].terminated,true);
});
test('runner rejects gaps, incomplete streams and NaN, cancels and ignores stale output',async()=>{
  for(const events of [[block(4)],[{type:'done'}],[{...block(),stems:Array.from({length:12},()=>new Float32Array(4).fill(NaN))}]]){
    const {runner,workers}=runnerSetup();const pending=runner.separate(model,channels());await flush();events.forEach(e=>workers[0].send(e));await assert.rejects(pending);assert.equal(workers[0].terminated,true);
  }
  const {runner,workers}=runnerSetup(),seen=[];const pending=runner.separate(model,channels(),{onChunk:x=>seen.push(x)});await flush();
  runner.cancel();await assert.rejects(pending,{name:'AbortError'});workers[0].send(block());assert.equal(seen.length,0);
  await assert.rejects(runner.separate({...model,id:'htdemucs_ft'},channels()),/maximum/);
});
test('progressive waveform covers only ready audio and progress never reaches 100 early',()=>{
  const buffer={getChannelData:()=>new Float32Array(4).fill(.5)};
  const path=progressiveWaveformPath([buffer],12,12);assert.equal(path.split('M').length-1,4);assert.ok(!path.includes('M320,'));
  const progress=new SeparationProgress();let previous=0;
  for(let i=0;i<3;i++)for(const event of [{phase:'inference',chunkIndex:i,totalChunks:3,progress:0},{phase:'inference',chunkIndex:i,totalChunks:3,progress:1},{phase:'chunk-ready',completedFrames:(i+1)*4,totalFrames:12}]){
    const v=progress.update(event);assert.ok(v>=previous&&v<100);previous=v;
  }
  assert.equal(progress.update({phase:'ready'}),100);
});

test('old Worker cannot publish into a later run; unsupported lengths and rate are rejected',async()=>{
  const {runner,workers}=runnerSetup();
  const first=runner.separate(model,channels());await flush();runner.cancel();await assert.rejects(first,{name:'AbortError'});
  const seen=[];const second=runner.separate(model,channels(),{onChunk:x=>seen.push(x)});await flush();
  workers[0].send(block());assert.equal(seen.length,0);
  workers[1].send({...block(),sampleRate:48000});await assert.rejects(second,/invalide/);
  await assert.rejects(runner.separate(model,[new Float32Array(60*44100+1),new Float32Array(60*44100+1)]),/maximum/);
});
