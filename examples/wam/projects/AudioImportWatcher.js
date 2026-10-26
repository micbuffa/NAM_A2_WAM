// Only running server jobs are polled. Closing the dialog stops polling, not
// the server job; reopening discovers it again through the account API.
export const importActive = job => ['queued','metadata','downloading','converting'].includes(job?.state);
export class AudioImportWatcher {
  constructor({api, onChange, schedule=(fn,ms)=>setTimeout(fn,ms), unschedule=id=>clearTimeout(id)}) {
    Object.assign(this,{api,onChange,schedule,unschedule});this.epoch=0;
  }
  stop() { this.epoch++;this.unschedule(this.timer); }
  watch(job) {
    this.stop();const epoch=this.epoch;
    const accept = value => {
      if(epoch!==this.epoch)return;
      this.onChange(value);
      if(importActive(value))this.timer=this.schedule(async()=>{
        try {accept(await this.api.getAudioImport(value.id));}
        catch(error){if(epoch===this.epoch)this.onChange({...value,state:'error',message:`Status unavailable: ${error.message}. Reopen Import audio to reconnect.`});}
      },1000);
    };
    accept(job);
  }
}
