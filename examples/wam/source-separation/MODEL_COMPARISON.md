# Comparer les modèles — 23 octobre 2026

Le classement des vitesses doit porter sur le même audio, avec le même protocole. Les chiffres historiques CleanChords / Jet, les premières compilations et les essais profilés ne forment pas un classement commun. Le nouveau laboratoire utilise les adaptateurs actuels du host, sans modifier leurs poids, leur DSP, leur précision ni leurs fenêtres.

## Protocole

- `model-benchmark.html`, deux essais par défaut (1–3 possibles), tous les modèles installés ou un modèle choisi. Configurations et essais strictement successifs ; Worker libéré entre chaque essai. Aucun transfert de données vers un service.
- Six premières secondes de *Slow Motion Dream*, CC BY 3.0, stéréo 44,1 kHz, 264600 échantillons par canal. SHA-256 du fichier source : `4b431d535d235bd81b62f816f08c3f1afb6679d2706d84b3b75903b7df909507`. Décodage réalisé une seule fois avant chronométrage. Identités des poids/version dans chaque résultat.
- Auto pour les fenêtres, configuration de production : 6s progressif, FT classique avec quatre spécialistes successifs, Demucs Qualité ONNX, export Aperçu 2s et Roformer coopératif 18 étapes sur GPU / session monolithique sur CPU.
- Sessions neuves à chaque essai. Caches modèle et driver/navigateur conservés ; pas de promesse de démarrage réellement « à froid ». Temps total comprenant accès au cache, initialisation du runtime/modèle, compilation/préchauffage si prévu et séparation. Téléchargement, décodage et contrôle initial de disponibilité exclus ; les accès et vérifications effectués par chaque adaptateur de production restent inclus.
- `preparationMs` n'est distinct que pour les adaptateurs à préparation explicite. Pour les autres, `separationMs` contient leur initialisation : ne pas comparer ces colonnes comme un coût neuronal pur. Le premier bloc est chronométré depuis le même départ que le total, préparation incluse. Ce n'est pas un délai acoustique des haut-parleurs.
- Toutes les sources et leurs deux canaux : longueur, finitude, ordre et couverture complète vérifiés. ONNX CPU reste monothread, selon la configuration actuelle du host. Le benchmark ne conserve pas les stems, ne les joue pas et n'en fait pas une sauvegarde automatique. Il vérifie l'exécution, pas la qualité perceptuelle ou un SDR.
- Aucun repli WebGPU vers CPU : un échec est conservé avec son message. Aucun téléchargement déclenché si un modèle manque. Annuler termine le Worker et empêche les essais suivants. Le laboratoire annule aussi si l’onglet est masqué ; les nouveaux essais sont marqués visibilityGuarded.
- La médiane est calculée séparément pour chaque modèle/backend. Un modèle ou protocole modifié invalide sa mesure. Ce test court ne prédit pas exactement le classement sur un morceau entier : les coûts fixes et les recouvrements n'y ont pas le même poids.

## Interface et politique

Dans Change model / settings : histogramme CPU/GPU du temps total ou de l'attente du premier bloc ; chiffres, nombre d'essais, origine et date des mesures. Graphique MVSep distinct, avec scores SDR guitare externes et lien vers le classement complet. Les références externes non installables dans notre host sont identifiées ; aucun score de l'export navigateur n'est inventé.

Priorité initiale : terminer vite. Les résultats de référence servent en l'absence de mesures locales ; une comparaison explicite conserve uniquement ses petits résultats dans localStorage. Réouvrir Settings ou Actualiser les mesures actualise les graphiques sans recharger le projet. Utiliser la recommandation applique ensuite explicitement un choix ; les nouveaux résultats ne modifient jamais spontanément un calcul en cours. Au prochain chargement, les mesures servent aussi au choix initial. Une comparaison ciblée remplace les anciens essais de ces configurations et conserve les autres essais du même protocole.

Un classement automatique exige que toutes les configurations du backend aient été testées. Les échecs sont exclus du choix ; les absences ne suffisent pas pour déclarer les autres modèles « les plus rapides ». Sans couverture complète, repli provisoire sur Demucs Qualité GPU ou Demucs 6 CPU. La détection GPU ne suffit pas à valider une nouvelle famille de modèles.

Les priorités écoute tôt / guitare dédiée restent des actions explicites. Changer la priorité ne change pas le modèle avant Utiliser la recommandation. Dans Settings, le choix respecte Valider / Annuler. Le benchmark ne modifie ni le modèle courant ni le cache des poids.

## Qualité guitare

Snapshot MVSep consulté le 23 octobre 2026 : SW UVR5.6 9.012 dB (#1), Logic Pro11.2 9.002 dB (#3), MVSep Guitar Ensemble2024.09.14 7.5112 dB (#14), BS-RoFormer Guitar7.1266 dB (#19). Source : https://www.mvsep.com/quality_checker/leaderboard/guitar . Il s'agit d'une sélection, pas d'un classement complet, ni de votes de guitaristes. Aucun de ces chiffres ne certifie notre export SW avec des fenêtres4s. Demucs4/FT/Aperçu ne fournissent pas une guitare isolée ; Demucs6 a été retrouvé via le filtre officiel : 5.2489dB (résultat externe, sans rang global attribué ici). Source filtrée : https://www.mvsep.com/quality_checker/leaderboard/guitar?algo_name_filter=Demucs&sort=&ranking_metrics= .

## Résultats de référence

Chrome154 local, ORT Web1.22.0, deux essais réussis par configuration. Série complète : [mesures brutes](benchmarks/model-comparison-2026-10-23.json). Les temps sont des médianes en secondes pour les **mêmes6s**, préparation incluse :

| Modèle | Backend | Total | Premier bloc |
|---|---|---:|---:|
| Demucs Qualité4 | WebGPU | 11,84 | 11,75 |
| Demucs Aperçu4 | WebGPU | 16,71 | 8,39 |
| Roformer SW6 | WebGPU | 22,41 | 18,08 |
| Demucs Qualité4 | CPU/WASM | 48,78 | 48,66 |
| Demucs Aperçu4 | CPU/WASM | 60,65 | 23,99 |
| Demucs6 | CPU/WASM | 68,87 | 36,35 |
| Demucs FT4 | CPU/WASM | 368,21 | 368,21 |
| Roformer SW6 | CPU/WASM | 442,32 | 303,23 |

La recommandation par défaut sur cette référence est **Demucs Qualité4**, pour les deux backends. L'objectif premier bloc recommande Aperçu4. Une guitare dédiée reste un choix explicite : SW sur GPU / Demucs6 sur CPU.

La visibilité n'était pas journalisée sur la série complète initiale. Un [contrôle séparé](benchmarks/model-comparison-foreground-control-2026-10-23.json), avec l'onglet maintenu visible et annulation automatique au masquage, a réexécuté Demucs Qualité deux fois par backend : GPU13,03s, CPU55,65s (initialisation comprise). Le classement relatif est conservé, mais les durées varient entre sessions. Les mesures de référence ne sont donc pas un benchmark statistique en environnement isolé. Tous les nouveaux essais contrôlent désormais la visibilité ; un onglet masqué ne doit pas produire une nouvelle mesure valide.

Les rapports ne mesurent ni mémoire maximale, ni qualité perceptuelle, ni SDR de nos sorties. Ils ne garantissent pas un classement identique pour toute durée, tout GPU, tout navigateur ou une session déjà préparée. Les paramètres DSP/poids/fenêtres des modèles restent inchangés par cette tâche.
