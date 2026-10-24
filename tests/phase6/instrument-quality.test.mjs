import test from 'node:test';
import assert from 'node:assert/strict';
import {QUALITY_CASES,QUALITY_FRAMES,QUALITY_PROTOCOL,controlledMixture,referenceMetrics,scoreInstrument,qualitySummary} from '../../examples/wam/source-separation/InstrumentQuality.js';
const ref=()=>[Float32Array.from([1,-1,1,-1]),Float32Array.from([1,-1,1,-1])];
test('SI-SDR accepts global gain, while SNR and gain expose missing level',()=>{
 const r=ref(),e=r.map(c=>Float32Array.from(c,x=>x*.5)),s=referenceMetrics(r,e);assert.ok(s.siSdrDb>100);assert.ok(Math.abs(s.snrDb-6.0206)<1e-3);assert.ok(Math.abs(s.gainDb+6.0206)<1e-3);assert.equal(s.polarity,1);
 const inverted=referenceMetrics(r,r.map(c=>Float32Array.from(c,x=>-x)));assert.equal(inverted.polarity,-1);assert.ok(inverted.snrDb<0);
});
test('known orthogonal interference gives analytic SI-SDR and improvement',()=>{
 const r=ref(),noise=Float32Array.from([1,1,-1,-1]),mix=r.map(c=>Float32Array.from(c,(x,i)=>x+noise[i])),est=r.map(c=>Float32Array.from(c,(x,i)=>x+.5*noise[i]));
 const score=scoreInstrument(r,est,mix);assert.ok(Math.abs(score.siSdrDb-6.0206)<1e-3);assert.ok(Math.abs(score.improvementDb-6.0206)<1e-3);
});
test('silent/invalid/unaligned audio cannot receive a meaningful score',()=>{
 assert.equal(referenceMetrics(ref().map(c=>c.fill(0)),ref()).reason,'silent-reference');assert.equal(referenceMetrics(ref(),ref().map(c=>c.fill(0))).reason,'silent-output');assert.throws(()=>referenceMetrics(ref(),[new Float32Array(1),new Float32Array(1)]));assert.throws(()=>referenceMetrics(ref(),ref().map(c=>c.fill(NaN))));
});
test('controlled references reconstruct exactly, preserve inputs and have deterministic active stems',()=>{
 const guitar=[0,1].map(()=>Float32Array.from({length:QUALITY_FRAMES},(_,i)=>Math.sin(i*.08)*.2)),before=guitar.map(c=>c.slice());
 const a=controlledMixture(guitar,QUALITY_CASES[0]),b=controlledMixture(guitar,QUALITY_CASES[0]);assert.deepEqual(a,b);assert.deepEqual(guitar,before);
 for(let c=0;c<2;c++)for(let i=0;i<QUALITY_FRAMES;i+=131){assert.ok(Math.abs(a.mix[c][i]-(a.refs.guitar[c][i]+a.refs.bass[c][i]+a.refs.drums[c][i]))<1e-6);assert.ok(Math.abs(a.mix[c][i])<=.9+1e-6);}
 for(const r of Object.values(a.refs))assert.equal(referenceMetrics(r,r).valid,true);
 assert.throws(()=>controlledMixture(guitar,{...QUALITY_CASES[0],seed:1}));
});
const model={id:'m',version:'v',files:[{sha256:'abc'}],roles:['guitar','bass'],backends:['wasm']};
const report=()=>({protocol:QUALITY_PROTOCOL,status:'completed',cases:QUALITY_CASES.map(c=>({id:c.id,sourceSha256:c.sourceSha256})),runs:QUALITY_CASES.map((c,i)=>({caseId:c.id,modelId:'m',backend:'wasm',status:'ok',frames:QUALITY_FRAMES,identity:JSON.stringify(['v',['abc']]),scores:{guitar:{valid:true,siSdrDb:10+i,improvementDb:2+i,snrDb:8,gainDb:-1},bass:{valid:true,siSdrDb:20+i,improvementDb:5+i,snrDb:15,gainDb:0}}}))});
test('summaries require each pinned case exactly once with finite scores and matching weights',()=>{
 const r=report(),s=qualitySummary(r,[model]);assert.equal(s.length,2);assert.equal(s[0].siSdrDb,11);assert.equal(s[0].minimumDb,10);assert.equal(s[1].count,3);
 for(const change of [r=>r.status='running',r=>r.protocol='old',r=>r.cases[0].sourceSha256='0'.repeat(64),r=>r.runs.pop(),r=>r.runs.push(r.runs[0]),r=>r.runs[0].identity='stale']){const x=report();change(x);assert.deepEqual(qualitySummary(x,[model]),[]);}
 const invalid=report();invalid.runs[0].scores.guitar.siSdrDb=NaN;assert.equal(qualitySummary(invalid,[model]).length,1);
});
import {instrumentRecommendation,createInstrumentRecommendationPanel,readQualityReport} from '../../examples/wam/source-separation/InstrumentRecommendationPanel.js';
test('instrument advice requires complete matching coverage and respects GPU/CPU capability',()=>{
 const r=report(),m2={...model,id:'other'};assert.equal(instrumentRecommendation([model],{webgpu:false},'bass',r).model.id,'m');assert.equal(instrumentRecommendation([model,m2],{},'bass',r),null);
 const gpu={...model,id:'gpu',backends:['wasm','webgpu']};for(const row of [...r.runs])r.runs.push({...row,modelId:'gpu',backend:'webgpu'});
 assert.equal(instrumentRecommendation([model,gpu],{webgpu:true},'guitar',r).model.id,'gpu');assert.equal(instrumentRecommendation([model],{},'vocals',r),null);
});
class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.value='';}append(...nodes){this.children.push(...nodes);if(this.tag==='select'&&!this.value)this.value=nodes[0].value;}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(...nodes){this.children=nodes;}}
const nodes=n=>[n,...n.children.flatMap(nodes)];
test('profile changes are passive, explicit apply picks measured model, and limitations/sources stay visible',()=>{
 let choice;const p=createInstrumentRecommendationPanel({models:[{...model,label:'Measured'}],capabilities:{},doc:{createElement:t=>new Node(t)},storage:{getItem:()=>null},reference:report(),onRecommend:m=>choice=m});
 const list=nodes(p),profile=list.find(n=>n.attrs['aria-label']==='Profil instrumental'),button=list.find(n=>n.textContent==='Utiliser ce conseil instrumental');assert.equal(choice,undefined);profile.value='bass';profile.onchange();assert.equal(choice,undefined);button.onclick();assert.equal(choice.id,'m');assert.ok(nodes(p).some(n=>n.textContent?.includes('mélanges contrôlés')));assert.ok(nodes(p).some(n=>n.textContent==='21.00 dB'));assert.ok(nodes(p).some(n=>n.href==='https://www.mvsep.com/algorithms/37'));
});
test('absent quality evidence disables advice; unreadable storage never breaks settings',()=>{
 assert.equal(readQualityReport({getItem(){throw Error();}}),null);const p=createInstrumentRecommendationPanel({models:[model],capabilities:{},doc:{createElement:t=>new Node(t)},storage:{getItem:()=>'{bad'},reference:null});assert.equal(nodes(p).find(n=>n.textContent==='Utiliser ce conseil instrumental').disabled,true);
});

