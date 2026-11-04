import {confirmDialog,createDialog,button,actionsRow} from '../account/dialogs.js';
import {copiedTrackSound,withOrigin} from './TrackSoundState.js';
import {usesTrackPreset,presetValue} from './ProjectsModel.js';

export function trackSoundSaveDialog({name,reusable=false}) {
  return new Promise(resolve=>{
    const {dialog,body}=createDialog({title:'Save project',eyebrow:name,className:'track-sound-dialog'});
    const form=document.createElement('form');form.method='dialog';
    const label=document.createElement('label');label.className='track-sound-reuse';
    const scope=document.createElement('input');scope.type='checkbox';scope.checked=reusable;scope.setAttribute('aria-label','Also create a reusable Play preset');label.append(scope,document.createTextNode('Also create a reusable Play preset'));
    const nameLabel=document.createElement('label');nameLabel.textContent='New preset name';
    const input=document.createElement('input');input.setAttribute('aria-label','New preset name');input.value=name;input.maxLength=100;nameLabel.append(input);
    const update=()=>{nameLabel.hidden=!scope.checked;input.required=scope.checked;};scope.onchange=update;update();
    const note=document.createElement('p');note.textContent='The edited sound is saved in this project. Optionally make it available in Play for other projects.';
    const cancel=button('Cancel'),save=button('Save project',{type:'submit',primary:true});cancel.onclick=()=>dialog.close('cancel');
    form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;dialog.result={reusable:scope.checked,name:input.value.trim()};dialog.close('save');};
    form.append(label,nameLabel,note,actionsRow(cancel,save));body.append(form);dialog.addEventListener('close',()=>resolve(dialog.result??null),{once:true});dialog.showModal();
  });
}

// The rack dock follows Studio's selection: a personal guitar/bass track lends
// it the visible rack (its insert is overridden, so playback and its explicit
// monitoring go through what is shown), without pausing the project or touching
// the loop. Edits are a local copy: Apply, another selection, leaving Studio or
// Save project applies them to the track; Revert reloads the applied sound.
// Leaving Studio restores the Play rack.
export class TrackSoundEditor {
  constructor({workspace,rack,source,presets,workspaces,context,view=()=>{},route=()=>{},ask=trackSoundSaveDialog,confirm=confirmDialog}) {
    Object.assign(this,{workspace,rack,source,presets,workspaces,context,view,route,ask,confirm});
    workspace.onTrackSoundContext=()=>{void this.sync();};
    this.soundEdits=new Map();
    workspace.prepareSoundSave=()=>this.prepareSave();workspace.completeSoundSave=()=>this.completeSave();
    workspace.hasPendingSoundExport=()=>this.edits().some(edit=>edit.choice?.reusable);
    this.onWorkspace=()=>{void this.sync();};workspaces.addEventListener?.('change',this.onWorkspace);
    this.beforeUnload=event=>{if(this.active?.modified||this.edits().length){event.preventDefault();event.returnValue='';}};globalThis.addEventListener?.('beforeunload',this.beforeUnload);
  }
  get busy(){return !!this.active?.busy;}
  get modified(){return !!this.active?.modified;}
  get selectedPreset(){return this.active?.selectedPreset??'';}
  get audioEditing(){return !!this.active?.audio;}
  get title(){return this.active?.trackName??'Track sound';}
  get projectName(){return this.active?.projectName??'';}
  // The library preset the shown sound comes from ({name}) and whether it changed since.
  get origin(){return this.active?.origin??null;}
  get originModified(){return !!this.active?.originModified;}
  current(s=this.active){return !!s&&this.active===s&&this.workspace.project?.id===s.projectId&&this.workspace.accountLoadEpoch===s.epoch&&this.workspace.owned&&this.workspace.project.tracks.some(t=>t.id===s.trackId&&!t.removedAt);}

