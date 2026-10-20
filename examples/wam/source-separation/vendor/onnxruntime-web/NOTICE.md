# ONNX Runtime Web

Version **1.22.0**, paquet npm `onnxruntime-web@1.22.0`, Microsoft, licence MIT
conservée dans `LICENSE`. Distribution WebGPU JSEP : `ort.webgpu.min.mjs`,
`ort-wasm-simd-threaded.jsep.mjs` et `ort-wasm-simd-threaded.jsep.wasm`, sans modification.

Ce build inclut l'exécution CPU et le pont JavaScript WebGPU. Il est volontairement
épinglé : le premier essai de notre modèle 6 pistes avec 1.23.0 (backend natif
WebGPU/asyncify) échoue pendant la création de session sur cette machine.
La disponibilité d'un adaptateur GPU seule ne valide pas un modèle.

Référence : https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
