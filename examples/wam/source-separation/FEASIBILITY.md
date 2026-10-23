# Faisabilité Demucs — 20 octobre 2026

Les vrais poids des deux modèles s’exécutent dans le navigateur avec le runtime WASM SIMD épinglé de bengfarrell/demucs-wasm, révision `35c8bd5b74c56f630082058179cd8f57cb192fb2`. Le prototype restitue les stems via un lecteur à horloge commune. Aucun audio n’est envoyé à un service distant.

## Mesures locales

| Test | Backend | Temps Worker | Heap WASM maximale | Résultat |
|---|---|---:|---:|---|
| Signal stéréo 220 Hz, 1 s, htdemucs_6s | WASM navigateur intégré | 8,7 s | 2,33 Gio | 6 pistes stéréo finies |
| Même signal, htdemucs_ft | WASM navigateur intégré | 42,8 s | 2,42 Gio | 4 pistes après 4 spécialistes |
| Première seconde de CleanChords.mp3 du projet, 6s | WASM navigateur intégré | 8,6 s | 2,33 Gio | 6 pistes, transport Web Audio vérifié |
| Première seconde de CleanChords.mp3 du projet, FT | WASM navigateur intégré | 42,3 s | 2,42 Gio | 4 pistes stéréo finies |
| Cinq secondes de CleanChords.mp3, 6s | WASM navigateur intégré | 8,7 s | 2,36 Gio | 6 pistes stéréo finies |
| Dix secondes de CleanChords.mp3, 6s | WASM navigateur intégré | 16,2 s | 2,38 Gio | 6 pistes stéréo finies |

Ces temps excluent téléchargement, décodage, contrôle de hash et lecture IndexedDB. La heap WASM est la mémoire linéaire réservée par le moteur, pas la mémoire totale du navigateur. Ce ne sont pas des garanties sur une autre machine. Le segment interne du modèle explique le coût élevé même pour un court extrait.

Autres tests navigateur : annulation d’une séparation et retour à un état relançable. Le test optionnel `npm run test:separation:wasm` exécute le même Worker depuis Node avec de vrais poids, contrôle longueur, finitude et énergie de chaque canal. Il est distinct des tests unitaires avec Workers injectés.

Contrôle complémentaire de segmentation : `npm run test:separation:wasm -- /chemin/htdemucs_6s.ort.gzipped 10` observe les callbacks réels `PROGRESS_UPDATE` à `0.5` et `1`. Le moteur calcule par segments ; le Worker classique restitue seulement le résultat complet. Le nouveau Worker progressif publie séparément les fenêtres décrites ci-dessous. La barre UI réserve les derniers pourcents à la préparation audio et reste monotone sur les quatre spécialistes FT. Le pourcentage n’est pas extrapolé avec un compteur de temps.

## Lecture progressive 6s

Le mode progressif utilise un seul Worker et une seule initialisation du modèle, fenêtres de 5 s et recouvrement de 1 s. Chaque fenêtre non finale publie 4 s, avec fondu commun aux six stems sur le recouvrement retenu. Le dernier bloc publie tout le reste. Aucun échantillon déjà envoyé au lecteur n’est modifié. L’extrait maximal est 60 s ; FT reste à 10 s et attend le résultat complet.

Le test navigateur sur 30 s de CleanChords a montré Play actif avec 8 s disponibles pendant le calcul du troisième bloc. Le traitement complet a pris 60,5 s pour 30 s d’audio (rapport calcul/audio ≈ 2,0), heap WASM 2,32 Gio. Cette mesure inclut le chargement du runtime/modèle dans le Worker, mais exclut la lecture du cache et le décodage. Le premier bloc de 4 s nécessite le calcul d’une fenêtre de 5 s ; le délai exact du premier bloc reste à instrumenter. Un seek à la limite disponible affiche « mise en tampon » et réserve la reprise au prochain bloc. Les tests unitaires vérifient aussi la course entre fin de source et bloc reçu tardivement. Ce test vérifie le pipeline, pas la parité musicale UVR ni le temps réel garanti. Le redémarrage de boucle et la reprise ont une latence planifiée de 30 ms. La dist a aussi été testée : calcul incrémental, mixage guitare conservé entre les blocs, annulation après 28 s publiées et conservation de cet extrait. La suite `npm test` passe 228 tests, dont 12 consacrés au flux progressif.

