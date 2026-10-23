import test from 'node:test';
import assert from 'node:assert/strict';
import {transportTimeline,seekAvailable,WaveformRefreshGate,ProgressSlider} from '../../examples/wam/source-separation/TransportTimeline.js';
test('growing available audio never moves a steadily playing slider backwards',()=>{
 const engine={progressive:true,duration:60,availableDuration:6,position:5};
 const before=transportTimeline(engine);engine.availableDuration=9;engine.position=5.1;const after=transportTimeline(engine);
 assert.equal(before.duration,60);assert.equal(after.duration,60);assert.ok(after.playedFraction>before.playedFraction);
 assert.equal(before.playedFraction,5/60);assert.equal(after.availableFraction,9/60);
 // The previous implementation divided by available duration and visibly regressed.
 assert.ok(engine.position/9<5/6);
});
test('seeking uses the fixed full-song axis but clamps to published audio',()=>{
 const e={progressive:true,duration:120,availableDuration:8,position:3};assert.equal(seekAvailable(e,60),8);assert.equal(seekAvailable(e,-1),0);assert.equal(seekAvailable(e,4),4);
 assert.equal(transportTimeline({...e,availableDuration:150}).available,120);assert.throws(()=>seekAvailable(e,NaN));
});
test('timeline handles empty, full and replaced models independently from buffer growth',()=>{
 assert.deepEqual(transportTimeline(null),{duration:0,available:0,position:0,playedFraction:0,availableFraction:0});
 assert.equal(transportTimeline({duration:10,position:3}).playedFraction,.3);
 assert.equal(transportTimeline({progressive:true,duration:10,position:0,availableDuration:0}).availableFraction,0);
});
test('waveform bursts collapse to one refresh per interval while audio chunks stay independent',()=>{
 const gate=new WaveformRefreshGate(250);gate.rendered(0);
 for(let now=10;now<=200;now+=10){gate.request();assert.equal(gate.due(now),false);}
 assert.equal(gate.due(250),true);gate.rendered(250);assert.equal(gate.due(500),false);
 gate.request();assert.equal(gate.due(499),false);assert.equal(gate.due(500),true);
 gate.rendered(500);gate.request();gate.rendered(501);assert.equal(gate.due(1000),false);
});

test('focused range continues animating except while a pointer is actually dragging it',()=>{
 const input={max:'0',value:'0',setPointerCapture(id){this.captured=id;}},slider=new ProgressSlider(input);
 slider.update({duration:60,position:5});assert.equal(input.max,'60');assert.equal(input.value,'5');
 input.onpointerdown({pointerId:7});input.value='8';slider.update({duration:60,position:6});assert.equal(input.value,'8');assert.equal(input.captured,7);
 input.onpointerup();slider.update({duration:60,position:7});assert.equal(input.value,'7');
 // Keeping keyboard focus no longer freezes playback updates.
 slider.update({duration:60,position:8});assert.equal(input.value,'8');
 input.onpointerdown({pointerId:8});input.onlostpointercapture();slider.update({duration:60,position:9});assert.equal(input.value,'9');
 slider.destroy();assert.equal(input.onpointerdown,null);
});
