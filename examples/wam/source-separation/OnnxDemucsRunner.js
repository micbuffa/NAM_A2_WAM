import {modelKey} from './ModelDownloadManager.js';
const failure=(message,code)=>Object.assign(new Error(message),{code});

export class OnnxDemucsRunner {
  constructor({manager,workerFactory=()=>new Worker(new URL('./onnx-worker.js',import.meta.url),{type:'module'}),timeoutMs=120000}) {
    this.manager=manager;this.workerFactory=workerFactory;this.timeoutMs=timeoutMs;
  }
  async separate(model,channels,{backend='webgpu',fallback=true,diagnostics=false,onProgress=()=>{},onChunk=()=>{}}={}) {
    if(this.busy)throw Error('Une séparation est déjà en cours.');
    if(model.runtime!=='demucs-onnx-core'||model.roles.length!==4||!['webgpu','wasm'].includes(backend)||channels.length!==2||channels.some(c=>!(c instanceof Float32Array)||!c.length||!c.every(Number.isFinite))||channels[0].length!==channels[1].length||channels[0].length>60*44100)throw Error('Extrait ONNX invalide (60 s maximum).');
    this.busy=true;this.cancelled=false;let fallbackReason=null,published=0;
    try {
      onProgress({phase:'cache'});
      if((await this.manager.getStatus(model)).state!=='installed')throw Error('Téléchargez le modèle ONNX avant de séparer.');
      const run=async provider=>{
        const record=await this.manager.cache.get(modelKey(model));
        if(this.cancelled)throw new DOMException('Annulé','AbortError');
        return this.runWorker(record.files[0],channels,provider,diagnostics,data=>{
          if(data.type==='chunk'){
            published+=data.stems[0].length;onChunk({...data,roles:model.roles});
            onProgress({phase:'chunk-ready',backend:provider,chunkIndex:data.chunkIndex,totalChunks:data.totalChunks,completedFrames:published,totalFrames:channels[0].length});
          }else onProgress(data);
        });
      };
      let result;
      try {result=await run(backend);}
      catch(error) {
        // Never splice two backends into an already-published stream. An abort
        // is user intent and must not trigger an automatic CPU restart.
        if(this.cancelled||error.name==='AbortError'||backend!=='webgpu'||!fallback||published||!['BACKEND_ERROR','ENGINE_TIMEOUT'].includes(error.code))throw error;
        fallbackReason=error.message;onProgress({phase:'fallback',backend:'wasm',message:fallbackReason});
        result=await run('wasm');
      }
      for(let i=0;i<model.roles.length;i++)onProgress({phase:'track-complete',trackIndex:i,trackRole:model.roles[i],totalTracks:4});
      return {...result,fallbackReason};
    } finally {this.worker?.terminate();this.worker=null;this.reject=null;this.busy=false;}
  }
  async runWorker(weights,channels,backend,diagnostics,onEvent) {
    let timer;
    try {
      return await new Promise((resolve,reject)=>{
        const worker=this.worker=this.workerFactory();this.reject=reject;let committed=0,settled=false;
        const fail=error=>{if(!settled){settled=true;reject(error);}};
        const deadline=()=>{clearTimeout(timer);timer=setTimeout(()=>fail(failure('Le moteur ONNX ne répond plus. Réessayez sur CPU.','ENGINE_TIMEOUT')),this.timeoutMs);};
        deadline();worker.onerror=e=>fail(failure(e.message||'Erreur du Worker ONNX.','BACKEND_ERROR'));
        worker.onmessage=({data})=>{
          if(settled||this.cancelled||this.worker!==worker)return;
          try {
            if(data.type==='error')throw failure(data.message,data.code||'BACKEND_ERROR');
            if(data.type==='progress'){deadline();onEvent(data);}
            else if(data.type==='chunk') {
              if(data.backend!==backend||data.sampleRate!==44100||data.startFrame!==committed||data.stems?.length!==8||data.stems.some(c=>!(c instanceof Float32Array)||!c.length||c.length!==data.stems[0].length||!c.every(Number.isFinite))||committed+data.stems[0].length>channels[0].length)throw failure('Bloc ONNX désaligné ou invalide.','INVALID_AUDIO');
              committed+=data.stems[0].length;deadline();onEvent(data);
            }else if(data.type==='done') {
              if(data.backend!==backend||committed!==channels[0].length)throw failure('Séparation ONNX incomplète.','INVALID_AUDIO');
              settled=true;resolve(data);
            }
          }catch(error){fail(error);}
        };
        const left=channels[0].slice(),right=channels[1].slice();
        worker.postMessage({weights,left,right,backend,diagnostics},[weights,left.buffer,right.buffer]);
      });
    } finally {clearTimeout(timer);this.worker?.terminate();this.worker=null;this.reject=null;}
  }
  cancel(){this.cancelled=true;this.worker?.terminate();this.reject?.(new DOMException('Annulé','AbortError'));}
}
