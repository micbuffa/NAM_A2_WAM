// Install an already exported and validated preview model, never change its hash silently.
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),manifest=JSON.parse(await readFile(new URL('examples/wam/source-separation/models.json',root)));
const file=manifest.models.find(m=>m.profile==='preview').files[0];
const source=new URL('third_party/nam-latency-probe/htdemucs-2s-core.onnx',root),bytes=await readFile(source);
if(bytes.length!==file.size||createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Export différent du modèle validé : refaire la validation audio et versionner le manifeste avant installation.');
await mkdir(new URL('examples/wam/source-separation/model-assets/',root),{recursive:true});
await copyFile(source,new URL('examples/wam/source-separation/'+file.url,root));
console.log('Export 2 s vérifié et installé pour le déploiement statique.');
