// Version references + immutable WAV Blobs only; no decoded PCM in history.
export const RECORDING_FIELDS=['audio','recording','presetSnapshot','snapshotId','presetId','factoryPreset','recordingVersionId'];
const fields=track=>Object.fromEntries(RECORDING_FIELDS.map(key=>[key,structuredClone(track?.[key]??null)]));
export class RecordingHistory {
  constructor(recording){this.recording=recording;this.resources=new Set();}
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
    if(w.separation){w.separation.projectTracks=project.tracks;if(w.separation.savedTracks)w.separation.savedTracks.splice(0,w.separation.savedTracks.length,...project.tracks.filter(t=>t.timelineVisible!==false&&!t.removedAt&&t.origin!=='mix'));}
    w.timeline.setWave(id,version.wave);w.render();
  }
  comparison(){
    const w=this.recording.workspace,h=w.history,id=w.selectedId;
    for(const [command,after] of [[h?.entries[h.cursor-1],true],[h?.entries[h.cursor],false]])if(command?.compareTrackId===id&&command.recordingVersions?.[0].fields.audio)return {command,after};
    return null;
  }
  renderComparison(){
    const w=this.recording.workspace,panel=w.$?.('recordComparison');if(!panel)return;
    const state=this.comparison();panel.hidden=!state;
    for(const [id,after] of [['recordCompareBefore',false],['recordCompareAfter',true]]){
      const button=w.$(id);if(!button)continue;
      button.disabled=!state||state.after===after||this.recording.busy||w.historyBlocked||w.history.busy||w.saving||w.separation?.busy;
      button.setAttribute('aria-pressed',String(state?.after===after));
      button.title='Compare via Undo/Redo. Playback pauses; press Play to audition. Saving stores the displayed version.';
    }
  }
  async compare(after){
    const w=this.recording.workspace,state=this.comparison();
    if(!state||state.after===after||this.recording.busy||w.historyBlocked||w.history.busy||w.saving||w.separation?.busy)return;
    const position=w.player.position;
    const changed=w.runHistory?await w.runHistory(after):await w.history.step(after);
    if(!changed)return;
    w.player.base.seek?.(position);
    this.renderComparison();
    w.report?.('Comparison switched via Undo/Redo. Press Play to audition. Save project keeps the displayed version.');
  }
  collect(){
    const r=this.recording,w=r.workspace,keep=new Set([...r.pending.values(),r.active?.beforeTake].filter(Boolean));
    for(const command of w.history?.entries??[])for(const take of command.recordingTakes??[])keep.add(take);
    for(const take of this.resources)if(!keep.has(take)){
      if(!take.adopting)URL.revokeObjectURL(take.url);take.file=null;this.resources.delete(take);
    }
  }
  clear(){for(const take of this.resources){if(!take.adopting)URL.revokeObjectURL(take.url);take.file=null;}this.resources.clear();}
}
