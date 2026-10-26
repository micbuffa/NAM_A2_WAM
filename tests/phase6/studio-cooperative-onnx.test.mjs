import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CooperativeOnnxSession,validateStagePlan,buildStageModel,createCooperativeRoformerSession} from '../../examples/wam/source-separation/CooperativeOnnxSession.js';
const part=(inputs,outputs,gpuOutputs=[])=>({inputs,outputs,gpuOutputs,spans:[[0,1]],inputMetadata:inputs.map(()=>''),outputMetadata:outputs.map(()=>''),valueMetadata:[]});
const plan=()=>({version:1,sourceBytes:3,sourceSha256:'0'.repeat(64),headerSpans:[[0,1]],outputNames:['out_spec_real','out_spec_imag'],stages:[part(['spec_real'],['shared']),part(['shared','spec_imag'],['out_spec_real']),part(['shared'],['out_spec_imag'])]});
function tensor(name,events){return {dispose(){events.push(`dispose:${name}`);}};}
test('cooperative inference drains GPU then yields before submitting the next stage, preserving tensor lifetime',async()=>{
 const events=[],shared=tensor('shared',events),real=tensor('real',events),imag=tensor('imag',events),inputs={spec_real:tensor('input',events),spec_imag:tensor('input-imag',events)};
 const sessions=[{run:async feeds=>{assert.equal(feeds.spec_real,inputs.spec_real);events.push('run0');return {shared};}},{run:async feeds=>{assert.equal(feeds.shared,shared);events.push('run1');return {out_spec_real:real};}},{run:async feeds=>{assert.equal(feeds.shared,shared);events.push('run2');return {out_spec_imag:imag};}}].map(s=>({...s,release:async()=>events.push('release')}));
 const runner=new CooperativeOnnxSession(sessions,plan(),{drain:async()=>events.push('drain'),yieldControl:async()=>events.push('yield')});
 const output=await runner.run(inputs);
 assert.deepEqual(output,{out_spec_real:real,out_spec_imag:imag});
 assert.deepEqual(events,['run0','drain','yield','run1','drain','yield','run2','drain','dispose:shared','yield']);
 assert.equal(runner.lastTimings.length,3);await runner.release();await runner.release();assert.equal(events.filter(e=>e==='release').length,3);
 await assert.rejects(runner.run(inputs),/indisponible/);
});
test('cooperative failure disposes every owned intermediate and output without disposing borrowed inputs',async()=>{
 for(const failAt of ['network','drain','yield']){
  const events=[],input=tensor('input',events),shared=tensor('shared',events),output=tensor('output',events);let drains=0,yields=0;
  const sessions=[{run:async()=>({shared})},{run:async()=>{if(failAt==='network')throw Error('network failed');return {out_spec_real:output};}}];
  const runner=new CooperativeOnnxSession(sessions,plan(),{drain:async()=>{if(++drains===2&&failAt==='drain')throw Error('GPU lost');},yieldControl:async()=>{if(++yields===2&&failAt==='yield')throw Error('cancelled');}});
  await assert.rejects(runner.run({spec_real:input,spec_imag:input}));assert.equal(runner.busy,false);
  assert.equal(events.filter(e=>e==='dispose:shared').length,1);assert.ok(!events.includes('dispose:input'));
  if(failAt!=='network')assert.equal(events.filter(e=>e==='dispose:output').length,1);
 }
});
test('cooperative session rejects overlap and release during active inference',async()=>{
 let resume;const gate=new Promise(r=>resume=r),p=plan();p.stages=[part(['spec_real'],p.outputNames)];
 const session=new CooperativeOnnxSession([{run:async()=>{await gate;return {out_spec_real:{dispose(){}},out_spec_imag:{dispose(){}}};}}],p,{drain:async()=>{},yieldControl:async()=>{}});
 const pending=session.run({spec_real:{}});await assert.rejects(session.run({}),/indisponible/);await assert.rejects(session.release(),/cours/);resume();await pending;
});
test('stage plan rejects missing dependencies, invalid byte ranges, duplicated outputs and GPU final downloads',()=>{
 assert.equal(validateStagePlan(plan(),3).stages.length,3);
 for(const mutate of [p=>p.stages[0].inputs=['unknown'],p=>p.stages[0].spans=[[2,5]],p=>p.stages[2].outputs=['shared'],p=>p.stages[1].gpuOutputs=['out_spec_real'],p=>p.sourceBytes=4,p=>p.stages[0].outputMetadata=[]]){
  const p=plan();mutate(p);assert.throws(()=>validateStagePlan(p,3));
 }
});
test('stage model wraps original byte spans in ONNX GraphProto without altering weights',()=>{
 const p=plan();p.stages=[part([],['out_spec_real','out_spec_imag'])];p.stages[0].outputMetadata=[];
 const bytes=buildStageModel(Uint8Array.of(8,10,20),p,0);
 assert.equal(bytes[0],8);assert.equal(bytes[1],58);assert.ok(bytes.length>20);assert.equal(bytes[3],8);
});
test('cooperative preparation refuses unverified source before creating sessions',async()=>{
 let calls=0;const ort={InferenceSession:{create:async()=>calls++}};
 await assert.rejects(createCooperativeRoformerSession(ort,new Uint8Array(3).buffer,{loadPlan:async()=>plan()}),/poids/);assert.equal(calls,0);
});
test('cooperative preparation releases already created sessions if a later stage fails',async()=>{
 const p=plan(),bytes=Uint8Array.of(1,2,3);p.sourceSha256=Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex');let calls=0,released=0;
 const ort={InferenceSession:{create:async()=>{if(++calls===2)throw Error('compile failed');return {release:async()=>released++};}}};
 await assert.rejects(createCooperativeRoformerSession(ort,bytes.buffer,{loadPlan:async()=>p,yieldControl:async()=>{}}),/compile failed/);assert.equal(released,1);
});
test('pinned SW plan covers 18 stages and retains GPU intermediates with CPU final spectra',async()=>{
 const p=JSON.parse(await readFile(new URL('../../examples/wam/source-separation/roformer-stage-plan.json',import.meta.url)));
 validateStagePlan(p,352778874);assert.equal(p.stages.length,18);assert.equal(p.nodesPerStage,400);assert.ok(p.stages.some(s=>s.gpuOutputs.length));
 assert.equal(p.sourceSha256,'d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444');
});
