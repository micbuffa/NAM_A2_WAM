# Départ multipiste en moins d’une seconde — faisabilité, 22 octobre 2026

**Résultat : obtenu dans un laboratoire local sur cette machine, avec un véritable export court et un modèle déjà préparé.** Ce n’est pas un délai garanti sur toute machine ou au premier téléchargement. Le lecteur principal conserve son modèle normal ; le mode rapide n’a pas remplacé son rendu par défaut.

Ouvrir `http://127.0.0.1:8765/examples/wam/source-separation/low-latency-benchmark.html`. Le lien existe aussi dans les diagnostics de Settings. Les gros artefacts restent dans `third_party/nam-latency-probe/`, ignoré par Git : ce diagnostic n’est pas autonome après déploiement de la dist seule. Sans ces artefacts, une erreur explicite renvoie à ce protocole.

## Résultats réels

Extrait musical stéréo de six secondes de **Slow Motion Dream**, quatre sources, huit canaux. Modèle officiel HTDemucs, inférence de longueur courte, export neuronal statique ; STFT/iSTFT dans le navigateur. Chrome/WebGPU, même moteur de lecture progressive que le host. Aucun échantillon du morceau n’est séparé pendant la préparation : seul un signal nul chauffe le réseau.

| Variante | Contexte du réseau | Audio publié au premier bloc | Separate → pistes prêtes, modèle préparé | Départ audio planifié avec Play immédiat |
|---|---:|---:|---:|---:|
| Export court 1 s | 1 s | 0,75 s | 435,8 ms | — |
| Export court 2 s | 2 s | 1 s | 767,7 ms ; second essai 951,4 ms | 797,9 ms ; second essai 981,7 ms |

Avec deux secondes de contexte et 50 % de recouvrement, chaque nouveau calcul publie une seconde ; le dernier bloc peut publier la fin restante. Les pistes partagent une horloge et démarrent ensemble. **Zéro sous-alimentation** observée pendant la lecture testée de six secondes, avec calcul encore en cours au départ. Les temps audio sont ceux de l’ordonnanceur Web Audio, pas une mesure acoustique des haut-parleurs.

Une nouvelle session avec chargement et chauffe **inclus dans le clic Separate** a pris 1 684 ms au premier bloc pour la variante 1 s, 2 284 ms pour la variante 2 s. Les caches navigateur/driver n’ont pas été vidés ; « froide » signifie nouvelle session et nouveau Worker. La première préparation de la forme 2 s a demandé 6,89 s (poids servis localement). Ce temps doit être affiché **avant** le bouton Separate prêt : il ne disparaît pas. Sur Internet, le premier téléchargement des ~169 Mo de chaque export ajoute encore son propre coût.

[Mesures, versions, comparaisons et limites](benchmarks/low-latency-browser-2026-10-22.json).

## Pourquoi cela fonctionne maintenant

Réduire à 1 s le découpage extérieur de l’ancien export faisait encore exécuter son réseau de 7,8 s. Nous avons ici **réexporté le réseau lui-même**, avec entrées de 44 100 et 88 200 échantillons. `OnnxCoreModel` accepte explicitement ces contrats dans le laboratoire ; ses paramètres par défaut restent ceux du modèle de production à 7,8 s.

Le checkpoint est chargé via `demucs.pretrained.get_model('htdemucs')`. Le mode `use_train_segment=False` retire le padding à la longueur d’entraînement ; les formes temporelles sont figées lors de chaque export. Le script expose le cœur réel-valué du forward de Demucs, en laissant les FFT hors ONNX, et compare immédiatement ses sorties CPU à PyTorch. Il ne réentraîne pas le modèle.

Un Worker persistant conserve la session et les kernels préparés. Le premier clic **Separate — modèle prêt** n’attend donc ni lecture de 169 Mo, ni création de session, ni compilation initiale. Il lance vraiment le calcul sur le morceau. On ne pré-calcule pas le morceau pour présenter artificiellement un délai inférieur à une seconde.

```mermaid
flowchart LR
  A[Choisir un modèle rapide] --> B[Télécharger / cache]
  B --> C[Initialiser et chauffer sur silence]
  C --> D[État Modèle prêt]
  D --> E[Clic Separate : début du chronomètre]
  E --> F[Calcul de 2 s de contexte]
  F --> G[Publier 1 s des quatre sources]
  G --> H[Play disponible, horloge commune]
  H --> I[Suite des calculs et blocs ordonnés]
```

## Validation audio effectuée

