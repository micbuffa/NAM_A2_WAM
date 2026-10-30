import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const source=new URL('../../examples/wam/source-separation/',import.meta.url),dist=new URL('../../dist/NAM_A2_WAM/',import.meta.url);
test('one published host distribution contains both benchmark and personal-audio multitrack playback',async()=>{
 const host=await readFile(new URL('index.html',dist),'utf8');assert.match(host,/value="multitracks"/);
 const player=await readFile(new URL('source-separation/index.html',dist),'utf8');assert.match(player,/id="fileInput"/);assert.match(player,/webnn-diagnostics.html/);
 for(const backend of ['webnn-cpu','webnn-gpu','webnn-npu'])assert.ok(player.includes(`value="${backend}"`));
 for(const file of ['WEBNN_TESTING.md','_headers','.htaccess','source-separation/webnn-playback-worker.js','source-separation/WebNNRuntime.js','source-separation/webnn-diagnostics.html','source-separation/webnn-diagnostics-worker.js','source-separation/vendor/onnxruntime-webnn/ort.all.min.js','source-separation/vendor/onnxruntime-webnn/ort-wasm-simd-threaded.jsep.wasm'])await stat(new URL(file,dist));
 const bench=await readFile(new URL('source-separation/webnn-diagnostics.html',dist),'utf8');assert.match(bench,/id="playbackLink"><a href="\.\/index.html"/);
 const headers=await readFile(new URL('_headers',dist),'utf8');assert.match(headers,/Cross-Origin-Opener-Policy: same-origin/);assert.match(headers,/Cross-Origin-Embedder-Policy: require-corp/);
});
test('deployed WebNN imports, model catalogue and provenance never depend on source-repository paths or a CDN',async()=>{
 for(const file of ['WebNNRuntime.js','webnn-diagnostics-worker.js']){
  const code=await readFile(new URL('source-separation/'+file,dist),'utf8');assert.match(code,/\.\/vendor\/onnxruntime-webnn\//);assert.doesNotMatch(code,/\.\.\/\.\.\/\.\.\/third_party/);
 }
 const experiment=await readFile(new URL('source-separation/WebNNExperiment.js',dist),'utf8');assert.doesNotMatch(experiment,/\.\.\/\.\.\/\.\.\/third_party/);
 const original=JSON.parse(await readFile(new URL('models.json',source))),catalogue=JSON.parse(await readFile(new URL('source-separation/models.json',dist)));
 const model=catalogue.models.find(m=>m.id==='htdemucs_4s_onnx'),prior=original.models.find(m=>m.id===model.id);
 assert.equal(model.files[0].url,'./model-assets/htdemucs-core.onnx');assert.equal(model.files[0].sourceUrl,prior.files[0].url);assert.equal(model.files[0].sha256,prior.files[0].sha256);assert.equal(model.version,prior.version);
 const build=JSON.parse(await readFile(new URL('source-separation/build-info.json',dist)));assert.deepEqual(build.missingAssets,[]);assert.equal(build.layout,'full-host-with-playback');
 for(const id of ['htdemucs_4s_onnx','bs_roformer_sw_6s']){
  const file=catalogue.models.find(m=>m.id===id).files[0],asset=build.files[file.url.replace(/^\.\//,'')];assert.equal(asset.sha256,file.sha256);assert.equal(asset.bytes,file.size);
 }
});

test('both distributions verify renamed JS runtime modules against delivered hashes and retain upstream provenance',async()=>{
 const {createHash}=await import('node:crypto');
 for(const base of [new URL('source-separation/',dist),new URL('../../dist/WebNN_Benchmark/',import.meta.url)]){
  const manifest=JSON.parse(await readFile(new URL('research/webnn-runtime.json',base)));
  assert.ok(manifest.upstreamFiles['ort.all.min.mjs']);assert.ok(manifest.files['ort.all.min.js']);
  for(const [name,info]of Object.entries(manifest.files)){
   const bytes=await readFile(new URL('vendor/onnxruntime-webnn/'+name,base));assert.equal(bytes.length,info.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),info.sha256);
  }
  const runtime=await readFile(new URL('vendor/onnxruntime-webnn/ort.all.min.js',base),'utf8');assert.match(runtime,/ort-wasm-simd-threaded.jsep.js/);assert.doesNotMatch(runtime,/ort-wasm-simd-threaded.jsep.mjs/);
  const worker=await readFile(new URL('webnn-diagnostics-worker.js',base),'utf8');assert.match(worker,/ort.all.min.js/);assert.doesNotMatch(worker,/ort.all.min.mjs/);
 }
 const production=JSON.parse(await readFile(new URL('source-separation/vendor/onnxruntime-web/integrity.json',dist)));
 for(const [name,sha]of Object.entries(production))assert.equal(createHash('sha256').update(await readFile(new URL('source-separation/vendor/onnxruntime-web/'+name,dist))).digest('hex'),sha);
 assert.match(await readFile(new URL('source-separation/roformer-worker.js',dist),'utf8'),/ort.webgpu.min.js/);
});

test('deployed WebNN playback validates actual packaged bytes and imports the JS entry point',async()=>{
 const {createWebnnPlaybackSession}=await import(new URL('source-separation/WebNNRuntime.js',dist));
 const {webcrypto}=await import('node:crypto');let imported;
 const context={dispatch(){},destroy(){}};
 const ort={env:{wasm:{}},InferenceSession:{create:async()=>({release:async()=>{}})}};
 const result=await createWebnnPlaybackSession(new Uint8Array(1),'npu',{
  navigatorImpl:{ml:{createContext:async()=>context}},Builder:class{},cryptoImpl:webcrypto,
  fetchImpl:async url=>{const bytes=await readFile(url);return{ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)};},
  importRuntime:async url=>{imported=url;return ort;},
 });
 assert.match(imported,/vendor\/onnxruntime-webnn\/ort.all.min.js$/);await result.release();
});

test('direct WebNN assets in both distributions match the recipes/weights index and the benchmark defaults to direct mode',async()=>{
 const {fileHash}=await import('../../tools/build-webnn-benchmark.mjs');
 for(const base of [new URL('source-separation/',dist),new URL('../../dist/WebNN_Benchmark/',import.meta.url)]){
  const index=JSON.parse(await readFile(new URL('model-assets/direct-webnn/index.json',base)));
  for(const [key,entry]of Object.entries(index.models)){
   const graphURL=new URL(entry.graph.url,base);assert.equal(await fileHash(graphURL),entry.graph.sha256);
   const graph=JSON.parse(await readFile(graphURL));assert.equal(graph.provenance.sourceSha256,entry.sourceSha256);
   const weights=new URL(`model-assets/direct-webnn/${key}.weights.bin`,base);assert.equal((await stat(weights)).size,entry.weights.bytes);assert.equal(await fileHash(weights),entry.weights.sha256);
  }
  const html=await readFile(new URL('webnn-diagnostics.html',base),'utf8');assert.match(html,/id="webnnImplementation"><option value="direct">/);
  await stat(new URL('DirectWebNN.js',base));await stat(new URL('DIRECT_WEBNN_BENCHMARK.md',base));
 }
});
