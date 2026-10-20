# Provenance du moteur expérimental

Ces fichiers `demucs_onnx_simd.js` et `.wasm` sont conservés sans modification depuis
[bengfarrell/demucs-wasm](https://github.com/bengfarrell/demucs-wasm/tree/35c8bd5b74c56f630082058179cd8f57cb192fb2), révision `35c8bd5b74c56f630082058179cd8f57cb192fb2`.
Licence MIT et copyright Ben Farrell 2024 : voir `LICENSE`.

Les poids ORT compressés sont téléchargés séparément depuis la même révision ; ils ne sont pas embarqués dans la distribution du host. Les tailles et SHA-256 sont épinglés dans `models.json`.

Le wrapper amont indique une provenance de [sevagh/freemusicdemixer.com](https://github.com/sevagh/freemusicdemixer.com) et du travail de portage [demucs.cpp](https://github.com/sevagh/demucs.cpp). Le binaire fourni est nommé `demucs_onnx_simd`, avec des poids ORT ; notre intégration le traite comme ce moteur précis, sans l’assimiler à une compilation locale de demucs.cpp.

Les modèles originaux proviennent de [Meta Demucs](https://github.com/facebookresearch/demucs), sous MIT (copyright Meta Platforms, Inc. and affiliates). Leur conversion peut modifier la précision numérique. L’égalité avec les sorties UVR n’est pas encore démontrée.

```text
MIT License
Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
