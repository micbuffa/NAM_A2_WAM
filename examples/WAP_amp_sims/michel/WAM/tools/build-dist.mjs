import {cp, mkdir, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {dirname, resolve, join, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const source=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(source,'../../../../dist/wasabi-amps');
const slugs=['blues','cleanfull','modernmetal'];
// Only this generated distribution is replaced; the main application's dist is separate.
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
async function files(dir){
  const list=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    if(entry.isDirectory())list.push(...await files(path));else if(entry.isFile())list.push(path);
  }
  return list;
}
for(const slug of slugs){
  const folder=join(output,slug);
  await cp(join(source,slug),folder,{recursive:true});
  await cp(join(source,'shared'),join(folder,'shared'),{recursive:true});
  for(const name of ['index.js','Engine.js']){
    const path=join(folder,name);
    await writeFile(path,(await readFile(path,'utf8')).replaceAll("'../shared/","'./shared/"));
  }
  await cp(join(source,'SOURCE_MANIFEST.json'),join(folder,'SOURCE_MANIFEST.json'));
  await writeFile(join(folder,'README.md'),`# ${JSON.parse(await readFile(join(folder,'descriptor.json'),'utf8')).name}\n\nUpload this entire folder to a static HTTP(S) server. The WAM v2 entry URI is the URL of index.js. All runtime modules, fonts, images and impulses are inside this folder. Preserve its directory structure. No npm install or build is needed on the server.\n\nFor a host on another origin, configure CORS for the plugin files (Access-Control-Allow-Origin), and serve JavaScript with a JavaScript MIME type. Use HTTPS or localhost for AudioWorklet. The host must initialize the WAM environment before calling createInstance(groupId, audioContext).\n\nShared runtime sources are duplicated deliberately for independent deployment. See SOURCE_MANIFEST.json for imported source hashes.\n`);
  const manifest={plugin:slug,entry:'index.js',files:{}};
  for(const path of (await files(folder)).sort()){
    const name=relative(folder,path).split('\\').join('/');
    manifest.files[name]=createHash('sha256').update(await readFile(path)).digest('hex');
    // Every literal relative JS import must remain inside the standalone folder.
    if(path.endsWith('.js')){
      const text=await readFile(path,'utf8');
      for(const [,spec] of text.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["'](\.[^"']+)["']/g)){
        const target=resolve(dirname(path),spec);
        if(relative(folder,target).startsWith('..'))throw Error(`External dependency: ${name} -> ${spec}`);
        await readFile(target);
      }
    }
  }
  await writeFile(join(folder,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`${slug}: ${Object.keys(manifest.files).length} files; entry ${relative(process.cwd(),join(folder,'index.js'))}`);
}
// Optional demo at distribution root; plugins themselves do not depend on it.
let html=await readFile(join(source,'index.html'),'utf8');
html=html.replaceAll('../utility/GuitarRiffDry.mp3','./GuitarRiffDry.mp3').replace(/<p><a href="validation.html">[\s\S]*?<\/p>/,'');
await writeFile(join(output,'index.html'),html);
let host=await readFile(join(source,'host.js'),'utf8');
host=host.replace("'./shared/sdk.js'","'./blues/shared/sdk.js'").replaceAll('../utility/GuitarRiffDry.mp3','./GuitarRiffDry.mp3');
await writeFile(join(output,'host.js'),host);
await cp(join(source,'host.css'),join(output,'host.css'));
await cp(join(source,'../utility/GuitarRiffDry.mp3'),join(output,'GuitarRiffDry.mp3'));
await writeFile(join(output,'plugins.json'),JSON.stringify(slugs.map(slug=>({name:slug,url:`./${slug}/index.js`})),null,2)+'\n');
await writeFile(join(output,'README.md'),'# Standalone Wasabi WAM v2 amplifiers\n\nEach of blues/, cleanfull/ and modernmetal/ can be copied and deployed independently. Give a WAM host the URL of that folder’s index.js. The index.html at this distribution root is an optional demo for all three plugins, with a bundled dry guitar sample. It is not a plugin dependency.\n\nRebuild from repository root: npm run dist:wasabi-amps\n');
console.log(`Distribution ready: ${output}`);
