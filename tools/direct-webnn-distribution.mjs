import {readFile,stat,mkdir,rm,cp,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {EXPERIMENT_MODELS} from '../examples/wam/source-separation/DirectWebNNAssets.js';
export async function inspectDirectAssets(directory,{required=false,exclude=false}={}){
 if(required&&exclude)throw Error('Choose --require-direct-webnn or --without-direct-webnn, not both.');
 try{
  if(exclude)return{available:false,reason:'Direct WebNN excluded from this build.'};
  const index=JSON.parse(await readFile(join(directory,'index.json'),'utf8'));
  if(index.format!=='direct-webnn-index-v1')throw Error('Invalid direct WebNN index.');
  for(const key of ['demucs4','roformer6']){
   const entry=index.models?.[key];
   if(entry?.sourceSha256!==EXPERIMENT_MODELS[key].sha256)throw Error(`Missing or unpinned ${key} export.`);
   for(const [filename,bytes] of [[`${key}.graph.json`,entry.graph?.bytes],[`${key}.weights.bin`,entry.weights?.bytes]]){
    const info=await stat(join(directory,filename));
    if(!info.isFile()||!Number.isSafeInteger(bytes)||bytes<=0||info.size!==bytes)throw Error(`Incomplete ${filename}.`);
   }
  }
  return{available:true,index};
 }catch(error){
  const reason=`Direct WebNN assets unavailable (${error.code==='ENOENT'?'missing generated files':error.message}).`;
  if(required)throw Error(`${reason} Run npm run prepare:direct-webnn, then python3 tools/export-direct-webnn.py. Previous dist was not replaced.`);
  return{available:false,reason};
 }
}
export async function copyDirectAssets(source,destination,state){
 await rm(destination,{recursive:true,force:true});
 if(state.available){
  await mkdir(destination,{recursive:true});
  for(const file of ['index.json',...Object.keys(EXPERIMENT_MODELS).flatMap(key=>[`${key}.graph.json`,`${key}.weights.bin`])])await cp(join(source,file),join(destination,file));
 }
 else{
  await mkdir(destination,{recursive:true});
  await writeFile(join(destination,'index.json'),JSON.stringify({format:'direct-webnn-index-v1',models:{},unavailableReason:state.reason},null,2)+'\n');
 }
}
