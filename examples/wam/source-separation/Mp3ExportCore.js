import {panMatrix} from './MixWaveform.js';
export function exportSnapshot(engine,settings){
 if(!engine?.tracks.length||engine.progressive&&!engine.complete)throw Error('Terminez ou annulez la séparation avant l’export.');
 const chunks=engine.progressive?engine.chunks:[{startFrame:0,tracks:engine.tracks}],segments=chunks.map(chunk=>({startFrame:chunk.startFrame,tracks:chunk.tracks.map(t=>({id:t.id,sampleRate:t.buffer.sampleRate,channels:Array.from({length:t.buffer.numberOfChannels},(_,c)=>t.buffer.getChannelData(c).slice())}))}));
 return {segments,totalFrames:engine.progressive?engine.totalFrames:engine.tracks[0].buffer.length,settings:settings.map(t=>({...t})),outputGain:engine.outputNode.gain.value*(engine.normalizationGain??1)};
}
export function prepareExport(input){
 if(!Number.isSafeInteger(input.totalFrames)||input.totalFrames<1||!Number.isFinite(input.outputGain)||input.outputGain<0||!input.settings?.length)throw Error('Mix à exporter invalide.');
 const solo=input.settings.some(t=>t.solo);let at=0;
 const segments=input.segments.map(segment=>{
  const length=segment.tracks[0]?.channels[0]?.length;
  if(segment.startFrame!==at||!length||at+length>input.totalFrames||segment.tracks.length!==input.settings.length)throw Error('Blocs export désalignés.');
  const tracks=segment.tracks.map(t=>{
   const s=input.settings.find(x=>x.id===t.id);if(!s||![1,2].includes(t.channels.length)||t.sampleRate!==44100||t.channels.some(c=>!(c instanceof Float32Array)||c.length!==length)||!Number.isFinite(s.volume)||!Number.isFinite(s.pan))throw Error('Pistes export invalides.');
   return {channels:t.channels,matrix:panMatrix(t.channels.length,s.pan),gain:s.muted||solo&&!s.solo?0:Math.max(0,Math.min(1.5,s.volume))*input.outputGain};
  });at+=length;return {length,tracks};
 });if(at!==input.totalFrames)throw Error('Mix incomplet.');return segments;
}
export function mixBlock(segment,start,count){
 const left=new Float32Array(count),right=new Float32Array(count);
 for(let j=0;j<count;j++){
  let l=0,r=0;for(const t of segment.tracks){const a=t.channels[0][start+j],b=t.channels[1]?.[start+j]??0;if(!Number.isFinite(a)||!Number.isFinite(b))throw Error('PCM export non fini.');const [ll,lr,rl,rr]=t.matrix;l+=(a*ll+b*lr)*t.gain;r+=(a*rl+b*rr)*t.gain;}
  left[j]=l;right[j]=r;if(!Number.isFinite(left[j])||!Number.isFinite(right[j]))throw Error('Mix export non fini.');
 }return [left,right];
}
export function encodeMixMp3(input,Mp3Encoder,onProgress=()=>{}){
 const segments=prepareExport(input);let peak=0,done=0,last=-1;
 const progress=(phase,value)=>{const percent=Math.floor(value);if(percent!==last){last=percent;onProgress({phase,percent});}};
 for(const segment of segments)for(let i=0;i<segment.length;i+=1152){const [l,r]=mixBlock(segment,i,Math.min(1152,segment.length-i));for(let j=0;j<l.length;j++)peak=Math.max(peak,Math.abs(l[j]),Math.abs(r[j]));done+=l.length;progress('Mesure du mix',done/input.totalFrames*20);}
 const attenuation=peak>1?.98/peak:1,encoder=new Mp3Encoder(2,44100,192),parts=[];done=0;
 for(const segment of segments)for(let i=0;i<segment.length;i+=1152){const pcm=mixBlock(segment,i,Math.min(1152,segment.length-i)).map(channel=>Int16Array.from(channel,value=>Math.round(Math.max(-1,Math.min(1,value*attenuation))*32767)));const bytes=encoder.encodeBuffer(pcm[0],pcm[1]);if(bytes.length)parts.push(new Uint8Array(bytes));done+=pcm[0].length;progress('Encodage MP3',20+done/input.totalFrames*80);}
 const tail=encoder.flush();if(tail.length)parts.push(new Uint8Array(tail));const bytes=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
 return {bytes,attenuation,peak,duration:input.totalFrames/44100};
}
