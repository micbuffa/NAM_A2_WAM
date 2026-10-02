import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {updateCatalogue} from '../../tools/update-wam-plugins.mjs';
test('catalogue update discovers root/nested WAMs, preserves overrides and external entries, removes deleted plugins and is idempotent',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'wam-catalogue-'));
 try{
  const add=async(path)=>{await mkdir(join(dir,path),{recursive:true});await writeFile(join(dir,path,'index.js'),'');await writeFile(join(dir,path,'descriptor.json'),JSON.stringify({name:'Delay',keywords:['delay']}));};
  await add('Existing');await add('New/plugin');await add('utils/sdk');
  const old={uri:'./Existing/index.js',name:'Keep me',category:'amplifier',role:'nam',tags:['custom']};
  const extra=['../../../src/nam-wam/index.js','https://example.test/wam/index.js'];
  const original=JSON.stringify({version:1,plugins:[old,...extra,{uri:'./Gone/index.js'}]},null,2)+'\n';await writeFile(join(dir,'plugins.json'),original);
  const check=await updateCatalogue(dir,{check:true});assert.equal(check.changed,true);assert.equal(await readFile(join(dir,'plugins.json'),'utf8'),original);
  const update=await updateCatalogue(dir);assert.deepEqual(update.added,['./New/plugin/index.js']);assert.deepEqual(update.removed,['./Gone/index.js']);
  const saved=JSON.parse(await readFile(join(dir,'plugins.json')));assert.deepEqual(saved.plugins.slice(0,3),[old,...extra]);assert.equal(saved.plugins.at(-1).category,'delay');
  assert.equal((await updateCatalogue(dir)).changed,false);
  await rm(join(dir,'New'),{recursive:true});assert.deepEqual((await updateCatalogue(dir)).removed,['./New/plugin/index.js']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('explicitly disabled plugins remain catalogued but are not loaded by the host',async()=>{
 const {WamPluginRegistry}=await import('../../examples/wam/WamPluginRegistry.js');
 const requests=[];
 const registry=new WamPluginRegistry({fetchImpl:async url=>{requests.push(url);return {ok:true,json:async()=>({version:1,plugins:[{uri:'./broken/index.js',enabled:false},{uri:'./working/index.js'}]})};}});
 const records=await registry.load('https://example.test/plugins.json');assert.equal(records.length,1);assert.ok(records[0].entryUrl.includes('/working/'));assert.equal(requests.length,2);
});
