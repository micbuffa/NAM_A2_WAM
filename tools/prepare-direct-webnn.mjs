// Explicit, hash-verified checkpoint download. Never called by the static build.
import {readFile,mkdir,stat,rename,rm} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {models}=JSON.parse(await readFile(resolve(root,'examples/wam/source-separation/studio-models.json'),'utf8'));
const targets=[['htdemucs_4s_onnx','third_party/nam-webgpu-probe/htdemucs-core.onnx'],['bs_roformer_sw_6s','examples/wam/source-separation/model-assets/bs_roformer_sw_6stem_fp16.onnx']];
const hashFile=async path=>{const h=createHash('sha256');for await(const bytes of createReadStream(path))h.update(bytes);return h.digest('hex');};
export async function prepareDirectCheckpoints({directory=root,catalogue=models,fetchImpl=fetch,log=console.log}={}){
for(const [id,path]of targets){
 const asset=catalogue.find(m=>m.id===id).files[0],target=resolve(directory,path);
 try{await stat(target);if(await hashFile(target)!==asset.sha256)throw Error(`Existing checkpoint has wrong SHA-256: ${path}. Move it aside before retrying.`);log(`${id}: verified existing checkpoint.`);continue;}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(dirname(target),{recursive:true});const partial=target+'.partial-'+process.pid;
 try{
  log(`Downloading ${id} (${asset.size} bytes)…`);
  const response=await fetchImpl(asset.url);if(!response.ok)throw Error(`HTTP ${response.status}: ${asset.url}`);
  let received=0;const hash=createHash('sha256');
  await pipeline(Readable.fromWeb(response.body),new Transform({transform(chunk,_encoding,done){received+=chunk.length;hash.update(chunk);done(null,chunk);}}),createWriteStream(partial,{flags:'wx'}));
  if(received!==asset.size||hash.digest('hex')!==asset.sha256)throw Error(`Checkpoint integrity failed: ${id}`);
  await rename(partial,target);log(`${id}: size and SHA-256 verified.`);
 }catch(error){await rm(partial,{force:true});throw error;}
}
log('Checkpoints ready. Run python3 tools/export-direct-webnn.py in the documented ONNX Python environment.');

}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareDirectCheckpoints();
