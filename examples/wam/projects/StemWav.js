// Lossless IEEE Float32 WAV: no quantization, gain, normalization or resampling.
export function wavHeader(frames) {
  if (!Number.isSafeInteger(frames) || frames < 1 || 44 + frames * 8 > 512 * 1024 ** 2) throw Error('Stem exceeds the 512 MiB file limit.');
  const bytes = new Uint8Array(44), view = new DataView(bytes.buffer);
  const text = (offset, value) => [...value].forEach((letter, i) => bytes[offset+i] = letter.charCodeAt(0));
  text(0,'RIFF'); view.setUint32(4,36+frames*8,true); text(8,'WAVEfmt '); view.setUint32(16,16,true);
  view.setUint16(20,3,true); view.setUint16(22,2,true); view.setUint32(24,44100,true); view.setUint32(28,352800,true);
  view.setUint16(32,8,true); view.setUint16(34,32,true); text(36,'data'); view.setUint32(40,frames*8,true);
  return bytes;
}
export function wavPacket(left, right) {
  if (!(left instanceof Float32Array) || !(right instanceof Float32Array) || left.length !== right.length) throw Error('Stereo WAV channels are misaligned.');
  const bytes = new Uint8Array(left.length * 8), view = new DataView(bytes.buffer);
  for (let i = 0; i < left.length; i++) {
    if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) throw Error('Nonfinite WAV audio.');
    view.setFloat32(i*8,left[i],true); view.setFloat32(i*8+4,right[i],true);
  }
  return bytes;
}
