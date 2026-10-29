import {createDialog,button,actionsRow} from '../../account/dialogs.js';
import {ACOUSTIC_PROTOCOL} from './LatencyAnalysis.js';
import {LatencyCalibrator} from './LatencyCalibrator.js';
import {LatencyProfiles,latencyConfiguration,sameLatencyConfiguration} from './LatencyProfiles.js';

// A measurement is applied explicitly, never inferred from base/outputLatency.
// Profiles stay in this browser; no device identifiers or probe PCM are uploaded.
export class RecordingCalibration {
  constructor(recording,{beginCalibration,profiles=new LatencyProfiles(),createCalibrator=options=>new LatencyCalibrator(options)}={}) {
    Object.assign(this,{recording,beginCalibration,profiles,createCalibrator});
    const $=recording.workspace.$;this.$=$;
    $('recordCalibrate').onclick=()=>this.open();
    $('recordUseCalibration').onclick=()=>this.useSaved();
    $('recordResetCalibration').onclick=()=>{this.active=null;this.pendingApply=null;$('recordCompensation').value='0';this.render();};
    $('recordCalibrationOutput').onchange=()=>this.configurationChanged();
    $('recordCompensation').oninput=()=>{this.active=null;this.pendingApply=null;this.render();};
    this.sinkChanged=()=>{this.cancel('Audio output changed. Measure again.');this.configurationChanged();};
    recording.context.addEventListener('sinkchange',this.sinkChanged);this.lastConfiguration=this.configuration;this.render();
  }
  get configuration(){return {...latencyConfiguration(this.recording.context,this.recording.source,Number(this.$('recordCalibrationOutput').value)),measurementMode:this.mode??'cable'};}
  get statusLabel(){return this.active?.measurement.protocol===ACOUSTIC_PROTOCOL?'acoustic estimate (manual compensation)':'measured loopback compensation';}
  configurationChanged(){
    const live=this.recording.source.mode==='live',configuration=this.configuration,changed=!sameLatencyConfiguration(configuration,this.lastConfiguration);
    this.lastConfiguration=configuration;
    if(live&&this.pendingApply){
      if(sameLatencyConfiguration(configuration,this.pendingApply.configuration))this.apply(this.pendingApply.measurement,configuration);
      this.pendingApply=null;
    }
    if(this.active&&(!live||!sameLatencyConfiguration(configuration,this.active.configuration))){this.active=null;this.$('recordCompensation').value='0';}
    else if(!this.active&&!this.pendingApply&&(changed||!live))this.$('recordCompensation').value='0';
    this.render();
  }
  apply(measurement,configuration){
    this.active={measurement,configuration};this.$('recordCompensation').value=String(Number((measurement.frames*1000/measurement.sampleRate).toFixed(4)));this.render();
  }
  metadata(ms){
    const current=this.active;
    if(current&&this.recording.source.mode==='live'&&sameLatencyConfiguration(current.configuration,this.configuration)&&Math.round(ms*this.configuration.sampleRate/1000)===current.measurement.frames){
      const {measurement}=current;
      if(measurement.protocol===ACOUSTIC_PROTOCOL)return {compensationFrames:measurement.frames,calibration:'manual'};
      return {compensationFrames:measurement.frames,calibration:'loopback',calibrationDetails:{...measurement,outputChannel:current.configuration.outputChannel}};
    }
    return {compensationFrames:Math.round(ms*this.recording.context.sampleRate/1000),calibration:ms?'manual':'uncalibrated'};
  }
  useSaved(){
    if(this.recording.busy||this.recording.source.mode!=='live')return;
    const configuration=this.configuration,measurement=this.profiles.lookup(configuration);
    if(measurement)this.apply(measurement,configuration);
  }
  render(){
    const live=this.recording.source.mode==='live',busy=this.recording.busy;
    this.$('recordCalibrate').disabled=busy||!!this.recording.workspace.saving||!this.beginCalibration||!!this.recording.workspace.separation?.busy;
    this.$('recordCalibrationOutput').disabled=busy;
    this.$('recordResetCalibration').disabled=busy;
    const saved=live&&this.profiles.lookup(this.configuration);
    this.$('recordUseCalibration').hidden=!saved||!!this.active;this.$('recordUseCalibration').disabled=busy;
    const measurement=this.active?.measurement;
    this.$('recordCalibrationStatus').textContent=measurement?`${measurement.protocol===ACOUSTIC_PROTOCOL?'Acoustic estimate (manual)':'Measured loopback'} · ${(measurement.frames*1000/measurement.sampleRate).toFixed(2)} ms (${measurement.frames} frames) · check ${measurement.validationResidualFrames} frames · ${new Date(measurement.measuredAt).toLocaleDateString()}`
      :this.pendingApply?'Measurement saved. Reconnect instrument, then Enable input / monitor to apply it on the same configuration.'
      :saved?'A saved measurement matches this configuration. Verify the interface and buffer settings, then Use saved calibration.'
      :'Manual / unmeasured. Calibration opens the input with monitoring disconnected. A hardware or buffer change requires a new measurement.';
  }
  cancel(message){this.cancelled=true;this.engine?.cancel(message);}
  clear(){this.cancel();if(this.dialog?.open)this.dialog.close();this.pendingApply=null;this.active=null;}
  async open(){
    const r=this.recording;if(r.busy||r.workspace.saving||!this.beginCalibration)return;
    if(this.dialog?.open)return;
    const {dialog,body}=createDialog({title:'Calibrate recording latency',eyebrow:'Physical output → input',className:'record-calibration'});this.dialog=dialog;
    const instructions=document.createElement('p');
    const methodLabel=document.createElement('label'),method=document.createElement('select');method.setAttribute('aria-label','Calibration method');
    method.append(...[['cable','Cable · recommended'],['acoustic','Speakers → microphone · acoustic test']].map(([value,textContent])=>Object.assign(document.createElement('option'),{value,textContent})));method.value=this.mode??'cable';methodLabel.append('Method ',method);
    const levelLabel=document.createElement('label'),level=document.createElement('input'),levelValue=document.createElement('span');
    Object.assign(level,{type:'range',min:-30,max:-6,step:3,value:-18});level.setAttribute('aria-label','Test signal level');levelValue.textContent='-18 dBFS';levelLabel.append('Test signal level ',level,levelValue);
    const acknowledgement=document.createElement('label'),check=document.createElement('input'),checkText=document.createTextNode('');check.type='checkbox';check.disabled=r.source.mode!=='live';acknowledgement.append(check,checkText);
    const describe=()=>{
      const common='All microphone routes into Tone/Studio are disconnected for the entire assistant. Input is disabled on close before restoring the outputs.';
      instructions.textContent=method.value==='acoustic'?`Speakers → microphone test: start with a moderate speaker volume in a quiet room. Six chirps measure the speaker, microphone and acoustic propagation together. This is an acoustic estimate, not a cable calibration. ${common}`:`Disconnect the instrument and connect output ${Number(this.$('recordCalibrationOutput').value)+1} to input ${(r.source.liveInput?.channelIndex??0)+1} on the audio interface. Turn off hardware direct monitoring and speakers. Use a moderate input gain, without clipping. Six test signals take about seven seconds. ${common} Remove the cable before enabling input again.`;
      checkText.textContent=method.value==='acoustic'?' Speaker volume moderate; ready for acoustic test':' Cable connected; hardware direct monitoring and speakers off';
    };
    describe();
    const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Choose the method and test level, then confirm you are ready.';
    const start=button('Measure',{primary:true}),apply=button('Apply compensation'),cancel=button('Close');start.disabled=true;apply.hidden=true;
    const progress=document.createElement('progress');progress.max=6;progress.value=0;progress.hidden=true;
    check.onchange=()=>{start.disabled=!check.checked||this.running;};
    let result=null;
    method.onchange=()=>{this.mode=method.value;this.configurationChanged();result=null;apply.hidden=true;check.checked=false;start.disabled=true;describe();};
    level.oninput=()=>{levelValue.textContent=`${level.value} dBFS`;result=null;apply.hidden=true;};
    apply.onclick=()=>{
      if(!result||this.running)return;
      const {measurement,configuration}=result;
      if(r.source.mode==='live'&&!sameLatencyConfiguration(configuration,this.configuration)){status.textContent='Configuration changed. Measure again.';apply.hidden=true;return;}
      const stored=this.profiles.save(configuration,measurement);
      if(r.source.mode==='live')this.apply(measurement,configuration);
      this.pendingApply={measurement,configuration};this.render();
      status.textContent=`Compensation accepted${stored?' and saved locally':' for this session (local storage unavailable)'}. ${method.value==='acoustic'?'Close the assistant, then Enable input / monitor.':'Remove the cable, reconnect your instrument, then Enable input / monitor.'} No community data was sent.`;apply.hidden=true;
    };
    start.onclick=()=>{this.task=measure();};
    const measure=async()=>{
      if(this.running||!check.checked||r.source.mode!=='live')return;
      const configuration=this.configuration;
      method.disabled=level.disabled=check.disabled=true;
      result=null;apply.hidden=true;this.running=true;this.cancelled=false;start.disabled=true;progress.hidden=false;progress.value=0;cancel.textContent='Cancel measurement';
      try{
        if(configuration.echoCancellation===true||configuration.noiseSuppression===true||configuration.autoGainControl===true)throw Error('Disable browser speech processing before calibration.');
        if(this.cancelled)throw Error('Calibration cancelled.');
        this.engine=this.createCalibrator({context:r.context,source:r.source});
        this.engine.addEventListener('progress',({detail})=>{progress.value=detail.index+1;status.textContent=`${detail.index===5?'Independent check':'Measurement'} ${detail.index+1}/6 · ${detail.result.valid?`${(detail.result.frames*1000/configuration.sampleRate).toFixed(2)} ms`:detail.result.reason}`;});
        status.textContent='Measuring return signal…';const measurement=await this.engine.run(configuration.outputChannel,{mode:method.value,levelDb:Number(level.value)});
        if(!sameLatencyConfiguration(configuration,this.configuration))throw Error('Audio configuration changed. Measure again.');
        result={measurement,configuration};apply.textContent=method.value==='acoustic'?'Use estimate as manual compensation':'Apply compensation';status.textContent=`${method.value==='acoustic'?'Acoustic round-trip estimate':'Round trip'}: ${(measurement.frames*1000/measurement.sampleRate).toFixed(2)} ms (${measurement.frames} frames). Spread ${measurement.spreadFrames} frames; confidence ${(measurement.confidence*100).toFixed(0)}%; independent check residual ${measurement.validationResidualFrames} frames. ${method.value==='acoustic'?'Includes acoustic propagation; saved as manual compensation.':'Apply once to new takes.'} Existing takes are unchanged.`;apply.hidden=false;
      }catch(error){status.textContent=error.message;}
      finally{
        this.engine=null;
        this.running=false;method.disabled=level.disabled=check.disabled=false;cancel.textContent='Close';start.disabled=r.source.mode!=='live'||!check.checked;this.render();
      }
    };
    let finish;
    cancel.onclick=()=>dialog.close();dialog.addEventListener('close',async()=>{
      this.cancel();this.dialog=null;
      try{await this.task;await finish?.();}catch(error){r.workspace.report(error.message,true);}
      finally{r.setState('idle');this.render();}
    });
    body.append(methodLabel,instructions,levelLabel,acknowledgement,progress,status,actionsRow(start,apply,cancel));
    try{
      finish=this.beginCalibration();r.armedId=null;r.setState('calibrating');dialog.showModal();
      if(r.source.mode!=='live'){
        status.textContent='Opening calibration input with Tone/Studio monitoring disconnected…';
        await r.enableLive();
        if(!dialog.open)return;
        if(r.source.mode!=='live')throw Error('No live input available.');
      }
      check.disabled=false;describe();status.textContent='Choose the method and test level, then confirm you are ready.';
    }
    catch(error){status.textContent=error.message;check.disabled=true;start.disabled=true;if(!dialog.open){await finish?.();r.setState('idle');}}


  }
}
