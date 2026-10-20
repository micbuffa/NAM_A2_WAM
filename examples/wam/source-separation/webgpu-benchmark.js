import {OnnxDemucsRunner} from './OnnxDemucsRunner.js';
import {ModelCache} from './ModelCache.js';
import {ModelDownloadManager} from './ModelDownloadManager.js';
import {benchmarkInputs,prepareBenchmarkAudio} from './BenchmarkInputs.js';
import {compareAudio,analyzeSeparation} from './AudioComparison.js';
const $=id=>document.getElementById(id);
$('benchmarkAudio').replaceChildren(...benchmarkInputs.map(x=>new Option(x.label,x.id)));
function showCredits(){const input=benchmarkInputs.find(x=>x.id===$('benchmarkAudio').value);$('inputCredits').textContent=input.credits;if(input.notice){const link=document.createElement('a');link.href=input.notice;link.textContent=' — Crédits et licence';$('inputCredits').append(link);}}
$('benchmarkAudio').onchange=showCredits;showCredits();
const manager=new ModelDownloadManager({cache:new ModelCache()});
const runner=new OnnxDemucsRunner({manager});
let aborted=false;
const checkCancelled=()=>{if(aborted)throw new DOMException('Annulé','AbortError');};
$('run').onclick=async()=>{
  aborted=false;$('benchmarkAudio').disabled=true;$('run').disabled=true;$('cancel').disabled=false;$('result').textContent='';$('summary').replaceChildren();
  try {
    const manifest=await fetch('./models.json').then(r=>r.json()),model=manifest.models.find(m=>m.runtime==='demucs-onnx-core');
    const selected=benchmarkInputs.find(x=>x.id===$('benchmarkAudio').value);
    const response=await fetch(selected.url);if(!response.ok)throw Error('Audio de test indisponible.');
    const audio=await new OfflineAudioContext(2,1,44100).decodeAudioData(await response.arrayBuffer());
    checkCancelled();
    const {frames,channels,sourceChannels}=prepareBenchmarkAudio(audio),runs={},buffers={};
    for(const backend of ['webgpu','wasm']) {
      checkCancelled();
      const output=Array.from({length:8},()=>new Float32Array(frames));
      runs[backend]=await runner.separate(model,channels,{backend,fallback:false,diagnostics:true,
        onProgress:data=>{$('status').textContent=`${backend} — ${data.phase}${data.totalChunks?` — bloc ${data.chunkIndex+1}/${data.totalChunks}`:''}`;},
        onChunk:data=>data.stems.forEach((channel,i)=>output[i].set(channel,data.startFrame)),
      });
      buffers[backend]=output;
      $('result').textContent=JSON.stringify({runs},null,2);
    }
    const comparison=compareAudio(buffers.wasm,buffers.webgpu);
    const result={modelId:model.id,modelSha256:model.files[0].sha256,input:selected.id,inputLabel:selected.label,credits:selected.credits,inputSeconds:frames/44100,sourceChannels,sampleRate:44100,runs,comparison,analysis:{webgpu:analyzeSeparation(channels,buffers.webgpu,model.roles),wasm:analyzeSeparation(channels,buffers.wasm,model.roles)}};
    $('result').textContent=JSON.stringify(result,null,2);
    for(const backend of ['webgpu','wasm']) {
      const line=document.createElement('p');line.textContent=`${backend.toUpperCase()} : ${(runs[backend].elapsedMs/1000).toFixed(2)} s pour ${(frames/44100).toFixed(2)} s d’audio ; calcul/audio = ${(runs[backend].elapsedMs/(frames/44.1)).toFixed(2)}.`;$('summary').append(line);
    }
    const line=document.createElement('p');line.textContent=`Écart GPU/CPU : RMS relatif ${(comparison.relativeRmsError*100).toFixed(3)} % ; maximum absolu ${comparison.maxAbsError.toExponential(3)}. Fichier d’entrée : ${sourceChannels} canal/canaux ; quatre pistes stéréo.`;$('summary').append(line);
    $('status').textContent=comparison.withinTolerance?'Test réussi — sorties proches numériquement (pas une validation perceptuelle).':'Écart numérique supérieur au seuil du prototype — à examiner.';
  }catch(error){$('status').textContent=`${error.name==='AbortError'?'Annulé':'Échec'} : ${error.message}`;}
  finally{$('benchmarkAudio').disabled=false;$('run').disabled=false;$('cancel').disabled=true;}
};
$('cancel').onclick=()=>{aborted=true;runner.cancel();};window.addEventListener('pagehide',()=>runner.cancel());
