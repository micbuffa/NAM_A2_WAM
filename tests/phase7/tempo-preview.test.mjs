import test from 'node:test';
import assert from 'node:assert/strict';
import {createTempoProposal,nearestBeat,waveformPeaks} from '../../examples/wam/projects/tempo/TempoProposal.js';
import {TempoPreviewPlayer} from '../../examples/wam/projects/tempo/TempoPreviewPlayer.js';
const analysis=()=>({duration:4,beats:[0,.5,1,1.5,2,2.5,3,3.5],downbeats:[0,2]});
test('tempo preview preserves raw model events, audio and project-independent metadata',()=>{
 const raw=analysis();Object.freeze(raw.beats);Object.freeze(raw.downbeats);Object.freeze(raw);
 const p=createTempoProposal(raw);assert.deepEqual(p.beats,raw.beats);assert.deepEqual(p.downbeats,raw.downbeats);assert.equal(p.medianBpm,120);assert.equal(p.appliedToProject,false);assert.equal(p.kind,'preview-only');assert.notEqual(p.allBeats,raw.beats);
});
test('tempo preview half/double interpretation is reversible and does not extrapolate new end beats',()=>{
 const raw=analysis(),half=createTempoProposal(raw,{multiplier:.5}),double=createTempoProposal(raw,{multiplier:2});
 assert.deepEqual(half.beats,[0,1,2,3]);assert.equal(half.medianBpm,60);assert.equal(double.beats.length,15);assert.equal(double.beats[1],.25);assert.equal(double.beats.at(-1),3.5);assert.equal(double.medianBpm,240);assert.deepEqual(createTempoProposal(raw).beats,raw.beats);
});
test('tempo preview half-time preserves the chosen first-beat parity',()=>{
 const p=createTempoProposal(analysis(),{multiplier:.5,anchorTime:.5});assert.deepEqual(p.beats,[.5,1.5,2.5,3.5]);assert.equal(p.anchorTime,.5);assert.deepEqual(p.downbeats,[.5]);
});
test('tempo preview first-time and three/four-beat bar corrections are explicit',()=>{
 assert.deepEqual(createTempoProposal(analysis(),{anchorTime:.5,beatsPerBar:4}).downbeats,[.5,2.5]);
 assert.deepEqual(createTempoProposal(analysis(),{beatsPerBar:3}).downbeats,[0,1.5,3]);assert.equal(nearestBeat([0,.5],.25),0);assert.equal(nearestBeat([],1),null);
});
test('tempo preview A/B is inclusive/exclusive and does not renumber the detected accents',()=>{
 const p=createTempoProposal(analysis(),{rangeStart:.5,rangeEnd:2});assert.deepEqual(p.beats,[.5,1,1.5]);assert.deepEqual(p.downbeats,[]);assert.deepEqual(p.allDownbeats,[0,2]);
});
test('tempo preview silence remains empty with no invented BPM or first measure',()=>{
 const p=createTempoProposal({duration:2,beats:[],downbeats:[]},{anchorTime:1,beatsPerBar:3,multiplier:2});assert.deepEqual(p.beats,[]);assert.deepEqual(p.downbeats,[]);assert.equal(p.medianBpm,null);assert.equal(p.anchorTime,null);
});
test('tempo preview rejects invalid events, nonfinite corrections and reversed/outside ranges',()=>{
 for(const options of [{rangeStart:2,rangeEnd:1},{rangeStart:-1},{rangeEnd:5},{rangeEnd:NaN},{multiplier:3},{anchorTime:NaN},{beatsPerBar:6}])assert.throws(()=>createTempoProposal(analysis(),options));
 for(const beats of [[.5,.5],[1,.5],[NaN],[4]])assert.throws(()=>createTempoProposal({...analysis(),beats}));
});
test('preview waveform respects cropped duration and retains opposite stereo channels without cancelling them',()=>{
 const a=Float32Array.of(.25,.75,1,1),b=Float32Array.of(-.25,-.75,-1,-1);assert.deepEqual([...waveformPeaks([a,b],1,2,2)],[.25,.75]);assert.deepEqual([...a],[.25,.75,1,1]);assert.throws(()=>waveformPeaks([],1,1));assert.throws(()=>waveformPeaks([a],1,1,0));
});
function harness(){
 let interval,id=0,ended=0;const ctx={currentTime:10,destination:{},sources:[],oscillators:[],gains:[],resume:async()=>{},close:async()=>{ctx.closed=true;}};
 function node(){return{connect(){},disconnect(){this.disconnected=true;},start(...args){this.started=args;},stop(when){(this.stops ||= []).push(when);}};}
 ctx.createBufferSource=()=>{const n=node();ctx.sources.push(n);return n;};
 ctx.createOscillator=()=>{const n=node();n.frequency={setValueAtTime(value,time){n.pitch={value,time};}};ctx.oscillators.push(n);return n;};
 ctx.createGain=()=>{const n=node();n.gain={setValueAtTime(value,time){n.level={value,time};},exponentialRampToValueAtTime(){}};ctx.gains.push(n);return n;};
 const player=new TempoPreviewPlayer({contextFactory:()=>ctx,setIntervalImpl:cb=>{interval=cb;return ++id;},clearIntervalImpl:()=>{interval=undefined;},onEnded:()=>ended++});
 const p={rangeStart:1,rangeEnd:2.5,beats:[1,1.5,2],downbeats:[1,2]},buffer={duration:4,originalSamples:Float32Array.of(1,2,3)};
 return {ctx,player,p,buffer,advance:time=>{ctx.currentTime=time;interval?.();},ended:()=>ended};
}
test('preview transport starts audio at A and clocks the first click from the same AudioContext origin',async()=>{
 const {ctx,player,p,buffer}=harness();await player.play(buffer,p);assert.deepEqual(ctx.sources[0].started,[10.05,1,1.5]);assert.equal(ctx.sources[0].buffer,buffer);assert.deepEqual(ctx.oscillators[0].started,[10.05]);assert.deepEqual([...buffer.originalSamples],[1,2,3]);player.stop();
});
test('preview transport follows variable beat spacing and highlights downbeats without GUI timing as clock',async()=>{
 const h=harness();h.p.beats=[1,1.4,2.1];h.p.downbeats=[1,2.1];await h.player.play(h.buffer,h.p);
 h.advance(10.35);h.advance(11.10);assert.deepEqual(h.ctx.oscillators.map(n=>n.started[0]),[10.05,10.450000000000001,11.15]);assert.deepEqual(h.ctx.oscillators.map(n=>n.pitch.value),[1400,900,1400]);h.player.stop();
});
test('preview metronome can be disabled while keeping the original audio playing; enabling does not replay old beats',async()=>{
 const h=harness();await h.player.play(h.buffer,h.p,{click:false});assert.equal(h.ctx.oscillators.length,0);h.advance(10.4);h.player.setClickEnabled(true);h.advance(10.5);assert.equal(h.ctx.oscillators.length,1);assert.equal(h.ctx.oscillators[0].started[0],10.55);h.player.setClickEnabled(false);assert.equal(h.player.voices.size,0);assert.equal(h.ctx.sources[0].stops,undefined);h.player.stop();
});
test('preview stop cancels scheduled clicks and audio, and stale end notifications are ignored',async()=>{
 const h=harness();await h.player.play(h.buffer,h.p);const end=h.ctx.sources[0].onended;h.player.stop();h.advance(20);end();assert.equal(h.ctx.oscillators.length,1);assert.equal(h.player.voices.size,0);assert.ok(h.ctx.sources[0].disconnected);assert.ok(h.ctx.oscillators[0].disconnected);assert.equal(h.ended(),0);assert.equal(h.player.position,null);
});
test('preview pending resume cannot start after changing source or stopping playback',async()=>{
 const h=harness();let resume;h.ctx.resume=()=>new Promise(r=>{resume=r;});const pending=h.player.play(h.buffer,h.p);h.player.stop();resume();assert.equal(await pending,false);assert.equal(h.ctx.sources.length,0);assert.equal(h.ctx.oscillators.length,0);
});
test('preview natural ending cleans up and emits one end notification',async()=>{
 const h=harness();await h.player.play(h.buffer,h.p);const end=h.ctx.sources[0].onended;end();end();assert.equal(h.ended(),1);assert.equal(h.player.playing,false);assert.equal(h.player.voices.size,0);await h.player.dispose();assert.ok(h.ctx.closed);
});
test('preview late scheduler skips past clicks instead of producing a burst, and validates audio range',async()=>{
 const h=harness();await h.player.play(h.buffer,h.p);h.advance(12);assert.equal(h.ctx.oscillators.length,1);h.player.stop();await assert.rejects(h.player.play(h.buffer,{...h.p,rangeEnd:5}),/range/);await assert.rejects(h.player.play(h.buffer,{...h.p,beats:[NaN]}),/range/);
});
test('preview default browser timers keep their Window/global receiver instead of the player instance',async()=>{
 const h=harness(),originalSet=globalThis.setInterval,originalClear=globalThis.clearInterval;let scheduled=false,cleared=false;
 globalThis.setInterval=function(){assert.equal(this,globalThis);scheduled=true;return 7;};globalThis.clearInterval=function(id){assert.equal(this,globalThis);assert.equal(id,7);cleared=true;};
 try{const player=new TempoPreviewPlayer({contextFactory:()=>h.ctx});await player.play(h.buffer,h.p);player.stop();assert.ok(scheduled&&cleared);}finally{globalThis.setInterval=originalSet;globalThis.clearInterval=originalClear;}
});
