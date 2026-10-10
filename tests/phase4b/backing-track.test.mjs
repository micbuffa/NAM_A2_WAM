import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BackingTrackEngine} from '../../examples/wam/backing-track-player/BackingTrackEngine.js';
import {updateTracks} from '../../tools/update-backing-tracks.mjs';
const param=()=>({value:1,setTargetAtTime(v){this.value=v;},setValueAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
const node=()=>({gain:param(),playbackRate:param(),connect(to){return to;},disconnect(){},start(){},stop(){}});
const context=()=>({currentTime:0,createGain:node,createBufferSource:node,resume:async()=>{},decodeAudioData:async()=>({duration:10,numberOfChannels:1,getChannelData:()=>new Float32Array([-.25,.5])})});
const loaded=()=>{const ctx=context(),engine=new BackingTrackEngine(ctx,{resolve:id=>({id,url:'https://example.test/a'})});engine.buffer={duration:10};engine.track={id:'one',title:'One'};engine.loop.endSeconds=10;return {ctx,engine};};
test('backing transport pauses, resumes, seeks and stops at loop start without changing source audio',async()=>{
 const {ctx,engine:e}=loaded();await e.play();ctx.currentTime=2;assert.equal(e.position,2);e.pause();ctx.currentTime=4;assert.equal(e.position,2);await e.play();ctx.currentTime=5;assert.equal(e.position,3);
 e.setLoop({enabled:true,startSeconds:6,endSeconds:2});assert.equal(e.loop.startSeconds,2);assert.equal(e.loop.endSeconds,6);e.seek(5);ctx.currentTime=7;assert.equal(e.position,3);e.stop();assert.equal(e.position,2);
 assert.throws(()=>e.setLoop({startSeconds:2,endSeconds:2}),/20 ms/);assert.throws(()=>e.setRate(.7),/unavailable/);
 e.peak=.25;e.setNormalized(true);assert.equal(e.normalizer.gain.value,3.96);e.setNormalized(false);assert.equal(e.normalizer.gain.value,1);e.destroy();e.destroy();
});
test('backing JSON snapshot restores settings without autoplay; missing local files are explicit',async()=>{
 const {engine:e}=loaded();e.seek(3);e.setVolumeDb(-18);e.setMuted(true);e.setMix(.8);e.setGuitarPan(-.4);const saved=JSON.parse(JSON.stringify(e.getState()));e.seek(0);await e.setState(saved);assert.deepEqual(e.getState(),saved);assert.equal(e.playing,false);
 await assert.rejects(e.setState({...saved,track:{id:'local:absent',local:true}}),/local backing file/);e.destroy();
});
test('all 29 factory backing tracks exist and the manifest has unique stable IDs',async()=>{
 const base=new URL('../../examples/wam/assets/backingTracks/',import.meta.url);const data=JSON.parse(await readFile(new URL('tracks.json',base)));assert.equal(data.tracks.length,29);assert.equal(new Set(data.tracks.map(t=>t.id)).size,29);
 for(const t of data.tracks)assert.ok((await stat(new URL(t.url,base))).size>0);
});
test('backing manifest update preserves metadata and removes missing files, check mode writes nothing',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'backing-manifest-'));try{
 await writeFile(join(dir,'A track.mp3'),'audio');await updateTracks(dir);const path=join(dir,'tracks.json'),data=JSON.parse(await readFile(path));const id=data.tracks[0].id;data.tracks[0].title='My title';await writeFile(path,JSON.stringify(data));await writeFile(join(dir,'B.mp3'),'audio');
 const before=await readFile(path,'utf8');assert.equal((await updateTracks(dir,{check:true})).changed,true);assert.equal(await readFile(path,'utf8'),before);await updateTracks(dir);const result=JSON.parse(await readFile(path));assert.equal(result.tracks[0].id,id);assert.equal(result.tracks[0].title,'My title');assert.equal((await updateTracks(dir)).changed,false);await rm(join(dir,'B.mp3'));assert.equal((await updateTracks(dir)).count,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a deferred local-file restoration resumes settings after reselecting the same file, never playback',async()=>{
 const ctx=context(),e=new BackingTrackEngine(ctx,{}),file={name:'Local.wav',size:4,lastModified:123,arrayBuffer:async()=>new ArrayBuffer(4)};
 await e.loadFile(file);e.seek(2);e.setVolumeDb(-20);const state=e.getState();
 const restored=new BackingTrackEngine(context(),{});await assert.rejects(restored.setState(state),/same local/);await restored.loadFile(file);assert.equal(restored.position,2);assert.equal(restored.volumeDb,-20);assert.equal(restored.playing,false);e.destroy();restored.destroy();
});
test('pausing while context resume is pending cancels a requested play',async()=>{
 const {ctx,engine:e}=loaded();let resume;ctx.resume=()=>new Promise(r=>resume=r);const pending=e.play();e.pause();resume();await pending;assert.equal(e.playing,false);e.destroy();
});
