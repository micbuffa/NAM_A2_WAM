import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AudioImportWatcher} from '../../examples/wam/projects/AudioImportWatcher.js';
import {isWebNN,validateWebNNSelection,validateWebNNEvidence,backendLabel} from '../../examples/wam/source-separation/StudioWebNN.js';
import {webnnAudioParity} from '../../examples/wam/source-separation/WebNNParity.js';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';
const tick=()=>new Promise(r=>setImmediate(r));
test('YouTube watcher polls running jobs only and stops at terminal states or dialog/account close',async()=>{
 const tasks=[],values=[];let calls=0;
 const watcher=new AudioImportWatcher({api:{async getAudioImport(){calls++;return {id:1,state:'ready',projectId:9};}},onChange:j=>values.push(j),schedule:fn=>{tasks.push(fn);return fn;},unschedule:()=>{}});
 watcher.watch({id:1,state:'downloading'});assert.equal(tasks.length,1);
 await tasks.shift()();assert.equal(calls,1);assert.equal(values.at(-1).state,'ready');assert.equal(tasks.length,0);
 let resolve;watcher.api.getAudioImport=()=>new Promise(r=>resolve=r);
 watcher.watch({id:1,state:'queued'});const running=tasks.shift()();watcher.stop();resolve({id:1,state:'ready'});await running;
 assert.equal(values.at(-1).state,'queued','old account result ignored');
 watcher.watch({state:'cancelled'});assert.equal(tasks.length,0);
});
test('YouTube poll network failure is terminal and gives a reconnect instruction',async()=>{
 let poll,result;const watcher=new AudioImportWatcher({api:{getAudioImport:async()=>{throw Error('offline');}},schedule:fn=>poll=fn,unschedule:()=>{},onChange:j=>result=j});
 watcher.watch({id:1,state:'queued'});await poll();assert.equal(result.state,'error');assert.match(result.message,/Reopen Import audio/);
});
test('Tone import opens the server original and preserves local file as upload, no synthetic URL fetch',async()=>{
 for(const file of [null,{name:'local.mp3'}]){
  const calls=[],w={importingTone:false,saving:false,ensureSignedIn:async()=>true,confirmSavedMixDiscard:async()=>true,confirmPreviewDiscard:async()=>true,
   api:{importBacking:async(...args)=>{calls.push(args);return {id:7};}},projects:[],setProject:p=>calls.push(p),remember:()=>{},render:()=>{},report:()=>{}};
  assert.equal(await ProjectsWorkspace.prototype.importFromTone.call(w,{id:'studio-5',title:'Backing'},file),true);
  assert.deepEqual(calls[0],[file?{title:'Backing'}:{id:'studio-5'},file]);assert.equal(w.projects[0].id,7);assert.equal(w.importingTone,false);
 }
});
test('Tone import cancellation or a server failure cannot replace the active project',async()=>{
 let replaced=false;
 const w={ensureSignedIn:async()=>true,confirmSavedMixDiscard:async()=>false,confirmPreviewDiscard:async()=>true,setProject:()=>replaced=true,report:()=>{}};
 assert.equal(await ProjectsWorkspace.prototype.importFromTone.call(w,{id:'studio-5'}),false);assert.equal(replaced,false);
});
test('WebNN devices stay experimental, unsupported SW6 is rejected, real evidence required',()=>{
 for(const device of ['cpu','gpu','npu']){const b=`webnn-${device}`;assert.ok(isWebNN(b));validateWebNNSelection('htdemucs_4s_onnx',b);assert.throws(()=>validateWebNNSelection('bs_roformer_sw_6s',b),/admission/);assert.match(backendLabel(b),/experimental/);}
 assert.equal(validateWebNNEvidence({runtimeVersion:'1.30.0',validatedBlocks:1,dispatches:1,strictParity:true,effectiveHardware:'unknown'}),true);
 assert.equal(validateWebNNEvidence({runtimeVersion:'1.30.0',validatedBlocks:1,dispatches:0,strictParity:true,effectiveHardware:'unknown'}),false);
});
test('strict WebNN per-role parity catches a quiet instrument masked by a loud full mix',()=>{
 const reference=Array.from({length:8},(_,i)=>new Float32Array(20).fill(i<2?.8:.001));
 const candidate=reference.map(c=>c.slice());assert.equal(webnnAudioParity(reference,candidate).passed,true);
 candidate[6].fill(.0011);const p=webnnAudioParity(reference,candidate);assert.equal(p.passed,false);assert.equal(p.roles.at(-1).passed,false);
 candidate[6][0]=NaN;assert.throws(()=>webnnAudioParity(reference,candidate));
});
test('isolated ORT WebNN runtime is pinned by bytes and SHA, production ORT remains 1.22',async()=>{
 const base=new URL('../../examples/wam/source-separation/vendor/onnxruntime-webnn/',import.meta.url);
 const manifest=JSON.parse(await readFile(new URL('manifest.json',base)));
 for(const [name,info] of Object.entries(manifest.files)){
  const bytes=await readFile(new URL(name,base));assert.equal(bytes.length,info.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256);
 }
 const ort=await import('../../examples/wam/source-separation/vendor/onnxruntime-web/ort.webgpu.min.mjs');assert.equal(ort.env.versions.web,'1.22.0');
});
test('a late Tone import response after account change cannot populate another account',async()=>{
 let resolve,replaced=false;
 const w={accountLoadEpoch:1,account:{user:{id:1}},ensureSignedIn:async()=>true,confirmSavedMixDiscard:async()=>true,confirmPreviewDiscard:async()=>true,
 api:{importBacking:()=>new Promise(r=>resolve=r)},projects:[],setProject:()=>replaced=true,report:()=>{}};
 const pending=ProjectsWorkspace.prototype.importFromTone.call(w,{id:'studio-5'});await tick();
 w.accountLoadEpoch++;w.account.user=null;resolve({id:9});assert.equal(await pending,false);assert.equal(replaced,false);
});

test('WebNN admission requires dispatch during each block, not just during an earlier one',async()=>{
 const {admitWebNNBlock}=await import('../../examples/wam/source-separation/WebNNAdmission.js');
 const channels=Array.from({length:8},()=>new Float32Array(4).fill(.1));
 assert.equal(admitWebNNBlock(channels,channels,10,11).passed,true);
 assert.throws(()=>admitWebNNBlock(channels,channels,10,10),/for this block/);
 assert.throws(()=>admitWebNNBlock(channels,channels,-1,2),/dispatch/);
 const changed=channels.map(c=>c.slice());changed[2].fill(.15);
 assert.throws(()=>admitWebNNBlock(channels,changed,0,1),error=>Boolean(error.parity&&!error.parity.passed));
});
test('WebNN context loss interrupts reference or inference work, without waiting for a stalled provider',async()=>{
 const {contextGuard}=await import('../../examples/wam/source-separation/WebNNAdmission.js');
 let lose;const guard=contextGuard({lost:new Promise(r=>lose=r)});
 const stalled=guard(new Promise(()=>{}));lose({message:'device disconnected'});
 await assert.rejects(stalled,/device disconnected/);
 assert.equal(await contextGuard(null)(Promise.resolve(7)),7);
});
