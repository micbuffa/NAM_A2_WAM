import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSessionAudio,decodeSessionAudio} from '../../examples/wam/source-separation/SessionAudioEncoding.js';
import {SessionAudioStore} from '../../examples/wam/source-separation/SessionAudioStore.js';
const track=pcm=>({id:'guitar',role:'guitar',sampleRate:44100,channels:[pcm,pcm.slice().reverse()]});
const record=()=>({key:'test',original:{progressive:false,tracks:[track(Float32Array.from([99,0,-0,.4,-.7,1e-30,88]).subarray(1,6))]},result:{progressive:true,partial:true,totalFrames:9,roles:['guitar'],chunks:[{startFrame:0,tracks:[track(Float32Array.of(.1,.2,.3,.4))]},{startFrame:4,tracks:[track(Float32Array.of(.5,.6,.7,.8,.9))]}]}});
const channels=r=>[...r.original.tracks,...r.result.chunks.flatMap(c=>c.tracks)].flatMap(t=>t.channels);
test('chunked Blob encoding yields between bounded copies and restores exact PCM, boundaries and signed zero',async()=>{
 const input=record(),before=structuredClone(input),copies=[];let time=0,yields=0;
 const encoded=await encodeSessionAudio(input,{chunkFrames:2,now:()=>time++,budgetMs:2,yieldControl:async()=>yields++,measure:(name,fn)=>{const out=fn();if(name==='sessionBlobCopy')copies.push(out.size);return out;}});
 assert.ok(yields>0);assert.ok(copies.every(bytes=>bytes<=8));assert.equal(encoded.pcmStorageVersion,1);
 const output=await decodeSessionAudio(structuredClone(encoded));assert.deepEqual(output,before);assert.deepEqual(input,before);
 input.original.tracks[0].channels[0].fill(123);assert.deepEqual(await decodeSessionAudio(encoded),before);
 for(const [i,a] of channels(before).entries())assert.deepEqual(new Uint8Array(channels(output)[i].buffer,channels(output)[i].byteOffset,channels(output)[i].byteLength),new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
});
test('Blob decoding accepts old typed PCM unchanged and rejects unsupported versions or malformed descriptors',async()=>{
 const original=record();assert.equal(await decodeSessionAudio(original),original);assert.equal(await decodeSessionAudio(undefined),undefined);
 const encoded=await encodeSessionAudio(record());
 for(const change of [r=>r.pcmStorageVersion=2,r=>r.original.tracks[0].channels[0].frames=-1,r=>r.original.tracks[0].channels[0].blob=new Blob([new Uint8Array(1)]),r=>r.original.tracks[0].channels[0].littleEndian='true']){
  const r=structuredClone(encoded);change(r);await assert.rejects(decodeSessionAudio(r));
 }
});
test('PCM from the opposite byte order decodes correctly without changing the persisted Blob',async()=>{
 const encoded=await encodeSessionAudio(record()),descriptor=encoded.original.tracks[0].channels[0],expected=record().original.tracks[0].channels[0];
 const bytes=new Uint8Array(await descriptor.blob.arrayBuffer());for(let i=0;i<bytes.length;i+=4){[bytes[i],bytes[i+3]]=[bytes[i+3],bytes[i]];[bytes[i+1],bytes[i+2]]=[bytes[i+2],bytes[i+1]];}
 descriptor.blob=new Blob([bytes]);descriptor.littleEndian=!descriptor.littleEndian;
 const output=await decodeSessionAudio(encoded);assert.deepEqual(output.original.tracks[0].channels[0],expected);assert.deepEqual(new Uint8Array(await descriptor.blob.arrayBuffer()),bytes);
});
test('copy failure rejects before publishing a partial snapshot, without detaching playable PCM',async()=>{
 const input=record(),before=structuredClone(input);
 await assert.rejects(encodeSessionAudio(input,{chunkFrames:1,now:()=>10,budgetMs:0,yieldControl:async()=>{throw Error('copy cancelled');}}),/cancelled/);
 assert.deepEqual(input,before);
 await assert.rejects(encodeSessionAudio(input,{chunkFrames:0}),/Taille/);
 const invalid=record();invalid.original.tracks[0].channels[0]=new Int16Array(5);await assert.rejects(encodeSessionAudio(invalid),/PCM/);
});
function fixture(){
 const persisted=new Map();let fail=false,puts=0;
 const store=new SessionAudioStore();store.open=async()=>({transaction(){const tx={objectStore:()=>({
  put(data){puts++;const snapshot=structuredClone(data);queueMicrotask(()=>{if(fail){tx.error=Error('QuotaExceededError');tx.onabort();}else{persisted.set(data.key,snapshot);tx.oncomplete();}});},
  get(key){const r={};queueMicrotask(()=>{r.result=structuredClone(persisted.get(key));r.onsuccess();});return r;}
 })};return tx;}});
 return {store,persisted,fail:()=>fail=true,get puts(){return puts;}};
}
test('SessionAudioStore writes a single atomic Blob record, reads old records and surfaces quota errors',async()=>{
 const f=fixture(),input=record();await f.store.put(input);assert.equal(f.puts,1);assert.ok(f.persisted.get('test').original.tracks[0].channels[0].blob instanceof Blob);assert.deepEqual(await f.store.get('test'),input);
 const legacy={...record(),key:'legacy'};f.persisted.set('legacy',legacy);assert.deepEqual(await f.store.get('legacy'),legacy);
 f.fail();const changed=record();changed.original.tracks[0].channels[0].fill(.8);await assert.rejects(f.store.put(changed),/Quota/);assert.deepEqual(await f.store.get('test'),input);
});
