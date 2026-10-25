export const WEBNN_PROBES=[{id:'default',options:{}},{id:'cpu-preference',options:{deviceType:'cpu',accelerated:false}},{id:'gpu-preference',options:{deviceType:'gpu',accelerated:true}},{id:'npu-preference',options:{deviceType:'npu',accelerated:true}}];
// Both option generations are recorded: unknown dictionary keys may be ignored.
// A successful preference is never proof of the requested physical accelerator.
export async function probeWebNN({id,options},{ml=globalThis.navigator?.ml,Builder=globalThis.MLGraphBuilder,clock=()=>performance.now()}={}){
 const result={id,requestedOptions:options,effectiveHardware:'unknown',optionRecognition:'not-observable; unknown WebIDL keys may be ignored',available:!!ml&&typeof Builder==='function'};
 if(!result.available)return {...result,status:'unavailable'};
 let context,graph,inputTensor,outputTensor,phase='context',start=clock();
 try{
  context=await ml.createContext(options);result.contextMilliseconds=clock()-start;result.reportedAccelerated=typeof context.accelerated==='boolean'?context.accelerated:null;
  phase='graph';start=clock();const builder=new Builder(context),x=builder.input('x',{dataType:'float32',shape:[1,2]}),w=builder.constant({dataType:'float32',shape:[2,1]},new Float32Array([3,4]));graph=await builder.build({y:builder.matmul(x,w)});result.buildMilliseconds=clock()-start;
  phase='tensors';inputTensor=await context.createTensor({dataType:'float32',shape:[1,2],writable:true});outputTensor=await context.createTensor({dataType:'float32',shape:[1,1],readable:true});
  phase='inference';start=clock();context.writeTensor(inputTensor,new Float32Array([1,2]));context.dispatch(graph,{x:inputTensor},{y:outputTensor});const output=new Float32Array(await context.readTensor(outputTensor));result.inferenceAndReadMilliseconds=clock()-start;result.output=[...output];result.expected=[11];
  if(output.length!==1||!Number.isFinite(output[0])||Math.abs(output[0]-11)>1e-5)throw Error('Résultat numérique incorrect.');
  result.status='passed';
 }catch(e){result.status='error';result.phase=phase;result.error={name:e.name,message:e.message};}
 finally{for(const object of [outputTensor,inputTensor,graph,context])try{object?.destroy?.();}catch{}}
 return result;
}
