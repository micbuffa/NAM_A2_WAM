import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {StudioPlayer} from '../../examples/wam/projects/StudioPlayer.js';
import {StudioSeparation, separationSources, drumsPcm} from '../../examples/wam/projects/StudioSeparation.js';
import {ProgressiveMultitrackEngine} from '../../examples/wam/source-separation/ProgressiveMultitrackEngine.js';

const models = JSON.parse(await readFile(new URL('../../examples/wam/source-separation/studio-models.json', import.meta.url))).models;
const deferred = () => { let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve}; };
function context() {
  const node = extra => ({targets: new Set(), connect(to) {this.targets.add(to); return to;}, disconnect(to) {to ? this.targets.delete(to) : this.targets.clear();}, ...extra});
  const param = () => ({value: 1, setTargetAtTime(value) {this.value = value;}});
  const c = {currentTime: 0, sources: [], state: 'running', resume: async () => {},
    createGain: () => node({gain: param()}), createStereoPanner: () => node({pan: param()}),
    createBufferSource() {const s = node({start(time, offset) {this.time = time; this.offset = offset;}, stop() {this.stopped = true;}}); c.sources.push(s); return s;},
    createBuffer(channels, length, sampleRate) {
      const pcm = Array.from({length: channels}, () => new Float32Array(length));
      return {length, sampleRate, duration: length / sampleRate, numberOfChannels: channels, getChannelData: i => pcm[i], copyToChannel: (data, i) => pcm[i].set(data)};
    },
  };
  return c;
}
function packet(model, startFrame = 0, length = 44100, totalFrames = 88200) {
  return {roles: model.roles, startFrame, sampleRate: 44100, totalFrames,
    stems: model.roles.flatMap((_, i) => [new Float32Array(length).fill((i+1)/100), new Float32Array(length).fill(-(i+1)/100)]),
    peaks: model.roles.map((_, i) => new Float32Array(Math.min(totalFrames, 2048)).fill((i+1)/100))};
}
async function fixture({gpu = true, webnn = false, runner: customRunner, decode} = {}) {
  const c = context(), player = new StudioPlayer(c), manager = new EventTarget();
  manager.tasks = new Map(); manager.download = async () => {}; manager.cancel = () => {};
  const calls = [], runner = customRunner ?? {cancel() {}, prepare: async (_, backend) => calls.push(backend), async separate(model, channels, options) {
    calls.push(options.backend); assert.equal(channels[0].length, 88200);
    options.onChunk(packet(model)); options.onProgress({phase: 'chunk-ready', completedFrames: 44100, totalFrames: 88200});
    options.onChunk(packet(model, 44100)); return {backend: options.backend};
  }};
  const source = {id: 41, origin: 'original', name: 'Song', instrument: 'guitar', audio: {url: '/api/audio'}};
  const separation = new StudioSeparation({context: c, player, manager, runners: {demucs: runner, roformer: runner}, loadModels: async () => models,
    capabilities: async () => ({webgpu: gpu,webnn}), fetchAudio: async () => ({ok: true, arrayBuffer: async () => new ArrayBuffer(2)}),
    decode: decode ?? (async () => c.createBuffer(2, 88200, 44100))});
  await separation.init();
  return {c, player, manager, source, separation, runner, calls};
}

test('Studio defaults to Demucs4, GPU only after successful capability detection, with CPU fallback available', async () => {
  for (const gpu of [true, false]) {
    const f = await fixture({gpu});
    assert.equal(f.separation.modelId, 'htdemucs_4s_onnx');
    assert.equal(f.separation.backend, gpu ? 'webgpu' : 'wasm');
    assert.deepEqual(f.separation.models.map(m => m.id), ['htdemucs_4s_onnx','bs_roformer_sw_6s']);
    assert.throws(() => f.separation.configure('vocal-only', 'wasm'));
    if (!gpu) assert.throws(() => f.separation.configure('bs_roformer_sw_6s', 'webgpu'));
  }
  assert.deepEqual(separationSources([{id:1,origin:'personal',audio:{url:'/DI'}}, {id:2,origin:'stem',audio:{url:'/stem'}}, {id:3,origin:'original',audio:{url:'/mix'}}, {id:4,origin:'legacy',audio:{url:'/old'}}]).map(t => t.id), [3,4]);
});

