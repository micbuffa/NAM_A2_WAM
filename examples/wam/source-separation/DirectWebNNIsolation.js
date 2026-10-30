import {constructDirectOperands,validateDirectRecipe} from './DirectWebNN.js';

function references(row){
 const ids=new Set();
 const args=v=>{if(typeof v==='string')ids.add(v);else if(Array.isArray(v))v.forEach(args);};
 const options=v=>{if(v&&typeof v==='object'){if(Object.hasOwn(v,'operand'))args(v.operand);else Object.values(v).forEach(options);}};
 row.args.forEach(args);options(row.options);return [...ids];
}
export function ancestorIndices(recipe,index){
 if(!Number.isInteger(index)||index<0||index>=recipe.operations.length)throw Error('Invalid endpoint index.');
 const producer=new Map();recipe.operations.forEach((row,i)=>row.outputs.forEach(id=>producer.set(id,i)));
 const selected=new Set(),pending=[index];
 while(pending.length){const i=pending.pop();if(selected.has(i))continue;selected.add(i);for(const id of references(recipe.operations[i]))if(producer.has(id))pending.push(producer.get(id));}
 return [...selected].sort((a,b)=>a-b);
}
export function isolationEndpoints(count,{start=0,end=count-1,step=128}={}){
 if(!Number.isInteger(count)||count<1||![start,end,step].every(Number.isInteger)||start<0||end>=count||start>end||step<1)throw Error('Invalid diagnostic range.');
 if(Math.ceil((end-start)/step)+1>64)throw Error('At most 64 endpoints per campaign; narrow the range or increase the step.');
 const out=[];for(let i=start;i<=end;i+=step)out.push(i);if(out.at(-1)!==end)out.push(end);return out;
}
export function collectOperandDescriptors(builder,recipe,weights){
 validateDirectRecipe(recipe,weights.byteLength);
 const values=constructDirectOperands(builder,recipe,weights);
 return Object.fromEntries([...values].map(([id,v])=>[id,{shape:[...v.shape],dataType:v.dataType}]));
}
// Each probe owns a new context: a failed/lost context must not contaminate later probes.
export async function compileIsolationProbe(recipe,weights,{createContext,Builder,descriptors,index,kind='ancestors',device='cpu',onPhase=()=>{}}){
 if(!['original','ancestors','single','baseline'].includes(kind))throw Error('Invalid probe kind.');
 const record={kind,index:kind==='original'||kind==='baseline'?null:index,device,status:'running',physicalDeviceVerified:false};
 let context,graph,phase='context';const started=performance.now();
 const measure=async(name,fn)=>{phase=name;onPhase(name);const t=performance.now();try{return await fn();}finally{record[name+'Ms']=performance.now()-t;}};
 try{
  context=await measure('context',()=>createContext({deviceType:device}));
  const builder=new Builder(context);let outputs;
  await measure('construction',()=>{
   if(kind==='baseline'){const input=builder.input('probe',{dataType:'float32',shape:[1,2]});outputs={probe:builder.add(input,input)};record.operationCount=1;return;}
   const row=recipe.operations[index];let indices=null,externalInputs={};
   if(kind==='ancestors')indices=ancestorIndices(recipe,index);
   if(kind==='single'){
    ancestorIndices(recipe,index);indices=[index];
    const nativeInputs=new Set(Object.values(recipe.inputs).map(d=>d.id));
    for(const id of references(row))if(!nativeInputs.has(id)&&!Object.hasOwn(recipe.constants,id)){
     if(!descriptors?.[id])throw Error('Missing descriptor for cut edge '+id);externalInputs[id]=descriptors[id];
    }
   }
   const values=constructDirectOperands(builder,recipe,weights,{indices,externalInputs});
   outputs=kind==='original'?Object.fromEntries(Object.entries(recipe.outputs).map(([name,d])=>[name,values.get(d.id)])):Object.fromEntries(row.outputs.map((id,i)=>['probe_'+i,values.get(id)]));
   record.cutInputs=externalInputs;record.operationCount=indices?.length??recipe.operations.length;record.operation=kind==='original'?'original outputs':row.op;record.sourceLabel=row?.sourceLabel;
   record.outputs=Object.fromEntries(Object.entries(outputs).map(([name,v])=>[name,{shape:[...v.shape],dataType:v.dataType}]));
  });
  graph=await measure('build',()=>builder.build(outputs));record.status='ok';
 }catch(error){record.status='error';record.error={name:error.name,message:error.message,phase,stack:error.stack};}
 finally{try{graph?.destroy();}catch{}try{await context?.destroy();}catch{}record.totalMs=performance.now()-started;}
 return record;
}
