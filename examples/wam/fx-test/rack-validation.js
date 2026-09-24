import {FxChain} from '../FxChain.js';
import {FxRack} from '../FxRack.js';
const output=document.querySelector('#results');
const check=(ok,label)=>{if(!ok)throw Error(label);output.textContent+=`PASS ${label}\n`;};
async function render(mode){
  const context=new OfflineAudioContext(2,12000,48000),registry={};
  const make=(ids,gains)=>{const lane=new FxChain({context,registry});lane.entries=ids.map((id,index)=>{const audioNode=context.createGain();audioNode.gain.value=gains[index];return lane.wrap({id,plugin:{audioNode}});});lane.reconnect();return lane;};
  const a=make(['a1','a2'],[2,3]),splitter=context.createChannelSplitter(2);
  const source=Object.assign(new EventTarget(),{mode:'live',liveInput:{channelCount:2},setSecondary(target,channel){if(this.target){try{splitter.disconnect(this.target);}catch{}}this.target=target;if(target)splitter.connect(target,channel);}});
  const rack=new FxRack({context,a,source,createLane:async()=>make(['b1'],[5])});rack.output.connect(context.destination);
  splitter.connect(a.input,0);await rack.setVisible(true);await rack.setEnabledB(true);
  if(!['independent','pan-opposed','pan-reversed'].includes(mode)){await rack.connectRoute(1);if(mode!=='split-middle')await rack.connectRoute(2);}
  if(mode==='mute-a')await rack.setMutedA(true);
  if(mode==='remove'){await rack.removeRoute();await rack.setEnabledB(true);}
  if(mode==='hide')await rack.setVisible(false);
  if(mode.startsWith('pan-')){rack.setPan('a',mode==='pan-opposed'?-1:1);rack.setPan('b',mode==='pan-opposed'?1:-1);}
  const buffer=context.createBuffer(2,12000,48000);buffer.getChannelData(0).fill(.01);buffer.getChannelData(1).fill(.03);
  const input=context.createBufferSource();input.buffer=buffer;input.connect(splitter);input.start();
  const audio=await context.startRendering();const values=audio.getChannelData(0).subarray(6000);
  const actual=values.reduce((sum,v)=>sum+v,0)/values.length;
  const mix=10**(-6/20),expected=mode==='mute-a'?.3:mode==='hide'?.06:mode==='split-middle'?.16*mix:mode==='split-end'?.36*mix:.21*mix;
  if(mode.startsWith('pan-')){
    const right=audio.getChannelData(1).subarray(6000),rightMean=right.reduce((sum,v)=>sum+v,0)/right.length;
    const leftExpected=(mode==='pan-opposed'?.06:.15)*2*mix,rightExpected=(mode==='pan-opposed'?.15:.06)*2*mix;
    check(Math.abs(actual-leftExpected)<1e-5&&Math.abs(rightMean-rightExpected)<1e-5,`${mode}: L ${actual.toFixed(6)} / R ${rightMean.toFixed(6)}, expected ${leftExpected.toFixed(6)} / ${rightExpected.toFixed(6)}`);return;
  }
  check(values.every(Number.isFinite)&&Math.abs(actual-expected)<1e-5,`${mode}: output ${actual.toFixed(6)}, expected ${expected.toFixed(6)}`);
}
document.querySelector('#run').onclick=async()=>{
  output.textContent='';document.querySelector('#run').disabled=true;
  try{for(const mode of ['independent','split-middle','split-end','mute-a','remove','hide','pan-opposed','pan-reversed'])await render(mode);output.textContent+='COMPLETE';}
  catch(error){output.textContent+=`FAIL ${error.stack}`;}
  finally{document.querySelector('#run').disabled=false;}
};
