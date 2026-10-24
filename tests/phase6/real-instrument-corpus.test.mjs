import test from 'node:test';
import assert from 'node:assert/strict';
import {REAL_CORPUS} from '../../examples/wam/source-separation/RealCorpusDefinition.js';
import {validateRealManifest,validateRealAudio,loadRealCase,scoreRealCase,realQualitySummary,REAL_QUALITY_PROTOCOL} from '../../examples/wam/source-separation/RealInstrumentCorpus.js';
const clone=x=>JSON.parse(JSON.stringify(x));
test('real corpus pins three held-out bass tracks and three guitar passages from one no-bleed composition',()=>{
 assert.equal(validateRealManifest(REAL_CORPUS),REAL_CORPUS);const bass=REAL_CORPUS.cases.filter(c=>c.target==='bass'),guitar=REAL_CORPUS.cases.filter(c=>c.target==='guitar');assert.equal(bass.length,3);assert.equal(guitar.length,3);assert.equal(new Set(bass.map(c=>c.group)).size,3);assert.equal(new Set(guitar.map(c=>c.group)).size,1);assert.ok(bass.every(c=>c.split==='test'&&!c.otherIsGuitar));assert.ok(guitar.every(c=>!c.hasBleed&&c.otherIsGuitar));assert.equal(REAL_CORPUS.redistributeAudio,false);
 for(const c of REAL_CORPUS.cases)for(const f of Object.values(c.files)){assert.match(f.sha256,/^[a-f0-9]{64}$/);assert.match(f.path,/^[a-z0-9-]+\/(mix|reference|backing)\.wav$/);}
});
test('modified references, duplicate cases and path traversal are rejected before loading audio',()=>{
 for(const mutate of [m=>m.cases[0].files.mix.path='../secret',m=>m.cases[0].files.reference.sha256='0'.repeat(64),m=>m.cases[0].target='guitar',m=>m.cases[0].frames=1,m=>m.cases[1]=m.cases[0]]){const m=clone(REAL_CORPUS);mutate(m);assert.throws(()=>validateRealManifest(m));}
});
const stereo=values=>[Float32Array.from(values),Float32Array.from(values)];
const audio=()=>({mix:stereo([.5,-.5,.1]),reference:stereo([.2,-.3,.1]),backing:stereo([.3,-.2,0])});
test('reference checks require exact alignment and reconstructible finite mix with an active target',()=>{
 assert.ok(validateRealAudio(audio(),3));for(const mutate of [a=>a.backing[0][0]=.1,a=>a.mix[0][1]=NaN,a=>a.reference=stereo([0,0,0]),a=>a.backing=stereo([0])]){const a=audio();mutate(a);assert.throws(()=>validateRealAudio(a,3));}
});
test('audio loader verifies hashes and sample rate before exposing a reference',async()=>{
 const c={frames:3,files:Object.fromEntries(['mix','reference','backing'].map(r=>[r,{path:r,sha256:r}]))};const a=audio();let n=0;const opts={baseURL:'http://localhost/',fetcher:async url=>({ok:true,arrayBuffer:async()=>url.pathname.slice(1)}),digest:async x=>x,decode:async()=>{const data=a[['mix','reference','backing'][n++]];return {sampleRate:44100,numberOfChannels:2,length:3,getChannelData:i=>data[i]};}};
 assert.deepEqual(await loadRealCase(c,opts),a);await assert.rejects(loadRealCase(c,{...opts,digest:async()=> 'wrong'}),/SHA-256/);await assert.rejects(loadRealCase(c,{...opts,fetcher:async()=>({ok:false})}),/Corpus local absent/);await assert.rejects(loadRealCase(c,{...opts,decode:async()=>({sampleRate:48000,numberOfChannels:2,length:3})}),/Format audio/);
});
test('Other is a guitar proxy only with verified instrument metadata',()=>{
 const a=audio(),m={roles:['other','vocals']},stems=[...a.reference,...a.backing];assert.throws(()=>scoreRealCase({target:'guitar',otherIsGuitar:false},m,stems,a));const s=scoreRealCase({target:'guitar',otherIsGuitar:true},m,stems,a);assert.equal(s.role,'other');assert.ok(s.siSdrDb>100);
});
const model={id:'m',version:'v',files:[{sha256:'hash'}],roles:['guitar','bass'],backends:['wasm']};
const report=()=>({protocol:REAL_QUALITY_PROTOCOL,status:'completed',corpus:REAL_CORPUS,runs:REAL_CORPUS.cases.map(c=>({caseId:c.id,modelId:'m',backend:'wasm',frames:c.frames,identity:'["v",["hash"]]',status:'ok',score:{role:c.target,valid:true,siSdrDb:12,snrDb:11,gainDb:-.1,improvementDb:10}}))});
test('real summaries never conflate three clips with three independent guitar compositions or the synthetic protocol',()=>{
 const r=report(),s=realQualitySummary(r,[model]);assert.equal(s.length,2);assert.equal(s.find(s=>s.instrument==='guitar').compositions,1);assert.equal(s.find(s=>s.instrument==='bass').compositions,3);
 for(const mutate of [r=>r.protocol='guitar-bass-controlled-v1',r=>r.status='running',r=>r.runs=[],r=>r.corpus=null]){const x=report();mutate(x);assert.deepEqual(realQualitySummary(x,[model]),[]);}
 const duplicate=report();duplicate.runs.push(duplicate.runs[0]);assert.equal(realQualitySummary(duplicate,[model]).length,1);
});
import {spawnSync} from 'node:child_process';
test('Python preparation helpers preserve float WAVs and exact references without third-party Python packages',()=>{
 const r=spawnSync('python3',['-m','unittest','discover','-s','tests/phase6','-p','test_prepare_real_corpus.py'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr||r.error?.message);assert.match(r.stderr,/Ran 4 tests/);
});
import {instrumentRecommendation,createInstrumentRecommendationPanel} from '../../examples/wam/source-separation/InstrumentRecommendationPanel.js';
import {QUALITY_PROTOCOL,QUALITY_CASES} from '../../examples/wam/source-separation/InstrumentQuality.js';
const choices=['pilot-winner','real-winner'].map(id=>({...model,id,label:id,roles:['guitar','bass'],backends:['webgpu']}));
const scoreFor=n=>({valid:true,siSdrDb:n,snrDb:n,gainDb:0,improvementDb:n});
function adviceReports(){
 const real={...report(),runs:REAL_CORPUS.cases.flatMap(c=>choices.map(m=>({caseId:c.id,modelId:m.id,backend:'webgpu',frames:c.frames,identity:'["v",["hash"]]',status:'ok',score:{...scoreFor(m.id==='real-winner'?20:10),role:c.target}})))};
 const pilot={protocol:QUALITY_PROTOCOL,status:'completed',cases:QUALITY_CASES.map(c=>({id:c.id,sourceSha256:c.sourceSha256})),runs:QUALITY_CASES.flatMap(c=>choices.map(m=>({caseId:c.id,modelId:m.id,backend:'webgpu',frames:264600,identity:'["v",["hash"]]',status:'ok',scores:{guitar:scoreFor(m.id==='pilot-winner'?20:10),bass:scoreFor(m.id==='pilot-winner'?20:10)}})))};
 return {real,pilot};
}
test('real advice uses its own target cases and never averages synthetic scores into real results',()=>{
 const {real,pilot}=adviceReports();assert.equal(instrumentRecommendation(choices,{webgpu:true},'bass',real).model.id,'real-winner');assert.equal(instrumentRecommendation(choices,{webgpu:true},'bass',pilot).model.id,'pilot-winner');
 const r=clone(real);r.runs=r.runs.filter(r=>!(r.modelId==='pilot-winner'&&r.caseId===REAL_CORPUS.cases[0].id));assert.equal(instrumentRecommendation(choices,{webgpu:true},'bass',r),null);
});
class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.value='';}append(...n){this.children.push(...n);if(this.tag==='select'&&!this.value)this.value=n[0].value;}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(...n){this.children=n;}}
const flatten=n=>[n,...n.children.flatMap(flatten)];
test('corpus/profile controls are passive; explicit apply respects the chosen evidence source',()=>{
 let selected;const {real,pilot}=adviceReports(),panel=createInstrumentRecommendationPanel({models:choices,capabilities:{webgpu:true},doc:{createElement:t=>new Node(t)},storage:{getItem:()=>null},reference:pilot,realReference:real,onRecommend:m=>selected=m.id});
 const items=flatten(panel),basis=items.find(n=>n.attrs['aria-label']==='Corpus de la recommandation'),apply=items.find(n=>n.textContent==='Utiliser ce conseil instrumental');assert.equal(selected,undefined);assert.ok(items.some(n=>n.textContent?.startsWith('Corpus réel')));apply.onclick();assert.equal(selected,'real-winner');selected=undefined;basis.value='pilot';basis.onchange();assert.equal(selected,undefined);apply.onclick();assert.equal(selected,'pilot-winner');
});
import {resumableRealRuns} from '../../examples/wam/source-separation/RealInstrumentCorpus.js';
test('resume keeps only verified successes and rejects duplicates or altered corpora',()=>{
 const m={...model,roles:['guitar','bass']},r=report();for(const row of r.runs)row.score.role=REAL_CORPUS.cases.find(c=>c.id===row.caseId).target;r.status='cancelled';assert.equal(resumableRealRuns(r,[m]).length,6);
 const stale=clone(r);stale.runs[0].identity='old';stale.runs[1].status='error';stale.runs[2].score.role='guitar';assert.equal(resumableRealRuns(stale,[m]).length,3);
 const duplicate=clone(r);duplicate.runs.push(duplicate.runs[0]);assert.throws(()=>resumableRealRuns(duplicate,[m]),/dupliqué/);
 const wrong=clone(r);wrong.corpus.cases[0].files.reference.sha256='0'.repeat(64);assert.throws(()=>resumableRealRuns(wrong,[m]));
});

