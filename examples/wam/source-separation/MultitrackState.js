const finite=(v,min,max)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('État multipiste invalide.');return v;};
const boolean=v=>{if(typeof v!=='boolean')throw Error('État multipiste invalide.');return v;};
const text=v=>{if(typeof v!=='string'||v.length>2000)throw Error('Référence audio invalide.');return v;};
export function validateSession(state){
  if(state?.version===2&&state.empty===true){const g=state.global;finite(g.volumeDb,-60,6);finite(g.mix,0,1);finite(g.guitarPan,-1,1);boolean(g.muted);return structuredClone(state);}
  if(state?.version!==2||!['original','result'].includes(state.active)||!state.original||typeof state.audioKey!=='string'||!state.audioKey)throw Error('Version ou état multipiste invalide.');
  const s=structuredClone(state);text(s.audioKey);
  for(const d of [s.original,s.result].filter(Boolean)){
    text(d.title);finite(d.duration,1/44100,86400);finite(d.position,0,d.duration);finite(d.outputGain,0,2);finite(d.zoom,1,16);
    if(!['mix','instruments'].includes(d.viewMode)||!d.tracks?.length||d.tracks.length>32)throw Error('Pistes sauvegardées invalides.');
    boolean(d.loop);if(d.region){finite(d.region.start,0,d.duration);finite(d.region.end,0,d.duration);if(d.region.end<=d.region.start)throw Error('Région sauvegardée invalide.');}
    const ids=new Set();for(const t of d.tracks){text(t.id);if(ids.has(t.id))throw Error('Identifiants de pistes dupliqués.');ids.add(t.id);finite(t.volume,0,1.5);finite(t.pan,-1,1);boolean(t.muted);boolean(t.solo);}
    finite(d.normalization.targetDb,-24,0);boolean(d.normalization.enabled);d.normalization.analyzed??=d.normalization.enabled;boolean(d.normalization.analyzed);
  }
  if(s.active==='result'&&!s.result)throw Error('Instruments sauvegardés manquants.');
  finite(s.global.volumeDb,-60,6);finite(s.global.mix,0,1);finite(s.global.guitarPan,-1,1);boolean(s.global.muted);
  if(s.source){if(!['file','library','example','demo'].includes(s.source.kind))throw Error('Source audio inconnue.');text(s.source.name||'');if(s.source.id)text(s.source.id);if(s.source.kind==='file'){finite(s.source.size,0,512*1024*1024);finite(s.source.lastModified,0,Number.MAX_SAFE_INTEGER);}}
  return s;
}
export function deckState(deck){
  const e=deck.engine,n=deck.normalization;
  return {title:deck.title,duration:e.duration,position:e.position,outputGain:e.outputNode.gain.value,tracks:deck.session.tracks.map(t=>({...t})),zoom:deck.session.zoom,viewMode:deck.session.viewMode,loop:e.loop,region:e.loopRegion?{...e.loopRegion}:null,normalization:{targetDb:n.targetDb,enabled:n.enabled,analyzed:!!n.result}};
}
export function packAudio(engine){
  const pack=track=>({id:track.id,role:track.role,label:track.label,sampleRate:track.buffer.sampleRate,channels:Array.from({length:track.buffer.numberOfChannels},(_,i)=>track.buffer.getChannelData(i))});
  if(engine.progressive){if(!engine.complete)throw Error('Terminez ou annulez la séparation avant de sauvegarder.');return {progressive:true,partial:!!engine.partial,totalFrames:engine.totalFrames,roles:engine.tracks.map(t=>t.role),chunks:engine.chunks.map(c=>({startFrame:c.startFrame,tracks:c.tracks.map(pack)}))};}
  return {progressive:false,tracks:engine.tracks.map(pack)};
}
export function unpackTracks(context,tracks){
  if(!Array.isArray(tracks)||!tracks.length||tracks.length>32)throw Error('Cache de pistes invalide.');
  return tracks.map(t=>{
    text(t.id);if(!Array.isArray(t.channels)||![1,2].includes(t.channels.length)||t.sampleRate!==44100)throw Error('Canaux sauvegardés invalides.');
    const length=t.channels[0]?.length;if(!Number.isSafeInteger(length)||length<1||length>44100*86400||t.channels.some(c=>!(c instanceof Float32Array)||c.length!==length||!c.every(Number.isFinite)))throw Error('PCM sauvegardé invalide.');
    const buffer=context.createBuffer(t.channels.length,length,t.sampleRate);t.channels.forEach((c,i)=>buffer.copyToChannel(c,i));return {id:t.id,role:t.role,label:t.label,buffer};
  });
}
export async function applyDeckState(deck,state,{normalization=true}={}){
  const e=deck.engine;
  if(Math.abs(e.duration-state.duration)>1/44100||deck.session.tracks.length!==state.tracks.length||deck.session.tracks.some((t,i)=>t.id!==state.tracks[i].id))throw Error('Le cache audio ne correspond pas à la session.');
  e.pause();e.outputNode.gain.value=state.outputGain;
  for(const t of state.tracks)deck.session.updateTrack(t.id,t);
  deck.session.setZoom(state.zoom);deck.session.setViewMode(state.viewMode);e.setLoop(state.loop);
  if(state.region)e.setLoopRegion(state.region.start,state.region.end);else e.resetLoopRegion();e.seek(state.position);e.sync(deck.session.tracks);
  if(normalization){deck.normalization.setTargetDb(state.normalization.targetDb);if(state.normalization.analyzed){await deck.normalization.analyze();deck.normalization.setEnabled(state.normalization.enabled);}}
}
export async function saveSession({workflow,mixer,store,source=null,separation={},key=crypto.randomUUID(),measure=(name,callback)=>callback()}){
  if(!workflow.original)throw Error('Chargez un morceau avant de sauvegarder.');
  // Empty lanes after a model change are not a separated audio result.
  const result=workflow.result&&(!workflow.result.engine.progressive||workflow.result.engine.availableFrames>0)?workflow.result:null;
  const state=validateSession({version:2,audioKey:key,source,original:deckState(workflow.original),result:result?deckState(result):null,active:result&&workflow.active===result?'result':'original',global:mixer.getState(),separation});
  // One atomic record: metadata is published only once BOTH decks are stored.
  const audio=measure('sessionPackAudio',()=>({key,original:packAudio(workflow.original.engine),result:result?packAudio(result.engine):null}));
  await store.put(audio,{measure});return state;
}
export async function restoreSession(input,{context,store,createDeck,workflow,mixer}){
  const state=validateSession(input);workflow.active?.engine.pause();
  if(state.empty){workflow.destroy();mixer.setActiveEngine?.(null);mixer.update(state.global);return {missing:false,empty:true,state};}
  const audio=await store.get(state.audioKey);if(!audio?.original)return {missing:true,state};
  const staged=[];
  const unpack=async(data,meta)=>{
    let deck;
    if(data.progressive){
      if(!Number.isSafeInteger(data.totalFrames)||data.totalFrames<=0||!Array.isArray(data.roles)||!Array.isArray(data.chunks))throw Error('Cache progressif invalide.');
      deck=createDeck([],meta.title,{progressive:true,totalFrames:data.totalFrames,roles:data.roles});staged.push(deck);
      for(const chunk of data.chunks)deck.engine.append(chunk.startFrame,unpackTracks(context,chunk.tracks));deck.engine.finish(!!data.partial);
    }else{deck=createDeck(unpackTracks(context,data.tracks),meta.title);staged.push(deck);}
    deck.inheritedMix=true;await applyDeckState(deck,meta);return deck;
  };
  try{
    const original=await unpack(audio.original,state.original),result=state.result&&audio.result?await unpack(audio.result,state.result):null;
    workflow.setOriginal(original);if(result){await workflow.begin(result);if(state.active==='result')await workflow.showResult();}
    // Switching decks intentionally copies transport settings: restore each
    // saved deck after that switch, never resume playback.
    await applyDeckState(original,state.original,{normalization:false});if(result)await applyDeckState(result,state.result,{normalization:false});
    for(const [deck,meta] of [[original,state.original],[result,state.result]])if(deck&&meta.normalization.analyzed&&!deck.normalization.result){await deck.normalization.analyze();deck.normalization.setEnabled(meta.normalization.enabled);}
    mixer.update(state.global);return {missing:false,missingResult:!!state.result&&!result,state};
  }catch(error){for(const d of staged)if(d!==workflow.original&&d!==workflow.result)workflow.dispose(d);throw error;}
}

export function sameSource(a,b){
  if(!a||!b||a.kind!==b.kind)return false;
  if(a.kind==='file')return a.name===b.name&&a.size===b.size&&a.lastModified===b.lastModified;
  return a.kind==='library'?a.id===b.id:a.name===b.name;
}
