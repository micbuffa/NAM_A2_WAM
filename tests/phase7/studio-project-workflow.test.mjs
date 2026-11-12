import test from 'node:test';
import assert from 'node:assert/strict';
import {timelineTracks,projectTrackCount} from '../../examples/wam/projects/ProjectsModel.js';
import {audioImportDialog,importDestinationFields} from '../../examples/wam/projects/AudioImportDialog.js';
import {ProjectsWorkspace} from '../../examples/wam/projects/ProjectsWorkspace.js';
import {StudioSeparation} from '../../examples/wam/projects/StudioSeparation.js';
import AccountApi from '../../examples/wam/account/api.js';

test('one named project restores every visible import and separated instrument, with originals/history reserved',()=>{
 const tracks=[{id:1,origin:'original',timelineVisible:false},{id:2,origin:'original',timelineVisible:false},
 ...Array.from({length:4},(_,i)=>({id:10+i,origin:'stem',separationId:4,timelineVisible:true})),
 ...Array.from({length:6},(_,i)=>({id:20+i,origin:'stem',separationId:6,timelineVisible:true})),
 {id:30,origin:'original',timelineVisible:true},{id:31,origin:'personal',timelineVisible:true},
 {id:32,origin:'stem',separationId:3,timelineVisible:false},{id:33,origin:'mix',timelineVisible:true}];
 const project={name:'My project',tracks,activeSeparationId:6,separations:[{id:6,state:'ready',manifest:{modelId:'bs_roformer_sw_6s',backend:'webgpu',frames:44100}}]};
 assert.equal(timelineTracks(project).length,12);assert.equal(projectTrackCount(project),12);
 const c=Object.create(StudioSeparation.prototype);c.changed=()=>{};c.restore(project);
 assert.equal(c.viewTracks.length,12);assert.equal(c.modelId,'bs_roformer_sw_6s');
 const w=Object.create(ProjectsWorkspace.prototype);w.project=project;w.separation=c;
 assert.deepEqual(w.displayTracks,timelineTracks(project));c.show=()=>{};
 c.mode='original';assert.deepEqual(w.displayTracks,timelineTracks(project));
});

test('each import offers current or new project; a shared project is never offered as a write destination',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({children:[],append(...children){this.children.push(...children);}})};
 try{
  const fields=importDestinationFields({project:{id:7,owned:true,name:'Jam'},name:'Song',id:'import'});
  const selector=fields.root.children[0].children[0];
  assert.deepEqual(selector.children.map(o=>o.value),['7','new']);assert.deepEqual(fields.read(),{projectId:7});
  assert.equal(fields.projectName.disabled,true);
  selector.value='new';selector.onchange();assert.equal(fields.projectName.required,true);
  assert.deepEqual(fields.read(),{name:'Song'});
  const readonly=importDestinationFields({project:{id:8,owned:false,name:'Shared'},name:'Copy',id:'other'});
  assert.equal(readonly.root.children[0].children[0].children.length,1);assert.deepEqual(readonly.read(),{name:'Copy'});
 }finally{globalThis.document=old;}
});

test('Tone import into the chosen existing project appends without duplicating the project and offers keep/separate on the new source',async()=>{
 const full={id:7,name:'Jam',importedTrackId:42},calls=[],prompts=[];
 const w={requestTempo(id){this.tempoRequested=id;},project:{id:7},projects:[{id:7}],chooseImportDestination:async()=>({destination:{projectId:7}}),
  ensureSignedIn:async()=>true,confirmSavedMixDiscard:async()=>true,confirmPreviewDiscard:async()=>true,
  api:{importBacking:async(attributes,file)=>{calls.push({attributes,file});return full;}},
  separationView:{chooseModel:options=>prompts.push(options)},setProject(project){this.project=project;},replaceSummary(){},remember(){},render(){},report(){}};
 assert.equal(await ProjectsWorkspace.prototype.importFromTone.call(w,{id:'bt-song',title:'Song'}),true);
 assert.deepEqual(calls[0].attributes,{projectId:7,id:'bt-song'});assert.equal(w.projects.length,1);
 assert.deepEqual(prompts,[{sourceId:42,allowUnseparated:true}]);assert.equal(w.tempoRequested,42);
 w.chooseImportDestination=async()=>null;
 assert.equal(await ProjectsWorkspace.prototype.importFromTone.call(w,{id:'bt-song'}),false);assert.equal(calls.length,1);
});

test('YouTube destination is sent explicitly to Rails, rather than inferred later from the open project',async()=>{
 let body;const api=new AccountApi({document:{querySelector:()=>({getAttribute:()=> 'token'})},fetchImpl:async(_,options)=>{
 body=JSON.parse(options.body);return{ok:true,status:202,json:async()=>({state:'queued'})};}});
 await api.startAudioImport('https://youtu.be/9rPbKNMjuzI',{projectId:7});
 assert.deepEqual(body,{url:'https://youtu.be/9rPbKNMjuzI',projectId:7});
});


test('a project response or a file picker from an old account cannot populate a new account',async()=>{
 let resolve,adopted=false;
 const w={accountLoadEpoch:1,account:{user:{id:1}},saving:false,dirty:false,project:null,
  api:{getProject:()=>new Promise(r=>resolve=r)},setProject(){adopted=true;},render(){},remember(){},report(){},dispatchEvent(){}};
 const opened=ProjectsWorkspace.prototype.open.call(w,7,{confirm:false});
 w.accountLoadEpoch++;resolve({id:7});await opened;assert.equal(adopted,false);
 let pick;const x={accountLoadEpoch:1,ensureSignedIn:async()=>true,chooseImportDestination:()=>new Promise(r=>pick=r),importFromTone(){assert.fail('old account file must not upload');}};
 const selected=ProjectsWorkspace.prototype.importFileDialog.call(x);await new Promise(r=>setImmediate(r));
 x.accountLoadEpoch++;pick({file:{name:'Song.mp3'},destination:{projectId:7}});await selected;
});


