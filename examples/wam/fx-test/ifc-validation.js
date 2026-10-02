import initializeWamHost from '../../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js';
import {FxChain} from '../FxChain.js';
import {WamPluginRegistry,normalizeCatalogueEntry,normalizeDescriptor} from '../WamPluginRegistry.js';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=document.querySelector('#results');
const check=(condition,label)=>{if(!condition)throw Error(label);results.textContent+=`PASS ${label}\n`;};
const root='/guitar_tube_amp_sim_100%_FAUST';
const master=root+'/5_Power_Amp/Master_Volume',reverb=root+'/6_Reverb/Mix';
const measure=async analysers=>{
  await wait(250);return analysers.map(analyser=>{
    const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);
    if(!samples.every(Number.isFinite))throw Error('Non-finite DSP samples');
    return {peak:Math.max(...samples.map(Math.abs)),rms:Math.sqrt(samples.reduce((n,v)=>n+v*v,0)/samples.length)};
  });
};
export async function runIfcValidation({variant=1}={}){
  results.textContent='';const measurements=[],errors=[];
  const onError=event=>errors.push(event.message||String(event.reason));
  window.addEventListener('error',onError);window.addEventListener('unhandledrejection',onError);
  try{
  for(const sampleRate of [44100,48000]){
    const context=new AudioContext({sampleRate}),instances=[];let chain,osc;
    try{
      await context.resume();const [groupId]=await initializeWamHost(context,'ifc-validation-'+sampleRate);
      const registry=new WamPluginRegistry();registry.catalogueUrl=new URL('../wamPlugins/plugins.json',import.meta.url).href;
      const entry=normalizeCatalogueEntry({uri:`./EndUserAmp${variant}/index.js`,category:'amplifier'},registry.catalogueUrl);
      const record=normalizeDescriptor(entry,await (await fetch(entry.descriptorUrl)).json());registry.records=[record];
      chain=new FxChain({context,registry,groupId});chain.reconnect();
      const a=await chain.insert(record);instances.push(a.plugin);
      check(!a.plugin._gui,'headless initialization '+sampleRate);
      const params=await a.plugin.audioNode.getParameterInfo();check(Object.keys(params).length===(variant===1?30:47),`${variant===1?30:47} WAM parameters `+sampleRate);
      const defaults=await a.plugin.audioNode.getState();
      const b=await registry.instantiate(record,{groupId,audioContext:context,state:{...defaults,[master]:.5}});instances.push(b);
      check(a.plugin.instanceId!==b.instanceId,'two unique instances '+sampleRate);
      check((await b.audioNode.getState())[master]===.5&&(await a.plugin.audioNode.getState())[master]===defaults[master],'initial state awaited and instance isolation '+sampleRate);
      await a.plugin.audioNode.setState({...defaults,[reverb]:0});
      const saved=await chain.getState();
      const splitter=context.createChannelSplitter(2),meters=[context.createAnalyser(),context.createAnalyser()],sink=context.createGain();sink.gain.value=0;
      chain.output.connect(splitter);meters.forEach((meter,index)=>{meter.fftSize=2048;splitter.connect(meter,index);meter.connect(sink);});sink.connect(context.destination);
      const merger=context.createChannelMerger(2),left=context.createGain(),right=context.createGain();left.gain.value=.001;right.gain.value=0;
      osc=context.createOscillator();osc.frequency.value=110;osc.connect(left).connect(merger,0,0);osc.connect(right).connect(merger,0,1);merger.connect(chain.input);osc.start();
      const l=await measure(meters);check(l.every(v=>v.peak>1e-7),'left-only source reaches both DSP outputs '+sampleRate);
      left.gain.value=0;right.gain.value=.001;const r=await measure(meters);
      check(r.every((v,i)=>Math.abs(v.rms-l[i].rms)/l[i].rms<.12),'right-only source has matching downmix '+sampleRate);
      left.gain.value=.001;const stereo=await measure(meters);check(stereo.every(v=>v.peak>0),'stereo input is finite '+sampleRate);
      await a.plugin.audioNode.setState({...defaults,[reverb]:0,[master]:0});
      const muted=await measure(meters);check(muted.every((v,i)=>v.rms<stereo[i].rms*.1),'master changes actual DSP output '+sampleRate);
      await chain.setState(saved);const restored=chain.entries[0];
      check((await restored.plugin.audioNode.getState())[master]===defaults[master],'chain state restored '+sampleRate);
      const active=await measure(meters);check(active.every(v=>v.peak>1e-7),'restored processing audible in measured samples '+sampleRate);
      await chain.setBypass(restored.id,true);const dry=await measure(meters);
      check(dry.every(v=>Math.abs(v.peak-.001)<.00002),'host bypass has one dry path '+sampleRate);
      await chain.setBypass(restored.id,false);
      osc.stop();merger.disconnect(chain.input);
      // A single impulse validates transient response without a loop or live capture.
      const impulse=context.createBufferSource();impulse.buffer=context.createBuffer(1,sampleRate,sampleRate);impulse.buffer.getChannelData(0)[0]=.01;
      impulse.connect(chain.input);impulse.start();const transient=await measure(meters);check(transient.every(v=>Number.isFinite(v.peak)),'impulse response finite '+sampleRate);
      const file=await fetch(new URL('../assets/audio/CleanGuitarRiff.mp3',import.meta.url));if(!file.ok)throw Error('DI test audio missing');
      const guitar=context.createBufferSource();guitar.buffer=await context.decodeAudioData(await file.arrayBuffer());guitar.loop=true;
      const trim=context.createGain();trim.gain.value=.05;guitar.connect(trim).connect(chain.input);guitar.start();await wait(600);
      const di=await measure(meters);check(di.some(v=>v.peak>1e-7),'DI guitar processed '+sampleRate);guitar.stop();guitar.disconnect();trim.disconnect();
      const beforeGui=await restored.plugin.audioNode.getState();
      const gui=await chain.getGui(restored.id),guiB=await b.createGui();document.querySelector('#editor').replaceChildren(gui,guiB);
      await wait(100);check(gui!==guiB&&gui.shadowRoot&&guiB.shadowRoot,'independent custom editors '+sampleRate);
      await wait(400);check(JSON.stringify(await restored.plugin.audioNode.getState())===JSON.stringify(beforeGui),'opening GUI preserves restored DSP state '+sampleRate);
      // Factory presets belong to each WAM, including selection and edited values.
      const amp = restored.plugin.audioNode;
      const otherState = JSON.stringify(await b.audioNode.getState());
      const menu = gui.shadowRoot.querySelector('#factory-preset');
      check(menu.options.length === 7, 'six factory choices plus custom state '+sampleRate);
      const presetTone=context.createOscillator(),presetTrim=context.createGain();
      presetTone.frequency.value=110;presetTrim.gain.value=.0005;presetTone.connect(presetTrim).connect(chain.input);presetTone.start();
      try {
        for (const preset of amp.getFactoryPresets()) {
          menu.value=preset.id;menu.dispatchEvent(new Event('change'));await wait(100);
          const signal=await measure(meters);
          check(amp.getFactoryPresetStatus().id===preset.id && !amp.getFactoryPresetStatus().modified && signal.every(v=>v.peak>1e-9), 'preset GUI and real DSP '+preset.name+' '+sampleRate);
        }
      } finally {presetTone.stop();presetTrim.disconnect();}
      await amp.loadFactoryPreset('clean');
      amp.setParamValue(master,.321);await wait(100);
      const edited=JSON.parse(JSON.stringify(await amp.getState()));
      check(amp.getFactoryPresetStatus().modified && gui.shadowRoot.querySelector('.factory-preset-status').textContent==='Modified','edited preset indicated '+sampleRate);
      await amp.loadFactoryPreset('crunch');await amp.setState(edited);await wait(100);
      check(menu.value==='clean' && amp.getFactoryPresetStatus().modified && Math.abs((await amp.getState())[master]-.321)<1e-5,'edited preset round trip restores exact controls and menu '+sampleRate);
      const clone=await registry.instantiate(record,{groupId,audioContext:context,state:edited});instances.push(clone);
      check(JSON.stringify(await clone.audioNode.getState())===JSON.stringify(edited),'initial state restores preset without GUI '+sampleRate);
      check(JSON.stringify(await b.audioNode.getState())===otherState,'presets do not affect other instance '+sampleRate);
      const legacy={...edited};delete legacy.__wamFactoryPreset;await amp.setState(legacy);await wait(100);
      check(menu.value==='' && Math.abs((await amp.getState())[master]-.321)<1e-5,'legacy flat state restores custom controls '+sampleRate);
      await amp.setState(edited);
      const nativeGet=restored.plugin.audioNode.getParameterValues.bind(restored.plugin.audioNode);let reads=0;
      restored.plugin.audioNode.getParameterValues=(...args)=>{reads++;return nativeGet(...args);};
      gui.setEditorVisible(false);await wait(60);const paused=reads;await wait(100);check(reads===paused&&!gui._running,'hidden editor stops polling '+sampleRate);
      gui.setEditorVisible(true);await wait(100);check(reads>paused&&gui._running,'editor polling resumes '+sampleRate);
      gui.remove();await wait(60);const detached=reads;await wait(100);check(reads===detached,'detached editor stops polling '+sampleRate);
      document.querySelector('#editor').append(gui);await wait(100);check(reads>detached,'reattached editor resumes '+sampleRate);
      const dsp=restored.plugin.audioNode._output;await chain.remove(restored.id);await wait(100);const deleted=reads;await wait(100);
      check(reads===deleted&&gui._destroyed&&!gui.isConnected,'remove destroys editor and stops polling '+sampleRate);
      measurements.push({sampleRate,left:l,right:r,stereo,active,dry,di});
    }finally{
      try{osc?.stop();}catch{}chain?.destroy();
      for(const plugin of instances)await plugin.audioNode.destroy();
      await wait(30);await context.close();document.querySelector('#editor').replaceChildren();
    }
  }
  check(errors.length===0,'no browser errors or unhandled rejections');
  results.textContent+='COMPLETE\n';return measurements;
  }finally{window.removeEventListener('error',onError);window.removeEventListener('unhandledrejection',onError);}
}
window.runIfcValidation=runIfcValidation;
document.querySelector('#run').onclick=async()=>{
  const button=document.querySelector('#run');button.disabled=true;
  try{await runIfcValidation({variant:Number(new URLSearchParams(location.search).get('variant'))||1});}catch(error){results.textContent+=`FAIL ${error.stack}\n`;}
  finally{button.disabled=false;}
};
