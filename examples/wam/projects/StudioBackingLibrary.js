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


// Return to the source project of a generated mix, or simply switch back to
// the current Studio project for an external backing. Never reimport audio.
export async function returnToStudio({projectId,workspace,backingPlayer,workspaces}) {
  if (projectId && workspace.project?.id !== projectId) await workspace.open(projectId);
  if (projectId && workspace.project?.id !== projectId) return false;
  backingPlayer.pause();workspaces.show('projects');return true;
}

// Load the already downloaded MP3, without opening Studio or starting inference.
export async function useYoutubeInTone({job, library, player, projectPlayer, workspaces}) {
  projectPlayer.pause();player.engine.pause();
  await library.list();player.renderList();
  let id=job.sourceTrackId ? `studio-source-${job.sourceTrackId}` : null;
  // Jobs created before sourceTrackId was recorded can still be opened when
  // their project contains exactly one matching, authorized YouTube source.
  if(!id){
    const matches=library.tracks.filter(track=>track.origin==='youtube'&&track.projectId===job.projectId&&(!job.metadata?.videoId||track.videoId===job.metadata.videoId));
    if(matches.length===1)id=matches[0].id;
  }
  if(!id)throw Error('This older import has no unique available source. Import the video again.');
  if(!await player.engine.loadTrack(id))throw Error('YouTube audio was not loaded. Try again.');
  player.setExpanded(true);workspaces.show('tone');return true;
}
