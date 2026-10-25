import {spawn} from 'node:child_process';
import {mkdtemp, readdir, stat, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, extname} from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export function youtubeURL(value) {
  const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port)throw Error('URL YouTube HTTPS requise.');
  let id;
  if(u.hostname==='youtu.be')id=u.pathname.slice(1);
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))id=u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
  if(!/^[\w-]{11}$/.test(id||''))throw Error('Choisissez une vidéo YouTube unique.');
  return `https://www.youtube.com/watch?v=${id}`;
}
export function runDownloader(binary,args,{signal,onLine=()=>{},timeout=180000}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(Error('Import annulé.'));return;}
    const child=spawn(binary,args,{shell:false,stdio:['ignore','pipe','pipe']});
    let output='',error='',pending='',failure,killTimer;
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    const abort=()=>{child.kill('SIGTERM');killTimer=setTimeout(()=>child.kill('SIGKILL'),1000);killTimer.unref();};
    signal?.addEventListener('abort',abort,{once:true});
    const timer=setTimeout(()=>{failure=Error('Délai de téléchargement dépassé.');child.kill('SIGKILL');},timeout);timer.unref();
    child.stdout.on('data',chunk=>{
      output+=chunk;if(output.length>2*1024*1024){failure=Error('Sortie du processus trop volumineuse.');child.kill('SIGKILL');return;}
      pending+=chunk;let n;
      try{while((n=pending.indexOf('\n'))>=0){onLine(pending.slice(0,n));pending=pending.slice(n+1);}}
      catch(e){failure=e;child.kill('SIGKILL');}
    });
    child.stderr.on('data',chunk=>{error=(error+chunk).slice(-8000);});
    child.on('error',e=>{failure=e;});
    child.on('close',code=>{
      clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);
      if(signal?.aborted)reject(Error('Import annulé.'));
      else if(failure)reject(failure);
      else if(code!==0)reject(Error(error.trim()||'Téléchargement interrompu.'));
      else resolve(output);
    });
  });
}
export class YouTubeImportService {
  constructor({binary,run=runDownloader,maxDuration=1800,maxBytes=200*1024*1024,ttl=15*60*1000}={}) {
    this.binary=binary||process.env.YT_DLP_PATH||fileURLToPath(new URL('./.youtube-runtime/bin/yt-dlp',import.meta.url));
    this.run=run;this.maxDuration=maxDuration;this.maxBytes=maxBytes;this.jobs=new Map();this.ttl=ttl;
    this.timer=setInterval(()=>{for(const [id,j] of this.jobs)if(Date.now()-j.updated>ttl){j.abort.abort();for(const res of j.listeners)res.end();this.jobs.delete(id);void j.task.finally(()=>j.directory&&rm(j.directory,{recursive:true,force:true})).catch(()=>{});}},Math.min(ttl,60000));this.timer.unref();
  }
  get available(){return this.run!==runDownloader||existsSync(this.binary);}
  update(j,patch){Object.assign(j,patch,{updated:Date.now()});const message=`data: ${JSON.stringify(this.snapshot(j))}\n\n`;for(const res of j.listeners)res.write(message);if(['ready','error','cancelled'].includes(j.state)){for(const res of j.listeners)res.end();j.listeners.clear();}}
  snapshot(j){return {id:j.id,state:j.state,progress:j.progress??null,message:j.message||'',metadata:j.metadata||null};}
  start(value){
    if(!this.available)throw Error('Service indisponible : lancez tools/setup-youtube-import.sh.');
    const url=youtubeURL(value);if([...this.jobs.values()].some(j=>['metadata','downloading'].includes(j.state)))throw Error('Un import est déjà en cours.');
    if(this.jobs.size>=12)throw Error('Trop d’imports conservés ; supprimez un import ou attendez son expiration.');
    const j={id:randomUUID(),url,state:'metadata',updated:Date.now(),listeners:new Set(),abort:new AbortController()};this.jobs.set(j.id,j);
    j.task=this.download(j).catch(async error=>{this.update(j,{state:j.abort.signal.aborted?'cancelled':'error',message:error.message});if(j.directory)await rm(j.directory,{recursive:true,force:true});});return j;
  }
  async download(j){
    j.directory=await mkdtemp(join(tmpdir(),'nam-youtube-'));
    const base=['--ignore-config','--no-playlist','--no-warnings','--no-plugin-dirs','--js-runtimes',`node:${process.execPath}`];
    const data=JSON.parse(await this.run(this.binary,[...base,'--dump-single-json','--skip-download',j.url],{signal:j.abort.signal}));
    if(!Number.isFinite(data.duration)||data.duration<=0||data.duration>this.maxDuration||data.is_live||data.live_status==='is_live'||data.live_status==='is_upcoming')throw Error(`Vidéo limitée à ${this.maxDuration/60} minutes, hors direct.`);
    this.update(j,{state:'downloading',metadata:{kind:'youtube',name:String(data.title||data.id).slice(0,300),videoId:data.id,url:j.url,duration:data.duration,importedAt:new Date().toISOString()}});
    await this.run(this.binary,[...base,'--format','bestaudio','--max-filesize',String(this.maxBytes),'--newline','--progress-template','download:PROGRESS:%(progress)j','--output',join(j.directory,'audio.%(ext)s'),j.url],{signal:j.abort.signal,onLine:line=>{
      if(!line.startsWith('PROGRESS:'))return;try{const p=JSON.parse(line.slice(9));if(p.downloaded_bytes>this.maxBytes){j.abort.abort();return;}const size=p.total_bytes||p.total_bytes_estimate;this.update(j,{progress:size?Math.min(99,100*p.downloaded_bytes/size):null,message:`${Math.round((p.downloaded_bytes||0)/1024)} Kio reçus`});}catch{}
    }});
    if(j.abort.signal.aborted)throw Error('Import annulé.');
    const files=(await readdir(j.directory)).filter(n=>/^audio\.(m4a|webm|opus|ogg|mp3|wav)$/.test(n));if(files.length!==1)throw Error('Format audio non pris en charge ou téléchargement incomplet.');
    j.path=join(j.directory,files[0]);const info=await stat(j.path);if(!info.isFile()||info.size<=0||info.size>this.maxBytes)throw Error('Taille audio invalide.');
    j.metadata={...j.metadata,size:info.size,extension:extname(j.path).slice(1),sha256:createHash('sha256').update(await readFile(j.path)).digest('hex')};this.update(j,{state:'ready',progress:100});
  }
  async cancel(id){const j=this.jobs.get(id);if(!j)return; j.abort.abort();this.update(j,{state:'cancelled',message:'Import annulé.'});await j.task;if(j.directory)await rm(j.directory,{recursive:true,force:true});this.jobs.delete(id);}
  async close(){clearInterval(this.timer);await Promise.all([...this.jobs.keys()].map(id=>this.cancel(id)));}
  async handle(req,res,url){
    if(!url.pathname.startsWith('/api/media-imports'))return false;
    const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
    // This prototype is intentionally local. No cookies, credentials or public proxy.
    const hostname=new URL(`http://${req.headers.host}`).hostname;
    if(!['127.0.0.1','localhost','[::1]'].includes(hostname)||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){json(403,{error:'Service réservé au serveur local et à son origine.'});return true;}
    try{
      if(url.pathname==='/api/media-imports/capabilities'&&req.method==='GET'){json(200,{available:this.available,maxDuration:this.maxDuration,maxBytes:this.maxBytes});return true;}
      if(url.pathname==='/api/media-imports'&&req.method==='POST'){
        if(!req.headers['content-type']?.startsWith('application/json'))throw Error('JSON requis.');
        let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Requête trop longue.');}
        const j=this.start(JSON.parse(body).url);json(202,this.snapshot(j));return true;
      }
      const match=url.pathname.match(/^\/api\/media-imports\/([\w-]+)(?:\/(events|audio))?$/);const j=match&&this.jobs.get(match[1]);if(!j){json(404,{error:'Import introuvable ou expiré.'});return true;}
      if(req.method==='DELETE'&&!match[2]){await this.cancel(j.id);json(200,{state:'cancelled'});return true;}
      if(req.method==='GET'&&match[2]==='events'){
        res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-accel-buffering':'no'});res.write(`data: ${JSON.stringify(this.snapshot(j))}\n\n`);
        if(['ready','error','cancelled'].includes(j.state))res.end();else{j.listeners.add(res);res.on('close',()=>j.listeners.delete(res));}return true;
      }
      if(req.method==='GET'&&match[2]==='audio'&&j.state==='ready'){
        const types={'.m4a':'audio/mp4','.webm':'audio/webm','.opus':'audio/ogg','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav'};const bytes=await readFile(j.path);res.writeHead(200,{'content-type':types[extname(j.path)],'content-length':bytes.length,'cache-control':'no-store'});res.end(bytes);return true;
      }
      json(409,{error:'Import non prêt ou méthode invalide.'});
    }catch(error){json(400,{error:error.message});}return true;
  }
}
