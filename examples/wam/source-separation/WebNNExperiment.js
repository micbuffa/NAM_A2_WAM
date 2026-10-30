// Separate protocol: historical Falcon/Canary W4 records are never reinterpreted.
export const EXPERIMENT_PROTOCOL='webnn-browser-diagnostics-v2';
export const EXPERIMENT_STORAGE='nam.webnn-diagnostics.v1';
export const EXPERIMENT_MODELS={
 demucs4:{label:'Demucs · 4 stems',url:'../../../third_party/nam-webgpu-probe/htdemucs-core.onnx',bytes:174263526,sha256:'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748',channels:8,windowFrames:343980},
 roformer6:{label:'BS Roformer SW · 6 stems',url:'./model-assets/bs_roformer_sw_6stem_fp16.onnx',bytes:352778874,sha256:'d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444',channels:12,windowFrames:176400},
};
export const EXPERIMENT_BACKENDS=['wasm','webgpu','webnn-cpu','webnn-gpu','webnn-npu'];
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export function experimentPlan({models,backends,sessions=1,trials=3,warmups=0,threads=1,gpuStrategy='monolithic',timeoutSeconds=300,order='rotate',webnnImplementation='direct'}){
 const unique=(list,allowed)=>Array.isArray(list)&&list.length&&new Set(list).size===list.length&&list.every(x=>allowed.includes(x));
 if(!unique(models,Object.keys(EXPERIMENT_MODELS))||!unique(backends,EXPERIMENT_BACKENDS))throw Error('Select valid models and backends.');
 for(const [value,min,max]of [[sessions,1,5],[trials,2,10],[warmups,0,3],[threads,1,8],[timeoutSeconds,30,900]])if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Invalid experiment settings.');
 if(!['direct','onnxruntime','both'].includes(webnnImplementation))throw Error('Invalid WebNN implementation.');
 if(!['monolithic','cooperative'].includes(gpuStrategy)||!['rotate','fixed'].includes(order))throw Error('Invalid graph strategy/order.');
 const jobs=[];
 for(let session=0;session<sessions;session++)for(const model of models){
  const offset=order==='rotate'?session%backends.length:0,sequence=[...backends.slice(offset),...backends.slice(0,offset)];
  for(const backend of sequence){
   const paired=webnnImplementation==='both'&&backend.startsWith('webnn-');
   const implementations=paired?(session%2?['onnxruntime','direct']:['direct','onnxruntime']):[webnnImplementation==='both'?'onnxruntime':webnnImplementation];
   for(const implementation of implementations)jobs.push({id:`${model}-${backend}-${session+1}${paired?'-'+implementation:''}`,model,backend,session:session+1,trials,warmups,threads,gpuStrategy,timeoutSeconds,webnnImplementation:implementation});
  }
 }
 return jobs;
}
export function statistics(values){
 if(!values.length||values.some(x=>!Number.isFinite(x)||x<0))return null;
 const sorted=[...values].sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length;
 return {count:values.length,minMs:sorted[0],medianMs:(sorted[Math.floor((sorted.length-1)/2)]+sorted[Math.floor(sorted.length/2)])/2,maxMs:sorted.at(-1),meanMs:mean,stddevMs:Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length)};
}
export function experimentSummary(record){
 if(record.status!=='ok')return null;
 if(!Number.isSafeInteger(record.frames)||record.frames<=0||record.sampleRate!==44100||record.trials?.length!==record.config.trials)throw Error('Incomplete measurement.');
 const all=statistics(record.trials.map(t=>t.processingMs));if(!all||!all.minMs)throw Error('Invalid timing.');
 const retained=statistics(record.trials.slice(1).map(t=>t.processingMs));
 return {all,retained,firstMs:record.trials[0].processingMs,retainedRtf:retained.medianMs/(record.frames/44.1),durationSeconds:record.frames/44100};
}
export function experimentCsv(report){
 const fields=['id','model','backend','session','status','implementation','workerStartupMs','weightsFetchMs','weightsHashMs','runtimeVerifyMs','runtimeImportMs','adapterMs','contextMs','sessionCreateMs','firstMs','warmMedianMs','rtf','graphRecipeFetchMs','graphRecipeVerifyMs','graphConstructionMs','nativeGraphBuildMs','tensorAllocationMs','nativeNumericalQualification','error'];
 const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
 return [fields,...report.runs.map(r=>[r.config.id,r.config.model,r.config.backend,r.config.session,r.status,r.implementation??(r.config.backend.startsWith('webnn-')&&r.config.webnnImplementation==='direct'?'direct-webnn':'onnxruntime'),r.workerStartupMs,r.phases?.weightsFetchMs,r.phases?.weightsHashMs,r.phases?.runtimeVerifyMs,r.phases?.runtimeImportMs,r.phases?.adapterMs,r.phases?.contextMs,r.phases?.sessionCreateMs,r.summary?.firstMs,r.summary?.retained?.medianMs,r.summary?.retainedRtf,r.phases?.graphRecipeFetchMs,r.phases?.graphRecipeVerifyMs,r.phases?.graphConstructionMs,r.phases?.nativeGraphBuildMs,r.phases?.tensorAllocationMs,r.nativeNumericalQualification,r.error?.message])].map(row=>row.map(quote).join(',')).join('\r\n');
}
export function saveExperiment(storage,report){try{storage?.setItem(EXPERIMENT_STORAGE,JSON.stringify(report));return !!storage;}catch{return false;}}
export function restoreExperiment(storage){try{const value=JSON.parse(storage?.getItem(EXPERIMENT_STORAGE));return [EXPERIMENT_PROTOCOL,'webnn-browser-diagnostics-v1'].includes(value?.protocol)&&Array.isArray(value.runs)?value:null;}catch{return null;}}

