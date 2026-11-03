import {trackGain} from './ProjectsModel.js';
import {mp3SampleRate,trackRenderRate,modelSampleRate} from './ExportSampleRate.js';
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
const framesFor=(seconds,rate)=>{const frames=Math.round(seconds*rate);if(!Number.isSafeInteger(frames)||frames<1)throw Error('Invalid rendered duration.');return frames;};
// Cabinet snapshots contain decoded IR samples, not the original WAV. Their
// clock must also be known before adapting a rack to a model's frequency.
export async function prepareOfflineImpulseResponses(state,rate,{hostRate,recordingRate,createContext,check=()=>{}}){
  for(const entry of [...state.a.entries,...(state.visible&&state.enabledB?state.b?.entries??[]:[])]){
    const ir=entry.state?.ir;if(entry.bypass||entry.kind!=='cabinet'||!ir?.samples)continue;
    const sourceRate=ir.sampleRate??recordingRate;
    if(sourceRate===undefined){
      if(rate!==hostRate)throw Error('This older cabinet preset has no IR sample rate. Reload its impulse response in Tone before exporting at another frequency.');
      continue;
    }
    if(!Number.isInteger(sourceRate)||sourceRate<8000||sourceRate>192000)throw Error('Invalid cabinet impulse sample rate.');
    if(sourceRate===rate)continue;
    const context=createContext(framesFor(ir.samples.length/sourceRate,rate),rate),buffer=context.createBuffer(1,ir.samples.length,sourceRate),node=context.createBufferSource();
    buffer.getChannelData(0).set(ir.samples);node.buffer=buffer;node.connect(context.destination);node.start();
    const converted=await context.startRendering();check();ir.samples=Array.from(converted.getChannelData(0));ir.sampleRate=rate;
  }
}
export class OfflinePresetRenderer {
  constructor({resolveSound,createRack,createContext=(frames,rate)=>new OfflineAudioContext(2,frames,rate)}){Object.assign(this,{resolveSound,createRack,createContext});}
  async render({tracks,channels,range,selection='song',sampleRate=44100,hostSampleRate=sampleRate,check=()=>{},onProgress=()=>{},tailSeconds=2}){
    if(!Number.isFinite(range.start)||!Number.isFinite(range.end)||range.start<0||range.end<=range.start||range.end>86400)throw Error('Invalid processed export range.');
    const plans=[];
    for(const track of tracks){
      check();if(!track.audio)continue;
      if(!channels.get(track.id)?.buffer)throw Error(`Audio is not ready: ${track.name}`);
      const wet=!!(track.presetSnapshot||track.presetId||track.factoryPreset);
      const resolved=wet?await this.resolveSound(track):null;check();
      let state=resolved?structuredClone(resolved.state):null;
      if(state?.version===1&&Array.isArray(state.entries))state={version:2,a:state,b:null,visible:false,enabledB:false,mutedA:false,route:null,inputDbB:0,outputDbA:0,outputDbB:0,panA:0,panB:0};
      if(state){
        if(state.version!==2||!state.a?.entries)throw Error('Export needs a complete track sound.');
        if(track.presetSnapshot)state.sourceTrim={...state.sourceTrim,file:state.sourceTrim?.live??0};
      }
      const rate=state?trackRenderRate(state,hostSampleRate):null;
      const required=state?[...state.a.entries,...(state.visible&&state.enabledB?state.b?.entries??[]:[])].filter(e=>!e.bypass).some(e=>modelSampleRate(e)):false;
      plans.push({track,state,rate,required,sound:resolved?.provenance});
    }
    if(!plans.length)throw Error('No recorded audio to export.');
    const requiredRates=[...new Set(plans.filter(p=>p.required).map(p=>p.rate))];
    const outputRate=mp3SampleRate(requiredRates.length===1?requiredRates[0]:sampleRate);
    if(!Number.isFinite(tailSeconds)||tailSeconds<0||tailSeconds>10)throw Error('Invalid effect tail duration.');
    const tail=selection==='song'&&plans.some(p=>p.state)?tailSeconds:0;
    const outputFrames=framesFor(range.end-range.start+tail,outputRate);
    if(outputFrames*8>512*1024**2)throw Error('Offline mix exceeds the 512 MiB working buffer limit.');
    const outputContext=this.createContext(outputFrames,outputRate),mix=outputContext.createBuffer(2,outputFrames,outputRate);
    const provenance=[];
    for(const[index,plan]of plans.entries()){
      check();const{track,state}=plan;const rate=plan.required?plan.rate:outputRate;
      // Render from project zero for A/B: filters, delays and modulation get the
      // actual preceding DI instead of an arbitrary reset at the loop anchor.
      const renderFrames=framesFor(range.end+tail,rate);
      if((outputFrames*2+renderFrames*2+outputFrames*2)*4>512*1024**2)throw Error('Offline mix exceeds the 512 MiB working buffer limit.');
      onProgress(`Rendering ${index+1}/${plans.length} · ${track.name||'Track'} · ${rate} Hz${rate!==outputRate?` → ${outputRate} Hz`:''}`);
      const context=this.createContext(renderFrames,rate);let rack,zero;
      try{
        if(state)await prepareOfflineImpulseResponses(state,rate,{hostRate:hostSampleRate,recordingRate:track.recording?.sampleRate,createContext:this.createContext,check});
        if(state){rack=await this.createRack(context,state,{check});check();}
        const source=context.createBufferSource(),gain=context.createGain(),pan=context.createStereoPanner();source.buffer=channels.get(track.id).buffer;
        gain.gain.value=trackGain(track,tracks);pan.pan.value=track.pan/100;
        if(rack){
          source.connect(rack.input);rack.output.connect(gain);
          // Legacy Faust worklets skip DSP when inputs are disconnected. Keep
          // a zero-valued input alive after the DI ends so tails still advance.
          zero=context.createConstantSource();zero.offset.value=0;zero.connect(rack.input);zero.start();
        }else source.connect(gain);
        gain.connect(pan).connect(context.destination);source.start(0,0,Math.min(source.buffer.duration,range.end));
        let audio=await context.startRendering();check();rack?.assertHealthy();
        if(rate!==outputRate){
          const resampler=this.createContext(framesFor(range.end+tail,outputRate),outputRate),node=resampler.createBufferSource();node.buffer=audio;node.connect(resampler.destination);node.start();audio=await resampler.startRendering();check();
        }
        const start=Math.round(range.start*outputRate);
        for(let offset=0;offset<outputFrames;offset+=32768){
          check();const end=Math.min(outputFrames,offset+32768);
          for(let c=0;c<2;c++){const from=audio.getChannelData(c),to=mix.getChannelData(c);for(let i=offset;i<end;i++){const value=from[start+i]??0;if(!Number.isFinite(value))throw Error(`Non-finite processed audio: ${track.name}`);to[i]+=value;}}
          await yieldUI();
        }
        if(state)provenance.push({id:track.id,rate,variant:'lite',...plan.sound});
      }finally{zero?.disconnect();rack?.destroy();}
    }
    return{buffer:mix,render:{version:1,engine:'wam-offline-v1',tailSeconds:tail,sourceRange:{...range},outputRate,tracks:provenance},range:{start:range.start,end:range.end+tail}};
  }
}
