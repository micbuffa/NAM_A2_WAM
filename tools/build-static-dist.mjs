import { cp, mkdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {STUDIO_RUNTIME_ASSETS} from '../examples/wam/projects/StudioRuntimeAssets.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist', 'NAM_A2_WAM');
const noRegenerate = process.argv.includes('--no-regenerate');
const noBuild = process.argv.includes('--no-build');
// Product builds ship only the separation runtime used by Tone/Studio.
// The standalone research prototype remains an explicit opt-in.
const includeResearch = process.argv.includes('--include-research');
const run = (command, args) => { const r = spawnSync(command, args, {cwd: root, stdio: 'inherit'}); if (r.error) throw r.error; if (r.status !== 0) throw Error(`${command} failed (${r.status})`); };
const copy = (source, target) => cp(join(root, source), join(dist, target), {recursive: true, force: true});
const required = async (path) => { try { await stat(path); } catch { throw Error(`Required distribution file is missing: ${path}`); } };

if (!noRegenerate) run(join(root, 'tools/regenerate-factory-assets.sh'), []);
if (!noBuild) run('cmake', ['--build', join(root, 'build-wasm'), '-j', '8']);
await rm(dist, {recursive: true, force: true});
await mkdir(dist, {recursive: true});
for (const [source, target] of [
  ['examples/wam/index.html', 'index.html'], ['examples/wam/config.js', 'config.js'], ['examples/wam/host.css', 'host.css'], ['examples/wam/main.js', 'main.js'],
  ['examples/wam/CabinetRouting.js', 'CabinetRouting.js'], ['examples/wam/OutputDeviceManager.js', 'OutputDeviceManager.js'],
  ['examples/wam/SourceManager.js', 'SourceManager.js'], ['examples/wam/AudioDevicePreferences.js', 'AudioDevicePreferences.js'], ['examples/wam/assets', 'assets'],
  ['examples/wam/WamPluginRegistry.js', 'WamPluginRegistry.js'], ['examples/wam/PluginCard.js', 'PluginCard.js'], ['examples/wam/account', 'account'],
  ...['EngineStatus.js','SettingsView.js','Workspaces.js','TunerView.js','FxRack.js','FxRackView.js','AudioLevel.js','FxChain.js','FxChainView.js','fx-chain.css'].map(name=>[`examples/wam/${name}`,name]),
  ['examples/wam/backing-track-player', 'backing-track-player'], ['examples/wam/ui', 'ui'], ['examples/wam/projects', 'projects'],
  ...(includeResearch ? [['examples/wam/source-separation', 'source-separation']] : STUDIO_RUNTIME_ASSETS.map(name => [`examples/wam/source-separation/${name}`, `source-separation/${name}`])),
  ['examples/wam/fx-test', 'fx-test'], ['examples/wam/wamPlugins', 'wamPlugins'],
  ['src/nam-wam', 'plugins/nam-wam'], ['src/cabinet-wam', 'plugins/cabinet-wam'], ['src/shared', 'plugins/shared'],
  ['third_party/wam-examples/packages/sdk/src', 'third_party/wam-examples/packages/sdk/src'],
  ['build-wasm/dist/nam-simd.wasm', 'plugins/nam-wam/nam-simd.wasm'], ['build-wasm/dist/nam-simd.wasm', 'plugins/cabinet-wam/nam-simd.wasm'],
]) await copy(source, target);

await rm(join(dist, 'source-separation/model-assets'), {recursive: true, force: true});

const cataloguePath=join(dist,'wamPlugins/plugins.json');
await writeFile(cataloguePath,(await readFile(cataloguePath,'utf8')).replaceAll('../../../src/','../plugins/'));

