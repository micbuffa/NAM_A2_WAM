import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {separationFrames,selectedModelLabel} from '../../examples/wam/source-separation/SeparationRange.js';
import * as segmentTools from '../../examples/wam/source-separation/SegmentSettings.js';
import * as chunkTools from '../../examples/wam/source-separation/ChunkTools.js';
import {SeparationProgress} from '../../examples/wam/source-separation/SeparationProgress.js';

test('whole song is the default, excerpts clamp to source length without old 60s truncation',()=>{
 const frames=215*44100+17;
 assert.equal(separationFrames(frames),frames);assert.equal(separationFrames(frames,'0'),frames);
 for(const n of [1,5,10,30,60])assert.equal(separationFrames(frames,n),n*44100);
 assert.equal(separationFrames(5,60),5);
 for(const value of [-1,NaN,Infinity,4])assert.throws(()=>separationFrames(frames,value));
 assert.throws(()=>separationFrames(0));
});
test('main view shows duration and chosen CPU/GPU model, advanced settings remain in dialog',async()=>{
 const html=await readFile(new URL('../../examples/wam/source-separation/index.html',import.meta.url),'utf8');
 const element=await readFile(new URL('../../examples/wam/source-separation/MultitrackPlayerElement.js',import.meta.url),'utf8');
 assert.match(html,/value="0" selected>Morceau entier/);
 assert.match(element,/options.append\(range,summary\);actions.before\(options\)/);
 assert.match(element,/Change model \/ settings/);
 const controller=await readFile(new URL('../../examples/wam/source-separation/main.js',import.meta.url),'utf8');
 assert.match(controller,/async function loadOriginal[\s\S]*?\$\('excerptSeconds'\).value='0'/);
 assert.equal(selectedModelLabel({label:'Demucs 6s'},'wasm'),'Demucs 6s · CPU / WASM');
 assert.equal(selectedModelLabel({label:'Demucs ONNX'},'webgpu'),'Demucs ONNX · GPU / WebGPU');
});
test('FT chunk progress accounts for all four specialists, never finishing after the first',()=>{
 const p=new SeparationProgress();
 assert.ok(p.update({phase:'inference',modelIndex:0,totalModels:4,chunkIndex:15,totalChunks:16,progress:1})<30);
 assert.ok(p.update({phase:'inference',modelIndex:3,totalModels:4,chunkIndex:15,totalChunks:16,progress:1})>=94);
});
for(const segmentSeconds of [0,1,2])test(`classic WASM worker processes >10s with segment ${segmentSeconds} and releases allocations`,async()=>{
 // Execute the production worker wrapper with a deterministic DSP stand-in.
 // This checks boundaries, overlap, final samples and cleanup, not model quality.
 let source=await readFile(new URL('../../examples/wam/source-separation/demucs-worker.js',import.meta.url),'utf8');
 source=source.replace("await import('./ChunkTools.js')",'chunkTools').replace("await import('./SegmentSettings.js')",'segmentTools');
 const frames=13*44100+9,left=Float32Array.from({length:frames},(_,i)=>i/frames),right=left.slice();
 const heap=new ArrayBuffer(64*1024*1024),sizes=[],freed=[],messages=[];let offset=16;
 const module={HEAPU8:new Uint8Array(heap),HEAPF32:new Float32Array(heap),_malloc(n){const p=offset;offset+=n;return p;},_free(p){freed.push(p);},_modelInit(){},_modelDemixSegment(l,r,n,...args){sizes.push(n);for(let c=0;c<8;c++){const out=args[c]/4;for(let i=0;i<n;i++)this.HEAPF32[out+i]=this.HEAPF32[l/4+i]*(c+1);}}};
 const handler=new Function('importScripts','libdemucs','postMessage','location','performance','chunkTools','segmentTools',`let onmessage;${source};return onmessage;`)(()=>{},async()=>module,m=>messages.push(m),{href:'http://localhost/worker.js'},performance,chunkTools,segmentTools);
 await handler({data:{files:[new ArrayBuffer(4)],left,right,targets:4,segmentSeconds}});
 const result=messages.find(m=>m.type==='result');assert.ok(result,JSON.stringify(messages.find(m=>m.type==='error')));
 assert.ok(sizes.length>1);assert.ok(sizes.every(n=>n<=(segmentSeconds||5)*44100));
 for(let c=0;c<8;c++){assert.equal(result.stems[c].length,frames);for(const i of [0,4*44100,8*44100,frames-1])assert.ok(Math.abs(result.stems[c][i]-left[i]*(c+1))<1e-5);}
 assert.equal(freed.length,sizes.length*10+1);
});
