import {isWebnnBackend,supportsWebnnModel,backendLabel} from './WebNNPlayback.js';
import {benchmarkSummary} from './ModelBenchmark.js';
import {REFERENCE_BENCHMARK} from './ModelPerformanceData.js';
export function backendPolicy(model,capabilities,requested='wasm') {
  const onnx=['demucs-onnx-core','bs-roformer-onnx'].includes(model?.runtime);
  const gpu=!!(onnx&&capabilities?.webgpu&&model.backends.includes('webgpu'));
  const webnn=!!(capabilities?.webnn&&supportsWebnnModel(model));
  if(isWebnnBackend(requested)&&webnn)return {onnx,gpu,webnn,backend:requested,description:`${backendLabel(requested)} · opérateurs non pris en charge sur WASM ; matériel effectif inconnu. Compilation initiale potentiellement longue.`};
  return {onnx,gpu,webnn,backend:requested==='webgpu'&&gpu?'webgpu':'wasm',
    description:onnx?(requested==='webgpu'&&gpu?'WebGPU expérimental : réseau neuronal accéléré, FFT JavaScript et certains opérateurs CPU.':gpu?'CPU/WASM sélectionné pour ce modèle ONNX ; WebGPU est aussi disponible.':'GPU indisponible : même modèle ONNX exécuté sur CPU/WASM.'):'Ce modèle ORT utilise uniquement CPU/WASM. Pour tester le GPU, choisissez « 4 pistes ONNX ». '};
}

// Recommendations never download weights or override a subsequent manual choice.
export function preferredModel(models, capabilities, useCase='guitar', {objective='speed',report=REFERENCE_BENCHMARK}={}) {
  const candidates=capabilities?.webgpu ? models.filter(m=>backendPolicy(m,capabilities,'webgpu').gpu) : [];
  const pool=candidates.length?candidates:models.filter(m=>m.backends.includes('wasm'));
  const backend=candidates.length?'webgpu':'wasm';
  if(objective==='guitar')return pool.find(m=>m.roles.includes('guitar'))||pool[0]||null;
  const scores=benchmarkSummary(report,models).filter(s=>s.backend===backend&&pool.some(m=>m.id===s.modelId));
  const metric=objective==='first'?'firstReadyMs':'totalMs';
  scores.sort((a,b)=>a[metric]-b[metric]);
  const tested=pool.every(m=>scores.some(s=>s.modelId===m.id)||(Array.isArray(report?.runs)&&report.runs.some(r=>r?.status==='error'&&r.modelId===m.id&&r.backend===backend&&r.frames===264600&&r.identity===JSON.stringify([m.version,m.files.map(f=>f.sha256)]))));
  if(tested&&scores.length)return pool.find(m=>m.id===scores[0].modelId);
  // Conservative policy when no matching measurements exist; never claim a local benchmark.
  const fallback=objective==='first'?'htdemucs_4s_preview':backend==='webgpu'?'htdemucs_4s_onnx':'htdemucs_6s';
  return pool.find(m=>m.id===fallback)||pool.find(m=>m.profile!=='preview')||pool[0]||null;
}
