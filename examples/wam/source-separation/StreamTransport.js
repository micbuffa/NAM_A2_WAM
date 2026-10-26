import {RingBuffer} from './vendor/ringbuf/index.js';

export const STREAM_RATE=44100,STREAM_BINS=2048,READ_BUDGET=65536;
const verified=new WeakSet(),envelopes=new WeakMap();
export const isVerifiedStreamChunk=packet=>verified.has(packet);
export const producerEnvelope=buffer=>envelopes.get(buffer);
export function attachProducerEnvelope(buffer,peaks,totalFrames){envelopes.set(buffer,{peaks,totalFrames});}
const abort=()=>new DOMException('Flux annulé','AbortError');
export const canShareAudio=()=>globalThis.crossOriginIsolated===true&&typeof SharedArrayBuffer!=='undefined';
export function streamStorage(channels,{shared=canShareAudio(),seconds=3}={}){
 if(!Number.isInteger(channels)||channels<2||channels>12||channels%2!==0||!Number.isInteger(seconds)||seconds<1)throw Error('Transport invalide.');
 return {channels,bins:STREAM_BINS,sampleRate:STREAM_RATE,control:shared?new SharedArrayBuffer(4):null,sab:shared?RingBuffer.getStorageForCapacity(STREAM_RATE*channels*seconds,Float32Array):null};
}
// Runs in the separation worker. Single producer, one consumer; PCM is planar.
export class StreamPublisher {
 constructor(config,{totalFrames,post=(message,transfers)=>postMessage(message,transfers),yieldControl=null}={}){
  this.config=config;this.totalFrames=totalFrames;this.post=post;this.yieldControl=yieldControl;this.sequence=0;
  this.ring=config?.sab?new RingBuffer(config.sab,Float32Array):null;this.control=config?.control?new Int32Array(config.control):null;
 }
 async publish(packet){
  const {stems}=packet,channels=this.config?.channels||stems.length,length=stems?.[0]?.length;
  if(!Number.isSafeInteger(length)||!length||stems.length!==channels||!Number.isSafeInteger(packet.startFrame)||packet.startFrame<0||packet.startFrame+length>this.totalFrames||stems.some(c=>!(c instanceof Float32Array)||c.length!==length))throw Error('Bloc producteur invalide.');
  for(let start=0;start<length;start+=STREAM_RATE){
   const frames=Math.min(STREAM_RATE,length-start),peaks=Array.from({length:channels/2},()=>new Float32Array(Math.min(STREAM_BINS,this.totalFrames)));
   // Validate and analyse ONCE, at the producer, before making PCM visible.
   for(let c=0;c<channels;c++)for(let i=0;i<frames;i++){
    const value=stems[c][start+i];if(!Number.isFinite(value))throw Error('PCM producteur non fini.');
    const bin=Math.min(peaks[0].length-1,Math.floor((packet.startFrame+start+i)/this.totalFrames*peaks[0].length)),p=peaks[c>>1];p[bin]=Math.max(p[bin],Math.abs(value));
   }
   const {stems:unused,...metadata}=packet;
   const message={...metadata,type:'stream-chunk',sequence:this.sequence++,frames,startFrame:packet.startFrame+start,totalFrames:this.totalFrames,peaks};
   const transfers=peaks.map(p=>p.buffer);
   if(this.ring){
    // A complete packet must fit. No partial publication and no overwrite.
    while(this.ring.available_write()<frames*channels){
     if(this.yieldControl){await this.yieldControl();continue;}
     const stamp=Atomics.load(this.control,0);
     if(this.ring.available_write()>=frames*channels)break;
     if(Atomics.waitAsync)await Atomics.waitAsync(this.control,0,stamp,1000).value;
     else Atomics.wait(this.control,0,stamp,1000); // Dedicated Worker only, never the UI.
    }
    for(const channel of stems)if(this.ring.push(channel,frames,start)!==frames)throw Error('Écriture ring incomplète.');
   }else{
    message.stems=stems.map(c=>c.slice(start,start+frames));transfers.push(...message.stems.map(c=>c.buffer));
   }
   this.post(message,transfers);
   if(!this.ring)await (this.yieldControl?.()||new Promise(resolve=>setTimeout(resolve,0)));
  }
 }
}

