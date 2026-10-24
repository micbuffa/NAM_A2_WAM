import {SeparationProgress,separationMessage} from './SeparationProgress.js';
// Listening comparisons only: without original stems, no separation-quality score.
export function instrumentRole(model,instrument){
 if(!['bass','guitar'].includes(instrument))throw Error('Instrument invalide.');
 const role=instrument==='guitar'&&!model.roles.includes('guitar')?'other':instrument;
 if(!model.roles.includes(role))throw Error('Piste instrument absente.');return role;
}
export function listeningPair(model,stems,instrument){
 const role=instrumentRole(model,instrument),index=model.roles.indexOf(role),frames=stems?.[0]?.length;
 if(!frames||stems.length!==model.roles.length*2||stems.some(c=>!(c instanceof Float32Array)||c.length!==frames||!c.every(Number.isFinite)))throw Error('Pistes invalides.');
 const isolated=stems.slice(index*2,index*2+2),backing=[new Float32Array(frames),new Float32Array(frames)];
 for(let r=0;r<model.roles.length;r++)if(r!==index)for(let c=0;c<2;c++)for(let f=0;f<frames;f++)backing[c][f]+=stems[r*2+c][f];
 return {role,isolated,backing};
}
// IEEE float WAV preserves model levels, including peaks above full scale.
export function listeningWav(channels){
 const frames=channels?.[0]?.length;
 if(channels?.length!==2||!frames||channels.some(c=>!(c instanceof Float32Array)||c.length!==frames||!c.every(Number.isFinite)))throw Error('Audio invalide.');
 const bytes=new ArrayBuffer(44+frames*8),view=new DataView(bytes);let peak=0,overRangeSamples=0;
 const str=(offset,s)=>{for(let i=0;i<s.length;i++)view.setUint8(offset+i,s.charCodeAt(i));};
 str(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,3,true);view.setUint16(22,2,true);view.setUint32(24,44100,true);view.setUint32(28,352800,true);view.setUint16(32,8,true);view.setUint16(34,32,true);str(36,'data');view.setUint32(40,frames*8,true);
 for(let f=0;f<frames;f++)for(let c=0;c<2;c++){const x=channels[c][f];peak=Math.max(peak,Math.abs(x));if(Math.abs(x)>1)overRangeSamples++;view.setFloat32(44+(f*2+c)*4,x,true);}
 return {bytes,peak,overRangeSamples,frames};
}
export class InstrumentComparison {
 constructor({manager,createRunner}){Object.assign(this,{manager,createRunner});}
 cancel(){this.cancelled=true;this.runner?.cancel();}
 async run(matrix,channels,{onResult=()=>{},onProgress=()=>{}}={}){
  if(this.busy)throw Error('Comparaison en cours.');
  if(channels?.length!==2||!channels[0].length||channels[0].length>44100*30||channels.some(c=>!(c instanceof Float32Array)||c.length!==channels[0].length||!c.every(Number.isFinite)))throw Error('Extrait stéréo de 30 s maximum requis.');
  this.busy=true;this.cancelled=false;
  try{for(const {model,backend} of matrix){
   if(this.cancelled)throw new DOMException('Annulé','AbortError');
   let stems;const frames=channels[0].length;let committed=0;
   try{
    if(!model.backends.includes(backend))throw Error('Backend non supporté.');
    const status=await this.manager.getStatus(model);
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
    if(status.state!=='installed')throw Error('Modèle absent du cache : téléchargez-le dans Settings.');
    this.runner=this.createRunner(model);onProgress(`${model.label} · ${backend} · préparation`);
    if(this.runner.prepare)await this.runner.prepare(model,backend,{onProgress:p=>onProgress(`${model.label} · préparation ${p.completed}/${p.total}`)});
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
    stems=Array.from({length:model.roles.length*2},()=>new Float32Array(frames));
    const accept=chunk=>{
     if(this.cancelled)throw new DOMException('Annulé','AbortError');
     const data=chunk.stems,n=data?.[0]?.length;
     if(chunk.startFrame!==committed||data?.length!==stems.length||!n||committed+n>frames||data.some(c=>!(c instanceof Float32Array)||c.length!==n||!c.every(Number.isFinite)))throw Error('Blocs audio invalides ou désordonnés.');
     data.forEach((c,i)=>stems[i].set(c,committed));committed+=n;
    };
    const progress=new SeparationProgress();
    const result=await this.runner.separate(model,channels,{backend,fallback:false,onChunk:accept,onProgress:p=>onProgress(`${model.label} · ${backend} · ${separationMessage(p)} · ${progress.update(p)} %`)});
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
    if(result.backend!==backend)throw Error('Backend inattendu.');
    if(!committed&&result.stems)accept({...result,startFrame:0});
    if(committed!==frames)throw Error('Audio incomplet.');
    await onResult({model,backend,stems,status:'ok'});
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
   }catch(error){if(this.cancelled||error.name==='AbortError')throw error;await onResult({model,backend,status:'error',error:error.message});}
   finally{this.runner?.cancel();this.runner=null;stems=null;}
  }}finally{this.runner?.cancel();this.runner=null;this.busy=false;}
 }
}
