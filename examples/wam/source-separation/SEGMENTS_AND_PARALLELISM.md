# Taille des segments et parallélisme — 22 octobre 2026

**Mise à jour P4.8 : le réglage manuel décrit ci-dessous a été retiré. Le host impose Auto. Les mesures restent valides ; voir [l’étude des modèles et des exports plus courts](MODEL_CANDIDATES.md).**

Le menu **Taille des segments** est dans Multitracks, à côté de la durée à séparer : **Auto**, **1**, **2**, **3**, **5**, **7,8 secondes**. La durée du morceau/extrait reste indépendante de cette taille. Le réglage est transmis aux trois moteurs et conservé avec le projet ; un ancien projet retrouve Auto. Il est verrouillé pendant un calcul.

## Ce que ce réglage change

| Moteur | Auto | Recouvrement entre segments | Conséquence des segments courts |
|---|---|---|---|
| ONNX, CPU ou GPU | 7,8 s | 25 % | Plus de passes réseau pour le même morceau ; fenêtre réseau toujours complétée à 7,8 s |
| WASM 6s progressif | 5 s | 20 % | Blocs publiés plus courts, coût fixe répété plus souvent et moins de contexte musical |
| WASM classique, dont FT | Calcul direct ≤10 s, sinon fenêtres de 5 s | 20 % si découpé | Une taille explicite impose le découpage même pour un extrait court ; FT attend toujours ses quatre spécialistes |

`SegmentSettings.js` est partagé par les Workers et le contrôleur. `segmentPlans` produit des fenêtres recouvrantes ; `OverlapAssembler` effectue le fondu avec les mêmes coefficients pour tous les stems, puis publie chaque échantillon une seule fois, y compris la dernière queue. Les ratios de recouvrement restent ceux des configurations précédentes.

Le réseau ONNX a un contrat fixe dans `OnnxCoreModel.validLength()` : **343 980 échantillons = 7,8 s**. `applyInference()` complète le signal à cette taille puis recadre la sortie. Choisir 1 s ne fabrique donc pas un réseau six ou huit fois plus rapide. Sur un morceau de 60 s, les plans extérieurs passent d’environ 10 fenêtres en Auto à 80 en segments de 1 s (avant prise en compte de la dernière fenêtre). C’est surtout un réglage pour expérimenter le compromis attente/contexte/raccords ; Auto reste recommandé. La qualité musicale de chaque taille nécessite une écoute comparative.

## Essai réel WebGPU sur le même extrait

Chrome, modèle ONNX 4 pistes, dix premières secondes du mix musical de test Slow Motion Dream, sessions successives sur la même machine :

| Taille demandée | Fenêtres extérieures | Temps Worker |
|---|---:|---:|
| 1 s | 13 | 27,4 s |
| 2 s | 7 | 16,4 s |
| Auto (7,8 s) | 2 | 5,5 s |

Chaque calcul a produit quatre stems de 10 s, sans erreur console et sans lecture automatique. Ce sont trois essais ponctuels, pas un benchmark statistique : initialisation et compilation peuvent varier. Ils confirment ici que les segments courts augmentent le coût. L’équivalence musicale entre tailles n’est pas affirmée. [Mesures par bloc](benchmarks/segment-size-browser-2026-10-22.json).

## Plusieurs segments en parallèle : faisable, gain à mesurer

Les fenêtres sont indépendantes pour l’inférence. Le fondu dépend toutefois du segment précédent : des calculs parallèles peuvent finir dans le désordre, mais leur publication doit rester ordonnée. Les moteurs actuels sont séquentiels ; aucun pool de Workers n’est activé par cette modification.

### CPU / WASM

Un pool de deux Workers est techniquement possible : un modèle chargé par Worker, petits travaux contenant indice/bornes, tampon de réordonnancement borné, assemblage dans l’ordre. Cela exploiterait plusieurs cœurs si chaque instance ne les utilise pas déjà tous. **Le gain n’est pas garanti** : initialisation répétée, copies, bande passante mémoire et compétition avec Web Audio peuvent l’annuler.

Les mesures locales antérieures du moteur 6s/FT réservent déjà environ 2,3–2,4 Gio de heap WASM par instance. Deux instances demanderaient environ 4,6–4,8 Gio pour ces seules heaps, en plus de l’audio et du navigateur : le pool ne doit pas être le défaut. Pour FT, commencer avec deux segments du même spécialiste, libérer ces instances, puis passer au suivant ; éviter de charger quatre spécialistes simultanément.

Une autre piste est le multithreading interne d’ONNX Runtime WASM : `numThreads` est actuellement fixé à 1 dans `OnnxRuntimeConfig.js`. Le runtime documente l’exigence de WebAssembly threads et de `crossOriginIsolated` pour l’activer. Cela demande une validation des binaires et des en-têtes de déploiement ; ce n’est pas un simple synonyme d’un pool de segments. Le build WASM historique 6s/FT est distinct et ne gagne pas des threads en changeant un flag ONNX.

### GPU / WebGPU

L’inférence utilise déjà le parallélisme du GPU. Créer plusieurs sessions/Workers sur ce même GPU ne multiplie pas sa capacité et peut augmenter mémoire, compilation et concurrence. **C’est une hypothèse de benchmark, pas une accélération démontrée.** L’adaptateur actuel ne propose pas de batch de fenêtres : il faudrait un modèle exporté compatible pour changer ce contrat.

Pour notre pipeline hybride, la première piste à profiler est plutôt le chevauchement des étapes : préparation FFT du segment suivant sur CPU, pendant l’inférence GPU du courant, puis reconstruction du précédent. Garder un seul propriétaire de la session GPU, une file bornée et une publication ordonnée. Des changements plus profonds des échanges CPU/GPU seraient nécessaires pour réduire les copies ; ils ne se déduisent pas d’un `Promise.all` autour de la boucle actuelle.

## Expérience suivante proposée (non implémentée)

1. Profilage séparé FFT / inférence / iFFT / transfert / initialisation sur le même extrait musical et même modèle.
2. Comparer le séquentiel à deux Workers CPU, puis éventuellement deux sessions GPU en diagnostic isolé, sans en faire le défaut.
3. Mesurer calcul froid et chaud, durée totale, délai du premier bloc, mémoire, réactivité du host et éventuelles coupures audio. Ne pas additionner pool et multithreading sans surveiller la surallocation de cœurs.
4. Comparer les PCM parallèle/séquentiel avec **la même taille de segment**, les raccords, la durée finale, l’annulation, les erreurs et le repli CPU avant toute publication.
5. Retenir une option uniquement si le gain réel justifie la mémoire ; sinon rester séquentiel. Une taille de segment différente modifie le contexte et ne sert pas de référence d’identité audio.

## Sources et limites

Le contrat de fenêtre fixe et l’architecture décrite viennent du code épinglé de ce projet. Les estimations de mémoire extrapolent les mesures de `FEASIBILITY.md` ; elles ne sont pas une mesure d’un pool en fonctionnement.

- [ONNX Runtime — flags, threads et limites du proxy Worker](https://onnxruntime.ai/docs/tutorials/web/env-flags-and-session-options.html).
- [ONNX Runtime — diagnostic des performances et profilage](https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html).
- [ONNX Runtime — WebGPU, transferts CPU/GPU et conditions du graph capture](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html).

Graph capture exige notamment que tous les kernels tournent sur GPU selon cette documentation ; notre pipeline hybride n’offre pas cette garantie. Aucune nouvelle politique de parallélisme n’est activée ici.
