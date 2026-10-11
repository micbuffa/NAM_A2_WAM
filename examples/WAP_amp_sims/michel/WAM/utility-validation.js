import {initializeWamHost} from './shared/sdk.js';
const dist=new URL(location).searchParams.has('dist');
const {default:Utility}=await import(dist?'/dist/wasabi-amps/utility/index.js':'./utility/index.js');
const {UtilityNode}=await import(dist?'/dist/wasabi-amps/utility/Node.js':'./utility/Node.js');
const {default:DeathGate}=await import('../../../wam/wamPlugins/deathgate/index.js');
const results={date:new Date().toISOString(),dist,protocol:'Real-time synchronized source fed to all three active graphs, silent monitor plus difference recorders. Capture 0.65 s source + 0.15 s tail, 13 cases at 44100 and 48000 Hz; maximum error tolerance 1e-5, non-silence checked where expected. Original WAP in isolated iframe, GUI meter dependency stubbed; DSP unchanged.',checks:[],comparisons:[]};
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function check(name,pass){results.checks.push({name,pass:!!pass});$('results').textContent+=`${pass?'PASS':'FAIL'} ${name}\n`;if(!pass)throw Error(name);}
async function timeout(promise){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Lifecycle timed out')),2000))]);}
function refGraph(ctx,gate){
  const input=ctx.createGain(),split=ctx.createChannelSplitter(2),merge=ctx.createChannelMerger(2),gain=ctx.createGain();
  input.connect(split);merge.connect(gain);gain.connect(gate.audioNode);
  return {input,output:gate.audioNode,set(values){
    try{split.disconnect();}catch{};if(values.leftInput)split.connect(merge,0,0);if(values.rightInput)split.connect(merge,1,1);
    gain.gain.value=values.inputGain;gate.audioNode.setParamValue('/deathgate/NoiseGate',values.noiseGate);
  },destroy(){for(const node of [input,split,merge,gain])node.disconnect();}};
}
function signal(ctx,kind,bytes){
  if(kind==='guitar')return ctx.decodeAudioData(bytes.slice(0));
  const channels=kind==='mono'?1:2,buffer=ctx.createBuffer(channels,ctx.sampleRate*.65,ctx.sampleRate);
  let seed=47;
  for(let c=0;c<channels;c++)for(let i=0;i<buffer.length;i++){
    const t=i/ctx.sampleRate;
    seed=(Math.imul(seed,1664525)+1013904223)|0;
    let v=kind==='noise'?(seed/2147483648)*.0001:kind==='silence'?0:.04*Math.sin(2*Math.PI*220*t)+.01*Math.sin(2*Math.PI*880*t);
    if(kind==='right'&&c===0||kind==='left'&&c===1)v=0;if(kind==='opposite'&&c===1)v=-v;
    if(t>.45)v=0;buffer.getChannelData(c)[i]=v;
  }return Promise.resolve(buffer);
}
async function compare(ctx,a,b,buffer){
  const begin=ctx.currentTime+.12,end=begin+.8;
  const recorder=new AudioWorkletNode(ctx,'wap2-difference',{numberOfInputs:2,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{begin,end}});
  a.connect(recorder,0,0);b.connect(recorder,0,1);recorder.connect(ctx.destination);
  const source=ctx.createBufferSource();source.buffer=buffer;for(const input of currentInputs)source.connect(input);
  try{return await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Audio comparison timeout')),4000);
    recorder.port.onmessage=({data})=>{clearTimeout(timer);resolve(data);};source.start(begin,0,.65);
  });}finally{source.disconnect();a.disconnect(recorder);b.disconnect(recorder);recorder.disconnect();recorder.port.close();}
}
let currentInputs;
$('run').onclick=async()=>{
  $('run').disabled=true;
  try{
    const bytes=await (await fetch('../utility/GuitarRiffDry.mp3')).arrayBuffer();
    const frame=document.createElement('iframe');frame.src='utility-reference.html';await new Promise(resolve=>{frame.onload=resolve;document.body.append(frame);});
    for(const rate of [44100,48000]){
      const ctx=new AudioContext({sampleRate:rate});await ctx.resume();const [group]=await initializeWamHost(ctx);
      let utility,gate,original,graph;
      try{
        await ctx.audioWorklet.addModule(new URL('difference-processor.js',import.meta.url));
        utility=await Utility.createInstance(group,ctx);gate=await DeathGate.createInstance(group,ctx);
        check(`${rate} headless no GUI dependencies`,!utility._gui&&!gate._gui);
        original=await frame.contentWindow.createUtilityReference(ctx);graph=refGraph(ctx,gate);
        const silent=ctx.createGain();silent.gain.value=0;silent.connect(ctx.destination);
        for(const output of [original._output,graph.output,utility.audioNode])output.connect(silent);
        const initial=await utility.audioNode.getState();
        check(`${rate} defaults/dead zone`,initial.parameterValues.inputGain===1&&initial.parameterValues.noiseGate===-120&&initial.gateState['/deathgate/DeadZone']===-100);
        await utility.audioNode.setParameterValues({inputGain:{id:'inputGain',value:.5,normalized:true},noiseGate:{id:'noiseGate',value:.5,normalized:true}});
        check(`${rate} normalized API`,Math.abs(utility.audioNode.values.inputGain-1.005)<1e-5&&utility.audioNode.values.noiseGate===-60);
        await utility.audioNode.setState(initial);
        check(`${rate} state round trip`,JSON.stringify(initial)===JSON.stringify(await utility.audioNode.getState()));
        await utility.audioNode.setState({...initial,gateState:{...initial.gateState,'/deathgate/DeadZone':-70}});
        check(`${rate} hidden dead zone restoration`,utility.audioNode.gate.audioNode.getParamValue('/deathgate/DeadZone')===-70);
        await utility.audioNode.setState(initial);
        const pendingNode=new UtilityNode(new Utility(group,ctx));
        const pending=pendingNode.initialize().then(()=>false,()=>true);await pendingNode.destroy();
        check(`${rate} destroy during initialization`,await timeout(pending));
        const nativeFetch=globalThis.fetch;
        globalThis.fetch=(url,...args)=>String(url).endsWith('/deathgate.wasm')?Promise.reject(Error('Intentional failed WASM fetch')):nativeFetch(url,...args);
        let loadRejected=false;
        try{await Utility.createInstance(group,ctx);}catch{loadRejected=true;}finally{globalThis.fetch=nativeFetch;}
        check(`${rate} failed child load rejects`,loadRejected);
        const restored=await Utility.createInstance(group,ctx,{...initial,parameterValues:{...initial.parameterValues,inputGain:.7,leftInput:0}});
        check(`${rate} initialState applied`,restored.audioNode.values.inputGain===.7&&restored.audioNode.values.leftInput===0);
        const second=await Utility.createInstance(group,ctx);
        await second.audioNode.setParamValue('noiseGate',-24);
        check(`${rate} private child isolation`,second.audioNode.gate!==utility.audioNode.gate&&utility.audioNode.gate.audioNode.getParamValue('/deathgate/NoiseGate')===-120);
        await timeout(Promise.all([second.audioNode.destroy(),restored.audioNode.destroy()]));
        let rejected=false;try{await utility.audioNode.setState({...initial,parameterValues:{...initial.parameterValues,inputGain:10}});}catch{rejected=true;}
        check(`${rate} invalid state atomic`,rejected&&JSON.stringify(initial)===JSON.stringify(await utility.audioNode.getState()));
        utility.audioNode.scheduleEvents({type:'wam-automation',time:ctx.currentTime+.08,data:{id:'inputGain',value:.8,normalized:false}});
        await sleep(1200);check(`${rate} scheduled automation`,Math.abs(utility.audioNode.values.inputGain-.8)<1e-4);await utility.audioNode.setState(initial);
        utility.audioNode.scheduleEvents({type:'wam-automation',time:ctx.currentTime+.08,data:{id:'noiseGate',value:.75,normalized:true}});
        await sleep(300);
        check(`${rate} child threshold automation`,utility.audioNode.values.noiseGate===-30&&utility.audioNode.gate.audioNode.getParamValue('/deathgate/NoiseGate')===-30);
        await utility.audioNode.setState(initial);
        const cases=[
          ['mono',1,1,1,-120],['left',1,1,1,-120],['right',1,1,1,-120],['opposite',1,1,1,-120],
          ['mono',0,1,1,-120],['right',1,0,1,-120],['guitar',0,0,1,-120],
          ['guitar',1,1,.01,-120],['guitar',1,1,2,-120],['guitar',1,1,1,-48],
          ['noise',1,1,1,-60],['silence',1,1,1,-120],['guitar',1,1,1,0],
        ];
        for(const [kind,leftInput,rightInput,inputGain,noiseGate] of cases){
          const values={leftInput,rightInput,inputGain,noiseGate};await utility.audioNode.setState({...initial,parameterValues:values});
          original.setInputRoutes(!!leftInput,!!rightInput);original.inputGain=inputGain;original.noiseGate=noiseGate;graph.set(values);
          await sleep(80);const buffer=await signal(ctx,kind,bytes);
          for(const target of ['WAM-reference','original-WAP']){
            currentInputs=[original._input,graph.input,utility.audioNode];
            const measurement=await compare(ctx,target==='original-WAP'?original._output:graph.output,utility.audioNode,buffer);
            results.comparisons.push({rate,kind,...values,target,...measurement});
            const audible=noiseGate===-120&&kind!=='silence'&&kind!=='opposite'&&((kind==='mono'||kind==='left')?leftInput:kind==='right'?rightInput:leftInput||rightInput);
            check(`${rate} ${target} ${kind} L${leftInput}R${rightInput} gain${inputGain} gate${noiseGate} max=${measurement.maxError.toExponential(3)}`,measurement.finite&&measurement.maxError<1e-5&&(!audible||measurement.rms>1e-8));
          }
        }
        const gui=await utility.createGui();$('mount').append(gui);await sleep(100);
        check(`${rate} font and geometry`,document.fonts.check('17px wap2-utility-metalfont')&&gui.getBoundingClientRect().width===232);
        gui.shadowRoot.getElementById('leftInput').click();await sleep(70);check(`${rate} GUI L/R`,utility.audioNode.values.leftInput===0);
        const saved=await utility.audioNode.getState();gui.remove();check(`${rate} meter taps released`,!gui.taps);
        $('mount').append(gui);await sleep(70);check(`${rate} reopen preserves state`,JSON.stringify(saved)===JSON.stringify(await utility.audioNode.getState()));
        utility.destroyGui(gui);check(`${rate} GUI cleanup`,!gui.taps&&gui.abort.signal.aborted);
        const childGui=await gate.createGui();document.body.append(childGui);gate.destroyGui?.(childGui);childGui.remove();check(`${rate} standalone DeathGate GUI`,!!childGui.shadowRoot);
        await timeout(utility.audioNode.destroy());await timeout(utility.audioNode.destroy());check(`${rate} awaited idempotent destroy`,true);
        const recreated=await Utility.createInstance(group,ctx);await timeout(recreated.audioNode.destroy());check(`${rate} recreate after destroy`,true);
      }finally{
        graph?.destroy();original?._input.disconnect();original?.deadgateFaust.disconnect();original?.deadgateFaust.destroy?.();
        await timeout(Promise.all([utility?.audioNode.destroy(),gate?.audioNode.destroy()]));await ctx.close();
      }
    }
    frame.remove();$('status').textContent=`PASS: ${results.checks.length} checks, ${results.comparisons.length} audio comparisons`;
  }catch(error){results.error=error.stack;$('status').textContent='FAIL: '+error.message;console.error(error);}
  finally{$('download').disabled=false;}
};
$('download').onclick=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(results,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=dist?'UTILITY_VALIDATION_DIST.json':'UTILITY_VALIDATION.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
