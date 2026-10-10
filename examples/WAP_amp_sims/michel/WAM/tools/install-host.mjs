import {cp,rm} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {updateCatalogue} from '../../../../../tools/update-wam-plugins.mjs';

const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=resolve(source,'../../../..');
const target=join(root,'examples/wam/wamPlugins');
const build=spawnSync(process.execPath,[join(source,'tools/build-dist.mjs')],{stdio:'inherit'});
if(build.error)throw build.error;if(build.status!==0)throw Error('Wasabi distribution build failed');
for(const [slug,name] of [['modernmetal','metalmachine'],['cleanfull','cleanmachine'],['blues','bluesmachine']]){
  // These folders are generated plugin copies; replace them to avoid stale files.
  const folder=join(target,name);
  await rm(folder,{recursive:true,force:true});
  await cp(join(root,'dist/wasabi-amps',slug),folder,{recursive:true});
  console.log(`Installed ${name}`);
}
const result=await updateCatalogue(target);
console.log(`Catalogue: ${result.count} plugins, ${result.added.length} added.`);