test('a score from the wrong model head cannot enter a target ranking',()=>{
 const r=report();r.runs[0].score.role='guitar';assert.equal(realQualitySummary(r,[model]).length,1);r.runs[3].score.valid='true';assert.deepEqual(realQualitySummary(r,[model]),[]);
});
import {REFERENCE_REAL_QUALITY} from '../../examples/wam/source-separation/RealQualityData.js';
import {readFile} from 'node:fs/promises';
test('archived real campaign contains 24 unique successful observations, resumes eleven and changes only bass advice',async()=>{
 const {models}=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/models.json',import.meta.url)));const r=REFERENCE_REAL_QUALITY;assert.equal(r.status,'completed');assert.equal(r.runs.length,24);assert.equal(r.resumedRows,11);assert.ok(r.runs.every(r=>r.status==='ok'));assert.equal(new Set(r.runs.map(r=>[r.caseId,r.modelId,r.backend].join('/'))).size,24);
 const s=realQualitySummary(r,models);assert.equal(s.length,8);assert.ok(s.filter(s=>s.instrument==='bass').every(s=>s.compositions===3));assert.ok(s.filter(s=>s.instrument==='guitar').every(s=>s.compositions===1));assert.equal(instrumentRecommendation(models,{webgpu:true},'guitar',r).model.id,'bs_roformer_sw_6s');assert.equal(instrumentRecommendation(models,{webgpu:true},'bass',r).model.id,'htdemucs_4s_onnx');assert.ok(!s.some(s=>s.modelId==='htdemucs_ft'));
});
