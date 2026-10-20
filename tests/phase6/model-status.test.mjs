import test from 'node:test';
import assert from 'node:assert/strict';
import {describeModelStatus, separationEligibility, ModelLoadIndicator} from '../../examples/wam/source-separation/ModelStatus.js';

const model = {files:[{size:40*1024**2}]};
test('missing model exposes a download action and its size even with decoded audio',()=>{
  const view = describeModelStatus({state:'missing'},model);
  assert.match(view.label,/non téléchargé/);assert.match(view.detail,/40.0 Mio/);
  assert.equal(view.canDownload,true);assert.equal(view.ready,false);
  assert.equal(separationEligibility({modelState:'missing',audioReady:true}).enabled,false);
});
test('live download exposes byte-based percentage; checking, hashing and saving remain unavailable',()=>{
  const download=describeModelStatus({state:'downloading',received:10*1024**2,total:40*1024**2},model);
  assert.equal(download.percent,25);assert.match(download.label,/25%/);assert.match(download.detail,/10.0 Mio \/ 40.0 Mio/);
  for(const state of ['checking','downloading','verifying','saving']){
    const view=describeModelStatus({state},model);
    assert.equal(view.pending,true);assert.equal(view.canDownload,false);
    assert.equal(separationEligibility({modelState:state,audioReady:true}).enabled,false);
  }
  assert.equal(describeModelStatus({state:'checking'},model).indeterminate,true);
});
test('installed means cached, not loaded in memory; model and audio must both be ready',()=>{
  const view=describeModelStatus({state:'installed'},model);
  assert.equal(view.ready,true);assert.equal(view.percent,100);assert.match(view.detail,/mémoire commencera/);
  assert.equal(separationEligibility({modelState:'installed',audioReady:false}).enabled,false);
  assert.equal(separationEligibility({modelState:'installed',audioReady:true}).enabled,true);
  assert.equal(separationEligibility({modelState:'installed',audioReady:true,decoding:true}).enabled,false);
  assert.equal(separationEligibility({modelState:'installed',audioReady:true,busy:true}).enabled,false);
  assert.match(describeModelStatus({state:'loading'},model).label,/Chargement/);
  assert.match(describeModelStatus({state:'inference'},model).label,/chargé/);
});
test('errors, corrupt cache and cancellation permit a visible retry with error detail',()=>{
  for(const state of ['error','corrupt','cancelled'])assert.equal(describeModelStatus({state},model).canDownload,true);
  const error=describeModelStatus({state:'error',message:'Réseau indisponible'},model);
  assert.equal(error.detail,'Réseau indisponible');assert.equal(error.tone,'error');
});

test('loaded indicator never restarts for later specialists or same-model selection, but resets on model change',()=>{
  const indicator = new ModelLoadIndicator();
  assert.equal(indicator.select('ft:1'),true);
  assert.equal(indicator.update('load'),'loading');
  assert.equal(indicator.update('inference'),'inference');
  for(let i=0;i<3;i++)assert.equal(indicator.update('load'),'inference');
  assert.equal(indicator.select('ft:1'),false);
  assert.equal(indicator.update('load'),'inference');
  const loaded = describeModelStatus({state:'inference'},model);
  assert.equal(loaded.indeterminate,false);assert.equal(loaded.percent,100);
  assert.equal(indicator.select('6s:1'),true);
  assert.equal(indicator.update('load'),'loading');
});
