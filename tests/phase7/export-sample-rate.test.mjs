import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {mp3SampleRate,trackRenderRate} from '../../examples/wam/projects/ExportSampleRate.js';
import {MixMp3Core} from '../../examples/wam/projects/MixMp3Core.js';
import {renderRecordedMix,renderPreviewMix,StudioMixExporter} from '../../examples/wam/projects/StudioMixExporter.js';
const nam=rate=>({kind:'nam',state:{model:{data:JSON.stringify(rate===undefined?{}:{sample_rate:rate})}}});
test('the host clock is preferred only when the model imposes no frequency; incompatible NAMs cannot share a rack',()=>{
 for(const rate of [32000,44100,48000])assert.equal(mp3SampleRate(rate),rate);
 assert.equal(mp3SampleRate(96000),48000);assert.throws(()=>mp3SampleRate(NaN));
 assert.equal(trackRenderRate({a:{entries:[]}},48000),48000);
 assert.equal(trackRenderRate({a:{entries:[nam(48000)]}},44100),48000);
 assert.equal(trackRenderRate({a:{entries:[nam(44100)]}},48000),44100);
 assert.equal(trackRenderRate({a:{entries:[nam(undefined)]}},44100),44100);
 assert.equal(trackRenderRate({a:{entries:[nam(-1)]}},48000),48000);
 assert.throws(()=>trackRenderRate({visible:true,enabledB:true,a:{entries:[nam(48000)]},b:{entries:[nam(44100)]}}),/incompatible/);
 assert.equal(trackRenderRate({a:{entries:[nam(48000),{...nam(44100),bypass:true}]}},44100),48000);
 assert.throws(()=>trackRenderRate({a:{entries:[nam(0)]}}),/Invalid/);
 assert.throws(()=>trackRenderRate({a:{entries:[{kind:'nam',state:{}}]}}),/saved/);
});
test('pinned encoder writes real MPEG sample-rate headers at32/44.1/48kHz without relabeling PCM',async()=>{
 const scope={};vm.runInNewContext(await readFile(new URL('../../examples/wam/source-separation/vendor/lamejs/lame.min.js',import.meta.url),'utf8'),scope);
 for(const rate of [32000,44100,48000]){
  const encoder=new MixMp3Core(scope.lamejs.Mp3Encoder,rate/10,rate),pcm=Float32Array.from({length:rate/10},(_,i)=>.2*Math.sin(2*Math.PI*440*i/rate));encoder.append(pcm,pcm);const output=encoder.finish(),bytes=Buffer.concat(output.parts);
  assert.equal(output.sampleRate,rate);assert.equal([44100,48000,32000][(bytes[2]>>2)&3],rate);
 }
 assert.throws(()=>new MixMp3Core(scope.lamejs.Mp3Encoder,100,96000),/Unsupported/);
});
test('preview keeps chunk addressing at44.1kHz while output frames follow48kHz',async()=>{
 let frames,rate;const scheduled=[],node=()=>({connect(to){return to;},start(...args){scheduled.push(args);}});
 const createContext=(n,r)=>{frames=n;rate=r;return{destination:{},createBufferSource:node,createGain:()=>({gain:{},connect(to){return to;}}),createStereoPanner:()=>({pan:{},connect(to){return to;}}),startRendering:async()=>true};};
 const track={id:1,streamId:'a',volume:80,pan:0,audio:{checksum:'x'}},buffer={length:44100,sampleRate:44100};
 await renderPreviewMix({tracks:[track],engine:{complete:true,availableFrames:88200,chunks:[0,44100].map(startFrame=>({startFrame,length:44100,tracks:[{id:'a',buffer}]}))},range:{start:.5,end:1.5},sampleRate:48000,createContext});
 assert.deepEqual([frames,rate],[48000,48000]);assert.deepEqual(scheduled,[[0,.5,.5],[.5,0,.5]]);
 scheduled.length=0;
 await renderRecordedMix({tracks:[track],channels:new Map([[1,{buffer:{duration:2}}]]),range:{start:0,end:1},sampleRate:48000,createContext});assert.deepEqual([frames,rate],[48000,48000]);
});

test('exporter keeps48kHz in its worker packets, MP3 manifest, retry key and duration',async()=>{
 let worker,init;const rate=48000,buffer={sampleRate:rate,length:rate*2+1,getChannelData:()=>new Float32Array(rate*2+1)};
 const exporter=new StudioMixExporter({api:{},workerFactory:()=>worker={postMessage(data){if(data.type==='init')init=data;if(data.type==='packet')assert.ok(data.left.length<=rate);queueMicrotask(()=>worker.onmessage({data:data.type==='finish'?{type:'done',parts:[],sampleRate:rate,attenuation:1,peak:.1}:{type:'accepted'}}));},terminate(){}}});
 const result=await exporter.encode(buffer);assert.equal(init.sampleRate,rate);assert.equal(result.sampleRate,rate);
 let manifest;exporter.sampleRate=()=>48000;exporter.render=async()=>buffer;exporter.api.createMix=async(id,payload)=>{manifest=payload.manifest;return{};};
 const track={id:1,volume:80,pan:0,audio:{checksum:'v'}},channels=new Map([[1,{buffer}]]);
 await exporter.export({project:{id:1},tracks:[track],channels,range:{start:0,end:2+1/rate}});assert.equal(manifest.sampleRate,rate);assert.equal(manifest.frames,buffer.length);
 const entry=await exporter.preview({project:{id:1},tracks:[track],channels,range:{start:0,end:2+1/rate}});assert.equal(entry.duration,buffer.length/rate);
});

test('processed rendering is opt-in, cannot silently fall back to DI, and invalidation aborts publication',async()=>{
 const track={id:1,name:'Guitar',presetSnapshot:{version:2,a:{entries:[]}},snapshotId:'new',updatedAt:'now',volume:80,pan:0,audio:{checksum:'v'}},channels=new Map([[1,{buffer:{duration:1}}]]),input={project:{id:1},tracks:[track],channels,range:{start:0,end:1}};
 let uploads=0;const exporter=new StudioMixExporter({api:{async createMix(){uploads++;return{};}},render:()=>assert.fail('dry fallback')});
 await assert.rejects(exporter.export(input),/Preset rendering/);
 exporter.toneRenderer={async render(){throw Error('broken plugin');}};await assert.rejects(exporter.export(input),/broken plugin/);assert.equal(uploads,0);
 let finish;exporter.toneRenderer={render:()=>new Promise(resolve=>finish=resolve)};const pending=exporter.export(input);exporter.invalidate();finish({buffer:{sampleRate:48000,length:48000},range:input.range,render:{version:1}});await assert.rejects(pending,e=>e.name==='AbortError');assert.equal(uploads,0);
 exporter.toneRenderer={render:async()=>({buffer:{sampleRate:48000,length:96000},range:{start:0,end:2},render:{engine:'wam-offline-v1'}})};
 exporter.encode=async()=>({blob:new Blob(['mp3']),peak:.1,attenuation:1});let payload;
 exporter.api.createMix=async(id,data)=>{uploads++;payload=data;return{};};await exporter.export(input);assert.equal(payload.manifest.render.engine,'wam-offline-v1');assert.equal(payload.manifest.sampleRate,48000);assert.equal(payload.manifest.range.end,2);
});
