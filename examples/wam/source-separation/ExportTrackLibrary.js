import {BackingTrackLibrary} from '../backing-track-player/BackingTrackLibrary.js';
export class ExportTrackLibrary extends BackingTrackLibrary {
  constructor(repository,url){super(url);this.repository=repository;}
  async list(){let tracks=[];try{tracks=await super.list();}catch(error){this.catalogueError=error;}
    let exports=[];try{exports=await this.repository.list('track');}catch(error){this.repositoryError=error;}
    if(!tracks.length&&!exports.length&&this.catalogueError)throw this.catalogueError;this.tracks=[...exports.map(x=>({id:x.id,title:x.title,generated:true})),...tracks];return this.tracks;}
  loadFile(id){return this.repository.getTrackFile(id);}
}
