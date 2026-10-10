import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
export async function updateTracks(directory,{check=false}={}) {
 const path=join(directory,'tracks.json');let previous={version:1,tracks:[]};
 try{previous=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(previous.version!==1||!Array.isArray(previous.tracks))throw Error('Invalid backing track manifest');
 const files=(await readdir(directory)).filter(f=>/\.(mp3|wav|ogg|m4a|flac)$/i.test(f)).sort((a,b)=>a.localeCompare(b,'en'));
 const tracks=files.map(file=>previous.tracks.find(t=>t.url===encodeURIComponent(file))||{id:'bt-'+createHash('sha256').update(file).digest('hex').slice(0,16),title:file.replace(/\.[^.]+$/,'').replaceAll('_',' '),url:encodeURIComponent(file)});
 const output=JSON.stringify({version:1,tracks},null,2)+'\n';let current='';try{current=await readFile(path,'utf8');}catch{}
 if(!check&&current!==output)await writeFile(path,output);
 return {count:tracks.length,changed:current!==output};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const check=process.argv.includes('--check');const result=await updateTracks(fileURLToPath(new URL('../examples/wam/assets/backingTracks/',import.meta.url)),{check});
 console.log(`${result.count} backing tracks${check?' (check only)':''}`);if(check&&result.changed)process.exitCode=1;
}
