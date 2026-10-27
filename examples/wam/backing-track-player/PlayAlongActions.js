import {actionsRow, button, createDialog} from '../account/dialogs.js';
import {StudioMixExporter} from '../projects/StudioMixExporter.js';

export function audioImportChoices({local, youtube = null}) {
  return [{label:'Import from a file', run:local}, {label:'Import from YouTube', run:youtube}];
}
export function playAlongImportDialog(options) {
  const {dialog,body}=createDialog({title:'Import audio'});
  for(const choice of audioImportChoices(options)) {
    const control=button(choice.label,{primary:choice.label==='Import from a file'});
    control.disabled=!choice.run;
    control.onclick=()=>{dialog.close();Promise.resolve().then(choice.run).catch(options.error ?? (()=>{}));};
    body.append(actionsRow(control));
  }
  if(!options.youtube){const help=document.createElement('p');help.textContent='YouTube import requires the online Rails host and an account.';body.append(help);}
  const close=button('Cancel');close.onclick=()=>dialog.close();body.append(actionsRow(close));dialog.showModal();return dialog;
}
export const mp3Filename = name => `${String(name||'backing-track').replace(/\.(mp3|wav|aiff?|flac|ogg|m4a|aac|webm)$/iu,'').replace(/[\\/:*?"<>|\u0000-\u001f]/gu,'_').trim()||'backing-track'}.mp3`;
export function mp3Header(bytes) {
  if(bytes[0]===73&&bytes[1]===68&&bytes[2]===51)return true;
  return bytes[0]===255&&(bytes[1]&0xe0)===0xe0&&(bytes[1]&6)===2 && (bytes[2]>>4)>0&&(bytes[2]>>4)<15&&(bytes[2]&12)!==12;
}

// Export the full source, independent of live guitar, loop, mute, balance,
// time stretch and the player's normalization gain. Existing MP3s are reused.
export class PlayAlongMp3 {
  constructor({encode=(buffer,onProgress,options)=>new StudioMixExporter({api:null}).encode(buffer,onProgress,options),
    createContext=frames=>new OfflineAudioContext(2,frames,44100)}={}) {Object.assign(this,{encode,createContext});}
  cancel() {this.abort?.abort();}
  async prepare({buffer,sourceFile,entry,title,onProgress=()=>{}}) {
    this.cancel();const abort=this.abort=new AbortController(),signal=abort.signal;
    const current=()=>{if(signal.aborted)throw new DOMException('MP3 export cancelled','AbortError');};
    const filename=mp3Filename(title||sourceFile?.name||entry?.title);
    if(sourceFile){
      const header=new Uint8Array(await sourceFile.slice(0,4).arrayBuffer());current();
      if(mp3Header(header))return {blob:sourceFile,filename};
    } else if((entry?.filename?.toLowerCase().endsWith('.mp3') || /\.mp3(?:[?#]|$)/iu.test(entry?.url ?? '')) && /^(https?:\/\/|\/)/u.test(entry.url)) {
      return {url:entry.url,filename};
    }
    if(!buffer)throw Error('Load audio before downloading.');
    const frames=Math.round(buffer.duration*44100);
    if(!Number.isSafeInteger(frames)||frames<1||frames*8>512*1024**2)throw Error('Audio is too large for the 512 MiB MP3 conversion buffer.');
    let rendered=buffer;
    if(buffer.sampleRate!==44100||buffer.numberOfChannels!==2){
      onProgress('Preparing MP3…');const context=this.createContext(frames),source=context.createBufferSource();
      source.buffer=buffer;source.connect(context.destination);source.start(0);rendered=await context.startRendering();current();
    }
    const result=await this.encode(rendered,percent=>{if(!signal.aborted)onProgress(`Encoding MP3 · ${percent}%`);},{signal});current();
    return {blob:result.blob,filename};
  }
}
export function saveAudioDownload({blob,url,filename},{document=globalThis.document,urls=globalThis.URL,schedule=setTimeout}={}) {
  const owned=blob ? urls.createObjectURL(blob) : null;
  const link=document.createElement('a');link.href=owned||url;link.download=filename;
  document.body.append(link);link.click();link.remove();
  if(owned)schedule(()=>urls.revokeObjectURL(owned),60000);
}