## Faisabilité WebGPU — premier modèle validé

Backend effectif : ONNX Runtime Web **1.22.0**, WebGPU JSEP sur adaptateur Apple / Metal 3 dans le navigateur intégré. Modèle : `htdemucs_4s_onnx`, conversion de bakkot/demucs-js, révision `45f990170d9571379a9dbd3bbdd1c7591b26864c`, SHA-256 `da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748`. Quatre sources, guitare dans « Autres » ; ce n’est ni FT ni 6s. Poids de 174 263 526 octets, soumis à l’usage personnel/recherche indiqué par ce fournisseur. Les licences sont conservées localement, les poids sont téléchargés et ne sont pas distribués avec le host.

| Extrait CleanChords | Backend | Chargement session | Worker total | Résultat |
|---|---|---:|---:|---|
| 13,65 s, mêmes poids et deux mêmes fenêtres | GPU hybride, profilage actif | 0,790 s | 5,826 s | 3 244 kernels GPU, 8 canaux finis |
| 13,65 s, mêmes poids | CPU/WASM ONNX, 1 thread | 0,690 s | 22,508 s | mêmes longueurs, 8 canaux finis |
| 30 s, lecteur progressif, sans profilage | GPU hybride | 0,774 s | 11,9 s | 5 blocs, 30 s disponibles |

Gain GPU/CPU sur ce test des mêmes poids : environ **3,86×**. Rapport temps de calcul/audio : **0,43** pour le benchmark GPU, **0,40** pour les 30 s du lecteur. Ces temps incluent session et DSP, excluent téléchargement/décodage/vérification du cache. Le premier bloc de 30 s coûte 2,71 s de calcul plus 0,77 s de chargement ; il publie 5,85 s. Les blocs suivants coûtent environ 2,0–2,4 s. Ils laissent donc une avance possible sur cette machine ; ce n’est pas une garantie sur mobile ou une autre machine. La comparaison CPU est monothread, sans COOP/COEP. La mémoire GPU totale n’est pas mesurée ; ne pas lui attribuer la heap de l’ancien moteur WASM.

Écarts GPU/CPU sur les huit canaux : RMS absolu `2,19e-5`, RMS relatif `0,000506` (0,051 %), écart absolu maximal `0,000222`. Seuil du prototype : maximum ≤ 0,005 et RMS relatif ≤ 1 % (ou RMS absolu ≤ 1e-5 pour un signal presque silencieux). Le test passe. Cela vérifie la proximité numérique des backends, pas la qualité de séparation d’un vrai mix ni la parité UVR. CleanChords est une guitare seule, décodée mono puis dupliquée en stéréo ; un test DSP distinct vérifie deux canaux différents.

Pour accélérer les essais, les poids du modèle public ont été téléchargés en ligne de commande puis chargés via un miroir local temporaire dans le gestionnaire ; taille et SHA-256 sont identiques. L’URL publique épinglée est rétablie dans le catalogue et la dist. Le transfert navigateur public a été observé puis annulé à environ 25 % en raison de sa lenteur ; sa fin complète reste à vérifier sur ce réseau. Le calcul et le cache sont testés sur les octets complets vérifiés.

Résultats bruts : [comparaison GPU/CPU](benchmarks/webgpu-2026-10-20.json) et [lecture 30 s](benchmarks/webgpu-30s-2026-10-20.json). Reproduction : ouvrir `webgpu-benchmark.html` après installation du modèle dans le cache de cette origine. Aucun repli n’est autorisé pendant ce diagnostic ; un échec GPU est affiché.

### Validation sur un mix multi-instruments stéréo

