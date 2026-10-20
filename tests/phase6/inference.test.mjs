import test from 'node:test';
import assert from 'node:assert/strict';
import {DemucsRunner} from '../../examples/wam/source-separation/DemucsRunner.js';
import {makeTracks, waveformPath} from '../../examples/wam/source-separation/AudioData.js';
import {MultitrackEngine} from '../../examples/wam/source-separation/MultitrackEngine.js';

const model = {id:'6s',runtime:'demucs-ort-wasm',sampleRate:44100,maxDuration:10,roles:['drums','bass','other','vocals','guitar','piano'],targets:6,files:[{sha256:'x'}]};
const channels = () => [new Float32Array(10).fill(.1),new Float32Array(10).fill(.1)];
function setup({roles=model.roles, files=1, status='installed', respond}={}) {
  const workers=[];
  const manager={getStatus:async()=>({state:status}),cache:{get:async()=>({files:Array.from({length:files},()=>new ArrayBuffer(1))})}};
  const runner=new DemucsRunner({manager,workerFactory:()=>{
    const index=workers.length;
    const worker={terminate(){this.terminated=true;},postMessage(message){this.message=message;queueMicrotask(()=>{
      const data=respond?respond(index):{type:'result',stems:Array.from({length:roles.length*2},(_,i)=>new Float32Array(10).fill(index*10+i)),elapsedMs:10,heapBytes:100,sampleRate:44100};
      if(data)this.onmessage({data});
    });}};
    if(index)assert.equal(workers[index-1].terminated,true,'previous heap released before next specialist');
    workers.push(worker);return worker;
  }});
  return {runner,workers};
}
test('runner transfers cached weights, preserves input and releases Worker after inference',async()=>{
  const {runner,workers}=setup();const input=channels();
  const result=await runner.separate(model,input);
  assert.equal(result.stems.length,12);assert.equal(result.backend,'wasm');assert.equal(workers[0].terminated,true);
  assert.equal(input[0].length,10);assert.notEqual(workers[0].message.left,input[0]);
});
test('FT selects the matching row of each specialist and frees each Worker',async()=>{
  const roles=model.roles.slice(0,4);const {runner,workers}=setup({roles,files:4});
  const events=[];
  const result=await runner.separate({...model,roles,targets:4},channels(),data=>events.push(data));
  assert.deepEqual(result.stems.map(s=>s[0]),[0,1,12,13,24,25,36,37]);
  assert.equal(result.elapsedMs,40);assert.equal(workers.length,4);assert.ok(workers.every(w=>w.terminated));
  assert.deepEqual(events.filter(e=>e.phase==='track-complete').map(e=>[e.trackIndex,e.trackRole,e.totalTracks]),[[0,'drums',4],[1,'bass',4],[2,'other',4],[3,'vocals',4]]);
});

test('6s reports all completed stems only after the joint inference result',async()=>{
  const {runner}=setup();const events=[];
  await runner.separate(model,channels(),data=>events.push(data));
  assert.deepEqual(events.filter(e=>e.phase==='track-complete').map(e=>e.trackRole),model.roles);
});
test('runner refuses missing models, overlong input and nonfinite model output',async()=>{
  await assert.rejects(setup({status:'missing'}).runner.separate(model,channels()),/Téléchargez/);
  await assert.rejects(setup().runner.separate(model,[new Float32Array(441001),new Float32Array(441001)]),/maximum/);
  await assert.rejects(setup().runner.separate(model,[new Float32Array([NaN]),new Float32Array([0])]),/requis/);
  const {runner,workers}=setup({respond:()=>({type:'result',stems:Array.from({length:12},()=>new Float32Array(10).fill(NaN))})});
  await assert.rejects(runner.separate(model,channels()),/invalides/);assert.equal(workers[0].terminated,true);
});

