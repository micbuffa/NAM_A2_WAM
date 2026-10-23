export class Mp3Exporter {
 constructor({workerFactory=()=>new Worker(new URL('./mp3-export-worker.js',import.meta.url))}={}){this.workerFactory=workerFactory;}
 export(input,onProgress=()=>{}){
  if(this.worker)throw Error('Export déjà en cours.');const worker=this.workerFactory();this.worker=worker;
  return new Promise((resolve,reject)=>{
   this.reject=reject;
   const finish=()=>{worker.terminate();this.worker=null;this.reject=null;};
   worker.onmessage=({data})=>{if(this.worker!==worker)return;if(data.type==='progress')onProgress(data);else if(data.type==='done'){finish();resolve({...data,blob:new Blob([data.bytes],{type:'audio/mpeg'})});}else if(data.type==='error'){finish();reject(Error(data.message));}};
   worker.onerror=()=>{if(this.worker!==worker)return;finish();reject(Error('Échec du Worker MP3.'));};
   const transfer=input.segments.flatMap(s=>s.tracks.flatMap(t=>t.channels.map(c=>c.buffer)));try{worker.postMessage(input,transfer);}catch(error){finish();reject(error);}
  });
 }
 cancel(){this.worker?.terminate();this.worker=null;this.reject?.(new DOMException('Export annulé','AbortError'));this.reject=null;}
}
