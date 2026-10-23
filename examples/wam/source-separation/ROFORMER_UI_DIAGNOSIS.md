# Pourquoi la page se fige avec BS Roformer SW

Diagnostic du 22 octobre 2026, Chrome local, WebGPU, extrait60s Jet, lecture simultanée. Instrumentation optionnelle `?uiMetrics=1` ; rapport brut : `benchmarks/roformer-ui-blocking-2026-10-22.json`.

## Ce qui est mesuré

Après la compilation et le lancement, pendant la séparation :

| Mesure | Observation |
| --- | --- |
| Plus grand intervalle entre callbacks d'animation | 2 006ms |
| Timer UI indépendant, période50ms | retard supplémentaire maximum15,35ms |
| Long Tasks JS UI détectées | 0 |
| Publication audio côté UI | maximum10,805ms |
| Publication des waveforms côté UI | maximum1,745ms |
| Mise à jour des contrôles | maximum0,225ms |
| Long Animation Frames | 19 dans le relevé, exemples sans script attribué et blockingDuration0 |

Dans plusieurs intervalles d'environ1,9–2s sans animation, le timer50ms continue de passer. Le thread JavaScript UI n'est donc pas occupé pendant deux secondes par notre copie audio ou nos contrôles. L'absence de Long Tasks seule ne suffirait pas à cette conclusion ; ici elle est complétée par le timer indépendant.

Les marqueurs envoyés par le Worker Roformer donnent sur trois fenêtres successives :

- STFT dans le Worker : environ34–35ms.
- `await session.run` ONNX/WebGPU dans le Worker : environ2 130–2 163ms.
- Reconstruction iSTFT dans le Worker : environ265–271ms.

Après alignement par performance.timeOrigin et horodatages Unix des phases Worker, cinq trous RAF de593ms à1 965ms se trouvent entièrement dans la phase réseau. Un autre trou est à la fin du snapshot, alors que la phase réseau suivante n'a pas encore envoyé son marqueur de fin : ne pas interpréter l'absence de recouvrement calculé dans le JSON comme une autre cause.

Chrome expose aussi des frames longues dont le rendu ne commence qu'en fin d'intervalle (exemple :1378ms de durée, aucune contribution de script attribuée, blockingDuration0). Cela renforce le diagnostic d'une attente du rendu plutôt que d'une longue fonction JavaScript UI.

## Interprétation et limites

**La contention/attente du chemin ONNX-WebGPU et du rendu navigateur est la cause principale probable des pauses régulières reproduites.** Un Worker isole l'exécution JS ; il ne fournit ni un autre GPU ni une réservation de temps pour le compositeur. Le ring buffer règle le transport PCM et le bornage de la consommation, pas l'occupation des ressources de calcul/rendu. Le scroll peut donc paraître figé alors que les timers et messages de la page restent traités.

Ce n'est pas une trace GPU/driver : le relevé ne permet pas de nommer un kernel fautif, de distinguer saturation de calcul, transferts/synchronisation, pression mémoire ou limitation d'ordonnancement du navigateur. `session.run` inclut aussi les opérateurs CPU du pipeline hybride et les téléchargements des sorties. Les conditions d'automatisation et de composition de la fenêtre font partie du test. Ne pas affirmer « tel shader bloque le thread UI » ou « 100% du temps est du calcul GPU ».

Le réseau produit deux tenseurs spectraux de forme1×6×2×1025×345, soit33 948 000octets au total (~32,4Mio) en float32 par fenêtre, avant iSTFT. Les activations internes et les poids ajoutent une charge qui n'est pas mesurée ici. Ce chiffre décrit le contrat du modèle, pas une preuve de pression mémoire.

## Coûts UI distincts

Il reste du travail natif ou JS sur l'UI : copie initiale du morceau, validation d'entrée avant transfert, accès/vérification du cache, création et copie des AudioBuffer de preview, DOM/canvas, sauvegarde et assemblage d'une boucle disponible. Un relevé après la fin montre aussi une Long Task162ms attribuée à la chaîne de callback du transport (sans identifier encore l’appel interne responsable). Elle est distincte des gels réguliers de2s pendant le réseau. Ces opérations peuvent causer des pauses au lancement ou en fin de traitement ; elles ne correspondent pas aux trous réguliers d'environ2s mesurés ici au milieu des phases réseau.

## La suite utile

1. Cibler l'exécution ONNX/WebGPU et le rendu avec une trace GPU/DevTools ; conserver timer et phases pour distinguer JS, rendu et Worker.
2. Vérifier si le runtime permet de borner la soumission des commandes/kernels et de rendre du temps au compositeur **à l'intérieur** d'une inférence, ou tester une configuration/export moins coûteux. Ne pas patcher arbitrairement ORT ni modifier les seuils audio.
3. Comparer à modèle/poids identiques le rendu au repos, en inférence GPU, puis en CPU de secours sur un court extrait. CPU Roformer est lent ; ne pas le promouvoir comme solution rapide sans mesure.
4. Une pause entre deux fenêtres ne supprime pas le blocage à l'intérieur de `session.run`. Des paquets ring d'une seconde ne changent pas la fenêtre neuronale de4s. Ajouter encore des Workers ne crée pas un second GPU.