test('file selection supplies a default project name without overwriting a manually entered name',async()=>{
 class Element extends EventTarget {
  constructor(){super();this.children=[];}
  append(...children){this.children.push(...children);}
  setAttribute(){}remove(){}showModal(){}
  close(){this.dispatchEvent(new Event('close'));}
 }
 const previous=globalThis.document;const body=new Element();globalThis.document={body,createElement:()=>new Element()};
 try{
  const pending=audioImportDialog({project:null,fileRequired:true});
  const form=body.children[0].children[1].children[0];
  const file=form.children[0].children[0],name=form.children[1].children[1].children[0];
  name.value='My session';file.files=[{name:'new_song.mp3'}];file.onchange();assert.equal(name.value,'My session');
  name.value='';file.onchange();assert.equal(name.value,'new song');
  form.onsubmit({preventDefault(){}});const result=await pending;
  assert.deepEqual(result.destination,{name:'new song'});assert.equal(result.file,file.files[0]);
 }finally{globalThis.document=previous;}
});

test('YouTube import resumes only a running job and opens the finished project by itself', async () => {
 class Element extends EventTarget {
  constructor(tag){super();this.tag=tag;this.children=[];this.hidden=false;}
  append(...children){this.children.push(...children);}
  setAttribute(){}removeAttribute(){}remove(){}showModal(){}
  close(){this.closed=true;this.dispatchEvent(new Event('close'));}
 }
 const all=(node)=>[node,...(node.children??[]).flatMap(all)];
 const previous=globalThis.document;const body=new Element('body');globalThis.document={body,createElement:tag=>new Element(tag)};
 const tick=()=>new Promise(r=>setImmediate(r));
 const setup=({jobs,confirm=true})=>{
  const calls=[];
  const w=Object.create(ProjectsWorkspace.prototype);
  Object.assign(w,{accountLoadEpoch:1,project:null,calls,ensureSignedIn:async()=>true,report(){},
   confirmSavedMixDiscard:async()=>confirm,confirmPreviewDiscard:async()=>true,
   open:async id=>{calls.push(['open',id]);w.project={id};},requestTempo:id=>calls.push(['tempo',id]),
   separationView:{chooseModel:options=>calls.push(['separate',options.sourceId])},
   api:{audioImportCapabilities:async()=>({available:true}),listAudioImports:async()=>jobs,listProjects:async()=>[]}});
  return w;
 };
 const dialogOf=()=>body.children.at(-1),find=text=>all(dialogOf()).find(node=>node.textContent===text);
 try{
  // A finished import is not shown again.
  const idle=setup({jobs:[{id:1,state:'ready',projectId:9,sourceTrackId:3,message:'Audio ready in Studio',metadata:{title:'Wicked Game',url:'u'}}]});
  await idle.youtubeImportDialog();
  assert.equal(idle.calls.length,0);
  assert.equal(find('Open in Studio').hidden,true);
  assert.equal(all(dialogOf()).find(node=>node.tag==='form').hidden,false);
  assert.ok(!all(dialogOf()).some(node=>String(node.textContent).includes('Wicked Game')));
  dialogOf().close();

  // A running import hides the form, then opens its project once when ready.
  const running={id:2,state:'downloading',progress:40,projectId:null};
  const w=setup({jobs:[running]});let poll;
  w.api.getAudioImport=async()=>poll;
  await w.youtubeImportDialog();
  assert.equal(all(dialogOf()).find(node=>node.tag==='form').hidden,true);
  poll={id:2,state:'ready',projectId:9,sourceTrackId:3};
  await new Promise(r=>setTimeout(r,1100));await tick();await tick();
  assert.deepEqual(w.calls,[['open',9],['tempo',3],['separate',3]]);
  assert.equal(dialogOf().closed,true);

  // Declining to discard unsaved work keeps the dialog with an Open in Studio fallback.
  const declined=setup({jobs:[running],confirm:false});
  declined.api.getAudioImport=async()=>poll;
  await declined.youtubeImportDialog();
  await new Promise(r=>setTimeout(r,1100));await tick();await tick();
  assert.deepEqual(declined.calls,[]);
  assert.equal(find('Open in Studio').hidden,false);
  dialogOf().close();

  // From Play: no project to choose, the import targets Play and its backing track loads there.
  const play=setup({jobs:[]});let started,polled;
  play.api.startAudioImport=async(url,destination)=>{started=[url,destination];return {id:4,state:'queued'};};
  play.api.getAudioImport=async()=>polled;
  const imported=[];
  await play.youtubeImportDialog({onImported:async job=>imported.push(job.backingTrackId)});
  assert.ok(!all(dialogOf()).some(node=>node.tag==='select'));
  const form=all(dialogOf()).find(node=>node.tag==='form'),url=all(dialogOf()).find(node=>node.tag==='input');
  url.value=' https://youtu.be/9rPbKNMjuzI ';await form.onsubmit({preventDefault(){}});
  assert.deepEqual(started,['https://youtu.be/9rPbKNMjuzI',{target:'play'}]);
  polled={id:4,state:'ready',projectId:null,backingTrackId:'upload-5',message:'Audio ready in Play'};
  await new Promise(r=>setTimeout(r,1100));await tick();await tick();
  assert.deepEqual(imported,['upload-5']);assert.deepEqual(play.calls,[]);
  assert.equal(dialogOf().closed,true);
 }finally{globalThis.document=previous;}
});
