// Explicit product allowlist: no benchmark pages, corpus or model weights.
export const STUDIO_RUNTIME_ASSETS = [
  'WebNNAdmission.js', 'StudioWebNN.js', 'WebNNParity.js', 'AudioComparison.js', 'webnn-worker.js', 'vendor/onnxruntime-webnn', 'CompactWaveform.js', 'studio-models.json', 'ROFORMER_NOTICE.md',
  'OnnxDemucsRunner.js', 'PreparedDemucsRunner.js', 'StreamTransport.js',
  'SegmentSettings.js', 'ChunkTools.js', 'ProgressiveMultitrackEngine.js', 'MultitrackEngine.js',
  'AudioData.js', 'ModelDownloadManager.js', 'ModelCache.js', 'Capabilities.js',
  'CooperativeOnnxSession.js', 'OnnxRuntimeConfig.js', 'OnnxCoreModel.js',
  'RoformerCoreModel.js', 'RoformerDSP.js', 'onnx-worker.js', 'roformer-worker.js', 'roformer-stage-plan.json',
  'vendor/lamejs', 'vendor/wavesurfer', 'vendor/demucs-js', 'vendor/bs-roformer-web', 'vendor/ringbuf', 'vendor/onnxruntime-web',
];
