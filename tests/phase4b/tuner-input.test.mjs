import test from 'node:test';
import assert from 'node:assert/strict';
import SourceManager from '../../examples/wam/SourceManager.js';
import {TunerInput} from '../../examples/wam/TunerInput.js';

class Node {
  constructor() { this.edges = []; this.channelCount = 2; }
  connect(to, output = 0, input = 0) { this.edges.push({to, output, input}); return to; }
  disconnect(to) { this.edges = to ? this.edges.filter(edge => edge.to !== to) : []; }
}
function setup() {
  const source = Object.assign(new EventTarget(), {mode:'live', liveSplitter:new Node(), sourceTrim:new Node(), liveInput:{channelCount:2,channelIndex:0}, audioContext:{createGain:()=>new Node()}});
  source.createLiveTap = SourceManager.prototype.createLiveTap;
  source.createDITap = SourceManager.prototype.createDITap;
  const rack = Object.assign(new EventTarget(), {activeB:true,channelB:1,route:null});
  const input = new TunerInput({source,rack}), destination = new Node();
  const change = target => target.dispatchEvent(new Event('change'));
  return {source,rack,input,destination,change};
}
test('tuner chooses A or B physical channel independently of muted/effected lanes', () => {
  const {source,rack,input,destination,change} = setup();
  input.connect(destination);
  assert.equal(source.liveSplitter.edges[0].output,0);
  const a = input.tap.node;
  input.select('b');
  assert.equal(a.edges.length,0);
  assert.equal(source.liveSplitter.edges.length,1);
  assert.equal(source.liveSplitter.edges[0].output,1);
  assert.equal(input.tap.node.edges[0].to,destination);
  assert.equal(input.tap.node.channelCount,1);
  assert.equal(input.tap.node.channelInterpretation,'discrete');
  const b = input.tap;
  rack.mutedA=true; rack.enabledB=false; change(rack);
  assert.equal(input.tap,b,'muting the rack does not interrupt analysis');
  input.destroy();assert.equal(source.liveSplitter.edges.length,0);
});
test('channel changes, shared A→B, hidden B and device loss reroute and release only the analysis tap', () => {
  const {source,rack,input,destination,change} = setup();
  const audible = new Node();source.liveSplitter.connect(audible,0,0);
  input.connect(destination);input.select('b');
  rack.channelB=0;change(rack);assert.equal(input.channel,0);
  rack.route={index:1};change(rack);
  assert.match(input.choices[1].label,/shared with A/);
  source.liveInput.channelIndex=1;change(source);assert.equal(input.channel,1);
  rack.activeB=false;change(rack);assert.equal(input.selected,'a');assert.equal(input.choices.length,1);
  const oldSplitter=source.liveSplitter;source.mode=null;source.liveInput=null;source.liveSplitter=null;change(source);
  assert.equal(input.tap,null);assert.equal(oldSplitter.edges.length,1);assert.equal(oldSplitter.edges[0].to,audible);
  source.mode='live';source.liveSplitter=new Node();source.liveInput={channelCount:2,channelIndex:0};change(source);
  assert.equal(input.channel,0);assert.equal(source.liveSplitter.edges.length,1);
  input.destroy();change(source);assert.equal(source.liveSplitter.edges.length,0);
});
test('unavailable B never silently analyses A, and single-chain/file sources remain usable', () => {
  const {source,rack,input,destination,change} = setup();
  input.connect(destination);input.select('b');
  source.liveInput.channelCount=1;change(source);
  assert.equal(input.choices[1].available,false);assert.equal(input.tap,null);
  source.mode='file';change(source);assert.equal(input.tap,null);
  input.select('a');assert.equal(source.sourceTrim.edges[0].to,destination);
  rack.route={index:0};input.select('b');assert.equal(input.choices[1].available,true);
  assert.equal(source.sourceTrim.edges.length,1);
  input.disconnect();assert.equal(source.sourceTrim.edges.length,0);
  input.connect(destination);input.disconnect();assert.equal(source.sourceTrim.edges.length,0);
  input.destroy();assert.throws(()=>input.select('x'),/unavailable/);
});
test('recording DI still defaults to A; explicit analysis channel validates bounds', () => {
  const {source} = setup();
  const di=source.createDITap(), analysis=source.createLiveTap(1);
  assert.deepEqual(source.liveSplitter.edges.map(edge=>edge.output),[0,1]);
  assert.equal(source.liveInput.channelIndex,0);
  for(const index of [-1,2,NaN,.5])assert.throws(()=>source.createLiveTap(index),/unavailable/);
  analysis.release();di.release();assert.equal(source.liveSplitter.edges.length,0);
});
