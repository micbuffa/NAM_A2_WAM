import './BackingTrackPlayerElement.js';
import {BackingTrackMix} from './BackingTrackMix.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function wav(sampleRate,duration=1.5,channels=2){
 const n=Math.floor(sampleRate*duration),bytes=new ArrayBuffer(44+n*2*channels),v=new DataView(bytes);
 const str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,36+n*2*channels,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2*channels,true);v.setUint16(32,2*channels,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,n*2*channels,true);
 for(let i=0;i<n;i++)for(let ch=0;ch<channels;ch++)v.setInt16(44+i*channels*2+ch*2,Math.sin(2*Math.PI*(ch?660:440)*i/sampleRate)*.1*32767,true);
 return new File([bytes],'Stereo reference.wav',{type:'audio/wav'});
}
export async function runBackingValidation(){
 const log=document.querySelector('#results');log.textContent='';const checks=[],measurements=[];
 const check=(v,label)=>{if(!v)throw Error(label);checks.push(label);log.textContent+=`PASS ${label}\n`;};
 for(const sampleRate of [44100,48000]){
 const context=new AudioContext({sampleRate});await context.resume();const player=document.createElement('backing-track-player');document.querySelector('#mount').append(player);let mix;
 try{
 await player.initialize({audioContext:context});const e=player.engine;check(player.library.tracks.length===29,'29 factory tracks '+sampleRate);check(e.stretchReady,'worklet ready '+sampleRate);
 const other=document.createElement('backing-track-player');document.querySelector('#mount').append(other);await other.initialize({audioContext:context});check(!other.engine.buffer,'second independent component');other.destroy();other.remove();
 const guitar=context.createGain();mix=new BackingTrackMix(context,guitar,player);mix.output.disconnect(context.destination);const sink=context.createGain();sink.gain.value=0;mix.output.connect(sink).connect(context.destination);
 check(mix.guitarGain.gain.value===1,'mount leaves guitar unity');
 await e.loadFile(wav(sampleRate));const original=e.buffer.getChannelData(0)[100];e.setNormalized(true);e.setNormalized(false);check(e.buffer.getChannelData(0)[100]===original,'normalization preserves original buffer');e.setVolumeDb(0);
 const split=context.createChannelSplitter(2),analysers=[context.createAnalyser(),context.createAnalyser()];e.outputNode.connect(split);analysers.forEach((a,i)=>{a.fftSize=4096;a.smoothingTimeConstant=0;split.connect(a,i);a.connect(sink);});
 for(const rate of [.7,1,1.3]){
 e.stop();e.setRate(rate);e.setLoop({enabled:false,startSeconds:0,endSeconds:e.duration});e.seek(0);const start=context.currentTime;await e.play();await wait(350);
 const frequencies=analysers.map(a=>{const spectrum=new Float32Array(a.frequencyBinCount);a.getFloatFrequencyData(spectrum);let index=1;for(let i=2;i<spectrum.length;i++)if(spectrum[i]>spectrum[index])index=i;const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);check(data.every(Number.isFinite)&&Math.max(...data.map(Math.abs))>.001,'finite non-silent DSP '+sampleRate+' '+rate);return index*sampleRate/a.fftSize;});
 check(Math.abs(frequencies[0]-440)<20&&Math.abs(frequencies[1]-660)<20,'pitch and stereo retained '+sampleRate+' '+rate);
 for(let i=0;e.playing&&i<80;i++)await wait(50);const elapsed=context.currentTime-start;
 check(!e.playing&&Math.abs(elapsed-e.duration/rate)<.18,'natural end and duration at '+rate);measurements.push({sampleRate,rate,frequencies,duration:elapsed});
 }
 e.setLoop({enabled:true,startSeconds:.8,endSeconds:.2});e.seek(.2);e.setRate(.7);await e.play();await wait(1100);check(e.position>=.2&&e.position<.8&&e.playing,'reverse-selected loop wraps with stretching');e.pause();const position=e.position;await wait(80);check(e.position===position,'pause freezes position');await e.play();await wait(60);check(e.position!==position,'resume advances');e.stop();check(e.position===.2,'stop returns to loop start');
 let invalid=false;try{e.setLoop({startSeconds:.2,endSeconds:.2});}catch{invalid=true;}check(invalid,'zero length loop rejected');
 e.setMix(.8);e.setGuitarPan(-.4);e.seek(.3);const saved=JSON.parse(JSON.stringify(e.getState()));e.setMix(.1);await e.setState(saved);check(!e.playing&&e.mix===.8&&e.guitarPan===-.4&&e.position===.3,'state restored without autoplay');
 await e.play();await wait(100);check(Math.abs(mix.guitarGain.gain.value-.4)<.02,'mix affects independent guitar branch');e.pause();await wait(100);check(Math.abs(mix.guitarGain.gain.value-1)<.02,'pause restores guitar unity');
 const old=e.buffer;let failed=false;try{await e.loadFile(new File(['invalid'],'broken.mp3'));}catch{failed=true;}check(failed&&e.buffer===old,'decode failure preserves previous track');
 if(sampleRate===48000){await e.loadTrack(player.library.tracks[0].id);check(e.duration>10&&e.track.id===player.library.tracks[0].id,'bundled MP3 decodes');const pending=e.loadTrack(player.library.tracks[1].id);await e.loadFile(wav(sampleRate));await pending;check(e.track.local,'latest selection wins');}
 await e.loadFile(wav(sampleRate,1.5,1));e.setRate(.7);await e.play();await wait(250);
 const voice=e.voice;e.setRate(.8);await wait(100);check(e.voice===voice,'continuous worklet retained across stretched rates');
 const mono=analysers.map(a=>{const data=new Float32Array(a.fftSize);a.getFloatTimeDomainData(data);return Math.max(...data.map(Math.abs));});check(mono.every(v=>v>.001)&&Math.abs(mono[0]-mono[1])<.001,'mono remains centered with stretching');e.stop();
 player.$('expand').click();await wait(30);check(player.$('body').hidden,'compact mode');player.$('expand').click();await wait(30);
 }finally{mix?.destroy();player.destroy();player.remove();await context.close();}
 }
 log.textContent+='COMPLETE\n';return {checks,measurements};
}
window.runBackingValidation=runBackingValidation;document.querySelector('#run').onclick=async()=>{try{await runBackingValidation();}catch(e){document.querySelector('#results').textContent+=`FAIL ${e.stack}`;}};
