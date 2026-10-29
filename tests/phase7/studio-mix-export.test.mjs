import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
import {MixMp3Core} from '../../examples/wam/projects/MixMp3Core.js';
import {StudioMixExporter,renderRecordedMix,renderPreviewMix,exportRange,mixSources} from '../../examples/wam/projects/StudioMixExporter.js';
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
  assert.equal(state({...input,pending:true}).ready,true);assert.match(state({...input,pending:true}).message,/temporary.*without saving/);
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


test('compact Studio hides export during separation and exposes unsaved mixes after Stop', async () => {
  const {ProjectsWorkspace} = await import('../../examples/wam/projects/ProjectsWorkspace.js');
  const label={},fields=Object.fromEntries(['studioUseMix','studioExportRange','studioExportHelp','studioRetryAudio'].map(id=>[id,{}]));
  fields.studioExportRange.closest=()=>label;
  const w={owned:true,saving:false,separation:{busy:true},pendingSeparation:false,displayTracks:tracks,player:{channels},onUseMix(){},$:id=>fields[id]};
  const render=()=>ProjectsWorkspace.prototype.renderMixExport.call(w);
  render();assert.equal(fields.studioUseMix.hidden,true);assert.equal(fields.studioExportHelp.hidden,true);
  w.separation.busy=false;w.pendingSeparation=true;render();
  assert.equal(fields.studioUseMix.hidden,false);assert.equal(fields.studioUseMix.disabled,false);assert.equal(fields.studioExportHelp.hidden,false);
  assert.match(fields.studioExportHelp.textContent,/temporary/);
  w.pendingSeparation=false;render();
  assert.equal(fields.studioUseMix.hidden,false);assert.equal(fields.studioUseMix.disabled,false);assert.equal(fields.studioExportHelp.hidden,true);
  w.player.channels=new Map([[1,{buffer:{duration:2}}],[2,{error:Error('HTTP 500')}]]);render();
  assert.equal(fields.studioUseMix.disabled,true);assert.equal(fields.studioRetryAudio.hidden,false);assert.equal(fields.studioExportHelp.hidden,false);
  w.owned=false;render();assert.equal(fields.studioUseMix.hidden,true);assert.equal(label.hidden,true);
});

test('stopped progressive mix schedules only committed PCM across chunk boundaries with current solo/gain/pan',async()=>{
 const buffers=[0,1].map(()=>({length:44100,sampleRate:44100}));
 const engine={complete:true,partial:true,availableFrames:88200,chunks:buffers.map((buffer,i)=>({startFrame:i*44100,length:44100,tracks:[{id:'bass-0',buffer},{id:'guitar-1',buffer}]}))};
 const previewTracks=[track(-1,{streamId:'bass-0'}),track(-2,{streamId:'guitar-1',solo:true,volume:60,pan:35})];
 const nodes=[],context={destination:{},createBufferSource(){const node={connect(to){this.to=to;return to;},start(...args){this.args=args;}};nodes.push(node);return node;},
  createGain:()=>({gain:{value:0},connect(to){this.to=to;return to;}}),createStereoPanner:()=>({pan:{value:0},connect(to){return to;}}),startRendering:async()=> 'rendered'};
 let frames;
 assert.equal(await renderPreviewMix({tracks:previewTracks,engine,range:{start:.5,end:1.5},createContext:n=>{frames=n;return context;}}),'rendered');
 assert.equal(frames,44100);assert.deepEqual(nodes.map(n=>n.args),[[0,.5,.5],[0,.5,.5],[.5,0,.5],[.5,0,.5]]);
 assert.equal(nodes[0].to.gain.value,0);assert.ok(Math.abs(nodes[1].to.gain.value-10**(-6/20))<1e-9);assert.equal(nodes[1].to.to.pan.value,.35);
 await assert.rejects(renderPreviewMix({tracks:previewTracks,engine,range:{start:0,end:3}}),/exceeds/);
 await assert.rejects(renderPreviewMix({tracks:previewTracks,engine:{...engine,complete:false},range:{start:0,end:2}}),/Stop separation/);
});