test('both product models publish aligned stereo instruments with peaks, with no mutation of the original', async () => {
  for (const model of models) {
    const f = await fixture();
    f.separation.configure(model.id, 'webgpu');
    const original = structuredClone(f.source);
    await f.separation.run({track: f.source, projectId: 9});
    const result = f.separation.result;
    assert.equal(f.separation.busy, false);
    assert.equal(result.engine.availableFrames, 88200);
    assert.equal(result.engine.complete, true);
    assert.equal(result.tracks.length, model.roles.length);
    assert.deepEqual(result.tracks.map(t => t.instrument), model.roles.map(r => r === 'piano' ? 'keys' : r));
    assert.ok(result.tracks.every(t => t.origin === 'stem' && t.inputMonitoring === false && t.id < 0));
    assert.equal(result.engine.chunks[0].tracks[0].buffer.numberOfChannels, 2);
    assert.equal(result.engine.chunks[0].tracks[0].buffer.getChannelData(1)[0], Math.fround(-.01));
    assert.equal(result.tracks[0].peaks[0], Math.fround(.01));
    assert.deepEqual(f.source, original);
    assert.match(f.separation.status, /in RAM, not saved/u);
    f.separation.stop({reset: true}); f.player.destroy();
  }
});

test('preview is playable at the first chunk and buffers without moving the time-axis denominator', async () => {
  const first = deferred(), next = deferred();
  const runner = {cancel() {next.resolve();}, async separate(model, channels, options) {
    options.onChunk(packet(model)); first.resolve(); await next.promise;
    options.onChunk(packet(model, 44100)); return {backend:'wasm'};
  }};
  const f = await fixture({runner, gpu: false});
  const running = f.separation.run({track: f.source, projectId: 1}); await first.promise;
  assert.equal(f.player.duration, 2); assert.equal(f.player.availableDuration, 1); assert.equal(f.player.ready, true);
  await f.player.play(); const start = f.separation.result.engine.startedAt;
  assert.ok(f.c.sources.every(s => s.time === start));
  f.c.currentTime = start + 1;
  f.separation.result.engine.boundary(1);
  assert.equal(f.player.waiting, true); assert.equal(f.player.position, 1);
  assert.equal(f.player.playing, true, 'Pause must remain available while buffering');
  next.resolve(); await running;
  assert.equal(f.player.duration, 2); assert.equal(f.player.availableDuration, 2);
  assert.equal(f.player.waiting, false);
  await f.player.seek(1.5); assert.equal(f.player.position, 1.5);
  f.separation.stop({reset: true}); f.player.destroy();
});

test('stopping during decode or a late worker callback cannot populate a new project', async () => {
  const started = deferred(), finish = deferred();
  const f = await fixture({decode: async () => {started.resolve(); return finish.promise;}});
  const running = f.separation.run({track:f.source, projectId:1}); await started.promise;
  f.separation.stop({reset:true});
  finish.resolve(f.c.createBuffer(2,88200,44100)); await running;
  assert.equal(f.separation.result, null); assert.equal(f.separation.busy,false);
  const ready = deferred(), release = deferred();
  const runner = {cancel() {release.resolve();}, async separate(model, _, options) {ready.resolve(); await release.promise; options.onChunk(packet(model)); return {backend:'wasm'};}};
  const g = await fixture({runner});
  const pending = g.separation.run({track:g.source,projectId:1}); await ready.promise;
  g.separation.configure('bs_roformer_sw_6s','wasm'); await pending;
  assert.equal(g.separation.result,null); assert.equal(g.separation.modelId,'bs_roformer_sw_6s');
});

test('stop preserves already published audio as a partial preview and releases the runner', async () => {
  const first = deferred(), release = deferred();
  const runner = {cancel() {release.resolve();}, async separate(model, _, options) {options.onChunk(packet(model)); first.resolve(); await release.promise; throw new DOMException('stop','AbortError');}};
  const f = await fixture({runner});
  const pending = f.separation.run({track:f.source,projectId:1}); await first.promise;
  f.separation.stop(); await pending;
  assert.equal(f.separation.result.engine.partial,true); assert.equal(f.player.duration,1);
  assert.equal(f.separation.hasAudio,true); assert.equal(f.separation.busy,false);
  await f.player.play(); assert.equal(f.player.playing,true);
  f.separation.stop({reset:true}); f.player.destroy();
});

test('Roformer GPU preparation failure falls back before publication and reports the effective CPU backend', async () => {
  const attempted = [];
  const runner = {cancel() {}, async prepare(_, backend) {attempted.push(backend); if (backend==='webgpu') throw Error('No GPU');},
    async separate(model, _, options) {assert.equal(options.backend,'wasm'); options.onChunk(packet(model,0,88200)); return {backend:'wasm'};}};
  const f = await fixture({runner}); f.separation.configure('bs_roformer_sw_6s','webgpu');
  await f.separation.run({track:f.source,projectId:1});
  assert.deepEqual(attempted,['webgpu','wasm']); assert.equal(f.separation.effectiveBackend,'wasm');
  assert.match(f.separation.status,/CPU \/ WASM/u); f.separation.stop({reset:true});
});

