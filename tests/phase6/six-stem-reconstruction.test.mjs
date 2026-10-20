import test from 'node:test';
import assert from 'node:assert/strict';
import {reconstructSixStems} from '../../examples/wam/source-separation/SixStemReconstruction.js';
const N=343980,S=2049*340,B=12;
test('six-stem reconstruction refuses incorrect shapes and nonfinite model outputs',()=>{
  assert.throws(()=>reconstructSixStems(new Float32Array(2),new Float32Array(2)),/invalides/);
  const spec=new Float32Array(B*2*S),time=new Float32Array(B*N);time[time.length-1]=NaN;assert.throws(()=>reconstructSixStems(spec,time),/invalides/);
});
test('zero spectrum preserves temporal channels through their final sample without modifying inputs',()=>{
  const spec=new Float32Array(B*2*S),time=new Float32Array(B*N);
  for(let c=0;c<B;c++){time[c*N]=c+.1;time[(c+1)*N-1]=c+.2;}
  const result=reconstructSixStems(spec,time);assert.notEqual(result,time);assert.deepEqual(result,time);assert.equal(spec[0],0);assert.ok(result.every(Number.isFinite));
});
test('analytic centered inverse-FFT impulse lands in the correct last stem channel and crop position',()=>{
  const spec=new Float32Array(B*2*S),time=new Float32Array(B*N),channel=11,frame=20;
  for(let k=0;k<2049;k++)spec[channel*2*S+k*340+frame]=k%2?-1:1;
  const result=reconstructSixStems(spec,time),index=channel*N+frame*1024-1536;
  assert.ok(Math.abs(result[index]-64/1.5)<1e-4);assert.ok(result.subarray(0,channel*N).every(x=>x===0));assert.equal(time[index],0);assert.ok(result.every(Number.isFinite));
});
