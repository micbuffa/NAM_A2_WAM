import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {measuredCandidates,recommendMeasuredBackend,recommendSeparationDefault} from '../../examples/wam/source-separation/BenchmarkRecommendations.js';
const report=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/research/recommendation-reference.json',import.meta.url)));
const candidates=measuredCandidates(report);
test('provided campaign ranks successful candidates per model and separates startup from retained throughput',()=>{
 assert.equal(candidates.length,15);
 for(const model of ['demucs4','roformer6'])assert.equal(recommendMeasuredBackend(candidates,{model}).recommended.backend,'webgpu');
 const four=recommendMeasuredBackend(candidates,{model:'demucs4',webnn:true,durationSeconds:180});
 assert.equal(four.recommended.backend,'webgpu');assert.equal(four.fastest.backend,'webnn-gpu');assert.equal(four.fastest.implementation,'onnxruntime');
 const six=recommendMeasuredBackend(candidates,{model:'roformer6',webnn:true,durationSeconds:180});
 assert.equal(six.recommended.backend,'webgpu');assert.equal(six.fastest.backend,'webnn-npu');assert.equal(six.fastest.implementation,'direct-webnn');assert.equal(six.fastest.directParity,true);
 assert.equal(recommendMeasuredBackend(candidates,{model:'roformer6',webnn:true,durationSeconds:600}).recommended.backend,'webnn-npu');
 assert.equal(recommendMeasuredBackend(candidates,{model:'roformer6',webnn:true,initialized:true,durationSeconds:180}).recommended.backend,'webnn-npu');
});
test('heuristic respects capability constraints, guitar stem intent and absence of local evidence',()=>{
 assert.equal(recommendMeasuredBackend(candidates,{model:'demucs4',webgpu:false}).recommended.backend,'wasm');
 assert.equal(recommendMeasuredBackend(candidates,{model:'roformer6',webgpu:false,webnn:true,webnnDevices:['cpu']}).recommended.backend,'webnn-cpu');
 assert.equal(recommendMeasuredBackend(candidates,{model:'roformer6',webnn:true,webnnDevices:['gpu'],initialized:true}).recommended.backend,'webnn-gpu');
 assert.equal(recommendMeasuredBackend([],{model:'demucs4'}).recommended,null);
 assert.equal(recommendSeparationDefault(candidates,{dedicatedGuitar:true,webnn:true,durationSeconds:600}).model,'roformer6');
 assert.equal(recommendSeparationDefault(candidates,{}).model,'demucs4');
 assert.equal(recommendSeparationDefault([],{webgpu:false,webnn:true}).backend,'wasm');
 assert.equal(recommendSeparationDefault([],{webgpu:true}).evidence,'unmeasured-fallback');
 assert.throws(()=>recommendMeasuredBackend(candidates,{durationSeconds:NaN}));
});
test('candidate aggregation uses session medians and rejects invalid, failed, parity-failed or incomplete evidence',()=>{
 const first=structuredClone(report.runs[0]),second=structuredClone(first);second.summary.retained.medianMs=1000;second.config.session=2;
 const failed=structuredClone(first);failed.status='error';
 const parity=structuredClone(first);parity.baselineParity={withinTolerance:false};
 const invalid=structuredClone(first);invalid.summary.retained.medianMs=NaN;
 const incomplete=structuredClone(first);delete incomplete.phases;
 const values=measuredCandidates({runs:[first,second,failed,parity,invalid,incomplete]});assert.equal(values.length,1);assert.equal(values[0].samples,2);assert.equal(values[0].processingMs,(first.summary.retained.medianMs+1000)/2);const legacy=structuredClone(first);delete legacy.implementation;legacy.config.webnnImplementation='direct';assert.equal(measuredCandidates({runs:[legacy]})[0].implementation,'onnxruntime');
});
test('recommendation cards render reference evidence, update for warm sessions and do not relabel it as current measurements',async()=>{
 const {default:vm}=await import('node:vm');const experiment=await import('../../examples/wam/source-separation/WebNNExperiment.js');const recommendations=await import('../../examples/wam/source-separation/BenchmarkRecommendations.js');
 class Element{constructor(){this.value='';this.children=[];this.files=[];this.dataset={};}append(v){this.children.push(v);}replaceChildren(){this.children=[];}}
 const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};get('songSeconds').value='180';get('recommendationSource').value='current';get('input').value='music';get('seconds').value='6';
 const code=(await readFile(new URL('../../examples/wam/source-separation/webnn-diagnostics.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replaceAll('import.meta.url',"'https://example.test/lab/'");
 vm.runInNewContext(code,{URL,...experiment,...recommendations,document:{getElementById:get,createElement:()=>new Element(),addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},navigator:{userAgent:'test'},crossOriginIsolated:true,fetch:async()=>({ok:true,json:async()=>report})});
 await new Promise(setImmediate);
 assert.equal(get('recommendationSource').value,'reference');assert.match(get('recommendationEvidence').textContent,/User CSV/);assert.equal(get('recommendations').children.length,4);
 const text=()=>get('recommendations').children[3].children[1].textContent;assert.match(text(),/WEBGPU/);
 get('modelInitialized').checked=true;get('modelInitialized').onchange();assert.match(text(),/WEBNN-NPU/);
 get('recommendationSource').value='current';get('recommendationSource').onchange();assert.match(get('recommendationEvidence').textContent,/no measurements yet/);assert.match(text(),/No successful/);
});
