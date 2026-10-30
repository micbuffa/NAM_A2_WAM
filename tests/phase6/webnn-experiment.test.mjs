import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {experimentPlan,EXPERIMENT_PROTOCOL,EXPERIMENT_BACKENDS,ExperimentTimings,statistics,experimentSummary,experimentCsv,saveExperiment,restoreExperiment} from '../../examples/wam/source-separation/WebNNExperiment.js';
import {planChunks,OverlapAssembler} from '../../examples/wam/source-separation/ChunkTools.js';
import {withWebnnContext} from '../../examples/wam/source-separation/WebNNBenchmark.js';
import {BENCHMARK_FILES,buildBenchmark} from '../../tools/build-webnn-benchmark.mjs';
const settings={models:['demucs4','roformer6'],backends:EXPERIMENT_BACKENDS,sessions:2,trials:3};
test('five providers share identical runtime settings and rotating independent sessions preserve every configuration',()=>{
 const jobs=experimentPlan(settings);assert.equal(jobs.length,20);assert.equal(new Set(jobs.map(j=>j.id)).size,20);
 assert.deepEqual(jobs.filter(j=>j.model==='demucs4'&&j.session===1).map(j=>j.backend),EXPERIMENT_BACKENDS);
 assert.deepEqual(jobs.filter(j=>j.model==='demucs4'&&j.session===2).map(j=>j.backend),[...EXPERIMENT_BACKENDS.slice(1),'wasm']);
 assert.ok(jobs.every(j=>j.threads===1&&j.warmups===0&&j.gpuStrategy==='monolithic'));
 for(const patch of [{models:[]},{backends:['wasm','wasm']},{backends:['webnn']},{sessions:0},{trials:1},{warmups:4},{threads:9},{gpuStrategy:'unknown'},{timeoutSeconds:0}])assert.throws(()=>experimentPlan({...settings,...patch}));
});
test('retained-session statistics exclude first pass, use actual duration and never score errors',()=>{
 const r={status:'ok',config:{trials:3},frames:44100*12,sampleRate:44100,trials:[{processingMs:10000},{processingMs:6000},{processingMs:3000}]};
 const summary=experimentSummary(r);assert.equal(summary.retained.medianMs,4500);assert.equal(summary.retainedRtf,.375);assert.equal(summary.firstMs,10000);assert.equal(summary.retained.stddevMs,1500);
 assert.equal(experimentSummary({...r,status:'no-webnn-observed'}),null);assert.throws(()=>experimentSummary({...r,trials:[]}));assert.equal(statistics([1,NaN]),null);
});
test('public API instrumentation preserves synchronous/async semantics, rejected errors and receiver binding',async()=>{
 let clock=0;const timings=new ExperimentTimings(()=>++clock),object={value:42,sync(){return this.value;},async read(){return this.value;},async fail(){throw Error('native failure');}};
 assert.deepEqual(timings.instrument(object,['sync','read','fail','absent'],'api.'),{sync:'wrapped',read:'wrapped',fail:'wrapped',absent:'absent'});
 assert.equal(object.sync(),42);assert.equal(await object.read(),42);await assert.rejects(object.fail(),/native failure/);
 assert.equal(timings.counts['api.sync'],1);assert.equal(timings.counts['api.fail'],1);assert.equal(timings.entries.at(-1).error,'native failure');
 const immutable=Object.freeze({call(){return 1;}});assert.equal(timings.instrument(immutable,['call'],'api.').call,'unavailable');
 timings.onEntry=()=>{throw Error('diagnostic callback failed');};assert.equal(object.sync(),42);assert.equal(timings.counts['api.sync'],2);
 for(let i=0;i<20010;i++)timings.add('bounded',0,1);assert.equal(timings.entries.length,20000);assert.equal(timings.counts.bounded,20010);assert.equal(timings.totals.bounded,20010);assert.ok(timings.dropped>0);
});
test('metadata checkpoints retain errors without PCM; foreign reports and unavailable storage are rejected',()=>{
 let text;const storage={getItem:()=>text,setItem:(k,v)=>text=v},r={protocol:EXPERIMENT_PROTOCOL,runs:[{status:'timeout'}]};
 assert.equal(saveExperiment(storage,r),true);assert.deepEqual(restoreExperiment(storage),r);text='{}';assert.equal(restoreExperiment(storage),null);assert.equal(saveExperiment(null,r),false);
 const csv=experimentCsv({runs:[{config:{id:'test',model:'demucs4',backend:'webnn-npu',session:1},status:'unsupported',error:{message:'No "NPU", available'}}]});assert.match(csv,/No ""NPU"", available/);assert.match(csv,/unsupported/);
});
test('deployable bundle contains the full diagnostic import closure and legal notices',async()=>{
 for(const file of ['WebNNExperiment.js','webnn-diagnostics-worker.js','research/roformer-stage-plan.json','vendor/demucs-js/LICENSE.md','vendor/bs-roformer-web/LICENSE','fixtures/music/NOTICE.md'])assert.ok(BENCHMARK_FILES.includes(file));
 for(const file of BENCHMARK_FILES)await readFile(new URL('../../examples/wam/source-separation/'+file,import.meta.url));
 const html=await readFile(new URL('../../examples/wam/source-separation/webnn-diagnostics.html',import.meta.url),'utf8');assert.match(html,/value="1"/);assert.match(html,/WebNN \/ NPU/);
});
test('a failed integrity check cannot replace an existing deployable benchmark',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nam-webnn-build-'));
 try{
  await mkdir(join(root,'dist/WebNN_Benchmark'),{recursive:true});await writeFile(join(root,'dist/WebNN_Benchmark/keep'),'existing distribution');
  await mkdir(join(root,'examples/wam/source-separation/research'),{recursive:true});await mkdir(join(root,'third_party/nam-webnn-probe/runtime'),{recursive:true});
  const files=Object.fromEntries(['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'].map(name=>[name,{bytes:1,sha256:'incorrect'}]));
  await writeFile(join(root,'examples/wam/source-separation/research/webnn-runtime.json'),JSON.stringify({version:'1.30.0',files}));
  await writeFile(join(root,'third_party/nam-webnn-probe/runtime/ort.all.min.mjs'),'x');
  await assert.rejects(buildBenchmark(root),/integrity mismatch/);
  assert.equal(await readFile(join(root,'dist/WebNN_Benchmark/keep'),'utf8'),'existing distribution');
 }finally{await rm(root,{recursive:true,force:true});}
});

