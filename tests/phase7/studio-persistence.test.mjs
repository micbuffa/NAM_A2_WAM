import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {wavHeader,wavPacket} from '../../examples/wam/projects/StemWav.js';
import {StemEncoder,SeparationPersistence,resultManifest} from '../../examples/wam/projects/SeparationPersistence.js';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';
import AccountApi from '../../examples/wam/account/api.js';

const models = JSON.parse(await readFile(new URL('../../examples/wam/source-separation/studio-models.json',import.meta.url))).models;
const fixture = model => ({projectId:7,sourceId:11,modelId:model.id,requestedBackend:'webgpu',totalFrames:8,
  engine:{complete:true,partial:true,availableFrames:4},tracks:model.roles.map((role,id)=>({id:-id-1,volume:65,pan:-20,mute:false,solo:id===0,peaks:new Float32Array([.1,.2,.3,.4])}))});

test('Float32 stereo WAV preserves signed PCM exactly and rejects invalid and oversized buffers',()=>{
  const left=new Float32Array([-.123456,1.01]),right=new Float32Array([.99999,-.75]);
  const bytes=new Uint8Array(60);bytes.set(wavHeader(2));bytes.set(wavPacket(left,right),44);
  const v=new DataView(bytes.buffer);
  assert.equal(new TextDecoder().decode(bytes.subarray(0,4)),'RIFF');
  assert.equal(v.getUint16(20,true),3);assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint32(40,true),16);
  assert.deepEqual([v.getFloat32(44,true),v.getFloat32(48,true),v.getFloat32(52,true),v.getFloat32(56,true)],[left[0],right[0],left[1],right[1]]);
  assert.throws(()=>wavPacket(left,new Float32Array(3)),/misaligned/);
  assert.throws(()=>wavPacket(new Float32Array([NaN]),new Float32Array([0])),/Nonfinite/);
  for(const frames of [0,-1,1.5,512*1024**2/8]) assert.throws(()=>wavHeader(frames));
});

test('encoder sends one packet at a time without detaching playback PCM and closes its worker',async()=>{
  const left=new Float32Array([.2,.3]),right=new Float32Array([-.2,-.3]);let terminated=false,pending=false;
  const worker={postMessage(data){assert.equal(pending,false);pending=true;assert.notEqual(data.left.buffer,left.buffer);
    queueMicrotask(()=>{pending=false;worker.onmessage({data:{bytes:wavPacket(data.left,data.right)}});});},terminate(){terminated=true;}};
  const encoder=new StemEncoder(()=>worker);
  const audio=await encoder.encode({engine:{availableFrames:4,chunks:[0,1].map(()=>({tracks:[{buffer:{getChannelData:i=>i?right:left}}]}))}},0);
  const bytes=await audio.arrayBuffer();assert.equal(bytes.byteLength,76);assert.equal(terminated,true);assert.equal(left.length,2);
  assert.equal(new DataView(bytes).getFloat32(44,true),left[0]);
});

test('both catalogues save ordered roles and mix, preserving partial/backend provenance and retry tokens',async()=>{
  for(const model of models){
    const result=fixture(model),uploaded=new Set(),encoded=[],calls=[];let failed=true;
    const api={async createSeparation(id,body){assert.equal(id,7);assert.equal(body.token,'stable-token');assert.deepEqual(body.manifest,resultManifest(result,model,'wasm'));return{id:19,state:'uploading',uploadedRoles:[...uploaded]};},
      async uploadSeparationPart(project,id,role,mix,audio){calls.push(role);assert.equal(id,19);assert.equal(mix.volume,65);assert.deepEqual(JSON.parse(mix.peaks),[Math.fround(.1),Math.fround(.2)]);
        if(!uploaded.has(role))assert.ok(audio instanceof Blob);else assert.equal(audio,null);
        uploaded.add(role);if(failed&&uploaded.size===2){failed=false;throw Error('network interrupted');}},
      async publishSeparation(){assert.equal(uploaded.size,model.roles.length);return{id:7,tracks:[]};}};
    const persistence=new SeparationPersistence({api,token:()=> 'stable-token',encoder:{async encode(_,index){encoded.push(index);return new Blob(['wav']);}}});
    await assert.rejects(()=>persistence.save(result,model,'wasm'),/network/);
    assert.equal(result.stagingId,19);assert.equal(result.saveToken,'stable-token');
    const saved=await persistence.save(result,model,'wasm');assert.equal(saved.id,7);
    assert.deepEqual(encoded,model.roles.map((_,i)=>i),'already uploaded roles skip PCM encoding after retry');
    assert.deepEqual(calls.slice(2),model.roles);
    assert.equal(resultManifest(result,model,'wasm').requestedBackend,'webgpu');
    result.engine.complete=false;await assert.rejects(()=>persistence.save(result,model,'wasm'),/Wait/);
  }
});

