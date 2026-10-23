import test from 'node:test';
import assert from 'node:assert/strict';
import {UiFrameMetrics} from '../../examples/wam/source-separation/UiFrameMetrics.js';
test('frame diagnostics bound storage, ignore hidden time and reset independently of playback',()=>{
 const m=new UiFrameMetrics({capacity:4});[0,10,20,30,40,120].forEach(n=>m.frame(n));assert.equal(m.summary().frames,5);assert.equal(m.summary().windowFrames,4);assert.equal(m.summary().frameMaxMs,80);assert.equal(m.summary().framesOver50ms,1);
 m.frame(500,false);m.frame(1000);assert.equal(m.summary().frames,5);m.longTask(60);m.longTask(75);assert.equal(m.summary().longTaskMaxMs,75);m.reset();assert.equal(m.summary().frames,0);assert.equal(m.summary().longTasks,0);
});
test('UI stage measurements count synchronous work, including exceptions, and reset cleanly',()=>{
 let now=0;const m=new UiFrameMetrics({now:()=>now});assert.equal(m.measure('audio',()=>{now=3;return 'ok';}),'ok');
 assert.throws(()=>m.measure('audio',()=>{now=8;throw Error('fail');}));assert.deepEqual(m.summary().stages.audio,{calls:2,totalMs:8,maxMs:5});
 const snapshot=m.summary();snapshot.stages.audio.calls=99;assert.equal(m.summary().stages.audio.calls,2);m.reset();assert.deepEqual(m.summary().stages,{});
});
test('heartbeat separates event-loop delays from gaps in rendering and ignores hidden time',()=>{
 const m=new UiFrameMetrics();[0,50,100,150].forEach(n=>m.heartbeat(n));m.frame(0);m.frame(2000);
 assert.equal(m.summary().heartbeatDelayMaxMs,0);assert.equal(m.summary().frameMaxMs,2000);
 m.heartbeat(1000);assert.equal(m.summary().heartbeatDelayMaxMs,800);m.heartbeat(2000,false);m.heartbeat(9000);assert.equal(m.summary().heartbeatSamples,4);
 m.reset();assert.equal(m.summary().heartbeatSamples,0);assert.deepEqual(m.summary().rafGaps,[]);
});
test('worker phase and animation-frame attribution stay bounded and detached from snapshots',()=>{
 const m=new UiFrameMetrics();for(let i=0;i<120;i++){m.worker({phase:'network',edge:'start',at:i},i+5);m.animationFrame({startTime:i,duration:100,blockingDuration:2,scripts:Array.from({length:12},()=>({sourceURL:'main.js',duration:6}))});}
 const s=m.summary();assert.equal(s.workerTrace.length,80);assert.equal(s.workerTrace[0].at,40);assert.equal(s.longAnimationFrames.length,40);assert.equal(s.longAnimationFrames[0].scripts.length,8);
 s.workerTrace[0].phase='changed';assert.equal(m.summary().workerTrace[0].phase,'network');m.reset();assert.deepEqual(m.summary().longAnimationFrames,[]);
});