async function worker({backend='webnn-gpu',model='demucs4',available=true,dispatch=true,warmups=0,failSession=false,direct=false}={}){
 const raw=await readFile(new URL('../../examples/wam/source-separation/webnn-diagnostics-worker.js',import.meta.url),'utf8');
 const code=raw.replace(/^import .*;\n/gm,'').replace("import(new URL('ort.all.min.mjs',base).href)",'importRuntime()');
 const sent=[],fetches=[],releases=[];let now=0;
 const context={async createTensor(){return{};},writeTensor(){},dispatch(){},async readTensor(){return new ArrayBuffer(4);},destroy(){releases.push('context');}};
 const scope={performance:{timeOrigin:0,now:()=>++now,mark(){}},postMessage:m=>sent.push(structuredClone(m)),console:{warn(){}},navigator:{ml:available?{createContext:async()=>context}:undefined},isSecureContext:true,crossOriginIsolated:true,URL,Float32Array,ArrayBuffer,EXPERIMENT_MODELS:{demucs4:{url:'weights',bytes:4,sha256:'hash',channels:8},roformer6:{url:'weights',bytes:4,sha256:'hash',channels:12}},ExperimentTimings,experimentPlan,experimentSummary,sha256:async()=> 'hash',webnnContextOptions:deviceType=>({deviceType}),withWebnnContext,planChunks,OverlapAssembler,compareAudio:()=>({maxAbsolute:0}),createCooperativeRoformerSession:()=>{throw Error('unexpected cooperative strategy');},MLGraphBuilder:class{async build(){return{};}}};
 const ort={env:{wasm:{},versions:{web:'1.30.0'}},Tensor:class{},InferenceSession:{create:async()=>{
  if(failSession)throw Error('Unsupported operator');
  if(backend.startsWith('webnn-')){const b=new scope.MLGraphBuilder();await b.build({});await context.createTensor();}
  return{inputNames:['a','b'],outputNames:['x','y'],async run(){if(backend.startsWith('webnn-')){context.writeTensor();if(dispatch)context.dispatch();await context.readTensor();}return{};},async release(){releases.push('session');}};
 }}};
 scope.importRuntime=async()=>{if(direct)throw Error('Direct path imported ONNX Runtime');return ort;};
 scope.DirectAudioTensor=class{};scope.describeDirectWebNNFailure=()=>null;
 scope.loadDirectWebNNModel=async(model,{measure})=>{await measure('weightsFetchMs',async()=>{});return{recipe:{provenance:{sourceSha256:'hash'}},weights:new ArrayBuffer(4),indexEntry:{model}};};
 scope.createDirectWebNNSession=async(context,recipe,weights,{Builder,onPhase})=>{await new Builder(context).build({});onPhase('nativeGraphBuildMs',10);return{inputNames:['a','b'],outputNames:['x','y'],async run(){context.writeTensor();context.dispatch();await context.readTensor();return{};},async release(){releases.push('session');}};};
 const manifest={version:'1.30.0',files:Object.fromEntries(['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'].map(f=>[f,{bytes:4,sha256:'hash'}]))};
 scope.fetch=async url=>{fetches.push(String(url));return{ok:true,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(4)};};
 scope.OnnxCoreModel=class{constructor(session){this.session=session;this.sources=['drums','bass','other','vocals'];}};
 scope.separateTracks=async core=>{await core.session.run({});return Object.fromEntries(core.sources.map(role=>[role,{channelData:[new Float32Array(44100),new Float32Array(44100)]}]));};
 scope.RoformerCoreModel=class{constructor(session){this.session=session;}async separate(channels){this.onPhase?.('stft','start');this.onPhase?.('stft','end');await this.session.run({});this.onPhase?.('istft','start');this.onPhase?.('istft','end');return Array.from({length:12},()=>new Float32Array(channels[0].length));}};
 scope.self=scope;vm.runInNewContext(code.replaceAll('import.meta.url',"'https://example.test/lab/worker.js'"),scope);
 await scope.onmessage({data:{config:{id:'test',model,backend,session:1,trials:3,warmups,threads:1,gpuStrategy:'monolithic',timeoutSeconds:30,webnnImplementation:direct?'direct':'onnxruntime'},channels:[new Float32Array(44100),new Float32Array(44100)]}});
 return{sent,fetches,releases,record:sent.find(m=>m.type==='result').record};
}
test('real diagnostic Worker protocol separates setup/trials/warmups and captures WebNN build/read/dispatch evidence',async()=>{
 const {record,releases,sent}=await worker({warmups:1});assert.equal(record.status,'ok');assert.equal(record.runtimeVersion,'1.30.0');assert.equal(record.trials.length,3);assert.equal(record.warmups.length,1);
 assert.equal(record.webnnDispatches,4);assert.equal(record.apiCounts['webnn.build'],1);assert.ok(record.phases.contextMs>0&&record.phases.sessionCreateMs>0);assert.ok(record.trials.every(t=>t.dispatches===1));assert.equal(record.effectiveHardware,'unknown');assert.deepEqual(releases,['session','context']);assert.equal(sent[0].type,'ready');assert.ok(sent.some(m=>m.type==='checkpoint'&&m.record.nativeCheckpointTrace?.some(e=>e.name==='webnn.build')));
});
test('unavailable WebNN is never benchmarked as WASM, and context/session failures preserve phase and cleanup',async()=>{
 const unavailable=await worker({available:false});assert.equal(unavailable.record.status,'unsupported');assert.equal(unavailable.fetches.length,0);assert.equal(unavailable.record.summary,undefined);
 const failed=await worker({failSession:true});assert.equal(failed.record.status,'error');assert.equal(failed.record.error.phase,'sessionCreateMs');assert.deepEqual(failed.releases,['context']);
 const noDispatch=await worker({dispatch:false});assert.equal(noDispatch.record.status,'no-webnn-observed');assert.equal(noDispatch.record.summary,undefined);
});
test('WASM baseline exports reference PCM; Roformer records separate DSP spans and aligned six-stem output',async()=>{
 const wasm=await worker({backend:'wasm'});assert.equal(wasm.record.status,'ok');assert.equal(wasm.sent.find(m=>m.type==='result').stems.length,8);assert.equal(wasm.record.trials[0].dispatches,0);
 const roformer=await worker({model:'roformer6'});assert.equal(roformer.record.status,'ok');assert.ok(roformer.record.trials.every(t=>t.stftMs>0&&t.istftMs>0&&t.assemblyMs>0));
});

