// Bound GPU work in flight by running verified graph partitions sequentially.
// This uses public ORT tensor/session and WebGPU queue APIs; no runtime patch.
const encode = new TextEncoder();
function varint(value){const bytes=[];do{const low=value%128;value=Math.floor(value/128);bytes.push(low|(value?128:0));}while(value);return Uint8Array.from(bytes);}
function join(parts){const output=new Uint8Array(parts.reduce((sum,p)=>sum+p.length,0));let offset=0;for(const p of parts){output.set(p,offset);offset+=p.length;}return output;}
function field(number,bytes){return join([varint(number*8+2),varint(bytes.length),bytes]);}
function decode(value){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
const yieldToRenderer=()=>new Promise(resolve=>setTimeout(resolve,4));

export function validateStagePlan(plan,byteLength){
 if(plan?.version!==1||plan.sourceBytes!==byteLength||!/^[a-f0-9]{64}$/.test(plan.sourceSha256)||!Array.isArray(plan.headerSpans)||!plan.headerSpans.length||!Array.isArray(plan.stages)||!plan.stages.length||plan.stages.length>256||String(plan.outputNames)!=='out_spec_real,out_spec_imag')throw Error('Plan Roformer incompatible.');
 const available=new Set(['spec_real','spec_imag']),produced=new Set();
 const spanValid=s=>Array.isArray(s)&&s.length===2&&s.every(Number.isSafeInteger)&&s[0]>=0&&s[1]>0&&s[0]+s[1]<=byteLength;
 if(!plan.headerSpans.every(spanValid))throw Error('En-tête Roformer invalide.');
 for(const p of plan.stages){
  if(!Array.isArray(p.spans)||!p.spans.length||!p.spans.every(spanValid)||!Array.isArray(p.inputs)||!Array.isArray(p.outputs)||!p.outputs.length||!Array.isArray(p.gpuOutputs)||!Array.isArray(p.inputMetadata)||!Array.isArray(p.outputMetadata)||!Array.isArray(p.valueMetadata)||p.inputMetadata.length!==p.inputs.length||p.outputMetadata.length!==p.outputs.length)throw Error('Étape Roformer invalide.');
  if(p.inputs.some(n=>!available.has(n))||p.outputs.some(n=>typeof n!=='string'||produced.has(n))||p.gpuOutputs.some(n=>!p.outputs.includes(n)||plan.outputNames.includes(n)))throw Error('Dépendances Roformer invalides.');
  for(const n of p.outputs){produced.add(n);available.add(n);}
 }
 if(plan.outputNames.some(n=>!available.has(n)))throw Error('Sorties Roformer absentes.');
 return plan;
}

export function buildStageModel(source,plan,index){
 const stage=plan.stages[index];
 const ranges=spans=>spans.map(([offset,length])=>source.subarray(offset,offset+length));
 const graph=join([
  ...ranges(stage.spans),field(2,encode.encode(`roformer-cooperative-${index}`)),
  ...stage.inputMetadata.map(s=>field(11,decode(s))),
  ...stage.outputMetadata.map(s=>field(12,decode(s))),
  ...stage.valueMetadata.map(s=>field(13,decode(s)))
 ]);
 return join([...ranges(plan.headerSpans),field(7,graph)]);
}

export class CooperativeOnnxSession {
 constructor(sessions,plan,{drain,yieldControl=yieldToRenderer,now=()=>performance.now()}={}){
  this.sessions=sessions;this.plan=plan;this.drain=drain;this.yieldControl=yieldControl;this.now=now;
  this.lastUse=new Map();plan.stages.forEach((p,i)=>p.inputs.forEach(n=>this.lastUse.set(n,i)));this.busy=false;this.released=false;
 }
 async run(inputs){
  if(this.released||this.busy)throw Error('Session Roformer indisponible.');this.busy=true;
  const values=new Map(Object.entries(inputs)),owned=new Set(),timings=[];
  try{
   for(const [index,p] of this.plan.stages.entries()){
    const start=this.now();
    const feeds=Object.fromEntries(p.inputs.map(name=>{if(!values.has(name))throw Error(`Tenseur Roformer absent : ${name}`);return [name,values.get(name)];}));
    const output=await this.sessions[index].run(feeds);
    for(const [name,tensor] of Object.entries(output)){owned.add(tensor);values.set(name,tensor);}
    if(p.outputs.some(name=>!Object.hasOwn(output,name)))throw Error('Étape Roformer incomplète.');
    await this.drain();
    for(const name of p.inputs)if(this.lastUse.get(name)===index&&!this.plan.outputNames.includes(name)){
     const tensor=values.get(name);if(owned.delete(tensor))tensor.dispose();values.delete(name);
    }
    timings.push(this.now()-start);await this.yieldControl();
   }
   const output=Object.fromEntries(this.plan.outputNames.map(n=>[n,values.get(n)]));
   if(Object.values(output).some(t=>!t))throw Error('Séparation Roformer incomplète.');
   for(const tensor of Object.values(output))owned.delete(tensor);
   this.lastTimings=timings;return output;
  }finally{for(const t of owned)t.dispose();this.busy=false;}
 }
 async release(){if(this.busy)throw Error('Inférence Roformer en cours.');if(this.released)return;this.released=true;await Promise.all(this.sessions.map(s=>s.release()));}
}

export async function createCooperativeRoformerSession(ort,weights,{loadPlan=async()=>{
 const response=await fetch(new URL('./roformer-stage-plan.json',import.meta.url));if(!response.ok)throw Error('Plan Roformer indisponible.');return response.json();
},onStage=()=>{},yieldControl=yieldToRenderer}={}){
 const source=new Uint8Array(weights),plan=validateStagePlan(await loadPlan(),source.length);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',source)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==plan.sourceSha256)throw Error('Le plan ne correspond pas aux poids Roformer.');
 const sessions=[];
 try{
  for(const [index,p] of plan.stages.entries()){
   sessions.push(await ort.InferenceSession.create(buildStageModel(source,plan,index),{
    executionProviders:['webgpu'],graphOptimizationLevel:'all',logSeverityLevel:3,
    preferredOutputLocation:Object.fromEntries(p.gpuOutputs.map(n=>[n,'gpu-buffer']))
   }));
   onStage(index+1,plan.stages.length);await yieldControl();
  }
  const device=await ort.env.webgpu.device;
  return new CooperativeOnnxSession(sessions,plan,{drain:()=>device.queue.onSubmittedWorkDone(),yieldControl});
 }catch(error){await Promise.allSettled(sessions.map(s=>s.release()));throw error;}
}
