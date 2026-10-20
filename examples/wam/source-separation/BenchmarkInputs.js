export const benchmarkInputs = Object.freeze([
  {id:'real-mix',label:'Mix stéréo — Slow Motion Dream',url:'./fixtures/music/slow-motion-dream.mp3',groundTruth:false,credits:'Steven M Bryant (2011), feat. CSoul, Alex Beroza & Robert Siekawitch · CC BY 3.0',notice:'./fixtures/music/NOTICE.md'},
  {id:'guitar',label:'Guitare seule — CleanChords.mp3',url:'../assets/audio/CleanChords.mp3',groundTruth:false,credits:'Guitare DI fournie dans le projet'},
]);

export function prepareBenchmarkAudio(audio,maxSeconds=13.65) {
  if(audio?.sampleRate!==44100||!Number.isSafeInteger(audio.length)||audio.length<=0||!Number.isSafeInteger(audio.numberOfChannels)||audio.numberOfChannels<1||!Number.isFinite(maxSeconds)||maxSeconds<=0)throw Error('Audio de test invalide.');
  const frames=Math.min(audio.length,Math.round(maxSeconds*44100));
  if(!frames)throw Error('Audio de test vide.');
  const channels=[0,1].map(c=>{
    const data=audio.getChannelData(Math.min(c,audio.numberOfChannels-1));
    if(!(data instanceof Float32Array)||data.length!==audio.length||!data.every(Number.isFinite))throw Error('Échantillons de test invalides.');
    return data.slice(0,frames);
  });
  return {frames,channels,sourceChannels:audio.numberOfChannels,sampleRate:44100};
}
