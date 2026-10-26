import test from 'node:test';
import assert from 'node:assert/strict';
import {CONFIGURATIONS,summarizeTrial,summarizeQualification} from './fixtures/StudioWebNNProtocol.js';
test('qualification separates end-to-end validation cost from candidate inference and preserves failures',()=>{
 const row=summarizeTrial({backend:'webnn-gpu',status:'done',wallMs:12000,timings:{inferenceMs:2000,referenceMs:6000},evidence:{dispatches:1}},264600);
 assert.equal(row.endToEndRtf,2);assert.equal(row.candidateRtf,1/3);assert.equal(row.effectiveHardware,'unknown');assert.equal(row.nativeWebNNObserved,true);
 const failed=summarizeTrial({backend:'webnn-npu',status:'error',wallMs:100,timings:{inferenceMs:0}},264600);
 assert.equal(failed.endToEndRtf,null);assert.equal(failed.candidateRtf,null);assert.equal(failed.nativeWebNNObserved,false);
 assert.throws(()=>summarizeTrial(row,0));
});
test('partial matrices, unavailable devices and failed parity never imply native qualification or a speed ranking',()=>{
 const rows=CONFIGURATIONS.map(backend=>summarizeTrial({backend,status:'done',wallMs:1000,evidence:{dispatches:1},productionParity:{passed:true}},44100));
 const pass=summarizeQualification(rows);assert.equal(pass.allNativePassed,true);assert.equal(pass.nativeSuccesses,3);assert.equal(pass.rankingEligible,false);
 assert.equal(summarizeQualification(rows.slice(0,2)).allNativePassed,false);
 rows.at(-1).status='error';assert.equal(summarizeQualification(rows).allNativePassed,false);
 rows.at(-1).status='done';rows.at(-1).productionParity.passed=false;assert.equal(summarizeQualification(rows).allNativePassed,false);
});

test('real Canary report observes all three WebNN dispatches but rejects every native result on bass parity',async()=>{
 const {readFile}=await import('node:fs/promises');
 const report=JSON.parse(await readFile(new URL('../../docs/evaluations/studio-webnn-canary-2026-10-26.json',import.meta.url)));
 assert.match(report.userAgent,/Chrome\/158\./u);
 assert.equal(report.frames,264600);assert.equal(report.sampleRate,44100);
 assert.equal(report.modelSha256,'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748');
 const native=report.rows.filter(row=>row.backend.startsWith('webnn-'));
 assert.equal(native.length,3);
 for(const row of native){
  assert.equal(row.nativeWebNNObserved,true);assert.equal(row.status,'error');assert.equal(row.publishedFrames,0);
  assert.equal(row.evidence.dispatches,1);assert.equal(row.evidence.validatedBlocks,0);
  assert.deepEqual(row.parity.roles.filter(role=>!role.passed).map(role=>role.role),['bass']);
  assert.ok(row.parity.relativeRmsError<row.parity.limits.relativeRms,'global pass must not hide the failed bass');
  assert.equal(row.endToEndRtf,null);assert.equal(row.candidateRtf,null);
 }
 assert.deepEqual(summarizeQualification(report.rows),report.summary);
 assert.equal(report.summary.nativeSuccesses,0);assert.equal(report.summary.allNativePassed,false);
});
test('archived Canary data is byte-identical to the received report identity',async()=>{
 const {readFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');
 const base=new URL('../../docs/evaluations/',import.meta.url);
 const assessment=JSON.parse(await readFile(new URL('studio-webnn-canary-assessment-2026-10-26.json',base)));
 assert.equal(createHash('sha256').update(await readFile(new URL(assessment.source,base))).digest('hex'),assessment.sourceSha256);
 assert.equal(assessment.productionEligible,false);assert.equal(assessment.effectiveHardware,'unknown');
});