test('the shared transport switches decks exclusively and applies Studio faders, pan, mute, solo and loops', async () => {
  const f = await fixture();
  f.player.setTracks([{id:41,volume:80,pan:0}]);
  f.player.channels.get(41).buffer = f.c.createBuffer(2,88200,44100);
  await f.player.play(); const originalVoice = f.c.sources[0];
  await f.separation.run({track:f.source,projectId:1});
  assert.equal(originalVoice.stopped,true);
  const tracks = f.separation.result.tracks;
  f.separation.updateTrack(tracks[0].id, {volume:100, pan:-50, solo:true, factoryPreset:'forbidden'});
  assert.equal(tracks[0].factoryPreset,undefined);
  await f.player.play();
  const [voice, muted] = f.separation.result.engine.voices;
  assert.ok(Math.abs(voice.gain.gain.value*2 - 10**(.3)) < 1e-10);
  assert.equal(voice.pan.pan.value,-.5); assert.equal(muted.gain.gain.value,0);
  await f.player.setLoop({enabled:true,start:.2,end:.8});
  assert.deepEqual(f.player.loop,{enabled:true,start:.2,end:.8});
  assert.ok(f.separation.result.engine.regionPlaying);
  f.player.stop(); assert.equal(f.player.position,.2);
  f.separation.show('original'); assert.equal(f.player.preview,f.separation.result.engine); assert.equal(f.separation.mode,'stems'); assert.equal(f.separation.viewTracks,tracks);
  f.separation.stop({reset:true}); f.player.destroy();
});


test('an invalid producer envelope fails before publishing playable PCM', async () => {
  const runner = {cancel() {}, async separate(model, _, options) {
    options.onChunk({...packet(model),peaks:model.roles.map(()=>new Float32Array(2048).fill(NaN))});
  }};
  const f = await fixture({runner});
  await f.separation.run({track:f.source,projectId:1});
  assert.equal(f.separation.result.engine.availableFrames,0);
  assert.equal(f.separation.hasAudio,false);
  assert.match(f.separation.status,/waveform envelope invalid/u);
  f.separation.stop({reset:true});
});


test('live monitoring routing changes still notify the host while an instrument preview is active', async () => {
  const f = await fixture();
  await f.separation.run({track:f.source,projectId:1});
  let changes=0;
  f.player.addEventListener('statechange',()=>changes++);
  f.player.setTracks([{id:77,volume:80,pan:0,inputMonitoring:true}],77);
  assert.equal(f.player.liveId,77);
  assert.ok(changes>0);
  changes=0;
  f.player.setTracks([],null);
  assert.equal(f.player.liveId,null);
  assert.ok(changes>0);
  f.separation.stop({reset:true});
});

test('saved instruments remain disabled until every stem is decoded, and removed batches release channels', async () => {
  const c = context(), pending = new Map();
  c.decodeAudioData = async bytes => {const gate = deferred();pending.set(bytes.byteLength,gate);await gate.promise;return c.createBuffer(2,44100,44100);};
  const player = new StudioPlayer(c,{fetchAudio:async url=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(Number(url.slice(1)))})});
  player.setTracks([{id:1,origin:'stem',audio:{url:'/1'}},{id:2,origin:'stem',audio:{url:'/2'}}]);
  await new Promise(resolve=>setImmediate(resolve));
  pending.get(1).resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(player.ready,false);await player.play();assert.equal(player.playing,false);
  pending.get(2).resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(player.ready,true);await player.play();assert.equal(player.playing,true);
  player.setTracks([{id:3,origin:'original'}]);assert.deepEqual([...player.channels.keys()],[3]);player.destroy();
});

test('temporary server failures retry a bounded number of times and make a saved deck playable',async()=>{
  const c=context();c.decodeAudioData=async()=>c.createBuffer(2,44100,44100);let calls=0;
  const player=new StudioPlayer(c,{fetchAudio:async()=> (++calls<3?{ok:false,status:500}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),retryDelay:async()=>{}});
  const ready=new Promise(resolve=>player.addEventListener('load',resolve,{once:true}));
  player.setTracks([{id:1,origin:'stem',audio:{url:'/bass'}}]);await ready;
  assert.equal(calls,3);assert.equal(player.ready,true);assert.equal(player.channels.get(1).error,null);assert.equal(player.channels.get(1).loading,false);player.destroy();
});

