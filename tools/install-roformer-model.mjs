// Install already pinned weights for the static deployment; no Python required.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),meta=JSON.parse(await readFile(new URL('examples/wam/source-separation/research/bs-roformer-sw.json',root)));
const file=meta.files.find(f=>f.rfilename.endsWith('fp16.onnx'));
let bytes;
try{bytes=await readFile(new URL('third_party/bs-roformer-audit/'+file.rfilename,root));}
catch(error){if(error.code!=='ENOENT')throw error;const url=`https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx/resolve/${meta.modelRevision}/${file.rfilename}`;console.log('Downloading pinned SW weights…');const response=await fetch(url);if(!response.ok)throw Error(`Download failed: ${response.status}`);bytes=Buffer.from(await response.arrayBuffer());}
if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==file.lfs.sha256)throw Error('SW weight size / SHA-256 mismatch.');
const folder=new URL('examples/wam/source-separation/model-assets/',root);await mkdir(folder,{recursive:true});await writeFile(new URL(file.rfilename,folder),bytes);console.log('SW weights installed and verified.');
