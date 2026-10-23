// PCM stays immutable and playable. Copy small slices into Blobs across tasks,
// then IndexedDB stores Blob references rather than cloning all PCM in one task.
const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;
const nextTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const direct=(name,callback)=>callback();
function budget({now=()=>performance.now(),yieldControl=nextTask,budgetMs=4}={}){
 let since=now();return async()=>{if(now()-since>=budgetMs){await yieldControl();since=now();}};
}
async function mapDeck(deck,channel,checkpoint){
 if(!deck)return deck;
 const tracks=async list=>{if(!Array.isArray(list))throw Error('Pistes audio sauvegardées invalides.');const output=[];
  for(const track of list){if(!Array.isArray(track.channels)||![1,2].includes(track.channels.length))throw Error('Canaux audio sauvegardés invalides.');
   const channels=[];for(const input of track.channels)channels.push(await channel(input));output.push({...track,channels});await checkpoint();
  }return output;
 };
 if(!deck.progressive)return {...deck,tracks:await tracks(deck.tracks)};
 if(!Array.isArray(deck.chunks))throw Error('Blocs audio sauvegardés invalides.');
 const chunks=[];for(const chunk of deck.chunks)chunks.push({...chunk,tracks:await tracks(chunk.tracks)});
 return {...deck,chunks};
}
export async function encodeSessionAudio(record,{chunkFrames=65536,measure=direct,...options}={}){
 if(!Number.isSafeInteger(chunkFrames)||chunkFrames<1||chunkFrames>262144)throw Error('Taille de copie PCM invalide.');
 const checkpoint=budget(options);
 const channel=async pcm=>{
  if(!(pcm instanceof Float32Array)||!pcm.length)throw Error('PCM à sauvegarder invalide.');
  const parts=[];
  for(let start=0;start<pcm.length;start+=chunkFrames){parts.push(measure('sessionBlobCopy',()=>new Blob([pcm.subarray(start,start+chunkFrames)])));await checkpoint();}
  return {frames:pcm.length,littleEndian,blob:measure('sessionBlobCompose',()=>new Blob(parts))};
 };
 return {...record,pcmStorageVersion:1,original:await mapDeck(record.original,channel,checkpoint),result:await mapDeck(record.result,channel,checkpoint)};
}
export async function decodeSessionAudio(record,options={}){
 if(!record||record.pcmStorageVersion===undefined)return record; // Existing PCM records remain readable.
 if(record.pcmStorageVersion!==1)throw Error('Version du cache PCM incompatible.');
 const checkpoint=budget(options);
 const channel=async data=>{
  if(!Number.isSafeInteger(data?.frames)||data.frames<1||data.frames>44100*86400||typeof data.littleEndian!=='boolean'||!(data.blob instanceof Blob)||data.blob.size!==data.frames*4)throw Error('Blob PCM sauvegardé invalide.');
  const bytes=await data.blob.arrayBuffer();
  // Native Float32Array layout is preserved in the record, including signed zero.
  if(data.littleEndian!==littleEndian){const b=new Uint8Array(bytes);
   for(let start=0;start<b.length;start+=262144){for(let i=start;i<Math.min(b.length,start+262144);i+=4){[b[i],b[i+3]]=[b[i+3],b[i]];[b[i+1],b[i+2]]=[b[i+2],b[i+1]];}await checkpoint();}
  }
  await checkpoint();return new Float32Array(bytes);
 };
 const {pcmStorageVersion,...metadata}=record;
 return {...metadata,original:await mapDeck(record.original,channel,checkpoint),result:await mapDeck(record.result,channel,checkpoint)};
}
