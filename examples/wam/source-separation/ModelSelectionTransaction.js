// A settings dialog edits a draft. Only confirmation may invalidate a running job.
export class ModelSelectionTransaction {
 constructor(){this.generation=0;this.draft=null;}
 async beginWhenReady(ready,readSelection){await ready;if(this.draft)return this.draft;const selection=readSelection();if(!selection?.modelId)throw Error('Catalogue de modèles indisponible.');return this.begin(selection);}
 begin(selection){this.draft={...selection};return this.draft;}
 cancel(){const previous=this.draft;this.draft=null;return previous;}
 token(){return this.generation;}
 current(token){return token===this.generation;}
 async commit(selection,{stop,reset,prepare}){
  const previous=this.draft;this.draft=null;
  const changed=!!previous&&(previous.modelId!==selection.modelId||previous.backend!==selection.backend);
  if(changed){++this.generation;stop();reset(selection);}
  const token=this.generation;
  await prepare(selection);
  return this.current(token);
 }
 invalidate(){++this.generation;}
}
