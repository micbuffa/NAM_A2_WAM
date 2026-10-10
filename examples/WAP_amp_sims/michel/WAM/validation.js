import {initializeWamHost} from './shared/sdk.js';
import {defaults} from './shared/plugin.js';
const allSlugs=['blues','cleanfull','modernmetal'];
const filter=new URL(location).searchParams.get('amp');
const slugs=allSlugs.includes(filter)?[filter]:allSlugs;
const $=id=>document.getElementById(id);
const results={protocol:'Native WAP/WAM DSP parity; original WAP scripts in isolated same-origin realms. Full WAM API tests run separately in real AudioContexts.',comparisons:[],checks:[],referenceFixes:[],fullGraphComparisons:[]};
function log(message){$('results').textContent+=message+'\n';}
function check(name,condition){results.checks.push({name,pass:!!condition});if(!condition)throw Error(name);log('PASS '+name);}
async function reference(slug){
  const frame=document.createElement('iframe');frame.src=`reference.html?amp=${slug}`;
  await new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=reject;document.body.append(frame);});
  await frame.contentWindow.referenceReady;return frame;
}
function compare(a,b){
  let squares=0,diffSquares=0,peak=0,maxError=0,finite=true;
  for(let c=0;c<2;c++){
    const left=a.getChannelData(c),right=b.getChannelData(c);
    for(let i=0;i<left.length;i++){
      const error=left[i]-right[i];finite&&=Number.isFinite(left[i])&&Number.isFinite(right[i]);
      squares+=left[i]**2;diffSquares+=error**2;peak=Math.max(peak,Math.abs(left[i]));maxError=Math.max(maxError,Math.abs(error));
    }
  }
  return {finite,rms:Math.sqrt(squares/(a.length*2)),peak,maxError,relativeError:Math.sqrt(diffSquares/Math.max(squares,1e-30))};
}
function source(context,buffer){const node=context.createBufferSource();node.buffer=buffer;return node;}
async function render(frame,Engine,slug,index,rate,bytes){
  const length=Math.ceil(rate*4);
  const originalContext=new OfflineAudioContext(2,length,rate),wamContext=new OfflineAudioContext(2,length,rate);
  const original=await frame.contentWindow.createReference(originalContext,index,defaults[slug]);
  const engine=new Engine(wamContext,new URL(`./${slug}/`,import.meta.url).href);
  await engine.ready();await engine.applyPreset(engine.presets()[defaults[slug]]);
  await engine.applyPreset(engine.presets()[index]);engine.status='enable';
  for(const [ctx,input] of [[originalContext,original.engine._input],[wamContext,engine._input]]){
    const buffer=await ctx.decodeAudioData(bytes.slice(0));const node=source(ctx,buffer);const trim=ctx.createGain();trim.gain.value=10**(-18/20);node.connect(trim);trim.connect(input);node.start(1.1,0,2);
  }
  original.engine._output.connect(originalContext.destination);engine._output.connect(wamContext.destination);
  const rendered=await Promise.all([originalContext.startRendering(),wamContext.startRendering()]);
  const measurement=compare(...rendered);
  if(measurement.maxError>1e-6){
    const describe=nodes=>[...nodes].map(node=>{
      const o={kind:node.constructor.name};
      for(const key of ['type','oversample'])if(key in node)o[key]=node[key];
      for(const key of ['gain','frequency','Q','delayTime'])if(key in node)o[key]=node[key].value;
      if(node.curve)o.curve=[node.curve.length,...[0,1,100,11025,22050,30000].map(i=>node.curve[i])];
      if(node.buffer)o.buffer=[node.buffer.length,node.buffer.numberOfChannels];
      return o;
    });
    const a=describe(original.nodes),b=describe(engine.context.resources.nodes);
    measurement.nodeDifferences=a.map((v,i)=>JSON.stringify(v)===JSON.stringify(b[i])?null:{index:i,wap:v,wam:b[i]}).filter(Boolean);
    log(JSON.stringify(measurement.nodeDifferences));
  }
  original.destroy();engine.destroy();return measurement;
}
async function compareFullGraph(context,group,slug,Plugin,bytes){
  const frame=await reference(slug);let plugin,original,recorder,input;
  try{
    plugin=await Plugin.createInstance(group,context);
    original=await frame.contentWindow.createReference(context,defaults[slug],defaults[slug]);
    const buffer=await context.decodeAudioData(bytes.slice(0));
    const begin=context.currentTime+2;
    recorder=new AudioWorkletNode(context,'wap2-difference',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{begin,end:begin+1}});
    original.engine._output.connect(recorder,0,0);plugin.audioNode.connect(recorder,0,1);recorder.connect(context.destination);
    input=source(context,buffer);const trim=context.createGain();trim.gain.value=10**(-18/20);input.connect(trim);trim.connect(original.engine._input);trim.connect(plugin.audioNode);
    const measurement=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('Full graph comparison timed out')),8000);
      recorder.port.onmessage=({data})=>{clearTimeout(timeout);resolve(data);};input.start(begin,0,1);
    });
    trim.disconnect();const pass=measurement.finite&&measurement.rms>1e-9&&measurement.maxError<1e-5;
    results.fullGraphComparisons.push({slug,rate:context.sampleRate,...measurement,pass});
    check(`${slug}/${context.sampleRate} full WAM vs original WAP audio (max ${measurement.maxError.toExponential(3)})`,pass);
  }finally{input?.disconnect();recorder?.disconnect();recorder?.port.close();original?.destroy();await plugin?.audioNode.destroy();frame.remove();}
}
async function fullWamChecks(rate,bytes){
  const context=new AudioContext({sampleRate:rate});await context.resume();const [group]=await initializeWamHost(context);
  try{
    await context.audioWorklet.addModule(new URL('difference-processor.js',import.meta.url));
    for(const slug of slugs){
      const {default:Plugin}=await import(`./${slug}/index.js`);
      await compareFullGraph(context,group,slug,Plugin,bytes);
      const a=await Plugin.createInstance(group,context);
      let b;
      try{
        const originalState=await a.audioNode.getState();
        for(const preset of a.audioNode.getFactoryPresets()){
          await a.audioNode.loadFactoryPreset(preset.id);
          await new Promise(r=>setTimeout(r,60));
          const state=await a.audioNode.getState(),values=await a.audioNode.getParameterValues(false);
          check(`${slug}/${rate} factory preset ${preset.id} manager/DSP values`,Object.keys(state.parameterValues).every(id=>Math.abs(values[id].value-state.parameterValues[id])<.0001));
        }
        await a.audioNode.setState(originalState);
        const info=await a.audioNode.getParameterInfo();check(`${slug}/${rate} WAM parameters`,Object.keys(info).length>=16);
        await a.audioNode.setParameterValues({master:{id:'master',value:.63,normalized:true}});
        const snapshot=await a.audioNode.getState();
        b=await Plugin.createInstance(group,context,snapshot);
        check(`${slug}/${rate} createInstance initial state`,JSON.stringify(await b.audioNode.getState())===JSON.stringify(snapshot));
        await a.audioNode.loadFactoryPreset('factory-0');await a.audioNode.setState(snapshot);
        check(`${slug}/${rate} modified preset round trip`,JSON.stringify(await a.audioNode.getState())===JSON.stringify(snapshot));
        const before=await a.audioNode.getState();const gui=await a.createGui();$('editors').append(gui);await new Promise(r=>setTimeout(r,50));gui.remove();$('editors').append(gui);await new Promise(r=>setTimeout(r,50));
        check(`${slug}/${rate} GUI attach/reopen preserves state`,JSON.stringify(await a.audioNode.getState())===JSON.stringify(before));
        a.destroyGui(gui);check(`${slug}/${rate} GUI recreated`,(await a.createGui())!==gui);
        await a.audioNode.setParamValue('master',2);
        check(`${slug}/${rate} instance isolation`,b.audioNode.values.master===snapshot.parameterValues.master);
        a.audioNode.scheduleEvents({type:'wam-automation',time:context.currentTime+.05,data:{id:'master',value:.27,normalized:true}});
        await new Promise(r=>setTimeout(r,200));
        check(`${slug}/${rate} WAM scheduled automation`,Math.abs(a.audioNode.engine.params.master-2.7)<.001);
        const analyser=context.createAnalyser();const silent=context.createGain();silent.gain.value=0;
        a.audioNode.connect(analyser);analyser.connect(silent);silent.connect(context.destination);
        const oscillator=context.createOscillator();const trim=context.createGain();trim.gain.value=.015;oscillator.connect(trim);trim.connect(a.audioNode);oscillator.start();
        await new Promise(r=>setTimeout(r,1300));const signal=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(signal);
        check(`${slug}/${rate} full WAM finite non-silent audio`,signal.every(Number.isFinite)&&signal.some(v=>Math.abs(v)>1e-7));oscillator.stop();oscillator.disconnect();trim.disconnect();analyser.disconnect();silent.disconnect();
        const saved=await a.audioNode.getState();await a.audioNode.setParamValue('bypass',1);check(`${slug}/${rate} bypass`,a.audioNode.engine.params.status==='disable');await a.audioNode.setState(saved);
        const bad=structuredClone(saved);bad.parameterValues.master=NaN;let rejected=false;try{await a.audioNode.setState(bad);}catch{rejected=true;}check(`${slug}/${rate} reject invalid state`,rejected);
      }finally{await a.audioNode.destroy();await b?.audioNode.destroy();await a.audioNode.destroy();}
      check(`${slug}/${rate} destroyed`,a.audioNode.engine.context.resources.nodes.size===0);
    }
  }finally{await context.close();}
}
$('run').onclick=async()=>{
  $('run').disabled=true;$('results').textContent='';results.comparisons=[];results.checks=[];results.referenceFixes=[];results.fullGraphComparisons=[];
  const started=performance.now();
  try{
    const bytes=await(await fetch('../utility/GuitarRiffDry.mp3')).arrayBuffer();
    for(const slug of (new URL(location).searchParams.get('mode')==='api'?[]:slugs)){
      const frame=await reference(slug);const {default:Engine}=await import(`./${slug}/Engine.js`);
      try{
        for(const rate of [44100,48000]){
          const probe=new Engine(new OfflineAudioContext(2,128,rate),new URL(`./${slug}/`,import.meta.url).href);await probe.ready();const count=probe.presets().length;probe.destroy();
          for(let index=0;index<count;index++){
            $('status').textContent=`Comparing ${slug}, ${rate} Hz, preset ${index+1}/${count}…`;
            const m=await render(frame,Engine,slug,index,rate,bytes);const pass=m.finite&&m.rms>1e-9&&m.maxError<1e-6;
            results.comparisons.push({slug,rate,index,...m,pass});log(`${pass?'PASS':'FAIL'} ${slug}/${rate}/${index}: max error ${m.maxError.toExponential(3)}, relative ${m.relativeError.toExponential(3)}`);
            if(!pass)throw Error(`Audio mismatch ${slug}/${rate}/${index}`);
          }
        }
      }finally{results.referenceFixes.push(...frame.contentWindow.referenceFixes);frame.remove();}
    }
    for(const rate of [44100,48000]){ $('status').textContent=`Checking full WAM instances at ${rate} Hz…`;await fullWamChecks(rate,bytes); }
    results.pass=true;$('status').textContent=`Passed: ${results.comparisons.length} audio comparisons and ${results.checks.length} WAM checks.`;
  }catch(error){console.error(error);results.pass=false;results.error=error.stack;$('status').textContent='FAILED: '+error.message;log(error.stack);}
  finally{results.elapsedSeconds=(performance.now()-started)/1000;results.date=new Date().toISOString();$('download').disabled=false;$('run').disabled=false;}
};
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(results,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='VALIDATION.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
