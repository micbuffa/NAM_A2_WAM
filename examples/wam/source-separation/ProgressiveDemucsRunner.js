import {StreamingWorker,isVerifiedStreamChunk} from './StreamTransport.js';
import {validateSegmentSeconds} from './SegmentSettings.js';
import {modelKey} from './ModelDownloadManager.js';

export class ProgressiveDemucsRunner {
  constructor({manager,workerFactory=()=>new Worker(new URL('./progressive-worker.js',import.meta.url))}) { this.manager=manager;this.workerFactory=workerFactory; }
  async separate(model,channels,{onProgress=()=>{},onChunk=()=>{},segmentSeconds=0}={}) {
    validateSegmentSeconds(segmentSeconds);
    if(this.busy)throw Error('Une séparation est déjà en cours.');
    if(model.id!=='htdemucs_6s'||channels.length!==2||channels.some(c=>!(c instanceof Float32Array)||!c.every(Number.isFinite))||!channels[0].length||channels[0].length!==channels[1].length||channels[0].length>86400*44100)throw Error('Mode progressif : htdemucs_6s, 24 heures maximum.');
    this.busy=true;this.cancelled=false;let committed=0;let chunkInfo={};
    try {
      onProgress({phase:'cache'});
      if((await this.manager.getStatus(model)).state!=='installed')throw Error('Modèle non disponible.');
      const record=await this.manager.cache.get(modelKey(model));
      if(this.cancelled)throw new DOMException('Annulé','AbortError');
      return await new Promise((resolve,reject)=>{
        this.reject=reject;const worker=this.worker=new StreamingWorker(this.workerFactory(),12);let settled=false;
        worker.onerror=e=>{settled=true;reject(Error(e.message||'Erreur du Worker progressif.'));};
        worker.onmessage=({data})=>{
          if(this.cancelled||settled||this.worker!==worker)return;
          try {
            if(data.type==='error')throw Error(data.message);
            if(data.type==='progress'){chunkInfo=data;onProgress(data);}
            else if(data.msg==='PROGRESS_UPDATE')onProgress({...chunkInfo,progress:data.data});
            else if(data.type==='chunk') {
              if(data.sampleRate!==44100||data.startFrame!==committed||data.stems?.length!==12||data.stems.some(c=>!(c instanceof Float32Array)||!c.length||c.length!==data.stems[0].length||(!isVerifiedStreamChunk(data)&&!c.every(Number.isFinite)))||committed+data.stems[0].length>channels[0].length)throw Error('Bloc progressif invalide.');
              committed+=data.stems[0].length;
              onChunk(Object.assign(data,{roles:model.roles}));
              onProgress({phase:'chunk-ready',chunkIndex:data.chunkIndex,totalChunks:data.totalChunks,completedFrames:committed,totalFrames:channels[0].length});
            } else if(data.type==='done') {
              if(committed!==channels[0].length)throw Error('Séparation progressive incomplète.');
              for(let i=0;i<model.roles.length;i++)onProgress({phase:'track-complete',trackIndex:i,trackRole:model.roles[i],totalTracks:6});
              settled=true;resolve({...data,backend:'wasm',sampleRate:44100});
            }
          } catch(error){settled=true;reject(error);}
        };
        const left=channels[0].slice(),right=channels[1].slice();
        this.worker.postMessage({weights:record.files[0],left,right,segmentSeconds},[record.files[0],left.buffer,right.buffer]);
      });
    } finally {this.worker?.terminate();this.worker=null;this.reject=null;this.busy=false;}
  }
  cancel(){this.cancelled=true;this.worker?.terminate();this.reject?.(new DOMException('Annulé','AbortError'));}
}