test('direct WebNN Worker path dispatches without loading any ONNX model or ORT runtime',async()=>{
 const {record,fetches}=await worker({direct:true});assert.equal(record.status,'ok');assert.equal(record.implementation,'direct-webnn');assert.equal(record.runtimeVersion,'none: direct WebNN');assert.equal(record.phases.runtimeImportMs,undefined);assert.equal(record.phases.nativeGraphBuildMs,10);assert.deepEqual(fetches,[]);assert.equal(record.trials.length,3);assert.ok(record.webnnDispatches>0);
});

test('direct implementation defaults are explicit, ORT baseline stays selectable, and CSV exports native phases',()=>{
 assert.ok(experimentPlan(settings).every(job=>job.webnnImplementation==='direct'));
 assert.ok(experimentPlan({...settings,webnnImplementation:'onnxruntime'}).every(job=>job.webnnImplementation==='onnxruntime'));
 assert.throws(()=>experimentPlan({...settings,webnnImplementation:'silent-auto'}));
 const csv=experimentCsv({runs:[{config:{id:'direct',model:'demucs4',backend:'webnn-gpu',session:1},implementation:'direct-webnn',status:'ok',phases:{graphConstructionMs:12,nativeGraphBuildMs:34},nativeNumericalQualification:'pending'}]});
 const [headers,row]=csv.split('\r\n').map(line=>line.split(','));assert.equal(headers.length,row.length);assert.match(csv,/nativeGraphBuildMs/);assert.match(csv,/direct-webnn/);
});