test('musical manifest pins immutable model files, specialist order and runtime integrity',async()=>{
  const {readFile}=await import('node:fs/promises');const {createHash}=await import('node:crypto');
  const base=new URL('../../examples/wam/source-separation/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('models.json',base)));
  assert.equal(manifest.version,1);
  const ft=manifest.models.find(m=>m.id==='htdemucs_ft'),six=manifest.models.find(m=>m.id==='htdemucs_6s');
  assert.deepEqual(ft.files.map(f=>f.url.match(/ft_(\w+)\.ort/)[1]),['drums','bass','other','vocals']);
  assert.deepEqual(six.roles,['drums','bass','other','vocals','guitar','piano']);
  assert.equal(ft.files.length,4);assert.equal(six.files.length,1);
  for(const model of manifest.models){
    assert.equal(model.sampleRate,44100);assert.deepEqual(model.backends,model.runtime==='demucs-onnx-core'?['webgpu','wasm']:['wasm']);
    for(const file of model.files){assert.ok(file.url.includes(model.sourceRevision));assert.match(file.sha256,/^[a-f0-9]{64}$/);assert.ok(file.size>1e6);}
  }
  const wasm=await readFile(new URL('vendor/demucs-wasm/demucs_onnx_simd.wasm',base));
  assert.equal(createHash('sha256').update(wasm).digest('hex'),'8dcb4329b49d1939a6691e008669feffadb40618b65f1bbd9929cea5880e935d');
  assert.ok(WebAssembly.validate(wasm));
});
test('cancel interrupts inference and permits another request',async()=>{
  const {runner,workers}=setup({respond:()=>null});const pending=runner.separate(model,channels());
  while(!workers.length)await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(runner.separate(model,channels()),/déjà/);runner.cancel();
  await assert.rejects(pending,{name:'AbortError'});assert.equal(runner.busy,false);assert.equal(workers[0].terminated,true);
});

function context() {
  const param=()=>({value:0,setTargetAtTime(v){this.value=v;}});
  const node=()=>({gain:param(),pan:param(),connect(to){return to;},disconnect(){this.disconnected=true;},start(t,offset){this.started=[t,offset];},stop(){this.stopped=true;}});
  return {currentTime:0,resume:async()=>{},createGain:node,createStereoPanner:node,createBufferSource:node};
}
const stems=[{id:'a',buffer:{duration:10,length:441000,sampleRate:44100}},{id:'b',buffer:{duration:10,length:441000,sampleRate:44100}}];
test('all stems share one start time, transport position and seek offset',async()=>{
  const ctx=context(),engine=new MultitrackEngine(ctx);engine.load(stems);await engine.play();
  assert.deepEqual(engine.voices.map(v=>v.source.started),[[.03,0],[.03,0]]);
  ctx.currentTime=2.03;assert.ok(Math.abs(engine.position-2)<1e-9);engine.pause();ctx.currentTime=5;assert.ok(Math.abs(engine.position-2)<1e-9);
  await engine.play();assert.equal(engine.voices[0].source.started[0],5.03);assert.ok(Math.abs(engine.voices[0].source.started[1]-2)<1e-9);
  await engine.seek(4);assert.deepEqual(engine.voices[1].source.started,[5.03,4]);
  engine.setLoop(false);assert.equal(engine.voices[0].source.loop,false);
  engine.stop();assert.equal(engine.position,0);assert.equal(engine.voices.length,0);
});
test('mute/solo gains and panning apply immediately to active voices',async()=>{
  const engine=new MultitrackEngine(context());engine.load(stems);await engine.play();
  engine.sync([{id:'a',volume:.3,pan:-.4,solo:true},{id:'b',volume:1,pan:0}]);
  assert.equal(engine.voices[0].gain.gain.value,.3);assert.equal(engine.voices[0].pan.pan.value,-.4);
  assert.equal(engine.voices[1].gain.gain.value,0);
  engine.sync([{id:'a',volume:.3,pan:0,muted:true}]);assert.equal(engine.voices[0].gain.gain.value,0);
  const old=engine.voices;engine.destroy();assert.ok(old.every(v=>v.source.stopped&&v.source.disconnected));
});

test('disabling loop after several turns preserves the actual current position',async()=>{
  const ctx=context(),engine=new MultitrackEngine(ctx);engine.load(stems);await engine.play();
  ctx.currentTime=22.03;assert.ok(Math.abs(engine.position-2)<1e-9);
  engine.setLoop(false);assert.ok(Math.abs(engine.position-2)<1e-9);
  ctx.currentTime=23.03;assert.ok(Math.abs(engine.position-3)<1e-9);
  engine.destroy();
});
test('pause while AudioContext resume is pending cancels playback; invalid tracks rejected',async()=>{
  const ctx=context();let resume;ctx.resume=()=>new Promise(resolve=>resume=resolve);
  const engine=new MultitrackEngine(ctx);engine.load(stems);const pending=engine.play();engine.pause();resume();await pending;
  assert.equal(engine.playing,false);assert.equal(engine.voices.length,0);
  assert.throws(()=>engine.load([stems[0],{id:'bad',buffer:{length:1,sampleRate:1}}]),/alignées/);
});
test('waveforms use actual PCM peaks and conversion keeps all channels and sample counts',()=>{
  assert.notEqual(waveformPath(new Float32Array(8)),waveformPath(new Float32Array(8).fill(.9)));
  const context={createBuffer:(n,length,sampleRate)=>({length,sampleRate,data:[],copyToChannel(x,c){this.data[c]=x.slice();}})};
  const result={roles:['guitar'],stems:channels(),sampleRate:44100};const [track]=makeTracks(context,result);
  assert.equal(track.buffer.length,10);assert.equal(track.buffer.sampleRate,44100);assert.equal(track.buffer.data.length,2);
  assert.throws(()=>makeTracks(context,{...result,stems:[new Float32Array([NaN]),new Float32Array([0])]}),/invalides/);
});
