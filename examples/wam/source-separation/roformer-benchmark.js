import {MultitrackSession} from './MultitrackSession.js';
import {PreparedDemucsRunner} from './PreparedDemucsRunner.js';
import {compareAudio,analyzeSeparation} from './AudioComparison.js';
import {ROFORMER_ROLES,roformerStft} from './RoformerDSP.js';
import {ProgressiveMultitrackEngine} from './ProgressiveMultitrackEngine.js';
import {makeTracks} from './AudioData.js';
const $=id=>document.getElementById(id),base='../../../third_party/bs-roformer-audit/';
const model={id:'bs-roformer-sw-probe',version:'a744f80957374e1735ad70fa122670b7961da8cc',roles:ROFORMER_ROLES,frames:176400,files:[{sha256:'d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444'}]};
let weights,engine,mix,context,generation=0,backend,preparation;
const fetchBytes=async name=>{const r=await fetch(base+name);if(!r.ok)throw Error(`Artefact local absent : ${name}. Voir MODEL_CANDIDATES.md.`);return r.arrayBuffer();};
const runner=new PreparedDemucsRunner({manager:{cache:{get:async()=>({files:[weights.slice(0)]})},verifyRecord:async()=>true},workerFactory:()=>new Worker(new URL('./roformer-worker.js',import.meta.url),{type:'module'}),timeoutMs:180000});
function reset(){++generation;runner.cancel();engine?.destroy();engine=null;$('play').disabled=$('stop').disabled=$('run').disabled=true;}
$('backend').onchange=()=>{reset();$('status').textContent='Backend changé : préparer à nouveau.';};
$('prepare').onclick=async()=>{
 reset();const token=generation;$('prepare').disabled=true;$('cancel').disabled=false;$('backend').disabled=true;
 try{
  $('status').textContent='Chargement des poids vérifiés…';weights??=await fetchBytes('bs_roformer_sw_6stem_fp16.onnx');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',weights))].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(hash!==model.files[0].sha256)throw Error('SHA-256 invalide.');if(token!==generation)return;
  backend=$('backend').value;$('status').textContent='Compilation puis préchauffage sur silence…';preparation=await runner.prepare(model,backend);
  if(token!==generation)return;$('status').textContent='Modèle prêt en mémoire.';$('run').disabled=false;
 }catch(error){if(token===generation){$('status').textContent=error.message;runner.cancel();}}
 finally{if(token===generation){$('prepare').disabled=false;$('cancel').disabled=true;$('backend').disabled=false;}}
};
$('run').onclick=async()=>{
 const token=++generation,input=$('input').value,frames=input==='music'?264600:176400;
 $('run').disabled=$('prepare').disabled=$('backend').disabled=$('input').disabled=true;$('cancel').disabled=false;
 try{
  const [pcm,reference]=await Promise.all([fetchBytes(input==='music'?'music-input.f32':'reference-input.f32'),fetchBytes(input==='music'?'music-reference.f32':'reference-audio.f32')]);if(token!==generation)return;
  const planar=new Float32Array(pcm),ref=new Float32Array(reference),channels=[planar.slice(0,frames),planar.slice(frames)],expected=Array.from({length:12},(_,i)=>ref.slice(i*frames,(i+1)*frames));
  if(planar.length!==frames*2||ref.length!==frames*12)throw Error('Référence PCM invalide.');
  context??=new AudioContext({sampleRate:44100});await context.resume();if(token!==generation)return;
  engine?.destroy();engine=new ProgressiveMultitrackEngine(context);engine.startStream({totalFrames:frames,roles:ROFORMER_ROLES});mix=new MultitrackSession(engine.tracks);engine.sync(mix.tracks);engine.setLoop(false);engine.outputNode.connect(context.destination);engine.outputNode.gain.value=.4;
  engine.addEventListener('statechange',()=>{$('buffer').textContent=`${engine.availableDuration.toFixed(1)} s disponibles`;$('play').disabled=!engine.ready;});
  const output=Array.from({length:12},()=>new Float32Array(frames));let firstReadyMs=null;const start=performance.now();
  const run=await runner.separate(model,channels,{backend,onChunk:data=>{if(token!==generation)return;data.stems.forEach((c,i)=>output[i].set(c,data.startFrame));engine.append(data.startFrame,makeTracks(context,data));firstReadyMs??=performance.now()-start;$('play').disabled=$('stop').disabled=false;},onProgress:p=>{$('status').textContent=`${backend} · ${p.phase} · ${p.completedFrames?`${(p.completedFrames/44100).toFixed(1)} s`:''}`;}});
  if(token!==generation)return;engine.finish();
  const comparison=compareAudio(expected,output),perChannel=expected.map((c,i)=>({role:ROFORMER_ROLES[Math.floor(i/2)],channel:i%2,...compareAudio([c],[output[i]])}));
  const result={input,backend,frames,preparation,run,firstReadyMs,comparison,perChannel,passed:perChannel.every(c=>c.withinTolerance),analysis:analyzeSeparation(channels,output,ROFORMER_ROLES)};
  if(input==='reference'){
   const spec=roformerStft(channels),nativeReal=new Float32Array(await fetchBytes('reference-spec-real.f32')),nativeImag=new Float32Array(await fetchBytes('reference-spec-imag.f32'));
   result.stftComparison=compareAudio([nativeReal,nativeImag],[spec.real,spec.imag]);
  }
  if(token!==generation)return;
  $('result').textContent=JSON.stringify(result,null,2);$('status').textContent=result.passed?'Validation réussie · douze canaux dans les seuils.':'Écart supérieur aux seuils · ne pas activer le modèle dans le host.';
  $('stems').replaceChildren(...ROFORMER_ROLES.map((role,i)=>{const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.onchange=()=>{mix.updateTrack(`${role}-${i}`,{muted:box.checked});engine.sync(mix.tracks);};label.append(box,` Mute ${role}`);return label;}));
 }catch(error){if(token===generation){engine?.finish(true);$('status').textContent=error.message;}}
 finally{if(token===generation){$('run').disabled=!runner.isPrepared(model,backend);$('prepare').disabled=$('backend').disabled=$('input').disabled=false;$('cancel').disabled=true;}}
};
$('cancel').onclick=()=>{reset();$('prepare').disabled=$('backend').disabled=$('input').disabled=false;$('cancel').disabled=true;$('status').textContent='Annulé.';};
$('play').onclick=()=>engine?.play().catch(e=>{$('status').textContent=e.message;});$('stop').onclick=()=>engine?.stop();
window.addEventListener('pagehide',()=>{reset();context?.close();});
