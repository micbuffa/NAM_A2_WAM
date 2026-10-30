// Recommendations from successful measurements, not global device/quality rankings.
import {statistics} from './WebNNExperiment.js';
export function measuredCandidates(report){
 const groups=new Map();
 for(const r of report?.runs??[]){
  const duration=r.summary?.durationSeconds??report.input?.frames/report.input?.sampleRate;
  const median=r.summary?.retained?.medianMs,first=r.summary?.firstMs,setup=r.phases?.sessionCreateMs;
  if(r.status!=='ok'||![duration,median,first,setup].every(Number.isFinite)||duration<=0||median<=0||first<0||setup<0)continue;
  if(r.nativeNumericalQualification==='failed'||r.baselineParity?.withinTolerance===false)continue;
  const {model,backend}=r.config,implementation=r.implementation??(backend.startsWith('webnn-')&&r.config.webnnImplementation==='direct'?'direct-webnn':'onnxruntime');
  const key=[model,backend,implementation,r.config.gpuStrategy??'monolithic'].join('/');
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push({r,duration,median,first,setup,implementation});
 }
 return [...groups.values()].map(rows=>({model:rows[0].r.config.model,backend:rows[0].r.config.backend,implementation:rows[0].implementation,strategy:rows[0].r.config.gpuStrategy??'monolithic',samples:rows.length,seconds:statistics(rows.map(x=>x.duration)).medianMs,processingMs:statistics(rows.map(x=>x.median)).medianMs,firstMs:statistics(rows.map(x=>x.first)).medianMs,setupMs:statistics(rows.map(x=>x.setup)).medianMs,directParity:rows.every(x=>typeof x.r.nativeNumericalQualification==='string'&&x.r.nativeNumericalQualification.startsWith('passed PCM parity'))}));
}
export function recommendMeasuredBackend(candidates,{model,webnn=false,webgpu=true,webnnDevices=['cpu','gpu','npu'],durationSeconds=180,initialized=false}={}){
 if(!Number.isFinite(durationSeconds)||durationSeconds<=0)throw Error('Invalid projected song duration.');
 const allowed=candidates.filter(c=>c.model===model&&(c.backend==='wasm'||c.backend==='webgpu'&&webgpu||c.backend.startsWith('webnn-')&&webnn&&webnnDevices.includes(c.backend.slice(6))));
 const scored=allowed.map(c=>({...c,rtf:c.processingMs/(c.seconds*1000),estimatedMs:initialized?durationSeconds/c.seconds*c.processingMs:c.setupMs+c.firstMs+Math.max(0,durationSeconds/c.seconds-1)*c.processingMs}));
 const fastest=[...scored].sort((a,b)=>a.rtf-b.rtf)[0]??null;
 const recommended=[...scored].sort((a,b)=>a.estimatedMs-b.estimatedMs)[0]??null;
 return{recommended,fastest,candidates:scored};
}
export const recommendationLabel=c=>c?`${c.backend.toUpperCase()} · ${c.implementation==='direct-webnn'?'Direct WebNN':'ONNX Runtime'}`:'No successful measured candidate';
// Prototype policy for later host integration. Only feed measurements from this device/build.
export function recommendSeparationDefault(candidates,{dedicatedGuitar=false,...options}={}){
 const model=dedicatedGuitar?'roformer6':'demucs4';
 const measured=recommendMeasuredBackend(candidates,{...options,webgpu:options.webgpu===true,model}).recommended;
 return measured?{...measured,evidence:'measured',reason:dedicatedGuitar?'Dedicated guitar stem requested':'Four-stem default for lower startup cost'}:{model,backend:options.webgpu===true?'webgpu':'wasm',implementation:'onnxruntime',evidence:'unmeasured-fallback',reason:'Conservative fallback; validate backend/session before use'};
}
