import {confirmDialog,createDialog,button,actionsRow} from '../account/dialogs.js';
import {copiedTrackSound} from './TrackSoundState.js';
import {usesTrackPreset,presetValue} from './ProjectsModel.js';

export function trackSoundSaveDialog({name,reusable=false}) {
  return new Promise(resolve=>{
    const {dialog,body}=createDialog({title:'Save track sound',eyebrow:name,className:'track-sound-dialog'});
    const form=document.createElement('form');form.method='dialog';
    const label=document.createElement('label');label.textContent='Save sound in';
    const scope=document.createElement('select');scope.setAttribute('aria-label','Track sound destination');
    scope.append(new Option('This project only','project'),new Option('Project + new reusable preset','preset'));scope.value=reusable?'preset':'project';label.append(scope);
    const nameLabel=document.createElement('label');nameLabel.textContent='New preset name';
    const input=document.createElement('input');input.setAttribute('aria-label','New preset name');input.value=name;input.maxLength=100;nameLabel.append(input);
    const update=()=>{nameLabel.hidden=scope.value!=='preset';input.required=scope.value==='preset';};scope.onchange=update;update();
    const note=document.createElement('p');note.textContent='The project keeps its own copy of this sound. Existing library presets and the recorded DI are unchanged.';
    const cancel=button('Cancel'),save=button('Save project',{type:'submit',primary:true});cancel.onclick=()=>dialog.close('cancel');
    form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;dialog.result={reusable:scope.value==='preset',name:input.value.trim()};dialog.close('save');};
    form.append(label,nameLabel,note,actionsRow(cancel,save));body.append(form);dialog.addEventListener('close',()=>resolve(dialog.result??null),{once:true});dialog.showModal();
  });
}

// A track borrows Tone's editor/rack, not its global preset identity. The whole
// project can play through the visible rack without making another PCM copy.
export class TrackSoundEditor {
  constructor({workspace,rack,source,presets,workspaces,context,view=()=>{},route=()=>{},pauseAlong=()=>{},ask=trackSoundSaveDialog,confirm=confirmDialog}) {
    Object.assign(this,{workspace,rack,source,presets,workspaces,context,view,route,pauseAlong,ask,confirm});
    workspace.onEditTrackSound=id=>this.open(id);
    this.onPlayer=()=>{if(this.active)this.render();};workspace.player.addEventListener('statechange',this.onPlayer);
    this.beforeUnload=event=>{if(this.active){event.preventDefault();event.returnValue='';}};globalThis.addEventListener?.('beforeunload',this.beforeUnload);
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
    if(w.recording?.pending.size)throw Error('Save project before editing a take that is still in RAM.');
    const s=this.active={projectId:w.project.id,projectName:w.project.name,trackId:id,trackName:track.name,epoch:w.accountLoadEpoch,audio:!!track.audio,busy:true,previousLoop:{...w.player.loop},originalFields:structuredClone(track)};
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
  async finish({reusable=false}={}) {
    const s=this.active;if(!this.current(s)||s.busy)return;
    const choice=await this.ask({name:s.exportName??this.presets.uniqueName(s.trackName.slice(0,90)),reusable});if(!choice||!this.current(s))return;
    if(choice.reusable)s.exportName=choice.name;
    s.busy=true;this.render();
    try{
      const state=structuredClone(await this.rack.getState()),fields=copiedTrackSound(state);
      if(!this.current(s))throw Error('Project changed.');
      // Apply one project command. A retry of the same sound keeps the snapshot
      // identity and history entry, even if another part of Save failed.
      const serialized=JSON.stringify(state);
      if(s.appliedState!==serialized){this.workspace.updateTrack(s.trackId,fields);s.appliedState=serialized;s.appliedFields=fields;}
      if(!await this.workspace.save())throw Error('Project could not be saved. Sound remains in the editor; retry Save project.');
      s.projectSaved=true;
      if(!this.current(s))throw Error('Project changed.');
      if(choice.reusable){
        const key=JSON.stringify([choice.name,state]);s.exports??=new Map();
        let pending=s.exports.get(key);if(!pending){pending={requestId:crypto.randomUUID(),record:null};s.exports.set(key,pending);}
        if(!pending.record)pending.record=await this.presets.store.create(choice.name,state,{requestId:pending.requestId});
        if(!this.current(s))throw Error('Project changed.');
        await this.presets.refresh();
      }
      if(!this.current(s))throw Error('Project changed.');
      await this.close(s);this.workspace.report(choice.reusable?'Project saved and reusable preset created.':'Track sound saved in this project.');
    }catch(error){s.busy=false;this.render();this.workspace.report(error.message,true);}
  }
  async cancel({force=false}={}){
    if(!this.active||this.busy&&!force)return;
    if(!force&&this.modified&&!await this.confirm({title:'Discard sound edits?',message:'The track keeps its last applied sound. The DI is unchanged.',confirmLabel:'Discard edits'}))return;
    const s=this.active;
    if(s.appliedFields&&this.current(s)){
      const saved=this.workspace.saved.tracks.find(t=>t.id===s.trackId);
      const baseline=saved?.snapshotId===s.appliedFields.snapshotId?saved:s.originalFields;
      const fields=Object.fromEntries(['presetSnapshot','snapshotId','presetId','factoryPreset'].map(key=>[key,baseline[key]??null]));
      this.workspace.updateTrack(s.trackId,fields);
    }
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