test('a failed saved stem exposes its error and manual retry reloads only the failed file',async()=>{
  const c=context();c.decodeAudioData=async()=>c.createBuffer(2,44100,44100);let failed=true;const calls=[];
  const player=new StudioPlayer(c,{fetchAudio:async url=>{calls.push(url);return url==='/bass'&&failed?{ok:false,status:500}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(1)};},retryDelay:async()=>{}});
  const errored=new Promise(resolve=>player.addEventListener('error',resolve,{once:true}));
  player.setTracks([{id:1,origin:'stem',audio:{url:'/drums'}},{id:2,origin:'stem',audio:{url:'/bass'}}]);await errored;
  assert.equal(player.ready,false);assert.match(player.channels.get(2).error.message,/500/);assert.equal(calls.filter(url=>url==='/bass').length,3);
  const original=player.channels.get(1).buffer;failed=false;await player.retryFailed();
  assert.equal(player.ready,true);assert.equal(player.channels.get(1).buffer,original);assert.equal(calls.filter(url=>url==='/drums').length,1);assert.equal(calls.filter(url=>url==='/bass').length,4);player.destroy();
});

test('a delayed retry from a previous project cannot issue requests or publish audio into a new project',async()=>{
  const c=context();c.decodeAudioData=async()=>c.createBuffer(2,44100,44100);const gate=deferred();let calls=0;
  const player=new StudioPlayer(c,{fetchAudio:async()=>{calls++;return{ok:false,status:500};},retryDelay:()=>gate.promise});
  player.setTracks([{id:1,origin:'stem',audio:{url:'/old'}}]);await new Promise(resolve=>setImmediate(resolve));
  player.setTracks([]);gate.resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls,1);assert.equal(player.channels.size,0);assert.equal(player.ready,false);player.destroy();
});


test('restoring a six-stem project restores its model and exact saved deck, then switching history restores four', async () => {
  const {separation: c} = await fixture();
  const six = Array.from({length:6}, (_,i)=>({id:i+10,separationId:6,volume:53+i,pan:i-3}));
  const four = Array.from({length:4}, (_,i)=>({id:i+20,separationId:4}));
  const project = {activeSeparationId:6, tracks:[{id:1,origin:'original'},...four,...six], separations:[
    {id:4,state:'ready',manifest:{modelId:'htdemucs_4s_onnx',backend:'wasm',frames:44100}},
    {id:6,state:'ready',manifest:{modelId:'bs_roformer_sw_6s',backend:'webgpu',frames:44100}}]};
  c.restore(project);
  assert.equal(c.modelId,'bs_roformer_sw_6s');
  assert.deepEqual(c.viewTracks,six);
  assert.equal(c.viewTracks[0].volume,53);
  assert.equal(c.viewTracks[0].pan,-3);
  await c.init(); // Capability discovery completing after restore must not reset it to four.
  assert.equal(c.modelId,'bs_roformer_sw_6s');
  assert.ok(c.idle, 'a complete saved separation shows no status line');
  c.selectSaved(4);
  assert.equal(c.modelId,'htdemucs_4s_onnx');
  assert.deepEqual(c.viewTracks,four);
  project.separations[0].manifest = {...project.separations[0].manifest, partial:true, totalFrames:441000};
  c.selectSaved(4);
  assert.equal(c.status,'Partial separation · 1.0 s of 10.0 s');
  assert.match(c.statusDetail,/Demucs 4 · 4 tracks/);
  c.restore({tracks:[],separations:[]});
  assert.equal(c.viewTracks,null);
});

