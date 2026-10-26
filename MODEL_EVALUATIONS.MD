> Résultat natif reçu le26octobre2026 : voir§24.7. Les trois préférences WebNN ont exécuté un dispatch, mais échouent au seuil strict sur la basse. Les passages décrits plus haut comme bloqués sont antérieurs à cet essai manuel Canary.

> Intégration Studio — 26 octobre 2026 : les sections1–23 ci-dessous sont reprises sans modification depuis la branche de recherche `multitracks`, commit `467f07f6114fe59e48b3f3a43957fbe8f6ad5b2a`. Elles décrivent des expériences historiques, pas des essais répétés dans cette branche. La qualification Studio actuelle est ajoutée en§24 ; elle reste incomplète tant que Canary n’est pas accessible.

> Campagne W4 ajoutée : voir §23 pour les12configurations WASM/WebGPU/WebNN CPU/GPU/NPU, leurs33séparations complètes et les limites des reprises.

> Mise à jour du 25 octobre 2026 : voir §22 pour le choix CPU/GPU/NPU et son contrôle, §21 pour le runtime/audit et la parité audio Demucs4 WebNN, §19–20 pour le banc d’écoute et le diagnostic WebNN Canary, §18 pour la campagne G1 sur stems GHA assignés, §17 pour la sélection GHA/Rock Band et §16 pour Y1 (import réel), S1/S2 (SCNet natif et navigateur), M1 (MDX Extra Q natif), et leurs limites. Les campagnes antérieures conservent leurs effectifs.

# MODEL EVALUATIONS — Séparation musicale locale dans un hôte Web Audio

**Document de travail scientifique évolutif — version 0.10, 25 octobre 2026 (Europe/Paris).**

Destination : préparation d’un article pour une prochaine Web Audio Conference. Ni soumission ni date de conférence ne sont présumées. La synthèse initiale (v0.1) réunit les campagnes du 20 au 23 octobre2026, sans nouvelle mesure pendant sa rédaction. La v0.2 ajoute le24octobre deux contrôles techniques du nouvel outillage sur signaux synthétiques, sans nouvelle campagne indépendante ni observation humaine.

## 1. Périmètre, provenance et niveau de preuve

Le projet NAM A2 WAM explore une séparation de musique exécutée localement dans le navigateur, intégrée à un lecteur multipiste pour guitaristes et bassistes. Le cas d’usage est de retirer ou isoler guitare/basse, lire les sources pendant le calcul, remixer et exporter un accompagnement. Les modèles sont préentraînés ; ce projet ne les réentraîne pas.

L’unité évaluée est une **configuration de bout en bout** : checkpoint, conversion, précision, runtime/backend, pré/post-traitement, contexte et raccords. Les résultats ne comparent pas les seules architectures neuronales. Une configuration navigateur nommée Demucs ou SW n’est pas assimilée sans preuve à l’exécution du même modèle dans Ultimate Vocal Remover (UVR).

Quatre questions guident les expériences :

1. **Parité numérique** : la conversion et le DSP reproduisent-ils une référence CPU/PyTorch pour les mêmes entrées, poids et fenêtres ?
2. **Performances interactives** : combien de temps avant le premier bloc réellement disponible, puis avant la fin du traitement ? L’interface reste-t-elle réactive ?
3. **Fidélité instrumentale objective** : les sorties ressemblent-elles aux pistes originales connues, et améliorent-elles le mix non séparé ?
4. **Utilité perceptuelle** : attaques, repisse, timbre, basses et artefacts permettent-ils une utilisation musicale ? **Ce quatrième volet n’a pas encore fait l’objet d’une étude d’écoute humaine documentée.**

Une parité numérique, un résidu de remix faible, un test logiciel réussi et une préférence d’écoute constituent des preuves différentes. Ils ne se substituent pas les uns aux autres.

### 1.1 Snapshot logiciel auditable

Les résultats récents se trouvent dans la branche `multitracks`, révision **`b10dd146a082fcf79f21e96fb31787d1589eea1f`**, et non dans l’état courant de `main` au moment de cette rédaction. Les liens de ce document pointent vers ce commit immuable pour éviter d’attribuer des mesures anciennes à du code ultérieurement modifié. Sources : [catalogue des modèles](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/models.json), [banc de temps](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/ModelBenchmark.js), [recette et métriques](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/InstrumentQuality.js), [validation des références](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/RealInstrumentCorpus.js). La mise à jour actuelle est réalisée dans le checkout principal sur `multitracks`, sans fusion ni changement de branche. Les empreintes du code non committé de G1 sont ajoutées en§18.

Ce commit identifie le snapshot d’archivage consulté, pas une attestation que chaque campagne historique a été exécutée exactement à ce commit. Les JSON ne consignent pas tous le commit du code au moment de l’exécution ; cette lacune de traçabilité doit être corrigée dans les prochaines campagnes. Les versions/hashes des poids et les protocoles consignés restent disponibles.

Les JSON bruts sont l’autorité pour les valeurs non arrondies. Les tableaux ci-dessous sont recalculés depuis ces JSON, arrondis à deux décimales. **Les lignes marquées « prévu » décrivent un protocole futur, pas une expérience déjà menée.**

### 1.2 Registre des campagnes

| ID | Date | But | Unité et volume | Statut |
| --- | --- | --- | --- | --- |
| N1 | 20/10/2026 | Diagnostic Demucs 6 GPU | Synthèse puis mix musical, 12 canaux | Écart musical hors seuil ; configuration GPU rejetée |
| N2 | 22/10/2026 | Parité exports courts et SW | Références CPU/PyTorch, mêmes contextes | Acceptée sur les signaux testés |
| L1 | 22/10/2026 | Latence avec modèle préparé | Exports courts 1/2 s, extrait musical 6 s | Preuve locale de faisabilité, pas une garantie universelle |
| U1 | 22/10/2026 | Réactivité et découpage GPU coopératif | Même mix 6 s, cinq plans SW ; essais host longs | Diagnostic système, séries non statistiques |
| T1 | 23/10/2026 | Comparaison de temps | 8 configurations × 2 essais = **16 exécutions** | Complète ; visibilité non journalisée |
| T1b | 23/10/2026 | Contrôle au premier plan | Qualité 4 CPU/GPU × 2 = **4 exécutions** | Série distincte, visibilité contrôlée |
| Q1 | 23/10/2026 | Pilote à références connues | 3 mélanges × 5 configurations = **15 séparations** | Guitare enregistrée, basse/batterie synthétiques |
| Q2 | 23/10/2026 | Références entièrement enregistrées | 6 clips × 4 configurations = **24 séparations** | 3 compositions basse, 1 composition guitare |
| Q3 | 23/10/2026 | Extension guitare multi-styles | 3 compositions × 4 configurations = **12 séparations** | MUSDB **train**, diagnostic uniquement |
| R1 | 24/10/2026 | Contrôle du banc de références locales/revue anonyme | Deux exécutions SWGPU du même signal technique1s | Logiciel vérifié ; **zéro note humaine**, pas de validation musicale |
| G1 | 25/10/2026 | Récupération de stems assignés GHA | 6 fenêtres / 3 compositions × 2 configurations = **12 séparations** | Automatique terminée ; pureté et exposition inconnues, aucune note humaine |
| G2 | 25/10/2026 | Contrôle du workflow d’écoute | 2 répétitions du même cas G1 | Références transférées, vue aveugle prête ; zéro note humaine |
| W1 | 25/10/2026 | Diagnostic WebNN natif | 8 graphes Canary, 8 observations Chrome absent | Matmul synthétique seulement ; processeur effectif inconnu |
| W2 | 25/10/2026 | Demucs4 / ORT1.30 WebNN | 15 exécutions (9 musicales,6 synthétiques),3 entrées | PCM valide, global sous seuil ; garde faible niveau encore en validation |
| W3 | 25/10/2026 | Préférence NPU du vrai modèle | 3 répétitions musicales Falcon (2 contrôles + 1 WebNN) | Sélection mémorisée, parité réussie, processeur effectif inconnu |
| P1 | À réaliser | Étude perceptuelle et corpus plus indépendant | Plan à pré-enregistrer | Non réalisé |

Q1–Q3 représentent **51 séparations réussies**, et non 51 morceaux indépendants. Q1 donne deux scores instrumentaux par séparation (guitare et basse), Q2/Q3 un : **66 évaluations cible**, chacune accompagnée de métriques du backing. Ce décompte n’inclut ni les répétitions de T1/T1b ni les essais de parité. Les répétitions temporelles ne sont pas des réplications indépendantes de qualité musicale.

## 2. Système et conditions expérimentales

Le pipeline sépare une préparation (accès au cache vérifié, initialisation, compilation/préchauffage si prévu), l’inférence par fenêtres et la reconstruction/publication des sources. Les calculs et le DSP sont confiés à des Workers. Un hôte Web Audio commun assure la lecture synchronisée des stems ; les transferts progressifs utilisent notamment `ringbuf.js` dans l’intégration. Cela réduit les copies et publications coûteuses, mais ne supprime pas une contention GPU ni toutes les tâches du thread principal.

Les comparaisons de temps exécutent les configurations successivement, sans repli silencieux GPU→CPU. Tous les canaux doivent être finis, correctement ordonnés, de longueur exacte et couvrir la fin de l’extrait. Un échec reste un échec ; un modèle absent n’est pas assimilé à un modèle lent ou de mauvaise qualité.

| Élément | Ce qui est effectivement établi dans les archives |
| --- | --- |
| Navigateur des campagnes du 23/10 | Chrome 154, User-Agent conservé dans les JSON |
| Plateforme déclarée par l’UA | `Macintosh; Intel Mac OS X 10_15_7` ; **ne prouve ni le CPU physique ni la version réelle de macOS** |
| GPU | WebGPU détecté ; identité matérielle détaillée non journalisée dans T1/Q1–Q3 |
| Runtime ONNX Web | Version 1.22.0 pour les chemins ONNX documentés ; ne pas attribuer cette version au binaire WASM tiers sans vérification |
| CPU ONNX du host | Monothread dans la configuration testée ; le diagnostic natif N1 utilise séparément ORT 1.23.1/deux threads |
| Audio d’entrée/score | Stéréo 44,1 kHz ; 264600 frames par canal pour les comparaisons 6 s |
| Lecture host | Certains essais d’intégration utilisent AudioContext 48 kHz avec sources 44,1 kHz ; à distinguer des mesures de calcul |
| Cache | Poids déjà disponibles ; caches navigateur/driver conservés ; nouvelle session ≠ démarrage matériel réellement froid |
| Isolement | `isolated:true` dans le rapport ne prouve pas une machine sans autres charges ; aucune isolation système contrôlée documentée |
| Matériel, RAM, alimentation, thermique | Informations historiques insuffisantes ; **ne pas les reconstruire à partir de la machine actuelle** |
| Mémoire/énergie | Pas de mesure systématique du pic mémoire, de puissance ou d’énergie par séparation |

Le matériel manquant empêche de publier ces temps comme un benchmark matériel reproductible complet. Pour l’article, conserver ces observations comme étude de cas exploratoire et compléter la fiche machine avant une campagne confirmatoire.

## 3. Modèles et variantes réellement exécutés

