// Receives only the offline-rendered stereo mix, never the live guitar/output.
export class MixMp3Core {
  constructor(Encoder, frames) {
    if (!Number.isSafeInteger(frames) || frames < 1 || frames > 86400*44100) throw Error('Invalid mix duration');
    Object.assign(this,{Encoder,frames,parts:[],received:0,peak:0});
  }
  append(left,right) {
    if (!(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length || !left.length || this.received+left.length > this.frames) throw Error('Misaligned mix packet');
    for(let i=0;i<left.length;i++) {
      if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw Error('Nonfinite mix');
      this.peak=Math.max(this.peak,Math.abs(left[i]),Math.abs(right[i]));
    }
    this.parts.push([left,right]);this.received+=left.length;
  }
  finish(onProgress=()=>{}) {
    if(this.received!==this.frames) throw Error('Incomplete mix');
    const ceiling=10**(-1/20),attenuation=this.peak>ceiling?ceiling/this.peak:1;
    const encoder=new this.Encoder(2,44100,192),encoded=[];let done=0,last=-1;
    for(const channels of this.parts) for(let at=0;at<channels[0].length;at+=1152) {
      const pcm=channels.map(channel=>Int16Array.from(channel.subarray(at,at+1152),value=>Math.round(Math.max(-1,Math.min(1,value*attenuation))*32767)));
      const bytes=encoder.encodeBuffer(pcm[0],pcm[1]);if(bytes.length)encoded.push(new Uint8Array(bytes));
      done+=pcm[0].length;const percent=Math.floor(done/this.frames*100);if(percent!==last){last=percent;onProgress(percent);}
    }
    const tail=encoder.flush();if(tail.length)encoded.push(new Uint8Array(tail));
    this.parts=[];
    return {parts:encoded,peak:this.peak,attenuation,frames:this.frames};
  }
}