test('the minimal model dialog offers two choices and starts only the chosen model', async () => {
  const {StudioSeparationView} = await import('../../examples/wam/projects/StudioSeparationView.js');
  class Element extends EventTarget {
    constructor(tag) {super();this.tag = tag;this.children = [];this.dataset={};}
    append(...children) {this.children.push(...children);}
    setAttribute() {}
    remove() {}
    showModal() {this.open = true;}
    close() {this.open = false;this.dispatchEvent(new Event('close'));}
  }
  const originalDocument = globalThis.document;
  globalThis.document = {body:new Element('body'),createElement:tag=>new Element(tag)};
  try {
    for (const [index, modelId] of ['htdemucs_4s_onnx','bs_roformer_sw_6s'].entries()) {
      const f = await fixture(), fields = {};
      const view = Object.create(StudioSeparationView.prototype);
      const w = {owned:true,project:{id:7,tracks:[f.source]},accountLoadEpoch:1};
      Object.assign(view,{workspace:w,controller:f.separation,ready:Promise.resolve(),$:id=>fields[id]});
      const runs=[];f.separation.run = async options => runs.push({modelId:f.separation.modelId,...options});
      await view.chooseModel();
      const body=view.modelDialog.children[1];
      const duration=body.children[0].children[0].children[0];
      const choices=body.children.find(e=>e.className==='studio-model-choices').children;
      assert.equal(duration.value,'0','every dialog defaults to the entire song');
      assert.deepEqual(duration.children.map(option=>option.value),['0','5','10','30','60']);
      if(index===1)duration.value='30';
      assert.equal(choices.length,2);assert.equal(runs.length,0);
      await choices[index].onclick();
      assert.equal(runs.length,1);assert.equal(runs[0].modelId,modelId);
      assert.equal(runs[0].projectId,7);assert.equal(runs[0].seconds,index===0?0:30);
      assert.equal(runs[0].track.id,f.source.id,'without a track id, the first separable track is used');
      assert.equal(view.modelDialog,null);
      await view.chooseModel();
      assert.equal(view.modelDialog.children[1].children[0].children[0].children[0].value,'0','a previous excerpt is not reused');
      view.modelDialog.close();assert.equal(runs.length,1,'closing the dialog does not start separation');
      await view.chooseModel({sourceId:f.source.id,allowUnseparated:true});
      const keep=view.modelDialog.children[1].children.find(e=>e.textContent==='Keep as one track');
      assert.equal(keep.textContent,'Keep as one track');
      keep.onclick();assert.equal(runs.length,1,'keeping the import never invokes inference');
      const other={...f.source,id:f.source.id+100,name:'Other audio'};w.project.tracks=[f.source,other];
      await view.chooseModel({sourceId:other.id});
      await view.modelDialog.children[1].children.find(e=>e.className==='studio-model-choices').children[0].onclick();
      assert.equal(runs.length,2);assert.equal(runs[1].track.id,other.id,'the track whose ⋯ menu asked is the one separated');
      runs.length=1;w.project.tracks=[f.source];
      await view.chooseModel();w.accountLoadEpoch++;
      await view.modelDialog.children[1].children.find(e=>e.className==='studio-model-choices').children[0].onclick();
      assert.equal(runs.length,1,'a dialog opened under another account cannot start inference');
    }
    const f=await fixture({webnn:true}),view=Object.create(StudioSeparationView.prototype);
    f.separation.directAssets={available:true};
    Object.assign(view,{workspace:{owned:true,project:{id:7,tracks:[f.source]},accountLoadEpoch:1},controller:f.separation,ready:Promise.resolve(),$:()=>({value:String(f.source.id)})});
    const runs=[];f.separation.run=async options=>runs.push({backend:f.separation.backend,...options});
    await view.chooseModel();
    let body=view.modelDialog.children[1],engine=body.children.find(e=>e.children?.[0]?.children?.[0]?.id==='studioDialogBackend').children[0].children[0];
    assert.equal(engine.children.filter(option=>option.value.startsWith('webnn')&&!option.disabled).length,6);
    view.modelDialog.close();f.separation.directAssets={available:false};await view.chooseModel();
    body=view.modelDialog.children[1];engine=body.children.find(e=>e.children?.[0]?.children?.[0]?.id==='studioDialogBackend').children[0].children[0];
    assert.equal(engine.children.filter(option=>option.value.startsWith('webnn')&&!option.disabled).length,3,'no native direct choice without deployed assets');
    assert.throws(()=>f.separation.configure('htdemucs_4s_onnx','webnn-direct-cpu'),/not included/);
    view.modelDialog.close();f.separation.directAssets={available:true};await view.chooseModel();
    body=view.modelDialog.children[1];engine=body.children.find(e=>e.children?.[0]?.children?.[0]?.id==='studioDialogBackend').children[0].children[0];
    engine.value='webnn-npu';engine.onchange();view.modelDialog.close();assert.equal(f.separation.backend,'webgpu','cancel keeps previous backend');
    await view.chooseModel();body=view.modelDialog.children[1];engine=body.children.find(e=>e.children?.[0]?.children?.[0]?.id==='studioDialogBackend').children[0].children[0];
    engine.value='webnn-npu';engine.onchange();const choices=body.children.find(e=>e.className==='studio-model-choices').children;
    assert.equal(choices[0].disabled,false);assert.equal(choices[1].disabled,true,'SW6 cannot launch with WebNN');
    await choices[0].onclick();assert.equal(runs[0].backend,'webnn-npu');assert.equal(f.separation.backend,'webnn-npu');
  } finally {globalThis.document=originalDocument;}
});

