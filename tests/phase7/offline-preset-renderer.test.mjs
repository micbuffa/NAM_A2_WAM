import test from 'node:test';import assert from 'node:assert/strict';
import {OfflinePresetRenderer,prepareOfflineImpulseResponses} from '../../examples/wam/projects/OfflinePresetRenderer.js';
const sound=rate=>({version:2,a:{entries:[{kind:'nam',state:{model:{data:JSON.stringify({sample_rate:rate})}}}]},sourceTrim:{live:3,file:-18}});
const track=(id,rate)=>({id,name:`Guitar${id}`,volume:80,pan:0,audio:{checksum:`di${id}`},presetSnapshot:sound(rate)});
function setup(){
 const rates=[],sources=[],zeroes=[],states=[];let destroyed=0,healthy=true;
 const buffer=(frames,rate)=>({sampleRate:rate,length:frames,duration:frames/rate,data:[new Float32Array(frames).fill(.1),new Float32Array(frames).fill(.1)],getChannelData(c){return this.data[c];}});
 const node=()=>({connect(to){return to;},disconnect(){},start(){this.started=true;}});
 const createContext=(frames,rate)=>{rates.push(rate);return{destination:{},createBuffer:(_,n,r)=>{const b=buffer(n,r);b.data.forEach(a=>a.fill(0));return b;},createBufferSource(){const n=node();sources.push(n);return n;},createConstantSource(){const n={...node(),offset:{}};zeroes.push(n);return n;},createGain:()=>({...node(),gain:{}}),createStereoPanner:()=>({...node(),pan:{}}),startRendering:async()=>buffer(frames,rate)};};
 const renderer=new OfflinePresetRenderer({resolveSound:async t=>({state:t.presetSnapshot,provenance:{snapshotId:`s${t.id}`}}),createContext,createRack:async(c,s)=>{states.push(s);return{input:{},output:node(),assertHealthy(){if(!healthy)throw Error('processorerror');},destroy(){destroyed++;}};}});
 return{renderer,rates,zeroes,states,sources,get destroyed(){return destroyed;},fail(){healthy=false;},channels:new Map([[1,{buffer:buffer(48000,48000)}],[2,{buffer:buffer(44100,44100)}]])};
}
test('a48kHz NAM export keeps its clock, uses live DI trim, appends the requested tail and leaves snapshots intact',async()=>{
 const f=setup(),t=track(1,48000),original=JSON.stringify(t);const result=await f.renderer.render({tracks:[t],channels:f.channels,range:{start:0,end:1},sampleRate:44100,tailSeconds:.5});
 assert.deepEqual(f.rates,[48000,48000]);assert.equal(result.buffer.sampleRate,48000);assert.equal(result.buffer.length,72000);assert.equal(f.states[0].sourceTrim.file,3);assert.equal(JSON.stringify(t),original);assert.equal(f.zeroes.length,1);assert.equal(f.zeroes[0].offset.value,0);assert.equal(f.zeroes[0].started,true);assert.equal(f.destroyed,1);assert.equal(result.render.tracks[0].snapshotId,'s1');
 const legacy=setup(),old=track(1,48000);old.presetSnapshot={version:1,entries:old.presetSnapshot.a.entries};await legacy.renderer.render({tracks:[old],channels:legacy.channels,range:{start:0,end:1},tailSeconds:0});assert.equal(legacy.states[0].version,2);
});
test('different tracks may use different model clocks; only mismatched output gets a resampling pass',async()=>{
 const f=setup();const result=await f.renderer.render({tracks:[track(1,44100),track(2,48000)],channels:f.channels,range:{start:0,end:1},sampleRate:48000,tailSeconds:0});
 assert.deepEqual(f.rates,[48000,44100,48000,48000]);assert.equal(result.buffer.length,48000);assert.deepEqual(result.render.tracks.map(t=>t.rate),[44100,48000]);assert.equal(f.destroyed,2);
});
test('A/B renders preceding DI from zero and crops after processing, with no added tail',async()=>{
 const f=setup(),result=await f.renderer.render({tracks:[track(1,48000)],channels:f.channels,range:{start:.25,end:.75},sampleRate:48000,selection:'loop',tailSeconds:5});
 assert.equal(f.sources[0].started,true);assert.equal(result.buffer.length,24000);assert.equal(result.render.tailSeconds,0);assert.deepEqual(result.range,{start:.25,end:.75});
});
test('processor errors release the rack and memory bounds are checked before large buffers are allocated',async()=>{
 const f=setup();f.fail();await assert.rejects(f.renderer.render({tracks:[track(1,48000)],channels:f.channels,range:{start:0,end:1}}),/processorerror/);assert.equal(f.destroyed,1);
 const huge=setup();await assert.rejects(huge.renderer.render({tracks:[track(1,48000)],channels:huge.channels,range:{start:0,end:86400}}),/512 MiB/);assert.deepEqual(huge.rates,[]);
});

test('cabinet IR conversion requires its original clock and does not guess when a legacy snapshot changes rate',async()=>{
 const state={a:{entries:[{kind:'cabinet',state:{ir:{sampleRate:44100,samples:new Array(441).fill(.2)}}}]}};
 let conversions=0;const context=(frames,rate)=>{conversions++;return{destination:{},createBuffer:(_,n,r)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource:()=>({connect(){},start(){}}),startRendering:async()=>({getChannelData:()=>new Float32Array(frames).fill(.2)})};};
 await prepareOfflineImpulseResponses(state,48000,{hostRate:48000,createContext:context});assert.equal(conversions,1);assert.equal(state.a.entries[0].state.ir.samples.length,480);assert.equal(state.a.entries[0].state.ir.sampleRate,48000);
 await prepareOfflineImpulseResponses(state,48000,{hostRate:48000,createContext:context});assert.equal(conversions,1);
 delete state.a.entries[0].state.ir.sampleRate;
 await assert.rejects(prepareOfflineImpulseResponses(state,44100,{hostRate:48000,createContext:context}),/older cabinet/);
 await prepareOfflineImpulseResponses(state,44100,{hostRate:48000,recordingRate:48000,createContext:context});assert.equal(conversions,2);
});
