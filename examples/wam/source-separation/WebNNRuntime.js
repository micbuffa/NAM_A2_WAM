import {webnnContextOptions} from './WebNNDevice.js';
import {withWebnnContext} from './WebNNBenchmark.js';

// Source and dist deliberately keep ORT 1.30 separate from production ORT 1.22.
export async function createWebnnPlaybackSession(weights,deviceType,{navigatorImpl=globalThis.navigator,Builder=globalThis.MLGraphBuilder,
 fetchImpl=globalThis.fetch,cryptoImpl=globalThis.crypto,importRuntime=url=>import(url)}={}){
 if(!navigatorImpl?.ml||!Builder)throw Error('WebNN absent dans le Worker. Utilisez un navigateur avec WebNN disponible (Firefox expérimental ou Canary), ou choisissez WebGPU / WASM.');
 const base=new URL('../../../third_party/nam-webnn-probe/runtime/',import.meta.url);
 const response=await fetchImpl(new URL('./research/webnn-runtime.json',import.meta.url));
 if(!response.ok)throw Error('Manifeste WebNN absent.');const manifest=await response.json();
 if(manifest.version!=='1.30.0'||Object.keys(manifest.files||{}).length!==3)throw Error('Manifeste du runtime WebNN invalide.');
 for(const [name,info] of Object.entries(manifest.files)){
  if(!['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'].includes(name))throw Error('Fichier runtime WebNN non autorisé.');
  const r=await fetchImpl(new URL(name,base));if(!r.ok)throw Error('Runtime WebNN absent : lancez python3 tools/prepare-webnn-lab.py puis reconstruisez la dist.');
  const bytes=await r.arrayBuffer(),hash=[...new Uint8Array(await cryptoImpl.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(bytes.byteLength!==info.bytes||hash!==info.sha256)throw Error('Intégrité du runtime WebNN invalide.');
 }
 const ort=await importRuntime(new URL('ort.all.min.mjs',base).href);
 ort.env.wasm.wasmPaths=base.href;ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';
 let context,session,dispatches=0,instrumented=false;
 try{
  context=await navigatorImpl.ml.createContext(webnnContextOptions(deviceType));
  try{const dispatch=context.dispatch;context.dispatch=function(...args){dispatches++;return dispatch.apply(this,args);};instrumented=context.dispatch!==dispatch;}catch{}
  session=await withWebnnContext(ort.InferenceSession.create(weights,{executionProviders:[{name:'webnn',context},'wasm'],graphOptimizationLevel:'all',logSeverityLevel:3}),context);
  return {ort,session,guard:operation=>withWebnnContext(operation,context),
   evidence:()=>({requestedDevice:deviceType,effectiveHardware:'unknown',webnnDispatches:dispatches,dispatchInstrumentation:instrumented,wasmFallbackCoverage:'unknown'}),
   async release(){await session?.release().catch(()=>{});context?.destroy();}};
 }catch(error){await session?.release().catch(()=>{});context?.destroy();throw error;}
}
