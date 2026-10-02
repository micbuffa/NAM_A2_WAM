import {readdir, readFile, writeFile, access} from 'node:fs/promises';
import {resolve, join, relative, sep} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {normalizeCategory} from '../examples/wam/WamPluginRegistry.js';

const categories = {
  BigMuff:'drive', Kpp_fuzz:'drive', OscTube:'drive', OverdriveRix:'drive', OwlDirty:'drive',
  kppdistorder:'drive', temper:'drive', CompressorGuitarix:'dynamics',
  DualPitchShifter:'modulation', Octaver:'modulation', StereoFreqShifter:'modulation',
  ThruZeroFlanger:'modulation', WeirdPhaser:'modulation', OwlShimmer:'reverb', kbverb:'reverb',
  SmoothDelay:'delay', VintageAmp60s:'amplifier',
};
const exists = path => access(path).then(()=>true,()=>false);
const uriFor = path => './'+path.split(sep).map(encodeURIComponent).join('/');

export async function updateCatalogue(directory, {check=false}={}) {
  const path=join(directory,'plugins.json');
  const original=await readFile(path,'utf8');
  const catalogue=JSON.parse(original);
  if(catalogue.version!==1 || !Array.isArray(catalogue.plugins))throw Error('Unsupported WAM catalogue');
  const base=pathToFileURL(path), plugins=[], seen=new Set(), added=[], removed=[];
  for(const entry of catalogue.plugins){
    const uri=typeof entry==='string'?entry:entry.uri;
    const url=new URL(uri,base);
    const local=url.protocol==='file:'?fileURLToPath(url):null;
    const inside=local && relative(directory,local)!=='..' && !relative(directory,local).startsWith('..'+sep);
    if(inside && !await exists(local)){removed.push(uri);continue;}
    if(!seen.has(url.href)){plugins.push(entry);seen.add(url.href);}
  }
  const folders=(await readdir(directory,{withFileTypes:true})).filter(e=>e.isDirectory()&&!e.name.startsWith('.')&&e.name!=='utils').sort((a,b)=>a.name.localeCompare(b.name,'en'));
  for(const folder of folders){
    const prefix=new URL(uriFor(folder.name)+'/',base).href;
    if([...seen].some(url=>url.startsWith(prefix)))continue;
    for(const sub of ['', 'plugin', 'src']){
      const entryPath=join(folder.name,sub,'index.js'), descriptorPath=join(directory,folder.name,sub,'descriptor.json');
      if(!await exists(join(directory,entryPath))||!await exists(descriptorPath))continue;
      const descriptor=JSON.parse(await readFile(descriptorPath,'utf8'));
      const uri=uriFor(entryPath);
      plugins.push({uri,category:categories[folder.name]||normalizeCategory(null,descriptor,descriptor.keywords||[])});
      added.push(uri);seen.add(new URL(uri,base).href);break;
    }
  }
  const output=JSON.stringify({...catalogue,plugins},null,2)+'\n';
  const changed=original!==output;
  if(changed&&!check)await writeFile(path,output);
  return {changed,added,removed,count:plugins.length};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const check=process.argv.includes('--check');
  const result=await updateCatalogue(fileURLToPath(new URL('../examples/wam/wamPlugins/',import.meta.url)),{check});
  console.log(`${result.count} WAMs; ${result.added.length} added; ${result.removed.length} removed${check?' (check only)':''}.`);
  for(const uri of result.added)console.log(`+ ${uri}`);
  for(const uri of result.removed)console.log(`- ${uri}`);
  if(check&&result.changed){console.error('Run npm run wam-plugins to update plugins.json.');process.exitCode=1;}
}
