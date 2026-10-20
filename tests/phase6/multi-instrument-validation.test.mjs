import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBenchmarkAudio,benchmarkInputs} from '../../examples/wam/source-separation/BenchmarkInputs.js';
import {analyzeSeparation} from '../../examples/wam/source-separation/AudioComparison.js';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const audio=channels=>({sampleRate:44100,length:channels[0].length,numberOfChannels:channels.length,getChannelData:c=>channels[c]});
test('short stereo mix uses actual decoded length and keeps independent channels',()=>{
  const source=[new Float32Array([1,2,3]),new Float32Array([4,5,6])];
  const result=prepareBenchmarkAudio(audio(source));assert.equal(result.frames,3);assert.equal(result.sourceChannels,2);
  assert.deepEqual([...result.channels[0]],[1,2,3]);assert.deepEqual([...result.channels[1]],[4,5,6]);
  result.channels[0][0]=0;assert.equal(source[0][0],1);assert.equal(result.channels[1][0],4);
});
test('mono fixture duplicates channels independently; long files are limited before inference',()=>{
  const result=prepareBenchmarkAudio(audio([new Float32Array(44100).fill(.25)]),.5);
  assert.equal(result.frames,22050);assert.equal(result.sourceChannels,1);assert.notEqual(result.channels[0],result.channels[1]);assert.deepEqual(result.channels[0],result.channels[1]);
});
test('benchmark rejects invalid sample rate, dimensions, duration and nonfinite input',()=>{
  const base=audio([new Float32Array(2)]);
  for(const bad of [{...base,sampleRate:48000},{...base,length:0},{...base,numberOfChannels:0},audio([new Float32Array([NaN])])])assert.throws(()=>prepareBenchmarkAudio(bad));
  assert.throws(()=>prepareBenchmarkAudio(base,0));assert.throws(()=>prepareBenchmarkAudio(base,Infinity));
});
test('remix consistency sums all stereo stems, reports energy and stereo differences without inventing quality scores',()=>{
  const stems=[new Float32Array([.25,.25]),new Float32Array([.5,.5]),new Float32Array([.75,.75]),new Float32Array([.5,.5])];
  const report=analyzeSeparation([new Float32Array([1,1]),new Float32Array([1,1])],stems,['bass','other']);
  assert.equal(report.remixResidual.rmsError,0);assert.equal(report.stems[0].peak,.5);assert.equal(report.stems[0].stereoDifferenceRms,.25);assert.equal(report.hasIsolatedReferences,false);assert.equal('sdr' in report,false);
});
test('residual reveals a missing instrument; invalid output is refused',()=>{
  const mix=[new Float32Array([1,1]),new Float32Array([1,1])];
  const result=analyzeSeparation(mix,[new Float32Array(2).fill(.5),new Float32Array(2).fill(.5)],['other']);assert.equal(result.remixResidual.relativeRmsError,.5);
  assert.throws(()=>analyzeSeparation(mix,[new Float32Array(1),new Float32Array(2)],['other']));assert.throws(()=>analyzeSeparation(mix,[new Float32Array(2).fill(NaN),new Float32Array(2)],['other']));
});
test('real mix fixture has reproducible bytes, explicit credits and no isolated references',async()=>{
  const base=new URL('../../examples/wam/source-separation/fixtures/music/',import.meta.url),manifest=JSON.parse(await readFile(new URL('slow-motion-dream.json',base)));
  const bytes=await readFile(new URL(manifest.file,base));assert.equal(bytes.length,manifest.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
  assert.equal(manifest.channels,2);assert.equal(manifest.hasIsolatedReferences,false);assert.ok(manifest.source.includes(manifest.sourceRevision));
  const notice=await readFile(new URL('NOTICE.md',base),'utf8');for(const credit of ['Steven M Bryant','CSoul','Alex Beroza','Robert Siekawitch'])assert.ok(notice.includes(credit));
  assert.equal(benchmarkInputs[0].id,'real-mix');assert.ok(benchmarkInputs.every(input=>input.groundTruth===false));
});
