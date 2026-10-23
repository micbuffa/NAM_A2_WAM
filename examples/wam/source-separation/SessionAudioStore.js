import {encodeSessionAudio,decodeSessionAudio} from './SessionAudioEncoding.js';
// Audio lives apart from lightweight session metadata; no model-store schema change.
export class SessionAudioStore {
  constructor({indexedDB=globalThis.indexedDB}={}){this.indexedDB=indexedDB;}
  async open(){
    if(!this.indexedDB)throw Error('IndexedDB indisponible : sauvegarde audio impossible.');
    if(!this.pending)this.pending=new Promise((resolve,reject)=>{
      const request=this.indexedDB.open('nam-multitrack-sessions',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('audio',{keyPath:'key'});
      request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.pending=null;};resolve(db);};
      request.onerror=request.onblocked=()=>{this.pending=null;reject(request.error||Error('Cache audio bloqué ; fermez les autres onglets.'));};
    });return this.pending;
  }
  async get(key){const db=await this.open();const record=await new Promise((resolve,reject)=>{const r=db.transaction('audio').objectStore('audio').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return decodeSessionAudio(record);}
  async put(record,{measure=(name,callback)=>callback()}={}){const db=await this.open();const encoded=await encodeSessionAudio(record,{measure});return new Promise((resolve,reject)=>{const tx=db.transaction('audio','readwrite');measure('sessionIndexedDbPut',()=>tx.objectStore('audio').put(encoded));tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error||Error('Cache audio plein ou indisponible.'));});}
  async close(){const db=await this.pending;db?.close();this.pending=null;}
}
