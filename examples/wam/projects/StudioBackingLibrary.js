import {BackingTrackLibrary} from '../backing-track-player/BackingTrackLibrary.js';

// Adds private metadata to the bundled catalogue; never preloads audio files.
export class StudioBackingLibrary extends BackingTrackLibrary {
  constructor({account,...options}={}) {super(options.url);this.account=account;this.bundled=[];this.temporary=[];this.version=0;}
  async list() {
    const version=++this.version;
    if(!this.bundled.length)this.bundled=await super.list();
    const personal=this.account?.signedIn ? await this.account.api.listBackingTracks() : [];
    if(version!==this.version)return this.tracks;
    this.tracks=[...this.temporary,...personal.map(track=>({...track,url:new URL(track.url,this.url).href})),...this.bundled];
    return this.tracks;
  }
  addTemporary(entry) {
    if(!entry.ephemeral||!entry.file)throw Error('Temporary mix audio is missing.');
    this.temporary=[entry,...this.temporary.filter(t=>t.projectId!==entry.projectId)].slice(0,2);
    this.tracks=[...this.temporary,...this.tracks.filter(t=>!t.ephemeral)];
  }
  clearAccount() {++this.version;this.temporary=[];this.tracks=[...this.bundled];}
  // Signed in, a file imported from this device is saved on the server, in My tracks.
  get canSave() {return !!this.account?.signedIn;}
  async save(file,{title=file.name.replace(/\.[^.]+$/,''),duration=null}={}) {
    const version=this.version;
    const saved=await this.account.api.createBackingTrack(title.slice(0,80)||'Backing track',file,Number.isFinite(duration)&&duration>0?duration:null);
    const entry={...saved,url:new URL(saved.url,this.url).href};
    // Signed out meanwhile: the account's track stays out of the library.
    if(version===this.version)this.tracks=[...this.temporary,entry,...this.tracks.filter(t=>!t.ephemeral&&t.id!==entry.id)];
    return entry;
  }
  // Only the creator's own backing tracks (editable): uploads and YouTube imports.
  async rename(id,title) {
    const saved=await this.account.api.renameBackingTrack(id,title);
    this.tracks=this.tracks.map(t=>t.id===id?{...t,title:saved.title}:t);
    return saved.title;
  }
  async remove(id) {
    await this.account.api.deleteBackingTrack(id);
    this.tracks=this.tracks.filter(t=>t.id!==id);
  }
}

// Loading a generated backing never resumes the previously playing track.
export async function useBackingInTone({entry,library,player,projectPlayer,workspaces}) {
  projectPlayer.pause();player.engine.pause();
  if(entry.ephemeral)library.addTemporary(entry);else await library.list();
  player.renderList();
  const loaded=await player.engine.loadTrack(entry.id);
  if(!loaded)return false;
  player.setView('track');workspaces.show('tone');return true;
}


// Load the already downloaded MP3 (a Play backing track), without opening Studio or starting inference.
export async function useYoutubeInTone({job, library, player, projectPlayer, workspaces}) {
  projectPlayer.pause();player.engine.pause();
  await library.list();player.renderList();
  if(!job.backingTrackId)throw Error('This import was saved in a Studio project. Open it in Studio.');
  if(!await player.engine.loadTrack(job.backingTrackId))throw Error('YouTube audio was not loaded. Try again.');
  player.setView('track');workspaces.show('tone');return true;
}
