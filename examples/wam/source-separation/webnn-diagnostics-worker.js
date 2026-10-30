import {loadDirectWebNNModel,createDirectWebNNSession,DirectAudioTensor,describeDirectWebNNFailure} from './DirectWebNN.js';
import {EXPERIMENT_MODELS,ExperimentTimings,experimentPlan,experimentSummary,sha256} from './WebNNExperiment.js';
import {webnnContextOptions} from './WebNNDevice.js';
import {withWebnnContext} from './WebNNBenchmark.js';
import {OnnxCoreModel} from './OnnxCoreModel.js';
import {RoformerCoreModel} from './RoformerCoreModel.js';
import {separateTracks} from './vendor/demucs-js/apply.js';
import {planChunks,OverlapAssembler} from './ChunkTools.js';
import {createCooperativeRoformerSession} from './CooperativeOnnxSession.js';
import {compareAudio} from './AudioComparison.js';

postMessage({type:'ready',timeOrigin:performance.timeOrigin,atMs:performance.now()});
self.onmessage=async({data})=>{
 const config=data.config,timings=new ExperimentTimings(),start=performance.now(),NativeBuilder=self.MLGraphBuilder;
 let session,context,device,first,phase='validate',trialIndex=-1;
 const record={config,status:'running',phases:{},trials:[],warmups:[],effectiveHardware:'unknown',wasmFallbackCoverage:'unknown',warnings:[],workerTimeOrigin:performance.timeOrigin,receivedEpochMs:performance.timeOrigin+start,features:{secureContext:self.isSecureContext,crossOriginIsolated:self.crossOriginIsolated,ml:!!navigator.ml,MLGraphBuilder:typeof NativeBuilder==='function',webgpu:!!navigator.gpu},timingSemantics:'Nested wall spans; dispatch is CPU submission, readTensor includes waiting. Never sum nested spans as device time.'};
 const send=()=>postMessage({type:'checkpoint',record:{...record,trace:undefined}});
 timings.onEntry=entry=>{if(entry.name==='webnn.build'){record.apiCounts={...timings.counts};record.apiTotalsMs={...timings.totals};record.nativeCheckpointTrace=timings.entries.slice(-64);send();}};
 const enter=name=>{phase=name;record.phase=name;performance.mark(`webnnlab:${config.id}:${name}`);postMessage({type:'progress',text:name});};
 const measure=async(name,fn)=>{enter(name);const t=performance.now();try{return await timings.measure(name,fn);}finally{record.phases[name]=performance.now()-t;send();}};
 const warning=console.warn;console.warn=(...args)=>{if(record.warnings.length<30)record.warnings.push(args.map(String).join(' ').slice(0,1000));warning(...args);};
 try{
  experimentPlan({models:[config.model],backends:[config.backend],sessions:config.session,trials:config.trials,warmups:config.warmups,threads:config.threads,gpuStrategy:config.gpuStrategy,timeoutSeconds:config.timeoutSeconds,webnnImplementation:config.webnnImplementation??'onnxruntime'});
  if(data.channels?.length!==2||data.channels.some(c=>!(c instanceof Float32Array)||c.length!==data.channels[0].length||c.length<44100||c.length>44100*30||!c.every(Number.isFinite)))throw Error('Expected 1–30 seconds of finite stereo PCM at 44100 Hz.');
  record.frames=data.channels[0].length;record.sampleRate=44100;
  if(config.backend.startsWith('webnn-')&&(!navigator.ml||typeof NativeBuilder!=='function')){record.status='unsupported';throw Error('WebNN is unavailable in this Worker. Check the experimental browser build and secure context. No WASM replacement was run.');}
  if(config.backend==='webgpu'&&!navigator.gpu){record.status='unsupported';throw Error('WebGPU is unavailable in this Worker. No fallback was run.');}
  if(config.threads>1&&!self.crossOriginIsolated&&!(config.backend.startsWith('webnn-')&&config.webnnImplementation==='direct')){record.status='unsupported';throw Error('Multiple WASM threads require crossOriginIsolated (COOP/COEP headers).');}
  const model=EXPERIMENT_MODELS[config.model];record.model={...model};
  const direct=config.backend.startsWith('webnn-')&&config.webnnImplementation==='direct';
  record.implementation=direct?'direct-webnn':'onnxruntime';record.wasmFallbackCoverage=direct?'none: direct WebNN graph; no application neural fallback':'unknown';
  let directModel,weights,ort;
  if(direct){
   directModel=await loadDirectWebNNModel(config.model,{measure});record.directExport=directModel.indexEntry;record.directProvenance=directModel.recipe.provenance;record.runtimeVersion='none: direct WebNN';
   ort={Tensor:DirectAudioTensor};
  }else{
  weights=await measure('weightsFetchMs',async()=>{const r=await fetch(new URL(model.url,import.meta.url));if(!r.ok)throw Error(`Missing model (${r.status}). Rebuild the deployable WebNN benchmark.`);return r.arrayBuffer();});
  await measure('weightsHashMs',async()=>{record.model.actualBytes=weights.byteLength;record.model.actualSha256=await sha256(weights);if(weights.byteLength!==model.bytes||record.model.actualSha256!==model.sha256)throw Error('Model integrity mismatch.');});
  const base=new URL('../../../third_party/nam-webnn-probe/runtime/',import.meta.url);
  await measure('runtimeVerifyMs',async()=>{
   const r=await fetch(new URL('./research/webnn-runtime.json',import.meta.url));if(!r.ok)throw Error('Runtime manifest missing.');const manifest=await r.json();record.runtimeManifest=manifest;
   const allowed=['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'];
   if(manifest.version!=='1.30.0'||Object.keys(manifest.files??{}).length!==3||Object.keys(manifest.files).some(f=>!allowed.includes(f)))throw Error('Unexpected pinned runtime manifest.');
   for(const [name,info]of Object.entries(manifest.files)){const response=await fetch(new URL(name,base));if(!response.ok)throw Error('Runtime absent; run npm run dist:webnn-benchmark.');const bytes=await response.arrayBuffer();if(bytes.byteLength!==info.bytes||await sha256(bytes)!==info.sha256)throw Error(`Runtime integrity mismatch: ${name}`);}
  });
  ort=await measure('runtimeImportMs',()=>import(new URL('ort.all.min.mjs',base).href));
  ort.env.wasm.wasmPaths=base.href;ort.env.wasm.numThreads=config.threads;ort.env.wasm.proxy=false;ort.env.logLevel='warning';record.runtimeVersion=ort.env.versions.web;
  }
  if(config.backend==='webgpu')await measure('adapterMs',async()=>{
   const adapter=await navigator.gpu.requestAdapter();if(!adapter){record.status='unsupported';throw Error('No WebGPU adapter.');}
   record.adapterInfo={vendor:adapter.info?.vendor,architecture:adapter.info?.architecture,device:adapter.info?.device,description:adapter.info?.description};
   device=await adapter.requestDevice();ort.env.webgpu.device=device;record.gpuFeatures=[...device.features];
  });
  if(config.backend.startsWith('webnn-'))await measure('contextMs',async()=>{
   record.requestedContextOptions=webnnContextOptions(config.backend.slice(6));context=await navigator.ml.createContext(record.requestedContextOptions);
   record.optionRecognition='Unknown WebIDL dictionary keys may be ignored; accepted options do not prove effective hardware.';
   record.reportedAccelerated=typeof context.accelerated==='boolean'?context.accelerated:null;
   record.webnnInstrumentation=timings.instrument(context,['createTensor','createConstantTensor','writeTensor','dispatch','readTensor'],'webnn.');
   try{record.opSupportLimits=context.opSupportLimits?.()??null;}catch(error){record.opSupportLimitsError=error.message;}
   try{self.MLGraphBuilder=class extends NativeBuilder{constructor(...args){super(...args);record.buildInstrumentation=timings.instrument(this,['build'],'webnn.').build;}};record.builderReplaced=self.MLGraphBuilder!==NativeBuilder;}catch(error){record.builderInstrumentationError=error.message;}
  });
  record.graphStrategy=config.model==='roformer6'&&config.backend==='webgpu'?config.gpuStrategy:'monolithic';
  session=await measure('sessionCreateMs',()=>withWebnnContext(direct?createDirectWebNNSession(context,directModel.recipe,directModel.weights,{Builder:self.MLGraphBuilder,onStep:state=>{record.lastNativeOperation=state;send();},onPhase:(name,ms)=>{record.phases[name]=ms;send();},onProgress:(n,total)=>postMessage({type:'progress',text:`Constructing native WebNN graph ${n}/${total}`})}):record.graphStrategy==='cooperative'?createCooperativeRoformerSession(ort,weights,{onStage:(n,total)=>{postMessage({type:'progress',text:`Compiling partition ${n}/${total}`});}}):ort.InferenceSession.create(weights,{executionProviders:context?[{name:'webnn',context},'wasm']:[config.backend],graphOptimizationLevel:'all',logSeverityLevel:2}),context));
  directModel=null;weights=null;
  const measuredSession={inputNames:session.inputNames,outputNames:session.outputNames,run:feeds=>withWebnnContext(timings.measure('session.run',()=>session.run(feeds),{trial:trialIndex}),context)};
  const demucs=config.model==='demucs4',core=demucs?new OnnxCoreModel(measuredSession,ort.Tensor):new RoformerCoreModel(measuredSession,ort.Tensor);
  core.onPhase=(name,event)=>timings.phase(`dsp.${name}`,event);
  for(trialIndex=-config.warmups;trialIndex<config.trials;trialIndex++){
   enter(`${trialIndex<0?'warmup':'trial'} ${trialIndex<0?trialIndex+config.warmups+1:trialIndex+1}`);
   const t=performance.now(),before={...timings.totals},counts={...timings.counts};let output,firstPcmReadyMs;
   if(demucs){const tracks=await separateTracks(core,{channelData:data.channels,sampleRate:44100},()=>{if(firstPcmReadyMs===undefined)firstPcmReadyMs=performance.now()-t;},0);output=core.sources.flatMap(role=>tracks[role].channelData);firstPcmReadyMs=performance.now()-t;}
   else{
    output=Array.from({length:model.channels},()=>new Float32Array(record.frames));const assembler=new OverlapAssembler(model.channels);
    for(const plan of planChunks(record.frames,176400,44100)){
     const block=await core.separate(data.channels.map(c=>c.slice(plan.start,plan.end)));
     const pcm=await timings.measure('assembly',()=>assembler.push(plan,block));pcm.forEach((c,i)=>output[i].set(c,plan.start));
     if(firstPcmReadyMs===undefined)firstPcmReadyMs=performance.now()-t;
    }
   }
   const processingMs=performance.now()-t,delta=name=>(timings.totals[name]??0)-(before[name]??0);
   const trial={index:trialIndex,processingMs,firstPcmReadyMs,networkAndTransfersMs:delta('session.run'),outsideSessionMs:Math.max(0,processingMs-delta('session.run')),stftMs:demucs?null:delta('dsp.stft'),istftMs:demucs?null:delta('dsp.istft'),assemblyMs:delta('assembly'),webnnReadMs:delta('webnn.readTensor'),webnnWriteSubmissionMs:delta('webnn.writeTensor'),webnnDispatchSubmissionMs:delta('webnn.dispatch'),dispatches:(timings.counts['webnn.dispatch']??0)-(counts['webnn.dispatch']??0)};
   // Validation/parity/copies are explicitly outside the processing interval.
   const validationStart=performance.now();
   if(output.length!==model.channels||output.some(c=>c.length!==record.frames||!c.every(Number.isFinite)))throw Error('Invalid output PCM.');
   trial.repeatParity=trialIndex>=0&&first?compareAudio(first,output):null;
   if(trialIndex>=0&&!first)first=output.map(c=>c.slice());
   trial.validationMs=performance.now()-validationStart;
   (trialIndex<0?record.warmups:record.trials).push(trial);send();
  }
  if(data.reference)record.baselineParity=await timings.measure('baselineParity',()=>compareAudio(data.reference,first));
  if(direct){record.nativeNumericalQualification=record.baselineParity?(record.baselineParity.withinTolerance?'passed PCM parity for this excerpt':'failed'):'not checked: no WASM reference in this campaign';if(record.baselineParity&&!record.baselineParity.withinTolerance){record.status='parity-failed';throw Error('Direct WebNN PCM differs from the WASM reference beyond tolerance. No speed score retained.');}}
  record.webnnDispatches=timings.counts['webnn.dispatch']??0;
  record.providerEvidence=direct?'Direct MLGraphBuilder + native WebNN dispatch; ONNX Runtime not imported; effective hardware unknown':context?(record.webnnDispatches?'WebNN dispatch observed; hardware and operator fallback coverage unknown':'No WebNN dispatch observed; cannot qualify this as WebNN'):config.backend+' explicitly requested';
  if(context&&record.webnnInstrumentation.dispatch==='wrapped'&&!record.webnnDispatches){record.status='no-webnn-observed';throw Error('No native WebNN dispatch: a WASM-only result is not a WebNN benchmark.');}
  record.status='ok';record.summary=experimentSummary(record);
 }catch(error){if(record.status==='running')record.status='error';record.error={name:error.name,message:error.message,phase,stack:error.stack?.slice(0,6000)};if(record.implementation==='direct-webnn')record.nativeFailure=describeDirectWebNNFailure(error);}
 finally{
  record.beforeCleanupMs=performance.now()-start;
  await measure('cleanupMs',async()=>{try{await session?.release();}catch(error){record.cleanupError=error.message;}try{context?.destroy();device?.destroy();}catch(error){record.cleanupError=error.message;}});
  record.totalWorkerMs=performance.now()-start;record.trace=timings.entries;record.traceDropped=timings.dropped;record.apiTotalsMs=timings.totals;record.apiCounts=timings.counts;
  if(NativeBuilder)try{self.MLGraphBuilder=NativeBuilder;}catch{}
  console.warn=warning;record.phase=phase;
  const stems=record.status==='ok'&&config.backend==='wasm'?first:undefined;
  postMessage({type:'result',record,stems},stems?.map(c=>c.buffer)??[]);
 }
};
