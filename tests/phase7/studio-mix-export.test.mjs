import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {MixMp3Core} from '../../examples/wam/projects/MixMp3Core.js';
import {StudioMixExporter,renderRecordedMix,exportRange,mixSources} from '../../examples/wam/projects/StudioMixExporter.js';
import {StudioBackingLibrary,useBackingInTone} from '../../examples/wam/projects/StudioBackingLibrary.js';
const audio={url:'/audio',checksum:'v1'},track=(id,extra={})=>({id,volume:80,pan:0,mute:false,solo:false,inputMonitoring:false,audio,...extra});
const tracks=[track(1),track(2,{volume:60,pan:-35})],channels=new Map(tracks.map(t=>[t.id,{buffer:{duration:2}}]));

test('offline graph preserves the Studio fader/pan/mute/solo contract, duration and explicit loop cropping',async()=>{
  const nodes=[],context={destination:{},createBufferSource(){const node={connect(to){this.to=to;return to;},start(...args){this.startArgs=args;}};nodes.push(node);return node;},
    createGain:()=>({gain:{value:0},connect(to){this.to=to;return to;}}),createStereoPanner:()=>({pan:{value:0},connect(to){this.to=to;return to;}}),startRendering:async()=> 'rendered'};
  let frames;
  assert.equal(await renderRecordedMix({tracks:[tracks[0],{...tracks[1],solo:true}],channels,range:{start:.5,end:1.5},createContext:length=>{frames=length;return context;}}),'rendered');
  assert.equal(frames,44100);assert.deepEqual(nodes[0].startArgs,[0,.5,1]);assert.equal(nodes[0].to.gain.value,0);
  assert.ok(Math.abs(nodes[1].to.gain.value-10**(-6/20))<1e-9);assert.equal(nodes[1].to.to.pan.value,-.35);assert.equal(nodes[1].to.to.to,context.destination);
  assert.deepEqual(exportRange(2,{start:.2,end:.8},'song'),{start:0,end:2});assert.deepEqual(exportRange(2,{start:.2,end:.8},'loop'),{start:.2,end:.8});assert.throws(()=>exportRange(2,{start:1,end:1},'loop'));
});

test('export refuses unqualified WAM DI, live monitoring, missing files and temporary audio',()=>{
  for(const extra of [{presetId:7},{factoryPreset:'factory:rock'},{inputMonitoring:true},{id:-1},{audio:{url:'/audio'}}])assert.throws(()=>mixSources([track(1,extra)],channels));
  assert.throws(()=>mixSources([track(3)],channels),/load/);assert.throws(()=>mixSources([],channels),/No recorded/);
});

test('real pinned MP3 encoder preserves stereo and prevents PCM clipping with one common attenuation',async()=>{
  const scope={};vm.runInNewContext(await readFile(new URL('../../examples/wam/source-separation/vendor/lamejs/lame.min.js',import.meta.url),'utf8'),scope);
  const encoder=new MixMp3Core(scope.lamejs.Mp3Encoder,4410),left=Float32Array.from({length:4410},(_,i)=>2*Math.sin(2*Math.PI*440*i/44100)),right=Float32Array.from(left,x=>x/2);
  encoder.append(left.subarray(0,2000),right.subarray(0,2000));encoder.append(left.subarray(2000),right.subarray(2000));
  const result=encoder.finish();assert.ok(result.attenuation<.5);assert.ok(Math.abs(result.peak*result.attenuation-10**(-1/20))<1e-9);
  const bytes=Buffer.concat(result.parts);assert.equal(bytes[0],255);assert.equal(bytes[1]&0xe0,0xe0);assert.ok(bytes.length>1000);assert.equal(left.length,4410);
  const bad=new MixMp3Core(scope.lamejs.Mp3Encoder,2);assert.throws(()=>bad.append(new Float32Array([NaN]),new Float32Array([0])));assert.throws(()=>bad.finish(),/Incomplete/);
});

test('failed upload retries the exact bytes/token without re-rendering, new mix gets a new snapshot',async()=>{
  let renders=0,encoded=0,requests=0,token=0,failed=true;const manifests=[];
  const exporter=new StudioMixExporter({api:{async createMix(id,body,blob){requests++;assert.equal(id,9);assert.ok(blob instanceof Blob);manifests.push(body);if(failed){failed=false;throw Error('lost response');}return{id:'studio-99'};}},token:()=>`token-${++token}`,
    render:async()=>{renders++;return{length:88200};}});
  exporter.encode=async()=>{encoded++;return{blob:new Blob(['mp3']),peak:.2,attenuation:1};};
  const input={project:{id:9},tracks,channels,range:{start:0,end:2}};
  await assert.rejects(()=>exporter.export(input),/lost/);await exporter.export(input);
  assert.deepEqual([renders,encoded,requests],[1,1,2]);assert.equal(manifests[0].token,manifests[1].token);assert.equal(manifests[1].manifest.sources[1].pan,-35);assert.equal('liveInput' in manifests[1].manifest,false);
  await exporter.export({...input,tracks:[track(1,{volume:45}),tracks[1]]});assert.equal(renders,2);assert.notEqual(manifests[1].token,manifests[2].token);
});

