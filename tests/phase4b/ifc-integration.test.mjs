import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeCatalogueEntry,normalizeDescriptor} from '../../examples/wam/WamPluginRegistry.js';
for(const variant of [1,2]){
const base=new URL(`../../examples/wam/wamPlugins/EndUserAmp${variant}/`,import.meta.url);
test(`IFC${variant} package retains the reference DSP binary and compiles independently of the old host`,async()=>{
  const manifest=JSON.parse(await readFile(new URL('SOURCE_MANIFEST.json',base))),bytes=await readFile(new URL('dsp-module.wasm',base));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256Original['dsp-module.wasm']);
  const module=await WebAssembly.compile(bytes);assert.ok(WebAssembly.Module.exports(module).some(e=>e.name==='compute'));
  const meta=JSON.parse(await readFile(new URL('dsp-meta.json',base)));assert.equal(meta.inputs,1);assert.equal(meta.outputs,2);
  for(const name of ['index.js','gui.js','sdk/index.js','sdk-parammgr/index.js','faustwasm/index.js','utils/webaudio-controls.js'])assert.ok((await stat(new URL(name,base))).isFile());
});
test(`IFC${variant} is a generic amplifier WAM with a descriptor-relative PNG thumbnail and portable URI`,async()=>{
  const catalogue=JSON.parse(await readFile(new URL('../plugins.json',base)));
  const source=catalogue.plugins.find(e=>e.uri===`./EndUserAmp${variant}/index.js`);assert.ok(source);
  const record=normalizeDescriptor(normalizeCatalogueEntry(source,'https://example.test/rack/wamPlugins/plugins.json'),JSON.parse(await readFile(new URL('descriptor.json',base))));
  assert.equal(record.category,'amplifier');assert.equal(record.role,null);
  assert.equal(record.entryUrl,`https://example.test/rack/wamPlugins/EndUserAmp${variant}/index.js`);
  assert.equal(record.thumbnailUrl,`https://example.test/rack/wamPlugins/EndUserAmp${variant}/thumbnail.png`);
  const png=await readFile(new URL('thumbnail.png',base));assert.equal(png.subarray(1,4).toString(),'PNG');
});

}
test('the two different Faust DSPs have distinct WAM identifiers to prevent processor collisions',async()=>{
 const descriptors=await Promise.all([1,2].map(async n=>JSON.parse(await readFile(new URL(`../../examples/wam/wamPlugins/EndUserAmp${n}/descriptor.json`,import.meta.url)))));
 assert.notEqual(descriptors[0].identifier,descriptors[1].identifier);
});