test('WebNN menu is API-based, stays opt-in, and cannot configure a backend absent from this browser',async()=>{
 const {studioBackendOptions}=await import('../../examples/wam/source-separation/StudioWebNN.js');
 const {detectCapabilities}=await import('../../examples/wam/source-separation/Capabilities.js');
 for(const userAgent of ['Firefox experimental','Chrome Canary']){
  assert.equal((await detectCapabilities({ml:{},userAgent})).webnn,true);
 }
 const missing=await fixture();assert.throws(()=>missing.separation.configure('htdemucs_4s_onnx','webnn-gpu'),/not exposed/);
 assert.equal(studioBackendOptions({webgpu:true,webnn:false}).filter(o=>o.value.startsWith('webnn')).every(o=>o.disabled),true);
 const f=await fixture({webnn:true});assert.equal(f.separation.backend,'webgpu');
 for(const device of ['cpu','gpu','npu']){f.separation.configure('htdemucs_4s_onnx',`webnn-${device}`);assert.equal(f.separation.backend,`webnn-${device}`);}
 assert.equal(studioBackendOptions({webgpu:true,webnn:true}).filter(o=>o.value.startsWith('webnn')&&!o.disabled).length,6);
 assert.equal(studioBackendOptions({webgpu:true,webnn:true,modelId:'bs_roformer_sw_6s'}).filter(o=>o.value.startsWith('webnn-')&&!o.value.startsWith('webnn-direct-')).every(o=>o.disabled),true);
});

test('Studio master controls the shared playback output for saved and progressive audio without changing track mix',()=>{
 const c=context(),player=new StudioPlayer(c);assert.equal(player.masterVolume,1);
 player.setMasterVolume(.4);assert.equal(player.output.gain.value,.4);assert.equal(player.base.output,player.output);
 const preview=new ProgressiveMultitrackEngine(c);preview.startStream({roles:['guitar'],totalFrames:120});
 player.setPreview(preview,[]);assert.ok(preview.outputNode.targets.has(player.output));assert.equal(player.output.gain.value,.4);
 player.setMasterVolume(0);assert.equal(player.output.gain.value,0);player.setPreview(null);assert.equal(player.masterVolume,0);
 assert.throws(()=>player.setMasterVolume(NaN));assert.throws(()=>player.setMasterVolume(1.1));player.destroy();preview.destroy();
});
test('Studio controller routes direct four/six stem jobs through the native prepared runner without downloading ONNX',async()=>{
 for(const model of models){const f=await fixture({webnn:true});f.separation.runners.direct=f.runner;let prepared=0;f.runner.prepare=async()=>prepared++;f.manager.download=async()=>{throw Error('unexpected ONNX download');};f.separation.configure(model.id,'webnn-direct-cpu');await f.separation.run({track:f.source,projectId:7});assert.equal(prepared,1);assert.equal(f.separation.result?.tracks.length,model.roles.length);assert.match(f.separation.status,/Done/);}
});

test('Add track during separation rejects without detaching preview, then PCM and peaks keep advancing',async()=>{
 const {ProjectsWorkspace}=await import('../../examples/wam/projects/ProjectsWorkspace.js');
 let push,release;const gate=new Promise(r=>release=r),started=new Promise(r=>push=r);
 const f=await fixture({runner:{cancel(){},async separate(model,channels,{onChunk}){
   const first=packet(model);for(const peaks of first.peaks)peaks.fill(0,peaks.length/2);
   onChunk(first);push();await gate;onChunk(packet(model,44100));return{backend:'wasm'};
 }}});
 const running=f.separation.run({track:f.source,seconds:5,projectId:7});await started;
 const preview=f.separation.result,engine=f.player.preview;
 const w=Object.create(ProjectsWorkspace.prototype);w.separation=f.separation;
 w.api={createTrack:()=>{throw Error('Must not mutate project while separating');}};
 await assert.rejects(()=>w.addTrack({name:'Guitar',instrument:'guitar'}),/Stop separation/);
 assert.equal(f.separation.mode,'stems');assert.equal(f.separation.result,preview);assert.equal(f.player.preview,engine);
 assert.equal(engine.availableFrames,44100);assert.equal(preview.tracks[0].peaks.at(-1),0);
 release();await running;assert.equal(engine.availableFrames,88200);assert.ok(preview.tracks[0].peaks.at(-1)>0);
 assert.equal(engine.complete,true);
});