test('MP3 worker handoff copies only one stereo packet at a time, preserves playback buffers and terminates',async()=>{
  let worker,terminated=false,packets=0;
  const exporter=new StudioMixExporter({api:{},workerFactory:()=>worker={postMessage(data){
    if(data.type==='packet'){packets++;assert.ok(data.left.length<=44100);assert.notEqual(data.left.buffer,left.buffer);}
    queueMicrotask(()=>worker.onmessage({data:data.type==='finish'?{type:'done',parts:[new Uint8Array([255,251])],peak:.2,attenuation:1}:{type:'accepted'}}));},terminate(){terminated=true;}}});
  const left=new Float32Array(88201),right=new Float32Array(88201),result=await exporter.encode({length:left.length,getChannelData:i=>i?right:left});
  assert.equal(packets,3);assert.equal(terminated,true);assert.equal(left.length,88201);assert.equal(result.blob.type,'audio/mpeg');
});

test('private catalogue changes are metadata-only, reject late account data, and Tone handoff never starts playback',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);const account={signedIn:true,api:{listBackingTracks:()=>pending}};
  const library=new StudioBackingLibrary({account});library.bundled=[{id:'bt-public'}];
  const loading=library.list();library.clearAccount();account.signedIn=false;resolve([{id:'studio-9',url:'/private'}]);await loading;assert.deepEqual(library.tracks,library.bundled);
  const calls=[],engine={playing:true,pause(){this.playing=false;calls.push('pause');},async loadTrack(id){assert.equal(this.playing,false);calls.push(id);return true;}};
  await useBackingInTone({entry:{id:'studio-9'},library:{list:async()=>calls.push('metadata')},player:{engine,renderList(){},setExpanded(value){assert.equal(value,true);}},projectPlayer:{pause(){calls.push('studio pause');}},workspaces:{show(name){calls.push(name);}}});
  assert.deepEqual(calls,['studio pause','pause','metadata','studio-9','tone']);assert.equal(engine.playing,false);
});

test('account invalidation during offline rendering prevents publication and discards pending MP3',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);let published=false;
  const exporter=new StudioMixExporter({api:{async createMix(){published=true;}},render:()=>pending});
  const rendering=exporter.export({project:{id:9},tracks,channels,range:{start:0,end:2}});
  exporter.invalidate();finish({length:88200});
  await assert.rejects(()=>rendering,error=>error.name==='AbortError');assert.equal(published,false);assert.equal(exporter.pending,null);
});

test('export availability explains unsaved, loading, failed, unsupported and ready states inline',async()=>{
  const {mixExportAvailability:state}=await import('../../examples/wam/projects/StudioMixExporter.js');
  const input={owned:true,tracks,channels};
  assert.equal(state(input).ready,true);
  assert.match(state({...input,pending:true}).message,/Save project first/);
  assert.match(state({...input,separating:true}).message,/Stop separation/);
  assert.match(state({...input,toneReady:false}).message,/Preparing.*Tone/);
  const unloaded=new Map([[1,{buffer:{duration:2}}],[2,{loading:true}]]);
  assert.match(state({...input,channels:unloaded}).message,/1\/2/);
  unloaded.get(2).loading=false;unloaded.get(2).error=Error('HTTP 500');
  const error=state({...input,tracks:[tracks[0],{...tracks[1],name:'Bass'}],channels:unloaded});
  assert.equal(error.ready,false);assert.match(error.message,/Bass \(HTTP 500\)/);assert.deepEqual(error.failedIds,[2]);assert.match(error.message,/saved project is kept/);
  assert.match(state({...input,tracks:[track(1,{presetId:8})]}).message,/preset/);
  assert.match(state({...input,tracks:[track(1,{inputMonitoring:true})]}).message,/monitoring/);
});


test('compact Studio hides premature export during separation, guides saving, then exposes the ready mix', async () => {
  const {ProjectsWorkspace} = await import('../../examples/wam/projects/ProjectsWorkspace.js');
  const label={},fields=Object.fromEntries(['studioUseMix','studioExportRange','studioExportHelp','studioRetryAudio'].map(id=>[id,{}]));
  fields.studioExportRange.closest=()=>label;
  const w={owned:true,saving:false,separation:{busy:true},pendingSeparation:false,displayTracks:tracks,player:{channels},onUseMix(){},$:id=>fields[id]};
  const render=()=>ProjectsWorkspace.prototype.renderMixExport.call(w);
  render();assert.equal(fields.studioUseMix.hidden,true);assert.equal(fields.studioExportHelp.hidden,true);
  w.separation.busy=false;w.pendingSeparation=true;render();
  assert.equal(fields.studioUseMix.hidden,true);assert.equal(fields.studioExportHelp.hidden,false);
  assert.match(fields.studioExportHelp.textContent,/Save project/);
  w.pendingSeparation=false;render();
  assert.equal(fields.studioUseMix.hidden,false);assert.equal(fields.studioUseMix.disabled,false);assert.equal(fields.studioExportHelp.hidden,true);
  w.player.channels=new Map([[1,{buffer:{duration:2}}],[2,{error:Error('HTTP 500')}]]);render();
  assert.equal(fields.studioUseMix.disabled,true);assert.equal(fields.studioRetryAudio.hidden,false);assert.equal(fields.studioExportHelp.hidden,false);
  w.owned=false;render();assert.equal(fields.studioUseMix.hidden,true);assert.equal(label.hidden,true);
});
