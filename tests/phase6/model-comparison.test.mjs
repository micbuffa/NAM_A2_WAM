import test from 'node:test';
import assert from 'node:assert/strict';
import {ModelBenchmark,benchmarkMatrix,benchmarkSummary,median,BENCHMARK_PROTOCOL,BENCHMARK_FIXTURE_SHA} from '../../examples/wam/source-separation/ModelBenchmark.js';
import {preferredModel} from '../../examples/wam/source-separation/BackendPolicy.js';
import {readBenchmarkReport,createModelComparisonPanel} from '../../examples/wam/source-separation/ModelComparisonPanel.js';
const model={id:'m',label:'Test',version:'v',files:[{sha256:'a'.repeat(64)}],runtime:'demucs-onnx-core',roles:['other'],backends:['webgpu','wasm']};
const identity=JSON.stringify([model.version,model.files.map(f=>f.sha256)]);
const input=()=>[new Float32Array(264600),new Float32Array(264600)];
const report=runs=>({protocol:BENCHMARK_PROTOCOL,fixtureSha256:BENCHMARK_FIXTURE_SHA,runs});
const row=(extra={})=>({modelId:'m',backend:'wasm',status:'ok',identity,frames:264600,totalMs:200,firstReadyMs:10,separationMs:150,...extra});
test('matrix enumerates only supported backends and never invents GPU for CPU-only models',()=>{
 assert.deepEqual(benchmarkMatrix([model],false).map(x=>x.backend),['wasm']);assert.equal(benchmarkMatrix([model],true).length,2);
 assert.equal(benchmarkMatrix([{...model,backends:['wasm']}],true).length,1);
});
test('summaries use median and exclude errors, stale weights, other fixtures and invalid times',()=>{
 const r=report([null,row(),row({totalMs:400}),row({status:'error',totalMs:1}),row({identity:'old',totalMs:1}),row({frames:1,totalMs:1}),row({totalMs:Infinity})]);
 assert.equal(benchmarkSummary(r,[model])[0].totalMs,300);assert.equal(benchmarkSummary(r,[model])[0].count,2);
 assert.deepEqual(benchmarkSummary({...r,fixtureSha256:'wrong'},[model]),[]);assert.equal(median([]),null);assert.equal(median([3,1,2]),2);
});
test('recommendation uses measured speed, startup or explicit guitar; limits to available backend',()=>{
 const guitar={...model,id:'g',roles:['guitar']};const r=report([row({backend:'webgpu',totalMs:50,firstReadyMs:40}),row({modelId:'g',backend:'webgpu',totalMs:70,firstReadyMs:20}),row({modelId:'g',totalMs:10,firstReadyMs:5}),row({totalMs:30,firstReadyMs:5})]);
 assert.equal(preferredModel([model,guitar],{webgpu:true},'guitar',{report:r}).id,'m');
 assert.equal(preferredModel([model,guitar],{webgpu:true},'guitar',{report:r,objective:'first'}).id,'g');
 assert.equal(preferredModel([model,guitar],{webgpu:true},'guitar',{report:r,objective:'guitar'}).id,'g');
 assert.equal(preferredModel([model,guitar],{webgpu:false},'guitar',{report:r}).id,'g');
});
test('storage errors and malformed reports gracefully use reference',()=>{
 assert.equal(readBenchmarkReport({getItem(){throw Error('denied');}}),null);assert.equal(readBenchmarkReport({getItem:()=>'{'}),null);
 assert.equal(readBenchmarkReport({getItem:()=>JSON.stringify({protocol:'old',runs:[]})}),null);
});
function fixture({missing=false,invalid=false,backend='wasm',fail=false}={}){
 let t=0,cancelled=0,active=0,peak=0;const records=[];
 const b=new ModelBenchmark({manager:{getStatus:async()=>({state:missing?'missing':'installed'})},now:()=>++t,createRunner:()=>({
  prepare:async()=>{active++;peak=Math.max(peak,active);},
  separate:async(m,c,o)=>{assert.equal(o.fallback,false);if(fail)throw Error('kernel');o.onChunk({startFrame:0,stems:[new Float32Array(invalid?2:264600),new Float32Array(invalid?2:264600)]});return {backend};},
  cancel:()=>{cancelled++;active--;},
 })});return {b,records,get cancelled(){return cancelled;},get peak(){return peak;}};
}
test('benchmark validates all audio, serializes trials and releases each worker without retaining PCM',async()=>{
 const f=fixture(),r=await f.b.run([{model,backend:'wasm'}],input(),{repetitions:2,onResult:r=>f.records.push(r)});
 assert.equal(r.length,2);assert.ok(r.every(x=>x.status==='ok'&&x.totalMs>0&&x.firstReadyMs>0));assert.equal(f.cancelled,2);assert.equal(f.peak,1);assert.equal(f.records[0].stems,undefined);assert.equal(f.b.busy,false);
});
test('missing model is recorded without downloading and errors are never ranked',async()=>{
 const f=fixture({missing:true});assert.equal((await f.b.run([{model,backend:'wasm'}],input(),{repetitions:1}))[0].status,'missing');assert.equal(f.cancelled,0);
 for(const options of [{invalid:true},{backend:'webgpu'},{fail:true}]){const f=fixture(options),r=await f.b.run([{model,backend:'wasm'}],input(),{repetitions:1});assert.equal(r[0].status,'error');assert.equal(f.cancelled,1);}
});
test('cancellation stops following configurations and always releases resources',async()=>{
 const f=fixture();await assert.rejects(f.b.run([{model,backend:'wasm'}],input(),{onProgress:()=>f.b.cancel()}),{name:'AbortError'});assert.equal(f.b.busy,false);assert.ok(f.cancelled>=1);
});
test('protocol rejects short input and repetition counts outside 1–3',async()=>{
 const f=fixture();await assert.rejects(f.b.run([],input(),{repetitions:0}));await assert.rejects(f.b.run([],[new Float32Array(1),new Float32Array(1)]));
});
// Minimal DOM verifies visible values and controls, not snapshots of implementation strings.
class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.value='';}append(...nodes){this.children.push(...nodes);if(this.tag==='select'&&!this.value)this.value=nodes[0].value;}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(...nodes){this.children=nodes;}}
const descendants=n=>[n,...n.children.flatMap(descendants)];
test('charts render numeric values, unknown configurations, sources and explicit recommendation action',()=>{
 let selected;const p=createModelComparisonPanel({models:[model],capabilities:{webgpu:false},doc:{createElement:t=>new Node(t)},storage:{getItem:()=>JSON.stringify(report([row()]))},onRecommend:m=>selected=m});
 const nodes=descendants(p);assert.ok(nodes.some(n=>n.textContent==='0.20 s · n=1'));assert.ok(nodes.some(n=>n.textContent==='Non mesuré / essai non abouti'));
 assert.ok(nodes.some(n=>n.href==='https://www.mvsep.com/quality_checker/leaderboard/guitar'));assert.equal(selected,undefined);nodes.find(n=>n.textContent==='Utiliser la recommandation').onclick();assert.equal(selected.id,'m');
 const metric=nodes.find(n=>n.attrs['aria-label']==='Mesure du graphique');metric.value='firstReadyMs';metric.onchange();assert.ok(descendants(p).some(n=>n.textContent==='0.01 s · n=1'));
});