// These are nested wall-time spans, NOT additive device/kernel times. Dispatch
// measures CPU submission only. readTensor may include pending device work.
export class ExperimentTimings {
 constructor(clock=()=>performance.now()){this.clock=clock;this.entries=[];this.active=new Map();this.dropped=0;this.totals={};this.counts={};}
 add(name,start,end=this.clock(),detail={}){const entry={name,startMs:start,endMs:end,durationMs:end-start,...detail};this.totals[name]=(this.totals[name]??0)+entry.durationMs;this.counts[name]=(this.counts[name]??0)+1;if(this.entries.length<20000)this.entries.push(entry);else this.dropped++;try{this.onEntry?.(entry);}catch{/* A diagnostic callback must not change the native method's result. */}return entry;}
 async measure(name,operation,detail={}){const start=this.clock();try{return await operation();}finally{this.add(name,start,this.clock(),detail);}}
 phase(name,event){if(event==='start')this.active.set(name,this.clock());else if(this.active.has(name)){this.add(name,this.active.get(name));this.active.delete(name);}}
 sum(name,from=0){return this.entries.slice(from).filter(e=>e.name===name).reduce((sum,e)=>sum+e.durationMs,0);}
 instrument(object,names,prefix){
  const coverage={};
  for(const name of names){const original=object[name];if(typeof original!=='function'){coverage[name]='absent';continue;}
   const timings=this;
   const wrapped=function(...args){const start=timings.clock();try{const value=original.apply(this,args);if(value?.then)return value.then(result=>{timings.add(prefix+name,start);return result;},error=>{timings.add(prefix+name,start,timings.clock(),{error:error.message});throw error;});timings.add(prefix+name,start);return value;}catch(error){timings.add(prefix+name,start,timings.clock(),{error:error.message});throw error;}};
   try{object[name]=wrapped;coverage[name]=object[name]===wrapped?'wrapped':'unavailable';}catch{coverage[name]='unavailable';}
  }
  return coverage;
 }
}

// UI units only: raw measurements/exports deliberately retain their Ms fields.
export const formatExperimentSeconds=value=>Number.isFinite(value)?(value/1000).toFixed(3):'—';
export function experimentAudioDescription(input){
 if(!input)return 'No measured audio yet. Choose the input below.';
 const duration=input.frames/input.sampleRate;
 const source=Number.isFinite(input.sourceDurationSeconds)?` · source length ${input.sourceDurationSeconds.toFixed(3)} s`:'';
 return `${input.name} · tested first ${duration.toFixed(3)} s${source} · ${input.frames} frames at ${input.sampleRate} Hz · stereo processing`;
}
