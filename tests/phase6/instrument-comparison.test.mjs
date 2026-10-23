import test from 'node:test';
import assert from 'node:assert/strict';
import {InstrumentComparison,instrumentRole,listeningPair,listeningWav} from '../../examples/wam/source-separation/InstrumentComparison.js';
const model={id:'test',roles:['bass','other'],backends:['wasm'],label:'Test'};
const channels=()=>[new Float32Array([.1,.2]),new Float32Array([.3,.4])];
const stems=()=>[...channels(),new Float32Array([.5,.6]),new Float32Array([.7,.8])];
test('guitar is explicitly Other without a dedicated role; bass always uses bass',()=>{
 assert.equal(instrumentRole(model,'guitar'),'other');assert.equal(instrumentRole(model,'bass'),'bass');assert.equal(instrumentRole({...model,roles:['guitar']},'guitar'),'guitar');assert.throws(()=>instrumentRole(model,'vocals'));assert.throws(()=>instrumentRole({roles:[]},'bass'));
});
test('backing sums all other roles without normalization or input mutation',()=>{
 const data=stems(),before=data.map(c=>c.slice()),pair=listeningPair(model,data,'bass');assert.equal(pair.isolated[0],data[0]);assert.deepEqual(pair.backing,data.slice(2));assert.deepEqual(data,before);
 const triple={roles:['bass','other','guitar']},s=[...data,...channels()];assert.ok(Math.abs(listeningPair(triple,s,'bass').backing[0][0]-.6)<1e-6);
 assert.throws(()=>listeningPair(model,[...data.slice(0,3),new Float32Array([NaN,0])],'guitar'));
});
test('WAV is stereo float32 at 44100, preserving over-range peaks without normalization',()=>{
 const c=[new Float32Array([-1,2]),new Float32Array([.5,0])],w=listeningWav(c),v=new DataView(w.bytes);
 assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint16(20,true),3);assert.equal(v.getUint16(34,true),32);assert.equal(v.getFloat32(44,true),-1);assert.equal(v.getFloat32(48,true),.5);assert.equal(v.getFloat32(52,true),2);assert.equal(w.peak,2);assert.equal(w.overRangeSamples,1);assert.equal(c[0][1],2);assert.throws(()=>listeningWav([new Float32Array([Infinity]),new Float32Array([0])]));
});
const manager={getStatus:async()=>({state:'installed'})};
test('production stream collection validates offsets and exact frame count; no fallback',async()=>{
 let cancelled=0;const results=[];const comparison=new InstrumentComparison({manager,createRunner:()=>({cancel:()=>cancelled++,separate:async(m,c,o)=>{assert.equal(o.fallback,false);o.onChunk({startFrame:0,stems:stems().map(c=>c.slice(0,1))});o.onChunk({startFrame:1,stems:stems().map(c=>c.slice(1))});return {backend:'wasm'};}})});
 await comparison.run([{model,backend:'wasm'}],channels(),{onResult:r=>results.push(r)});assert.equal(results[0].status,'ok');assert.deepEqual(results[0].stems,stems());assert.equal(cancelled,1);assert.equal(comparison.busy,false);
});
test('legacy full result accepted; malformed streams/backend mismatch never become listening outputs',async()=>{
 for(const kind of ['legacy','offset','short','backend','nan']){const results=[];const comparison=new InstrumentComparison({manager,createRunner:()=>({cancel(){},async separate(m,c,o){if(kind==='legacy')return {backend:'wasm',stems:stems()};o.onChunk({startFrame:kind==='offset'?1:0,stems:stems().map(c=>kind==='short'?c.slice(0,1):kind==='nan'?new Float32Array([NaN,0]):c)});return {backend:kind==='backend'?'webgpu':'wasm'};}})});await comparison.run([{model,backend:'wasm'}],channels(),{onResult:r=>results.push(r)});assert.equal(results[0].status,kind==='legacy'?'ok':'error');}
});
test('missing models do not download or start workers; unsupported backend explicit',async()=>{
 let created=0;const results=[];const comparison=new InstrumentComparison({manager:{getStatus:async()=>({state:'missing'})},createRunner:()=>{created++;}});await comparison.run([{model,backend:'wasm'},{model,backend:'webgpu'}],channels(),{onResult:r=>results.push(r)});assert.equal(created,0);assert.equal(results.length,2);assert.ok(results.every(r=>r.status==='error'));
});
test('cancel during preparation publishes no result and releases runner',async()=>{
 let comparison,stopped=0;const results=[];comparison=new InstrumentComparison({manager,createRunner:()=>({prepare:async()=>comparison.cancel(),cancel:()=>stopped++,separate:()=>assert.fail('cancelled')})});await assert.rejects(comparison.run([{model,backend:'wasm'}],channels(),{onResult:r=>results.push(r)}),{name:'AbortError'});assert.equal(results.length,0);assert.ok(stopped>=1);assert.equal(comparison.busy,false);
});
test('bounded input rejects invalid channels and excerpts longer than 30s',async()=>{
 const comparison=new InstrumentComparison({manager,createRunner:()=>assert.fail()});for(const c of [[new Float32Array(1)], [new Float32Array(1),new Float32Array(2)],[new Float32Array(1323001),new Float32Array(1323001)]])await assert.rejects(comparison.run([],c));
});

test('cancelling while the last result is rendered still reports cancellation',async()=>{
 const comparison=new InstrumentComparison({manager,createRunner:()=>({cancel(){},async separate(){return {backend:'wasm',stems:stems()};}})});
 await assert.rejects(comparison.run([{model,backend:'wasm'}],channels(),{onResult:async()=>{await Promise.resolve();comparison.cancel();}}),{name:'AbortError'});assert.equal(comparison.busy,false);
});