test('one timeline keeps the instruments through streaming, Stop and legacy project-view requests; original stays in reserve',async()=>{
 let ready,release;const started=new Promise(r=>ready=r),gate=new Promise(r=>release=r);
 const f=await fixture({runner:{cancel(){release();},async separate(model,channels,{onChunk}){
  onChunk(packet(model));ready();await gate;return{backend:'wasm'};
 }}});
 const source={...f.source, timelineVisible:true};f.separation.projectTracks=[source];
 const running=f.separation.run({track:source,projectId:12});await started;
 const tracks=f.separation.viewTracks,engine=f.player.preview;
 f.separation.show('original');assert.equal(f.separation.viewTracks,tracks);assert.equal(f.player.preview,engine);
 f.separation.stop();await running;
 assert.equal(f.separation.viewTracks,tracks);assert.equal(f.player.preview,engine);assert.equal(engine.partial,true);
 assert.equal(separationSources(f.separation.projectTracks)[0],source);assert.equal(source.timelineVisible,true);
 assert.ok(!tracks.some(track=>track.id===source.id));
});

test('the separation status line reports progress and playable audio',async()=>{
 const {separationStatusLine}=await import('../../examples/wam/projects/StudioSeparationView.js');
 const running={busy:true,status:'Separating',progress:49.7,result:{engine:{availableDuration:134.63}}};
 assert.equal(separationStatusLine(running), 'Separating · 49% · 134.6 s ready');
 assert.equal(separationStatusLine(running,true), 'Separating · 49% · 134.6 s ready · buffering');
 assert.equal(separationStatusLine({...running,status:'Loading model · WebGPU…'}), 'Loading model · WebGPU…');
});

test('an empty guitar track keeps monitoring while four separated tracks play, loop and stop',async()=>{
  const c=context(),player=new StudioPlayer(c);
  const stems=Array.from({length:4},(_,i)=>({id:i+1,origin:'stem',volume:80,pan:0}));
  const guitar={id:5,origin:'personal',instrument:'guitar',volume:80,pan:0,inputMonitoring:true};
  player.setTracks([...stems,guitar],5);
  for(const stem of stems)player.channels.get(stem.id).buffer=c.createBuffer(1,441000,44100);
  const insert={input:c.createGain(),live:c.createGain(),output:c.createGain()},input=c.createGain();
  player.setInsert(5,insert);player.setLiveInput(input);
  assert.equal(player.liveId,5);assert.ok(input.targets.has(insert.live));
  await player.play();assert.equal(player.playing,true);assert.equal(player.liveId,5);
  assert.ok(input.targets.has(insert.live));assert.equal(c.sources.length,4,'empty guitar adds no playback voice');
  for(const stem of stems)assert.equal(player.channels.get(stem.id).playback.gain.value,1);
  player.setTracks([...stems,{...guitar,volume:65}],5);assert.ok(input.targets.has(insert.live));assert.equal(input.targets.size,1);
  await player.setLoop({enabled:true,start:1,end:3});assert.equal(player.liveId,5);assert.ok(input.targets.has(insert.live));
  player.setTracks([...stems,{...guitar,inputMonitoring:false}],5);
  assert.equal(player.liveId,null);assert.equal(input.targets.size,0);assert.equal(player.playing,true);
  player.setTracks([...stems,guitar],5);assert.equal(input.targets.size,1);
  player.stop();assert.equal(player.liveId,5);assert.equal(input.targets.size,1);
  player.destroy();assert.equal(input.targets.size,0);
});

test('the drums of the first minute go to tempo estimation once, or at least 20 s of a stopped run', () => {
  const second = 44100, block = frames => ({getChannelData: () => Float32Array.from({length: frames}, (_, i) => i % 7)});
  const engine = (seconds, total = 180) => {
    const chunks = []; let start = 0;
    while (start < seconds * second) { const length = Math.min(30 * second, seconds * second - start); chunks.push({startFrame: start, length, tracks: [{buffer: block(1)}, {buffer: block(length)}]}); start += length; }
    return {tracks: [{role: 'bass'}, {role: 'drums'}], chunks, availableFrames: seconds * second, totalFrames: total * second};
  };
  assert.equal(drumsPcm(engine(30)), null, 'waits for a minute of drums');
  assert.equal(drumsPcm(engine(90)).length, 60 * second);
  assert.equal(drumsPcm(engine(90))[30 * second + 8], 1, 'chunks are laid end to end');
  assert.equal(drumsPcm(engine(15), {final: true}), null, 'too short a stopped run');
  assert.equal(drumsPcm(engine(30), {final: true}).length, 30 * second);
  assert.equal(drumsPcm(engine(40, 40)).length, 40 * second, 'a song shorter than a minute');
  assert.equal(drumsPcm({...engine(90), tracks: [{role: 'bass'}, {role: 'other'}]}), null);

  const c = Object.create(StudioSeparation.prototype), sent = [];
  c.dispatchEvent = event => sent.push(event);
  c.result = {engine: engine(90), projectId: 4};
  c.emitDrums(); c.emitDrums({final: true});
  assert.equal(sent.length, 1);
  assert.equal(sent[0].type, 'drums-audio');
  assert.deepEqual([sent[0].detail.projectId, sent[0].detail.sampleRate, sent[0].detail.pcm.length], [4, 44100, 60 * second]);
});