Références : architecture RenderingNG Chromium https://developer.chrome.com/docs/chromium/renderingng-architecture ; Long Animation Frames https://developer.chrome.com/docs/web-platform/long-animation-frames ; diagnostic ONNX Runtime Web https://onnxruntime.ai/docs/tutorials/web/performance-diagnosis.html .

## Correction : exécution coopérative du graphe GPU

Le 22 octobre 2026, une solution est intégrée pour Roformer/WebGPU : `CooperativeOnnxSession.js` reconstruit **72 graphes ONNX**, de 100 nœuds non constants au maximum, à partir des **mêmes poids vérifiés dans le cache**. Il ne s'agit pas de découper le signal en tranches plus petites : la fenêtre audio et son contexte restent de 4s, avec publication de 3s et raccords inchangés.

Entre deux graphes, le Worker attend `GPUQueue.onSubmittedWorkDone()`, puis rend la main pendant 4ms avant de lancer la suite. Cela empêche d'accumuler le travail de tout le réseau dans la file GPU. Les tenseurs intermédiaires float/float16 restent sur le GPU aux frontières ; les autres types et les opérateurs CPU du pipeline hybride peuvent encore entraîner des transferts. Les deux spectres finaux reviennent en CPU pour l'iSTFT. Les résultats intermédiaires sont libérés après leur dernier consommateur, y compris les dépendances qui traversent plusieurs étapes. En cas d'échec, les tenseurs et sessions déjà créés sont libérés. L'annulation/changement de modèle termine le Worker comme auparavant.

Le runtime ORT vendored et les poids ne sont pas patchés. Le plan, `research/roformer-stage-plan.json` (environ1,3Mo, **aucun poids**), contient les plages d'octets des nœuds/constantes et les métadonnées des entrées/sorties. Il est lié au SHA-256 du checkpoint ; une vérification dans le Worker refuse un plan d'une autre version. Le générateur reproductible est `tools/prepare-roformer-stage-plan.py` (onnx1.19.1, environnement de l'audit audio). Les graphes temporaires restent dans le Worker ; pas de téléchargement/cache de 72 copies du modèle. Le parcours WASM conserve le graphe original et ses poids.

### Mesures et validation

Rapport : `benchmarks/roformer-cooperative-2026-10-22.json`.

- Prototype isolé, référence déterministe 4s, même page : original4026ms, intervalle RAF max82,4ms ; découpé4655ms, intervalle max17,4ms. Cet essai court ne reproduit pas les gels de2s du host : ne pas le présenter comme une comparaison directe à la mesure Jet60s précédente. Le coût mesuré du découpage sur ce test est d'environ16%.
- Code intégré, référence musicale6s, deux fenêtres et raccord :9979ms, RAF p95~9,2ms, max58ms. Douze canaux comparés à la référence ORT CPU/PyTorch : erreur absolue max1,384e−4, RMS relative6,47e−5, dans les seuils existants. La référence déterministe passe aussi (max8,33e−6).
- Host, Jet60s, lecture des six stems pendant la séparation : relevé actif après réinitialisation des métriques, jusqu'à57s disponibles, RAF p95~9,4ms, max~68ms. Scroll de la page et mute Piano manipulés pendant le calcul ; mute rétabli ensuite. Les gels répétés d'environ2s de l'essai précédent ne sont pas reproduits dans ce relevé. Les conditions sont celles de cette machine et de Chrome, pas une garantie de fréquence d'affichage sur tous les GPU.

**Compromis :** cette version privilégie la réactivité. Le découpage réduit certaines optimisations globales, ajoute des sessions et des points de synchronisation ; la séparation et la préparation peuvent prendre plus de temps. La disponibilité audio progressive ne garantit donc pas une production plus rapide que la lecture. L'optimisation ultérieure devra ajuster les frontières/coûts avec de nouvelles mesures, sans réintroduire une longue file GPU. Les pauses JS au chargement/assemblage/sauvegarde restent des coûts distincts ; cette correction ne promet pas zéro frame longue.

APIs publiques utilisées : [ORT GPU tensors et sorties GPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html), [fin des commandes GPU WebGPU](https://www.w3.org/TR/webgpu/#dom-gpuqueue-onsubmittedworkdone).

Sur ce même essai du host : premier bloc à3,92s, traitement des60s en67,89s (ancien essai~50,3s, conditions de session différentes). Le relevé cumulant la fin montre aussi une pause JS148ms et un trou RAF158ms, probablement dans le parcours de finalisation/sauvegarde mais sans attribution interne suffisante pour nommer une fonction. Cela reste à optimiser séparément ; le résultat mesuré concerne la disparition des gels répétés de2s pendant le réseau, pas l’absence de toute pause.

## Optimisation suivante :18 étapes et sauvegarde par Blobs

Le plan de production passe de72 à18 étapes (400 nœuds non constants), après comparaison de cinq variantes et validation des douze canaux. Le gros coût de sérialisation IndexedDB est isolé et remplacé par une préparation Blob avec pauses entre tâches. Résultats et limites, dont le coût total de sauvegarde supérieur : [ROFORMER_THROUGHPUT_AND_STORAGE.md](ROFORMER_THROUGHPUT_AND_STORAGE.md). Les mesures précédentes restent l’historique de la version72 étapes.