test('partial local measurements cannot recommend the sole measured slower model',()=>{
 const a={...model,id:'htdemucs_4s_onnx'},b={...model,id:'slow'};
 const r=report([row({modelId:'slow',backend:'webgpu'})]);
 assert.equal(preferredModel([a,b],{webgpu:true},'guitar',{report:r}).id,a.id);
});

test('a tested backend failure is excluded from automatic choice without blocking valid candidates',()=>{
 const a={...model,id:'fast'},b={...model,id:'broken'};
 const r=report([row({modelId:'fast',backend:'webgpu'}),row({modelId:'broken',backend:'webgpu',status:'error',error:'timeout'})]);
 assert.equal(preferredModel([b,a],{webgpu:true},'guitar',{report:r}).id,'fast');
});

test('production factory adapts the positional FT API and preserves automatic segmentation',async()=>{
 const {createBenchmarkRunner}=await import('../../examples/wam/source-separation/BenchmarkRunnerFactory.js');let progress,segment,closed=false;
 class Classic{async separate(m,c,p,options){assert.equal(typeof p,'function');progress=p;segment=options.segmentSeconds;return {backend:'wasm'};}cancel(){closed=true;}}
 const r=createBenchmarkRunner({...model,runtime:'demucs-ort-wasm'}, {},{Classic}),callback=()=>{};
 assert.equal((await r.separate(model,input(),{onProgress:callback})).backend,'wasm');assert.equal(progress,callback);assert.equal(segment,0);r.cancel();assert.ok(closed);
});

