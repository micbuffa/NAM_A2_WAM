import {trackGain} from './ProjectsModel.js';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
export function mixSources(tracks,channels,{persisted=true}={}) {
  const sources=tracks.filter(track=>track.audio);
  if(!sources.length)throw Error('No recorded audio to export.');
  if(sources.some(track=>track.presetId || track.factoryPreset || track.presetSnapshot))throw Error('Preset rendering is not validated yet. Export the separated instruments instead.');
  if(sources.some(track=>track.inputMonitoring))throw Error('Turn off input monitoring before exporting recorded audio.');
  if(sources.some(track=>!channels.get(track.id)?.buffer))throw Error('Wait for every audio file to load before exporting.');
  if(persisted&&sources.some(track=>track.id<1 || !track.audio.checksum))throw Error('Save project before using this mix in Tone.');
  return sources;
}
export function exportRange(duration,loop,selection='song') {
  if(selection==='song')return {start:0,end:duration};
  if(selection!=='loop' || !loop || loop.end-loop.start<.05 || loop.start<0 || loop.end>duration+.001)throw Error('Select an A/B loop first.');
  return {start:loop.start,end:Math.min(duration,loop.end)};
}
export async function renderRecordedMix({tracks,channels,range,persisted=true,createContext=frames=>new OfflineAudioContext(2,frames,44100)}) {
  const sources=mixSources(tracks,channels,{persisted}),frames=Math.round((range.end-range.start)*44100);
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
// Render published chunks directly: no per-stem concatenation or silence for
// the unfinished tail. The preview must have stopped before taking a snapshot.
export async function renderPreviewMix({tracks,engine,range,createContext=frames=>new OfflineAudioContext(2,frames,44100)}) {
  if(!engine.complete||!engine.availableFrames)throw Error('Stop separation after some audio is ready before using its mix.');
  const duration=engine.availableFrames/44100;
  if(range.start<0||range.end>duration+1e-8||range.end<=range.start)throw Error('Mix range exceeds the separated audio available.');
  if(tracks.some(t=>t.presetId||t.factoryPreset||t.presetSnapshot||t.inputMonitoring))throw Error('Export instrument audio without live monitoring or presets.');
  const frames=Math.round((range.end-range.start)*44100);
  if(!Number.isSafeInteger(frames)||frames<1||frames*8>512*1024**2)throw Error('Rendered mix exceeds the 512 MiB working buffer limit.');
  const chunks=engine.chunks.map(c=>({...c,tracks:[...c.tracks]})),context=createContext(frames),first=Math.round(range.start*44100),last=first+frames;
  let expected=0,nodes=0;
  for(const chunk of chunks){
    if(chunk.startFrame!==expected||!chunk.length)throw Error('Separated mix contains a missing audio block.');expected+=chunk.length;
    const a=Math.max(first,chunk.startFrame),b=Math.min(last,chunk.startFrame+chunk.length);if(b<=a)continue;
    for(const track of tracks){
      const buffer=chunk.tracks.find(t=>t.id===track.streamId)?.buffer;
      if(!buffer||buffer.sampleRate!==44100||buffer.length!==chunk.length)throw Error('Separated instrument audio is incomplete.');
      const node=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();
      node.buffer=buffer;gain.gain.value=trackGain(track,tracks);pan.pan.value=track.pan/100;
      node.connect(gain).connect(pan).connect(context.destination);node.start((a-first)/44100,(a-chunk.startFrame)/44100,(b-a)/44100);
      if(++nodes%16===0)await tick();
    }
  }
  if(expected!==engine.availableFrames)throw Error('Separated mix contains a missing audio block.');
  return context.startRendering();
}
export class StudioMixExporter {
  constructor({api,render=renderRecordedMix,renderPreview=renderPreviewMix,workerFactory=()=>new Worker(new URL('./mix-mp3-worker.js',import.meta.url)),token=()=>crypto.randomUUID()}) {
    Object.assign(this,{api,render,renderPreview,workerFactory,token});this.epoch=0;
  }
  invalidate() { ++this.epoch; this.pending=null; }
  current(epoch) { if(epoch!==this.epoch)throw new DOMException('Project or account changed during export','AbortError'); }
  async encode(buffer,onProgress=()=>{}, {signal}={}) {
    const worker=this.workerFactory();
    const request=data=>new Promise((resolve,reject)=>{
      const abort=()=>finish(reject, new DOMException('MP3 export cancelled','AbortError'));
      const finish=(settle,value)=>{signal?.removeEventListener('abort',abort);settle(value);};
      if(signal?.aborted)return abort();
      signal?.addEventListener('abort',abort,{once:true});
      worker.onmessage=({data})=>data.type==='progress'?onProgress(data.percent):data.type==='error'?finish(reject,Error(data.message)):finish(resolve,data);
      worker.onerror=event=>finish(reject,Error(event.message||'MP3 worker failed'));
      try {worker.postMessage(data,data.type==='packet'?[data.left.buffer,data.right.buffer]:[]);}
      catch(error) {finish(reject,error);}
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
  async preview({project,tracks,channels,range,engine=null,selection='song'},onProgress=()=>{}) {
    const epoch=this.epoch,snapshot=structuredClone(tracks),partial=!!engine?.partial;
    onProgress('Rendering temporary mix…');
    const buffer=await (engine?this.renderPreview({tracks:snapshot,engine,range}):this.render({tracks:snapshot,channels,range,persisted:false}));this.current(epoch);
    const result=await this.encode(buffer,percent=>onProgress(`Encoding temporary MP3 · ${percent}%`,percent));this.current(epoch);
    const title=`${project.name||'Studio'} · ${partial?'Partial mix':'Unsaved mix'}`;
    return {id:`studio-preview-${this.token()}`,title,projectId:project.id,ephemeral:true,origin:'studio_preview',duration:buffer.length/44100,
      file:new File([result.blob],`${title}.mp3`,{type:'audio/mpeg'}),
      manifest:{partial,selection,range,frames:buffer.length,attenuation:result.attenuation}};
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
export function mixExportAvailability({owned,working,separating,pending,temporary=false,tracks,channels,previewEngine=null,toneReady=true}) {
  const blocked=(message,failedIds=[])=>({ready:false,message,failedIds});
  if(!owned)return blocked('Only the project owner can create a backing track.');
  if(working)return blocked('Preparing audio…');
  if(separating)return blocked('Wait for separation to finish, or Stop separation to use the audio already produced.');
  if(previewEngine){
    if(!previewEngine.complete||!previewEngine.availableFrames)return blocked('Stop separation after some audio is ready before using its mix.');
    if(!toneReady)return blocked('Preparing the Tone backing-track player…');
    return {ready:true,failedIds:[],message:'Use the available instrument mix in Tone without saving. This temporary MP3 lasts for this session.'};
  }
  const audio=tracks.filter(track=>track.audio);
  if(!audio.length)return blocked('Import an audio file before creating a backing track.');
  const failed=audio.filter(track=>channels.get(track.id)?.error);
  if(failed.length)return blocked(`Saved audio could not be loaded: ${failed.map(track=>`${track.name} (${channels.get(track.id).error.message})`).join(', ')}. Your saved project is kept. Retry audio loading.`,failed.map(track=>track.id));
  const loaded=audio.filter(track=>channels.get(track.id)?.buffer).length;
  if(loaded<audio.length)return blocked(`Preparing saved audio · ${loaded}/${audio.length} tracks ready. The button becomes available when all tracks are loaded.`);
  if(audio.some(track=>track.presetId || track.factoryPreset || track.presetSnapshot))return blocked('Export a separated-instrument mix or tracks without presets. WAM preset rendering is not available yet.');
  if(audio.some(track=>track.inputMonitoring))return blocked('Turn off input monitoring before exporting the recorded mix.');
  if(!toneReady)return blocked('Preparing the Tone backing-track player…');
  return {ready:true,failedIds:[],message:pending||temporary?'Ready: Use mix in Tone opens a temporary MP3 without saving your project.':'Ready: Use mix in Tone creates a saved MP3 backing and opens Tone. Press Play there to listen.'};
}
