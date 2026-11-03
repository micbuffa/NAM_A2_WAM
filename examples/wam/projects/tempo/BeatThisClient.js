// Downloader progress carries its own model id; preserve the request envelope id.
export const beatThisResponse=(id,type,payload)=>({...payload,id,type});
// One request at a time; termination cancels inference as well as downloads.
// Generation guard prevents late results from an obsolete model/job changing the UI.
export class BeatThisClient {
  constructor({workerFactory=()=>new Worker(new URL('./beat-this-worker.js',import.meta.url),{type:'module'}),onProgress=()=>{}}={}) {
    this.workerFactory=workerFactory;this.onProgress=onProgress;this.sequence=0;
  }
  request(action,options={},transfer=[]) {
    if(this.pending)return Promise.reject(Error('A Beat This operation is already running.'));
    const worker=this.worker ||=this.workerFactory(),id=++this.sequence;
    return new Promise((resolve,reject)=>{
      this.pending={resolve,reject};
      worker.onmessage=({data})=>{
        if(data.id!==id||this.sequence!==id||this.worker!==worker||!this.pending)return;
        if(data.type==='progress'){this.onProgress(data);return;}
        this.pending=null;
        if(data.type==='error'){const error=Error(data.message);error.diagnostics=data.diagnostics;reject(error);}else resolve(data.result);
      };
      worker.onerror=event=>{if(this.sequence!==id||this.worker!==worker||!this.pending)return;this.pending=null;worker.terminate();this.worker=null;reject(Error(event.message||'Beat This worker failed.'));};
      try{worker.postMessage({id,action,...options},transfer);}catch(error){this.pending=null;reject(error);}
    });
  }
  cancel(){this.worker?.terminate();this.worker=null;this.sequence++;const pending=this.pending;this.pending=null;pending?.reject(new DOMException('Cancelled','AbortError'));}
  dispose(){this.cancel();}
}
