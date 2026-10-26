ONNX Runtime Web 1.30.0, MIT, Microsoft and contributors.
Official package: https://www.npmjs.com/package/onnxruntime-web/v/1.30.0
Pinned files, upstream tarball identity and license hash: manifest.json.

Isolated experimental Studio WebNN Worker only. Production WebGPU/WASM stays
on ORT 1.22.0 in the adjacent onnxruntime-web directory. Demucs4 weights are
unchanged. The experimental path compares every block against a WASM session
using ORT 1.30.0, including strict per-role parity; this is not a claim of
qualification against the production 1.22.0 runtime or proof of physical NPU
usage. Unsupported graph operations may execute through WASM. No SW6 admission.
