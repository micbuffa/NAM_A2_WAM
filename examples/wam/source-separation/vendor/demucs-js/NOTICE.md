# Demucs ONNX expérimental

`apply.js` est généré sans minification depuis `src/apply.ts` et ses imports DSP de
[bakkot/demucs-js](https://github.com/bakkot/demucs-js/tree/45f990170d9571379a9dbd3bbdd1c7591b26864c), révision épinglée `45f990170d9571379a9dbd3bbdd1c7591b26864c`.
Commande de génération : `esbuild@0.25.10 src/apply.ts --bundle --format=esm --outfile=apply.js`.
Adaptation locale documentée : dans `istft()`, une longueur explicite est la longueur de sortie après retrait du centrage ; ne soustraire `nFft` que lorsque la longueur est déduite. Le code amont soustrayait aussi pour une longueur explicite, provoquant une lecture hors limites à la fin de la dernière piste d’une fenêtre complète. Des exports DSP sont ajoutés pour les tests de reconstruction.

Code sous MIT ; licence amont conservée dans `LICENSE.md`.

Les poids ONNX, téléchargés séparément, ont une restriction **usage personnel et recherche** indiquée par ce fournisseur. Ne pas assimiler cette licence à celle des modèles ORT déjà intégrés ; ne pas présenter ce modèle expérimental comme libre de restrictions pour un déploiement commercial. Ce fichier n'est pas le modèle FT ni le modèle six sources. Les quatre sorties sont batterie, basse, autres et voix.

L'adaptateur local utilise ONNX Runtime Web 1.22.0, backend WebGPU JSEP ou WASM,
et le DSP JavaScript pour les FFT directe/inverse. Le backend GPU peut conserver
certains opérateurs CPU : c'est un pipeline hybride, pas un calcul entièrement GPU.

Correction locale du 22 octobre 2026 : `padReflect()` lit le tableau source pour le padding gauche (`arr[padLeft-i]`), pas le tableau de sortie dont cette partie était encore vide. Le défaut altérait les deux premières frames STFT. Validation contre `torch.stft` et test DFT déterministe : première frame non nulle reflétée correctement. Cette correction s’applique aussi au modèle ONNX de 7,8 s.
