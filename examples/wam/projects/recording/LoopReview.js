// Retained cycle clips stay in the stopped capture Worker. Only the selected
// full-track WAV is materialized, and all auditions share one Undo command.
export class LoopReview {
  constructor(recording,recorder,active,result,version){
    Object.assign(this,{recording,recorder,active,version,options:result.loopOptions,selected:result.loopSelection,limit:result.takeLimit});
    const dispose=version.history.command.dispose;
    version.history.command.dispose=()=>{dispose?.();if(recording.loopReview===this)this.close();};
  }
  get adjacent(){const w=this.recording.workspace,h=w.history,i=h?.entries.indexOf(this.version.history.command);return i>=0&&(h.cursor===i||h.cursor===i+1);}
  get after(){const h=this.recording.workspace.history;return h.cursor===h.entries.indexOf(this.version.history.command)+1;}
  get ready(){const w=this.recording.workspace;return this.adjacent&&w.project===this.active.project&&w.accountLoadEpoch===this.active.epoch&&!w.historyBlocked&&!w.saving&&!this.recording.busy;}
  get available(){return this.ready&&this.recording.workspace.selectedId===this.active.trackId;}
  async choose(number){
    if(!this.available)return;const r=this.recording,w=r.workspace,after=this.after;
    if(number===0){if(after){if(w.runHistory)await w.runHistory(false);else await w.history.step(false);}r.render();return;}
    if(after&&number===this.selected)return;
    const h=r.takeHistory,refs=this.version.history;
    const current=()=>w.project===this.active.project&&w.accountLoadEpoch===this.active.epoch&&this.adjacent;
    let version;
    w.saving=true;w.player.base.pause();r.render();
    try{
      const result=await this.recorder.selectLoopTake(number);
      if(!current())throw Error('Project changed during take selection.');
      // Prepare everything before Undo: a failed allocation must not change audio.
      version=r.buildVersion(this.active,result);
    }finally{if(w.project===this.active.project&&w.accountLoadEpoch===this.active.epoch){w.saving=false;w.render();}}
    if(after){
      let changed;
      try{changed=w.runHistory?await w.runHistory(false):await w.history.step(false);}
      catch(error){URL.revokeObjectURL(version.take.url);version.take.file=null;throw error;}
      if(!changed){URL.revokeObjectURL(version.take.url);version.take.file=null;return;}
    }
    const oldNext={...refs.next},oldTakes=refs.command.recordingTakes,oldSelected=this.selected;
    version.take.linkPreviousId=id=>{refs.previous.serverId=id;};h.resources.add(version.take);
    Object.assign(refs.next,h.version(version.track,version.take,version.wave));
    // Both versions stay rooted until replay has succeeded or rolled back.
    refs.command.recordingTakes=[...oldTakes,version.take];this.selected=number;
    try{
      const changed=w.runHistory?await w.runHistory(true):await w.history.step(true);
      if(!changed)throw Error('Take selection was interrupted.');
      refs.command.recordingTakes=[this.active.beforeTake,version.take].filter(Boolean);
    }catch(error){
      Object.assign(refs.next,oldNext);refs.command.recordingTakes=oldTakes;this.selected=oldSelected;
      if(current()){
        if(after){if(w.runHistory)await w.runHistory(true);else await w.history.step(true);}
        else await h.apply(refs.previous,this.active.project,this.active.epoch,this.active.trackId);
      }
      throw error;
    }finally{h.collect();r.render();}
    w.player.base.seek(this.active.metadata.rangeRecording.startFrame/r.context.sampleRate);
    w.report('Loop take selected. Play to compare; Save project keeps this version and closes the other loop choices.');
  }
  // The loop takes, offered on the recorded track's row (replaces its Original / New take choice).
  takeChoices(takes){
    if(!this.adjacent)return;const rate=this.recording.context.sampleRate;
    takes.set(this.active.trackId,{options:[[0,'Original'],...this.options.map(t=>[t.number,`Take ${t.number} · ${(t.frames/rate).toFixed(2)} s${t.complete?'':' · incomplete'}`])],
      value:this.after?this.selected:0,disabled:!this.ready,
      title:`Loop takes: the last ${this.limit} complete takes and the final incomplete one stay in memory. Press Play to audition; Save project keeps the selected take and drops the others.`});
  }
  close(){this.recorder?.destroy();this.recorder=null;if(this.recording.loopReview===this)this.recording.loopReview=null;this.recording.renderTakes?.();}
}
