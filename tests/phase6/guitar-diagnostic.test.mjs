import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {GUITAR_DIAGNOSTIC_CORPUS as corpus} from '../../examples/wam/source-separation/GuitarDiagnosticDefinition.js';
import {validateRealManifest,realQualitySummary,resumableRealRuns} from '../../examples/wam/source-separation/RealInstrumentCorpus.js';
import {instrumentRecommendation} from '../../examples/wam/source-separation/InstrumentRecommendationPanel.js';
import {QualityAuditionBank} from '../../examples/wam/source-separation/QualityAuditionBank.js';
const clone=x=>JSON.parse(JSON.stringify(x)),opts={corpus,protocol:'guitar-diagnostic-quality-v1'};
const model={id:'m',label:'M',version:'v',roles:['guitar','other'],backends:['webgpu'],files:[{sha256:'h'}]};
const report=()=>({protocol:opts.protocol,status:'completed',corpus,runs:corpus.cases.map(c=>({caseId:c.id,modelId:'m',backend:'webgpu',frames:c.frames,identity:'["v",["h"]]',status:'ok',score:{valid:true,role:'guitar',siSdrDb:12,snrDb:11,gainDb:0,improvementDb:10}}))});
test('guitar extension pins three compositions, real instruments and known MUSDB training membership',()=>{
 assert.equal(validateRealManifest(corpus,corpus),corpus);assert.equal(corpus.purpose,'training-split-diagnostic');assert.equal(new Set(corpus.cases.map(c=>c.group)).size,3);
 assert.deepEqual(corpus.cases.map(c=>c.style),['acoustic','distorted','clean and distorted']);
 assert.ok(corpus.cases.every(c=>c.split==='train'&&c.trainingSetDiagnostic&&c.otherIsGuitar&&!c.hasBleed&&c.referenceStream===3));assert.equal(corpus.redistributeAudio,false);
});
test('diagnostic provenance cannot be relabeled as held-out data or merged into production advice',()=>{
 for(const mutate of [c=>c.purpose='test',c=>c.trainingOverlap='unknown',c=>c.cases[0].split='test',c=>c.cases[0].metadataSha256='bad']){const c=clone(corpus);mutate(c);assert.throws(()=>validateRealManifest(c,corpus));}
 const r=report();assert.deepEqual(realQualitySummary(r,[model]),[]);assert.equal(instrumentRecommendation([model],{webgpu:true},'guitar',r),null);assert.throws(()=>resumableRealRuns(r,[model]));
 const s=realQualitySummary(r,[model],opts);assert.equal(s.length,1);assert.equal(s[0].count,3);assert.equal(s[0].compositions,3);assert.equal(resumableRealRuns(r,[model],opts).length,3);
});
test('diagnostic checkpoint rejects stale weights, duplicate observations and wrong source roles',()=>{
 const r=report();r.runs[0].identity='stale';r.runs[1].score.role='bass';assert.equal(resumableRealRuns(r,[model],opts).length,1);assert.deepEqual(realQualitySummary(r,[model],opts),[]);
 const nonBoolean=report();nonBoolean.runs[0].score.valid='true';assert.equal(resumableRealRuns(nonBoolean,[model],opts).length,2);
 const duplicate=report();duplicate.runs.push(duplicate.runs[0]);assert.throws(()=>resumableRealRuns(duplicate,[model],opts),/dupliqué/);
});
const stems=()=>[Float32Array.of(.1,.2),Float32Array.of(.1,.2),Float32Array.of(.3,.4),Float32Array.of(.3,.4)];
test('audition bank retains copies for one case/model, sums backing and replaces without leaking byte accounting',()=>{
 const bank=new QualityAuditionBank(),c={id:'a',target:'guitar'},audio=stems();assert.equal(bank.add(c,model,'webgpu',audio),true);audio[0][0]=9;
 const r=bank.forCase('a')[0];assert.ok(Math.abs(r.isolated[0][0]-.1)<1e-6);assert.deepEqual(r.backing,[Float32Array.of(.3,.4),Float32Array.of(.3,.4)]);assert.equal(bank.bytes,32);
 bank.add(c,model,'webgpu',stems());assert.equal(bank.bytes,32);assert.equal(bank.forCase('a').length,1);assert.deepEqual(bank.forCase('wrong'),[]);bank.clear();assert.equal(bank.bytes,0);assert.deepEqual(bank.forCase('a'),[]);
});
test('audition bank evicts oldest PCM to enforce its RAM budget, never returning the wrong case',()=>{
 const bank=new QualityAuditionBank({maxBytes:32});bank.add({id:'a',target:'guitar'},model,'webgpu',stems());bank.add({id:'b',target:'guitar'},model,'webgpu',stems());assert.equal(bank.bytes,32);assert.equal(bank.forCase('a').length,0);assert.equal(bank.forCase('b').length,1);
 const small=new QualityAuditionBank({maxBytes:31});assert.equal(small.add({id:'a',target:'guitar'},model,'webgpu',stems()),false);assert.equal(small.bytes,0);
});
test('diagnostic metadata preparation verifies exact fingerprints, top-level instruments and bleed',()=>{
 const result=spawnSync('python3',['-m','unittest','discover','-s','tests/phase6','-p','test_prepare_guitar_diagnostic.py'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stderr,/Ran 4 tests/);
});
import {REFERENCE_GUITAR_DIAGNOSTIC} from '../../examples/wam/source-separation/GuitarDiagnosticData.js';
import {REFERENCE_REAL_QUALITY} from '../../examples/wam/source-separation/RealQualityData.js';
import {readFile} from 'node:fs/promises';
test('archived diagnostic has twelve valid unique observations and cannot change the original recommendations',async()=>{
 const {models}=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/models.json',import.meta.url)));const r=REFERENCE_GUITAR_DIAGNOSTIC;
 assert.equal(r.status,'completed');assert.equal(r.runs.length,12);assert.equal(new Set(r.runs.map(r=>[r.caseId,r.modelId,r.backend].join('/'))).size,12);assert.ok(r.runs.every(r=>r.status==='ok'&&r.score.valid===true));
 const summaries=realQualitySummary(r,models,opts);assert.equal(summaries.length,4);assert.ok(summaries.every(s=>s.count===3&&s.compositions===3));assert.ok(!summaries.some(s=>s.modelId==='htdemucs_ft'));
 for(const c of corpus.cases){const runs=r.runs.filter(r=>r.caseId===c.id).sort((a,b)=>b.score.siSdrDb-a.score.siSdrDb);assert.equal(runs[0].modelId,'bs_roformer_sw_6s');}
 assert.equal(instrumentRecommendation(models,{webgpu:true},'guitar',r),null);assert.equal(instrumentRecommendation(models,{webgpu:true},'guitar',REFERENCE_REAL_QUALITY).model.id,'bs_roformer_sw_6s');assert.equal(instrumentRecommendation(models,{webgpu:true},'bass',REFERENCE_REAL_QUALITY).model.id,'htdemucs_4s_onnx');
});