1. **Cœur exporté / PyTorch**, signal déterministe, versions PyTorch 2.6.0 / ORT CPU 1.22.0 : comparaison des deux branches du réseau, reconstruction native vérifiée.
2. **Signal musical complet**, six secondes, toutes les sources et les deux canaux, même padding et overlap-add : le navigateur est comparé à une référence PyTorch **avec le même contexte court**, sans sélectionner seulement la batterie ou ignorer le dernier bloc.
3. Export 1 s corrigé : écart maximal navigateur/PyTorch **2,64e−6**, erreur RMS relative **1,17e−6**. Export 2 s : **3,02e−6** et **1,06e−6**. Le seuil préexistant de `AudioComparison` est conservé ; il n’a pas été relâché pour obtenir un succès.
4. Finitude, longueur finale, énergie, stéréo et résidu du remix sont mesurés. Le résidu du remix n’est pas un score de qualité de séparation.

### Bug DSP trouvé pendant cette validation

Le padding réfléchi gauche de `vendor/demucs-js/apply.js` lisait une zone encore vide du tableau résultat au lieu du tableau source. Les deux premières frames STFT étaient altérées. Avant correction : erreur relative STFT ~0,001796 et écart audio GPU/PyTorch dépassant le seuil. Après correction : erreur relative STFT ~1,70e−7. Un test DFT indépendant couvre une entrée non nulle dès son début. Cette correction bénéficie aussi à la chaîne normale 7,8 s ; elle est décrite dans la notice du DSP.

Le laboratoire utilise un device WebGPU sans `shader-f16` pour expliciter la précision. Ce choix seul n’avait pas supprimé l’écart : la cause identifiée était le padding, pas une preuve de défaut de précision GPU.

## Ce qui n’est pas équivalent : qualité et contexte

L’export court est proche de **PyTorch court**. Cela ne prouve pas qu’une séparation avec une seconde de contexte est identique à celle avec 7,8 s.

Sur cet extrait, les différences RMS relatives des stems courts par rapport au rendu PyTorch à contexte 7,8 s sont :

| Source | Contexte 1 s | Contexte 2 s |
|---|---:|---:|
| Batterie | 21,5 % | 15,9 % |
| Basse | 39,7 % | 22,7 % |
| Autres | 34,9 % | 18,6 % |
| Voix | 19,6 % | 15,0 % |

Ce sont des **différences de rendu**, pas des pourcentages de perte de qualité ou des SDR : nous n’avons pas les quatre stems studio isolés de vérité terrain. Les WAV de comparaison au même gain sont générés dans `third_party/nam-latency-probe/short-1s-*.wav`, `short-2s-*.wav`, `reference-1s-*.wav` et `reference-2s-*.wav`. Les fichiers reference utilisent le même contexte 7,8 s ; leur suffixe identifie le test associé. Les crédits de la musique figurent dans [fixtures/music/NOTICE.md](fixtures/music/NOTICE.md). Aucune écoute perceptuelle humaine n’est revendiquée par ces mesures.

## Reproduire

Depuis la racine du projet, avec Python 3.12 et ffmpeg disponibles. Utiliser un environnement temporaire ; ces paquets ne sont pas requis pour faire tourner le host.

```sh
python3.12 -m venv /tmp/nam-latency-export
/tmp/nam-latency-export/bin/python -m pip install torch==2.6.0 torchaudio==2.6.0 demucs==4.0.1 onnx==1.19.1 onnxruntime==1.22.0
/tmp/nam-latency-export/bin/python tools/export-demucs-short-probe.py 1
/tmp/nam-latency-export/bin/python tools/export-demucs-short-probe.py 2
ffmpeg -v error -y -i examples/wam/source-separation/fixtures/music/slow-motion-dream.mp3 -t 6 -ar 44100 -ac 2 -f f32le third_party/nam-latency-probe/music-input.f32
/tmp/nam-latency-export/bin/python tools/validate-demucs-short-audio.py 1
/tmp/nam-latency-export/bin/python tools/validate-demucs-short-audio.py 2
npm start
```

L’export télécharge le checkpoint officiel dans `/private/tmp/nam-latency-model-cache`. Les scripts échouent si les comparaisons CPU dépassent leurs seuils. Ils produisent les références PCM et les WAV, ainsi que des rapports `/tmp/nam-latency-*-export.json` et `/tmp/nam-latency-musical-reference-*.json`.

Dans le laboratoire : choisir 1 ou 2 s, cliquer **Préparer le modèle**, attendre son état prêt, puis **Separate — modèle prêt**. La case **Tester Play dès le premier bloc** déclenche uniquement cette lecture de diagnostic ; elle est décochée par défaut. Le bouton session froide inclut au contraire chargement et chauffe dans le chronomètre. Aucune autorisation micro nécessaire.

