import {packageRuntimeJs,runtimeJsName} from './package-runtime-js.mjs';
import {cp,mkdir,readFile,writeFile,rename,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
export const DIRECT_WEBNN_ASSETS=['index.json',...['demucs4','roformer6'].flatMap(key=>[key+'.graph.json',key+'.weights.bin'])].map(file=>'model-assets/direct-webnn/'+file);
export const BENCHMARK_FILES=['BenchmarkRecommendations.js','research/recommendation-reference.json','DirectWebNNIsolation.js','direct-webnn-isolation.html','direct-webnn-isolation.js','direct-webnn-isolation-worker.js','DIRECT_WEBNN_BENCHMARK.md','DirectWebNN.js','webnn-diagnostics.html','webnn-diagnostics.css','webnn-diagnostics.js','webnn-diagnostics-worker.js','WebNNExperiment.js','WebNNDevice.js','WebNNBenchmark.js','OnnxCoreModel.js','RoformerCoreModel.js','RoformerDSP.js','CooperativeOnnxSession.js','ChunkTools.js','AudioComparison.js','BenchmarkInputs.js','WEBNN_FIREFOX_BENCHMARK.md','research/webnn-runtime.json','research/roformer-stage-plan.json','vendor/demucs-js/apply.js','vendor/demucs-js/LICENSE.md','vendor/demucs-js/NOTICE.md','vendor/bs-roformer-web/fft-radix2.js','vendor/bs-roformer-web/LICENSE','vendor/bs-roformer-web/NOTICE.md','fixtures/music/slow-motion-dream.mp3','fixtures/music/NOTICE.md','model-assets/ROFORMER_NOTICE.md','model-assets/LICENSE'];
export const fileHash=async path=>{const h=createHash('sha256');for await(const bytes of createReadStream(path))h.update(bytes);return h.digest('hex');};
export async function buildBenchmark(root){
 const out=join(root,'dist/WebNN_Benchmark'),staging=join(root,`dist/.webnn-benchmark-${process.pid}`),source=join(root,'examples/wam/source-separation');
 const modelFiles=[['third_party/nam-webgpu-probe/htdemucs-core.onnx','model-assets/htdemucs-core.onnx',174263526,'da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748'],['examples/wam/source-separation/model-assets/bs_roformer_sw_6stem_fp16.onnx','model-assets/bs_roformer_sw_6stem_fp16.onnx',352778874,'d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444']];
 const runtime=join(root,'third_party/nam-webnn-probe/runtime'),manifest=JSON.parse(await readFile(join(source,'research/webnn-runtime.json'),'utf8'));
 if(manifest.version!=='1.30.0'||Object.keys(manifest.files??{}).length!==3)throw Error('Unexpected pinned runtime manifest.');
 for(const [file,meta]of Object.entries(manifest.files)){
  if(!['ort.all.min.mjs','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'].includes(file))throw Error('Unexpected runtime asset.');
  const path=join(runtime,file);if((await stat(path)).size!==meta.bytes||await fileHash(path)!==meta.sha256)throw Error(`Runtime integrity mismatch: ${file}`);
 }
 for(const [file,,bytes,sha256]of modelFiles){const path=join(root,file);if((await stat(path)).size!==bytes||await fileHash(path)!==sha256)throw Error(`Model integrity mismatch: ${file}`);}
 await mkdir(staging,{recursive:true});const files={};
 const copy=async(from,to)=>{await mkdir(dirname(join(staging,to)),{recursive:true});await cp(from,join(staging,to));};
 try{
  for(const file of [...BENCHMARK_FILES,...DIRECT_WEBNN_ASSETS])await copy(join(source,file),file);
  await copy(join(root,'examples/wam/assets/audio/CleanChords.mp3'),'fixtures/music/clean-chords.mp3');
  for(const file of [...Object.keys(manifest.files),'LICENSE'])await copy(join(runtime,file),'vendor/onnxruntime-webnn/'+file);
  for(const [from,to]of modelFiles)await copy(join(root,from),to);
  const patch=async(file,from,to)=>writeFile(join(staging,file),(await readFile(join(staging,file),'utf8')).replaceAll(from,to));
  await patch('webnn-diagnostics.js','../assets/audio/CleanChords.mp3','./fixtures/music/clean-chords.mp3');
  await patch('WebNNExperiment.js','../../../third_party/nam-webgpu-probe/htdemucs-core.onnx','./model-assets/htdemucs-core.onnx');
  await patch('webnn-diagnostics-worker.js','../../../third_party/nam-webnn-probe/runtime/','./vendor/onnxruntime-webnn/');
  await packageRuntimeJs(staging);
  await copy(join(staging,'webnn-diagnostics.html'),'index.html');
  await writeFile(join(staging,'_headers'),'/*\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin\n');
  await writeFile(join(staging,'.htaccess'),'<IfModule mod_headers.c>\nHeader set Cross-Origin-Opener-Policy "same-origin"\nHeader set Cross-Origin-Embedder-Policy "require-corp"\nHeader set Cross-Origin-Resource-Policy "same-origin"\n</IfModule>\n<IfModule mod_mime.c>\nAddType application/wasm .wasm\nAddType text/javascript .mjs .js\n</IfModule>\n');
  const paths=[...BENCHMARK_FILES,...DIRECT_WEBNN_ASSETS,'fixtures/music/clean-chords.mp3',...Object.keys(manifest.files).map(f=>'vendor/onnxruntime-webnn/'+runtimeJsName(f)),'vendor/onnxruntime-webnn/LICENSE',...modelFiles.map(([,to])=>to),'index.html','_headers','.htaccess'];
  for(const file of paths)files[file]={bytes:(await stat(join(staging,file))).size,sha256:await fileHash(join(staging,file))};
  let git={};try{git={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),branch:execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim(),dirty:!!execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim()};}catch{}
  await writeFile(join(staging,'build-info.json'),JSON.stringify({protocol:'webnn-browser-diagnostics-build-v1',date:new Date().toISOString(),git,files,totalBytes:Object.values(files).reduce((n,f)=>n+f.bytes,0)},null,2)+'\n');
  await rm(out,{recursive:true,force:true});await rename(staging,out);return out;
 }catch(error){await rm(staging,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log('Deployable benchmark: '+await buildBenchmark(resolve(dirname(fileURLToPath(import.meta.url)),'..')));}
 catch(error){console.error(error.message+'\nPrepare the local pinned runtime/models first; see WEBNN_FIREFOX_BENCHMARK.md.');process.exitCode=1;}
}
