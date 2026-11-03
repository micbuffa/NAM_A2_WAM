import test from 'node:test';import assert from 'node:assert/strict';
import {monoHeader,encodeTake} from '../../examples/wam/projects/recording/TakePCM.js';
import {readDI,punchTake} from '../../examples/wam/projects/recording/PunchTake.js';
import {RecordingHistory} from '../../examples/wam/projects/recording/RecordingHistory.js';
import {StudioHistory} from '../../examples/wam/projects/StudioHistory.js';
const rate=48000;
const wav=values=>new Blob([monoHeader(values.length,rate),new Float32Array(values)],{type:'audio/wav'});
const samples=async blob=>new Float32Array((await blob.arrayBuffer()).slice(44));
async function punch(old,raw,start,comp=0){const metadata={sampleRate:rate,startProjectFrame:start,compensationFrames:comp,capturedFrames:raw.length};return punchTake(await readDI(wav(old),rate),encodeTake([new Float32Array(raw)],metadata),metadata);}
test('partial take preserves exact prefix/suffix and overwrites only compensated interval',async()=>{
 const out=await punch([.1,.2,.3,.4,.5,.6],[.75,.875],3,1);
 assert.deepEqual(await samples(out.audio),new Float32Array([.1,.2,.75,.875,.5,.6]));assert.deepEqual(out.edit,{mode:'overwrite',baseFrames:6,startFrame:2,endFrame:4});assert.equal(out.frames,6);
});
test('recording at zero preserves old tail; recording after end inserts only the missing silence',async()=>{
 assert.deepEqual(await samples((await punch([1,2,3,4],[.5],0)).audio),new Float32Array([.5,2,3,4]));
 assert.deepEqual(await samples((await punch([1,2],[.5,.75],4)).audio),new Float32Array([1,2,0,0,.5,.75]));
});
test('negative compensated offset crops once and overwrite can extend past the old end',async()=>{
 const out=await punch([1,2],[9,.25,.5,.75],1,2);assert.deepEqual(await samples(out.audio),new Float32Array([.25,.5,.75]));assert.equal(out.frames,3);
});
test('existing malformed, different-rate or nonfinite audio is rejected before overwriting',async()=>{
 await assert.rejects(readDI(new Blob(['bad']),rate),/mono Float32/);
 await assert.rejects(readDI(wav([1]),44100),/sample rate/);
 await assert.rejects(readDI(wav([NaN]),rate),/invalid samples/);
});
test('final envelope contains both preserved suffix peaks and new captured samples',async()=>{
 const old=new Float32Array(4096);old[3500]=.9;const out=await punch(old,[.75],1100);
 assert.equal(out.peaks.length,4);assert.equal(out.peaks[1],.75);assert.equal(out.peaks[3],Math.fround(.9));
});
test('comparison buttons replay only the adjacent selected-track recording command, preserving audition position',async()=>{
 let position=1.2,changes=0;const w={selectedId:1,player:{get position(){return position;},base:{seek:n=>position=n}},report(){}};
 const r={workspace:w},h=new RecordingHistory(r);w.history=new StudioHistory();
 w.history.record({compareTrackId:1,recordingVersions:[{fields:{audio:{url:'a'}}}],undo:()=>{changes--;position=0;},redo:()=>{changes++;position=0;}});
 assert.equal(h.comparison().after,true);await h.compare(false);assert.equal(changes,-1);assert.equal(position,1.2);assert.equal(h.comparison().after,false);
 await h.compare(true);assert.equal(changes,0);assert.equal(position,1.2);
 w.history.record({label:'Volume',undo(){},redo(){}});assert.equal(h.comparison(),null);w.selectedId=2;assert.equal(h.comparison(),null);
});
