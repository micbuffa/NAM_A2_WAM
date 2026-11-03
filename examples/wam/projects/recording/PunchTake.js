import {MAX_TAKE_BYTES, PEAK_FRAMES, monoHeader} from './TakePCM.js';

// Existing DI stays byte-identical outside the compensated capture interval.
// All scanning/composition runs in the capture Worker, never during UI updates.
export async function readDI(audio, sampleRate) {
  if (!(audio instanceof Blob) || audio.size > MAX_TAKE_BYTES) throw Error('The existing DI exceeds the recording limit.');
  const bytes = await audio.arrayBuffer(), v = new DataView(bytes);
  const text = (a,n) => String.fromCharCode(...new Uint8Array(bytes,a,n));
  if(bytes.byteLength<44 || text(0,4)!=='RIFF' || text(8,8)!=='WAVEfmt ' || text(36,4)!=='data' || v.getUint32(16,true)!==16 || v.getUint16(20,true)!==3 || v.getUint16(22,true)!==1 || v.getUint16(34,true)!==32 || v.getUint32(24,true)!==sampleRate || v.getUint32(40,true)!==bytes.byteLength-44 || (bytes.byteLength-44)%4) throw Error('Partial recording currently requires a mono Float32 DI WAV at the current recording sample rate. Keep this track and record to a new track instead.');
  const frames=(bytes.byteLength-44)/4,peaks=new Float32Array(Math.ceil(frames/PEAK_FRAMES));
  for(let i=0;i<frames;i++){const value=v.getFloat32(44+i*4,true);if(!Number.isFinite(value))throw Error('Existing DI contains invalid samples.');peaks[Math.floor(i/PEAK_FRAMES)]=Math.max(peaks[Math.floor(i/PEAK_FRAMES)],Math.abs(value));}
  return {audio,frames,peaks};
}
export async function punchTake(base, result, metadata) {
  const start=Math.max(0,metadata.startProjectFrame-metadata.compensationFrames),end=result.frames;
  const frames=Math.max(base.frames,end);
  if(end<=start || 44+frames*4>MAX_TAKE_BYTES)throw Error('The recorded interval is empty or too long.');
  const prefix=Math.min(start,base.frames),parts=[monoHeader(frames,metadata.sampleRate),base.audio.slice(44,44+prefix*4)];
  if(start>base.frames)parts.push(result.audio.slice(44+base.frames*4,44+start*4));
  parts.push(result.audio.slice(44+start*4));
  if(base.frames>end)parts.push(base.audio.slice(44+end*4));
  const audio=new Blob(parts,{type:'audio/wav'}),checked=await readDI(audio,metadata.sampleRate);
  return {...result,recordedPeak:result.peaks.reduce((maximum,value)=>Math.max(maximum,value),0),audio,peaks:checked.peaks,frames,edit:{mode:'overwrite',baseFrames:base.frames,startFrame:start,endFrame:end}};
}