## Intégration proposée dans Multitracks, étape suivante

- Un profil explicite **Aperçu rapide**, distinct du rendu qualité normal ; privilégier 2 s de contexte avec publication de 1 s sur le matériel mesuré.
- Modèle préparé avant d’activer Separate, états et progression visibles, session conservée tant que modèle/backend restent identiques. Libération lors d’un changement ou fermeture.
- Départ à partir d’un vrai bloc des quatre sources, jamais un original présenté comme séparé. Tampon adaptatif et état mise en tampon si une machine ne calcule pas plus vite que la lecture.
- Réutiliser le lecteur, le cache vérifié, les projets et l’export du host. Conserver dans le projet l’identité du modèle, la durée de contexte et le type aperçu/qualité.
- Éventuel recalcul qualité en arrière-plan ; ne pas remplacer des buffers déjà en lecture sans transition sûre. Pas de double modèle GPU chargé par défaut.
- Valider ensuite un morceau entier, la RAM, les retours rapides entre morceaux, annulation, mute/solo/pan et la balance guitare/backing. La preuve locale six secondes ne remplace pas cette validation.

L’objectif sous une seconde est donc techniquement crédible et démontré ici **après préparation du modèle**. Le rendre universel à froid, au premier téléchargement ou sur CPU lent ne serait pas une promesse justifiée.

## Intégration P4.11 (22 octobre 2026)

Dans Multitracks → **Change model / settings → Model**, choisir **Aperçu rapide · Demucs 4 pistes · GPU / CPU**. Le profil Qualité reste recommandé par défaut. Le téléchargement sert un export 2 s vérifié depuis `model-assets/htdemucs-2s-core.onnx` (~162,2 Mio), puis compile et chauffe sur silence avant de rendre Separate disponible. La session persiste entre les morceaux. Changer de modèle/backend, annuler ou détruire le lecteur libère son Worker. Une erreur GPU de préparation peut provoquer un repli CPU explicitement indiqué ; aucun mélange de backends pendant les blocs publiés.

Commande après export et validation : `node tools/install-demucs-preview.mjs`. Le hash du manifeste doit correspondre exactement ; un export différent exige sa propre validation/version. Les poids sont ignorés par Git, copiés dans la dist et requis à la construction. La dist seule contient donc tout le mode rapide ; le laboratoire 1/2 s conserve ses artefacts à part. Aucun réexport de PyTorch n’est requis chez l’utilisateur final.

La sélection du modèle conserve le profil dans le projet. Les stems audio et le mix exporté proviennent de ce rendu court, sans substitution silencieuse d’un rendu Qualité. Le lecteur reste celui du host. Les temps `firstReadyMs` dans les mesures Settings sont mesurés au clic Separate, AudioBuffers effectivement ajoutés, indépendamment du dessin des waveforms.

Premières validations réelles : extrait 10 s, premier bloc prêt en **642,5 ms** dans le prototype, **802,9 ms** dans le host (48 kHz, buffers stems 44,1 kHz). Totaux respectifs 4,89 s / 5,11 s. Modèle déjà préparé, pas de traitement anticipé du morceau. Ces temps ne sont pas des délais acoustiques et ne garantissent rien sur une autre machine.

Test réel morceau entier dans le host : **214,9 s** (9 477 119 frames), 214 blocs, séparation **115,10 s**, premier bloc prêt **1 113,8 ms** avec la session conservée de l’essai précédent. Lecture des stems pendant le calcul vérifiée, puis sauvegarde automatique terminée. Aucun pic de heap ni guitare physique mesuré. La copie/validation du PCM complet précède encore le premier bloc : optimiser ce coût pour les longs fichiers est une suite distincte. [Rapport intégré](benchmarks/preview-integration-2026-10-22.json).

La distribution a aussi été vérifiée sur **CPU/WASM** : signal de 1 s, premier bloc après **2 323,9 ms** (modèle préparé). Ce secours est fonctionnel, mais cet essai est plus lent que le temps réel ; le lecteur peut attendre les données. Export MP3 de cet aperçu puis sélection dans Tracks vérifiés, avec suffixe explicite « aperçu rapide ». Le projet entier sauvegardé a été restauré depuis la dist en pause.

Validation finale : **363 tests réussis**, dont session réutilisée, changement backend, annulation préparation/calcul, erreurs Worker, rejet des blocs invalides et conservation de la provenance du MP3.
