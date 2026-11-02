import {confirmDialog,createDialog,button,actionsRow} from '../account/dialogs.js';
import {copiedTrackSound} from './TrackSoundState.js';
import {usesTrackPreset,presetValue} from './ProjectsModel.js';

export function trackSoundSaveDialog({name,reusable=false}) {
  return new Promise(resolve=>{
    const {dialog,body}=createDialog({title:'Save project',eyebrow:name,className:'track-sound-dialog'});
    const form=document.createElement('form');form.method='dialog';
    const label=document.createElement('label');label.className='track-sound-reuse';
    const scope=document.createElement('input');scope.type='checkbox';scope.checked=reusable;scope.setAttribute('aria-label','Also create a reusable Tone preset');label.append(scope,document.createTextNode('Also create a reusable Tone preset'));
    const nameLabel=document.createElement('label');nameLabel.textContent='New preset name';
    const input=document.createElement('input');input.setAttribute('aria-label','New preset name');input.value=name;input.maxLength=100;nameLabel.append(input);
    const update=()=>{nameLabel.hidden=!scope.checked;input.required=scope.checked;};scope.onchange=update;update();
    const note=document.createElement('p');note.textContent='The edited sound is saved in this project. Optionally make it available in Tone for other projects.';
    const cancel=button('Cancel'),save=button('Save project',{type:'submit',primary:true});cancel.onclick=()=>dialog.close('cancel');
    form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;dialog.result={reusable:scope.checked,name:input.value.trim()};dialog.close('save');};
    form.append(label,nameLabel,note,actionsRow(cancel,save));body.append(form);dialog.addEventListener('close',()=>resolve(dialog.result??null),{once:true});dialog.showModal();
  });
}

