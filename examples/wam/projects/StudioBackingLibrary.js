import {BackingTrackLibrary} from '../backing-track-player/BackingTrackLibrary.js';

// Adds private metadata to the bundled catalogue; never preloads audio files.
export class StudioBackingLibrary extends BackingTrackLibrary {
  constructor({account,...options}={}) {super(options.url);this.account=account;this.bundled=[];this.version=0;}
  async list() {
    const version=++this.version;
    if(!this.bundled.length)this.bundled=await super.list();
    const personal=this.account?.signedIn ? await this.account.api.listBackingTracks() : [];
    if(version!==this.version)return this.tracks;
    this.tracks=[...personal.map(track=>({...track,url:new URL(track.url,this.url).href})),...this.bundled];
    return this.tracks;
  }
  clearAccount() {++this.version;this.tracks=[...this.bundled];}
}

// Loading a generated backing never resumes the previously playing track.
export async function useBackingInTone({entry,library,player,projectPlayer,workspaces}) {
  projectPlayer.pause();player.engine.pause();
  await library.list();player.renderList();
  const loaded=await player.engine.loadTrack(entry.id);
  if(!loaded)return false;
  player.setExpanded(true);workspaces.show('tone');return true;
}