test('benchmark musical fixture remains the exact licensed input recorded in the protocol',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const bytes=await readFile(new URL('../../examples/wam/source-separation/fixtures/music/slow-motion-dream.mp3',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),BENCHMARK_FIXTURE_SHA);
});

test('external guitar scores are restricted to dedicated-guitar families and keep a dated source',async()=>{
 const {GUITAR_RANKING}=await import('../../examples/wam/source-separation/ModelPerformanceData.js'),{readFile}=await import('node:fs/promises');
 const models=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/models.json',import.meta.url))).models;
 assert.equal(GUITAR_RANKING.checked,'2026-10-23');assert.ok(GUITAR_RANKING.source.startsWith('https://www.mvsep.com/'));
 for(const e of GUITAR_RANKING.entries){assert.ok(Number.isFinite(e.score));if(e.hostModel)assert.ok(models.find(m=>m.id===e.hostModel).roles.includes('guitar'));}
 assert.equal(GUITAR_RANKING.entries.find(e=>e.hostModel==='htdemucs_6s').score,5.2489);
});
test('cancel during the cache check prevents worker creation even when the model is absent',async()=>{
 let release;const gate=new Promise(r=>release=r),b=new ModelBenchmark({manager:{getStatus:()=>gate},createRunner:()=>assert.fail('no worker after cancel')});
 const pending=b.run([{model,backend:'wasm'}],input());b.cancel();release({state:'missing'});
 await assert.rejects(pending,{name:'AbortError'});assert.equal(b.busy,false);
});
test('a hidden tab cannot start a timed comparison',async()=>{
 const b=new ModelBenchmark({manager:{},createRunner:()=>assert.fail(),visibility:()=> 'hidden'});
 await assert.rejects(b.run([],input()),{name:'AbortError'});assert.notEqual(b.busy,true);
});
test('hiding during preparation cancels the worker and publishes no timing',async()=>{
 let visibility='visible',closed=false,published=false;
 const b=new ModelBenchmark({visibility:()=>visibility,manager:{getStatus:async()=>({state:'installed'})},createRunner:()=>({prepare:async()=>{visibility='hidden';},cancel:()=>closed=true,separate:()=>assert.fail('no inference after hidden')})});
 await assert.rejects(b.run([{model,backend:'wasm'}],input(),{onResult:()=>published=true}),{name:'AbortError'});
 assert.ok(closed);assert.equal(published,false);assert.equal(b.busy,false);
});
test('reference matrix covers every runnable backend with real successful repeated measurements',async()=>{
 const {REFERENCE_BENCHMARK}=await import('../../examples/wam/source-separation/ModelPerformanceData.js'),{readFile}=await import('node:fs/promises');
 const models=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/models.json',import.meta.url))).models;
 const summary=benchmarkSummary(REFERENCE_BENCHMARK,models);assert.equal(summary.length,benchmarkMatrix(models,true).length);assert.ok(summary.every(s=>s.count===2&&s.totalMs>0));
 assert.equal(preferredModel(models,{webgpu:true}).id,'htdemucs_4s_onnx');assert.equal(preferredModel(models,{webgpu:false}).id,'htdemucs_4s_onnx');
 assert.equal(preferredModel(models,{webgpu:true},'guitar',{objective:'first'}).id,'htdemucs_4s_preview');
});