// A track borrows Tone's editor/rack, not its global preset identity. The whole
// project can play through the visible rack without making another PCM copy.
export class TrackSoundEditor {
  constructor({workspace,rack,source,presets,workspaces,context,view=()=>{},route=()=>{},pauseAlong=()=>{},ask=trackSoundSaveDialog,confirm=confirmDialog}) {
    Object.assign(this,{workspace,rack,source,presets,workspaces,context,view,route,pauseAlong,ask,confirm});
    workspace.onEditTrackSound=id=>this.open(id);
    this.soundEdits=new Map();
    workspace.prepareSoundSave=()=>this.prepareSave();workspace.completeSoundSave=()=>this.completeSave();
    workspace.hasPendingSoundExport=()=>this.edits().some(edit=>edit.choice?.reusable);
    this.onPlayer=()=>{if(this.active)this.render();};workspace.player.addEventListener('statechange',this.onPlayer);
    this.beforeUnload=event=>{if(this.active||this.edits().length){event.preventDefault();event.returnValue='';}};globalThis.addEventListener?.('beforeunload',this.beforeUnload);
  }
  get busy(){return !!this.active?.busy;}
  get modified(){return !!this.active?.modified;}
  get selectedPreset(){return this.active?.selectedPreset??'';}
  get audioEditing(){return !!this.active?.audio;}
  get title(){return this.active?.trackName??'Track sound';}
  get projectName(){return this.active?.projectName??'';}
  current(s=this.active){return !!s&&this.active===s&&this.workspace.project?.id===s.projectId&&this.workspace.accountLoadEpoch===s.epoch&&this.workspace.owned&&this.workspace.project.tracks.some(t=>t.id===s.trackId&&!t.removedAt);}
  async open(id) {
    if(this.active){this.workspaces.show('tone');return;}
    if(this.presets.busy)throw Error('Wait for the current Tone preset operation to finish.');
    const w=this.workspace,track=w.project?.tracks.find(t=>t.id===id);
    if(!w.owned||!track||!usesTrackPreset(track))throw Error('FX editing is for your personal guitar and bass tracks.');
    if(w.saving||w.recording?.busy||w.separation?.busy||w.separation?.result)throw Error('Finish or save the current operation before editing this sound.');
    const s=this.active={projectId:w.project.id,projectName:w.project.name,trackId:id,trackName:track.name,epoch:w.accountLoadEpoch,audio:!!track.audio,busy:true,previousLoop:{...w.player.loop}};
    w.player.pause();this.pauseAlong();this.presets.setExternalEditor(this);this.render();
    try{
      s.originalTone=structuredClone(await this.rack.getState());if(!this.current(s))throw Error('Project changed.');
      if(s.audio)s.releaseInput=this.source.suspendMonitoring();this.route();
      const state=presetValue(track)?await w.tones.resolvePreset(track,s.projectId):s.originalTone;
      copiedTrackSound(state);if(!this.current(s))throw Error('Project changed.');
      await this.presets.applyState(structuredClone(state));if(!this.current(s))throw Error('Project changed.');
      s.baseline=JSON.stringify(await this.rack.getState());
      if(s.audio){
        s.input=this.context.createGain();s.input.channelCount=1;s.input.channelCountMode='explicit';s.input.connect(this.rack.a.input);
        this.syncInputGain();w.tones.setOverride(id,{input:s.input,live:this.rack.a.input,output:this.rack.output});
      }
      s.busy=false;this.workspace.selectedId=id;this.workspaces.show('tone');this.render();
    }catch(error){await this.close(s);throw error;}
  }
  render(){this.view(this);this.presets.render();}
  syncInputGain(){const s=this.active;if(s?.input)s.input.gain.setValueAtTime(10**((this.source.trimDb.live??0)/20),this.context.currentTime);}
  async checkModified(){const s=this.active;if(!s||s.busy)return;const value=JSON.stringify(await this.rack.getState());if(this.current(s)){s.modified=value!==s.baseline;this.syncInputGain();this.render();}}
  async loadPreset(id){
    const s=this.active;if(!this.current(s)||s.busy)return;
    if(this.modified&&!await this.confirm({title:'Replace edited sound?',message:'The current edits have not been applied to the track.',confirmLabel:'Load preset'}))return this.render();
    s.busy=true;this.render();
    try{
      const preset=this.presets.find(id);if(!preset)throw Error('Preset unavailable.');
      const {state}=await(preset.factory?this.presets.factoryStore:this.presets.store).get(preset.id);
      copiedTrackSound(state);if(!this.current(s))throw Error('Project changed.');
      await this.presets.applyState(structuredClone(state));s.selectedPreset=String(id);this.syncInputGain();
    }finally{s.busy=false;await this.checkModified();this.render();}
  }
  async togglePlay(){if(this.busy||!this.active)return;const player=this.workspace.player;return player.playing?player.pause():player.play();}
  toggleLoop(){const player=this.workspace.player;if(this.busy||!this.active||!player.duration)return;const loop=player.loop;player.setLoop({enabled:!loop.enabled,start:loop.end>loop.start?loop.start:0,end:loop.end>loop.start?loop.end:player.duration});this.render();}
  // Returning to Studio is a local edit, not a server save or library export.
  async finish() {
    const s=this.active;if(!this.current(s)||s.busy)return;
    s.busy=true;this.render();
    try{
      const state=structuredClone(await this.rack.getState());
      if(!this.current(s))throw Error('Project changed.');
      if(JSON.stringify(state)!==s.baseline){
        this.workspace.updateTrack(s.trackId,copiedTrackSound(state));
        this.soundEdits.set(s.trackId,{projectId:s.projectId,epoch:s.epoch,trackId:s.trackId,name:s.trackName,state});
      }
      await this.close(s);this.workspace.report('Returned to Studio. Use Save project to keep your changes.');
    }catch(error){s.busy=false;this.render();this.workspace.report(error.message,true);}
  }
  edits() {
    const w=this.workspace;
    return [...this.soundEdits.values()].filter(edit=>edit.projectId===w.project?.id&&edit.epoch===w.accountLoadEpoch&&w.owned&&w.project.tracks.some(t=>t.id===edit.trackId&&!t.removedAt));
  }
  async prepareSave() {
    if(this.savePrompt)return false;
    this.savePrompt=true;
    const project=this.workspace.project,epoch=this.workspace.accountLoadEpoch;
    try{
      for(const edit of this.edits()){
        const track=project.tracks.find(t=>t.id===edit.trackId),saved=this.workspace.saved.tracks.find(t=>t.id===edit.trackId);
        // Undo or a later preset selection must not export a stale Tone edit.
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
  async cancel({force=false}={}){
    if(!this.active||this.busy&&!force)return;
    if(!force&&this.modified&&!await this.confirm({title:'Discard sound edits?',message:'The track keeps its last applied sound. The DI is unchanged.',confirmLabel:'Discard edits'}))return;
    const s=this.active;
    await this.close();
  }
  async close(s=this.active){
    if(!s||this.active!==s)return;s.busy=true;this.workspace.player.pause();
    this.workspace.tones.setOverride(s.trackId,null);s.input?.disconnect();
    try{if(s.originalTone)await this.presets.applyState(s.originalTone);}
    finally{
      this.workspace.player.setLoop(s.previousLoop);this.active=null;this.presets.setExternalEditor(null);this.workspaces.show('projects');s.releaseInput?.();this.route();this.view(this);this.presets.scheduleCheck();this.presets.scheduleDraft();
    }
  }
}
