import test from 'node:test';
import assert from 'node:assert/strict';
import {calibratedInputGain, InputGainCalibration} from '../../examples/wam/InputGainCalibration.js';
import {toneMonitoringGain} from '../../examples/wam/LiveMonitoring.js';

test('Studio never leaks the Tone rack: only track monitoring owns live audio', () => {
  assert.equal(toneMonitoringGain({workspace:'tone'}),1);
  for(const state of [{},{liveId:'guitar'},{armedId:'guitar'},{studioMonitoring:true},{playing:true},{recording:true}]) {
    assert.equal(toneMonitoringGain({workspace:'projects',...state}),0);
    assert.equal(toneMonitoringGain({workspace:'tone',...state}),1,'returning to Tone restores the rack level');
  }
  for(const workspace of ['tone','projects']) {
    assert.equal(toneMonitoringGain({workspace,calibrationMuted:true}),0);
    assert.equal(toneMonitoringGain({workspace,editingAudio:true}),0);
  }
});
test('input gain targets -6 dBFS with half-dB steps and bounded boost', () => {
  assert.equal(calibratedInputGain(.5).db,0);
  assert.equal(calibratedInputGain(.25).db,6);
  assert.equal(calibratedInputGain(.9).db,-5);
  assert.deepEqual(calibratedInputGain(.01),{db:12,peakDb:-40,limited:true});
  for(const value of [0,.0001,.999,1,NaN,Infinity,-1]) assert.throws(()=>calibratedInputGain(value));
});
function harness() {
  const source=Object.assign(new EventTarget(),{releases:0,createLiveTap(channel){this.channel=channel;return{node:{connect(){}},release:()=>this.releases++};}});
  const context=Object.assign(new EventTarget(),{state:'running',currentTime:0,peak:.25,createAnalyser(){return{fftSize:0,getFloatTimeDomainData:data=>data.fill(this.peak),disconnect(){}};}});
  let tick, cleared=0;
  const progress=[];
  const calibration=new InputGainCalibration({context,source,channel:1,progress:e=>progress.push(e),poll:fn=>(tick=fn,7),unpoll:id=>{assert.equal(id,7);cleared++;}});
  return{calibration,context,source,progress,tick:time=>{context.currentTime=time;tick();},get cleared(){return cleared;}};
}
test('analysis lasts five audio-clock seconds and retains the loudest strum across windows',async()=>{
  const h=harness(), done=h.calibration.start();
  assert.equal(h.source.channel,1);h.tick(1);h.context.peak=.5;h.tick(2);h.context.peak=.1;h.tick(4.99);
  assert.equal(h.calibration.running,true);h.tick(5);
  assert.equal((await done).db,0);assert.equal(h.source.releases,1);assert.equal(h.cleared,1);
  assert.deepEqual(h.progress,[0,1,2,4.99,5]);
});
test('cancel, source changes and suspended audio release taps without applying a gain',async()=>{
  for(const reason of ['cancel','source','suspend']) {
    const h=harness(),done=h.calibration.start();
    if(reason==='cancel')h.calibration.cancel();
    if(reason==='source')h.source.dispatchEvent(new Event('change'));
    if(reason==='suspend'){h.context.state='suspended';h.context.dispatchEvent(new Event('statechange'));}
    await assert.rejects(done,/cancelled/i);h.calibration.cancel();assert.equal(h.source.releases,1);assert.equal(h.cleared,1);
  }
});
test('silent and clipped calibration fail without leaking analysis nodes',async()=>{
  for(const peak of [0,1]){const h=harness();h.context.peak=peak;const done=h.calibration.start();h.tick(5);await assert.rejects(done);assert.equal(h.source.releases,1);}
});
