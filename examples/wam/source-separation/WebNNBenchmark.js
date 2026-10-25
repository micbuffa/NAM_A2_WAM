// Protocol fixed before running: one first pass and two retained-session repeats.
export const PERF_PROTOCOL='webnn-falcon-6s-retained-session-v1';
export const PERF_TRIALS=3;
export function performanceMatrix(){return ['demucs4','roformer6'].flatMap(model=>[
 {model,runtime:'production',backend:'webgpu'},
 ...['wasm','webgpu'].map(backend=>({model,runtime:'lab',backend})),
 ...['cpu','gpu','npu'].map(deviceType=>({model,runtime:'lab',backend:'webnn',deviceType}))
]);}
export function summarizePerformance(record){
 if(record.status!=='ok')return null;
 const times=record.trials?.map(t=>t.elapsedMs);
 if(times?.length!==PERF_TRIALS||times.some(x=>!Number.isFinite(x)||x<=0)||record.frames!==264600)throw Error('Mesure incomplète ou durée différente du protocole.');
 const warm=times.slice(1).sort((a,b)=>a-b),median=(warm[0]+warm[1])/2;
 return {firstMs:times[0],warmMedianMs:median,warmMinMs:warm[0],warmMaxMs:warm[1],warmRtf:median/6000};
}

// ORT can leave session creation pending after a native graph/context failure.
// Observe the public WebNN lifetime promise; never relabel the job as WASM.
export function withWebnnContext(operation,context){
 if(!context?.lost?.then)return operation;
 return Promise.race([operation,context.lost.then(info=>{throw new Error('WebNN context lost: '+(info?.message||'device unavailable'));})]);
}

export const PERF_STORAGE='nam.webnn-performance.last.v1';
export function restorePerformanceCheckpoint(storage){
 try{const value=JSON.parse(storage.getItem(PERF_STORAGE));return value?.protocol===PERF_PROTOCOL&&Array.isArray(value.runs)?value:null;}catch{return null;}
}
export function savePerformanceCheckpoint(storage,report){
 try{storage.setItem(PERF_STORAGE,JSON.stringify(report));return true;}catch{return false;}
}
export function performanceCompletion(runs,cancelled=false){return cancelled?'cancelled':runs.some(r=>r.status!=='ok')?'completed-with-failures':'completed';}
