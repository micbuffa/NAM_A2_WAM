import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=new URL('../../examples/wam/source-separation/',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,base),'utf8'));
test('SCNet CPU/GPU evidence uses the same checked weights, input and reference and passes declared tolerance',async()=>{
 const [m,n,g,w]=await Promise.all(['research/scnet-candidate.json','benchmarks/scnet-native-candidate-2026-10-25.json','benchmarks/scnet-webgpu-candidate-2026-10-25.json','benchmarks/scnet-wasm-candidate-2026-10-25.json'].map(json));
 assert.equal(m.sha256,n.modelSha256);assert.equal(m.checkpointSha256,n.checkpointSha256);
 for(const run of [g,w]){assert.equal(run.modelSha256,m.sha256);assert.equal(run.inputSha256,n.browserInputSha256);assert.equal(run.referenceSha256,n.browserReferenceSha256);assert.equal(run.status,'completed');assert.equal(run.finite,true);assert.equal(run.parityPassed,true);assert.ok(run.relativeRmsError<=run.numericTolerance);assert.deepEqual(run.outputShape,m.output.observedShape);}
 assert.equal(n.runs.length,4);assert.equal(new Set(n.runs.map(r=>r.case)).size,4);
 const models=(await json('models.json')).models;assert.ok(!models.some(x=>x.id.includes('scnet')));
});
test('MDX native evidence is finite, identifies all ensemble weights and does not certify held-out training exposure',async()=>{
 const m=await json('benchmarks/mdx-extra-q-native-2026-10-25.json');assert.equal(m.status,'native-completed-browser-unported');assert.equal(m.models,4);assert.equal(m.checkpoints.length,4);assert.equal(m.finite,true);assert.equal(m.guitarOtherProxy.independentTrainingExposure,false);assert.match(m.trainingContamination,/MUSDB test/);assert.equal(m.settings.shifts,0);assert.equal(m.settings.split,false);
 for(const c of m.checkpoints)assert.match(c.sha256,/^[a-f0-9]{64}$/);
});