  // The track the dock should show: the selected personal guitar/bass track, in Studio.
  desiredId() {
    const w=this.workspace;
    if(this.workspaces.current!=='projects'||!w.owned||!w.project)return null;
    const track=w.project.tracks.find(t=>t.id===w.selectedId&&!t.removedAt);
    if(!track||!usesTrackPreset(track)||this.failed===this.failureKey(track))return null;
    return track.id;
  }
  failureKey(track){return `${this.workspace.project?.id}|${this.workspace.accountLoadEpoch}|${track.id}|${presetValue(track)}`;}
  // Long operations keep the dock as it is until they end (their render syncs again).
  blocked() {
    const w=this.workspace;
    return !!(w.saving||w.recording?.busy||w.separation?.busy||w.separation?.result||w.history?.busy||(!this.active&&this.presets.busy));
  }
  // Serialized: each call reconciles the dock with the current selection.
  sync() {
    this.queue=(this.queue??Promise.resolve()).then(()=>this.reconcile()).catch(error=>this.workspace.report?.(error.message,true));
    return this.queue;
  }
  async reconcile() {
    if(this.blocked()){if(!this.active&&this.presets.busy)setTimeout(()=>this.sync(),300).unref?.();return;}
    const id=this.desiredId(),s=this.active;
    if(s&&s.trackId===id&&this.current(s))return;
    const original=s?await this.leave(s,{restore:!id}):null;
    if(id!==null&&id===this.desiredId())await this.open(id,original);
  }
  async open(id,originalTone=null) {
    const w=this.workspace,track=w.project.tracks.find(t=>t.id===id);
    const s=this.active={projectId:w.project.id,projectName:w.project.name,trackId:id,trackName:track.name,epoch:w.accountLoadEpoch,audio:!!track.audio,busy:true,selectedPreset:''};
    this.restoreOrigin(s,track);
    this.presets.setExternalEditor(this);this.render();
    try{
      s.originalTone=originalTone??structuredClone(await this.rack.getState());if(!this.current(s))throw Error('Project changed.');
      this.route();
      const state=presetValue(track)?await w.tones.resolvePreset(track,s.projectId):s.originalTone;
      copiedTrackSound(state);if(!this.current(s))throw Error('Project changed.');
      await this.presets.applyState(structuredClone(state));if(!this.current(s))throw Error('Project changed.');
      s.baseline=JSON.stringify(await this.rack.getState());
      // The recorded DI enters at the live trim, as during monitoring (TrackTones).
      s.input=this.context.createGain();s.input.channelCount=1;s.input.channelCountMode='explicit';s.input.connect(this.rack.a.input);
      this.syncInputGain();w.tones.setOverride(id,{input:s.input,live:this.rack.a.input,output:this.rack.output});
      s.busy=false;this.render();
    }catch(error){
      if(this.active===s&&this.current(s))this.failed=this.failureKey(track);
      if(this.active===s)await this.leave(s,{restore:true,discard:true});
      if(error.message!=='Project changed.')throw error;
    }
  }
  // Applies pending edits (unless discarded), gives the track its own rack back
  // and, when nothing else is shown next, restores the Play rack.
  async leave(s,{restore,discard=false}) {
    s.busy=true;this.render();
    if(!discard&&s.baseline&&this.current(s)){try{await this.applyEdits(s);}catch(error){this.workspace.report?.(error.message,true);}}
    this.workspace.tones.setOverride(s.trackId,null);s.input?.disconnect();
    const original=s.originalTone;
    this.active=null;
    if(!restore)return original;
    try{if(original)await this.presets.applyState(original);}
    finally{this.presets.setExternalEditor(null);this.route();this.view(this);this.presets.scheduleCheck();this.presets.scheduleDraft();}
    return null;
  }
  // Origin as applied to the track; comparisons start again from its applied sound.
  restoreOrigin(s,track){s.origin=track.presetSnapshot?.origin?{name:track.presetSnapshot.origin.name}:null;s.appliedOriginModified=!!track.presetSnapshot?.origin?.modified;s.originModified=s.appliedOriginModified;s.originBaseline=null;}
  render(){this.view(this);this.presets.render();}
  syncInputGain(){const s=this.active;if(s?.input)s.input.gain.setValueAtTime(10**((this.source.trimDb.live??0)/20),this.context.currentTime);}
  async checkModified(){const s=this.active;if(!s||s.busy)return;const value=JSON.stringify(await this.rack.getState());if(this.current(s)){this.compare(s,value);this.syncInputGain();this.render();}}
  compare(s,value){s.modified=value!==s.baseline;s.originModified=s.originBaseline?value!==s.originBaseline:s.appliedOriginModified||s.modified;}
  async loadPreset(id){
    const s=this.active;if(!this.current(s)||s.busy)return;
    if(this.modified&&!await this.confirm({title:'Replace edited sound?',message:'The current edits have not been applied to the track.',confirmLabel:'Load preset'}))return this.render();
    s.busy=true;this.render();
    try{
      const preset=this.presets.find(id);if(!preset)throw Error('Preset unavailable.');
      const {state}=await(preset.factory?this.presets.factoryStore:this.presets.store).get(preset.id);
      copiedTrackSound(state);if(!this.current(s))throw Error('Project changed.');
      await this.presets.applyState(structuredClone(state));s.selectedPreset=String(id);this.syncInputGain();
      s.origin={name:preset.factory?`${preset.name} · ${preset.category}`:preset.name};s.originBaseline=JSON.stringify(await this.rack.getState());
    }finally{s.busy=false;await this.checkModified();this.render();}
  }
  // A local edit of the track (Studio history), not a server save or library export.
  async applyEdits(s) {
    const rackState=structuredClone(await this.rack.getState()),value=JSON.stringify(rackState);
    if(!this.current(s))throw Error('Project changed.');
    if(value===s.baseline)return false;
    this.compare(s,value);
    const state=withOrigin(rackState,s.origin&&{name:s.origin.name,modified:s.originModified});
    this.workspace.updateTrack(s.trackId,copiedTrackSound(state));
    this.soundEdits.set(s.trackId,{projectId:s.projectId,epoch:s.epoch,trackId:s.trackId,name:s.trackName,state});
    s.baseline=value;s.modified=false;s.appliedOriginModified=s.originModified;s.selectedPreset='';
    return true;
  }
  async apply() {
    const s=this.active;if(!this.current(s)||s.busy)return;
    s.busy=true;this.render();
    try{if(await this.applyEdits(s))this.workspace.report('Sound applied to the track. Use Save project to keep your changes.');}
    catch(error){this.workspace.report(error.message,true);}
    finally{s.busy=false;await this.checkModified();this.render();}
  }
  finish(){return this.apply();}
  // Reloads the track's applied sound, dropping the edits not applied yet.
  async revert() {
    const s=this.active;if(!this.current(s)||s.busy)return;
    s.busy=true;this.render();
    try{
      const track=this.workspace.project.tracks.find(t=>t.id===s.trackId);
      const state=presetValue(track)?await this.workspace.tones.resolvePreset(track,s.projectId):s.originalTone;
      if(!this.current(s))return;
      await this.presets.applyState(structuredClone(state));
      s.baseline=JSON.stringify(await this.rack.getState());s.selectedPreset='';this.restoreOrigin(s,track);this.syncInputGain();
    }finally{s.busy=false;await this.checkModified();this.render();}
  }
  // Drops the current edits and gives the dock back (account change, destroy).
  async cancel(){const s=this.active;if(s)await this.leave(s,{restore:true,discard:true});}
  edits() {
    const w=this.workspace;
    return [...this.soundEdits.values()].filter(edit=>edit.projectId===w.project?.id&&edit.epoch===w.accountLoadEpoch&&w.owned&&w.project.tracks.some(t=>t.id===edit.trackId&&!t.removedAt));
  }
  async prepareSave() {
    if(this.savePrompt)return false;
    // Edits still in the rack belong to the save.
    const s=this.active;if(this.current(s)&&!s.busy){try{await this.applyEdits(s);}catch{return false;}}
    this.savePrompt=true;
    const project=this.workspace.project,epoch=this.workspace.accountLoadEpoch;
    try{
      for(const edit of this.edits()){
        const track=project.tracks.find(t=>t.id===edit.trackId),saved=this.workspace.saved.tracks.find(t=>t.id===edit.trackId);
        // Undo or a later preset selection must not export a stale edit.
        if(JSON.stringify(track.presetSnapshot)!==JSON.stringify(edit.state)||(!edit.choice&&JSON.stringify(saved?.presetSnapshot)===JSON.stringify(edit.state))){this.soundEdits.delete(edit.trackId);continue;}
        if(!edit.choice){
          const choice=await this.ask({name:this.presets.uniqueName(edit.name.slice(0,90))});
          if(!choice||this.workspace.project!==project||this.workspace.accountLoadEpoch!==epoch)return false;
          edit.choice=choice;edit.requestId=crypto.randomUUID();
        }
      }
      return this.workspace.project===project&&this.workspace.accountLoadEpoch===epoch;
    }finally{this.savePrompt=false;}
  }
  async completeSave() {
    const project=this.workspace.project,epoch=this.workspace.accountLoadEpoch;
    for(const edit of this.edits()){
      if(edit.choice?.reusable){
        if(!edit.exported)edit.exported=await this.presets.store.create(edit.choice.name,edit.state,{requestId:edit.requestId});
        if(this.workspace.project!==project||this.workspace.accountLoadEpoch!==epoch)throw Error('Project changed during preset export.');
        await this.presets.refresh();
      }
      this.soundEdits.delete(edit.trackId);
    }
  }
}
