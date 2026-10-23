import {fftRadix2InPlace} from './vendor/bs-roformer-web/fft-radix2.js';
export const ROFORMER_FRAMES=176400;
export const ROFORMER_ROLES=Object.freeze(['bass','drums','other','vocals','guitar','piano']);
const configuration=(n,hop)=>{if(!Number.isSafeInteger(n)||n<4||n>4096||(n&(n-1))||!Number.isSafeInteger(hop)||hop<1||hop>n/2)throw Error('Configuration STFT invalide.');};
const reflect=(index,length)=>{if(length===1)return 0;const period=2*(length-1),i=((index%period)+period)%period;return i<length?i:period-i;};
const hann=n=>Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/n));
export function roformerStft(channels,{n=2048,hop=512}={}){
 configuration(n,hop);
 const length=channels[0]?.length;
 if(channels.length!==2||!length||channels.some(c=>!(c instanceof Float32Array)||c.length!==length||!c.every(Number.isFinite)))throw Error('Audio STFT invalide.');
 const frames=Math.floor(length/hop)+1,bins=n/2+1,real=new Float32Array(2*bins*frames),imag=new Float32Array(real.length),window=hann(n),buffer=new Float64Array(2*n);
 for(let c=0;c<2;c++)for(let t=0;t<frames;t++){
  for(let i=0;i<n;i++){buffer[2*i]=channels[c][reflect(t*hop-n/2+i,length)]*window[i];buffer[2*i+1]=0;}
  fftRadix2InPlace(buffer,n);
  for(let k=0;k<bins;k++){const index=(c*bins+k)*frames+t;real[index]=buffer[2*k];imag[index]=buffer[2*k+1];}
 }
 return {real,imag,bins,frames};
}
export function roformerIstft(real,imag,{channels=12,frames=345,length=ROFORMER_FRAMES,n=2048,hop=512}={}){
 configuration(n,hop);const bins=n/2+1,paddedLength=(frames-1)*hop+n;
 if(!Number.isSafeInteger(channels)||channels<1||channels>12||!Number.isSafeInteger(frames)||frames<1||!Number.isSafeInteger(length)||length<1||length>paddedLength-n/2||!(real instanceof Float32Array)||!(imag instanceof Float32Array)||real.length!==channels*bins*frames||imag.length!==real.length||!real.every(Number.isFinite)||!imag.every(Number.isFinite))throw Error('Spectrogramme invalide.');
 const window=hann(n),denominator=new Float64Array(paddedLength),buffer=new Float64Array(n*2);
 for(let t=0;t<frames;t++)for(let i=0;i<n;i++)denominator[t*hop+i]+=window[i]*window[i];
 return Array.from({length:channels},(_,c)=>{
  const padded=new Float64Array(paddedLength);
  for(let t=0;t<frames;t++){
   for(let k=0;k<bins;k++){
    const idx=(c*bins+k)*frames+t,re=real[idx],im=imag[idx];
    buffer[2*k]=re;buffer[2*k+1]=-im;
    if(k>0&&k<n/2){buffer[2*(n-k)]=re;buffer[2*(n-k)+1]=im;}
   }
   // FFT(conjugate(X))/N; the real component is the inverse transform.
   fftRadix2InPlace(buffer,n);
   for(let i=0;i<n;i++)padded[t*hop+i]+=buffer[2*i]*window[i]/n;
  }
  return Float32Array.from({length},(_,i)=>{const p=n/2+i;if(denominator[p]<1e-10)throw Error('Reconstruction STFT sans couverture.');return padded[p]/denominator[p];});
 });
}
