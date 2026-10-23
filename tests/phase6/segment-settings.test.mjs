import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SEGMENT_SECONDS,segmentPlans,segmentSettings,segmentHint,validateSegmentSeconds} from '../../examples/wam/source-separation/SegmentSettings.js';
import {DemucsRunner} from '../../examples/wam/source-separation/DemucsRunner.js';
import {OnnxDemucsRunner} from '../../examples/wam/source-separation/OnnxDemucsRunner.js';
import {ProgressiveDemucsRunner} from '../../examples/wam/source-separation/ProgressiveDemucsRunner.js';

test('segment plans cover source exactly, including short tails for all sizes and runtimes',()=>{
 for(const runtime of ['wasm','onnx'])for(const seconds of SEGMENT_SECONDS)for(const total of [1,44100,13*44100+7]){
  const settings=segmentSettings(seconds,runtime),plans=segmentPlans(total,seconds,runtime);let committed=0;
  for(const p of plans){assert.equal(p.start,committed);assert.ok(p.end-p.start<=settings.frames);committed+=p.commitFrames;}
  assert.equal(committed,total);assert.equal(plans.at(-1).final,true);
 }
 assert.equal(segmentSettings(0,'onnx').frames,343980);assert.equal(segmentSettings(0).frames,220500);
 assert.equal(segmentPlans(8*44100,0,'wasm',true).length,1);
 assert.ok(segmentPlans(8*44100,1,'wasm',true).length>1);
});
test('invalid settings are rejected; ONNX hint distinguishes segment size from neural window',()=>{
 for(const value of [-1,4,8,NaN,Infinity,'1',null])assert.throws(()=>validateSegmentSeconds(value));
 assert.match(segmentHint(1,'onnx'),/7,8 s/);assert.match(segmentHint(2,'onnx'),/ralentir/);
 assert.match(segmentHint(2),/20 %/);
});
test('all runners transfer the selected size to their Worker and release resources',async()=>{
 const manager={getStatus:async()=>({state:'installed'}),cache:{get:async()=>({files:[new ArrayBuffer(1)]})}},channels=[new Float32Array(8),new Float32Array(8)];
 for(const kind of ['classic','progressive','onnx']){
  let worker;
  const factory=()=>worker={terminate(){this.terminated=true;},postMessage(m){this.message=m;queueMicrotask(()=>{
   const send=data=>this.onmessage({data});
   if(kind==='classic')send({type:'result',stems:Array.from({length:12},()=>new Float32Array(8))});
   else{send({type:'chunk',backend:'wasm',sampleRate:44100,startFrame:0,stems:Array.from({length:kind==='onnx'?8:12},()=>new Float32Array(8))});send({type:'done',backend:'wasm'});}
  });}};
  const model={id:'htdemucs_6s',runtime:'demucs-ort-wasm',sampleRate:44100,targets:6,roles:['drums','bass','other','vocals','guitar','piano'],files:[{sha256:'x'}]};
  if(kind==='classic')await new DemucsRunner({manager,workerFactory:factory}).separate(model,channels,()=>{},{segmentSeconds:1});
  if(kind==='progressive')await new ProgressiveDemucsRunner({manager,workerFactory:factory}).separate(model,channels,{segmentSeconds:1});
  if(kind==='onnx')await new OnnxDemucsRunner({manager,workerFactory:factory}).separate({...model,runtime:'demucs-onnx-core',roles:model.roles.slice(0,4)},channels,{backend:'wasm',segmentSeconds:1});
  assert.equal(worker.message.segmentSeconds,1);assert.equal(worker.terminated,true);
 }
});
test('UI offers only automatic segmentation and cannot restore the old slow manual choice',async()=>{
 const base=new URL('../../examples/wam/source-separation/',import.meta.url),main=await readFile(new URL('main.js',base),'utf8'),html=await readFile(new URL('index.html',base),'utf8');
 assert.doesNotMatch(html,/id="segmentSeconds"|id="segmentHint"/);
 assert.match(main,/progressive = progressiveEnabled\(\), segmentSeconds=0/);
 assert.match(main,/seconds:Number\(\$\('excerptSeconds'\).value\),segmentSeconds:0/);
 assert.doesNotMatch(main,/choice.segmentSeconds|\$\('segmentSeconds'\)/);
});
