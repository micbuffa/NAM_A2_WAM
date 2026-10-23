# BS Roformer SW — portage navigateur (22 octobre 2026)

Le cinquième modèle exécutable est **BS Roformer SW · 6 instruments · GPU expérimental**. Il distingue guitare et piano, en plus de basse, batterie, voix et autres. Menu Model dans Change model / settings ; GPU préféré lorsqu’il est disponible. Le profil Demucs Aperçu rapide reste une autre option à contexte 2 s. SW utilise un contexte **4 s**, avec **1 s de recouvrement** et publication de 3 s à la fois : ce n’est pas un démarrage sous la seconde.

## Sources et contrat

- Sources et tailles/hash : [manifest épinglé](research/bs-roformer-sw.json), [notice des poids](model-assets/ROFORMER_NOTICE.md), [licence FFT](vendor/bs-roformer-web/NOTICE.md). L’origine du checkpoint ne précise pas ses droits ; le MIT du pipeline ne les clarifie pas indépendamment.
- `RoformerDSP.js` : Hann périodique, FFT 2048 / hop 512, réflexion centrée, non normalisée. Implémentation indépendante de la STFT/iSTFT de la démonstration ; seule sa primitive FFT radix-2 MIT est réutilisée. Contrairement à sa reconstruction, ne jamais effacer le bin négatif F=1025 : il reflète le bin positif 1023. Test avec signal proche de Nyquist et bords non nuls.
- `RoformerCoreModel.js` : entrées réelles/imaginaires `[1,2,1025,345]`, sorties `[1,6,2,1025,345]`. Ordre basse/batterie/autres/voix/guitare/piano. Padding zéro de la dernière fenêtre jusqu’à 176400 frames, puis recadrage exact. Tenseurs libérés même en cas d’erreur.
- `roformer-worker.js` : session ORT Web **1.22.0** persistante, préchauffage sur silence, calcul et reconstruction hors thread principal. Blocs ordonnés transmis au lecteur ; dernier recouvrement publié sans trou. Pas encore de pool FFT pipeliné : privilégier d’abord une référence correcte et une mémoire bornée par fenêtre.
- `PreparedDemucsRunner` partagé : factory Worker selon runtime, contrat 4 ou 6 sources, vérification des paquets, annulation, timeout, session unique. Repli CPU autorisé avant tout paquet publié ; jamais mélanger deux backends dans des stems déjà publiés.

## Vérifications numériques réelles

Les seuils préexistants d’AudioComparison sont conservés et vérifiés **sur chaque canal**, pas seulement sur un score agrégé : maximum absolu 0,005 et RMS relative 1 % (ou plancher RMS absolu pour les sources quasi nulles).

| Essai | Référence | Résultat |
|---|---|---|
| STFT JS, entrée déterministe | `torch.stft` fourni par l’exporteur | max 1,79e−7 ; RMS relative 1,46e−7 |
| GPU, 4 s déterministes, 12 canaux | `ref_audio` PyTorch fourni par l’exporteur | max 8,32e−6 ; RMS relative 5,74e−5 ; tous canaux acceptés |
| CPU/WASM navigateur, même entrée | même référence PyTorch | max 9,31e−9 ; RMS relative 3,38e−7 ; tous canaux acceptés |
| GPU, mix musical 6 s et deux fenêtres | poids épinglés sur ORT CPU natif, DSP PyTorch et raccords identiques | max 1,38e−4 ; RMS relative 6,45e−5 ; tous canaux acceptés |

Le signal déterministe de l’exporteur est essentiellement attribué à « Autres » : il ne suffit pas à qualifier la qualité musicale des six sources. Le mix musical possède une énergie non nulle sur les six stems, mais n’est pas une référence studio isolée. Aucun score de qualité de séparation ni identité avec UVR n’est revendiqué.

Mesures Chrome sur cette machine, modèle préparé : GPU 4 s calculées en 2,97 s ; mix 6 s en 5,62 s, premier bloc à 3,07 s. Création session GPU 10,22 s + chauffe 4,47 s (hors téléchargement). CPU/WASM 4 s en **34,68 s**, chauffe 35,14 s : fonctionnel mais très lent. Pas de garantie temps réel sur toute machine. [Rapport complet](benchmarks/roformer-browser-2026-10-22.json).

## Reproduire

- `node tools/install-roformer-model.mjs` : installer les poids épinglés, depuis l’artefact local vérifié si présent, sinon l’URL HF immuable. Puis `npm run dist -- --no-regenerate --no-build`. Le fichier est ignoré par Git et inclus dans la dist statique ; le cache du navigateur vérifie sa taille et son hash au téléchargement.
- Diagnostic : `http://127.0.0.1:8765/examples/wam/source-separation/roformer-benchmark.html`. Artefacts de référence locaux dans `third_party/bs-roformer-audit/` nécessaires ; le lecteur principal n’en dépend pas.
- `tools/validate-roformer-reference.py` : référence spectrogramme CPU native.
- `tools/prepare-roformer-audio-reference.py` : convertit la référence PyTorch fournie, et crée une référence musicale avec DSP PyTorch + modèle CPU validé. Dépendances dans l’environnement temporaire décrit dans LOW_LATENCY.md. Les artefacts lourds restent ignorés par Git.

Les tests couvrent DFT indépendante, réflexion, proche Nyquist, reconstruction de queues et de signaux courts, contrat fixe, libération des tenseurs, douze canaux, choix GPU/CPU, annulation et absence de mélange de backends. Les mesures du host et du morceau entier complètent ce protocole ci-dessous.

## Validation dans le host

- Extrait 10 s, host à 48 kHz : six stems à 44,1 kHz, trois blocs, premier bloc **2 715,2 ms**, total **7 720,1 ms**. Lecture, solo guitare, sauvegarde et mix MP3 sélectionné dans Tracks vérifiés.
- Morceau entier **214,9 s** (9 477 119 frames), **72 blocs** : premier bloc **3 193,6 ms**, total **228 317,5 ms**. Lecture des stems pendant le calcul (avec une avance déjà accumulée), puis sauvegarde locale terminée. Ce test est légèrement plus lent que le temps réel ; ne pas garantir une lecture sans mise en tampon à partir du premier bloc. Pas de mesure de pic mémoire ni de guitare physique.
- Préparation initiale distincte de la lecture des stems déjà sauvegardés : un projet restauré peut se lire pendant que la session neuronale se prépare pour une future séparation. La préparation ne se relance pas si la même session est déjà en cours de préparation.
- Suite : **371 tests réussis**, huit tests Roformer ajoutés. Les modèles Demucs précédents, dont Aperçu rapide, restent disponibles. Le diagnostic Demucs 6s GPU en échec n’est pas activé par ce travail ; SW est un autre réseau.

Prochaine priorité fonctionnelle : **MDX-Net Inst HQ 4/5**. Une optimisation SW FFT/iFFT pipelinée et une comparaison perceptuelle guitare sur références isolées restent des travaux distincts.

Distribution reconstruite et poids SW + Aperçu vérifiés dans leur répertoire déployable (taille/SHA-256). Le projet entier à six pistes a été restauré depuis cette dist, en pause, avec Play activé.
