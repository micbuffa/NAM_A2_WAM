import * as ort from './vendor/onnxruntime-web/ort.webgpu.min.mjs';
import {configureOnnxRuntime} from './OnnxRuntimeConfig.js';
const progress=message=>postMessage({type:'progress',message});
onmessage=async({data:{backend}})=>{
 let session,device;const report={protocol:'scnet-browser-contract-v1',date:new Date().toISOString(),backend,runtime:ort.env.versions,model:'audiojs/scnet.int8.onnx',status:'failed'};
 try{
  configureOnnxRuntime(ort,import.meta.url);const base=new URL('../../../third_party/scnet-probe/',import.meta.url);
  progress('Lecture et vérification des poids et des données de référence…');
  const fetchBytes=async file=>{const r=await fetch(new URL(file,base));if(!r.ok)throw Error(`Préparation locale absente : ${file}`);return r.arrayBuffer();};
  const weights=await fetchBytes('scnet.int8.onnx');const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
  report.modelSha256=await hash(weights);if(report.modelSha256!=='98228931494151762a1c4ab1ec7899a894b1f81fd4a509921a9d2f9bacc50845')throw Error('SHA-256 des poids incorrect.');
  const [input,reference]=await Promise.all([fetchBytes('browser-input.f32'),fetchBytes('browser-reference.f32')]);report.inputSha256=await hash(input);report.referenceSha256=await hash(reference);
  if(input.byteLength!==4*2049*476*4||reference.byteLength!==16*2049*476*4)throw Error('Dimensions de données incorrectes.');
  if(backend==='webgpu'){const adapter=await navigator.gpu?.requestAdapter();if(!adapter)throw Error('WebGPU indisponible.');report.adapter=adapter.info?{vendor:adapter.info.vendor,architecture:adapter.info.architecture}:null;device=await adapter.requestDevice();ort.env.webgpu.device=device;}
  progress(`Création de la session ${backend}…`);let t=performance.now();session=await ort.InferenceSession.create(weights,{executionProviders:[backend],graphOptimizationLevel:'all',logSeverityLevel:3});report.sessionMs=performance.now()-t;
  progress(`Inférence ${backend} dans le Worker…`);t=performance.now();const result=await session.run({mix_spec:new ort.Tensor('float32',new Float32Array(input),[1,4,2049,476])});report.inferenceMs=performance.now()-t;const y=result.stems_spec,ref=new Float32Array(reference);if(y.data.length!==ref.length)throw Error('Forme de sortie incorrecte.');report.outputShape=y.dims;
  let squared=0,energy=0,max=0;for(let i=0;i<ref.length;i++){if(!Number.isFinite(y.data[i]))throw Error('Sortie non finie.');const delta=y.data[i]-ref[i];squared+=delta*delta;energy+=ref[i]*ref[i];max=Math.max(max,Math.abs(delta));}
  report.relativeRmsError=Math.sqrt(squared/Math.max(energy,1e-30));report.maxAbsError=max;report.finite=true;report.numericTolerance=1e-3;report.parityPassed=report.relativeRmsError<=report.numericTolerance;report.status='completed';report.interpretation='Même ONNX compact, pas de parité à la précision du checkpoint natif et pas de preuve de qualité guitare/basse. Des opérateurs peuvent être exécutés sur CPU dans le backend GPU.';
  for(const tensor of Object.values(result))tensor.dispose();
 }catch(error){report.error=error.message;}
 finally{await session?.release();device?.destroy();}
 postMessage(report);
};