Fichier fourni : *Slow Motion Dream*, Steven M Bryant et collaborateurs, CC BY 3.0, repris sans modification depuis une révision épinglée de Spleeter ; [crédits et licence](fixtures/music/NOTICE.md). Durée 10,8805 s, deux canaux distincts à 44,1 kHz. Le diagnostic traite la durée réellement disponible et propose aussi CleanChords. Un bouton du laboratoire prépare les dix premières secondes du mix.

Chrome / Apple Metal 3 / ORT 1.22.0 : GPU **15,85 s**, CPU **71,45 s**, mêmes poids et sans repli ; 3 244 kernels GPU. Calcul/audio : 1,46 sur GPU et 6,57 sur CPU. Écart RMS relatif **0,077 %**, maximum absolu **0,00127**, dans les seuils du prototype. Les huit canaux sont finis, les quatre pistes ont une énergie non nulle et gardent des différences stéréo. Résidu de la somme des stems / mix original : RMS relatif **3,26 %** ; ce résidu ne mesure pas la qualité d’isolation de chaque instrument. La batterie atteint un pic de 1,0014 : une marge de gain reste nécessaire, sans écrêter destructivement les sorties du modèle.

[Résultat brut](benchmarks/webgpu-real-mix-chrome-2026-10-20.json). Le GPU est environ 4,5 fois plus rapide que le CPU dans cet essai mais ne permet pas une lecture continue au rythme du calcul. Les chiffres CleanChords précédents viennent d’un autre contexte navigateur ; aucune cause unique de variation n’est démontrée. Il n’existe pas de stems de référence pour ce fichier : pas de SDR/SI-SDR ni de parité UVR annoncés.

### Correction et essais non aboutis

Le DSP de bakkot soustrayait la taille de FFT d’une longueur explicite de sortie iFFT centrée. Le dernier canal d’une fenêtre complète finissait hors limites (NaN) et les autres canaux pouvaient lire le début du canal suivant. La soustraction s’applique maintenant seulement lorsque la longueur est implicite. Tests : aller-retour FFT stéréo avec longueur explicite/implicite et fenêtre complète Demucs de 343 980 échantillons, finie jusqu’au dernier échantillon. Un signal d’une seconde seul ne révélait pas cette frontière après le recadrage central.

Export 6s StemSplit : révision HF `49df9b6989cf2150840ea65b0bef77a2e471b678`, fichier `htdemucs_6s_fp16weights.onnx`, SHA-256 `7ce55792e2231c93fbf92de95f5fd5b3a5e6c89f7db690dfd693e8f1dce56869`. Le chargement natif ORT CPU aboutit (~3 s, métadonnées seulement). En navigateur : ORT 1.23 WebGPU/asyncify échoue à la création de session (`Aborted()`), ORT 1.22 WebGPU ne termine pas l’initialisation dans la fenêtre d’essai puis est interrompu, ORT 1.22 WASM échoue aussi (`Aborted()`). Cause exacte non établie ; ne pas conclure que WebGPU ou 6s sont impossibles. Aucune sortie 6s GPU n’est annoncée. Ces poids restent uniquement dans le dossier local de recherche ignoré par Git, pas dans le catalogue public ni la dist.

