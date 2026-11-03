// Exact PCM16 path for reproducible model qualification, independent of browser decoders.
// Other containers/encodings use decodeAudioData in the bench.
export function readPcm16Wav(buffer) {
  const v=new DataView(buffer),tag=i=>String.fromCharCode(...new Uint8Array(buffer,i,4));
  if(v.byteLength<12||tag(0)!=='RIFF'||tag(8)!=='WAVE')return null;
  const end=8+v.getUint32(4,true);if(end>v.byteLength)throw Error('Truncated WAV container.');
  let format,data;
  for(let offset=12;offset+8<=end;){
    const name=tag(offset),size=v.getUint32(offset+4,true),start=offset+8;
    if(start+size>end)throw Error('Truncated WAV chunk.');
    if(name==='fmt '){if(size<16)throw Error('Invalid WAV format.');format={encoding:v.getUint16(start,true),channels:v.getUint16(start+2,true),sampleRate:v.getUint32(start+4,true),align:v.getUint16(start+12,true),bits:v.getUint16(start+14,true)};}
    if(name==='data')data={start,size};offset=start+size+(size%2);
  }
  if(!format||!data)throw Error('Incomplete WAV.');
  if(format.encoding!==1||format.bits!==16||format.sampleRate!==22050)return null;
  if(format.channels<1||format.channels>8||format.align!==format.channels*2||data.size%format.align)throw Error('Invalid PCM16 layout.');
  const frames=data.size/format.align,channels=Array.from({length:format.channels},()=>new Float32Array(frames));
  for(let i=0;i<frames;i++)for(let c=0;c<channels.length;c++)channels[c][i]=v.getInt16(data.start+i*format.align+c*2,true)/32768;
  return {channels,sampleRate:format.sampleRate};
}
