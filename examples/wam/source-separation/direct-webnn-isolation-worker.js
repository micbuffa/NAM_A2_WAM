import {loadDirectWebNNModel} from './DirectWebNN.js';
import {collectOperandDescriptors,compileIsolationProbe,isolationEndpoints} from './DirectWebNNIsolation.js';
self.onmessage=async({data:config})=>{
 try{
  if(!['cpu','gpu','npu'].includes(config.device))throw Error('Unknown device request.');
  if(!self.navigator.ml||typeof self.MLGraphBuilder!=='function')throw Error('Native WebNN is unavailable in this browser/Worker.');
  const send=message=>self.postMessage(message);
  send({type:'progress',message:'Loading and verifying Demucs graph and weights…'});
  const {recipe,weights,indexEntry}=await loadDirectWebNNModel('demucs4');
  const endpoints=isolationEndpoints(recipe.operations.length,config);
  send({type:'identity',model:indexEntry,operationCount:recipe.operations.length});
  let shapeContext,descriptors;
  try{shapeContext=await navigator.ml.createContext({deviceType:config.device});descriptors=collectOperandDescriptors(new MLGraphBuilder(shapeContext),recipe,weights);}
  finally{await shapeContext?.destroy();}
  const run=async(kind,index)=>{
   send({type:'probe',kind,index});
   const record=await compileIsolationProbe(recipe,weights,{Builder:MLGraphBuilder,createContext:options=>navigator.ml.createContext(options),descriptors,device:config.device,kind,index,onPhase:phase=>send({type:'progress',message:`${kind} ${index??''} · ${phase}`})});
   send({type:'result',record});return record;
  };
  const baseline=await run('baseline');
  if(baseline.status!=='ok')throw Error('Even the small add baseline failed. Stop: model isolation would not be interpretable.');
  await run('original');
  for(const index of endpoints){const result=await run('ancestors',index);if(result.status==='error')await run('single',index);}
  send({type:'done'});
 }catch(error){self.postMessage({type:'fatal',error:{name:error.name,message:error.message,stack:error.stack}});}
};
