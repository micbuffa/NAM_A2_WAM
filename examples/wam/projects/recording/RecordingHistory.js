// Version references + immutable WAV Blobs only; no decoded PCM in history.
export const RECORDING_FIELDS=['audio','recording','presetSnapshot','snapshotId','presetId','factoryPreset','recordingVersionId'];
const fields=track=>Object.fromEntries(RECORDING_FIELDS.map(key=>[key,structuredClone(track?.[key]??null)]));
export class RecordingHistory {
  constructor(recording){this.recording=recording;this.resources=new Set();this.removed=new Map();}
  // Deleted RAM takes stay in bounded Undo history, not in the upload queue.
  // Soft deletion/restoration updates the server timestamp used by the next save.
  visibilityChanged(id,visible){
    const r=this.recording,w=r.workspace;
    if(visible){
      const take=this.removed.get(id);
      if(take){
        const saved=w.saved.tracks.find(t=>t.id===id);
        take.expectedUpdatedAt=saved.updatedAt;take.replaceChecksum=saved.audio?.checksum??null;
        r.pending.set(id,take);this.removed.delete(id);
      }
    }else{
      const take=r.pending.get(id);
      if(take){this.removed.set(id,take);r.pending.delete(id);}
      if(r.armedId===id){r.armedId=null;r.releaseMeter();}
    }
  }
  version(track,take=null,wave=null){return{trackId:track?.id,fields:fields(track),take,wave,serverId:track?.recordingVersionId??null};}
  remember(before,after,take,beforeTake,beforeWave,afterWave){
    const r=this.recording,w=r.workspace,project=w.project,epoch=w.accountLoadEpoch;
    const previous=this.version(before,beforeTake,beforeWave),next=this.version(after,take,afterWave);
    take.linkPreviousId=id=>{previous.serverId=id;};this.resources.add(take);
    const command={label:`${before.audio?'Replace':'Record'} ${after.name}`,audio:true,compareTrackId:after.id,recordingTakes:[beforeTake,take].filter(Boolean),recordingVersions:[previous,next],
      dispose:()=>{take.linkPreviousId=null;for(const retained of command.recordingTakes)retained.linkPreviousId=null;},undo:()=>this.apply(previous,project,epoch,after.id),redo:()=>this.apply(next,project,epoch,after.id)};
    w.history?.record(command);
    this.collect();return {command,previous,next};
  }
  published(take,track,baseline){
    // A later RAM take can be saved before earlier RAM takes. Its server-side
    // predecessor still identifies the original base of those older commands.
    for(const command of this.recording.workspace.history?.entries??[])for(const version of command.recordingVersions??[]){
      if(version.trackId===track.id&&!version.take&&!version.serverId&&(version.fields.audio?.checksum??null)===(baseline.audio?.checksum??null))version.serverId=track.previousRecordingVersionId??null;
    }
    take.savedTrack=track;take.linkPreviousId?.(track.previousRecordingVersionId);take.linkPreviousId=null;
  }
  async apply(version,project,epoch,id){
    const r=this.recording,w=r.workspace;
    const current=()=>{if(w.project!==project||w.accountLoadEpoch!==epoch)throw Error('Project changed during take restoration.');};current();
    w.player.base.pause();r.armedId=null;r.releaseMeter();
    let saved=w.saved.tracks.find(t=>t.id===id),audio=version.fields.audio;
    const serverId=version.take?.savedTrack?.recordingVersionId??version.serverId;
    if(version.take&&!version.take.savedTrack){
      version.take.expectedUpdatedAt=saved.updatedAt;version.take.replaceChecksum=saved.audio?.checksum??null;r.pending.set(id,version.take);
    }else{
      if(serverId && saved.recordingVersionId!==serverId){
        const restored=await w.api.restoreRecording(project.id,id,serverId,saved.updatedAt,saved.audio?.checksum??null);current();
        const baseline=Object.fromEntries([...RECORDING_FIELDS,'updatedAt'].map(key=>[key,restored[key]??null]));
        w.saved.tracks=w.saved.tracks.map(t=>t.id===id?{...t,...baseline}:t);saved={...saved,...baseline};
      }
      r.pending.delete(id);audio=serverId?saved.audio:audio;
    }
    current();project.tracks=project.tracks.map(t=>t.id===id?{...t,...version.fields,audio,recordingVersionId:serverId??version.fields.recordingVersionId,updatedAt:saved.updatedAt,inputMonitoring:false}:t);
    w.selectedId=id;
    w.syncSeparationTracks?.();
    w.timeline.setWave(id,version.wave);w.render();
  }
  comparison(id=this.recording.workspace.selectedId){
    const h=this.recording.workspace.history;
    for(const [command,after] of [[h?.entries[h.cursor-1],true],[h?.entries[h.cursor],false]])if(command?.compareTrackId===id&&command.recordingVersions?.[0].fields.audio)return {command,after};
    return null;
  }
  // Before/After of a re-recorded track, offered as Original / New take on its row.
  takeChoices(takes){
    const w=this.recording.workspace,h=w.history,locked=this.recording.busy||w.historyBlocked||h?.busy||w.saving||w.separation?.busy;
    for(const command of [h?.entries[h.cursor-1],h?.entries[h.cursor]]){
      const id=command?.compareTrackId,state=id!=null&&this.comparison(id);
      if(state)takes.set(id,{options:[[0,'Original'],[1,'New take']],value:state.after?1:0,disabled:locked,
        title:'Compare the audio before and after this recording (Undo/Redo). Press Play to audition; Save project keeps the selected version.'});
    }
  }
  async compare(after){
    const w=this.recording.workspace,state=this.comparison();
    if(!state||state.after===after||this.recording.busy||w.historyBlocked||w.history.busy||w.saving||w.separation?.busy)return;
    const position=w.player.position;
    const changed=w.runHistory?await w.runHistory(after):await w.history.step(after);
    if(!changed)return;
    w.player.base.seek?.(position);
    this.recording.renderTakes?.();
    w.report?.('Comparison switched via Undo/Redo. Press Play to audition. Save project keeps the displayed version.');
  }
  collect(){
    const r=this.recording,w=r.workspace,keep=new Set([...r.pending.values(),r.active?.beforeTake].filter(Boolean));
    for(const command of w.history?.entries??[])for(const take of command.recordingTakes??[])keep.add(take);
    for(const [id,take] of this.removed)if(!keep.has(take)){
      // Once the bounded history expires, Options restores the last saved audio.
      const saved=w.saved?.tracks.find(t=>t.id===id);
      if(saved&&w.project)w.project.tracks=w.project.tracks.map(t=>t.id===id?{...t,...fields(saved)}:t);
      this.removed.delete(id);
    }
    for(const take of this.resources)if(!keep.has(take)){
      if(!take.adopting)URL.revokeObjectURL(take.url);take.file=null;this.resources.delete(take);
    }
  }
  clear(){for(const take of this.resources){if(!take.adopting)URL.revokeObjectURL(take.url);take.file=null;}this.resources.clear();this.removed.clear();}
}