test('guitar advice cannot promote Other as an isolated guitar on real songs',()=>{
 const other={...model,id:'other',roles:['bass','other'],backends:['wasm','webgpu']},r=report();for(const row of [...r.runs])r.runs.push({...row,modelId:'other',backend:'webgpu'});
 assert.equal(instrumentRecommendation([other,model],{webgpu:true},'guitar',r).model.id,'m');assert.equal(instrumentRecommendation([other],{webgpu:true},'guitar',r),null);
});
test('malformed local run lists are ignored safely',()=>{
 const r=report();r.runs={invalid:true};assert.deepEqual(qualitySummary(r,[model]),[]);
});
test('no delay search hides temporal smearing; shared stereo gain penalizes channel imbalance',()=>{
 const r=[Float32Array.from([0,1,.2,-.8,-.4,0]),Float32Array.from([0,1,.2,-.8,-.4,0])],delayed=r.map(c=>Float32Array.from(c,(_,i)=>i?c[i-1]:0));
 assert.ok(referenceMetrics(r,delayed).siSdrDb<5);
 const unbalanced=[r[0],Float32Array.from(r[1],x=>x*.1)];assert.ok(referenceMetrics(r,unbalanced).siSdrDb<5);
});
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('all three recorded guitar inputs remain the exact pinned files',async()=>{
 for(const c of QUALITY_CASES){const data=await readFile(new URL('../../examples/wam/assets/audio/'+c.file,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),c.sourceSha256);}
});

