import {StreamingWorker,isVerifiedStreamChunk} from './StreamTransport.js';
import {modelKey} from './ModelDownloadManager.js';

// A single reusable neural session for Demucs preview or BS Roformer. Changing model/backend or aborting an operation
// destroys the worker, so an obsolete preparation can never publish audio.
export class PreparedDemucsRunner {
  constructor({manager,workerFactory=()=>new Worker(new URL('./preview-worker.js',import.meta.url),{type:'module'}),timeoutMs=120000}){
    this.manager=manager;this.workerFactory=workerFactory;this.timeoutMs=timeoutMs;
  }
  isPrepared(model,backend){return this.identity===`${modelKey(model)}:${backend}`&&!!this.worker&&!this.pending;}
  isPreparing(model,backend){return this.preparingIdentity===`${modelKey(model)}:${backend}`&&!!this.worker;}
  request(message,onEvent=()=>{},transfers=[]){
    if(this.pending)throw Error('Le moteur est occupé.');
    return new Promise((resolve,reject)=>{
      const worker=this.worker;let timer;
      const finish=(error,data)=>{clearTimeout(timer);this.pending=null;error?reject(error):resolve(data);};
      const deadline=()=>{clearTimeout(timer);timer=setTimeout(()=>this.fail(Error('Le moteur ne répond plus.')),this.timeoutMs);};
      this.pending={reject:error=>finish(error)};deadline();
      worker.onerror=event=>this.fail(Error(event.message||'Erreur du moteur.'));
      worker.onmessage=({data})=>{
        if(this.worker!==worker||!this.pending)return;
        try{
          if(data.type==='error')throw Error(data.message);
          deadline();
          if(data.type==='prepared'||data.type==='done')finish(null,data);else onEvent(data);
        }catch(error){this.fail(error);}
      };
      worker.postMessage(message,transfers);
    });
  }
  fail(error){this.pending?.reject(error);this.pending=null;this.worker?.terminate();this.worker=null;this.identity=null;this.preparingIdentity=null;}
  cancel(){this.fail(new DOMException('Annulé','AbortError'));}
  async prepare(model,backend,{onProgress=()=>{}}={}){
    if(this.isPrepared(model,backend))return;
    this.cancel();const worker=this.worker=new StreamingWorker(this.workerFactory(model),model.roles.length*2);this.preparingIdentity=`${modelKey(model)}:${backend}`;
    try{
      const record=await this.manager.cache.get(modelKey(model));
      if(this.worker!==worker)throw new DOMException('Annulé','AbortError');
      if(!await this.manager.verifyRecord(model,record))throw Error('Téléchargez à nouveau le modèle sélectionné.');
      if(this.worker!==worker)throw new DOMException('Annulé','AbortError');
      const weights=record.files[0];
      const result=await this.request({type:'prepare',weights,backend,frames:model.frames||88200},data=>{
        if(data.type==='preparation-progress'&&Number.isSafeInteger(data.completed)&&Number.isSafeInteger(data.total)&&data.total>0&&data.total<=256&&data.completed>=1&&data.completed<=data.total)onProgress(data);
      },[weights]);
      this.identity=`${modelKey(model)}:${backend}`;this.preparingIdentity=null;return result;
    }catch(error){if(this.worker===worker)this.fail(error);throw error;}
  }
  async separate(model,channels,options={}){
    let published=0;
    const callbacks={...options,onChunk:data=>{published+=data.stems[0].length;options.onChunk?.(data);}};
    try{return await this.runSeparation(model,channels,callbacks);}
    catch(error){
      if(!options.fallback||(options.backend||'webgpu')!=='webgpu'||published||error.name==='AbortError'||error.code==='INVALID_AUDIO')throw error;
      options.onProgress?.({phase:'fallback',backend:'wasm',message:error.message});
      await this.prepare(model,'wasm');
      return {...await this.runSeparation(model,channels,{...callbacks,backend:'wasm'}),fallbackReason:error.message};
    }
  }
  async runSeparation(model,channels,{backend='webgpu',onProgress=()=>{},onChunk=()=>{},diagnostics=false,onDiagnostic=()=>{}}={}){
    if(!this.isPrepared(model,backend))throw Error('Préparez le modèle sélectionné avant de séparer.');
    if(channels.length!==2||channels.some(c=>!(c instanceof Float32Array)||!c.length||!c.every(Number.isFinite))||channels[0].length!==channels[1].length)throw Error('Audio invalide.');
    const left=channels[0].slice(),right=channels[1].slice();let committed=0;
    onProgress({phase:'inference',totalTracks:model.roles.length,progress:0});
    const result=await this.request({type:'run',left,right,diagnostics},data=>{
      if(data.type==='diagnostic'){onDiagnostic(data);return;}
      if(data.type!=='chunk')return;
      if(data.startFrame!==committed||data.sampleRate!==44100||data.stems?.length!==model.roles.length*2||data.stems.some(c=>!(c instanceof Float32Array)||!c.length||c.length!==data.stems[0].length||(!isVerifiedStreamChunk(data)&&!c.every(Number.isFinite)))||committed+data.stems[0].length>channels[0].length)throw Object.assign(Error('Bloc progressif invalide.'),{code:'INVALID_AUDIO'});
      committed+=data.stems[0].length;onChunk(Object.assign(data,{roles:model.roles}));
      onProgress({phase:'chunk-ready',chunkIndex:data.chunkIndex,totalChunks:data.totalChunks,completedFrames:committed,totalFrames:channels[0].length});
    },[left.buffer,right.buffer]);
    if(committed!==channels[0].length){this.cancel();throw Error('Séparation incomplète.');}
    return {...result,backend,profile:model.profile||'quality',frames:model.frames||88200};
  }
}
