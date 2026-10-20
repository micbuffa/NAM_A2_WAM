import {istft,hannWindow} from './vendor/demucs-js/apply.js';
// Reconstruction for the fixed 7.8 s StemSplit 6-source export, with its
// unrolled ONNX inverse STFT removed. Input spectrum is [1,6,2,2,2049,340].
// This is diagnostic infrastructure, not a new enabled catalog model.
export function reconstructSixStems(spectrum,temporal) {
  const batch=12,freqs=2049,frames=340,stride=freqs*frames,length=343980,paddedLength=347136;
  if(!(spectrum instanceof Float32Array)||spectrum.length!==batch*2*stride||!(temporal instanceof Float32Array)||temporal.length!==batch*length||!spectrum.every(Number.isFinite)||!temporal.every(Number.isFinite))throw Error('Sorties 6 stems invalides.');
  const real=new Float32Array(batch*stride),imag=new Float32Array(batch*stride);
  for(let b=0;b<batch;b++){real.set(spectrum.subarray(b*2*stride,(b*2+1)*stride),b*stride);imag.set(spectrum.subarray((b*2+1)*stride,(b*2+2)*stride),b*stride);}
  const inverse=istft({real:{data:real,shape:[batch,freqs,frames]},imag:{data:imag,shape:[batch,freqs,frames]}},4096,1024,hannWindow(4096),true,paddedLength,true);
  const output=Float32Array.from(temporal);
  for(let b=0;b<batch;b++)for(let i=0;i<length;i++)output[b*length+i]+=inverse.data[b*paddedLength+1536+i];
  if(!output.every(Number.isFinite))throw Error('PCM 6 stems non fini.');return output;
}