import {InstrumentComparison} from '../../examples/wam/source-separation/InstrumentComparison.js';
test('long specialists expose real track progress instead of an unchanged inference label',async()=>{
 const messages=[],m={...model,label:'FT',roles:['bass']},comparison=new InstrumentComparison({manager:{getStatus:async()=>({state:'installed'})},createRunner:()=>({cancel(){},async separate(m,c,o){o.onProgress({phase:'inference',trackIndex:1,totalTracks:4,trackRole:'bass',modelIndex:1,totalModels:4,progress:.5});return {backend:'wasm',stems:c};}})});
 await comparison.run([{model:m,backend:'wasm'}],ref(),{onProgress:s=>messages.push(s)});assert.ok(messages.some(s=>s.includes('piste 2/4 — Basse')&&s.includes('%')));
});

test('null entries and malformed report objects cannot break recommendations',()=>{
 for(const mutate of [r=>r.cases[0]=null,r=>r.runs=[null],r=>r.runs={}]){const r=report();mutate(r);assert.deepEqual(qualitySummary(r,[model]),[]);assert.equal(instrumentRecommendation([model],{},'guitar',r),null);}
});

test('a good median cannot hide a case worse than the unseparated mix',()=>{
 const r=report();r.runs[0].scores.guitar.improvementDb=-1;assert.equal(qualitySummary(r,[model])[0].minimumImprovementDb,-1);assert.equal(instrumentRecommendation([model],{},'guitar',r),null);assert.ok(instrumentRecommendation([model],{},'bass',r));
});

test('GPU-only observations are not presented as CPU quality measurements',()=>{
 const m={...model,backends:['wasm','webgpu']},r=report();for(const row of r.runs)row.backend='webgpu';assert.ok(instrumentRecommendation([m],{webgpu:true},'bass',r));assert.equal(instrumentRecommendation([m],{webgpu:false},'bass',r),null);
});
import {REFERENCE_QUALITY} from '../../examples/wam/source-separation/InstrumentQualityData.js';
test('archived pilot has all fifteen real successful runs and eligible GPU advice matches its measured results',async()=>{
 const {models}=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/models.json',import.meta.url)));
 assert.equal(REFERENCE_QUALITY.runs.length,15);assert.ok(REFERENCE_QUALITY.runs.every(r=>r.status==='ok'));const s=qualitySummary(REFERENCE_QUALITY,models);assert.equal(s.length,10);assert.ok(s.every(r=>r.count===3));
 for(const instrument of ['guitar','bass'])assert.equal(instrumentRecommendation(models,{webgpu:true},instrument,REFERENCE_QUALITY).model.id,'bs_roformer_sw_6s');
 const acoustic=REFERENCE_QUALITY.runs.find(r=>r.modelId==='htdemucs_6s'&&r.caseId==='acoustic');assert.ok(acoustic.scores.guitar.improvementDb<0);assert.ok(acoustic.scores.guitar.gainDb<-19);
});