// Worker-compatible facade. Signals wake the consumer; there is no idle polling.
// All queued events, including done, stay ordered behind the PCM they describe.
export class StreamingWorker {
 constructor(worker,channels,{shared=canShareAudio(),schedule=fn=>setTimeout(fn,0),budget=READ_BUDGET}={}){
  Object.assign(this,{raw:worker,channels,shared,schedule,budget});this.queue=[];this.epoch=0;this.mode='transfer';
  worker.onmessage=event=>{if(this.dead)return;if(event.data.type!=='stream-chunk'&&!this.pending&&!this.queue.length){this.onmessage?.({data:event.data.type==='done'?{...event.data,transportMode:this.mode}:event.data});return;}this.queue.push(event.data);this.wake();};
  worker.onerror=event=>this.onerror?.(event);
 }
 postMessage(message,transfers=[]){
  if(this.dead)throw abort();
  if(message.left instanceof Float32Array){
   ++this.epoch;this.queue=[];this.pending=null;this.expected=0;this.sequence=0;
   this.totalFrames=message.left.length;this.config=streamStorage(this.channels,{shared:this.shared});this.ring=this.config.sab?new RingBuffer(this.config.sab,Float32Array):null;this.control=this.config.control?new Int32Array(this.config.control):null;this.mode=this.ring?'shared-ringbuffer':'transfer';
   message={...message,streamTransport:this.config};
  }
  this.raw.postMessage(message,transfers);
 }
 wake(){if(this.scheduled||this.dead)return;this.scheduled=true;this.schedule(()=>{this.scheduled=false;this.drain();});}
 drain(){
  if(this.dead)return;
  try{
   let budget=this.budget,events=0;
   while(budget>0&&events++<32&&(this.pending||this.queue.length)){
    if(!this.pending){
     const data=this.queue.shift();
     if(data.type!=='stream-chunk'){this.onmessage?.({data:data.type==='done'?{...data,transportMode:this.mode}:data});continue;}
     const n=data.frames,bins=Math.min(STREAM_BINS,this.totalFrames);
     if(data.sequence!==this.sequence++||data.startFrame!==this.expected||data.totalFrames!==this.totalFrames||data.sampleRate!==STREAM_RATE||!Number.isInteger(n)||n<1||n>STREAM_RATE||this.expected+n>this.totalFrames||data.peaks?.length!==this.channels/2||data.peaks.some(p=>!(p instanceof Float32Array)||p.length!==bins))throw Error('Paquet du flux invalide.');
     if(!this.ring&&(data.stems?.length!==this.channels||data.stems.some(c=>!(c instanceof Float32Array)||c.length!==n)))throw Error('PCM transféré invalide.');
     if(this.ring&&this.ring.available_read()<n*this.channels)throw Error('Paquet ring incomplet.');
     this.pending={data,stems:this.ring?Array.from({length:this.channels},()=>new Float32Array(n)):data.stems,offset:0,epoch:this.epoch};
    }
    const p=this.pending,n=p.data.frames;
    if(p.epoch!==this.epoch){this.pending=null;continue;}
    if(this.ring){
     const channel=Math.floor(p.offset/n),offset=p.offset%n,count=Math.min(n-offset,budget);
     if(this.ring.pop(p.stems[channel],count,offset)!==count)throw Error('Lecture ring incomplète.');
     p.offset+=count;budget-=count;
     if(this.control){Atomics.add(this.control,0,1);Atomics.notify(this.control,0,1);}
     if(p.offset<n*this.channels)continue;
    }
    this.pending=null;this.expected+=n;
    const packet={...p.data,type:'chunk',stems:p.stems,transportMode:this.mode};verified.add(packet);
    this.onmessage?.({data:packet});
    // One audio publication per task even with transfer fallback.
    break;
   }
   if(this.pending||this.queue.length)this.wake();
  }catch(error){this.queue=[];this.pending=null;this.onerror?.({message:error.message});}
 }
 terminate(){this.dead=true;++this.epoch;this.queue=[];this.pending=null;this.raw.terminate();this.ring=null;}
}
