const distributed=new URLSearchParams(location.search).has('dist');
const root=new URL(distributed?'../../../dist/NAM_A2_WAM/':'../../../examples/wam/',import.meta.url);
const {OfflinePresetRenderer}=await import(new URL('projects/OfflinePresetRenderer.js',root));
const {createOfflinePresetRack}=await import(new URL('projects/OfflinePresetRack.js',root));
const {WamPluginRegistry,destroyPluginInstance}=await import(new URL('WamPluginRegistry.js',root));
const {default:initializeWamHost}=await import(new URL(distributed?'third_party/wam-examples/packages/sdk/src/initializeWamHost.js':'../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js',root));
const {StudioMixExporter,renderRecordedMix}=await import(new URL('projects/StudioMixExporter.js',root));
const report=document.querySelector('#result'),check=(ok,message)=>{if(!ok)throw Error(message);};
document.querySelector('#run').onclick=async()=>{
 document.querySelector('#run').disabled=true;
 try{
  report.textContent='Preparing real NAM and cabinet snapshots…';
  const registry=new WamPluginRegistry();await registry.load(new URL('wamPlugins/plugins.json',root));
  const context=new OfflineAudioContext(2,48000,48000),[groupId]=await initializeWamHost(context);
  const entries=[];
  for(const kind of ['nam','cabinet']){
   const record=registry.records.find(r=>r.role===kind),plugin=await registry.instantiate(record,{groupId,audioContext:context});
   const state=await plugin.audioNode.getState();if(kind==='cabinet')state.routingMode='on';entries.push({id:kind,kind,pluginUri:record.catalogue.uri,bypass:false,inputDb:0,outputDb:0,state});destroyPluginInstance(plugin);
  }
  const state={version:2,a:{version:1,entries},b:null,visible:false,route:null,mutedA:false,enabledB:false,inputDbB:0,outputDbA:0,outputDbB:0,panA:0,panB:0,sourceTrim:{live:0,file:-18}};
  const track={id:1,name:'Synthetic guitar',origin:'personal',instrument:'guitar',presetSnapshot:state,snapshotId:'test',volume:80,pan:0,mute:false,solo:false,audio:{checksum:'DI'}};
  const di=context.createBuffer(1,48000,48000);for(let i=0;i<24000;i++)di.getChannelData(0)[i]=.03*Math.sin(i*2*Math.PI*220/48000);
  const channels=new Map([[1,{buffer:di}]]),rates=[];let lastIrRate;
  const renderer=new OfflinePresetRenderer({resolveSound:async t=>({state:t.presetSnapshot,provenance:{snapshotId:t.snapshotId}}),createContext:(frames,rate)=>{rates.push(rate);return new OfflineAudioContext(2,frames,rate);},createRack:(c,s,o)=>{lastIrRate=s.a.entries.find(e=>e.kind==='cabinet')?.state.ir?.sampleRate;return createOfflinePresetRack(c,s,{registry,...o});}});
  const rendered=await renderer.render({tracks:[track],channels,range:{start:0,end:1},sampleRate:44100,tailSeconds:.5,onProgress:text=>report.textContent=text});
  check(rendered.buffer.sampleRate===48000&&rendered.buffer.length===72000,'NAM export did not retain48kHz and requested tail');check(rates.every(r=>r===48000),'Unexpected resampling on48kHz NAM path');
  const max=data=>data.reduce((v,x)=>Math.max(v,Math.abs(x)),0),wetPeak=max(rendered.buffer.getChannelData(0));check(wetPeak>.001,'Processed output is silent');
  // Independently build the ordinary playback rack through TrackTones' modules,
  // in another offline context, rather than using the export rack factory.
  const {FxChain}=await import(new URL('FxChain.js',root)),{FxRack}=await import(new URL('FxRack.js',root)),{TrackSource}=await import(new URL('projects/TrackTones.js',root));
  async function referenceRender(saved,frames){
    const referenceContext=new OfflineAudioContext(2,frames,48000),[referenceGroup]=await initializeWamHost(referenceContext);
    const lane=new FxChain({context:referenceContext,registry,groupId:referenceGroup});
    const referenceRack=new FxRack({context:referenceContext,a:lane,source:new TrackSource(),createLane:async()=>new FxChain({context:referenceContext,registry,groupId:referenceGroup})});
    try{
      await referenceRack.setState(saved);for(const current of [lane,referenceRack.b].filter(Boolean))for(const entry of current.entries)if(entry.kind==='nam')await entry.plugin.audioNode.setModelVariant('lite');
      const source=referenceContext.createBufferSource();source.buffer=di;source.connect(lane.input);const zero=referenceContext.createConstantSource();zero.offset.value=0;zero.connect(lane.input);zero.start();referenceRack.output.connect(referenceContext.destination);source.start();
      return await referenceContext.startRendering();
    }finally{referenceRack.destroy();}
  }
  const reference=await referenceRender(state,72000);let error=0;for(let c=0;c<2;c++)for(let i=2048;i<72000;i++)error=Math.max(error,Math.abs(reference.getChannelData(c)[i]-rendered.buffer.getChannelData(c)[i]));check(error<1e-5,`Playback rack/export disagree: ${error}`);
  const dualState=structuredClone(state);dualState.b={version:1,entries:[{...structuredClone(entries[1]),id:'b-cabinet'}]};Object.assign(dualState,{visible:true,enabledB:true,route:{id:'junction',index:1},panA:-.3,panB:.4,outputDbA:-3,outputDbB:-6});
  const dual=await renderer.render({tracks:[{...track,presetSnapshot:dualState}],channels,range:{start:0,end:1},sampleRate:48000,tailSeconds:0});
  const dualReference=await referenceRender(dualState,48000);let dualError=0;for(let c=0;c<2;c++)for(let i=8192;i<48000;i++)dualError=Math.max(dualError,Math.abs(dual.buffer.getChannelData(c)[i]-dualReference.getChannelData(c)[i]));check(dualError<1e-5,`Routed dual rack/export disagree: ${dualError}`);
  const loop=await renderer.render({tracks:[track],channels,range:{start:.25,end:.75},selection:'loop',sampleRate:44100,tailSeconds:2});check(loop.buffer.length===24000&&loop.render.tailSeconds===0,'Loop length changed');
  let loopError=0;for(let c=0;c<2;c++)for(let i=0;i<loop.buffer.length;i++)loopError=Math.max(loopError,Math.abs(loop.buffer.getChannelData(c)[i]-rendered.buffer.getChannelData(c)[i+12000]));check(loopError<1e-6,'A/B preroll differs from full render');
  // A dry48kHz source exported at48kHz should never be sent through44.1kHz.
  const dry=await renderRecordedMix({tracks:[{...track,presetSnapshot:null,snapshotId:null}],channels,range:{start:0,end:1},sampleRate:48000});check(dry.sampleRate===48000&&dry.length===48000,'Dry export changed clock');
  const exporter=new StudioMixExporter({api:{}}),encoded=await exporter.encode(rendered.buffer),bytes=new Uint8Array(await encoded.blob.arrayBuffer());check([44100,48000,32000][(bytes[2]>>2)&3]===48000,'MP3 header rate mismatch');
  const decoded=await new OfflineAudioContext(2,1,48000).decodeAudioData(await encoded.blob.arrayBuffer());check(Math.abs(decoded.duration-1.5)<.1&&max(decoded.getChannelData(0))>.001,'MP3 duration/pitch clock mismatch');
  // Controlled native GainNodes isolate rate adaptation from model quality:
  // two declared model clocks,44.1/48kHz, mixed into the48kHz host clock.
  const mixedRates=[];const rateTracks=[44100,48000].map((rate,i)=>({...track,id:i+10,presetSnapshot:{version:2,a:{entries:[{kind:'nam',state:{model:{data:JSON.stringify({sample_rate:rate})}}}]}},volume:60}));
  const mixedChannels=new Map(rateTracks.map(t=>[t.id,{buffer:di}]));
  const mixedRenderer=new OfflinePresetRenderer({resolveSound:async t=>({state:t.presetSnapshot}),createContext:(frames,rate)=>{mixedRates.push(rate);return new OfflineAudioContext(2,frames,rate);},createRack:async c=>{const node=c.createGain();return{input:node,output:node,assertHealthy(){},destroy(){node.disconnect();}};}});
  const mixed=await mixedRenderer.render({tracks:rateTracks,channels:mixedChannels,range:{start:0,end:1},sampleRate:48000,tailSeconds:0});
  check(mixed.buffer.sampleRate===48000&&mixed.buffer.length===48000&&mixedRates.includes(44100),'Mixed-rate clocks ignored');
  let mixedError=0;for(let i=500;i<23500;i++)mixedError=Math.max(mixedError,Math.abs(mixed.buffer.getChannelData(0)[i]-di.getChannelData(0)[i]*2*10**(-6/20)*Math.SQRT1_2));check(mixedError<.001,`Mixed-rate gain/pitch/duration changed: ${mixedError}`);
  const delayRecord=registry.records.find(r=>r.entryUrl.includes('faustPingPongDelay'));
  const delay=await registry.instantiate(delayRecord,{groupId,audioContext:context}),delayState=await delay.audioNode.getState();destroyPluginInstance(delay);
  const delayTrack={...track,id:8,presetSnapshot:{...state,a:{version:1,entries:[{id:'delay',kind:'effect',pluginUri:delayRecord.catalogue.uri,inputDb:0,outputDb:0,bypass:false,state:delayState}]}}};
  const delayResult=await renderer.render({tracks:[delayTrack],channels:new Map([[8,{buffer:di}]]),range:{start:0,end:1},sampleRate:48000,tailSeconds:1});
  const delayTail=max(delayResult.buffer.getChannelData(0).subarray(48000));check(delayTail>.00001,`Effect tail was discarded: peak=${max(delayResult.buffer.getChannelData(0))}, tail=${delayTail}, state=${JSON.stringify(delayState)}`);
  const ir44State=structuredClone(state),ir44=ir44State.a.entries.find(e=>e.kind==='cabinet').state.ir;
  ir44.samples=Array.from({length:441},(_,i)=>i===0?1:0);ir44.sampleRate=44100;
  const irAdapted=await renderer.render({tracks:[{...track,presetSnapshot:ir44State}],channels,range:{start:0,end:1},sampleRate:44100,tailSeconds:0});
  check(lastIrRate===48000&&ir44.sampleRate===44100&&ir44.samples.length===441,'Cabinet IR clock was not adapted independently');check(max(irAdapted.buffer.getChannelData(0))>.0001,'Adapted IR is silent');
  const legacy=structuredClone(state);delete legacy.a.entries.find(e=>e.kind==='cabinet').state.ir.sampleRate;
  await renderer.render({tracks:[{...track,presetSnapshot:legacy}],channels,range:{start:0,end:1},sampleRate:44100,tailSeconds:0}).then(()=>{throw Error('Unknown legacy IR frequency guessed');},error=>check(error.message.includes('older cabinet'),'Wrong legacy IR error'));
  let cleaned=0;const cancelled=new OfflinePresetRenderer({resolveSound:async()=>({state}),createRack:async()=>({input:context.createGain(),output:context.createGain(),destroy(){cleaned++;}})});let calls=0;await cancelled.render({tracks:[track],channels,range:{start:0,end:1},check:()=>{if(++calls>3)throw new DOMException('test','AbortError');}}).then(()=>{throw Error('Cancellation ignored');},error=>check(error.name==='AbortError','Wrong cancellation'));check(cleaned===1,'Cancelled rack leaked');
  report.textContent=JSON.stringify({status:'PASS',outputRate:rendered.buffer.sampleRate,frames:rendered.buffer.length,sourceUnchanged:di.length===48000,contextRates:rates,wetPeak,playbackRackMaxError:error,routedDualRackMaxError:dualError,loopPrerollMaxError:loopError,mp3Rate:encoded.sampleRate,mp3Duration:decoded.duration,mp3Bytes:encoded.blob.size,cancelledRackReleased:cleaned===1,mixedRateContexts:mixedRates,mixedRateMaxError:mixedError,delayTailPeak:delayTail,cabinetIrAdapted:lastIrRate===48000},null,2);
 }catch(error){report.textContent=`FAIL ${error.stack}`;}finally{document.querySelector('#run').disabled=false;}
};
