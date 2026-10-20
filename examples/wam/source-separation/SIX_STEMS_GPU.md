# Diagnostic six stems WebGPU — 20 octobre 2026

**État : blocage de calcul contourné sur une variante de diagnostic, mais précision GPU non validée. Le modèle 6s du catalogue conserve son backend CPU/WASM.**

## Ce qui a été isolé

L’export StemSplit `htdemucs_6s_fp16weights.onnx`, révision `49df9b6989cf2150840ea65b0bef77a2e471b678`, SHA-256 `7ce55792e2231c93fbf92de95f5fd5b3a5e6c89f7db690dfd693e8f1dce56869`, contient **24 819 nœuds**. Son inverse STFT déroulée représente plus de 16 000 nœuds nommés `/real_istft`, avec de nombreux ScatterND/Shape/Slice. Le précédent essai navigateur ne rendait pas de PCM après plus de 120 s.

La conversion des 342 tenseurs double vers float32 et l’extraction du réseau jusqu’aux sorties `/Pad_2_output_0` et `/Add_4_output_0` donnent **3 658 nœuds**, **89 488 722 octets**, SHA-256 `f28aab2f35bea14fbd03d2228c6c199df0a4d2036507d4ed44a44edf145a5191`. Les poids utiles restent ceux de l’export d’origine ; aucun réentraînement. La session continue d’utiliser les optimisations de graphe désactivées.

`SixStemReconstruction.js` reconstruit les douze canaux à partir du spectre `[1,6,2,2,2049,340]` et de la branche temporelle `[1,6,2,343980]`. Il utilise l’iFFT JS déjà présente : FFT 4096, hop 1024, fenêtre Hann périodique, longueur intermédiaire 347136, retrait de 1536 échantillons puis conservation de 343980 échantillons. Trois tests couvrent formes/NaN, dernier échantillon de chaque canal et impulsion analytique au bon endroit.

## Résultats

Référence native : ONNX Runtime CPU **1.23.1**, deux threads, graphe complet corrigé, mêmes poids et même entrée. GPU navigateur : Chrome / Apple Metal, ONNX Runtime Web **1.22.0**, backend hybride avec reconstruction JS. Les comparaisons sont numériques ; elles ne valident pas la qualité musicale face à UVR.

| Entrée / chemin | Résultat |
|---|---|
| Signal synthétique stéréo, GPU + reconstruction JS | 12 canaux finis ; réseau 1,48 s, reconstruction 9,85 s, total 16,53 s ; RMS relatif 0,513 %, maximum absolu 0,00302 |
| Mix réel *Slow Motion Dream*, premières 7,8 s | 12 canaux finis ; 1 856 kernels GPU profilés ; réseau 1,29 s, reconstruction 8,37 s, total 14,60 s ; RMS relatif **7,317 %**, maximum absolu **0,10386** |
| Même mix, réseau natif CPU puis reconstruction JS | RMS relatif **0,00598 %**, maximum absolu 0,000112 ; reconstruction ~0,84 s dans Node |
| Même mix, spectrogramme natif CPU injecté au réseau GPU | 1 842 kernels GPU ; RMS relatif **7,317 %**, maximum absolu 0,10386 : pas d’amélioration significative |

Le calcul bloquant est donc contourné, et la reconstruction JS est proche du graphe complet. Le spectrogramme GPU ne suffit pas à expliquer la dérive : elle reste dans le chemin réseau GPU. La cause opérateur par opérateur n’est pas encore établie. La comparaison réelle dépasse le seuil du prototype (RMS relatif ≤ 1 %, erreur maximale ≤ 0,005) : **ne pas activer cette conversion comme modèle GPU validé**. Le résultat synthétique seul aurait donné une confiance trompeuse. La reconstruction JS est également trop coûteuse dans cet essai pour annoncer du temps réel.

## Reproduire l’extraction

Dans un environnement Python temporaire avec `onnx==1.19.1` et NumPy :

```sh
python tools/extract-six-stem-network.py /chemin/htdemucs_6s_fp16weights.onnx /tmp/htdemucs_6s_no_istft.onnx
```

Le script vérifie le hash d’entrée, transforme les tenseurs double, extrait les deux sorties, valide le modèle et écrit ses métadonnées. Il a reproduit exactement le hash ci-dessus. Il ne distribue aucun poids et n’en ajoute pas au cache navigateur.

Les gros modèles et la page de probe sont dans le dossier local ignoré `third_party/nam-webgpu-probe/`, hors catalogue et dist. Les mesures brutes sont conservées dans `benchmarks/six-stems-*.json`. Les conditions utilisées pour le mix réel : décodage stéréo 44,1 kHz, premières 343980 frames, même buffer d’entrée et mêmes poids entre CPU et GPU. Crédits du morceau : `fixtures/music/NOTICE.md`.

## Suite précise

1. Comparer les activations intermédiaires du réseau CPU/GPU pour localiser le premier écart, notamment normalisations et convolutions ; la liste des opérateurs suspects reste une hypothèse.
2. Tester un runtime GPU plus récent ou un repli CPU ciblé pour les opérateurs identifiés, dans un environnement séparé du runtime 4 pistes validé.
3. Optimiser l’iFFT (plans et buffers réutilisés) avec tests numériques contre cette reconstruction.
4. Après validation sur plusieurs vrais mix : conversion dans le pipeline de téléchargement/versionnage/cache, intégrité, annulation, runner progressif six sorties et tests navigateur. Aucune activation du catalogue avant ces validations.

Sources : [export StemSplit](https://github.com/StemSplit/demucs-onnx), [correction float64 de Steminize](https://github.com/Gerschwin/steminize/blob/22b57d6a9eb0dc93a4a6fdf32dd849edac0aeaf4/src/engine/fixfloat64.ts). Notre outil Python réalise sa propre conversion vérifiée par hash ; il n’embarque pas le code de Steminize.
