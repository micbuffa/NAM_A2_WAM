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
  get available(){const w=this.recording.workspace;return this.adjacent&&w.project===this.active.project&&w.accountLoadEpoch===this.active.epoch&&w.selectedId===this.active.trackId&&!w.historyBlocked&&!w.saving&&!this.recording.busy;}
  async choose(number){
    if(!this.available)return;const r=this.recording,w=r.workspace,after=this.after;
    if(number===0){if(after){if(w.runHistory)await w.runHistory(false);else await w.history.step(false);}r.render();return;}
    if(after&&number===this.selected)return;
    let result;w.saving=true;w.player.base.pause();r.render();
    try{result=await this.recorder.selectLoopTake(number);if(w.project!==this.active.project||w.accountLoadEpoch!==this.active.epoch||!this.adjacent)throw Error('Project changed during take selection.');}
    finally{if(w.project===this.active.project&&w.accountLoadEpoch===this.active.epoch){w.saving=false;w.render();}}
    if(after){const changed=w.runHistory?await w.runHistory(false):await w.history.step(false);if(!changed)return;}
    const version=r.buildVersion(this.active,result),h=r.takeHistory,refs=this.version.history;
    version.take.linkPreviousId=id=>{refs.previous.serverId=id;};h.resources.add(version.take);
    Object.assign(refs.next,h.version(version.track,version.take,version.wave));
    refs.command.recordingTakes=[this.active.beforeTake,version.take].filter(Boolean);
    const changed=w.runHistory?await w.runHistory(true):await w.history.step(true);
    if(changed)this.selected=number;h.collect();r.render();
    w.player.base.seek(this.active.metadata.rangeRecording.startFrame/r.context.sampleRate);
    w.report('Loop take selected. Play to compare; Save project keeps this version and closes the other loop choices.');
  }
  render(){
    const r=this.recording,w=r.workspace,panel=w.$('recordLoopReview'),select=w.$('recordLoopTake');if(!panel||!select)return;
    panel.hidden=w.selectedId!==this.active.trackId||!this.adjacent;
    const signature=this.options.map(t=>`${t.number}:${t.frames}`).join('|');
    if(select.dataset.takes!==signature){
      select.replaceChildren(new Option('Original', '0'),...this.options.map(t=>new Option(`Take ${t.number} · ${t.complete?'complete':'incomplete'} · ${(t.frames/r.context.sampleRate).toFixed(2)} s`,String(t.number))));select.dataset.takes=signature;
    }
    select.value=String(this.after?this.selected:0);select.disabled=!this.available;
    if(w.$('recordLoopHelp'))w.$('recordLoopHelp').textContent=`Last ${this.limit} complete takes + final incomplete take kept in RAM. Play to compare; Save keeps the selection and closes these choices.`;
  }
  close(){this.recorder?.destroy();this.recorder=null;if(this.recording.loopReview===this)this.recording.loopReview=null;const panel=this.recording.workspace.$('recordLoopReview');if(panel)panel.hidden=true;}
}