test('save project publishes RAM instruments even with no ordinary dirty edits, then adopts persisted data',async()=>{
  const result=fixture(models[0]),project={id:7,name:'Song',bpm:120,tracks:[]};
  const w=Object.create(ProjectsWorkspace.prototype);let published=false,stopped=false;
  Object.assign(w,{project,saved:structuredClone(project),separation:{busy:false,result,models,backend:'webgpu',mode:'stems',stop(){stopped=true;},restore(){}},
    render(){},replaceSummary(){},report(message,error){assert.equal(error,undefined);},setProject(full){assert.equal(stopped,true);assert.equal(full.activeSeparationId,19);},
    persistence:{async save(value,model,backend){assert.equal(value,result);assert.equal(model.id,models[0].id);assert.equal(backend,'webgpu');published=true;return{...project,activeSeparationId:19};}}});
  project.owned=true;
  assert.equal(w.dirty,false);await w.save();assert.equal(published,true);assert.equal(w.saving,false);
});

test('separation endpoints use authenticated CSRF requests and multipart only for new audio',async()=>{
  const calls=[],api=new AccountApi({document:{querySelector:()=>({getAttribute:()=> 'token'})},fetchImpl:async(path,options)=>{calls.push({path,options});return{ok:true,status:200,json:async()=>({})};}});
  await api.createSeparation(7,{token:'x'});
  await api.uploadSeparationPart(7,19,'bass',{volume:30},new Blob(['wav'],{type:'audio/wav'}));
  await api.uploadSeparationPart(7,19,'bass',{volume:40},null);
  await api.publishSeparation(7,19);await api.activateSeparation(7,19);await api.discardSeparation(7,19);
  assert.ok(calls[1].options.body instanceof FormData);assert.equal(calls[1].options.body.get('audio').name,'bass.wav');
  assert.equal(calls[2].options.body,'{"volume":40}');
  assert.equal(calls[4].path,'/api/projects/7/separations/active');assert.equal(calls[5].options.method,'DELETE');
  assert.ok(calls.every(call=>call.options.credentials==='same-origin' && call.options.headers['X-CSRF-Token']==='token'));
});

test('Studio original deck excludes saved batches, saved selection restores only its instruments without inference',async()=>{
  const {StudioSeparation}=await import('../../examples/wam/projects/StudioSeparation.js');
  const c=Object.create(StudioSeparation.prototype); // EventTarget methods are replaced: no Web Audio/worker needed to restore metadata.
  c.changed=()=>{};
  const tracks=[{id:1,origin:'original'},{id:2,origin:'stem',separationId:10},{id:3,origin:'stem',separationId:20},{id:4,origin:'personal'}];
  c.restore({tracks,activeSeparationId:10,separations:[{id:10,state:'ready',manifest:{backend:'webgpu'}},{id:20,state:'ready',manifest:{backend:'wasm'}}]});
  assert.deepEqual(c.viewTracks.map(t=>t.id),[2]);assert.equal(c.hasAudio,true);
  const w=Object.create(ProjectsWorkspace.prototype);w.project={tracks};w.separation=c;
  assert.deepEqual(w.displayTracks.map(t=>t.id),[2]);c.mode='original';assert.deepEqual(w.displayTracks.map(t=>t.id),[1,4]);
  c.selectSaved(20);assert.deepEqual(c.viewTracks.map(t=>t.id),[3]);
});

test('a late save response cannot reopen a project after sign-out or account change',async()=>{
  const w=Object.create(ProjectsWorkspace.prototype),result=fixture(models[0]);
  const project={id:7,owned:true,name:'Song',bpm:120,tracks:[]};let reported=false;
  Object.assign(w,{project,saved:structuredClone(project),separation:{result,models,backend:'webgpu',setStatus(){},stop(){assert.fail('old account preview must not be adopted');}},
    render(){},setProject(){assert.fail('old account project must remain closed');},replaceSummary(){},report(message,error){assert.match(message,/Project changed/);assert.equal(error,true);reported=true;},
    persistence:{async save(){w.project=null;return project;}}});
  await w.save();assert.equal(w.project,null);assert.equal(w.saving,false);assert.equal(reported,true);
});
