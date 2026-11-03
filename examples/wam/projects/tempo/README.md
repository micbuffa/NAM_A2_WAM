# Beat This! final0 — T1/T2 : banc et préécoute

Banc isolé de qualification, pas encore une carte de tempo appliquée au Studio.

Ouvrir `/rack/projects/tempo/beat-this-benchmark.html` avec Rails (localement
<http://localhost:3001/rack/projects/tempo/beat-this-benchmark.html>).
En distribution statique : `/NAM_A2_WAM/projects/tempo/beat-this-benchmark.html`.
Source : `/examples/wam/projects/tempo/beat-this-benchmark.html` sur le serveur du dépôt.
HTTPS ou localhost requis ; serveur avec MIME JavaScript pour `.mjs` et `.wasm` correct.

1. Télécharger explicitement le modèle (190,9 Mo), vérifié par taille/SHA-256 et conservé dans IndexedDB.
2. Choisir un fichier audio local ou la rythmique synthétique de contrôle.
3. Choisir la durée depuis le début (5/10/20/30/60/120 s maximum) et CPU/WASM ou WebGPU.
4. Analyser, observer la waveform et les beats/downbeats ; écouter avec le clic sur une plage A/B.
5. Corriger ×2/÷2, premier temps et battements par mesure, puis exporter le JSON avec proposition séparée des résultats ML bruts.

Le fichier original reste intact. Aucun audio n'est envoyé à un service tiers.
Le téléchargement sortant concerne seulement le modèle épinglé sur Hugging Face.
La suppression du cache concerne uniquement cet identifiant/version, pas les modèles de séparation.
Une annulation termine le Worker, y compris une inférence en cours. Les réponses anciennes sont ignorées.
Aucune vérification périodique du cache : contrôle à l'ouverture et avant une utilisation explicite.

## Contrat et limites

- [Référence officielle](https://github.com/CPJKU/beat_this) : `beat-this` 1.1.0, checkpoint `final0`.
- [Export tiers](https://huggingface.co/musetric/beat-this-onnx/tree/25308706dda545c0d5950065bb0604ad71bcf1f5), révision et SHA des deux fichiers dans `BeatThisManifest.js`.
- Licence MIT upstream copiée dans `BEAT_THIS_LICENSE.txt`. Adaptation du pré/post-traitement CPJKU ; réseau tiers non modifié. Les poids ne sont pas versionnés ni copiés dans la dist produit.
- Runtime du banc uniquement : ORT Web 1.30.0 déjà vendored dans `source-separation/vendor/onnxruntime-webnn`, sans changer le runtime du séparateur.
- WAV PCM16 à22050Hz : lecture exacte des échantillons ; sinon décodage navigateur à22050Hz. Moyenne arithmétique des canaux, Hann périodique, FFT1024/hop441, magnitude divisée par sqrt(1024), filtre Slaney épinglé, log1p(1000×mel).
- Le rééchantillonneur navigateur diffère de soxr ; la parité est qualifiée sur des WAV 22050 Hz identiques, pas sur tous les décodeurs/formats.
- Fenêtres de1500 frames pour les morceaux longs ; contexte réel + bords6 pour les courts, queue déplacée, agrégation keep_first ; maxima7/logit>0, déduplication et downbeats alignés au beat le plus proche.
- **Extraits courts : contexte réel qualifié localement.** Recette `beat-this-dynamic-recipe.json` (3,31 Mo) reconstruisant un graphe à longueur variable à partir des poids déjà en cache, SHA source/recette/cible vérifiés. Attention par groupes de huit têtes, ReduceL2 décomposées, Split constants remplacés par Slice ; WebGPU NCHW explicite. Aucun changement des poids appris. Même extrait de10,88s : 21 beats/6 downbeats identiques à la référence officielle ; erreur maximale navigateur/native3,34e-5. Outil reproductible `tools/prepare-beat-this-dynamic.py` ; validation `tools/validate-beat-this.py --dynamic-model <graphe>` avec les autres arguments du protocole existant.
- **WebGPU : contournement validé sur la machine de développement.** La divergence est localisée dans `ReduceL2` : un shader est réutilisé entre des vecteurs de largeurs différentes alors que sa boucle dépend de cette largeur. Un cas minimal32/64 retrouve le défaut. `BeatThisGraph.js` applique uniquement au GPU un petit patch déterministe (40Ko, SHA vérifié) qui décompose les25 normalisations en carré/somme/racine. Les561 initializers sont identiques et les poids d’origine restent en cache ; le graphe CPU/WASM est inchangé. Sur30s du MP3 utilisateur :50beats/13downbeats identiques à WASM, écart maximal0,000066. Sur le signal synthétique :25/10 identiques. Chaque fenêtre est toujours contrôlée contre WASM (tolérance0,002) et les événements finaux doivent être identiques ; sinon rejet explicite, aucun repli caché. Autres navigateurs/machines à qualifier. Le temps de préparation du graphe et le coût CPU de validation sont séparés de l’inférence GPU.
- BPM médian sans score de confiance musical. T2 permet les corrections ×2/÷2, premier temps, trois/quatre battements et préécoute A/B. Cela ne constitue pas encore une carte de tempo de projet : conversions/persistance/transport/intégration restent en T3–T5.
- Durée d'analyse120s maximum dans ce banc ; le navigateur décode actuellement tout le fichier importé. Ne pas lancer ce banc en parallèle d'une capture/séparation lourde. L'ordonnanceur produit est une étape d'intégration ultérieure.

## Validation reproductible

`npm test` contient des tests sans téléchargement ni poids ML : fixture de features indépendante
PyTorch/torchaudio, normalisation, fenêtres/jointures, post-traitement, offsets,
annulation, réponses périmées, erreurs et rejet de sorties GPU divergentes.

Le contrôle lourd est explicite : `tools/validate-beat-this.py --help`.
Créer un environnement Python séparé, installer `beat-this==1.1.0`, torch,
torchaudio, numpy, onnxruntime. Fournir checkpoint officiel et les deux fichiers
épinglés, un WAV mono PCM16 à22050Hz, puis le JSON du navigateur sur **ce même WAV**.
Le script vérifie SHA des poids, compare PyTorch/ONNX sur les mêmes features et
exporte les logits, beats/downbeats, versions et écart propre aux fenêtres courtes.
Les `.features.f32` et `.pcm.f32` adjacents servent à la comparaison du frontend.
Validation du3novembre :648 tests JS passent, dont24 nouveaux ; sur32,64s de musique (extrait répété),61beats/16downbeats identiques entre navigateur CPU, ONNX natif et référence PyTorch. Écart maximal navigateur/ONNX :0,000054.
Seuil de qualification des logits : erreur absolue maximale0,002 ; événements identiques.
Ce seuil numérique ne constitue pas un score de précision musicale.

Pour éviter un téléchargement distant durant la qualification locale uniquement,
placer les fichiers dans `examples/wam/source-separation/model-assets/beat-this/`
(ignoré par Git et exclu de la dist produit) et ouvrir la page source avec
`?localModel=1`. Les mêmes SHA s'appliquent ; ne pas utiliser cette option sur une dist sans ces assets.

Résultats et limites du3novembre2026 : voir `qualification-2026-11-03.json` et `TEMPO_MAP_SPECIFICATION.md` à la racine du dépôt.

## Reproduire le patch GPU

`python tools/prepare-beat-this-webgpu.py --model /path/to/beat_this.onnx`
(requiert `onnx`) régénère le JSON à partir du SHA source épinglé. Option
`--patched-model /tmp/beat_this_safe.onnx` pour inspection/qualification native.
Seules les25 définitions de normalisation et la longueur protobuf du graphe changent.
Le Worker vérifie SHA du modèle source, du patch et du graphe dérivé avant compilation.
Graphe GPU dérivé : `7cc392e287c12ce27642fd5f04f0d4dfb47102d20eabe51b466a38a0786b3ba3`.
La version du correctif figure dans l’export JSON (`executionGraph`).
Il n’est pas nécessaire de retélécharger les poids après mise à jour de la page.

Référence du problème de cache : [code ORT1.30](https://github.com/microsoft/onnxruntime/blob/v1.30.0/js/web/lib/wasm/jsep/webgpu/ops/reduce.ts),
`createReduceProgramInfo` émet une borne de boucle depuis `inputShape[k]`,
`runReduceProgram` utilise une dépendance de cache sur le rang. Les mesures
intermédiaires et le cas minimal complètent cette lecture du code ; le correctif
applicatif ne remplace pas une validation de la correction upstream.
