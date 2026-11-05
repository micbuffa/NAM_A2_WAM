import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname,basename} from 'node:path';
import {spawnSync} from 'node:child_process';

// Duration in seconds (one decimal) read by ffprobe, or null when ffprobe is missing or fails.
export function probeDuration(path) {
 const result=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',path],{encoding:'utf8'});
 const seconds=Number.parseFloat(result.stdout);
 return result.status===0&&Number.isFinite(seconds)&&seconds>0?Math.round(seconds*10)/10:null;
}

// Date the file was first committed (ISO 8601), or null when it is not in git yet.
export function gitAddedAt(path) {
 const result=spawnSync('git',['log','--diff-filter=A','--format=%aI','--',basename(path)],{cwd:dirname(path),encoding:'utf8'});
 const dates=result.status===0?result.stdout.trim().split('\n').filter(Boolean):[];
 return dates.at(-1)??null;
}

// Existing records keep their id and fields (including hand-written bpm and key);
// only a missing duration or date added (createdAt, the field Studio and YouTube tracks use) is filled in.
export async function updateTracks(directory,{check=false,duration=probeDuration,addedAt=gitAddedAt}={}) {
 const path=join(directory,'tracks.json');let previous={version:1,tracks:[]};
 try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous.version!==1||!Array.isArray(previous.tracks))throw Error('Invalid backing track manifest');
 const files=(await readdir(directory)).filter(f=>/\.(mp3|wav|ogg|m4a|flac)$/i.test(f)).sort((a,b)=>a.localeCompare(b,'en'));
 const missing=[],uncommitted=[];
 const tracks=files.map(file=>{
  const track=previous.tracks.find(t=>t.url===encodeURIComponent(file))||{id:'bt-'+createHash('sha256').update(file).digest('hex').slice(0,16),title:file.replace(/\.[^.]+$/,'').replaceAll('_',' '),url:encodeURIComponent(file)};
  const {id,title,url,duration:seconds=duration(join(directory,file)),createdAt=addedAt(join(directory,file)),...rest}=track;
  if(seconds==null)missing.push(file);if(createdAt==null)uncommitted.push(file);
  return {id,title,url,...(seconds!=null&&{duration:seconds}),...(createdAt!=null&&{createdAt}),...rest};
 });
 const output=JSON.stringify({version:1,tracks},null,2)+'\n';let current='';try{current=await readFile(path,'utf8');}catch{}
 if(!check&&current!==output)await writeFile(path,output);
 return {count:tracks.length,changed:current!==output,missing,uncommitted};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const check=process.argv.includes('--check');const result=await updateTracks(fileURLToPath(new URL('../examples/wam/assets/backingTracks/',import.meta.url)),{check});
 console.log(`${result.count} backing tracks${check?' (check only)':''}`);
 if(result.missing.length)console.warn(`No duration (is ffprobe installed?): ${result.missing.join(', ')}`);
 if(result.uncommitted.length)console.warn(`No date added until committed: ${result.uncommitted.join(', ')}`);
 if(check&&result.changed)process.exitCode=1;
}
