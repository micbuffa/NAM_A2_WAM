export class BackingTrackLibrary {
  constructor(url=new URL('../assets/backingTracks/tracks.json',import.meta.url)) {this.url=new URL(url);this.tracks=[];}
  async list() {
    const response=await fetch(this.url);if(!response.ok)throw Error(`Backing track catalogue: HTTP ${response.status}`);
    const manifest=await response.json();if(manifest.version!==1||!Array.isArray(manifest.tracks))throw Error('Invalid backing track catalogue');
    const ids=new Set();
    this.tracks=manifest.tracks.map(track=>{
      if(!track.id||typeof track.title!=='string'||typeof track.url!=='string'||ids.has(track.id))throw Error('Invalid backing track entry');
      ids.add(track.id);const url=new URL(track.url,this.url);if(!['http:','https:'].includes(url.protocol))throw Error('Unsupported media URL');
      return {...track,url:url.href};
    });return this.tracks;
  }
  resolve(id) {const track=this.tracks.find(t=>t.id===id);if(!track)throw Error('Track missing from library; select it again');return track;}
}