test('a plain Save project leaves the separation strip hidden, so the tracks do not move', async () => {
  const {StudioSeparationView} = await import('../../examples/wam/projects/StudioSeparationView.js');
  const element = () => ({hidden: false, disabled: false, style: {}, textContent: '', value: '', title: '', options: [], children: [],
    replaceChildren(...children) { this.children = children; this.options = children; }, removeAttribute() {}, append() {},
    classList: {names: new Set(), toggle(name, on) { on ? this.names.add(name) : this.names.delete(name); }, contains(name) { return this.names.has(name); }},
    closest() { return this.label ??= element(); }, querySelector() { return this.option ??= element(); }});
  const f = await fixture(), fields = {}, view = Object.create(StudioSeparationView.prototype);
  const w = {owned: true, saving: true, project: {id: 7, tracks: [f.source], separations: []}, player: {waiting: false}};
  Object.assign(view, {workspace: w, controller: f.separation, $: id => fields[id] ??= element()});
  const originalOption = globalThis.Option;
  globalThis.Option = class { constructor(label, value) { Object.assign(this, {label, value, disabled: false}); } };
  try {
    f.separation.prompt('Separate instruments from a track');
    view.render();
    assert.equal(fields.studioProgress.hidden, true); assert.equal(fields.studioStatus.hidden, true);
    f.separation.setStatus('Saving instruments · 1/4 · bass · upload', 25);
    view.render();
    assert.equal(fields.studioProgress.hidden, false); assert.equal(fields.studioStatus.hidden, false);
  } finally { globalThis.Option = originalOption; }
});

test('a finished separation keeps its strip in place until another project opens', async () => {
  const {StudioSeparationView} = await import('../../examples/wam/projects/StudioSeparationView.js');
  const element = () => ({hidden: false, disabled: false, inert: false, style: {}, textContent: '', value: '', title: '', options: [], children: [],
    replaceChildren(...children) { this.children = children; this.options = children; }, removeAttribute() { this.value = ''; }, append() {},
    classList: {names: new Set(), toggle(name, on) { on ? this.names.add(name) : this.names.delete(name); }, contains(name) { return this.names.has(name); }},
    closest() { return this.label ??= element(); }, querySelector() { return this.option ??= element(); }});
  const f = await fixture(), fields = {}, view = Object.create(StudioSeparationView.prototype);
  const w = {owned: true, saving: false, project: {id: 7, tracks: [f.source], separations: []}, player: {waiting: false}};
  Object.assign(view, {workspace: w, controller: f.separation, $: id => fields[id] ??= element()});
  const originalOption = globalThis.Option;
  globalThis.Option = class { constructor(label, value) { Object.assign(this, {label, value, disabled: false}); } };
  try {
    f.separation.busy = true; f.separation.setStatus('Separating', 40);
    view.render();
    assert.equal(fields.studioStop.hidden, false); assert.equal(fields.studioSeparation.classList.contains('is-settled'), false);
    f.separation.busy = false; f.separation.setStatus('Done · 4 instruments', 100);
    view.render();
    assert.deepEqual([fields.studioStop.hidden, fields.studioStop.inert, fields.studioStatus.hidden, fields.studioProgress.hidden, fields.studioProgress.value],
      [false, true, false, false, 100]);
    assert.equal(fields.studioSeparation.classList.contains('is-settled'), true);
    f.separation.prompt('');
    view.render();
    assert.equal(fields.studioStatus.hidden, false, 'saving the instruments keeps the strip');
    w.project = {id: 8, tracks: [f.source], separations: []};
    view.render();
    assert.deepEqual([fields.studioStop.hidden, fields.studioStatus.hidden, fields.studioProgress.hidden], [true, true, true]);
  } finally { globalThis.Option = originalOption; }
});
