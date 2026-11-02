export const TIME_SIGNATURES = ['2/4','3/4','4/4','5/4','6/8','7/8'];
export const signatureOf = value => TIME_SIGNATURES.includes(value) ? value : '4/4';
export function timing(bpm = 120, signature = '4/4') {
  const [beats, unit] = signatureOf(signature).split('/').map(Number);
  const tempo = Math.min(300,Math.max(30,Number(bpm)||120));
  const beatSeconds = 60 / tempo * 4 / unit;
  return {bpm:tempo,beats,unit,beatSeconds,barSeconds:beatSeconds*beats};
}