Nouvel essai borné 6s : transformation de 342 tenseurs double en float32 selon [Steminize, révision épinglée](https://github.com/Gerschwin/steminize/blob/22b57d6a9eb0dc93a4a6fdf32dd849edac0aeaf4/src/engine/fixfloat64.ts), optimisation du graphe désactivée. La session WebGPU 1.22 est créée en 8,59 s ; aucune sortie PCM validée n’est revenue avant interruption manuelle après plus de 120 s. Le navigateur intégré est ensuite devenu peu réactif, sans cause isolée démontrée. Cette expérience ne valide ni l’inférence ni la qualité 6s, et ne change pas le catalogue. [Paramètres, hashes et résultat](benchmarks/6s-compatibility-2026-10-20.json).

## Architecture

- `OnnxDemucsRunner` / `onnx-worker.js` : session ONNX persistante par traitement, FFT JS, blocs communs, backend effectif et repli avant premier bloc seulement. `OnnxCoreModel` libère les tenseurs après copie ; `OnnxRuntimeConfig` prépare le runtime et son profilage optionnel. `BackendPolicy` protège les modèles non validés.
- `AudioComparison` / `webgpu-benchmark.*` : comparaison reproductible, sans fallback silencieux.
- `models.json` : versions et hashes de chaque fichier ORT compressé, URL immuables.
- `ModelDownloadManager` / `ModelCache` : téléchargement à la demande, cache atomique, copie des poids transférée au Worker.
- `DemucsRunner` : interface asynchrone, validation, progression, arrêt des Workers.
- `demucs-worker.js` : ABI Emscripten du moteur amont, allocation/libération des buffers et capture des erreurs.
- FT : sortie batterie du spécialiste batterie, basse du spécialiste basse, autre du spécialiste autre, voix du spécialiste voix. Un Worker terminé par spécialiste évite de garder quatre heaps WASM.
- `ChunkTools` : planification et recouvrement ; `progressive-worker.js` : modèle persistant sur tous les blocs ; `ProgressiveDemucsRunner` : validation et publication incrémentale ; `ProgressiveMultitrackEngine` : file de blocs et attente/reprise sur une horloge commune.
- `MultitrackEngine` : AudioContext injecté, sortie non connectée automatiquement, horloge et départ communs, transport, gain/pan par piste. La page possède le routage final.

## Limites et étapes suivantes

1. Comparer avec UVR sur de vrais mix rock, aux mêmes réglages. Les tests CleanChords et mix stéréo vérifient le pipeline et la proximité des backends ; ils ne disposent pas de stems isolés de référence. Pas de parité numérique ou musicale annoncée avec UVR/PyTorch.
2. Étendre le prototype progressif 60 s aux morceaux entiers avec décodage et mémoire bornés, puis comparer musicalement les raccords au traitement complet. Les mobiles ne sont pas validés.
3. Étendre WebGPU à une conversion 6s/FT validée et tester d’autres navigateurs/machines. Le nouveau modèle 4 pistes ne remplace pas ces modèles ; un device détecté ne valide pas une inférence de n’importe quel modèle.
4. Export WAV des stems et remix, boucle A/B, refonte visuelle et intégration dans Tracks.

FT garde la guitare dans « autre », avec éventuellement d’autres instruments ; 6s propose une sortie guitare dédiée. Les choix doivent être comparés musicalement, pas déduits seulement du nombre de stems.

## Références et crédits

- [Demucs original](https://github.com/facebookresearch/demucs) : stems et modèles FT.
- [demucs-wasm épinglé](https://github.com/bengfarrell/demucs-wasm/tree/35c8bd5b74c56f630082058179cd8f57cb192fb2) : runtime et conversions utilisés ; licences dans `vendor/demucs-wasm/`.
- [demucs-onnx](https://github.com/StemSplit/demucs-onnx) : export 6s essayé sans succès navigateur dans cette configuration.
- [bakkot/demucs-js](https://github.com/bakkot/demucs-js/tree/45f990170d9571379a9dbd3bbdd1c7591b26864c) : noyau ONNX quatre sources et DSP utilisés, avec correction locale documentée.
- [ONNX Runtime WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html) : backend explicitement sélectionné ; le build 1.22.0 est conservé avec ses hashes et licence.

Validation finale : `npm test` inclut 251 tests, dont 17 tests WebGPU/DSP et six tests de validation du mix multi-instruments. Distribution reconstruite et testée sous HTTP : choix du modèle GPU, réutilisation du cache, 30 s de calcul progressif, Play actif à 41 % avec 11,7 s disponibles, puis fin des quatre pistes.

Dernière vérification de la dist sous Chrome : bouton « Utiliser un mix multi-instruments (10 s) », quatre pistes prêtes en **5,4 s**, lecture démarrée puis arrêtée. [Mesures de cet essai](benchmarks/webgpu-real-mix-dist-2026-10-20.json). Le diagnostic GPU/CPU active aussi le profilage ; ses durées ne sont pas directement celles du lecteur sans profilage. Ces résultats montrent la variabilité et ne garantissent pas le débit sur une autre machine.

## Lecteur compact — P1 terminé

WaveSurfer 7.12.4, renderer seul, BSD-3-Clause, livraison locale avec hashes. Les peaks des deux canaux sont calculés sur la durée totale, avec zone future vide pendant le calcul progressif. Chaque piste garde sa couleur et son curseur, piloté par la même position du moteur existant. Le viewport et la règle sont partagés ; le mixeur reste fixe à gauche. Les changements de mix/zoom et les blocs ne recréent pas les contrôles. Aucun élément média ni nouveau contexte audio n’est instancié pour les waveforms.

Dix tests supplémentaires : 261 tests réussis au total. Chrome : quatre stems du mix de 10 s, calcul GPU 5,8 s, lignes de 56 px, zoom 200 %, volume 99 % conservé après les blocs ; lecture et arrêt vérifiés. Le responsive prévoit 88 px sous 700 px ; la validation mobile audio reste à faire. La vue mix unique, la transition depuis l’original, les régions et la normalisation audio restent les étapes P2–P4.

## Workflow original → instruments — P2 terminé

`SeparationWorkflow` garde les buffers et mix des deux vues. Le moteur candidat reste déconnecté pendant le calcul, dans le même contexte audio. La bascule arrête les voix et déconnecte la route précédente avant de connecter la suivante ; elle garde la position courante et l’intention de lecture, avec la latence de démarrage de 30 ms déjà connue. Un résultat plus court que la position écoutée n’impose aucun retour au début ; la sélection de l’extrait est explicite. Le transport de l’original reste accessible pendant le calcul CPU classique aussi.

Échec/annulation avant le premier bloc : aucune voix originale interrompue. Après bascule : retour à l’original, stems partiels disponibles explicitement. Un retour manuel empêche les nouveaux blocs de voler la lecture. Les treize nouveaux tests couvrent aussi les reprises audio différées et les remplacements de session. Total : 274 tests.

Vérification Chrome sur le mix fourni : original complet de 10,88 s prêt avant séparation, calcul WebGPU 10 s en 5,2 s, bascule avec lecture conservée, volume 99 % et zoom 200 %. Annulation vérifiée avec original toujours accessible. Un second essai à la position 10,88 s conserve cette position et une seule waveform après calcul de l’extrait de 10 s ; sa lecture depuis le début exige le bouton explicite. Correction associée : un seek à la fin, en pause avec boucle, affiche maintenant la fin au lieu de zéro.

Cette étape est livrée dans l’URL de laboratoire ; l’intégration dans le host principal reste P4 ; la vue du remix réduit P3 est maintenant livrée.

## Mix réduit — P3 terminé

`MixWaveform.js` somme le PCM des stems après gain et matrice StereoPannerNode, puis extrait les pics absolus des deux canaux. Le gain commun est inclus, sans normalisation audio ni écrêtage du PCM. Le calcul lit les buffers existants ; il alloue seulement des peaks et métadonnées, cède régulièrement le thread principal et accepte l’annulation. `MixWaveformJob` empêche toute publication d’un résultat périmé. La représentation correspond au mix cible stabilisé ; elle ne reproduit pas les rampes de gain de 10 ms.

`CompactMultitrackView` masque les instruments et ajoute un renderer WaveSurfer inerte pour le mix. Aucun nouvel AudioContext, élément média ou BufferSource. Transport, sources et voix restent les mêmes. Les commandes des stems restent en mémoire ; mode, réglages, zoom et scroll sont préservés. Les blocs progressifs gardent leurs positions sur la durée totale ; le seek reste limité à la zone publiée. Changement de source ou de vue : annulation du calcul en cours.

Validation : 290 tests au total, soit seize tests supplémentaires pour P3. Comparaison avec OfflineAudioContext natif dans Chrome : 20 cas (mono/stéréo, pan -1/-0,5/0/0,5/1, mute), écart maximal 7,450580596923828e-9. [Données](benchmarks/mix-waveform-native-2026-10-20.json), reproduction via `tests/phase6/browser/mix-waveform-reference.html` hors dist. Essai réel sur 30 s : vue réduite sélectionnée avec 5,8 s disponibles, lecture pendant le calcul avec 23,4 s disponibles, une seule waveform visible. Zoom 200 %, volume 1 % et pan -1 % restaurés après aller-retour sur la démo. Normalisation, régions A/B et parité host : P4.

## P4.1 — bus global et routage

`SeparationMixer` réutilise `BackingTrackMix` avec un adaptateur de transport et de réglages. Les sources original/stems aboutissent au même bus backing ; la guitare aboutit au bus post-rack prévu par le host. Une seule route finale vers la destination. Volume/mute backing, balance, pan guitare et mesure de sortie sont accessibles dans le laboratoire. La waveform réduite inclut le gain global et la balance backing ; la guitare reste un signal séparé. La vraie insertion dans Tracks reste P4.4.

Tests : routage et destruction, état global indépendant de la session, validation atomique des réglages, politique de balance identique au host pendant lecture/pause, panoramique, abonnements périmés supprimés, changement original/stems sans connexion directe supplémentaire à la destination. Test navigateur : guitare de test audible et mesurée avec backing muté, commandes et transport indépendants.

Le diagnostic 6s a produit douze canaux GPU finis après extraction du réseau (3658 nœuds au lieu de 24819), mais la comparaison réelle échoue au seuil numérique : 7,317 % RMS. Le spectrogramme CPU ne corrige pas la dérive, alors que réseau CPU + reconstruction JS est à 0,00598 %. Ne pas présenter ce contournement comme un backend validé. Voir `SIX_STEMS_GPU.md` et les nouvelles mesures. La précision réseau et le coût de reconstruction restent à résoudre avant intégration du cache/runner. Total de la suite : 299 tests.

### P4.2 — GPU par défaut et boucle A/B

Recommandation automatique du modèle ONNX 4 pistes lorsque WebGPU est détecté ; CPU explicite et repli conservés. Tests natifs et progressifs : boucles stéréo sur une frontière de blocs, horloge commune, attente de B, annulation partielle, édition invalide atomique, reset, transfert de région et gestes des poignées. La fenêtre progressive est copiée uniquement pour la région sélectionnée, puis bouclée nativement (coût PCM additionnel proportionnel à la durée A/B, deux canaux par piste). Le premier retour lorsque B arrive en cours de lecture conserve la latence planifiée de 30 ms. Suite complète : 306 tests réussis.

### P4.3 — Normalisation réversible sur multitracks

Pic de la somme PCM stéréo calculé avec le même pan que Web Audio ; analyse asynchrone coopérative sans copie du PCM. Gain commun sur un nœud distinct avant le volume global ; aucune réinitialisation des voix, de l’horloge ou des gains des stems. Cibles −1/−3/−6 dBFS, boost +24 dB maximum, seuil de silence 1e−8. Les réglages de mix invalident la correction ; annulation, remplacement et résultats tardifs sont testés. Les résultats restent par deck, pas copiés entre original et séparation. Normalisation de pics échantillonnés uniquement, pas de protection true peak/LUFS ou de saturation lorsque le master ou la guitare s’ajoutent après. Diagnostic natif : six cas, erreur maximale 8,94e−8. Total suite 318 tests.

### 21 octobre — P4.4 : Tracks et état

Le contrôleur du prototype est montable dans un root DOM et accepte le contexte et la sortie de rack fournis par le host. `MultitrackPlayerElement` réutilise son template local sans exécuter les scripts HTML. Les réglages sont JSON v2 ; le PCM reste dans un autre store IndexedDB, publié atomiquement. Un snapshot complet copie le PCM dans IndexedDB : coût de stockage proportionnel à la durée originale, pas à la seule durée séparée. Pas d’autosave du PCM ni de sauvegarde serveur. Vérification réelle Chrome d’une originale de 324,9 s + quatre stems de 5 s : restauration des buffers et paramètres après reload, sans lecture. Onze tests de codec/cache/état ajoutés (329 total). Un test natif rack/backing sur le même contexte, après restauration des deux decks, montre 4,86e−9 d’écart maximum aux trois balances. La guitare synthétique de ce diagnostic représente une sortie de rack connue ; elle ne prétend pas valider le DSP NAM lui-même.

## Morceau entier (22 octobre 2026)

Le choix par défaut est désormais le morceau entier. Dans Chrome, ONNX WebGPU a séparé les 214,9 s de « Are You Gonna Be My Girl - Jet » en quatre stems complets en 75,9 s de calcul Worker, puis sauvegardé le projet localement. Lecture restée en pause, aucune erreur console. [Compte rendu](benchmarks/full-song-browser-2026-10-22.json). Les plafonds historiques 10/60 s sont retirés ; le DSP travaille par fenêtres mais les stems sont conservés en RAM. Les chemins CPU acceptent les morceaux entiers ; leur qualité et performance sur un morceau long restent à mesurer réellement.

## Nouveaux modèles et retrait du découpage manuel (P4.8)

Le host impose désormais Auto et ignore les anciennes tailles manuelles enregistrées ; le choix entier/extrait est conservé. [MODEL_CANDIDATES.md](MODEL_CANDIDATES.md) distingue le contrat Demucs 7,8 s de la capacité générale d’ONNX à exporter d’autres longueurs. L’étude des huit familles identifie un export WebGPU tiers de BS Roformer SW comme premier candidat de portage, sans le déclarer validé dans le host. Les modèles étudiés sont présentés dans Settings séparément des moteurs exécutables.

## Exports courts et premier Play (P4.10)

Faisabilité démontrée après préparation sur signal nul, sans pré-calcul du morceau : un export réel2s publie1s et rend Play disponible en768–951ms sur cette machine. Quatre sources stéréo validées contre PyTorch court, max3,02e−6 ; aucune sous-alimentation pendant le test6s. Nouvelles sessions avec chauffe : délai supérieur à1s. La différence au rendu7,8s reste importante et doit être distinguée d’une erreur d’export. [Protocole et données](LOW_LATENCY.md). La chaîne de production reste en Auto, avec la correction de padding FFT issue de cette validation.

### P4.11 — Aperçu rapide intégré (22 octobre 2026)

Le catalogue exécutable contient désormais un quatrième modèle : `htdemucs_4s_preview`, vrai export 2 s et publication par seconde, préparé sur silence avec session persistante. Qualité reste le défaut. Download/cache/hash, morceau entier, sauvegarde/restauration et export MP3 sont intégrés au lecteur du host. Validation réelle : premier bloc 0,643 s en autonome / 0,803 s dans le host sur 10 s ; 1,114 s sur 214,9 s, séparées en 115,1 s. CPU/WASM vérifié dans la dist sur 1 s : 2,324 s, donc pas une garantie temps réel. 363 tests verts. [Détails et limites](LOW_LATENCY.md).

BS Roformer SW reste hors du menu exécutable : sources et poids épinglés, référence de spectrogramme CPU validée sur six sources ; adaptateur DSP navigateur et WebGPU à faire. [Priorités et audit](MODEL_CANDIDATES.md).

### P4.9 — SW six sources porté

BS Roformer SW est maintenant le cinquième modèle exécutable, avec adaptateur DSP dédié et comparaison audio douze canaux CPU/WebGPU réussie. Téléchargement/cache, préparation, lecture six pistes, MP3 vers Tracks et sauvegarde du morceau entier testés. GPU : 214,9 s en 228,32 s, premier bloc3,19s ; CPU/WASM : 4s en34,68s. Pas de garantie de streaming temps réel. 371 tests réussis. [Protocole, limites et provenance](ROFORMER_VALIDATION.md). MDX-Net Inst HQ4/5 est la priorité suivante.
