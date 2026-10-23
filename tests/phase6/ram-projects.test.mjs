import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ProjectSaveState} from '../../examples/wam/source-separation/ProjectSaveState.js';
const source=(await readFile(new URL('../../examples/wam/source-separation/MultitrackPlayerElement.js',import.meta.url),'utf8')).replace(/^import .*;$/mg,'').replace('export class','class').replaceAll('import.meta.url',"'http://localhost/MultitrackPlayerElement.js'");
class Element extends EventTarget{attachShadow(){const nodes=new Map();this.shadowRoot={getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false});return nodes.get(id);}};}}
const Player=new Function('HTMLElement','customElements','ProjectSaveState',`${source};return MultitrackPlayerElement;`)(Element,{get:()=>true},ProjectSaveState);
function fixture(){
 const player=new Player();let audioWrites=0,projectWrites=0,trackWrites=0;
 const snapshot={version:2,result:{duration:3,tracks:[{id:'guitar'}]}};
 player.notice={textContent:''};player.exportButton={textContent:''};player.projects=[];player.renderProjects=()=>{};
 player.application={hasSeparated:true,busy:false,source:{name:'Test song'},async getState(){audioWrites++;return snapshot;},async setState(){return {missing:false};},exportSnapshot:()=>({})};
 player.repository={list:async()=>[],putProject:async()=>projectWrites++,get:async()=>({kind:'project',state:snapshot}),putTrack:async()=>{trackWrites++;return {id:'mix'};}};
 player.exporter={export:async()=>({blob:new Blob(['mp3'],{type:'audio/mpeg'}),duration:3,attenuation:1})};
 player.sourceChanged();return {player,get counts(){return {audioWrites,projectWrites,trackWrites};}};
}
test('dirty state survives edits during a save and stale completion cannot mark a new source saved',()=>{
 const s=new ProjectSaveState();s.reset();assert.equal(s.dirty,true);const first=s.begin();assert.equal(s.begin(),null);s.changed();s.finish(first,true);assert.equal(s.dirty,true);
 const second=s.begin();s.finish(second,true);assert.equal(s.dirty,false);
 s.changed();const stale=s.begin();s.reset();assert.equal(s.finish(stale,true),false);assert.equal(s.dirty,true);assert.equal(s.saving,false);
 s.reset(true);assert.equal(s.dirty,false);
});
test('RAM separation completion performs no audio, metadata or project writes and shows explicit save state',()=>{
 const f=fixture();f.player.separationComplete();assert.deepEqual(f.counts,{audioWrites:0,projectWrites:0,trackWrites:0});assert.equal(f.player.projectSave.dirty,true);
 assert.match(f.player.shadowRoot.getElementById('projectSaveStatus').textContent,/RAM.*non enregistré/);assert.equal(f.player.shadowRoot.getElementById('saveSession').disabled,false);assert.match(f.player.notice.textContent,/RAM/);
});
test('only explicit save persists PCM and project metadata, marks clean and suppresses duplicate saves',async()=>{
 const f=fixture();await Promise.all([f.player.saveProject(),f.player.saveProject()]);assert.deepEqual(f.counts,{audioWrites:1,projectWrites:1,trackWrites:0});assert.equal(f.player.projectSave.dirty,false);assert.match(f.player.shadowRoot.getElementById('projectSaveStatus').textContent,/Projet enregistré/);assert.ok(f.player.activeProject);
});
test('mix changes while an explicit snapshot is being saved remain unsaved after completion',async()=>{
 const f=fixture();let complete;f.player.application.getState=()=>new Promise(r=>complete=r);const pending=f.player.saveProject();f.player.projectSave.changed();complete({result:{tracks:[{}],duration:3}});await pending;
 assert.equal(f.player.projectSave.dirty,true);assert.match(f.player.notice.textContent,/modifications récentes non enregistrées/);
});
test('save failure keeps a RAM result dirty and playable instead of reporting success',async()=>{
 const f=fixture();f.player.repository.putProject=async()=>{throw Error('QuotaExceededError');};await f.player.saveProject();assert.equal(f.player.projectSave.dirty,true);assert.equal(f.player.projectSave.saving,false);assert.match(f.player.notice.textContent,/sauvegarde impossible/);assert.equal(f.player.application.hasSeparated,true);assert.equal(f.player.activeProject,null);
});
test('loading a saved project is clean, reads existing audio on demand and never writes a new snapshot',async()=>{
 const f=fixture();await f.player.loadProject('existing');assert.equal(f.player.projectSave.dirty,false);assert.equal(f.player.activeProject,'existing');assert.deepEqual(f.counts,{audioWrites:0,projectWrites:0,trackWrites:0});assert.match(f.player.notice.textContent,/chargé en pause/);
});
test('switching source during save cannot mark or rename the new RAM project as saved',async()=>{
 const f=fixture();let complete;f.player.repository.putProject=()=>new Promise(r=>complete=r);const pending=f.player.saveProject();await new Promise(r=>setImmediate(r));f.player.sourceChanged();complete();await pending;
 assert.equal(f.player.activeProject,null);assert.equal(f.player.projectSave.dirty,true);
});
test('explicit MP3 export writes only the requested track and leaves stems unsaved',async()=>{
 const f=fixture();let exports=0;f.player.addEventListener('export-to-tracks',()=>exports++);await f.player.exportMix();assert.deepEqual(f.counts,{audioWrites:0,projectWrites:0,trackWrites:1});assert.equal(f.player.projectSave.dirty,true);assert.equal(exports,1);assert.match(f.player.notice.textContent,/MP3 exporté/);
});
test('save is unavailable while separating, without stems or during an explicit save',()=>{
 const {player}=fixture();player.application.busy=true;player.renderSaveStatus();assert.equal(player.shadowRoot.getElementById('saveSession').disabled,true);
 player.application.busy=false;player.application.hasSeparated=false;player.renderSaveStatus();assert.equal(player.shadowRoot.getElementById('saveSession').disabled,true);
});
