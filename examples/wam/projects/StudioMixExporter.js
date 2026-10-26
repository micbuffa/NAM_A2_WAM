import {trackGain} from './ProjectsModel.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
export function mixSources(tracks,channels) {
  const sources=tracks.filter(track=>track.audio);
  if(!sources.length)throw Error('No recorded audio to export.');
  if(sources.some(track=>track.presetId || track.factoryPreset))throw Error('Preset rendering is not validated yet. Export the separated instruments instead.');
  if(sources.some(track=>track.inputMonitoring))throw Error('Turn off input monitoring before exporting recorded audio.');
  if(sources.some(track=>!channels.get(track.id)?.buffer))throw Error('Wait for every audio file to load before exporting.');
  if(sources.some(track=>track.id<1 || !track.audio.checksum))throw Error('Save project before using this mix in Tone.');
  return sources;
}
export function exportRange(duration,loop,selection='song') {
  if(selection==='song')return {start:0,end:duration};
  if(selection!=='loop' || !loop || loop.end-loop.start<.05 || loop.start<0 || loop.end>duration+.001)throw Error('Select an A/B loop first.');
  return {start:loop.start,end:Math.min(duration,loop.end)};
}
export async function renderRecordedMix({tracks,channels,range,createContext=frames=>new OfflineAudioContext(2,frames,44100)}) {
  const sources=mixSources(tracks,channels),frames=Math.round((range.end-range.start)*44100);
  if(!Number.isSafeInteger(frames)||frames<1||frames*8>512*1024**2)throw Error('Rendered mix exceeds the 512 MiB working buffer limit.');
  const context=createContext(frames);
  // Build a fresh offline graph with precisely the player's gain and native
  // StereoPanner. Never connect to Tone, inserts, monitoring or the speakers.
  for(let i=0;i<sources.length;i++) {
    const track=sources[i],buffer=channels.get(track.id).buffer;
    const duration=Math.min(range.end,buffer.duration)-range.start;
    if(duration<=0)continue;
    const node=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();
    node.buffer=buffer;gain.gain.value=trackGain(track,tracks);pan.pan.value=track.pan/100;
    node.connect(gain).connect(pan).connect(context.destination);node.start(0,range.start,duration);
    if(i%8===7)await tick();
  }
  return context.startRendering();
}
export class StudioMixExporter {
  constructor({api,render=renderRecordedMix,workerFactory=()=>new Worker(new URL('./mix-mp3-worker.js',import.meta.url)),token=()=>crypto.randomUUID()}) {
    Object.assign(this,{api,render,workerFactory,token});this.epoch=0;
  }
  invalidate() { ++this.epoch; this.pending=null; }
  current(epoch) { if(epoch!==this.epoch)throw new DOMException('Project or account changed during export','AbortError'); }
  async encode(buffer,onProgress=()=>{}) {
    const worker=this.workerFactory();
    const request=data=>new Promise((resolve,reject)=>{
      worker.onmessage=({data})=>data.type==='progress'?onProgress(data.percent):data.type==='error'?reject(Error(data.message)):resolve(data);
      worker.onerror=event=>reject(Error(event.message||'MP3 worker failed'));
      worker.postMessage(data,data.type==='packet'?[data.left.buffer,data.right.buffer]:[]);
    });
    try {
      await request({type:'init',frames:buffer.length});
      for(let start=0;start<buffer.length;start+=44100) {
        await request({type:'packet',left:buffer.getChannelData(0).slice(start,start+44100),right:buffer.getChannelData(1).slice(start,start+44100)});
      }
      const result=await request({type:'finish'});
      return {...result,blob:new Blob(result.parts,{type:'audio/mpeg'})};
    } finally {worker.terminate();}
  }
  async export({project,tracks,channels,range,separationId=null,selection='song'},onProgress=()=>{}) {
    const epoch=this.epoch;
    const sources=mixSources(tracks,channels),snapshot=structuredClone(sources);
    const key=JSON.stringify({projectId:project.id,tracks:snapshot.map(track=>[track.id,track.audio.checksum,track.volume,track.pan,track.mute,track.solo]),range,separationId,selection});
    if(this.pending?.key===key)return this.retry(onProgress);
    onProgress('Rendering recorded mix…');
    const buffer=await this.render({tracks:snapshot,channels,range});this.current(epoch);
    onProgress('Preparing MP3…');
    const result=await this.encode(buffer,percent=>onProgress(`Encoding MP3 · ${percent}%`,percent));this.current(epoch);
    const manifest={selection,format:'mp3',sampleRate:44100,bitrate:192,frames:buffer.length,range,separationId,
      peak:result.peak,attenuation:result.attenuation,sources:snapshot.map(track=>({id:track.id,checksum:track.audio.checksum,volume:track.volume,pan:track.pan,mute:Boolean(track.mute),solo:Boolean(track.solo),inputMonitoring:false}))};
    // Retain bytes/token after an upload failure. Retrying this unchanged mix
    // does not re-render and cannot create a duplicate after a lost response.
    this.pending={key,projectId:project.id,token:this.token(),manifest,blob:result.blob};
    return this.retry(onProgress);
  }
  async retry(onProgress=()=>{}) {
    const epoch=this.epoch,pending=this.pending;if(!pending)throw Error('No pending mix export');
    onProgress('Saving backing track…');
    const backing=await this.api.createMix(pending.projectId,{token:pending.token,manifest:pending.manifest},pending.blob);
    this.current(epoch);this.pending=null;return backing;
  }
}


// Explain every disabled state beside the action, not only in a hover title.
export function mixExportAvailability({owned,working,separating,pending,tracks,channels,toneReady=true}) {
  const blocked=(message,failedIds=[])=>({ready:false,message,failedIds});
  if(!owned)return blocked('Only the project owner can create a backing track.');
  if(working)return blocked('Preparing and saving audio…');
  if(separating)return blocked('Wait for separation to finish, or Stop separation, then Save project.');
  if(pending)return blocked('Save project first to upload the instruments. Then use their mix in Tone.');
  const audio=tracks.filter(track=>track.audio);
  if(!audio.length)return blocked('Import an audio file before creating a backing track.');
  const failed=audio.filter(track=>channels.get(track.id)?.error);
  if(failed.length)return blocked(`Saved audio could not be loaded: ${failed.map(track=>`${track.name} (${channels.get(track.id).error.message})`).join(', ')}. Your saved project is kept. Retry audio loading.`,failed.map(track=>track.id));
  const loaded=audio.filter(track=>channels.get(track.id)?.buffer).length;
  if(loaded<audio.length)return blocked(`Preparing saved audio · ${loaded}/${audio.length} tracks ready. The button becomes available when all tracks are loaded.`);
  if(audio.some(track=>track.presetId || track.factoryPreset))return blocked('Export a separated-instrument mix or tracks without presets. WAM preset rendering is not available yet.');
  if(audio.some(track=>track.inputMonitoring))return blocked('Turn off input monitoring before exporting the recorded mix.');
  if(!toneReady)return blocked('Preparing the Tone backing-track player…');
  return {ready:true,failedIds:[],message:'Ready: Use mix in Tone creates a saved MP3 backing and opens Tone. Press Play there to listen.'};
}
