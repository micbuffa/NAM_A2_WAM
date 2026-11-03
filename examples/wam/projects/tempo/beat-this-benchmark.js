import {TempoPreviewView} from './TempoPreviewView.js';
import {readPcm16Wav} from './BeatThisInput.js';
import {BeatThisClient} from './BeatThisClient.js';
const $=id=>document.getElementById(id);
const preview=new TempoPreviewView(document);
let installed=false,busy=false,decoded=null,result=null,audioURL=null,inputVersion=0,decodeMs=0,sourceKind='none';
const local=new URL(location.href).searchParams.has('localModel');
const assetBase=local?new URL('../../source-separation/model-assets/beat-this/',import.meta.url).href:undefined;
const client=new BeatThisClient({onProgress:p=>{
  const labels={checking:'Vérification SHA-256 du cache…',downloading:`Téléchargement : ${Math.round(100*(p.received||0)/(p.total||1))} %`,verifying:'Vérification SHA-256…',saving:'Sauvegarde du cache…',installed:'Modèle disponible.',features:'Calcul du spectrogramme…',preparingGraph:'Préparation et vérification du graphe…',initializing:`Initialisation ${p.backend}…`,processing:`Analyse · fenêtre ${p.window}/${p.windows}…`,parity:`Qualification GPU contre WASM · fenêtre ${p.window}/${p.windows}…`};
  $('status').textContent=labels[p.state]||p.state;
  if(p.total)$('progress').value=p.received/p.total;
  else if(p.fraction!==undefined)$('progress').value=p.fraction;
  else if(p.windows)$('progress').value=(p.window-1)/p.windows;
  else $('progress').removeAttribute('value');
}});
function controls(){preview.setBusy(busy);for(const id of ['file','synthetic','duration','backend','install','remove'])$(id).disabled=busy; $('analyse').disabled=busy||!installed||!decoded;$('cancel').disabled=!busy;$('export').disabled=busy||!result;}
function clearResult(){preview.clear();result=null;$('summary').textContent='Aucune analyse pour cette sélection.';$('timing').replaceChildren();$('beats').getContext('2d').clearRect(0,0,1000,180);$('log').textContent='';}
function error(e){$('progress').value=0;$('status').textContent=e.name==='AbortError'?'Annulé.':`Erreur : ${e.message}`;$('log').textContent=(e.stack||e.message)+(e.diagnostics?'\n'+JSON.stringify(e.diagnostics,null,2):'');}
async function operation(task){busy=true;controls();try{return await task();}catch(e){error(e);}finally{busy=false;controls();}}
async function status(){const state=await client.request('status',{assetBase});installed=state.state==='installed';$('cache').textContent=installed?'Modèle disponible dans le cache et vérifié.':`Cache : ${state.state}. Téléchargement requis.`;if(local)$('cache').textContent+=' Source de qualification locale.';controls();}
$('install').onclick=()=>operation(async()=>{await client.request('install',{assetBase});installed=true;$('cache').textContent='Modèle disponible dans le cache et vérifié.';$('progress').value=1;});
$('remove').onclick=()=>operation(async()=>{await client.request('remove',{assetBase});installed=false;$('cache').textContent='Modèle supprimé du cache.';$('status').textContent='Prêt.';$('progress').value=0;});
$('cancel').onclick=()=>{inputVersion++;client.cancel();$('status').textContent='Annulé.';$('progress').value=0;};
function setAudio(blob){if(audioURL)URL.revokeObjectURL(audioURL);audioURL=URL.createObjectURL(blob);$('audio').src=audioURL;}
$('file').onchange=()=>operation(async()=>{
  const file=$('file').files[0];if(!file)return;
  decoded=null;clearResult();const version=++inputVersion;
  $('status').textContent='Décodage audio…';
  const decodeStart=performance.now(),bytes=await file.arrayBuffer(),exact=readPcm16Wav(bytes);
  let audio;
  if(exact){audio=new AudioBuffer({length:exact.channels[0].length,sampleRate:22050,numberOfChannels:exact.channels.length});exact.channels.forEach((channel,c)=>audio.copyToChannel(channel,c));}
  else audio=await new OfflineAudioContext(1,1,22050).decodeAudioData(bytes);
  if(version!==inputVersion)return;
  decoded=audio;decodeMs=performance.now()-decodeStart;sourceKind=exact?'pcm16-wav':'file';setAudio(file);
  $('source').textContent=`${file.name} · ${audio.duration.toFixed(2)} s · ${audio.sampleRate} Hz · ${audio.numberOfChannels} canal(aux)${exact?' · PCM16 exact':''}`;$('status').textContent='Audio prêt.';
});
function wav(pcm,sampleRate){const b=new ArrayBuffer(44+pcm.length*2),v=new DataView(b);const txt=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));txt(0,'RIFF');v.setUint32(4,36+pcm.length*2,true);txt(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);txt(36,'data');v.setUint32(40,pcm.length*2,true);for(let i=0;i<pcm.length;i++)v.setInt16(44+2*i,Math.max(-1,Math.min(1,pcm[i]))*32767,true);return new Blob([b],{type:'audio/wav'});}
$('synthetic').onclick=()=>{
  inputVersion++;const rate=22050,pcm=new Float32Array(12*rate);
  for(let n=0;n<24;n++)for(let i=0;i<rate*.12;i++){const t=i/rate;pcm[Math.round(n*.5*rate)+i]+=(n%4===0?.75:.4)*Math.exp(-45*t)*Math.sin(2*Math.PI*(n%4===0?85:330)*t);}
  sourceKind='synthetic';decodeMs=0;decoded=new AudioBuffer({length:pcm.length,sampleRate:rate,numberOfChannels:1});decoded.copyToChannel(pcm,0);
  setAudio(wav(pcm,rate));$('source').textContent='Rythmique synthétique de qualification · 12,00 s · 22 050 Hz · 120 BPM · accents tous les 4 temps (sans garantie de reconnaissance ML).';$('status').textContent='Audio prêt.';clearResult();controls();
};
$('analyse').onclick=()=>operation(async()=>{
  clearResult();const version=++inputVersion,duration=Math.min(decoded.duration,Number($('duration').value));
  $('status').textContent='Préparation de la copie audio…';
  // Mean the decoded channels explicitly; do not use Web Audio speaker rematrix.
  const length=Math.min(decoded.length,Math.ceil(duration*decoded.sampleRate));
  let mono=new Float32Array(length);for(let c=0;c<decoded.numberOfChannels;c++){const channel=decoded.getChannelData(c);for(let i=0;i<length;i++)mono[i]+=channel[i]/decoded.numberOfChannels;}
  if(version!==inputVersion)throw new DOMException('Cancelled','AbortError');
  const sourceDescription=$('source').textContent;
  const output=await client.request('analyse',{assetBase,backend:$('backend').value,channels:[mono],sampleRate:22050,includeLogits:true},[mono.buffer]);
  if(version!==inputVersion)return;
  result={...output,source:sourceDescription,resampler:sourceKind==='file'?'browser decodeAudioData at 22050 Hz':'none (exact PCM)' ,decodeMs,createdAt:new Date().toISOString(),userAgent:navigator.userAgent};
  $('status').textContent=result.shortWindowPadded?'Analyse terminée · extrait court : diagnostic seulement.':'Analyse terminée.';$('progress').value=1;
  $('summary').textContent=`${result.beats.length} battements · ${result.downbeats.length} débuts de mesures · BPM médian : ${result.medianBpm?.toFixed(2)||'indéterminé'} · ${result.duration.toFixed(2)} s analysées. ${result.windowMode==='dynamic'?'Contexte court réel, sans complément à 30 s. ':''}${result.backend==='webgpu'&&result.executionGraph?.workaround?'WebGPU : normalisation corrigée, parité WASM vérifiée. ':''}Aucune carte appliquée au Studio.`;
  $('timing').replaceChildren();for(const [label,ms] of Object.entries({...result.timing,decodeMs}).filter(([,value])=>typeof value==='number')){const row=document.createElement('tr');for(const text of [label.replace(/Ms$/,''),(ms/1000).toFixed(3)]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}$('timing').append(row);}
  $('log').textContent=JSON.stringify({...result,logits:undefined},null,2);
  preview.setSource(decoded,result);
});
$('export').onclick=()=>{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({...result,proposal:preview.exportProposal()},null,2)],{type:'application/json'}));a.href=url;a.download=`beat-this-${Date.now()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
window.addEventListener('pagehide',()=>{client.dispose();preview.dispose();if(audioURL)URL.revokeObjectURL(audioURL);});
operation(status);