test('comparison campaign pairs both WebNN implementations, keeps non-WebNN baselines single and alternates pair order',()=>{
 const jobs=experimentPlan({...settings,webnnImplementation:'both'});
 assert.equal(jobs.length,32);assert.equal(new Set(jobs.map(j=>j.id)).size,32);
 assert.equal(jobs.filter(j=>j.backend==='wasm').length,4);assert.equal(jobs.filter(j=>j.backend==='webgpu').length,4);
 for(const model of settings.models)for(const backend of ['webnn-cpu','webnn-gpu','webnn-npu'])for(const session of [1,2]){
  const pair=jobs.filter(j=>j.model===model&&j.backend===backend&&j.session===session);
  assert.deepEqual(pair.map(j=>j.webnnImplementation),session===1?['direct','onnxruntime']:['onnxruntime','direct']);
  assert.ok(pair.every(j=>j.trials===3&&j.threads===1&&j.gpuStrategy==='monolithic'));
 }
 assert.ok(jobs.every(j=>j.webnnImplementation!=='both'));
 const csv=experimentCsv({runs:jobs.filter(j=>j.model==='demucs4'&&j.backend==='webnn-cpu'&&j.session===1).map(config=>({config,status:'unsupported'}))});
 assert.match(csv,/direct-webnn/);assert.match(csv,/onnxruntime/);
});