test('temporary mix uses local MP3, never uploads, and invalidated exports cannot be handed off',async()=>{
 const exporter=new StudioMixExporter({api:{createMix(){assert.fail('must not upload');}},token:()=> 'local',renderPreview:async()=>({length:44100})});
 exporter.encode=async()=>({blob:new Blob(['mp3'],{type:'audio/mpeg'}),attenuation:1});
 const entry=await exporter.preview({project:{id:7,name:'Rock'},tracks:[track(-1)],engine:{partial:true},range:{start:0,end:1}});
 assert.equal(entry.ephemeral,true);assert.equal(entry.manifest.partial,true);assert.equal(entry.projectId,7);assert.match(entry.title,/Partial mix/);assert.equal(entry.file.type,'audio/mpeg');assert.equal(entry.duration,1);
 let finish;exporter.renderPreview=()=>new Promise(resolve=>finish=resolve);
 const pending=exporter.preview({project:{id:7},tracks:[],engine:{partial:true},range:{start:0,end:1}});exporter.invalidate();finish({length:44100});await assert.rejects(pending,{name:'AbortError'});
});

test('temporary library entries stay in memory, use local bytes without server fetch and are bounded and cleared on signout',async()=>{
 const library=new StudioBackingLibrary();library.bundled=[{id:'public'}];library.tracks=[...library.bundled];
 const calls=[],player={engine:{pause(){},async loadTrack(id){const e=library.resolve(id);assert.equal(e.file.type,'audio/mpeg');calls.push(id);return true;}},renderList(){},setExpanded(){}},workspaces={show:id=>calls.push(id)};
 const entry=id=>({id:`studio-preview-${id}`,projectId:id,ephemeral:true,title:'Mix',file:new File(['mp3'],'mix.mp3',{type:'audio/mpeg'})});
 library.list=()=>assert.fail('temporary handoff needs no API');
 await useBackingInTone({entry:entry(1),library,player,projectPlayer:{pause(){}},workspaces});assert.deepEqual(calls,['studio-preview-1','tone']);
 library.addTemporary(entry(2));library.addTemporary(entry(3));assert.equal(library.temporary.length,2);assert.equal(library.tracks.some(t=>t.id==='studio-preview-1'),false);
 library.clearAccount();assert.deepEqual(library.tracks,library.bundled);assert.equal(library.temporary.length,0);
});

test('workspace sends stopped unsaved preview to Tone without Save, publishing stems or discarding the preview',async()=>{
 const {ProjectsWorkspace}=await import('../../examples/wam/projects/ProjectsWorkspace.js');
 const engine={complete:true,partial:true,availableFrames:44100},project={id:7,name:'Rock'},events=[];
 const w={owned:true,saving:false,dirty:true,pendingSeparation:true,accountLoadEpoch:1,project,displayTracks:[track(-1)],
  separation:{busy:false,mode:'stems',result:{engine},setStatus(){}},player:{duration:50,loop:null,channels:new Map()},$:()=>({value:'song'}),render(){},report:message=>events.push(message),
  save:()=>assert.fail('must not save'),api:{getProject:()=>assert.fail('must not reload')},mixExporter:{preview:async options=>{assert.equal(options.engine,engine);assert.equal(options.range.end,1);return {ephemeral:true};}},onUseMix:async entry=>events.push(entry)};
 await ProjectsWorkspace.prototype.useMixInTone.call(w);assert.equal(events[0].ephemeral,true);assert.equal(w.saving,false);assert.equal(w.separation.result.engine,engine);assert.equal(w.dirty,true);
});

test('unsaved recorded-track mix keeps current settings and renders locally without requiring persistent track IDs',async()=>{
 let options;const exporter=new StudioMixExporter({api:{createMix:()=>assert.fail('must not upload')},render:async input=>{options=input;return {length:44100};},token:()=> 'dirty'});
 exporter.encode=async()=>({blob:new Blob(['mp3']),attenuation:1});
 const unsaved=[track(-1,{volume:47,pan:-30,audio:{filename:'local'}})];
 const result=await exporter.preview({project:{id:7,name:'Dirty'},tracks:unsaved,channels:new Map(),range:{start:0,end:1}});
 assert.equal(result.ephemeral,true);assert.equal(options.persisted,false);assert.equal(options.tracks[0].volume,47);assert.equal(options.tracks[0].pan,-30);assert.notEqual(options.tracks,unsaved);
});
