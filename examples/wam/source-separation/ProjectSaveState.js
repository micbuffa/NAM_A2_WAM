// Lightweight UI state only. Never reads PCM or writes storage.
export class ProjectSaveState {
 constructor(){this.generation=0;this.revision=0;this.savedRevision=0;this.pending=null;}
 get dirty(){return this.revision!==this.savedRevision;}
 get saving(){return this.pending!==null;}
 reset(saved=false){this.generation++;this.revision++;this.savedRevision=saved?this.revision:null;}
 changed(){this.revision++;}
 begin(){if(this.pending)return null;return this.pending={generation:this.generation,revision:this.revision};}
 finish(token,saved=false){
  if(this.pending!==token)return false;
  this.pending=null;if(token.generation!==this.generation)return false;
  if(saved)this.savedRevision=token.revision;
  return true;
 }
}
