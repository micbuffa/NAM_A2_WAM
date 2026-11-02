import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {StudioRecording} from '../../examples/wam/projects/recording/StudioRecording.js';
function control(){
 const attrs=new Map(),classes=new Set();return{disabled:false,hidden:false,textContent:'',value:'14',inert:false,attrs,
  setAttribute(k,v){attrs.set(k,String(v));},getAttribute(k){return attrs.get(k);},
  classList:{toggle(k,v){v?classes.add(k):classes.delete(k);},contains(k){return classes.has(k);}}};
}
function setup(){
 const r=Object.create(StudioRecording.prototype),nodes=new Map(),track={id:1,name:'Solo',origin:'personal',instrument:'guitar',audio:null,inputMonitoring:false},other={id:2,name:'Backing',origin:'import',instrument:'other',audio:{url:'/backing.wav'}};
 const row=t=>({track:t,root:control(),arm:t.id===1?control():null,modes:{inputMonitoring:control(),mute:control(),solo:control()},structuralControls:[control()],volume:control(),pan:control(),lane:control()});
 const rows=new Map([[1,row(track)],[2,row(other)]]);rows.get(1).structuralControls.push(rows.get(1).arm);
 const calls=[],w=r.workspace={owned:true,selectedId:1,accountLoadEpoch:1,project:{id:9,tracks:[track,other]},
  get selectedTrack(){return this.project.tracks.find(t=>t.id===this.selectedId);},
  $:id=>{if(!nodes.has(id))nodes.set(id,control());return nodes.get(id);},
  timeline:{rows,update(t){rows.get(t.id).track=t;}},
  player:{position:0,playing:false,base:{setTracks(tracks){calls.push(['tracks',tracks]);},pause(){calls.push(['pause']);}},stop(){calls.push(['stop']);this.playing=false;this.position=0;}},
  select(id){this.selectedId=id;calls.push(['select',id]);},render:()=>r.render()};
 Object.assign(r,{state:'idle',armedId:1,pending:new Map(),context:{sampleRate:48000,resume:async()=>{}},source:{liveInput:{label:'Test interface',channelIndex:1}},metronome:{enabled:false,countInBars:1,count:2},lock:()=>{}});
 return{r,w,nodes,rows,calls};
}
test('shared Record targets the armed personal track independently of the current row selection',async()=>{
 const {r,w,nodes,calls}=setup();w.selectedId=2;r.render();assert.equal(nodes.get('projectRecord').disabled,false);assert.match(nodes.get('projectRecord').title,/Solo/);assert.match(nodes.get('recordStatus').textContent,/Armed/);
 r.waitForBacking=async()=>{throw Error('prepared the armed track');};r.abort=error=>calls.push(['abort',error.message]);
 await r.start();assert.equal(w.selectedId,1);assert.deepEqual(calls.slice(0,2),[['select',1],['pause']]);assert.match(calls.at(-1)[1],/prepared the armed track/);
});
test('count-in/capture keeps only the armed speaker usable; controls, selection, seek and transport edits remain locked',async()=>{
 const {r,w,nodes,rows,calls}=setup();rows.get(2).volume.disabled=true;
 r.setState('counting');const armed=rows.get(1),other=rows.get(2);
 assert.equal(nodes.get('projectTracks').inert,false);assert.equal(w.timeline.locked,true);assert.equal(armed.modes.inputMonitoring.disabled,false);assert.equal(other.modes.inputMonitoring.disabled,true);
 for(const c of [...armed.structuralControls,armed.volume,armed.pan,armed.modes.mute,armed.modes.solo])assert.equal(c.disabled,true);
 assert.equal(armed.lane.inert,true);assert.equal(nodes.get('projectRuler').inert,true);assert.equal(nodes.get('projectRecordStop').disabled,false);assert.equal(nodes.get('recordOptions').disabled,true);
 await r.monitor();assert.equal(w.selectedTrack.inputMonitoring,true);await r.monitor();assert.equal(w.selectedTrack.inputMonitoring,false);assert.equal(calls.filter(c=>c[0]==='tracks').length,2);
 r.setState('idle');assert.equal(w.timeline.locked,false);assert.equal(armed.volume.disabled,false);assert.equal(other.volume.disabled,true);assert.equal(armed.lane.inert,false);assert.equal(armed.arm.disabled,false);
});
test('shared Stop stops playback or cancels/stops capture; finalization never invokes another stop',async()=>{
 const {r,w,nodes,calls}=setup();w.player.playing=true;r.render();assert.equal(nodes.get('projectRecordStop').disabled,false);await r.stopTransport();assert.deepEqual(calls,[['stop']]);
 for(const state of ['preparing','counting','recording']){r.state=state;r.stop=async()=>calls.push([state]);await r.stopTransport();}
 r.state='finalizing';r.render();assert.equal(nodes.get('projectRecordStop').disabled,true);await r.stopTransport();assert.equal(calls.length,4);
});
test('saved audio, removed tracks, read-only projects, previews and pending take limits cannot record through the global button',()=>{
 for(const change of [f=>f.w.project.tracks[0].audio={},f=>f.w.project.tracks[0].removedAt='now',f=>f.w.owned=false,f=>f.w.saving=true,f=>f.w.separation={busy:true},f=>f.w.separation={result:{engine:{complete:true}}},f=>f.r.pending=new Map([[3,{}],[4,{}]])]){
  const f=setup();change(f);f.r.render();assert.equal(f.nodes.get('projectRecord').disabled,true);
 }
});
test('the product keeps one Record/Stop pair, no duplicate monitor/arm panel, and secondary commands in settings',async()=>{
 const html=await readFile(new URL('../../examples/wam/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="record(?:Panel|Arm|Monitor)"/);
 for(const id of ['projectRecord','projectRecordStop','recordStatus','recordOptions','recordCurrentTone','recordDiscard'])assert.equal(html.split(`id="${id}"`).length-1,1);
 assert.match(html,/<div class="project-transport"[^>]*>[\s\S]*id="projectRecord"[\s\S]*id="projectRecordStop"[\s\S]*?<\/div>/);
 assert.match(html,/id="recordOptionsPanel"[\s\S]*id="recordCurrentTone"[\s\S]*id="recordDiscard"/);
});

test('an armed track cannot start recording behind an unpublished instrument preview',async()=>{
 const {r,w,calls}=setup();w.selectedId=2;w.separation={result:{engine:{complete:true}}};await r.start();assert.equal(w.selectedId,2);assert.deepEqual(calls,[]);assert.equal(r.state,'idle');
});