HT Demucs combine des chemins temporel et spectral avec un Transformer ; BS-RoFormer traite des représentations par bandes spectrales. Les articles de référence décrivent les familles, **pas la provenance exacte ni l’entraînement du checkpoint SW réhébergé**. Voir [Rouard et al.](https://arxiv.org/abs/2211.08553) et [Lu et al.](https://arxiv.org/abs/2309.02612).

| ID du catalogue | Variante | Sources | Backends exécutables | Particularités de l’évaluation |
| --- | --- | --- | --- | --- |
| `htdemucs_6s` | Demucs 6 via ORT/WASM tiers | Drums, bass, other, vocals, guitar, piano | CPU/WASM | Guitare dédiée ; conversion GPU diagnostique distincte rejetée |
| `htdemucs_ft` | Quatre spécialistes FT | Drums, bass, other, vocals | CPU/WASM | Spécialistes successifs ; coût total élevé ; guitare dans Other |
| `htdemucs_4s_onnx` | « Qualité 4 », export demucs-js | Drums, bass, other, vocals | WebGPU et CPU/WASM | Contexte neuronal 7,8 s ; `4s` signifie ici **quatre stems**, pas 4 secondes |
| `htdemucs_4s_preview` | « Aperçu 4 », export court local | Idem | WebGPU et CPU/WASM | Contexte 2 s, publication 1 s ; checkpoint `955717e8-8726e21a.th`, Demucs 4.0.1 |
| `bs_roformer_sw_6s` | SW 6, export ONNX à poids FP16 | Bass, drums, other, vocals, guitar, piano | WebGPU et CPU/WASM | Contexte 4 s, overlap 1 s, publication 3 s ; `6s` signifie six stems |

Aperçu et Qualité ne diffèrent pas uniquement par le nombre de paquets transmis. L’export court change le contexte réellement vu par le réseau et provient de son propre artefact/version. Une expérience attribuant la totalité d’un écart au seul backend ou à la seule architecture serait confondue par ces différences.

Le SW validé est stocké en FP16 ; les validations documentent des calculs FP32 sur un device sans `shader-f16`. Cela ne permet pas d’affirmer que toute exécution ultérieure adopte automatiquement les mêmes kernels/précisions. Le chemin WebGPU est hybride : FFT JavaScript et certains opérateurs CPU peuvent subsister.

Sur GPU, le réseau SW de production est découpé en 18 étapes (plan 400 nœuds), avec attente de fin de file et cession du Worker 4 ms entre étapes. Ce mécanisme vise la réactivité ; il n’est ni une parallélisation de toutes les fenêtres ni une modification des poids.

### 3.1 Empreintes des artefacts du catalogue

Les tailles désignent les fichiers référencés, parfois compressés ; elles ne mesurent pas la RAM ou la VRAM résidente.

| Modèle / fichier | Taille (octets) | SHA-256 |
| --- | ---: | --- |
| Demucs 6 / htdemucs_6s.ort.gzipped | 40603166 | `57ae738153b5873c8b2fa1cfe291a38f3e08d2679ad83e7138adb2b5503bd03e` |
| Demucs FT 4 / htdemucs_ft_drums.ort.gzipped | 54471753 | `224d5043faf8a900d6239e18515bbb0bed83ed3b5606a5b150f716bf32406964` |
| Demucs FT 4 / htdemucs_ft_bass.ort.gzipped | 54464604 | `b8923e06a7ba021eac9ece46ca11e0f62586e95439444d3165cf7b11af10510c` |
| Demucs FT 4 / htdemucs_ft_other.ort.gzipped | 54464633 | `8e9d687904b803650715bf2d1006efa99c430af59c5d361c10faa9853cf54392` |
| Demucs FT 4 / htdemucs_ft_vocals.ort.gzipped | 54473534 | `02c096d83f17c1d09ffcfd1bbe560017ae46469b2666d58030cecb737b1f5fcf` |
| Demucs Qualité 4 / htdemucs.onnx | 174263526 | `da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748` |
| Demucs Aperçu 4 / htdemucs-2s-core.onnx | 170041680 | `a7cb52498bd8b0fd6e61eaecafb12f2651ad995d9b49553caa8705c9d9367c93` |
| BS Roformer SW 6 / bs_roformer_sw_6stem_fp16.onnx | 352778874 | `d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444` |

Révisions et URL amont complètes : [models.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/models.json). Demucs 6/FT : `35c8bd5b74c56f630082058179cd8f57cb192fb2` ; Qualité 4 : `45f990170d9571379a9dbd3bbdd1c7591b26864c` ; Aperçu 4 : `short-2s-v1` ; SW : `a744f80957374e1735ad70fa122670b7961da8cc`.

### 3.2 Droits et diffusion

Les licences du code, de la conversion et des poids sont distinctes. Le catalogue relève des restrictions personnel/recherche pour les poids Qualité 4 ; le réhébergement SW ne clarifie pas indépendamment les droits du checkpoint original. Ne pas déduire de la licence MIT d’un wrapper une permission générale de redistribuer ses poids. Conserver les notices exactes dans tout supplément de reproductibilité. Aucun nouvel avis juridique ni droit supplémentaire n’est établi par cette synthèse.

## 4. Fichiers audio et construction des références

### 4.1 Corpus T — mélange musical pour temps et parité

*Slow Motion Dream*, Steven M Bryant (2011), avec CSoul, Alex Beroza et Robert Siekawitch. MP3 de 262867 octets copié sans modification de l’exemple Deezer/Spleeter, révision `c8854001ac8acad34a9bc2bd15f28475541828b1` ; CC BY 3.0. SHA-256 : `4b431d535d235bd81b62f816f08c3f1afb6679d2706d84b3b75903b7df909507`.

T1/T1b utilisent les six premières secondes décodées, stéréo 44,1 kHz. N1 utilise les 343980 premières frames, soit 7,8 s. **Aucun stem studio de référence n’est fourni avec ce fichier** : il convient aux tests de temps, de reconstruction et de parité entre implémentations, pas à un SI-SDR de séparation. Les occurrences de ce même fichier dans plusieurs expériences ne constituent pas plusieurs compositions.

Attribution et source exactes : [fixtures/music/NOTICE.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/fixtures/music/NOTICE.md), [fixtures/music/slow-motion-dream.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/fixtures/music/slow-motion-dream.json).

### 4.2 Corpus Q1 — mélanges contrôlés avec basse/batterie synthétiques

Chaque entrée dure 6 s. La guitare est un enregistrement existant du projet ; seule la version « driven » applique une saturation analytique `tanh(3x)`. Ce dernier cas n’est pas une nouvelle prise d’ampli saturé.

| Cas | Fichier guitare source | Traitement avant mélange | Graine | SHA-256 du fichier compressé |
| --- | --- | --- | ---: | --- |
| `clean` | CleanChords.mp3 | Mise à RMS 0,08 | 1234 | `c47db7c8d34099bc1a9ea9d591204f0a14e21f6728223ae23c0852396044d420` |
| `acoustic` | FolkAcousticDI.mp3 | Mise à RMS 0,08 | 2345 | `03f78e241c48fe7eb2d7d2bae5ee2a17505e2c313d2f76a9a666f1de91ecc3cf` |
| `driven` | ClassicRockRiff.mp3 | `tanh(3x)`, puis RMS 0,08 | 3456 | `bc2d3783196375aa948758cff7792780e1543723da765b24149d38467404b6d9` |

Basse : séquence `[55,55,65.4064,73.4162,55,82.4069,73.4162,65.4064]`Hz, notes de 0,375 s ; fondamentale plus harmoniques 2/3 de poids 0,35/0,16, attaque 8 ms et décroissance exponentielle ; RMS 0,07. Batterie : kick sinusoïdal à décroissance/fréquence évolutives, bruit déterministe pour caisse claire et charleston, RMS 0,055 ; canal droit légèrement différent. Le générateur pseudo-aléatoire utilise les graines du tableau.

Les RMS sont calculés sur les deux canaux ensemble. Après construction des sources, un seul gain commun éventuel limite le pic du mix à 0,9 ; les références subissent le même gain. Pas de voix ni de piano. Dans cette recette uniquement, Other peut être évalué comme guitare. Les sources s’additionnent au mix à l’arrondi Float32 près.

Le hash MP3 fixe le fichier compressé, pas exactement le PCM décodé sur tous les navigateurs. Au sein d’une campagne, le mix est construit une seule fois par cas et le même PCM est transmis à tous les moteurs. La provenance complète des prises, artistes et droits des actifs historiques reste à compléter avant une éventuelle redistribution scientifique.

### 4.3 Corpus Q2 — basse réelle et voix/guitares de Rainfall

Tous les fichiers préparés sont des WAV stéréo 44,1 kHz, flottant 32 bits,264600 frames par canal (6 s), sans normalisation individuelle. Un cas possède `mix.wav`, `reference.wav`, `backing.wav`. Le mix est reconstruit à partir des mêmes références décodées pour ne pas prendre pour erreur de modèle l’encodage séparé du mix artistique AAC.

| ID | Composition et source | Cible | Fenêtre | Statut et diversité |
| --- | --- | --- | --- | --- |
| `musdb-falcon` | The Easton Ellises — Falcon 69 ; pop/rock | Basse, flux 2 | 0–6 s du **preview 7 s** | MUSDB test ; composition 1 basse |
| `musdb-reggae` | Arise — Run Run Run ; reggae | Basse, flux 2 | Idem | MUSDB test ; composition 2 basse |
| `musdb-metal` | We Fell From The Sky — Not You ; metal | Basse, flux 2 | Idem | MUSDB test ; composition 3 basse |
| `medley-rainfall-20` | Liz Nelson & Jennifer Davies — Rainfall | Somme des deux guitares | 20–26 s du morceau complet | MedleyDB sample ; composition 1 guitare |
| `medley-rainfall-65` | Même morceau | Idem | 65–71 s | Même composition |
| `medley-rainfall-120` | Même morceau | Idem | 120–126 s | Même composition |

L’origine temporelle des previews MUSDB n’est pas documentée par ces extraits : «0–6 s» ne signifie pas nécessairement les six premières secondes du morceau complet.

MUSDB : le flux 0 (mix encodé indépendamment) est ignoré ; flux 1=drums,2=bass,3=other,4=vocals. La basse de référence est le flux 2, le backing 1+3+4. Le gain commun Falcon est 0,9972442584969263 ; reggae/metal 1. Le format AAC du preview et sa bande passante diffèrent d’une évaluation sur MUSDB-HQ ; aucune équivalence de benchmark n’est présumée.

Rainfall : métadonnées `has_bleed: no`, trois voix et deux guitares (acoustique et électrique claire). Coefficients de mixage officiels, dans l’ordre des stems 1–5 : `0.6354871509502455`, `0.12610504621272442`, `0.0624147327727016`, `0.8433924607944484`, `0.29222231756693756`. Cible=stems 4+5 pondérés ; backing=stems 1+2+3 pondérés ; gain commun 1. Other est un proxy acceptable ici car aucun autre instrument instrumental n’est déclaré. L’absence de repisse est une **annotation**, pas un résultat de notre écoute humaine.

Phoenix_ScotchMorris du sample MedleyDB a été exclu : repisse déclarée, flûte/violon et micros d’ensemble rendent une référence guitare stricte ambiguë. Rainfall est absent de l’archive MUSDB preview examinée, mais son absence des entraînements effectifs n’est pas démontrée. Le split MUSDB test ne garantit pas non plus l’absence de ces trois morceaux de tous les entraînements tiers.

Q2 apporte **trois compositions basse et une composition guitare**, pas six compositions indépendantes.

### 4.4 Corpus Q3 — diagnostic guitare sur MUSDB train

| ID | Composition | Instrumentation utile | Fenêtre | Statut |
| --- | --- | --- | --- | --- |
| `guitar-country` | Music Delta — Country1 | Deux guitares acoustiques ; basse/batterie/chant | 0–6 s du preview | **MUSDB train** |
| `guitar-grunge` | Music Delta — Grunge | Deux guitares électriques saturées ; basse/batterie/chant | Idem | **MUSDB train** |
| `guitar-meaxic` | Meaxic — Take A Step | Guitare claire et saturée ; basse/batterie/voix | Idem | **MUSDB train** |

Les trois compositions proviennent de deux artistes/projets. Le flux 3 Other est la cible guitare ; backing=1+2+4, gain commun 1. Inventaire instrumental et `has_bleed: no` vérifiés dans les métadonnées officielles MedleyDB, empreintes épinglées. SweetLights et TheSoSoGlos ont été exclus de cette sélection : autres instruments/effets dans Other.

Ces morceaux ne sont **pas un jeu de test indépendant**. L’appartenance à MUSDB train est connue ; l’exposition de chaque checkpoint exact à chaque morceau reste à auditer. Ils servent à diagnostiquer des styles et le pipeline, sans entrer dans le conseil de qualité Settings. Q2 et Q3 ne sont pas agrégés pour produire un classement général guitare.

### 4.5 Archives, intégrité et droits

| Entrée | Taille / contrôle | SHA-256 |
| --- | --- | --- |
| [musdb](https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip) | 147209385 octets ; MD 5 fournisseur vérifié | `365f66acffc57282e474a4c24b32afec3678258c50b8d45646ac849b0a287df3` |
| [medley](https://zenodo.org/record/1438309/files/MedleyDB_Sample.tar.gz?download=1) | 415502011 octets ; MD 5 Zenodo vérifié | `603fa6cc6fc8d6dd0f5ffcc5bd97b8b2c74820e2498b1e44a285308e772d7910` |
| [coefficients](https://raw.githubusercontent.com/marl/medleydb/master/medleydb/resources/mixing_coefficients.yaml) | Coefficients officiels MedleyDB | `6a3d737e26cfc05c117212261ff4bb69e71e7b64ca10d217e953969706925c83` |
| [licenses](https://raw.githubusercontent.com/sigsep/website/master/content/datasets/assets/tracklist.csv) | CSV officiel des droits par titre | `5e0a9252774412be23971ebfb7d384c0b2f29842eed2fa16aab69cf825b332b1` |

MUSDB Falcon est indiqué CC BY-NC-SA 3.0 ; Arise et We Fell From The Sky sont indiqués «Restricted» dans la liste, avec conditions académiques du corpus. Rainfall est CC BY-NC-SA 4.0 ; les entrées Q3 portent CC BY-NC-SA dans le CSV. Les autorisations de recherche n’autorisent pas par défaut une démonstration commerciale ou la redistribution de tout l’audio.

Les WAV de recherche restent locaux dans `test-data/source-separation/`, exclus du suivi Git de la branche expérimentale et de sa distribution. Les rapports numériques et métadonnées sont archivés. Cambridge Mixing Secrets a été examiné, mais ses contributeurs n’ont pas été contactés et aucun nouveau fichier n’en a été ajouté : sa FAQ demande un accord pour un projet de recherche. Les droits des fichiers et des poids devront être revérifiés pour le supplément de l’article.

## 5. Définition des mesures

### 5.1 Mesures de séparation Q1–Q3

Soient `s` la référence et `ŝ` l’estimation, obtenues en concaténant conceptuellement les deux canaux. Le code retire à chacun **une moyenne globale sur les deux canaux**, puis utilise un seul gain de projection stéréo. Il ne cherche ni délai optimal, ni filtre d’égalisation correcteur, ni permutation optimisée entre sources.

```text
s0 = s − mean(s)
y0 = ŝ − mean(ŝ)
α = <y0,s0> / ||s0||²
s_target = α s0
e_noise = y0 − s_target
SI-SDR = 10 log10( ||s_target||² / ||e_noise||² )
SNR = 10 log10( ||s0||² / ||s0 − y0||² )
SI-SDR improvement = SI-SDR(ŝ,s) − SI-SDR(mix,s)
Gain projeté (dB) = 20 log10(max(|α|,10⁻⁶))
Polarité = signe(α)
```

Cette définition suit le principe SI-SDR de [Le Roux et al.,2019](https://www.merl.com/publications/TR2019-013), avec notre convention stéréo explicite. Ce n’est ni un SDR BSS Eval filtré ni une reproduction du protocole MVSep. Le SNR, après le même centrage, pénalise notamment une erreur de niveau ; le SI-SDR seul peut rester bon malgré un gain erroné.

Implémentation : référence rejetée si énergie moyenne<10⁻¹² ; sortie rejetée si<10⁻¹⁶. Pour les rapports, les ratios d’énergie utilisent un plancher 10⁻²⁰ et les dB SI-SDR/SNR sont bornés à±120. Il s’agit de garde-fous numériques, pas d’une précision de 120 dB. Les canaux non finis, mal alignés et les références invalides sont rejetés.

Le **backing** estimé est la somme des sorties autres que la cible, non le mix original moins l’estimation. Il est comparé au backing connu avec les mêmes métriques. Un bon SI-SDR cible n’implique pas nécessairement un backing exploitable ; les tableaux résumés doivent être accompagnés des résultats backing dans les JSON.

Pour Q2/Q3 : vérification `mix = reference + backing` à tolérance 10⁻⁶, des formats et des SHA avant l’inférence. Q3 présente une erreur maximale de reconstruction observée≈2,98×10⁻⁸. Aucun recalage ni correction de niveau spécifique à un modèle n’est appliqué après séparation.

### 5.2 Agrégation et unité statistique

Médiane et plus faible extrait sont rapportés séparément par instrument, modèle et backend. Une couverture complète des cas, des identités de poids/version correspondantes et aucun doublon sont exigés. Q1/Q2/Q3 ont des identifiants de protocole distincts ; une reprise ne peut pas les mélanger.

Q1 mesure trois mélanges contrôlés. Q2 guitare mesure trois passages d’un seul morceau : **ils ne constituent ni trois morceaux ni trois répétitions indépendantes**. Q3 mesure trois compositions, dont deux du même projet Music Delta. Ne pas fusionner leurs lignes en une grande médiane sans plan d’échantillonnage préétabli.

Aucun intervalle de confiance, test de significativité ou taille d’effet généralisable n’est estimé ici. Les faibles effectifs et dépendances entre extraits ne justifient pas de fabriquer une précision statistique. Une étude future devra agréger par composition, puis éventuellement par artiste, avec comparaisons appariées sur les mêmes extraits.

### 5.3 Mesures temporelles T1/T1b

Départ après vérification initiale de disponibilité du modèle et décodage du fichier. Inclus : accès effectifs au cache dans l’adaptateur, création runtime/session, compilation/chauffe si prévu et séparation/reconstruction. Exclus : téléchargement initial, décodage et contrôle préliminaire de disponibilité. Les sessions sont neuves pour chaque essai, les caches driver restent conservés.

- `totalMs` : jusqu’au retour du runner avec tous les stems valides.
- `firstReadyMs` : jusqu’au **premier bloc valide reçu par le banc** ; inclut la préparation. Ce champ n’atteste ni une première frame audio aux haut-parleurs, ni un premier rendu de waveform.
- `preparationMs` et `separationMs` : frontière dépendant de l’adaptateur. Une initialisation sans méthode `prepare` explicite reste dans `separationMs` ; ces colonnes ne comparent pas le seul coût neuronal.
- **RTF inclusif**, calculé ici : médiane(total)/6 s. RTF<1 signifie un traitement total plus court que l’extrait dans ce protocole, pas une garantie sans sous-alimentation à chaque instant.

Deux essais par configuration, médiane arithmétique des deux valeurs centrales. Ordre des configurations non randomisé, une seule session matérielle, visibilité initiale non enregistrée dans T1. T1b est un contrôle séparé : ne pas remplacer discrètement deux lignes du tableau T1 puis appeler le résultat une même campagne.

### 5.4 Parité et réactivité

Parité : erreur absolue maximale et RMS relative à une sortie numérique de référence, avec comparaison de chacun des canaux dans les validations concernées. Garde-fous usuels : max≤0,005 et RMS relative≤1 %, ou RMS absolue≤10⁻⁵ lorsque la référence est quasi nulle. Le plancher et les conditions d’acceptation exactes sont ceux des rapports/scripts concernés.

Réactivité : intervalles `requestAnimationFrame`, p 95/max, Long Tasks et durées synchrones d’étapes UI. Le RAF n’est ni la latence audio ni le taux d’utilisation CPU. Les essais U1 sont des diagnostics courts, pas un protocole multi-machines contrôlé.

## 6. Résultats temporels

### 6.1 T1 — même extrait 6 s, préparation incluse

Deux essais réussis par ligne ; secondes. La plage est le minimum–maximum des deux temps totaux, pas un intervalle de confiance.

| Configuration | Total médian | Plage total | Premier bloc médian | RTF inclusif |
| --- | ---: | ---: | ---: | ---: |
| Demucs Qualité 4 / GPU | 11,84 | 10,99–12,70 | 11,75 | 1,97 |
| Demucs Aperçu 4 / GPU | 16,71 | 15,85–17,58 | 8,39 | 2,79 |
| BS Roformer SW 6 / GPU | 22,41 | 21,84–22,97 | 18,08 | 3,73 |
| Demucs Qualité 4 / CPU | 48,78 | 47,72–49,83 | 48,66 | 8,13 |
| Demucs Aperçu 4 / CPU | 60,65 | 60,11–61,19 | 23,99 | 10,11 |
| Demucs 6 / CPU | 68,87 | 65,90–71,83 | 36,35 | 11,48 |
| Demucs FT 4 / CPU | 368,21 | 342,96–393,46 | 368,21 | 61,37 |
| BS Roformer SW 6 / CPU | 442,32 | 424,20–460,44 | 303,23 | 73,72 |

Source T1 : [benchmarks/model-comparison-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/model-comparison-2026-10-23.json).

### 6.2 T1b — contrôle ultérieur de visibilité, Qualité 4 uniquement

| Configuration | Total médian (s) | Premier bloc médian (s) | Nombre d’essais |
| --- | ---: | ---: | ---: |
| Qualité 4 / GPU | 13,03 | 12,95 | 2 |
| Qualité 4 / CPU | 55,65 | 55,54 | 2 |

Source T1b : [benchmarks/model-comparison-foreground-control-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/model-comparison-foreground-control-2026-10-23.json).

**Lecture** : Qualité 4 est le plus rapide en total dans T1 parmi les configurations testées ; Aperçu 4 livre plus tôt un premier bloc que Qualité 4 mais termine plus lentement dans cette expérience à session neuve. Le contrôle T1b conserve l’avantage GPU pour Qualité 4, avec des durées différentes. On ne peut pas convertir ces rapports en un «gain GPU universel» ni en une extrapolation linéaire à tous les morceaux.

### 6.3 L1 — latence après préparation, protocole distinct

| Configuration de laboratoire | Contexte | Premier audio publié | Separate→bloc prêt, session préparée |
| --- | ---: | ---: | ---: |
| Export court 1 s | 1 s | 0,75 s | 435,8 ms |
| Export court 2 s | 2 s | 1 s | 767,7 ms puis 951,4 ms |

Pour 2 s : départ Web Audio planifié 797,9/981,7 ms avec Play déclenché dès disponibilité. En nouvelle session avec initialisation incluse :1684 ms (1 s),2284 ms (2 s), caches non vidés. La préparation initiale 2 s a demandé 6,89 s. Ces chiffres n’incluent pas un premier téléchargement Internet et ne sont pas des mesures acoustiques.

La publication chaque seconde ne suffit pas à réduire le réseau 7,8 s : l’export court modifie vraiment la forme d’entrée et conserve la session préparée. Les rendus courts diffèrent du contexte 7,8 s. Sur le mix test, différences RMS relatives 1 s/2 s face au rendu long : batterie 21,5/15,9 %, basse 39,7/22,7 %, Other 34,9/18,6 %, voix 19,6/15,0 %. Ce sont des **différences entre rendus**, pas des pertes de qualité mesurées avec des stems studio.

Détails/rapports : [LOW_LATENCY.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/LOW_LATENCY.md), [benchmarks/low-latency-browser-2026-10-22.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/low-latency-browser-2026-10-22.json).

## 7. Qualité instrumentale objective

### 7.1 Q1 — pilote contrôlé

SI-SDR médian / minimum sur les trois cas ; dB. Un modèle quatre pistes est évalué via Other pour la guitare dans ce mélange sans autre instrument harmonique.

| Configuration | Guitare médiane / minimum | Basse médiane / minimum |
| --- | ---: | ---: |
| BS Roformer SW 6 / GPU | 23,53 / 21,37 | 22,10 / 20,19 |
| Demucs Qualité 4 / GPU | 20,51 / 18,78 | 18,99 / 14,44 |
| Demucs FT 4 / CPU | 19,52 / 14,37 | 18,95 / 15,04 |
| Demucs Aperçu 4 / GPU | 18,88 / 7,98 | 17,86 / 6,36 |
| Demucs 6 / CPU | 10,76 / -8,24 | 9,49 / -0,65 |

Source : [benchmarks/instrument-quality-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/instrument-quality-2026-10-23.json) ; méthode détaillée : [INSTRUMENT_QUALITY.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/INSTRUMENT_QUALITY.md).

SW est premier sur chacune des six paires instrument/cas du pilote. Demucs 6 présente une régression marquée sur l’acoustique : guitare−8,24 dB, gain projeté−20,02 dB, amélioration−7,00 dB face au mix. Cela concerne ce mélange contrôlé, pas l’ensemble des guitares acoustiques. La différence médiane basse Qualité 4/FT≈0,04 dB ne permet pas une préférence perceptuelle.

### 7.2 Q2 — enregistrements réels, détail par clip

SI-SDR cible en dB. Les sorties Qualité/Aperçu sont Other sur Rainfall, bass sur MUSDB ; Demucs 6/SW fournissent une sortie guitar dédiée pour Rainfall.

| Cas / cible | Demucs 6 CPU | Qualité 4 GPU | Aperçu 4 GPU | SW 6 GPU |
| --- | ---: | ---: | ---: | ---: |
| musdb-falcon / bass | 5,40 | 6,61 | 5,99 | 5,15 |
| musdb-reggae / bass | 2,04 | 11,86 | 10,70 | 0,76 |
| musdb-metal / bass | 2,03 | 1,41 | -0,12 | 2,29 |
| medley-rainfall-20 / guitar | 17,64 | 18,96 | 18,83 | 26,93 |
| medley-rainfall-65 / guitar | 5,43 | 14,32 | 8,94 | 18,01 |
| medley-rainfall-120 / guitar | 15,08 | 16,19 | 16,68 | 23,61 |

Résumé par cible : SI-SDR médian / minimum, puis SNR médian et gain projeté médian. La moyenne des scores des canaux n’est pas utilisée : ces scores sont stéréo globaux.

| Cible / configuration | SI-SDR médian / minimum (dB) | SNR médian (dB) | Gain projeté médian (dB) | Clips / compositions |
| --- | ---: | ---: | ---: | ---: |
| bass / Demucs 6 | 2,04 / 2,03 | 3,69 | -1,10 | 3 / 3 |
| bass / Demucs Qualité 4 | 6,61 / 1,41 | 7,42 | -1,28 | 3 / 3 |
| bass / Demucs Aperçu 4 | 5,99 / -0,12 | 6,83 | -1,22 | 3 / 3 |
| bass / BS Roformer SW 6 | 2,29 / 0,76 | 4,30 | -0,99 | 3 / 3 |
| guitar / Demucs 6 | 15,08 / 5,43 | 15,21 | -0,32 | 3 / 1 |
| guitar / Demucs Qualité 4 | 16,19 / 14,32 | 16,29 | -0,23 | 3 / 1 |
| guitar / Demucs Aperçu 4 | 16,68 / 8,94 | 16,76 | -0,23 | 3 / 1 |
| guitar / BS Roformer SW 6 | 23,61 / 18,01 | 23,63 | -0,04 | 3 / 1 |

Source : [benchmarks/real-instrument-quality-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/real-instrument-quality-2026-10-23.json), protocole : [REAL_INSTRUMENT_CORPUS.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/REAL_INSTRUMENT_CORPUS.md).

**Interprétation** :

- Basse : Qualité 4 est premier en médiane 6,61 dB, devant Aperçu 5,99, SW 2,29 et Demucs 6 2,04. Qualité 4 gagne deux des trois morceaux ; SW reste meilleur sur le metal 2,29 contre 1,41 dB. Ne pas conclure à un gagnant sur tout style.
- Guitare : SW gagne les trois passages de Rainfall, médiane 23,61 dB. Trois passages d’une seule composition n’établissent pas une validation multi-styles.
- Le gagnant basse diffère de Q1 : c’est un **effet de dépendance au corpus**, pas une preuve causale que la synthèse seule explique l’écart. Arrangements, références et contextes diffèrent ensemble.
- FT n’a pas été exécuté dans Q2 ; absence de mesure ≠ mauvaise qualité. Les valeurs GPU des autres moteurs ne deviennent pas des mesures CPU.
- L’écart avec un classement UVR/MVSep peut venir de plusieurs dimensions non isolées ; aucune cause précise du score SW basse n’est établie ici.

Onze résultats Q2 ont été conservés à l’identique après une interruption ; treize essais manquants ont été exécutés lors de la reprise. Les onze résultats ne sont pas comptés deux fois. Le JSON conserve `resumedRows:11` ; la reprise valide corpus, poids, rôle, backend et absence de doublons.

### 7.3 Q3 — diagnostic supplémentaire, données train

SI-SDR cible guitare en dB ; Other sert de proxy pour Qualité/Aperçu uniquement grâce à l’instrumentation vérifiée.

| Composition | Demucs 6 CPU | Qualité 4 GPU | Aperçu 4 GPU | SW 6 GPU |
| --- | ---: | ---: | ---: | ---: |
| Music Delta - Country1 | 5,43 | 5,31 | 5,32 | 8,88 |
| Music Delta - Grunge | 3,56 | 4,47 | 4,24 | 6,91 |
| Meaxic - Take A Step | 0,66 | 0,01 | 0,41 | 2,64 |

SW est premier sur les trois extraits ; médiane 6,91 dB contre 4,47 Qualité,4,24 Aperçu,3,56 Demucs 6. Meaxic reste difficile pour tous : même le meilleur score n’est que 2,64 dB. **Un rang premier ne signifie pas un rendu musical excellent.** Aucun jugement d’écoute n’est déduit de ce résultat.

L’appartenance connue à MUSDB train exclut l’utilisation de Q3 comme validation indépendante ou comme justification de remplacement des conseils Settings. Ne pas agréger ces scores avec les passages Rainfall pour annoncer une médiane sur «six morceaux».

Source : [benchmarks/guitar-diagnostic-quality-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/guitar-diagnostic-quality-2026-10-23.json), détails : [GUITAR_DIAGNOSTIC.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/GUITAR_DIAGNOSTIC.md).

## 8. Résultats de parité, y compris les échecs

| Configuration / entrée | Référence et résultat | Décision justifiée |
| --- | --- | --- |
| Demucs 6 GPU extrait du graphe StemSplit, synthétique | RMS relative 0,513 %, max 0,00302 | Test synthétique seul compatible avec le seuil |
| Même chemin, mix musical 7,8 s | RMS relative**7,317 %**, max**0,10386** | **Rejet** ; catalogue 6 s reste CPU |
| Réseau Demucs 6 CPU puis reconstruction JS | RMS relative 0,00598 %, max 0,000112 | Reconstruction proche ; dérive restante localisée au chemin réseau GPU, cause opérateur non établie |
| Demucs court 1 s, mix 6 s | vs PyTorch court identique : max 2,64×10⁻⁶ ; RMS relative 1,17×10⁻⁶ | Accepté dans ce contrat court |
| Demucs court 2 s, mix 6 s | max 3,02×10⁻⁶ ; RMS relative 1,06×10⁻⁶ | Accepté dans ce contrat court |
| SW GPU, mix 6 s/deux fenêtres | max 1,38×10⁻⁴ ; RMS relative 6,45×10⁻⁵ | Accepté contre ORT CPU natif/DSP PyTorch, mêmes fenêtres |

Les seuils n’ont pas été relâchés pour transformer un échec en succès. Pour Demucs 6, injecter le spectrogramme natif au GPU ne supprime pas l’écart musical. Pour les exports courts, une erreur de réflexion gauche dans le padding STFT a été identifiée et corrigée ; la validation musicale a été refaite après correction. Ces résultats soutiennent l’intérêt de vérifier la musique, les bords et chaque canal, en plus d’un signal synthétique.

L’acceptation du SW ne valide pas la conversion GPU Demucs 6 : ce sont des graphes et poids différents. Aucune identité avec UVR n’est démontrée par ces expériences.

Sources : [SIX_STEMS_GPU.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/SIX_STEMS_GPU.md), [LOW_LATENCY.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/LOW_LATENCY.md), [ROFORMER_VALIDATION.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/ROFORMER_VALIDATION.md), rapports `six-stems-*`, `low-latency-browser-*`, `roformer-browser-*` archivés au même commit.

## 9. Réactivité et fenêtres longues : éléments de système

Dans U1, cinq découpages SW, même mix 6 s/modèle préparé :72 étapes 10,22 s ;36 étapes 10,81 s ;18 étapes 9,24 s ;38 étapes alignéesTransformer 9,54 s ;9 étapes 9,52 s. Le plan 18 est retenu. Les douze canaux de chaque variante respectent les seuils numériques. Une mesure par variante n’établit ni intervalle de confiance ni optimum universel ; ce gain ne doit pas être assimilé à T1, qui inclut la préparation.

Un essai host SW 60 s est passé de 67,89 à 62,42 s entre deux sessions/conditions distinctes ; p 95 RAF≈9,4 ms, intervalle maximal cumulé 115,8 ms. Il reste des pauses ponctuelles et le calcul demeure plus long que l’audio (RTF≈1,04). Ce n’est pas une preuve de lecture sans attente à partir du tout premier bloc.

Des observations antérieures sur un morceau 214,9 s ont donné Aperçu 115,10 s et SW 228,32 s. Modèles, contexte, session et implémentation à cette date diffèrent ; ces essais fonctionnels ne sont pas fusionnés avec T1. Le contenu «Jet» utilisé pour ces essais longs n’a pas sa provenance, son hash et ses droits entièrement archivés dans les rapports cités : **ne pas l’utiliser comme corpus scientifique reproductible avant de compléter cette fiche**.

Un diagnostic de sauvegarde≈203 Mo a réduit l’appel synchrone `IndexedDB.put` de 357 à 12,9 ms avec un empaquetage en Blobs ; le temps total a augmenté 591→1234 ms. Conclusion : réduction du blocage UI, **pas** accélération de toute la sauvegarde. L’interface et la vitesse du réseau neuronal sont des axes d’évaluation distincts. La politique applicative ultérieure privilégie la RAM et une sauvegarde explicite ; le résultat de sérialisation reste une expérience historique séparée.

Source système : [ROFORMER_THROUGHPUT_AND_STORAGE.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/ROFORMER_THROUGHPUT_AND_STORAGE.md), [benchmarks/roformer-throughput-storage-2026-10-22.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/roformer-throughput-storage-2026-10-22.json). Les textes historiques annonçant ensuite un portage vocal MDX-Net ne définissent plus la priorité du projet : le périmètre actuel est guitare/basse.

## 10. Interprétations utilisables et limites pour l’article

### 10.1 Résultats défendables à ce stade

- La séparation locale multi-modèles CPU/WASM et WebGPU est faisable dans ce prototype, avec publication progressive et lecteur multipiste ; cela ne garantit pas le même débit sur tout appareil.
- Un export à contexte court avec session préparée permet localement un premier bloc sous la seconde. Le coût de préparation est réel et séparément documenté ; la réduction du contexte modifie les sorties.
- La configuration la plus rapide en total n’est pas nécessairement celle qui publie le premier bloc le plus tôt.
- Le conseil de fidélité instrumentale dépend du corpus : le pilote synthétique et la basse enregistrée conduisent à des préférences différentes.
- Les validations de parité révèlent des défauts de conversion/DSP qui seraient invisibles dans une simple démonstration audio. Les résultats négatifs doivent être conservés.

### 10.2 Ce qui n’est pas démontré

Pas de classement universel des modèles, pas de supériorité perceptuelle validée, pas de gain statistiquement significatif, pas de parité UVR, pas de supériorité SW sur des guitares hors entraînement, pas de lecture temps réel garantie à froid, pas de comparaison équitable de tous les CPU/GPU possibles, pas d’évaluation mobile/Firefox/Safari multi-machines. Les classements de la communauté ne sont pas des votes de guitaristes dans nos mesures.

### 10.3 Menaces à la validité

**Interne** : pipelines/précisions/checkpoints différents, chauffe et caches, ordre non randomisé, charge système et visibilité initiale non enregistrés, quantification/compression sources, absence de mesures mémoire/power. Les effets du backend, du contexte et de l’architecture ne sont pas isolés expérimentalement.

**Externe** : corpus très petit, clips 6 s, une seule composition guitare Q2, deux artistes Q3, basse artificielle Q1, sélection sur disponibilité et instrumentation favorable à Other, données Q3 train. Pas de généralisation aux longs solos, piano/guitare concurrents, reverb live, genres ou instruments sous-représentés.

**Construite** : SI-SDR mesure une proximité de forme après projection, non une utilité musicale globale. Le SNR complète le niveau mais ni l’un ni l’autre ne répartit repisse, artefacts, timbre et transitoires en notes perceptuelles.

**Statistique** : effectifs faibles, passages corrélés, deux mesures de temps seulement. La médiane d’extraits n’est ni un vote d’experts ni une estimation robuste de population.

### 10.4 Références externes, à garder séparées

Le snapshot MVSep consulté le 23/10/2026 est un contexte historique : SW guitare 9,012 dB, Demucs 6 guitare 5,2489 dB, SW basse 14,62 dB dans ses protocoles propres. Ces valeurs ne sont pas nos SI-SDR, ni une mesure de nos exports. Ne pas les poser sur la même échelle comme si les jeux de test et métriques étaient identiques. Aucun nouveau relevé de classement n’est réalisé le 24/10 pour ce document.

## 11. Écoute et validation restantes — protocole proposé, non réalisé

1. Constituer un corpus autorisé de compositions indépendantes : idéalement enregistrements propres avec stems guitare/basse, plusieurs artistes, acoustique/clair/saturé, accompagnements avec piano et sons concurrents. Documenter droits, origine et exposition connue à l’entraînement. Ne pas baptiser «hors entraînement» une provenance simplement inconnue.
2. Fixer les extraits avant l’évaluation : plusieurs fenêtres par composition, passages avec/sans cible, transitoires et fins de notes ; éviter de choisir après coup les passages favorables. Définir comment seront traitées les références silencieuses.
3. Évaluer les configurations sur **le même PCM** et garder une séparation des expériences backend, contexte court/long et modèle. Inclure FT sur ce corpus si le budget le permet ; sinon le marquer non mesuré.
4. Pré-enregistrer un protocole d’écoute en aveugle/randomisé, référence connue, ancre si pertinente, même gain de lecture, extrait et position communs. Décider avant l’essai si une seconde condition égalisée en sonie est utile ; ne pas mélanger ses scores à ceux sans égalisation.
5. Recruter/documenter les évaluateurs guitaristes/bassistes, chaîne d’écoute, entraînement préalable et nombre de jugements ; prévoir les autorisations/consentements applicables. Axes distincts : repisse, artefacts, attaques/sustain, timbre, graves et utilité du backing. Ni effectif ni procédure MUSHRA/ABX ne sont présumés réalisés.
6. Calculer les métriques par extrait puis par composition avec un plan d’agrégation fixé. Comparaisons appariées, dispersion et incertitude au niveau composition/artiste ; ne pas bootstrapper tous les passages corrélés comme indépendants.
7. Refaire les temps sur plusieurs classes de matériel, en sessions préparées et neuves, en contrôlant visibilité, alimentation, ordre, caches et charges. Mesurer RTF soutenu, premier bloc, sous-alimentations, RAF/Long Tasks, mémoire et énergie si instrumentation disponible.
8. Comparer le pipeline navigateur à une référence native **de même contexte/checkpoint**, puis seulement à UVR si ses réglages exacts sont disponibles. L’écart entre contextes courts et rendu natif long constitue une expérience distincte.
9. Évaluer SCNet et MDX Extra Q selon leurs apports guitare/basse ; contrats, poids, droits et parité avant intégration. Aucun score ni résultat de ces candidats n’existe dans ce document.

Le lecteur A/B déjà implémenté garde le volume et la position, propose référence/instrument/backing et limite les résultats en RAM. Sa vérification technique (lecture, pause, commutation, format) **n’est pas une étude d’écoute humaine**.

## 12. Reproductibilité et maintenance obligatoire

**Règle de travail demandée par l’utilisateur : toute nouvelle campagne de test ou validation de modèle doit mettre à jour ce fichier dans le même travail**, avant de présenter ses conclusions. Cette règle inclut les échecs, annulations et régressions pertinentes ; ne pas écraser l’historique pour ne conserver que le meilleur résultat.

Pour chaque campagne : attribuer un ID, dater avec fuseau, enregistrer commit/code/protocole/poids et hashes, fiche machine/runtime/backend, paramètres, corpus et droits, traitement exact, graines, nombre d’essais/échecs, conditions de cache/préchauffage/visibilité, JSON brut et son hash. Recalculer les tableaux depuis le brut et réviser les conclusions/limites. Un changement de poids, DSP, contexte, runtime ou définition métrique exige un nouveau protocole ou un marquage d’incomparabilité.

Une donnée absente se note **non enregistrée / non mesurée**, jamais 0. Une annulation ne compte ni comme succès ni comme score nul ; une reprise ne double pas les observations conservées. «Complet» pour une campagne signifie couverture de sa matrice annoncée, pas validation scientifique générale.

L’évaluation ne transmet pas l’audio à un service d’inférence. Les données utilisateur/recherche ne sont pas redistribuées sans droit ; conserver plutôt instructions d’obtention, références, manifestes et hashes. Les poids lourds, WAV et caches restent séparés du supplément textuel.

### 12.1 Retrouver le snapshot sans changer de branche

```sh
git show b10dd146a082fcf79f21e96fb31787d1589eea1f:examples/wam/source-separation/models.json
git show b10dd146a082fcf79f21e96fb31787d1589eea1f:examples/wam/source-separation/benchmarks/model-comparison-2026-10-23.json
git show b10dd146a082fcf79f21e96fb31787d1589eea1f:examples/wam/source-separation/benchmarks/real-instrument-quality-2026-10-23.json
```

Pour réexécuter les bancs, utiliser le checkout `multitracks` correspondant ou un checkout dédié de ce commit ; ne pas tester silencieusement le code différent de `main`. Les scripts, serveurs et exports sont propres à cette révision. Sur ce snapshot : `npm test`, puis `npm run dist -- --no-regenerate --no-build` lorsque les artefacts de modèles requis sont installés. **Aucune de ces commandes n’a été relancée pendant cette rédaction documentaire.**

Entrées de laboratoire dans cette révision : `model-benchmark.html`, `instrument-quality.html`, `real-instrument-quality.html`, `real-instrument-quality.html?corpus=guitar-diagnostic`, `instrument-comparison.html`, sous `examples/wam/source-separation/`. Les protocoles [REAL_INSTRUMENT_CORPUS.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/REAL_INSTRUMENT_CORPUS.md) et [GUITAR_DIAGNOSTIC.md](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/GUITAR_DIAGNOSTIC.md) donnent les commandes exactes d’obtention/préparation locale.

Le checkpoint logiciel précédent rapporte 496 tests Node réussis, dont deux tests appelant huit tests Python des préparateurs. Ce nombre documente un état de validation logicielle historique ; il ne constitue ni une nouvelle exécution du 24 octobre ni 496 mesures de qualité audio.

### 12.2 Gabarit pour la prochaine entrée

```text
ID / date UTC et fuseau / responsable :
Question, hypothèse et critère d’acceptation fixés avant mesure :
Commit code, protocole, runtime, backend, précision et poids SHA-256 :
Machine/OS/navigateur/GPU/CPU/RAM/alimentation et visibilité :
Audio : titre, artiste, source, droits, split/exposition entraînement,
        hash source ET PCM, offsets, fréquence, canaux, frames,
        niveaux, normalisation, référence cible et backing :
Matrice prévue / essais terminés / échecs / reprises :
Cache, téléchargement, chauffe, contexte/overlap/publication, threads :
Mesures brutes, unités, référence, tolérances, agrégation :
Rapport archivé (chemin + SHA-256), figures et scripts de recalcul :
Résultats, limites, interprétation, décision (accepté/rejeté/à confirmer) :
Écoute humaine réellement réalisée ? Protocole, participants et résultats :
Modifications de recommandations et comparaison avec les campagnes antérieures :
```

### 12.3 Journal de mise à jour

| Date | Version | Modification | Nouvelles mesures |
| --- | --- | --- | --- |
| 24/10/2026 | 0.1 | Synthèse initiale T1/T1b/Q1/Q2/Q3 et diagnostics N/L/U ; sources épinglées, limites et protocole futur | Aucune ; recalcul des tableaux à partir des JSON archivés |
| 24/10/2026 | 0.2 | R1 : import local de références autorisées, PCM haché et revue exploratoire en aveugle ; tests et dist isolés | Deux contrôles techniques SWGPU sur signaux synthétiques, aucune nouvelle campagne de qualité ni note humaine |

## 13. Références bibliographiques et techniques

- Rouard, S., Massa, F., Défossez, A. *Hybrid Transformers for Music Source Separation*. Prépublication 2022, ICASSP 2023. [Texte des auteurs](https://arxiv.org/abs/2211.08553).
- Lu, W.-T., Wang, J.-C., Kong, Q., Hung, Y.-N. *Music Source Separation with Band-Split RoPE Transformer*. Prépublication 2023. [Texte des auteurs](https://arxiv.org/abs/2309.02612). À distinguer de l’origine spécifique du checkpoint SW.
- Le Roux, J., Wisdom, S., Erdogan, H., Hershey, J. *SDR — Half-Baked or Well Done?* ICASSP 2019, DOI 10.1109/ICASSP.2019.8683855. [Publication MERL](https://www.merl.com/publications/TR2019-013).
- [MUSDB 18, SigSep](https://sigsep.github.io/datasets/musdb.html) ; [API du preview 7 s](https://sigsep.github.io/sigsep-mus-db/) ; [licences par titre](https://github.com/sigsep/website/blob/master/content/datasets/assets/tracklist.csv).
- [MedleyDB — description des données](https://medleydb.weebly.com/description.html), [téléchargements](https://medleydb.weebly.com/downloads.html), [métadonnées](https://github.com/marl/medleydb/tree/master/medleydb/data/Metadata), [coefficients officiels](https://github.com/marl/medleydb/blob/master/medleydb/resources/mixing_coefficients.yaml).
- [ONNX Runtime Web — WebGPU](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html), documentation primaire du backend ; la compatibilité d’un opérateur/modèle reste à vérifier pour la version épinglée.
- [ringbuf.js, Paul Adenot](https://github.com/padenot/ringbuf.js), composant de transport, pas une mesure de performance en soi.
- [MVSep — classement guitare](https://www.mvsep.com/quality_checker/leaderboard/guitar), [page basse SW](https://www.mvsep.com/algorithms/37). Références externes historiques, métriques non fusionnées avec nos SI-SDR.
- [Cambridge Mixing Secrets — FAQ](https://www.cambridge-mt.com/ms3/mtk-faq/) : conditions de recherche à vérifier avec les contributeurs avant ajout de morceaux.

Les références primaires d’architecture/métrique/datasets ont été consultées pour cette synthèse le 24 octobre 2026. Les classements externes restent le snapshot antérieur explicitement daté ; ce texte ne revendique pas leur actualisation.

## Annexe A. Rapports bruts épinglés et empreintes

Ces liens immuables restent valables si la branche active change. Ils donnent les valeurs non arrondies, les cas, identités de modèles et métadonnées. Les hashes ci-dessous portent sur les octets JSON archivés, pas sur un reformatage ou sur les fichiers audio.

| Campagne | Rapport | SHA-256 du JSON |
| --- | --- | --- |
| T1 | [model-comparison-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/model-comparison-2026-10-23.json) | `ca92889a0c9aacf714027bb105b1de5770324ea7fe5d86354375fc41b00594d6` |
| T1b | [model-comparison-foreground-control-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/model-comparison-foreground-control-2026-10-23.json) | `432b18018eaa7311cd9db3c25d13320a4a3740be73c309289b55cd9bba9dc092` |
| Q1 | [instrument-quality-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/instrument-quality-2026-10-23.json) | `ec10f00554af2f7735d1cfdaf51cc132679003db16c1182205b830c7deb17ad2` |
| Q2 | [real-instrument-quality-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/real-instrument-quality-2026-10-23.json) | `d4f8afc5594ff9dd2e8e3d775cb3fd75aeda43b8f279796fec169c789d8dbf79` |
| Q3 | [guitar-diagnostic-quality-2026-10-23.json](https://github.com/micbuffa/NAM_A2_WAM/blob/b10dd146a082fcf79f21e96fb31787d1589eea1f/examples/wam/source-separation/benchmarks/guitar-diagnostic-quality-2026-10-23.json) | `263919ecbaac6f4d5d037668e0c058efba04285bc4d915ae725ce646d4c5fcb2` |

## Annexe B. Empreintes des références préparées Q2/Q3

Les empreintes mix/backing et les sources non regroupées figurent dans le champ `corpus` des rapports. Pour chaque cas, voici l’empreinte du WAV `reference.wav` effectivement comparé aux modèles ; offsets et regroupements sont décrits en section 4.

| Campagne / cas | SHA-256 de reference.wav |
| --- | --- |
| Q2 / musdb-falcon | `943cafc1870021002f9106f2a5d78a5c24d3efacfae44c546a2ef561a32aec4f` |
| Q2 / musdb-reggae | `06b27cfedf14945ac89bf935834254bd6f621dbc22cb9b54b4f40d3bda17d0cf` |
| Q2 / musdb-metal | `8a417cd5481d92550da21bd2eee2024a62c55a232a005aa18ea7e9a9c8cbd85e` |
| Q2 / medley-rainfall-20 | `8903d2e5c1172e5799c17c14780ecb683a243fbb4ab0b5aeb58b32b2b950efe1` |
| Q2 / medley-rainfall-65 | `d381a7c8decd5289477c77c06a20064ecdc632515f3ddfefabb020cab71462ed` |
| Q2 / medley-rainfall-120 | `28b1f083f6e7f7fc534efa8fd23889eae0a0f8ecfdc2fd32114bda17d88f81f3` |
| Q3 / guitar-country | `e3a894a5eac3c60459e8462b236951ccddad5053ba4da8de2eae1192908569f4` |
| Q3 / guitar-grunge | `85ca5f2f57d825ac8f945a02431ea19c4b2814eb96bb424ca7497b8923412b70` |
| Q3 / guitar-meaxic | `9a6d4cf4910206d5c1191ab2411e1be45b95c83ae1cb9016f71c0b8f51c2b6bd` |


## 14. R1 — Outillage de références locales et revue exploratoire (24 octobre 2026)

**État : P4.12d.2a livré ; P4.12d.2b (fichiers originaux plus indépendants et écoute humaine) reste en attente de données et de participation.** Aucune donnée personnelle ou autorisation n’est déduite de l’absence de réponse. Un dossier de prises originales a été demandé à l’utilisateur ; aucun n’a été indiqué pendant cette étape.

Le développement est isolé dans `/Users/michelbuffa/.codex/worktrees/model-evaluation-listening/WAM_NAM2_PROTO`, worktree détaché fondé sur `b10dd146a082fcf79f21e96fb31787d1589eea1f`. Aucun commit/fusion/push de ces changements ; aucune modification du code audio/UI principal de main. Les références archivées de Q1–Q3 restent immuables ; R1 est distinct.

### 14.1 Méthode et implémentation

`ReferenceEvaluation.js` valide une paire instrument/backing alignée et reconstruit son mix. Décodage Web Audio à44,1kHz ; mono dupliqué explicitement ; deux canaux maximum ; longueurs décodées identiques et origine temporelle déclarée ; aucune correction de délai. Fenêtres1/6/15/30s, hors limites rejeté sans padding ; limite de décodage600s et300Mio par fichier. Sources sélectionnées actives et finies, gain commun si pic>0,9. Même définition SI-SDR/SNR/gain/polarité/amélioration et backing que Q1–Q3. Other n’est accepté comme guitare qu’après déclaration explicite du contenu instrumental, sans détection automatique.

Chaque import enregistre titre/droits/provenance/date éventuelle, SHA256 des fichiers d’origine ET PCM sélectionné (Float32 little-endian, canaux successifs), recette complète, navigateur, visibilité, informations GPU exposées et hashes de fichiers de code sélectionnés. Les informations CPU physique/OS exacts restent non enregistrées lorsque les API ne les donnent pas. Le manifeste de code indique son périmètre : ce n’est pas un hash de toute la chaîne de dépendances. Aucun commit du code modifié n’étant encore créé, les hashes constituent une trace partielle ; figer le commit complet avant une étude confirmatoire.

`reference-evaluation.html` utilise les adaptateurs de production ; pas de repli GPU→CPU pendant un essai, pas de téléchargement implicite ni de mise à jour des conseils Settings. Les dates début/fin tracent l’exécution mais `timeComparisonEligible:false` interdit de l’assimiler à T1. Aucun PCM/projet n’est écrit automatiquement en IndexedDB.

La revue `exploratory-blind-review-v1` mélange les sorties et une référence cachée, avec tirage cryptographique ; référence explicite disponible. Noms de modèles, mesures et JSON sont cachés pendant la notation dans l’interface. Instrument/backing sélectionnables, même lecteur/volume, position/lecture conservées. Une seule URL Blob active, révocation et protection contre callbacks tardifs. La randomisation est un masquage de présentation, pas une sécurité contre l’inspection volontaire du code ou des exports.

Cinq notes0–100, toutes vides au départ : absence de repisse, absence d’artefacts, attaques/sustain, timbre et utilité du backing. Pseudonyme/chaîne d’écoute requis. Une validation explicite révèle les modèles et verrouille les notes. Avant cette action, aucun score ni correspondance anonyme n’est exporté comme résultat humain ; les événements Play ne prouvent pas l’attention. **Le dispositif n’est pas une étude MUSHRA/ABX standardisée et aucune étude de population n’a été réalisée.**

### 14.2 Signaux de contrôle et observations

Deux WAV mono IEEEFloat32 à44,1kHz,44100frames, une seconde : cible `0,16·sin(2π·220·t)`, backing `0,16·sin(2π·73·t)`, origine commune à l’échantillon0. Signaux générés localement pour tester le logiciel ; droits déclarés comme tels, provenance **development-fixture**, pas des prises de guitare. Aucun gain individuel ; facteur commun1. L’instrument choisi «guitare» sélectionne la tête guitar de SW pour un contrôle de routage, sans prétendre que les sinusoïdes sont un enregistrement de guitare.

Deux exécutions SWGPU réussies sur le même signal, d’abord source puis version finale distribuée. Le SI-SDR cible≈−2,54dB est une sortie diagnostique de ce routage synthétique ; ni rang, ni préférence musicale, ni nouvelle observation indépendante n’en sont tirés. Les hashes exacts et valeurs non arrondies figurent dans les rapports. Ces deux essais ne s’ajoutent pas aux51séparations musicales Q1–Q3 et ne sont pas deux nouvelles compositions.

Contrôle de lecture finale : référence1s décodée sans erreur, commutation référence→échantillon anonyme en lecture0,2086→0,4038s sans retour au début. Bouton Terminer désactivé tant que les notes sont vides. Rapport exporté avec revue `in-progress`, `ratedCount:0`, `humanResultsAvailable:false`, sans champ observations. **Zéro note humaine saisie par l’agent.** Aucun log console error lors du contrôle final.

### 14.3 Validation logicielle et reproductibilité

**512 tests Node réussis** sur le worktree expérimental :496existants+16nouveaux (références/provenance/alignement/gain/hash/proxyOther, masquage/notes manquantes/verrouillage et lecture/callbacks tardifs/libération des URL). Les notes fictives des tests unitaires restent en mémoire de test et ne sont pas publiées comme avis humains.

Le premier passage complet a échoué uniquement parce que la dist du nouveau worktree n’existait pas encore ; dist reconstruite puis suite512/512 réussie. Le Node Homebrew ne démarrait pas (bibliothèque simdjson manquante) : utilisation du Node fourni par le runtime Codex, sans modification de l’installation système. Journaux locaux `/tmp/nam-reference-evaluation-tests.log` et `/tmp/nam-reference-evaluation-dist.log`.

Rapports locaux sous `examples/wam/source-separation/benchmarks/` du worktree :

| Rapport | SHA-256 |
| --- | --- |
| `reference-evaluation-initial-technical-2026-10-24.json` | `a07fc29085618ed4ba54cbb81a601f163ba9157737a127c1f5eaa09c96787e82` |
| `reference-evaluation-technical-2026-10-24.json` | `62680f1c022c96d16aeef05ef2fd18aa61f342c4192bbd80238b4c0146d5e9c9` |

Les gros modèles existants ont été réutilisés localement ; dépendances WASM/SDK nécessaires à la dist fournies sans initialiser de nouveau sous-module Git. La dist expérimentale ne remplace pas celle de main. Le contrôle d’intégration ne constitue ni une comparaison des modèles, ni une validation sur corpus hors entraînement.

**Suite dépendante** : fournir des stems originaux autorisés, vérifier leur alignement et leur historique d’entraînement, fixer les extraits et le protocole avant calcul, puis recueillir de vraies observations humaines. Les prochaines conclusions doivent référencer ces nouvelles données ; ne pas remplir cette section avec des notes supposées.


## 15. Source YouTube envisagée — note de protocole, 24 octobre2026

L’import d’un audio depuis une URL YouTube est ajouté au plan fonctionnel P4.13 ([proposition](YOUTUBE_IMPORT.md)). **Aucune extraction ni nouvelle mesure n’a été réalisée pour cette étude documentaire.** Le prototype proposé utilise un service local/backend optionnel ; l’inférence de séparation reste dans le navigateur.

Un tel flux sans stems studio ne peut pas contribuer aux scores SI-SDR cible de Q1–Q3. Il peut servir à un test de performance/workflow ou à une écoute exploratoire, avec droits/autorisations appropriés. Toute mesure devra conserver URL/id, date, version d’extracteur et éventuelle conversion, codec, taille/hash et PCM décodé/fenêtre ; la compression du flux et l’exposition à l’entraînement inconnue doivent être déclarées. Un titre public ou une vidéo récente n’établit pas l’indépendance d’entraînement.

Mise à jour v0.3 : plan d’import seulement ; aucun nouveau modèle, score ou avis humain. Les données et résultats historiques ci-dessus restent inchangés.

## 16. Extension du 25 octobre 2026 — import et nouveaux candidats

Cette extension ne réécrit pas les campagnes Q1/Q2/Q3 ni leurs classements. Les changements sont encore locaux sur `multitracks`, au-dessus de `b10dd146` ; aucun nouveau commit n’est revendiqué pour les exécutions. Les dates ISO des navigateurs sont en UTC (24octobre22h…) ; la session locale est le25octobre en Europe/Paris. Les tests ci-dessous sont exploratoires, réalisés sur la même machine macOS14.4.1 ARM64, GPU Apple metal-3. Les essais natifs utilisent Python3.12.14, PyTorch2.6.0 et ORT1.22.0, deux threads CPU ; le navigateur utilise ORT Web1.22.0 monothread WASM. Des opérations de développement et certains autres contrôles ont eu lieu pendant la session : **ces nouveaux chronos ne constituent pas une campagne de vitesse isolée et ne modifient pas les recommandations automatiques**.

### 16.1 Y1 — import YouTube et chaîne fonctionnelle

Objectif : vérifier URL→audio natif→décodage navigateur→séparation existante→lecture, sans faire passer une vidéo mixée pour un corpus de références instrumentales. yt-dlp2026.10.21, EJS0.8.0, Node embarqué, sans cookies ni compte. La première URL technique historique `BaW_jenozKc` a renvoyé «This video is unavailable» ; **aucun audio n’en a été obtenu**. L’erreur a conduit à sélectionner la vidéo ouverte de Blender **Big Buck Bunny**, `YE7VzlLtp-4`, présente dans les tests actuels de l’extracteur YouTube du [projet yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/youtube/_video.py).

Audio reçu : M4A **28 914 898octets**, durée métadonnée597s, SHA-256 `8296cfa389ea5e97aeace1f979ab236e9195b5363f1e0bc62309c18a9d4b41f3`. Aucun transcodage MP3. Chrome a décodé596,5s ; la différence entre durée annoncée et décodée n’a pas été corrigée artificiellement. La séparation a porté sur **les cinq premières secondes seulement**, avec `htdemucs_4s_onnx`, backend WebGPU demandé ; quatre pistes Batterie/Basse/Autres/Voix sont arrivées à l’état terminé. Play s’est transformé en Pause et la position a avancé. Une URL externe invalide a ensuite été refusée sans remplacer le résultat courant. Le panneau est également présent dans le host compact Multitracks.

Aucune mesure SI-SDR n’est possible sans pistes de référence ; aucune note perceptuelle n’a été fournie. Ce film n’est pas présenté comme un nouvel échantillon représentatif de guitare/basse. Les temps de téléchargement, de préparation et de séparation n’ont pas été instrumentés : on ne leur attribue aucun chiffre rétrospectif. Audio temporaire supprimé côté service après transfert ; fichier de travail conservé seulement dans le répertoire temporaire de développement, sans redistribution dans Git/dist. [Trace Y1](examples/wam/source-separation/benchmarks/youtube-import-2026-10-25.json).

### 16.2 S1 — SCNet compact : provenance et protocole

Candidat **SCNet10,1M paramètres**, quatre sorties drums/bass/other/vocals, **distinct de SCNet XL et de SCNet Large41,2M**. Export tiers [audiojs/scnet](https://huggingface.co/audiojs/scnet), **12 900 277octets**, SHA-256 `98228931494151762a1c4ab1ec7899a894b1f81fd4a509921a9d2f9bacc50845`, révision des poids `e71bcdb42bce1d62b7fae25ba90fcbcf90f73f46`. Poids int8 stockés/déquantifiés dans le graphe ; cela ne signifie pas que tous les calculs utilisent des entiers. Checkpoint natif `scnet_checkpoint_musdb18.ckpt`, SHA-256 `1bc0d1abb20bfdf966dcd07637bafd03e4bc13653d09ef18bc9b3e342eafe2aa`. Code modèle MSST `84b1eac0887756b4f1a9d7a1ff49105939749ed2`. L’auteur des poids a [confirmé leur MIT](https://github.com/starrytong/SCNet/issues/35#issuecomment-4999873539) ; cette constatation ne porte pas sur des variantes XL tierces.

Le réseau prend `mix_spec[1,4,2049,476]` et produit `stems_spec[1,16,2049,476]`. FFT4096, hop1024, fenêtre rectangulaire, normalisation1/√4096, centrage par réflexion ; canaux L réel/imaginaire puis R réel/imaginaire. Le contexte est11s (485100échantillons), avec padding interne de SCNet jusqu’à486400. L’audit suit la normalisation mono moyenne/écart-type ddof1 et la règle du pipeline exporteur : un extrait6s dépasse la moitié du contexte, donc son prolongement à11s est réfléchi à droite. Aucun DC n’est rajouté à chaque source. Ces détails font partie de la configuration évaluée.

Quatre cas **existants** du Q2, sans nouveau prélèvement ni recherche d’extrait favorable : Falcon, Reggae et Metal pour la basse ; Rainfall20s pour la guitare (proxyAutres autorisé dans ce mix ne contenant hors voix que des guitares). Les entrées et références sont les mêmes WAV6s à44100Hz, deux canaux, hachés dans RealCorpusDefinition ; alignement inchangé, aucune recherche de décalage, aucun gain optimisé par modèle avant l’inférence. Chaque cas a été exécuté avec le checkpoint natif puis avec le compact ONNX et le même STFT/iSTFT PyTorch.

| Cas Q2 | Instrument / sortie | SI-SDR natif | SI-SDR ONNX compact |
|---|---|---:|---:|
| musdb-falcon | Basse | 7,009dB | 6,993dB |
| musdb-reggae | Basse | 10,058dB | 10,116dB |
| musdb-metal | Basse | 2,271dB | 2,234dB |
| medley-rainfall-20 | Guitare via Autres | 9,932dB | 9,633dB |

Le compact reste proche du natif sur ces cas, **sans identité numérique** : quantification et export ne sont pas assimilés à une conversion FP32 à1e−3. Les scores de parité compact/natif par source et les SNR/gains sont dans [S1 natif](examples/wam/source-separation/benchmarks/scnet-native-candidate-2026-10-25.json). Les quatre cas représentent **huit exécutions musicales supplémentaires** (quatre natifs+quatre ONNX), et non huit morceaux indépendants. Aucun test du grand SCNet, aucune campagne longue ni écoute humaine. Ces résultats courts n’établissent pas un avantage instrumental justifiant de remplacer les modèles déjà disponibles.

Reproduction : `python tools/prepare-scnet-candidate.py`, puis environnement torch/numpy/onnxruntime/PyYAML+ffmpeg pour `python tools/validate-scnet-candidate.py`. Préparation avec révisions et SHA imposés dans [le manifeste S1](examples/wam/source-separation/research/scnet-candidate.json). Aucun poids ni audio de recherche ajouté à la dist. Scripts exporteur et référence fixés à la révision audiojs `3ef9c0469766ddf98592a80338435ac8f4a693a9`, empreintes de code archivées.

### 16.3 S2 — même graphe SCNet dans le navigateur

Diagnostic séparé, calculs et comparaison dans un Worker. Entrée : spectrogramme du cas Falcon de S1, prolongé et normalisé comme ci-dessus. Sortie de référence : le même compact ONNX exécuté en ORT CPU natif, **pas le checkpoint natif FP32**. Même input SHA `496a3de09afd13327c2a9d6a2ffd7b95b6c8b05e16d54508d451b08d8648a6cb` et référence SHA `33c95447efbeb734868fd99d2060adc09d6c8cfa7d4b7f7e1924a174b2c9ee0e` pour les deux backends ;16canaux,2049bins,476trames tous finis. Seuil annoncé relatif RMS1e−3.

| Backend Chrome / ORT1.22 | Création de session | Réseau seul | Erreur RMS relative | Erreur absolue max |
|---|---:|---:|---:|---:|
| WebGPU, Apple metal-3 | 2,994s | 27,278s | 1,172×10−6 | 1,183×10−4 |
| WASM,1thread | 3,256s | 46,494s | 5,586×10−7 | 3,910×10−5 |

Parité du **même graphe compact** réussie. Ces durées incluent les surcoûts de première inférence mais excluent STFT/iSTFT et le chargement des fichiers ; une fenêtre de11s n’est pas équivalente à11s publiées en lecture progressive avec chevauchement. Les exécutions n’étaient pas une campagne de charge isolée : ne pas comparer directement ces chiffres aux barres du banc T1. WebGPU peut conserver des opérateurs sur CPU, notamment dans cette architecture avec12LSTM. Aucun profilage ne permet ici de donner leur proportion. **Un graphe compatible ne constitue pas un adaptateur production** : diffusion PCM progressive, raccords, durée longue, mémoire et annulation de toute la chaîne restent à porter/tester avant le menu Model.

[S2 WebGPU](examples/wam/source-separation/benchmarks/scnet-webgpu-candidate-2026-10-25.json), [S2 WASM](examples/wam/source-separation/benchmarks/scnet-wasm-candidate-2026-10-25.json). Ce sont deux contrôles numériques d’une seule entrée, pas deux nouvelles observations musicales indépendantes.

### 16.4 M1 — MDX Extra Q natif

La [configuration officielle Meta](https://github.com/facebookresearch/demucs/blob/main/demucs/remote/mdx_extra_q.yaml) contient **quatre modèles** :83fc094f,464b36d7,14fc6a69,7fd6ef75, fenêtres44s. Demucs v3 hybride, aucune sortie guitare dédiée ; ce n’est pas MDX-Net. Quatre checkpoints officiels ont été téléchargés dans le cache de recherche, déquantifiés par **DiffQ0.2.4**, puis chargés en PyTorch2.6.0 ; tailles et SHA complets dans [M1](examples/wam/source-separation/benchmarks/mdx-extra-q-native-2026-10-25.json). Ces fichiers Meta historiques utilisent la sérialisation Python de Demucs ; ce chargement natif isolé n’est pas un format distribuable directement à notre Worker ONNX.

Une erreur initiale du **script de mesure** tentait de lire `BagOfModels.segment`, propriété absente. Les poids étaient chargés ; aucune inférence valide n’a été enregistrée par ce premier script. Après correction pour lire les segments des quatre sous-modèles, l’essai musical est terminé : Rainfall20s,6s stéréo, même fichier/hachage que S1 ; normalisation Demucs, `shifts=0`, `split=false`, moyenne pondérée officielle de l’ensemble. Sortie4×2×264600 finie ; **5,437s d’inférence native exploratoire**, SI-SDR guitare via Autres **18,239dB**, gain projeté−0,228dB. Ce temps ne décrit ni une séparation avec fenêtres44s d’un morceau long ni le navigateur. Une seule observation ne justifie aucun classement.

Le [README officiel Demucs](https://github.com/facebookresearch/demucs) précise que `mdx_extra` utilise des données supplémentaires comprenant **MUSDB test** ; `mdx_extra_q` est sa variante quantifiée. Aucun de nos cas MUSDB test n’a donc été utilisé comme preuve indépendante pour M1. L’exposition de Rainfall/MedleyDB aux données supplémentaires n’est pas établie : le résultat n’est pas déclaré hors entraînement. Export des quatre réseaux, DSP adapté, agrégation et validation navigateur restent nécessaires. Pas d’ajout au menu, pas de recommandation automatique issue de ce seul essai.

Reproduction : `TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD=1 python tools/validate-mdx-extra-q.py` uniquement dans l’environnement de recherche et pour les checkpoints officiels Meta récupérés par Demucs. Pas de chargement de fichiers PyTorch arbitraires via la UI.

### 16.5 État des autres validations

Aucun nouveau stem original indépendant fourni, aucune note humaine, aucun essai sur une autre machine. Les autres variantes SCNet et la comparaison UVR complète restent non réalisées. Demucs6 GPU conserve son échec historique documenté : création de session après réécriture float64 ne valait pas inférence finie/PCM valide ; **aucune réussite nouvelle n’est déclarée**. La compatibilité SCNet ne résout pas ce problème et aucune mise à jour globale du runtime n’a été imposée.


Contrôle complémentaire navigateur : Firefox, sur la même machine, a chargé le prototype et la démo synthétique quatre pistes ; Play→Pause et progression des quatre playheads observés, puis arrêt. Ceci est **un smoke test du lecteur**, pas une nouvelle séparation neuronale Firefox ni une validation multi-machines. Le host Chrome a également reçu l’audio YouTube dans son onglet Multitracks avec le bouton Separate disponible. Suite logicielle finale :529 tests réussis,0 échec ; reconstruction dist et contrôle visuel séparés de toute évaluation perceptuelle.


### 16.6 Contrôle logiciel de l’arrêt de séparation

Le25octobre : CleanChords.mp3 complet (47,7s affichées), Demucs4Qualité WebGPU Chrome. Clic Stopper la séparation pendant le calcul ;35,1s publiées conservées, original restauré et bouton désactivé. Durées arrondies issues de la GUI, pas de mesure du délai d’annulation. Ce contrôle fonctionnel ne produit aucun nouveau score instrumental ni classement. Trace : [separation-stop-2026-10-25.json](examples/wam/source-separation/benchmarks/separation-stop-2026-10-25.json).

## 17. Préqualification de la collection locale GHA / Rock Band — 25 octobre 2026

L’utilisateur a fourni une collection locale de morceaux issus de jeux musicaux, avec consigne de ne pas tous les analyser. **Cette section décrit la reconnaissance initiale, avant exécution des modèles ; la campagne suivante figure en§18.** Inventaire :41 dossiers GHA (39 jeux de3 OGG,1 jeu de3 MP3,1 dossier sans audio) et306 MOGG Rock Band, environ9,05 Go au total avec annexes. Seuls3 dossiers GHA /9 fichiers ont fait l’objet d’un contrôle de codecs/durées et de deux fenêtres6s ; seuls3 MOGG ont été examinés par leur en-tête et leurs métadonnées. L’inventaire global des noms ne constitue pas une analyse acoustique des347 entrées.

**Choix fixé avant calcul des sorties : Dream On (Aerosmith), Always On The Run (Lenny Kravitz) et She Sells Sanctuary (The Cult)**, fenêtres20–26s et90–96s. Elles ont été prises sur une grille de44100 Hz depuis un décodage de l’origine jusqu’à96s, après rejet d’un seek rapide produisant448 échantillons supplémentaires dans un essai. Tous les stems sont actifs et finis sur ces fenêtres ; mêmes débuts/durées déclarés par morceau. Ce contrôle ne certifie ni synchronisation musicale, ni originalité, ni pureté des guitares. Les statistiques ne sont pas des mesures de séparation.

Les fichiers rhythm concentrent93,9–97,0% de leur énergie sous250 Hz et les MIDI contiennent PART BASS ; rôle basse plausible, **à confirmer**. FoFiX peut utiliser rhythm pour Bass ou Rhythm. Les mentions INI `tags=master` sont des déclarations de métadonnées, pas une preuve autonome de bandes studio originales. `song.ogg` ne sera pas assimilé au mix commercial ; la recette de sommation ne sera adoptée qu’après vérification des sources complémentaires, sans double ajout de guitare. Certaines sommes nécessitent un gain commun0,6556–0,7140 pour un pic≤0,9 ; aucune normalisation indépendante des cibles n’est prévue.

**Muse — Hysteria** est retenu comme premier complément conditionnel : MOGG lisible12canaux/44100Hz. Roxanne (12canaux/44100Hz) et Enter Sandman (13canaux/36000Hz) restent en réserve. Aucun songs.dta/gain/pan/channel map fourni ; aucune affectation automatique des canaux à un instrument ni downmix de référence validé. Les copies de travail retirent seulement le préambule des trois flux Ogg déjà lisibles, sans réencodage ni déchiffrement.

[Analyse et sélection détaillées](examples/wam/source-separation/LOCAL_STEMS_CORPUS.md), [rapport métadonnées et fenêtres](examples/wam/source-separation/benchmarks/local-stems-preflight-2026-10-25.json). Les12 fichiers sélectionnés sont hachés ; les originaux ne sont pas modifiés et aucun audio n’est redistribué. Les fenêtres et les morceaux seront qualifiés avant toute comparaison. Ces exports compressés dérivés de jeux ne sont pas automatiquement un corpus indépendant de l’entraînement. **Aucune nouvelle note humaine ni classement de modèles ; P4.12d.2b reste en cours.**

## 18. G1 — récupération de stems assignés GHA, 25 octobre 2026

### 18.1 Question expérimentale et références

La campagne G1 prolonge la préqualification§17 sans analyser d’autres morceaux. Elle teste **la récupération d’un stem assigné dans une somme définie**, et non une séparation par rapport au mix commercial ou à une guitare studio exhaustive. Trois morceaux choisis avant les sorties : Dream On, Always On The Run, She Sells Sanctuary ; deux fenêtres6s par morceau,20–26s et90–96s. Unités : six extraits dépendants de trois compositions, pas six compositions indépendantes.

La recette figée est `mix = guitar.ogg + (rhythm.ogg + song.ogg)`. Le backing est la somme rhythm+song. Chaque fenêtre reçoit un gain commun `min(1, 0.9 / pic du mix)`, conservé pour les références. Même si song comporte d’autres guitares, ce test reste défini mathématiquement ; en revanche la distance au seul guitar.ogg ne peut alors pas être interprétée comme l’erreur sur **toutes** les guitares. Aucun score G1 ne remplace les références ou conseils du catalogue. Le stem rhythm est comparé à la sortie bass sous un libellé **provisoire**, sans certification de rôle instrumental.

Les neuf originaux Vorbis stéréo44100Hz sont confrontés aux SHA du préflight. Décodage depuis l’origine jusqu’à96s puis tranches exactes264600échantillons/canal, aucun seek rapide, recherche de retard, padding de référence, EQ ou gain indépendant par modèle. Les WAV IEEE float32, références et mélange ont leurs propres SHA. L’ensemble des24WAV représente six jeux mix/reference/backing/rhythm, pas24 nouvelles observations musicales. Aucune redistribution de ces audios.

### 18.2 Matrice et conditions

BS Roformer SW6 WebGPU et Demucs6 WASM, deux configurations avec guitare dédiée déjà intégrées. Les modèles4sources ne sont pas évalués comme guitares sur ces fichiers : rien n’autorise à assimiler tout leur contenu Autres au seul guitar.ogg. Aucun essai supplémentaire sur les MOGG sans correspondance des canaux.

Exécutions séquentielles dans Chrome, sur la même machine que les diagnostics précédents, avec les poids déjà en cache de l’origine127.0.0.1:8765. macOS14.4.1 constaté par `sw_vers` ; informations GPU et UA dans le rapport. Aucun téléchargement dans la mesure. Les sessions sont recréées entre observations. `jobSeconds` couvre vérification du cache, préparation/session et séparation/publication ; il exclut le décodage des WAV et le calcul des scores. **Ce n’est ni le temps du réseau seul ni une mesure du délai avant lecture.** La charge système et la visibilité de l’onglet ne sont pas journalisées en continu ; aucun classement de vitesse n’est déduit de ces temps exploratoires.

Calcul : `InstrumentQuality.referenceMetrics`, stéréo concaténée avec centrage global, projection scalaire unique pour SI-SDR, SNR sans ajustement du gain, gain projeté, SI-SDR improvement par rapport au mix non séparé. Aucun alignement recherché après observation. Référence et estimations sont sur la même grille. Les scores de backing sont archivés séparément ; ils ne constituent pas une note perceptuelle.

Reproduction : `python tools/prepare-local-game-corpus.py '/chemin/vers/Multipistes rock band etc.'`, puis bouton du banc `examples/wam/source-separation/local-game-evaluation.html` sur un serveur de ce dépôt, avec les deux modèles préinstallés sur cette origine. L’environnement Python requiert NumPy et FFmpeg. Le snapshot réel comprend des changements non committés : les empreintes du code dans [local-game-code-2026-10-25.json](examples/wam/source-separation/benchmarks/local-game-code-2026-10-25.json) complètent le commit parent ; celui-ci ne suffit pas à reproduire G1.

### 18.3 Résultats G1

**12/12 séparations réussies** : six fenêtres × deux configurations. Toutes les sorties stéréo des six sources sont finies et couvrent264600échantillons/canal. Les36 calculs métriques (guitare assignée, backing correspondant, rhythm provisoire) sont valides. Aucun nouveau morceau indépendant ni jugement humain n’est ajouté.

| Morceau | Début | SI-SDR guitare SW GPU | SI-SDR guitare Demucs6 WASM | ΔSI-SDR SW / Demucs6 |
|---|---:|---:|---:|---:|
| 25 Aerosmith - Dream On | 20s | 0.13dB | -0.47dB | 3.83 / 3.24dB |
| 25 Aerosmith - Dream On | 90s | 3.26dB | 1.95dB | 5.23 / 3.93dB |
| 22 Lenny Kravitz - Always On The Run | 20s | 7.38dB | 7.11dB | 9.11 / 8.84dB |
| 22 Lenny Kravitz - Always On The Run | 90s | 7.71dB | 5.99dB | 11.73 / 10.01dB |
| 16 The Cult - She Sells Sanctuary | 20s | 11.23dB | 9.88dB | 12.74 / 11.39dB |
| 16 The Cult - She Sells Sanctuary | 90s | 10.78dB | 10.03dB | 12.49 / 11.74dB |

ΔSI-SDR = amélioration par rapport au mélange construit non séparé ; référence guitar.ogg et non guitare totale. Pas de recherche de décalage. Valeurs complètes, SNR, gain et scores de backing dans [le rapport G1](examples/wam/source-separation/benchmarks/local-game-evaluation-2026-10-25.json). SHA-256 du rapport : `a4d0c337ae398140243742dad7f97c33cfe51a169867394cf105b37af8990e6f`.

| Configuration | Médiane guitare assignée | Médiane ΔSI-SDR | Médiane rhythm/bass provisoire |
|---|---:|---:|---:|
| bs_roformer_sw_6s · webgpu | 7.55dB | 10.42dB | 11.94dB |
| htdemucs_6s · wasm | 6.55dB | 9.42dB | 10.79dB |

### 18.4 Interprétation et limites

Les deux configurations améliorent la ressemblance au stem guitar.ogg par rapport au mélange sur les six fenêtres. La médiane descriptive est plus élevée pour SW sur ce petit lot, mais l’étendue entre extraits est importante : Dream On est nettement plus difficile au regard de cette référence assignée que The Cult. **Il n’est pas établi si cet écart vient de la séparation, du regroupement de guitares dans les stems du jeu ou des deux.** Le meilleur score de référence assignée n’établit pas à lui seul la meilleure guitare isolée à l’écoute. Ces observations ne permettent ni une généralisation à tous les styles ni une affirmation d’indépendance de l’entraînement.

La comparaison provisoire rhythm/bass donne des médianes11,94dB SW et10,79dB Demucs6 ; elle reste un diagnostic de proximité aux fichiers fournis. Tant que le rôle n’est pas confirmé musicalement, ces nombres ne sont pas des scores certifiés de basse. Les durées médianes par job sont31,42s SW WebGPU et92,55s Demucs6 WASM (plages28,91–38,79s et88,24–117,08s). C’est une mesure de cette recette et de ces sessions rechargées, sans contrôle continu de charge ; aucun changement des histogrammes ou du modèle conseillé.

**Volet automatisé G1 terminé.** Qualification instrumentale, écoute aveugle par de vrais participants, correspondance des canaux MOGG, validation indépendante, autres machines et comparaison UVR demeurent ouvertes. Les trois fichiers MOGG réservés n’ont pas été séparés. Les sorties G1 ont servi aux métriques en mémoire, sans banque d’audio estimé persistante ; une future écoute des sorties demandera de relancer la configuration choisie. Les références/extraits préparés restent disponibles localement.

Contrôles logiciels :537 cas de tests Node réussis,0 échec, plus3 tests Python de préparation (gain commun, rejets et WAV float/interleaving) et vérification des24SHA de WAV. Ce sont des validations logicielles, distinctes des12 inférences et d’une éventuelle étude perceptuelle. Le plan WebNN est désormais consigné dans [WebNN_SUPPORT_SPECIFICATIONS.md](WebNN_SUPPORT_SPECIFICATIONS.md) ; aucune inférence WebNN n’a été effectuée pendant G1.

## 19. G2 — préparation de qualification et d’écoute, 25 octobre2026

L’utilisateur confirme ne pas connaître le contenu exact des stems. Aucune réponse de pureté/exhaustivité ou de rôle basse n’est inférée de sa déclaration. Nouveau lecteur `game-reference-review.html` : six fenêtres GHA seulement, mix/reference/backing/rhythm, SHA vérifiés, volume commun, position conservée, grille Oui/Non/Incertain et export des observations. Pseudonyme, chaîne d’écoute et événements de lecture des trois références requis pour enregistrer ; ces événements ne prouvent pas une écoute attentive. La qualification reste une déclaration d’auditeur, distincte d’une provenance studio ou d’un corpus indépendant. **Zéro réponse humaine collectée** pendant la vérification.

Contrôle de bout en bout du transfert du cas Dream On20s au banc de référence : deux **répétitions** de séparations déjà réalisées en G1, Demucs6 WASM et SWGPU, sorties finies264600échantillons/canal, gain de préparation1. Scores guitare−0,465072dB et0,127530dB, identiques aux valeurs G1 sur ce cas. Ces deux exécutions supplémentaires ne constituent ni de nouveaux extraits ni des réplications musicales indépendantes. Rapport [game-review-technical-2026-10-25.json](examples/wam/source-separation/benchmarks/game-review-technical-2026-10-25.json). La vue aveugle masque les modèles, présente référence explicite/cachée et trois candidats anonymisés ; champs de notes vides, révélation désactivée. L’agent n’a pas attribué de notes. Les estimations restent en RAM dans l’onglet laissé ouvert, sans persistance audio nouvelle.

UVR : six entrées WAV aux noms uniques préparées par `tools/prepare-uvr-review-inputs.py`, identiques octet par octet aux mixes G1 ; hashes vérifiés avant toute copie, données ignorées par Git. Les noms évitent les collisions d’exports tous appelés mix. Le [protocole d’écoute et UVR](examples/wam/source-separation/GAME_REFERENCE_REVIEW.md) demande modèle/checkpoint, précision, segment/overlap/shifts, device et version réels, contexte identique et absence de normalisation individuelle. **Aucune inférence UVR ni nouvelle comparaison à UVR n’est revendiquée.** Ses sorties restent à produire puis à intégrer à la revue.

## 20. W1 — disponibilité WebNN native dans Canary, 25 octobre2026

Diagnostic système indépendant des mesures musicales. Canary158.0.8122.0 arm64, version constatée dans sa page À propos, macOS14.4.1 de la machine courante. Page locale en contexte sécurisé et crossOriginIsolated. Un graphe natif float32 multiplie l’entrée `[1,2]` par la constante colonne `[3,4]`, résultat attendu11. Window puis Worker, quatre préférences explicites par environnement : défaut, CPU, GPU, NPU. Entrées/sorties et source du graphe figurent dans les rapports ; aucun poids audio, ORT ou traitement de morceau.

**8/8 graphes réussis dans Canary**, tous résultat11. **Chrome normal154 : API absente**, huit observations `unavailable`, aucune inférence de substitution. L’agent n’a modifié aucun flag. Des essais synthétiques préalables non archivés ont servi à ajuster l’affichage du rapport ; la série archivée ne représente pas un benchmark froid indépendant. La compilation mesurée est celle d’un seul matmul, pas d’un modèle audio.

Le diagnostic transmet à la fois `deviceType` et `accelerated` pour distinguer les générations d’API. Les clés inconnues peuvent être ignorées. `context.accelerated` n’est pas exposé sur cette installation ; **processeur effectivement employé inconnu**. Une préférence NPU réussie ne prouve donc pas l’usage du Neural Engine. Aucune mesure de gain NPU, consommation ou débit audio ; aucune parité de modèle musical WebNN. Tests logiciels de résultats incorrects, refus/perte de contexte simulés et nettoyage séparés de ces observations matérielles.

Rapports bruts : [Canary](examples/wam/source-separation/benchmarks/webnn-canary-capabilities-2026-10-25.json), [Chrome normal](examples/wam/source-separation/benchmarks/webnn-chrome-capabilities-2026-10-25.json), avec empreintes des quatre fichiers du diagnostic. WNN-1 terminé au niveau synthétique ; WNN-2 runtime isolé et WNN-3 Demucs4/parité restent à réaliser selon [WebNN_SUPPORT_SPECIFICATIONS.md](WebNN_SUPPORT_SPECIFICATIONS.md). Ce résultat ne résout pas la dérive Demucs6 GPU.

Empreintes des rapports G2/W1 :

- `game-review-technical-2026-10-25.json` : `7cc620af42550699df574d4dac7ff875ff538c85ebcbf358e9e7f70beebb45db`.
- `webnn-canary-capabilities-2026-10-25.json` : `90c0001bbb621457456a3b6ba3ea6582d120b8b3a1029cfbf0a9cf2cac69ba48`.
- `webnn-chrome-capabilities-2026-10-25.json` : `d1d15aa4673f1498c9cdce450044f5d00e4ac3c8a1c2d2c91b4a3a3e8bd8a1c8`.

## 21. W2 — runtime isolé et parité audio Demucs4 WebNN, 25 octobre2026

### 21.1 Artefacts et audit

Runtime de recherche **onnxruntime-web1.30.0**, version reçue par le tag latest du registre npm officiel pendant cette session. Ce choix concerne le paquet JavaScript, pas le numéro de la dernière release C++ GitHub. Archive SHA-256 `d2228df7e4616bc3348bf504ee888f3bec43789a273f0a63f3e68d203ce3bf71`, SRI SHA-512 imposé dans `tools/prepare-webnn-lab.py`. Extraction autorisée de trois assets statiques, sans script npm, licence MIT et table d’opérateurs de la version1.30.0 récupérées séparément sur le dépôt officiel. Installation locale ignorée sous third_party, **ORT1.22 de production inchangé**. Manifeste avec tailles/hashes : [webnn-runtime.json](examples/wam/source-separation/research/webnn-runtime.json).

Modèle inchangé : Demucs4 ONNX de bakkot/demucs-js,174263526octets, SHA `da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748`, révision45f990170d9571379a9dbd3bbdd1c7591b26864c. Restriction personnel/recherche du fournisseur maintenue. Audit par `tools/audit-webnn-demucs.py` : opset17,3268nœuds,537initializers tous FLOAT ; entrées `[1,2,343980]` et `[1,4,2048,336]`, sorties spectrales `[1,4,4,2048,336]` et temporelles dont quatre dimensions sont symboliques dans le fichier. Inventaire des opérateurs/attributs, formes et poids constants dans [l’audit](examples/wam/source-separation/research/webnn-demucs4-audit.json). Constant, ConstantOfShape, Mod et Range ne figurent pas dans la table épinglée ; cela ne suffit pas à prévoir un échec, certaines opérations de forme pouvant être repliées comme constantes. Aucun graphe réécrit, quantifié ou réduit pour ces essais.

### 21.2 Protocole et contrôles

Même machine, Canary158, contexte sécurisé/crossOriginIsolated. Chaque entrée est exécutée dans cet ordre : référence CPU/WASM ORT1.22, contrôle CPU/WASM ORT1.30, candidate WebNN ORT1.30. CPU de référence signifie ici le **même ONNX exécuté dans ORT Web WASM**, pas une nouvelle référence PyTorch. Toutes les étapes lourdes, le DSP et les métriques restent dans des Workers. NumThreadsWASM=1, sessions et Workers recréés entre exécutions. Poids et assets locaux contrôlés par SHA avant chargement, aucune récupération de poids distante dans Canary.

Même `OnnxCoreModel`, même `vendor/demucs-js/apply.js`,44100Hz stéréo, contexte fixe343980échantillons (7,8s), overlap0. Un extrait1s n’implique donc pas un réseau de contexte1s. Aucun recalage, gain ou filtrage des sorties. Les huit canaux doivent avoir la longueur exacte et des échantillons finis. La comparaison est faite avec les sorties CPU transférées au Worker candidat.

Seuils inscrits dans le banc **avant les premières exécutions** : RMS relatif global≤1e−3 et max absolu≤0,005. Garde supplémentaire par source : RMS relatif≤1e−3 si RMS de référence≥1e−5 ; sous ce plancher le contrôle absolu reste appliqué. Ce garde a échoué sur certaines sorties de très faible niveau ; **aucun seuil n’a été modifié pour reclasser les essais**. Les rapports conservent distinctement le résultat global et le garde par source.

Entrées initiales : signal stéréo déterministe1s (sinusoïdes220/330Hz et880Hz), puis mélange G1 DreamOn20–26s. Une série avec préférence GPU, puis une série CPU pour examiner l’effet de cette préférence. Après observation des écarts relatifs sur des sorties faibles, ajout exploratoire du cas Falcon6s de Q2 : son identité est fixée avant calcul de ses sorties. Ce troisième cas n’est pas un holdout préenregistré et aucun autre extrait n’a été sélectionné d’après ses scores. Les SHA WAV/PCM sont dans les rapports. L’exposition à l’entraînement ne sert pas à inférer une qualité instrumentale : on compare numériquement le même graphe, pas sa généralisation.

WebNN reçoit un MLContext réel. Wrappers de délégation sur les méthodes publiques `dispatch` et `MLGraphBuilder.build` : **un graphe construit et un dispatch observé pour chacune des cinq candidates**. Sessions/contextes libérés avant publication des résultats. Cela prouve une exécution WebNN, sans chiffrer le fallback WASM ni identifier le processeur physique. Les options deviceType et accelerated peuvent appartenir à des générations différentes de l’API ; clés inconnues possiblement ignorées et context.accelerated non exposé. Pas de flags changés, aucun NPU certifié.

### 21.3 Résultats

**15 exécutions réussies au sens PCM fini et aligné : neuf musicales et six synthétiques, trois entrées distinctes.** Cinq références ORT1.22, cinq contrôles ORT1.30WASM et cinq candidates WebNN. Les deux configurations CPU sont très proches : RMS relatif global maximal9,59×10−7, gardes par source tous réussis. Ce contrôle isole l’effet du changement de runtime de celui du provider WebNN.

| Entrée | Préférence WebNN demandée | RMS relatif global | Max absolu | Garde par source | Session | Exécution+DSP |
|---|---|---:|---:|---|---:|---:|
| Synthèse1s | GPU | 0,00924% | 0,0000238 | Échec drums/bass | 12,191s | 10,296s |
| DreamOn6s | GPU | 0,03949% | 0,0001561 | Échec drums/vocals | 12,102s | 2,281s |
| Synthèse1s | CPU | 0,00928% | voir JSON | Échec drums/bass | 8,060s | 6,506s |
| DreamOn6s | CPU | 0,03921% | voir JSON | Échec drums/vocals | 7,895s | 6,370s |
| Falcon6s | GPU | 0,06110% | 0,0007350 | Réussite quatre sources | 12,225s | 2,442s |

Tous les RMS relatifs globaux sont sous0,1%, et tous les maximums sous0,005. Sur Falcon, RMS de référence de chaque source0,0618–0,0928 ; erreurs relatives drums/bass/other/vocals respectivement0,04895/0,06700/0,05922/0,07789%, toutes dans le garde initial. Sur DreamOn, les sorties drums/vocals de référence sont proches de0,000183/0,000082RMS : erreurs relatives~0,95/0,65%, mais erreurs absolues maximales~1,31×10−5/4,34×10−6 pour la préférence GPU. Le synthétique produit également des sources de très faible niveau. Ces résultats motivent l’examen d’une tolérance mixte absolue/relative, mais **ne constituent pas sa validation rétroactive**. Aucune conclusion d’inaudibilité sans écoute.

La préférence CPU ne supprime pas les dépassements faibles. La cause numérique précise (réductions, normalisation, précision/ordonnancement des kernels ou conversion plateforme) n’a pas été localisée. Ni une erreur FP16 ni une responsabilité du Neural Engine ne sont établies par ces seules différences.

### 21.4 Temps, portée et suite

Sur Falcon, référence WASM1.22 : création0,690s et exécution+DSP10,713s ; WebNN demandéGPU : création12,225s et exécution+DSP2,442s. **Le premier essai complet WebNN est donc ici plus long que le CPU**, malgré une exécution après préparation plus courte. Ces chiffres excluent de la colonne session les vérifications locales, incluent les coûts paresseux possibles dans l’inférence et ne mesurent pas le délai jusqu’au premier son. Des tests logiciels ont également tourné pendant une partie des essais ; charge concurrente non isolée. Pas de trois répétitions chaudes, de cache OS contrôlé, de lecture concurrente ou de benchmark multi-machine : aucun facteur d’accélération général ni défaut WebNN déduit. Réutiliser la session pour plusieurs segments reste une hypothèse à mesurer.

Contrôle d’annulation additionnel : clic après dernière phase observée «vérification des poids» du premier Worker ; état cancelled, zéro ligne terminée, boutons/selecteurs réactivés, pas de re-préparation automatique. Pas de mesure de latence d’arrêt ni d’inférence supplémentaire comptée. [Trace logicielle](examples/wam/source-separation/benchmarks/webnn-demucs4-cancel-2026-10-25.json).

WNN-2 runtime/audit **DONE** ; WNN-3 reste **CURRENT** pour le traitement prospectif et la stabilité des sorties faibles. Tous les essais initiaux, y compris les gardes échoués, restent publiés. Pas d’ajout WebNN au catalogue du host, pas de nouveau conseil automatique, aucun nouvel avis humain. La tolérance future devra être motivée avant une nouvelle campagne et testée sur davantage d’entrées. WNN-4 streaming, réutilisation de session, premier audio, mémoire/lecture concurrente restent à faire. Demucs6 GPU reste un problème distinct.

[Résumé machine et liens vers les rapports](examples/wam/source-separation/benchmarks/webnn-demucs4-summary-2026-10-25.json), [commandes et protocole du laboratoire](examples/wam/source-separation/WEBNN_DEMUCS4_LAB.md). Code CPU/Falcon identifié avant chaque série par `research/webnn-demucs4-code*.json`, copies locales sous third_party/nam-webnn-probe/code-cpu et code-falcon. Première série GPU effectuée avant ajout du sélecteur de préférence : pas de snapshot complet antérieur, limite de traçabilité explicitée dans le résumé. Runtime, poids, DSP et paramètres de cette série restent identifiés. Les rapports ont été exportés par le bouton de la page réelle, puis copiés depuis Downloads, sans lecture d’état caché du navigateur.

Empreintes W2 :

- `webnn-demucs4-gpu-preference-2026-10-25.json` : `9bb2c9ce4f90a578e54e95926ea5fa07b4aa3f16dbfd79496f67994a11bd8824`.
- `webnn-demucs4-cpu-preference-2026-10-25.json` : `1a201fa383d7ff93c6878b375756e91adb3346d0ba61595df889f45a961eaab3`.
- `webnn-demucs4-falcon-gpu-2026-10-25.json` : `265b5c74d49491940fa7af7eb7f87a8977c41fa342fab258852a3340d5d3e08d`.
- `webnn-demucs4-summary-2026-10-25.json` : `2639c5aac588044264c2fde7afeaed3260638c6367107d8a00f8ab62f34976e9`.
- `webnn-demucs4-cancel-2026-10-25.json` : `83245d5ab6288c7122fd5a9c44c8aa9975e7cda6f102a0d8fd6a9b745c0d8733`.

## 22. W3 — choix CPU/GPU/NPU et contrôle de la préférence NPU

Demande utilisateur du25octobre2026 : choisir CPU/GPU/NPU avec WebNN. Le sélecteur du laboratoire devient explicite et mémorisé localement. Validation partagée WebNNDevice.js ; sélection transmise sans changement au MLContext. Vérification GUI dans Canary : NPU sélectionné puis rechargement, valeur conservée. Tests de mapping des trois choix, rejet des valeurs invalides, restauration et stockage indisponible. Aucun nouveau paramètre de production dans le host tant que l’intégration n’est pas validée.

Contrôle réel supplémentaire : Falcon6s, même WAV/poids/DSP/runtime que W2 ; trois nouvelles exécutions, référence WASM1.22, contrôle WASM1.30 et candidat WebNN1.30 avec `{deviceType:'npu', accelerated:true}`. Trois PCM finis/alignés et comparaison réussie. Un build et un dispatch WebNN observés. Erreur globale relative0,000610958789 (0,06110%), max absolu0,000734977 ; gardes des quatre sources réussis. Valeurs identiques à la précédente préférence GPU : **aucune identification certaine du processeur physique ni preuve d’un calcul sur Neural Engine**. Répétition d’un extrait déjà étudié, pas une observation musicale indépendante.

Session candidate11,925s et exécution+DSP2,302s, essai unique avec caches non contrôlés, sans classement de vitesse. Cette série ajoute trois exécutions musicales aux15 de W2, qui restent intactes ; pas de nouveau score de qualité ou de préférence humaine. Rapport : [webnn-demucs4-falcon-npu-preference-2026-10-25.json](examples/wam/source-separation/benchmarks/webnn-demucs4-falcon-npu-preference-2026-10-25.json), SHA-256 `466cf2a923633d2086d3a72bc20d2acfbd4340a790cced1566a4da16440d8587`. Code identifié avant essai dans `research/webnn-device-code.json`, copies locales conservées dans third_party/nam-webnn-probe/code-npu. Le champ note générique du banc mentionne six runs ; la série Falcon contient bien trois lignes, comme son protocole de contrôle W2.

Suite logicielle :560 tests Node réussis,0 échec. Les échecs faibles niveaux de W2 restent conservés ; l’ajout du choix NPU ne termine pas WNN-3 et aucun modèle WebNN n’est ajouté au catalogue de production.

## 23. W4 — comparaison retenue en session, avec et sans WebNN

### 23.1 Question, matériel et protocole

Demande utilisateur : comparer le quatre pistes par défaut avec « six pistes RS », interprété comme **BS Roformer SW6**, en WASM/WebGPU puis WebNN CPU/GPU/NPU. La politique de recommandation rapide sélectionne Demucs4 ONNX qualité, distinct du modèle court Preview2s. Aucun choix par défaut du host n’est modifié par cette campagne.

Machine vérifiée par `sysctl` : **Apple M3 Max**,14cœurs physiques/logiques,38654705664octets de RAM (**36Gio**), macOS14.4.1/23E224. Canary158.0.8122.0 ; API WebNN en Worker. Les données sont de nouvelles mesures locales du25octobre2026. Elles ne remplacent pas les séries W2/W3 ni celles d’autres jours.

Protocole fixé avant lancement : `webnn-falcon-6s-retained-session-v1`. Une session par configuration, première exécution puis **deux répétitions de la même entrée dans la même session**. La médiane de ces deux répétitions est leur moyenne arithmétique ; ce ne sont pas deux sessions indépendantes. Ordre fixe, calculs séquentiels. Pas de suite de tests/build pendant les intervalles chronométrés.

Entrée commune : mix Falcon existant Q2,6s stéréo44100Hz,264600frames, WAV SHA229f72ea5cce679cf0e388641fa576318a0d4435325b65a88fcfd421f62f164a, PCM planaire Float32 SHAbe55c410060ad0ddc5b1197078870e5836830d2d1daef04150b5849a93b2ff6e. La provenance musicale et les limites de ce contrôle restent celles de§21 : ce n’est pas un nouveau corpus indépendant. Les quatre exports vérifient le même SHA PCM.

- Demucs4 : poids originaux174263526octets, SHAda9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748, contexte343980frames (7,8s), une fenêtre remplie pour6s.
- SW6 : poids FP16 stockés352778874octets, SHAd3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444, deux fenêtres4s/recouvrement1s, six sources stéréo. GPU : neuf étapes coopératives existantes ; WASM/WebNN : graphe monolithique. Comparaison de pipelines, pas du seul silicium.
- ORT1.30.0 isolé pour les cinq backends, sans remplacement du runtime du host. Contrôle supplémentaire WebGPU ORT1.22.0 sur chaque modèle. WASM un thread, proxy désactivé ; GPU sans activation de shader-f16.
- Fetch/hachage/import séparés ; « session » comprend contexte WebNN et compilation. « Première » et « répétitions » comprennent DSP, réseau et assemblage. Les validations/copies/transferts finaux restent hors intervalle. Premier PCM interne au Worker ne signifie pas premier son audible. Aucune lecture concurrente évaluée ici.

### 23.2 Résultats

Tous les temps ci-dessous sont en secondes. **RTF = temps de séparation /6**. Un RTF inférieur à1 caractérise ce traitement d’extrait, pas la garantie d’un streaming continu avec lecture.

| Modèle | ORT | Backend | Session (s) | Première (s) | Répétitions médiane (s) | RTF | État |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Demucs 4 | 1.22.0 | webgpu | 1.528 | 4.073 | 2.487 | 0.414 | ok |
| Demucs 4 | 1.30.0 | wasm | 0.771 | 10.664 | 10.525 | 1.754 | ok |
| Demucs 4 | 1.30.0 | webgpu | 0.868 | 2.709 | 2.465 | 0.411 | ok |
| Demucs 4 | 1.30.0 | webnn / cpu demandé | 7.695 | 5.588 | 5.927 | 0.988 | ok |
| Demucs 4 | 1.30.0 | webnn / gpu demandé | 11.885 | 1.989 | 2.038 | 0.340 | ok |
| Demucs 4 | 1.30.0 | webnn / npu demandé | 12.026 | 2.225 | 2.054 | 0.342 | ok |
| BS Roformer SW 6 | 1.22.0 | webgpu | 1.432 | 7.225 | 5.799 | 0.966 | ok |
| BS Roformer SW 6 | 1.30.0 | wasm | 2.147 | 70.482 | 71.069 | 11.845 | ok |
| BS Roformer SW 6 | 1.30.0 | webgpu | 1.512 | 6.798 | 6.225 | 1.037 | ok |
| BS Roformer SW 6 | 1.30.0 | webnn / cpu demandé | — | — | — | — | WebNN context lost: WebNN context is lost due to connection error. |
| BS Roformer SW 6 | 1.30.0 | webnn / gpu demandé | 67.887 | 12.188 | 12.553 | 2.092 | ok |
| BS Roformer SW 6 | 1.30.0 | webnn / npu demandé | 64.796 | 14.718 | 9.717 | 1.619 | ok |

**Effectif archivé :12 configurations distinctes,11 réussies ×3 exécutions =33 séparations complètes du même extrait ; une configuration CPU WebNN SW échouée avant inférence.** Les tentatives interrompues sont consignées en§23.3 et ne deviennent ni des mesures de débit ni de nouveaux morceaux.

Dispersion des deux répétitions : Demucs4 WASM10,450–10,601s ; WebGPU1.30 2,357–2,572s ; WebNN CPU5,648–6,206s ; GPU1,963–2,113s ; NPU1,992–2,116s. SW WASM70,383–71,755s ; WebGPU1.30 6,054–6,396s ; WebNN GPU10,845–14,261s ; NPU8,858–10,575s. Deux valeurs ne suffisent pas à un intervalle de confiance ou à un classement stable GPU/NPU.

### 23.3 Échecs et reprise

Une première compilation SW WebNN CPU a signalé `MLGraphBuilder: Context is lost` dans la console native ; ORT laissait sa promesse de création pendante. Annulation par le bouton après observation, export initial conservé. Une première reprise avec garde sur `MLContext.lost` a affiché l’échec CPU et commencé GPU, mais le rapport de cette reprise n’a pas été exporté avant une interruption globale. Au retour, Canary proposait la restauration après arrêt incorrect et le serveur8765 était arrêté. **Cause non déterminée ; pas de causalité GPU/crash affirmée et aucun temps attribué à cet essai GPU.**

Après relance du serveur et reprise du navigateur : trois essais isolés, NPU puis GPU puis CPU, avec export après chacun et sauvegarde des métadonnées dans localStorage. NPU et GPU produisent leurs douze canaux sur trois passages ; CPU échoue à nouveau par perte de contexte, environ10,148s après début du Worker, avant toute sortie. Cette dernière valeur inclut l’intégrité/import ; elle n’est pas un temps de séparation ni une compilation terminée.

La garde de laboratoire observe la promesse publique [MLContext.lost](https://www.w3.org/TR/2026/CRD-webnn-20261021/#dom-mlcontext-lost). Aucun repli silencieux ne remplace les échecs. Les flags ne sont pas modifiés par l’agent ; un bandeau préexistant `WebMachineLearningNeuralNetwork` est visible après reprise. La nouvelle sauvegarde restaure un rapport, sans relancer automatiquement une inférence.

### 23.4 Exécution observée et validation numérique

Demucs4 WebNN :1graphe compilé et3dispatchs natifs par configuration, un par passage. SW WebNN GPU/NPU :**25graphes compilés et150dispatchs**, soit50par passage de6s (deux fenêtres). Une exécution WebNN est donc observée, mais la couverture des opérateurs en repli WASM et les transferts ne sont pas quantifiés. **Le matériel physique CPU/GPU/NPU utilisé reste inconnu.** Le paramètre demandé n’est pas une attestation d’exécution sur Neural Engine ; les résultats GPU/NPU Demucs4 sont numériquement identiques selon les métriques disponibles.

Les33 sorties complètes sont finies, avec les longueurs et canaux attendus. Les deux répétitions sont bit-identiques à la première au sein de chacune des11 configurations (vérification PCM hors chronométrage). Demucs4 contre WASM1.30 : RMS relatif global WebGPU0,000610727 ; WebNN CPU0,000605988 ; GPU/NPU0,000610977. SW WebGPU1.30 contre WASM1.30 :0,0000272836.

**Limite : les reprises SW WebNN ne disposent pas d’une référence PCM WASM dans leur page après interruption ; aucune parité inter-backend SW WebNN n’est revendiquée.** Les statistiques de répétition ne remplacent pas ce contrôle, ni des écoutes aveugles. L’admission audio et les cas faibles de WNN-3 restent ouverts.

### 23.5 Interprétation et décision provisoire

1. **Demucs4** : WebGPU1.30 environ4,27fois plus rapide que WASM sur les répétitions. WebNN GPU demandé réduit encore le temps d’environ17,3% (2,038s contre2,465s), mais prépare sa session en11,885s contre0,868s. Session+premier passage =13,874s contre3,577s, hors fetch/import : le gain répété n’implique pas une meilleure attente initiale. Réutiliser une session peut amortir ce coût ; ce petit essai ne fixe pas un seuil général pour des morceaux longs.
2. **SW6** : WebGPU1.30 est environ11,42fois plus rapide que WASM. Les modes WebNN GPU/NPU demandés sont plus lents que WebGPU dans cette campagne et exigent environ65–68s de préparation ; CPU WebNN n’est pas exploitable dans l’essai actuel. Ni la quantification ni le découpage WebNN des graphes n’ont été optimisés ici.
3. **Production** : WebGPU1.22 donne2,487s pour Demucs4 et5,799s pour SW6. Les contrôles1.30 donnent2,465s et6,225s ; pas de justification à une mise à jour globale du runtime fondée sur cette seule campagne. Conserver WebGPU comme recommandation actuelle et WASM en secours. Pas de recommandation NPU spécifique sans preuve matérielle et sans validation audio.
4. **Portée** : une machine, un extrait, une session par configuration, deux répétitions, ordre non contrebalancé, caches OS/thermique/charge globale et onglets de fond non contrôlés. Les mesures SW WebNN sont postérieures à l’interruption : comparaison exploratoire de deux sessions d’observation, pas expérience à état système constant. Les journaux de visibilité archivés sont vides, sans prouver l’absence de toute charge extérieure. Aucune consommation électrique ou étude perceptuelle nouvelle.

### 23.6 Artefacts et reproductibilité

- [Protocole détaillé](examples/wam/source-separation/WEBNN_PERFORMANCE.md), page source `http://127.0.0.1:8765/examples/wam/source-separation/webnn-performance.html`.
- [Tableau consultable](examples/wam/source-separation/benchmarks/webnn-performance-results-2026-10-25.html) et [synthèse JSON dérivée](examples/wam/source-separation/benchmarks/webnn-performance-falcon-summary-2026-10-25.json), avec SHA des quatre exports sources inchangés.
- Rapports bruts : [initial](examples/wam/source-separation/benchmarks/webnn-performance-falcon-initial-2026-10-25.json), [SW CPU](examples/wam/source-separation/benchmarks/webnn-performance-falcon-sw-cpu-2026-10-25.json), [SW GPU](examples/wam/source-separation/benchmarks/webnn-performance-falcon-sw-gpu-2026-10-25.json), [SW NPU](examples/wam/source-separation/benchmarks/webnn-performance-falcon-sw-npu-2026-10-25.json). Checkpoint antérieur et observation de console conservés séparément.
- Empreintes avant essais : `research/webnn-performance-code.json`, puis `-recovery.json` et `-recovery2.json`. Copies exactes locales sous `third_party/nam-webnn-probe/code-performance*`. Les améliorations ultérieures de présentation/checkpoint ne sont pas rétroactivement attribuées aux mesures antérieures.
- Générateur du tableau : `python3 tools/summarize-webnn-performance.py <rapport.json> --output <tableau.html>`. Les erreurs n’obtiennent pas de score de vitesse. Le runtime et les poids du laboratoire restent locaux/ignorés.

## 24. Q-STUDIO-WNN — Qualification intégrée, 26 octobre 2026 [EN COURS]

### 24.1 Question et état de la campagne

Vérifier le chemin expérimental Demucs4 de Studio, avec les mêmes poids que le produit, avant de qualifier WebNN CPU/GPU/NPU : parité numérique par instrument, preuve de dispatch, temps de préparation et premier PCM disponible, arrêt et réactivité. Cette campagne est distincte de WNN-3/W4 (§21–23), effectuées dans une branche de recherche et d'autres versions/configurations de navigateur. Leurs résultats historiques ne valident pas automatiquement le code d'intégration actuel.

**État du premier passage, avant réception du rapport utilisateur (voir§24.7) : qualification native bloquée par l'accès à Canary.** Le connecteur ne voit que Chrome standard ; l'accès natif à Canary a expiré. Aucune flag n'a été modifiée et aucun lancement CDP/headless parallèle n'a été utilisé. Les trois préférences ont été essayées dans le Chrome réellement connecté : elles échouent explicitement faute d'API WebNN dans le Worker. Ce n'est pas un essai d'inférence native échoué, ni un repli WASM compté comme réussite WebNN.

### 24.2 Entrée et identité du système

- **Audio** : les six premières secondes de `slow-motion-dream.mp3`, stéréo décodée nativement à44,1kHz,264600frames/canal. Le fichier MP3 complet,262867octets, provient de Spleeter au commit`c8854001ac8acad34a9bc2bd15f28475541828b1`, SHA256`4b431d535d235bd81b62f816f08c3f1afb6679d2706d84b3b75903b7df909507`. *Slow Motion Dream*, Steven M Bryant,2011, avec CSoul, Alex Beroza et Robert Siekawitch, CC BY3.0 ; attribution détaillée dans [la notice](examples/wam/source-separation/fixtures/music/NOTICE.md). Mélange musical réel, sans stems studio de référence dans ce test. Le SHA du PCM stéréo planaire décodé est consigné dans le JSON. Pas de SI-SDR ni d'évaluation perceptuelle nouvelle.
- **Poids** : Demucs4 ONNX core,174263526octets, SHA256`da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748`, fenêtre fixe343980frames/7,8s. Entrée6s remplie selon le DSP existant, sans modifier le graphe pour cette expérience. Sources dans l'ordre drums/bass/other/vocals, stéréo.
- **Runtime** : contrôles production ORT1.22.0 pour WASM/WebGPU ; candidat WebNN ORT1.30.0 isolé et référence WASM1.30 dans son Worker. NumThreads1, proxyWASM désactivé. Les opérateurs non pris en charge par WebNN peuvent passer par WASM ; le nombre de dispatchs ne quantifie pas cette couverture et n'atteste pas un Neural Engine.
- **Machine** : Apple M3 Max,14cœurs physiques/logiques,38654705664octets de RAM, macOS14.4.1/23E224, lus depuis le système. UAChrome155.0.0.0 ; sa chaîne générique «Intel Mac OS X10_15_7» n'est pas utilisée pour identifier le processeur réel.
- **Code** : branche`codex/studio-integration`, HEADde base`f7ffec6b1285b89098352262656be5fdb1295e91`, modifications non committées. Empreintes de11fichiers fixées avant la seconde série dans [le manifeste de sources](docs/evaluations/studio-webnn-code-2026-10-26.json). Ni les poids, ni les runtimes, ni les corpus historiques n'ont été remplacés.

### 24.3 Protocole et définitions

Un passage par configuration, dans l'ordre WASMproduction → WebGPUproduction → WebNNCPU → GPU → NPU. Worker/session neufs à chaque passage, sans préchauffage caché. Même PCM et mêmes poids, chargés localement puis vérifiés par SHA avant les passages. Le temps de chargement/hachage des assets est rapporté séparément. Pas de fallback dans le banc : une erreur reste une erreur. Les calculs sont séquentiels ; pas de build ni de suite de tests pendant la seconde série. Onglet visible au départ, aucun événement de changement de visibilité enregistré. Autres onglets/processus, température et charge globale non contrôlés : résultats exploratoires, pas un benchmark statistique.

- **Wall time** : de la création du Worker à réception du résultat, incluant imports runtime, copies/transferts des poids, session, DSP et collecte des paquets ; hors fetch/hachage préalable et comparaison numérique finale avec le contrôle.
- **Session** : création de session dans le Worker ; WebNN rapporte séparément contexte, session candidate et session WASMde référence.
- **Candidate inference** : séparation/DSP côté Worker ; ce n'est pas la durée du seul réseau neuronal ni une mesure de débitNPU.
- **Premier audio** : réception du premier paquet PCM dans le thread principal. Ce n'est **pas** une mesure de démarrage audible du haut-parleur. Le banc ne joue pas l'audio et ne reproduit pas toute la GUIStudio.
- **Chemin WebNN gardé** : coût de référence WASM1.30 et comparaison par rôle mesurés séparément, mais inclus dans l'attente avant publication. Les performances de ce chemin ne doivent pas être présentées comme celles d'un moteur WebNN sans vérification.
- **Parité finale** : comparaison dans un autre Worker avec le premier contrôle WASMproduction1.22. La première ligne WASMse compare à elle-même : elle définit la référence, et son résultat nul n'est pas une validation indépendante.
- **Seuils inchangés** : RMSrelatif global et par rôle≤0,001 ; erreur absolue max≤0,005 ; un rôle de RMS<1e−5 n'utilise pas de dénominateur relatif instable. Valeurs finies et longueur exacte obligatoires. Aucun relâchement a posteriori.
- **Réactivité** : timer UI100ms pendant tout le lancement ; son intervalle max n'isole pas les phases (fetch/hash/copie/session/inférence) et ne prouve pas la fluidité de la lecture Studio. Arrêt manuel essayé séparément pendant une inférenceWASM.

Les API de contexte/perte de contexte suivent la [spécification WebNN W3C du21octobre2026](https://www.w3.org/TR/2026/CRD-webnn-20261021/) ; le runtime isolé suit les [instructions officielles ORTWebNN](https://onnxruntime.ai/docs/tutorials/web/ep-webnn.html). Les préférences CPU/GPU/NPU restent des demandes, pas une preuve du périphérique effectif.

### 24.4 Résultats de la série sans build/test concurrent

| Configuration demandée | Résultat observé | Premier PCM reçu | Wall time | Session | Séparation/DSP |
| --- | --- | ---: | ---: | ---: | ---: |
| ProductionWASM1.22 |4sources finies et alignées, référence |36,139s |36,240s |4,616s |31,433s |
| ProductionWebGPU1.22 |4sources finies et alignées, seuil strict basse dépassé |7,686s |7,781s |3,237s |4,342s |
| WebNNCPU1.30 |API absente dans le Worker |— |— |— |— |
| WebNNGPU1.30 |API absente dans le Worker |— |— |— |— |
| WebNNNPU1.30 |API absente dans le Worker |— |— |— |— |

Les refus WebNN en≈72–77ms sont conservés dans les JSON, **pas** interprétés comme temps de séparation. Sur ce passage uniquement, le rapport des temps totaux WASM/WebGPU est≈4,66. Une seule répétition, des sessions neuves et une seule composition ne permettent pas d'en déduire un classement général ou un changement du modèle par défaut. La préparation n'est pas amortie.

WebGPUcontreWASM : RMSrelatif global0,0006516433, erreur absolue max0,0007771626. Par rôle : drums0,0004361725 ; bass**0,0010157745** ; other0,0007939324 ; vocals0,0002997995. La basse dépasse de≈1,58% le seuil relatif fixéà0,001 ; le test strict échoue donc. Son RMSde référence≈0,1012 n'est pas un rôle quasi silencieux. Aucun seuil n'a été changé et aucun «son identique» n'est revendiqué. Ce nouveau critère strict de qualification n'est pas assimilé rétroactivement aux critères historiques d'admission WebGPU. L'écart numérique faible ne prouve ni son audibilité ni son innocuité perceptuelle.

### 24.5 Réactivité, annulation et correction de la garde

Le timer100ms rapporte un intervalle maximal de**2201,1ms** sur l'ensemble du lancement,438échantillons. Ce diagnostic inclut le fetch/hachage et des copies de174Mo dans le banc. Il ne permet pas d'attribuer ce délai à l'inférence ni de déclarer la GUIfluide. Une mesure par phase et une vraie lecture Studio pendant le calcul restent à faire.

Essai distinct : après affichage`wasm: inference…`, clicStop accepté, Workerterminé et message`Stopped; completed trials retained.` Aucun temps précis de réaction n'a été instrumenté. Ce contrôle ne remplace pas l'annulation native WebNN, encore non testée ici.

La garde d'admission vérifie maintenant un **incrément de dispatchs pour chaque bloc**, et non un simple compteur cumulatif non nul. Un bloc sans exécutionWebNN ne peut pas profiter des dispatchs d'un bloc précédent. Tests unitaires : dispatch manquant par bloc, faible instrument masqué par un mix fort, sortie divergente, contexte perdu pendant une promesse d'inférence/référence, matrices partielles et refus non transformés en scores. Les comparaisons restent hors du thread UI. L'état`Checking experimental WebNN audio against WASM` distingue le contrôle du calcul candidat.

### 24.6 Artefacts, exclusions et suite

- [Sources avant la seconde série](docs/evaluations/studio-webnn-code-2026-10-26.json).
- [Premier smoke test](docs/evaluations/studio-webnn-initial-2026-10-26.json) : essais et erreurs conservés, temps exclus de l'interprétation car une reconstruction du host a chevauché le lancement.
- [Série sans build/test concurrent](docs/evaluations/studio-webnn-clean-2026-10-26.json) : données non arrondies, UA, hashPCM, visibilité, timerUI et parité par rôle.
- [Annulation CPU](docs/evaluations/studio-webnn-cancel-2026-10-26.json), observation explicitement sans mesure de latence.
- Banc : [page de qualification](tests/phase7/fixtures/studio-webnn-validation.html), [protocole](tests/phase7/fixtures/StudioWebNNProtocol.js), serveur local limité`node tools/serve-studio-webnn-validation.mjs`, URL`http://127.0.0.1:8779/tests/phase7/fixtures/studio-webnn-validation.html`. Aucun outil de mesure ajouté à la dist produit.

Validation logicielle après les mesures :**410tests JavaScript réussis**, aucun échec/skip. Le host a été reconstruit/synchronisé. Aucun changement Railsdans cet incrément ; la dernière suite Railsreste114tests/893assertions, pas un nouvel essai dans cette campagne.

**Décision** : conserver WebGPUpar défaut et WASMen secours ; WebNN reste expérimental, SW6 non admis. Ne pas annoncer P5.6terminé. Reste à connecter Canary, exécuter la matrice native et les répétitions prévues, vérifier la parité avec production, la lecture progressive/annulation et les phases du délaiUI. Aucune nouvelle preuve de matérielNPU, de qualité instrumentale à références studio ou d'écoute humaine n'est revendiquée.


### 24.7 Rapport natif Canary reçu le26octobre2026 — exécution observée, admission refusée

L'utilisateur a ouvert le banc dans Canary et lancé la matrice complète. Rapport téléchargé`studio-webnn-2026-10-26T15-22-35.648Z.json`, campagne démarréeà15:20:40.390UTC, UAChrome158.0.0.0. Le fichier reçu est archivé **octet pour octet**, sans correction rétrospective : [rapport brut Canary](docs/evaluations/studio-webnn-canary-2026-10-26.json). [Analyse et empreintes](docs/evaluations/studio-webnn-canary-assessment-2026-10-26.json) conservent sonSHA et les limites. L'automatisation du navigateur n'était pas connectée à Canary : l'exécution a été déclenchée manuellement par l'utilisateur, puis analysée localement. Il ne s'agit pas d'un nouveau contrôle Chrome155.

L'entrée décodée est **exactement la même** que le contrôle précédent :264600frames stéréo44,1kHz, SHA du PCMplanaire`b8b64a9db5a52e02bde2efae82e3567bccc2e91b95c520c4a4b67ca450884213`, ainsi que les mêmes SHA du MP3 et des poids. Une session neuve par configuration, un seul passage, ordreWASM→WebGPU→WebNNCPU→GPU→NPU, ongletvisible et aucune transition de visibilité enregistrée. Pas de build/test agent lancé pendant ce passage ; charge des autres applications, cache/thermique et interventions utilisateur non contrôlés. Le nomCPU/GPU/NPU ne prouve toujours pas le périphérique physique employé.

| Configuration | Session candidate | Séparation/DSP candidat | RéférenceWASM1.30 | Total jusqu'au résultat/refus | Premier PCM publié |
| --- | ---: | ---: | ---: | ---: | ---: |
| ProductionWASM1.22 |0,705s |10,625s |— |11,384s |11,368s |
| ProductionWebGPU1.22 |0,666s |3,554s |— |4,302s |4,285s |
| WebNNCPU1.30 demandé |7,215s |5,432s |10,916s |24,100s (refus) |aucun |
| WebNNGPU1.30 demandé |12,512s |9,265s |10,662s |33,143s (refus) |aucun |
| WebNNNPU1.30 demandé |12,422s |1,958s |10,712s |25,580s (refus) |aucun |

Les totaux WebNN comprennent aussi contexte, session de référence et contrôle numérique ; le temps de référence ne doit pas être imputé au seul calcul candidat. Les refus ne sont **ni** des résultats audio publiés **ni** des latences de lecture de24–33s. Les RTF de résultat réussi restent non définis (`null`) pour ces lignes en erreur. Les valeursWASM/WebGPU ne sont pas directement comparables à la sérieChrome155 comme effet causal de version : conditions globales différentes et une seule répétition. Le rapport totalWASM/WebGPU dans ce passage est≈2,65, pas une recommandation universelle.

**Preuve d'exécution** : chaque préférenceWebNN compte1dispatch, runtime1.30,`nativeWebNNObserved:true`. C'est une preuve d'utilisation de l'API pour au moins une partie du graphe, pas une mesure de couverture ni une attestationCPU/GPU/NeuralEngine. WebGPU signale un adaptateurApple/metal-3 et1630kernels profilés. Le diagnosticGPU est activé dans ce banc ; son surcoût éventuel n'est pas séparé.

**Pourquoi les trois essais sont marquéserror** : les calculs ont produit des sorties comparables, puis la garde par rôle les a refusées avant publication. Pour chaque préférence : seulebasséchoue ; drums/other/vocals passent. Tous les critères globaux passent également. La garde empêche donc précisément qu'un bon score de mix masque un instrument hors seuil. `publishedFrames=0`,`validatedBlocks=0`,`strictParity=false` pour les trois essais. Aucun audio non admis n'a atteint le lecteur.

| CandidatWebNN contre sa référenceWASM1.30 | RMSrelatif global | RMSrelatif basse | Erreur basse en% | Dépassement du seuil relatif fixéà0,001 |
| --- | ---: | ---: | ---: | ---: |
| CPU demandé |0,0006460396 |0,0010062289 |0,100623% |0,623% au-dessus |
| GPU demandé |0,0006518860 |0,0010160326 |0,101603% |1,603% au-dessus |
| NPU demandé |0,0006518860 |0,0010160326 |0,101603% |1,603% au-dessus |

Le RMSréférence de la basse≈0,1012 est bien au-dessus du plancher de silence. Le seuil demandé correspond à0,1%d'erreur relative ; les écarts sont faibles mais la décision fixe reste **refus**. Le contrôleWebGPUcontreWASM1.22 présente le même dépassement léger déjà vu : bass0,0010157745 ; les valeurs sont numériquement identiques aux métriques du précédent contrôleChrome155. Aucun seuil relâché, aucun score subjectif ou «inaudible» déduit.

Les métriquesGPU/NPUWebNN sont identiques dans le JSON, **ce qui ne prouve pas que tout leur PCM est bit-identique**, puisque les PCM rejetés n'ont pas été exportés. Le calculNPUdemandé en1,958s paraît plus court dans cet essai, mais ordre/cache/compilation/température et matériel effectif ne sont pas contrôlés. Ne pas conclure que le NeuralEngine est4,7fois plus rapide que leGPU. En outre, sa session prend12,422s et le chemin gardé reste beaucoup plus lent que le contrôleWebGPU. SW6 n'a pas été essayé ici et reste non admis.

**Portée de la parité** : ces comparaisonsWebNN portent surWASM1.30 dans le même Worker. Le JSONne contient pas de comparaison directe duPCMWebNN avecWASMproduction1.22 : aucun bloc candidat n'a été publié pour cette seconde comparaison. Les déclarations de parité ne sont pas étendues à cette référence manquante.

**Réactivité** : le timerUI100ms du banc rapporte un intervalle max180,3ms,990échantillons, aucun changement de visibilité. Observation plus favorable que le lancementChrome155, mais pas une preuve de causalité navigateur ni une qualification du scroll/playhead enStudio. Aucun essai d'annulationnative ou écoute humaine supplémentaire n'est documenté dans ce rapport.

**Traçabilité du code et correction d'instrumentation** : à réception,10des11empreintes du manifeste antérieur correspondent aux sources ; seule la pageHTMLa reçu l'affichage visible de l'UAavant l'essai utilisateur. Les empreintes à réception sont explicitement **postérieures** à l'exécution, sans prétendre constituer un nouveau pré-enregistrement. Dans le rapport reçu,`validationMs=0`est une omission du cheminexception : le contrôle a bien eu lieu puisqu'il a produit les métriques et refusé les résultats. Après archivage, un`finally`a été ajouté pour mesurer la validation même si elle refuse un bloc ; cette correction ne réécrit pas les mesures de l'utilisateur.

**Décision actuelle** : l'accès natif a été démontré via le rapport utilisateur ; l'admissionWebNN échoue sur cet extrait pour les trois préférences, sans panne d'API. Conserver WebNN expérimental, WebGPUpar défaut et WASMen secours. P5.6resteCURRENTpour diagnostic des écarts/répétitions/paritéproduction et qualification de la lecture/annulation ; ne pas annoncer une admission réussie ou assouplir les seuils après coup. Ajouter d'autres entrées et des sessions répétées permettra de distinguer variabilité, numérique et coût de préparation. Ce rapport ne justifie pas une optimisation basée sur un avantageNPUprésumé.
