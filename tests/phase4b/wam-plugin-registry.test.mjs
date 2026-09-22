import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WamPluginRegistry,fallbackThumbnail,isAllowedPluginUrl,normalizeCatalogueEntry,normalizeCategory,normalizeDescriptor} from '../../examples/wam/WamPluginRegistry.js';

test('catalogue entries resolve relative to plugins.json and reject unsafe remote HTTP',()=>{
  const base='https://host.example/app/wamPlugins/plugins.json';
  assert.equal(normalizeCatalogueEntry('./delay/index.js',base).entryUrl,'https://host.example/app/wamPlugins/delay/index.js');
  assert.equal(normalizeCatalogueEntry({uri:'./tuner/src/index.js',descriptor:'./tuner/src/descriptor.json'},base).descriptorUrl,'https://host.example/app/wamPlugins/tuner/src/descriptor.json');
  assert.equal(normalizeCatalogueEntry('http://127.0.0.1:8765/plugin/index.js',base).origin,'remote');
  assert.equal(isAllowedPluginUrl('https://plugins.example/fx/index.js'),true);
  assert.throws(()=>normalizeCatalogueEntry('http://untrusted.example/fx/index.js',base),/unsafe URL/u);
  assert.throws(()=>normalizeCatalogueEntry('javascript:alert(1)',base),/unsafe URL/u);
});

test('descriptor normalization applies category precedence, tags, tuner role, and fallback artwork',()=>{
  assert.equal(normalizeCategory(null,{name:'TS9 Overdrive',keywords:['faust']}),'drive');
  assert.equal(normalizeCategory('modulation',{name:'Delay',keywords:['delay']}),'modulation');
  const entry=normalizeCatalogueEntry({uri:'./tuner/index.js',category:'tuner'},'https://host.example/wamPlugins/plugins.json');
  const record=normalizeDescriptor(entry,{name:'TunerMachine',vendor:'Wasabi',keywords:['Audio','Utility']});
  assert.equal(record.role,'tuner');assert.equal(record.category,'tuner');assert.deepEqual(record.tags,['audio','utility']);
  assert.match(record.id,/^wam-/u);assert.match(fallbackThumbnail(record),/^data:image\/svg\+xml,/u);
});

test('registry isolates malformed entries, duplicate URLs, and descriptor failures',async()=>{
  const responses=new Map([
    ['http://127.0.0.1/wamPlugins/plugins.json',{ok:true,json:async()=>({version:1,plugins:['./good/index.js','./good/index.js',{},'./missing/index.js']})}],
    ['http://127.0.0.1/wamPlugins/good/descriptor.json',{ok:true,json:async()=>({identifier:'good',name:'Good Delay',keywords:['delay']})}],
    ['http://127.0.0.1/wamPlugins/missing/descriptor.json',{ok:false,status:404,json:async()=>({})}]
  ]);
  const registry=new WamPluginRegistry({fetchImpl:async url=>responses.get(url)});const records=await registry.load('http://127.0.0.1/wamPlugins/plugins.json');
  assert.equal(records.length,2);assert.equal(records[0].category,'delay');assert.equal(records[1].status,'descriptor-error');
  assert.equal(registry.diagnostics.filter(item=>item.level==='error').length,1);assert.equal(registry.diagnostics.filter(item=>item.level==='warning').length,1);
});

test('runtime validation distinguishes import, instance, GUI, audio, and state stages',async()=>{
  const node={disconnect(){},destroy(){},async getParameterInfo(){return {mix:{}};},async getState(){return {mix:.5};},async setState(value){this.state=value;}};
  const plugin={audioNode:node,async createGui(){return {remove(){}};}};
  class FakePlugin{static async createInstance(){return plugin;}}
  const record=normalizeDescriptor(normalizeCatalogueEntry('./fx/index.js','https://host.example/plugins.json'),{name:'FX'});
  const registry=new WamPluginRegistry({importModule:async()=>({default:FakePlugin})});
  const instance=await registry.instantiate(record,{groupId:'g',audioContext:{}}),inspection=await registry.inspectInstance(record,instance);
  assert.equal(inspection.state.mix,.5);assert.equal(record.status,'state-valid');registry.markAudioValidation(record,{inputPeak:.1,outputPeak:.2});assert.equal(record.status,'validated');assert.deepEqual(record.stages,{catalogued:true,descriptorValid:true,importable:true,instantiable:true,guiValid:true,audioValid:true,stateValid:true});
  assert.throws(()=>registry.markAudioValidation(record,{inputPeak:.1,outputPeak:0}),/produced silence/u);
});

test('bundled catalogue entrypoints, descriptors, and declared thumbnails are self-consistent',async()=>{
  const root=fileURLToPath(new URL('../../examples/wam/wamPlugins/',import.meta.url)),catalogue=JSON.parse(await readFile(join(root,'plugins.json'),'utf8'));
  assert.equal(catalogue.version,1);assert.ok(catalogue.plugins.length>=10);
  for(const raw of catalogue.plugins){const entry=typeof raw==='string'?{uri:raw}:raw,entryPath=join(root,entry.uri.replace(/^\.\//u,''));await stat(entryPath);const descriptorPath=entry.descriptor?join(root,entry.descriptor.replace(/^\.\//u,'')):join(dirname(entryPath),'descriptor.json');const descriptor=JSON.parse(await readFile(descriptorPath,'utf8'));const thumbnail=entry.thumbnail||descriptor.thumbnail;if(thumbnail)await stat(join(dirname(descriptorPath),thumbnail));}
});

test('mini host exposes isolated lifecycle, clickable GUIs, bypass, tuner, meters, and diagnostics controls',async()=>{
  const root=new URL('../../examples/wam/fx-test/',import.meta.url),[html,main,card]=await Promise.all([readFile(new URL('index.html',root),'utf8'),readFile(new URL('main.js',root),'utf8'),readFile(new URL('../PluginCard.js',root),'utf8')]);
  for(const id of ['pluginGrid','categories','search','bypass','inputMeter','outputMeter','showGui','unload','saveState','restoreState','validateAll','tunerButton','diagnostics','guiDialog','guiTitle','guiBypass','closeGui'])assert.match(html,new RegExp(`id="${id}"`,'u'));
  assert.match(html,/BYPASS OFF/u);assert.doesNotMatch(html,/id="bypass"[^>]*checked/u);assert.match(main,/openRecord\(event\.detail\.record\)/u);assert.match(main,/loaded\)\{\$\('#bypass'\)\.checked=false/u);assert.match(main,/showModal\(\);\$\('#guiMount'\)\.replaceChildren/u);assert.match(main,/button\.classList\.toggle\('bypass-on',bypass\)/u);assert.match(card,/this\.onclick=/u);assert.match(card,/Open GUI/u);
  assert.match(main,/registry\.load\('\.\.\/wamPlugins\/plugins\.json'\)/u);assert.match(main,/inputAnalyser\.connect\(plugin\.audioNode\)/u);assert.match(main,/silent\.gain\.value=0/u);assert.match(main,/destroyPluginInstance/u);
});