const hostPath = join(dist, 'main.js');
let host = await readFile(hostPath, 'utf8');
host = host.replace("'../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js'", "'./third_party/wam-examples/packages/sdk/src/initializeWamHost.js'")
  .replace("'../../src/nam-wam/index.js'", "'./plugins/nam-wam/index.js'")
  .replace("'../../src/cabinet-wam/index.js'", "'./plugins/cabinet-wam/index.js'")
  .replace(/'\.\.\/\.\.\/src\/(nam-wam|cabinet-wam)\//g, "'./plugins/$1/")
  .replace("'../../third_party/NeuralAmpModelerCore/example_models/A2.nam'", "'./plugins/nam-wam/models/A1vsA2-JVM-OD1-OR-A2.nam'")
  .replace("'../../src/cabinet-wam/IRs/TWIN%20REVERB%20__%20CLEAN.wav'", "'./plugins/cabinet-wam/IRs/TWIN%20REVERB%20__%20CLEAN.wav'")
  .replace(/async function discoverFiles\(\) \{[\s\S]*?\n\}/, "async function discoverFiles() {\n  let files = [];\n  try { const response = await fetch('./assets/audio/audioFiles.json'); if (response.ok) files = await response.json(); } catch {}\n  const selector = $('#audioSource');\n  selector.replaceChildren(new Option('Live input', 'live'));\n  for (const filename of files) selector.add(new Option(filename, `file:${filename}`));\n  $('#discovery').textContent = files.length ? `${files.length} bundled dry guitar audio file(s)` : 'Use Live input or plugin Factory browsers';\n  return files;\n}");
await writeFile(hostPath, host);
const fxHostPath = join(dist, 'fx-test/main.js');
let fxHost = await readFile(fxHostPath, 'utf8');
fxHost = fxHost.replace("'../../../third_party/wam-examples/packages/sdk/src/initializeWamHost.js'", "'../third_party/wam-examples/packages/sdk/src/initializeWamHost.js'");
await writeFile(fxHostPath, fxHost);
const validationPath=join(dist,'fx-test/chain-validation.js');
let validation=await readFile(validationPath,'utf8');
validation=validation.replaceAll('../../../third_party/','../third_party/').replaceAll('../../../src/','../plugins/');
await writeFile(validationPath,validation);
const ifcValidationPath=join(dist,'fx-test/ifc-validation.js');
await writeFile(ifcValidationPath,(await readFile(ifcValidationPath,'utf8')).replaceAll('../../../third_party/','../third_party/'));
for(const amp of ['EndUserAmp1','EndUserAmp2'])for(const name of ['factory-presets.js','preset-state.js','index.js','descriptor.json','dsp-module.wasm','dsp-meta.json','gui.js','thumbnail.png','sdk/index.js','sdk-parammgr/index.js','faustwasm/index.js','utils/webaudio-controls.js']) await required(join(dist,'wamPlugins',amp,name));
await required(join(dist,'wamPlugins/EndUserAmp2/ampProfiles.js'));
for (const plugin of ['plugins/nam-wam/index.js', 'plugins/cabinet-wam/index.js']) {
  const path = join(dist, plugin); let source = await readFile(path, 'utf8');
  source = source.replace(/\$\{baseUrl\}\/\.\.\/\.\.\/build-wasm\/dist\/nam-simd\.wasm/g, '${baseUrl}/nam-simd.wasm');
  await writeFile(path, source);
}

const nam = JSON.parse(await readFile(join(dist, 'plugins/nam-wam/models-manifest.json'), 'utf8'));
const irs = JSON.parse(await readFile(join(dist, 'plugins/cabinet-wam/irs-manifest.json'), 'utf8'));
for (const a of nam.assets) await required(join(dist, 'plugins/nam-wam/models', ...a.relativePath.split('/')));
for (const a of irs.assets) await required(join(dist, 'plugins/cabinet-wam/IRs', ...a.relativePath.split('/')));
for (const p of ['index.html', 'config.js', 'host.css', 'main.js', 'EngineStatus.js', 'SettingsView.js', 'Workspaces.js', 'projects/ProjectsWorkspace.js', 'projects/ProjectsModel.js', 'projects/ProjectTimeline.js', 'projects/ProjectPlayer.js', 'projects/TrackTones.js', 'plugins/nam-wam/index.js', 'plugins/nam-wam/models-manifest.json', 'plugins/nam-wam/nam-simd.wasm', 'plugins/cabinet-wam/index.js', 'plugins/cabinet-wam/irs-manifest.json', 'plugins/cabinet-wam/neuralwamp-cabinet-logo.svg', 'plugins/cabinet-wam/nam-simd.wasm', 'WamPluginRegistry.js', 'PluginCard.js', 'account/index.js', 'account/api.js', 'account/RackDraft.js', 'ui/tokens.css', 'ui/base.css', 'ui/styleguide.html', 'ui/index.js', 'ui/define.js', 'ui/icons.js', 'ui/modal.js', 'ui/light-dismiss.js', 'ui/value-popup.js', 'ui/components.css', ...['icon','button','icon-button','badge','switch','knob','select','meter','segmented','toast'].map(n=>`ui/components/tl-${n}.js`), 'source-separation/CompactWaveform.js', 'source-separation/vendor/wavesurfer/renderer.js', ...(includeResearch ? ['source-separation/index.html', 'source-separation/main.js', 'source-separation/ModelCatalog.js', 'source-separation/MultitrackSession.js', 'source-separation/source-separation.css'] : []), 'fx-test/index.html', 'fx-test/main.js', 'fx-test/style.css', 'wamPlugins/plugins.json']) await required(join(dist, p));
const forbidden = /(?:\.\.\/src|\.\.\/examples|\.\.\/build|\/api\/test-audio-files)/;
const secrets = /(?:t3k_cs_|(?:client_secret|secret_key|access_token|refresh_token)\s*[:=]\s*['"][^'"]+)/i;
for (const p of ['index.html', 'main.js', 'fx-test/index.html', 'fx-test/main.js', 'plugins/nam-wam/index.js', 'plugins/cabinet-wam/index.js']) if (forbidden.test(await readFile(join(dist, p), 'utf8'))) throw Error(`Invalid source/runtime reference in ${p}`);
for (const p of ['index.html', 'main.js', 'plugins/nam-wam/index.js', 'plugins/nam-wam/gui.js', 'plugins/nam-wam/tone3000/Tone3000Auth.js', 'plugins/nam-wam/tone3000/Tone3000Client.js']) if (secrets.test(await readFile(join(dist, p), 'utf8'))) throw Error(`Possible secret credential in ${p}`);
console.log('\nNAM A2 WAM static distribution created.');
console.log('Output: dist/NAM_A2_WAM/');
console.log(`Factory assets: NAM models ${nam.assets.length}, Cabinet IRs ${irs.assets.length}`);
console.log('Entry point: dist/NAM_A2_WAM/index.html');
console.log('Deployment: copy dist/NAM_A2_WAM/ to any static web server.');

const backingCatalogue=JSON.parse(await readFile(join(dist,'assets/backingTracks/tracks.json'),'utf8'));
for(const track of backingCatalogue.tracks)await required(join(dist,'assets/backingTracks',decodeURIComponent(track.url)));
for(const file of ['BackingTrackPlayerElement.js','BackingTrackEngine.js','BackingTrackLibrary.js','BackingTrackMix.js','PlayAlong.js','PlayAlongMemory.js','backing-track-player.css','phaze-processor.js'])await required(join(dist,'backing-track-player',file));
if (includeResearch) {
for (const file of ['SixStemReconstruction.js', 'SeparationMixer.js', 'MixWaveform.js', 'SeparationWorkflow.js', 'CompactMultitrackView.js', 'CompactWaveform.js', 'vendor/wavesurfer/renderer.js', 'vendor/wavesurfer/renderer-utils.js', 'vendor/wavesurfer/event-emitter.js', 'vendor/wavesurfer/reactive/store.js', 'vendor/wavesurfer/reactive/drag-stream.js', 'vendor/wavesurfer/reactive/scroll-stream.js', 'vendor/wavesurfer/reactive/event-streams.js', 'vendor/wavesurfer/LICENSE', 'vendor/wavesurfer/NOTICE.md', 'vendor/wavesurfer/integrity.json', 'BenchmarkInputs.js', 'fixtures/music/slow-motion-dream.mp3', 'fixtures/music/slow-motion-dream.json', 'fixtures/music/NOTICE.md', 'OnnxRuntimeConfig.js', 'OnnxDemucsRunner.js', 'OnnxCoreModel.js', 'BackendPolicy.js', 'AudioComparison.js', 'onnx-worker.js', 'webgpu-benchmark.html', 'webgpu-benchmark.js', 'vendor/demucs-js/apply.js', 'vendor/demucs-js/LICENSE.md', 'vendor/demucs-js/NOTICE.md', 'vendor/onnxruntime-web/ort.webgpu.min.mjs', 'vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs', 'vendor/onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm', 'vendor/onnxruntime-web/LICENSE', 'vendor/onnxruntime-web/NOTICE.md', 'vendor/onnxruntime-web/integrity.json', 'ChunkTools.js', 'ProgressiveDemucsRunner.js', 'ProgressiveMultitrackEngine.js', 'progressive-worker.js', 'DemoWaveform.js', 'ModelCache.js', 'ModelDownloadManager.js', 'DownloadsView.js', 'Capabilities.js', 'DemucsRunner.js', 'demucs-worker.js', 'MultitrackEngine.js', 'AudioData.js', 'models.json', 'vendor/demucs-wasm/demucs_onnx_simd.js', 'vendor/demucs-wasm/demucs_onnx_simd.wasm', 'vendor/demucs-wasm/LICENSE', 'vendor/demucs-wasm/NOTICE.md', 'fixtures/catalog.json', 'fixtures/cache-test-4.json', 'fixtures/cache-test-5.json', 'fixtures/LICENSE.txt']) await required(join(dist, 'source-separation', file));
await required(join(dist, 'source-separation/SeparationProgress.js'));
await required(join(dist, 'source-separation/bootstrap.js'));
await required(join(dist, 'source-separation/ModelStatus.js'));

}
