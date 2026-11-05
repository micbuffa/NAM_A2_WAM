// Pinned source checkpoint identities; no benchmark/ORT dependency in the native path.
export const EXPERIMENT_MODELS={demucs4:{sha256:'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748'},roformer6:{sha256:'d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444'}};
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');

// Small metadata probe only: never download weights while opening settings.
export async function directWebNNAvailability(fetchImpl=globalThis.fetch.bind(globalThis)) {
 try{
  const response=await fetchImpl(new URL('./model-assets/direct-webnn/index.json',import.meta.url),{cache:'no-store'});
  if(!response.ok)return{available:false,reason:'Direct WebNN models are not included in this deployment.'};
  const index=await response.json();
  const available=index.format==='direct-webnn-index-v1'&&Object.entries(EXPERIMENT_MODELS).every(([key,model])=>index.models?.[key]?.sourceSha256===model.sha256);
  return{available,reason:available?'':index.unavailableReason||'Direct WebNN models are not included in this deployment.'};
 }catch{return{available:false,reason:'Direct WebNN models are not included in this deployment.'};}
}
