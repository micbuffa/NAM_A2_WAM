// Bump the protocol when DSP/runtime/windowing changes invalidate timing comparisons.
// Fixed musical fixture and production adapters; never substitute a backend on failure.
export const BENCHMARK_PROTOCOL='slow-motion-dream-6s-v1';
export const BENCHMARK_SECONDS=6;
export const BENCHMARK_FIXTURE_SHA='4b431d535d235bd81b62f816f08c3f1afb6679d2706d84b3b75903b7df909507';
export function benchmarkMatrix(models,gpu){return models.flatMap(model=>model.backends.filter(b=>b==='wasm'||gpu&&b==='webgpu').map(backend=>({model,backend})));}
export function median(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2;}
export function benchmarkSummary(report,models){
 if(report?.protocol!==BENCHMARK_PROTOCOL||report.fixtureSha256!==BENCHMARK_FIXTURE_SHA)return [];
 return benchmarkMatrix(models,true).flatMap(({model,backend})=>{
  const runs=(Array.isArray(report.runs)?report.runs:[]).filter(r=>r&&r.modelId===model.id&&r.backend===backend&&r.status==='ok'&&r.identity===JSON.stringify([model.version,model.files.map(f=>f.sha256)])&&r.frames===264600&&r.totalMs>0&&Number.isFinite(r.totalMs)&&Number.isFinite(r.firstReadyMs)&&r.firstReadyMs>0&&r.firstReadyMs<=r.totalMs);
  return runs.length?[{modelId:model.id,backend,totalMs:median(runs.map(r=>r.totalMs)),firstReadyMs:median(runs.map(r=>r.firstReadyMs)),separationMs:median(runs.map(r=>r.separationMs)),count:runs.length}]:[];
 });
}
export class ModelBenchmark {
 constructor({manager,createRunner,now=()=>performance.now(),visibility=()=>globalThis.document?.visibilityState||'visible'}){Object.assign(this,{manager,createRunner,now,visibility});}
 ensureVisible(){if(this.visibility()!=='visible'){this.cancel();throw new DOMException('Onglet masqué : gardez le benchmark visible.','AbortError');}}
 cancel(){this.cancelled=true;this.runner?.cancel();}
 async run(matrix,channels,{repetitions=2,onResult=()=>{},onProgress=()=>{}}={}){
  if(this.busy)throw Error('Comparaison déjà en cours.');
  if(!Number.isInteger(repetitions)||repetitions<1||repetitions>3||channels.length!==2||channels.some(c=>!(c instanceof Float32Array)||c.length!==264600||!c.every(Number.isFinite)))throw Error('Le benchmark exige le même extrait stéréo de 6 s à 44,1 kHz.');
  this.ensureVisible();this.busy=true;this.cancelled=false;const runs=[];
  try{for(let trial=0;trial<repetitions;trial++)for(const {model,backend} of matrix){
   if(this.cancelled)throw new DOMException('Annulé','AbortError');
   this.ensureVisible();
   const row={visibilityGuarded:true,modelId:model.id,backend,trial,identity:JSON.stringify([model.version,model.files.map(f=>f.sha256)]),frames:channels[0].length};
   try{
    const status=await this.manager.getStatus(model);
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
    if(status.state!=='installed'){row.status=status.state==='missing'?'missing':'error';if(row.status==='error')row.error=`Cache modèle : ${status.state}`;continue;}
    this.runner=this.createRunner(model);const start=this.now();let first=null,committed=0;
    onProgress(`${model.label} · ${backend} · essai ${trial+1}/${repetitions} · préparation`);
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
    if(this.runner.prepare)await this.runner.prepare(model,backend,{onProgress:p=>onProgress(`${model.label} · ${backend} · compilation ${p.completed}/${p.total}`)});
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
    this.ensureVisible();const prepared=this.now();
    const accept=data=>{
     this.ensureVisible();const stems=data.stems;
     if(data.startFrame!==committed||stems?.length!==model.roles.length*2||stems.some(c=>!(c instanceof Float32Array)||c.length!==stems[0].length||!c.length||!c.every(Number.isFinite)))throw Error('Sorties audio invalides.');
     committed+=stems[0].length;if(committed>264600)throw Error('Sorties trop longues.');first??=this.now()-start;
    };
    const result=await this.runner.separate(model,channels,{backend,fallback:false,onChunk:accept,onProgress:p=>onProgress(`${model.label} · ${backend} · essai ${trial+1}/${repetitions} · ${p.phase||'calcul'}${p.totalModels>1?` · spécialiste ${(p.modelIndex??0)+1}/${p.totalModels}${p.trackRole?` · ${p.trackRole}`:''}`:''}`)});
    if(this.cancelled)throw new DOMException('Annulé','AbortError');
    if(result.backend!==backend)throw Error('Backend différent de celui demandé.');
    if(!committed&&result.stems)accept({...result,startFrame:0});
    if(committed!==264600)throw Error('Sorties incomplètes.');
    this.ensureVisible();const end=this.now();Object.assign(row,{status:'ok',totalMs:end-start,preparationMs:prepared-start,separationMs:end-prepared,firstReadyMs:first,runtimeVersion:result.runtimeVersion||null});
   }catch(e){if(this.cancelled||e.name==='AbortError')throw e;Object.assign(row,{status:'error',error:e.message});}
   finally{this.runner?.cancel();this.runner=null;if(!this.cancelled){runs.push(row);onResult({...row});}}
  }return runs;}finally{this.runner?.cancel();this.runner=null;this.busy=false;}
 }
}
