/** Optional same-origin importer. SSE is consumed once; no polling/reconnect loop. */
export class YouTubeImportClient {
  constructor({fetch:request=globalThis.fetch.bind(globalThis),base='/api/media-imports'}={}){this.fetch=request;this.base=base;this.generation=0;}
  async capabilities(){try{const r=await this.fetch(`${this.base}/capabilities`);if(!r.ok)return {available:false};return await r.json();}catch{return {available:false};}}
  async cancel(){const active=this.active;++this.generation;this.active=null;if(!active)return;active.abort.abort();if(active.id)await this.remove(active.id);}
  async remove(id){try{await this.fetch(`${this.base}/${encodeURIComponent(id)}`,{method:'DELETE'});}catch{}}
  async import(url,onProgress=()=>{}){
    const cleanup=this.cancel(),generation=this.generation;await cleanup;if(generation!==this.generation)throw new DOMException('Import remplacé','AbortError');const active={abort:new AbortController(),id:null};this.active=active;
    const current=()=>{if(generation!==this.generation||active.abort.signal.aborted)throw new DOMException('Import annulé','AbortError');};
    const request=async(path,options={})=>{const r=await this.fetch(path,{...options,signal:active.abort.signal});if(!r.ok){let error;try{error=(await r.json()).error;}catch{}throw Error(error||`Import HTTP ${r.status}`);}return r;};
    try{
      const r=await request(this.base,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});const job=await r.json();active.id=job.id;current();
      const response=await request(`${this.base}/${active.id}/events`),reader=response.body.getReader(),decoder=new TextDecoder();let text='',ready;
      while(!ready){const {value,done}=await reader.read();current();text+=decoder.decode(value||new Uint8Array(),{stream:!done});let boundary;while((boundary=text.indexOf('\n\n'))>=0){const event=text.slice(0,boundary);text=text.slice(boundary+2);const line=event.split('\n').find(l=>l.startsWith('data: '));if(!line)continue;const state=JSON.parse(line.slice(6));onProgress(state);if(['error','cancelled'].includes(state.state))throw Error(state.message||'Import interrompu.');if(state.state==='ready'){ready=state;break;}}if(done&&!ready)throw Error('Connexion d’import interrompue.');}
      await reader.cancel();const audio=await request(`${this.base}/${active.id}/audio`),blob=await audio.blob();current();return {blob,metadata:ready.metadata};
    }finally{active.abort.abort();if(active.id)await this.remove(active.id);if(this.active===active)this.active=null;}
  }
}

export function createYouTubeImportPanel({onImport,onBegin=()=>{},isBusy=()=>false,client=new YouTubeImportClient()}={}){
  const panel=document.createElement('section');panel.className='youtube-import';panel.innerHTML='<details><summary>Importer depuis YouTube</summary><form><label>URL de la vidéo <input name="url" type="url" required placeholder="https://www.youtube.com/watch?v=…" aria-label="URL YouTube"></label> <button type="submit" disabled>Importer l’audio</button> <button type="button" hidden>Annuler</button></form><progress max="100" hidden aria-label="Progression de l’import YouTube"></progress><p role="status">Vérification du service local…</p></details>';
  const form=panel.querySelector('form'),input=form.elements.url,submit=panel.querySelector('[type=submit]'),cancel=panel.querySelector('[type=button]'),status=panel.querySelector('[role=status]'),progress=panel.querySelector('progress');let disposed=false,generation=0,controller,available=false;
  client.capabilities().then(c=>{if(disposed)return;available=!!c.available;submit.disabled=!available;status.textContent=c.available?'Audio natif · vidéo unique · 30 min / 200 Mio maximum.':'Import disponible avec le serveur Node local après tools/setup-youtube-import.sh. Le chargement de fichiers reste disponible.';});
  cancel.onclick=()=>{++generation;const pending=!!controller;controller?.abort();controller=null;void client.cancel();if(pending)status.textContent='Import annulé ; morceau précédent conservé.';cancel.hidden=true;progress.hidden=true;submit.disabled=!available;input.disabled=false;};
  form.onsubmit=async event=>{event.preventDefault();if(isBusy()){status.textContent='Attendez la fin du traitement en cours.';return;}const token=++generation;onBegin();controller=new AbortController();submit.disabled=true;input.disabled=true;cancel.hidden=false;progress.hidden=false;progress.removeAttribute('value');
    try{const result=await client.import(input.value,state=>{if(token!==generation||disposed)return;status.textContent=state.state==='metadata'?'Lecture des informations de la vidéo…':state.state==='ready'?'Audio reçu · préparation du décodage…':`Téléchargement ${state.progress===null?'':Math.floor(state.progress)+' %'} · ${state.message}`;if(state.progress===null)progress.removeAttribute('value');else progress.value=state.progress;});if(token!==generation||disposed)return;status.textContent='Décodage de l’audio…';progress.removeAttribute('value');await onImport(result,controller.signal);if(token===generation&&!disposed)status.textContent=`Audio prêt : ${result.metadata.name}. Cliquez sur Separate pour séparer.`;
    }catch(error){if(token===generation&&!disposed)status.textContent=error.name==='AbortError'?'Import annulé.':`Import impossible : ${error.message}`;}
    finally{if(token===generation&&!disposed){controller=null;submit.disabled=!available;input.disabled=false;cancel.hidden=true;progress.hidden=true;}}
  };
  return {element:panel,cancel:cancel.onclick,destroy(){disposed=true;++generation;controller?.abort();void client.cancel();panel.remove();}};
}
