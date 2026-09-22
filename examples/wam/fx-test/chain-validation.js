import initializeWamHost from '../../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js';
import NamPlugin from '../../../src/nam-wam/index.js';
import CabinetPlugin from '../../../src/cabinet-wam/index.js';
import {FxChain} from '../FxChain.js';
import {WamPluginRegistry} from '../WamPluginRegistry.js';
const output=document.querySelector('#results');
const log=text=>{output.textContent+=`${text}\n`;};
const check=(condition,text)=>{if(!condition)throw Error(text);log(`PASS ${text}`);};
document.querySelector('#run').onclick=async()=>{
  output.textContent='';document.querySelector('#run').disabled=true;
  let context,chain,nam2,cab2;
  try{
    context=new AudioContext({sampleRate:48000});await context.resume();
    const [groupId]=await initializeWamHost(context,'chain-validation');
    const nam=await NamPlugin.createInstance(groupId,context),cab=await CabinetPlugin.createInstance(groupId,context);
    check(!nam._guiPromise&&!cab._guiPromise,'no GUI created at startup');
    const ns=await nam.audioNode.getState(),cs=await cab.audioNode.getState();
    check(Boolean(ns.model?.data&&cs.ir?.samples.length),'defaults loaded headlessly');
    nam2=await NamPlugin.createInstance(groupId,context,ns);cab2=await CabinetPlugin.createInstance(groupId,context,cs);
    await nam2.audioNode.setParameterValues({outputGain:{id:'outputGain',value:-9,normalized:false}});
    await cab2.audioNode.setIrTrimDb(-4);
    check((await nam.audioNode.getParameterValues(false,'outputGain')).outputGain.value!==-9,'NAM states isolated');
    check((await cab.audioNode.getParameterValues(false,'irTrim')).irTrim.value!==-4,'Cabinet states isolated');
    const registry=new WamPluginRegistry();await registry.load(new URL('../wamPlugins/plugins.json',import.meta.url));
    chain=new FxChain({context,registry,groupId});await chain.initialize(nam,cab);
    check((await cab.audioNode.getParameterValues(false,'bypass')).bypass.value===1,'headless AUTO bypass');
    const record=registry.records.find(r=>r.category==='modulation');
    const a=await chain.insert(record),b=await chain.insert(record);
    check(a.plugin.instanceId!==b.plugin.instanceId,'unique WAM runtime instance IDs');
    const info=await a.plugin.audioNode.getParameterInfo();
    const parameter=Object.values(info).find(p=>p.minValue<p.maxValue&&p.id.toLowerCase().includes('depth'))||Object.values(info).find(p=>p.minValue<p.maxValue);
    const id=parameter.id,lo=parameter.minValue,hi=parameter.maxValue;
    await a.plugin.audioNode.setParameterValues({[id]:{id,value:lo,normalized:false}});
    await b.plugin.audioNode.setParameterValues({[id]:{id,value:hi,normalized:false}});
    const snapshot=await chain.getState();await chain.setState(snapshot);
    check((await chain.find(a.id).plugin.audioNode.getParameterValues(false,id))[id].value===lo,'first effect restored independently');
    check((await chain.find(b.id).plugin.audioNode.getParameterValues(false,id))[id].value===hi,'second effect restored independently');
    const analyser=context.createAnalyser(),silent=context.createGain();silent.gain.value=0;
    chain.output.connect(analyser).connect(silent).connect(context.destination);
    const oscillator=context.createOscillator(),gain=context.createGain();gain.gain.value=.015;oscillator.frequency.value=220;oscillator.connect(gain).connect(chain.input);oscillator.start();
    await new Promise(r=>setTimeout(r,600));const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);
    const peak=Math.max(...samples.map(Math.abs));check(Number.isFinite(peak)&&peak>1e-7,`real headless DSP produces audio (peak ${peak.toFixed(5)})`);
    await chain.setBypass('cabinet',false);await new Promise(r=>setTimeout(r,250));analyser.getFloatTimeDomainData(samples);
    check(samples.every(Number.isFinite)&&Math.max(...samples.map(Math.abs))>1e-7,'Cabinet convolution produces audio headlessly');
    await chain.remove(a.id);await chain.remove(b.id);
    for(const effect of registry.records.filter(r=>r.role!=='tuner')){
      const inserted=await chain.insert(effect);await new Promise(r=>setTimeout(r,200));analyser.getFloatTimeDomainData(samples);
      check(samples.every(Number.isFinite)&&Math.max(...samples.map(Math.abs))>1e-7,`${effect.name}: headless audio`);
      const stateBefore=JSON.stringify(await inserted.plugin.audioNode.getState());
      const gui=await chain.getGui(inserted.id);document.querySelector('#editors').append(gui);
      check(gui===await chain.getGui(inserted.id),`${effect.name}: reusable editor`);
      check(JSON.stringify(await inserted.plugin.audioNode.getState())===stateBefore,`${effect.name}: GUI preserves state`);
      await chain.remove(inserted.id);
    }
    const before=JSON.stringify(await nam.audioNode.getState());const g1=await chain.getGui('nam');document.querySelector('#editors').append(g1);const g2=await chain.getGui('nam');
    check(g1===g2,'editor cached per instance');check(before===JSON.stringify(await nam.audioNode.getState()),'first GUI opening does not mutate state');
    const cbefore=JSON.stringify(await cab.audioNode.getState());document.querySelector('#editors').append(await chain.getGui('cabinet'));
    check(cbefore===JSON.stringify(await cab.audioNode.getState()),'Cabinet GUI does not mutate state');
    oscillator.stop();
    log('COMPLETE');
  }catch(error){log(`FAIL ${error.stack||error}`);}
  finally{chain?.destroy();nam2?.audioNode.destroy();cab2?.audioNode.destroy();await context?.close();document.querySelector('#run').disabled=false;}
};
