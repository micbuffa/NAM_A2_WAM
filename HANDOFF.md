## 23 octobre 2026 — P4.12d [CURRENT] extension guitare multi-styles

- Trois compositions enregistrées supplémentaires, deux artistes : MusicDelta Country1 acoustique, Grunge saturée, Meaxic TakeAStep claire/saturée. Archive MUSDB preview déjà présente ; six métadonnées MedleyDB officielles examinées, trois sélectionnées, hashes épinglés. SweetLights et SoSoGlos exclus car Autres n’est pas exclusivement guitare. **MUSDB train connu**, donc diagnostic uniquement, corpus et protocole distincts ; ne pas incorporer au conseil initial Settings, ne pas revendiquer une validation hors entraînement.
- Préparateur `tools/prepare-guitar-diagnostic-corpus.py`, stdlib+ffmpeg, aucun réseau ; sources précises, labels top-level/has_bleed/hash vérifiés, flux3 vs1+2+4, mix exact. Neuf WAV6s float stéréo44100 dans `test-data/source-separation/guitar-diagnostic/`, ignorés Git/hors dist. Reconstruction max2,98e-8.
- `GuitarDiagnosticDefinition.js`, rapport séparé prévu `GuitarDiagnosticData.js`, banc `real-instrument-quality.html?corpus=guitar-diagnostic`. Helpers RealInstrumentCorpus acceptent une définition/protocole explicites ; défaut strict initial inchangé. Résultats/stockages/points de reprise distincts.
- `QualityAuditionBank.js` : résultats isolés/backing en RAM bornée128Mio, copies isolées, éviction ancienne, effacement au nouveau run/fermeture. Boutons A/B après chargement référence, même volume et position/état lecture, aucune persistance PCM. Reprise JSON restaure uniquement les scores, pas l’audio.
- **12/12 inférences réussies** (6CPU, Qualité/Aperçu/SW GPU), rapport benchmarks/guitar-diagnostic-quality-2026-10-23.json et GuitarDiagnosticData.js. Country1 SI-SDR6/Qualité/Aperçu/SW=5,43/5,31/5,32/8,88dB ; Grunge3,56/4,47/4,24/6,91 ; Meaxic0,66/0,01/0,41/2,64. SW meilleur sur les3, Meaxic reste difficile ; pas de conclusion universelle. FT non mesuré. Aucun conseil initial remplacé.
- Contrôle audio Chrome : référence6s lisible, référence→SW en lecture0,190→0,433s sans retour0 ; backing en pause maintenue à4,534s. Sons de séparation disponibles en RAM sur onglet de diagnostic conservé pour revue utilisateur. Aucune appréciation d’écoute humaine inventée. **496/496 tests Node réussis**, comprenant huit tests Python (préparateurs initial+diagnostic) lancés par deux tests Node. Rapports de reprise : valid booléen strict et rôle réellement disponible exigés. Dist reconstruite, 11 fichiers source/dist identiques, aucun audio du corpus distribué. Page diagnostic dist chargée : 12 résultats embarqués, sorties guitar/other explicites, documentation diagnostic correcte, aucun log console error. Capture /tmp/nam-guitar-diagnostic-audition.jpg. Onglet source conservé comme livrable, Meaxic/SW en pause avec tous les résultats en RAM ; onglet dist de contrôle fermé. Logs /tmp/nam-guitar-diagnostic-tests.log et /tmp/nam-guitar-diagnostic-dist.log. Aucun commit/push.
- Cambridge FAQ exige accord contributeurs pour recherche : pas de téléchargement ni contact ; recherche hors train/écoute humaine restent à compléter. **P4.12d.1 DONE diagnostic**, d.2 TODO corpus hors train/écoute, P4.12d global CURRENT.

## 23 octobre 2026 — P4.12c [DONE, corpus limité] enregistrements réels

- Branche multitracks, aucun commit/push. Archives officielles MUSDB18-7s (147209385 octets) et MedleyDB sample (415502011) téléchargées et MD5 officiels vérifiés. Préparateur Python/ffmpeg, hashes SHA256, coefficients MedleyDB officiels, mix exact référence+backing, gain commun et WAV float32 stéréo44,1kHz/6s.
- Audio local uniquement : `test-data/source-separation/` (~279Mo), ignoré Git et hors dist. Métadonnées publiables dans RealCorpusDefinition.js. Trois compositions basse (Falcon69, RunRunRun, NotYou) et trois passages Rainfall d’une seule composition guitare (20/65/120s). Rainfall absent du preview MUSDB ; entraînement réel des modèles inconnu. Pas de jugement d’écoute humaine. Droits et reproduction dans REAL_INSTRUMENT_CORPUS.md.
- **24/24 séparations valides**, quatre configurations : Demucs6 CPU, Qualité4/Aperçu4/SW6 GPU. FT facultatif non mesuré. Rapport `benchmarks/real-instrument-quality-2026-10-23.json`, embarqué RealQualityData.js. Première campagne interrompue après11 résultats ; reprise via import JSON et contrôle profond des11 résultats inchangés. Checkpoints métadonnées sans audio, reprise filtrée poids/protocole/corpus/backend/rôle.
- Médianes SI-SDR guitare/basse : Demucs6CPU15,08/2,04 ; Qualité4GPU16,19/6,61 ; AperçuGPU16,68/5,99 ; SWGPU23,61/2,29dB. Conseil réel SW pour guitare dédiée, Qualité4 pour basse. SW gagne les3 passages guitare ; Qualité4 gagne2/3 morceaux basse (SW meilleur sur metal). Limites : extraits courts, export navigateur, une composition guitare, pas de classement universel ni de comparaison intrinsèque UVR.
- Settings : sélection réelle auto ou pilote contrôlé, données distinctes, minimum/amélioration/nombre de compositions, FT non mesuré explicite. Profil et corpus passifs ; application au brouillon via bouton puis Valider/Annuler. Défaut vitesse Qualité4 inchangé.
- **489/489 tests Node réussis**, dont les4 tests Python du préparateur (log /tmp/nam-real-corpus-tests.log). Dist reconstruite (log /tmp/nam-real-corpus-dist.log), 11 fichiers source/dist comparés identiques, corpus audio absent. Chrome dist : profil/corpus passifs, choix pilote basse puis application → SW, Annuler/réouvrir → Qualité4 et corpus auto. Aucun log console error. Référence basse WAV6s démarrée (0,102s, paused=false, sans erreur). Capture /tmp/nam-real-corpus-settings.jpg. P4.12d : diversifier les compositions guitare, écoute humaine, puis nouveaux candidats instrumentaux.

## 23 octobre 2026 — P4.12b [DONE, pilote contrôlé] guitare/basse

- Branche **multitracks**, reprise depuis main au début du tour car les travaux précédents étaient dans le commit multitracks28e2895. Aucun commit/push de ce tour. Actifs model-assets non suivis préservés.
- `InstrumentQuality.js` : CleanChords, FolkAcousticDI, ClassicRockRiff+tanh épinglés SHA256, 6s chacun ; références basse/batterie synthétiques déterministes. Mix exact et niveaux communs, SI-SDR stéréo à projection globale, SNR au niveau original, gain/polarité, amélioration face au mix et métriques de backing. Invalides/silences/doublons/poids ou sources obsolètes exclus.
- **15/15 séparations réelles réussies**, cinq modèles × trois cas, adaptateurs de production, GPU compatible sinon CPU sans repli. Rapport exporté via interface puis archivé `benchmarks/instrument-quality-2026-10-23.json` et embarqué `InstrumentQualityData.js`. Pas de téléchargement de modèles, de sauvegarde PCM/projet, ni de mesure de temps assimilée au benchmark de vitesse.
- Médianes SI-SDR guitare/basse : SW6GPU23.53/22.10dB ; Qualité4GPU20.51/18.99 ; FTCPU19.52/18.95 ; AperçuGPU18.88/17.86 ; Demucs6CPU10.76/9.49. SW meilleur des cinq sur les six paires instrument/cas de ce pilote. Demucs6 cas acoustique : guitare−8.24dB, gain−20.02dB, régression−7dB face au mix. Ne pas généraliser ce cas à tous les morceaux ni confondre avec avis d’écoute humaine.
- `InstrumentRecommendationPanel.js` dans Settings via ModelComparisonPanel : profils Guitariste/Bassiste, tableaux distincts de la vitesse ; couverture complète du backend/poids requise, garde-fou amélioration non négative sur chacun des3cas. Conseil guitare uniquement via sortie dédiée, Autres restant visible dans le tableau du pilote sans voix/piano. Sur machineGPU, SW proposé pour les deux profils. Sur CPU seul, pas de conseil tant que les autres candidatsCPU ne sont pas mesurés ; ne pas inventer des scoresCPU depuis le GPU. Défaut vitesse Qualité4 inchangé.
- Le bouton applique uniquement au brouillon Settings ; profil passif, Valider/Annuler existants conservés. Vérification Chrome dans **dist** : profil bassiste ne change pas Qualité4 ; bouton → SW ; Annuler/réouvrir → Qualité4. Tableaux, niveaux, minimum, source/limites visibles. Capture `/tmp/nam-instrument-quality-settings.jpg`.
- Lecteur A/B : nouveau menu des3mélanges, références guitare/basse audibles, même recette et hash ; cas fixé6s. Deux séparations GPU acoustiques supplémentaires et WAV flottants validés, lecture et commutation référence→SW à0.298s→0.522s sans retour0. Changer de source vide les anciens résultats/audio pour éviter de présenter le mauvais extrait. Refs restant en RAM uniquement. Progression du lecteur A/B réutilise SeparationProgress/separationMessage, spécialistes/piste/pourcentage réels.
- **477 tests réussis**,17 nouveaux tests analytiques/protocole/politique/DOM/données réelles. Logs `/tmp/nam-instrument-quality-tests.log`, `/tmp/nam-instrument-quality-dist.log`. Dist reconstruite. Contrôle A/B supplémentaire QualitéGPU terminé, puis changement de source : résultats vidés, Play désactivé, fichier réactivé. **14 fichiers source/dist identiques**. Aucun log console error dans le host distribué. Les trois onglets de test fermés et ressources audio libérées ; onglets utilisateur préservés.
- Référence scientifique SI-SDR Le Roux2019 et MVSep guitare/basse vérifiés. Résultats pilotes explicitement distincts du SDR externe et des appréciations subjectives. Analyse complète/protocole : `INSTRUMENT_QUALITY.md` ; specification P4.12b piloteDONE, **P4.12c corpus représentatif/écoute/nouveaux candidats reste TODO**. Pas de nouveaux modèles vocaux proposés.

## 23 octobre 2026 — P4.12a comparateur d’écoute guitare/basse

- Nouveau laboratoire `instrument-comparison.html` lié depuis le panneau de comparaison de Settings. `InstrumentComparison.js` collecte les résultats des adaptateurs de production, valide ordre/canaux/finitude/longueur/backend, puis propose instrument et backing (somme des autres rôles). Annulation libère le Worker, y compris pendant le rendu du dernier résultat.
- Démo musicale ou fichier local, 6/15/30 s stéréo44,1kHz, GPU Auto si compatible sinon CPU, modèle installé uniquement et aucun repli. Guitare dédiée distinguée explicitement d’Autres. Aucune normalisation ni modification du choix de modèle dans le host.
- Lecteur commun et position conservée lors du changement, volume commun initial25%, WAV flottant32bits pour préserver les crêtes supérieures à1 observées dans les sommes de stems. Aucun PCM/projet autosauvé ; URL Blob révoquées au nouveau run/fermeture. Notes et métadonnées exportables en JSON, WAV téléchargeables.
- Ne pas annoncer un classement de qualité : le mix démo n’a pas de stems originaux. Ce tour prépare une écoute comparable et valide le pipeline ; les notes d’écoute humaine et une campagne avec vérité terrain restent P4.12b. Référence : `INSTRUMENT_COMPARISON.md`.
- Essai réel initial : Demucs6 CPU + Qualité4 GPU + SW6 GPU, même extrait6s, tous canaux validés. Deux essais GPU supplémentaires avec WAV flottants réussis. Validation finale dans la dist : deux nouvelles séparations GPU réussies, WAV6s lisibles sans erreur, changement en lecture à0.218s→0.419s (pas de retour à zéro), état pause conservé au changement. JSON exporté via le bouton puis archivé dans `benchmarks/instrument-comparison-2026-10-23.json`. Aucune note d’écoute inventée. Neuf nouveaux tests unitaires ; suite complète **460/460** réussie. Dist reconstruite, contrôle de présentation final et absence d’erreurs console.
- Branche multitracks ; aucun commit/push. Préserver les changements NAM/other_wam_host. Serveur8765.

## 23 octobre 2026 — Périmètre guitare et basse (prioritaire sur les anciennes suites)

- Instruction utilisateur : application pour guitaristes et bassistes ; ne plus proposer les modèles orientés voix. P4.12 MDX-Net Inst HQ4/5 abandonnée au profit d’une évaluation de qualité guitare/basse des modèles intégrés, puis de candidats instrumentaux pertinents.
- Catalogue de recherche visible réduit à SW six sources, SCNet et MDX Extra Q. Aucun séparateur multi-instruments existant retiré : une sortie voix ne rend pas le modèle vocal spécialisé.
- Les anciennes mentions « prochain MDX-Net » ci-dessous sont historiques et caduques. Aucun nouveau portage ni benchmark audio lancé pour ce changement de périmètre.

## 23 octobre 2026 — Comparaison des modèles, recommandation et graphiques

- Tâche P4.11b avant MDX-Net : nouveau laboratoire `examples/wam/source-separation/model-benchmark.html`, orchestration `ModelBenchmark.js` et adaptateurs `BenchmarkRunnerFactory.js`. Même Slow Motion Dream6s stéréo44,1kHz, taille Auto, toutes les sources/canaux, aucune bascule GPU→CPU, aucune sauvegarde PCM. Annulation et filtres modèle/backend ; export JSON des petits résultats.
- Deux essais par configuration, huit configurations : **16 résultats réels complets**, tous valides. Rapport `benchmarks/model-comparison-2026-10-23.json`. Médianes référence : Qualité4 GPU11.84s / CPU48.78s ; Aperçu GPU16.71s / CPU60.65s ; Demucs6 CPU68.87s ; FT CPU368.21s ; Roformer GPU22.41s / CPU442.32s. Initialisation/cache/préchauffage inclus, téléchargement/décodage exclus. Ce ne sont pas des temps de morceaux entiers.
- Visibilité initiale non journalisée : contrôle supplémentaire Qualité avec onglet visible, GPU13.03s / CPU55.65s, même classement, variabilité réelle. Rapport séparé `benchmarks/model-comparison-foreground-control-2026-10-23.json`. Les nouveaux essais contrôlent la visibilité et annulent au masquage ; ne pas mélanger ces références avec des promesses universelles de débit. Protocole/limites dans `MODEL_COMPARISON.md`.
- `ModelPerformanceData.js` embarque la référence complète ; résultats locaux (petit JSON localStorage, pas audio) prioritaires dans les graphiques. Comparaison ciblée remplace ces configurations en conservant les autres du même protocole. Poids/version/fixture/protocole vérifiés, médianes, erreurs exclues ; couverture complète du backend requise pour recommander par mesure. Choix provisoire sans couverture : QualitéGPU/6CPU. Avec référence actuelle : **Qualité4 par défaut GPU et CPU** ; objectif écoute tôt : Aperçu ; guitare dédiée : SW GPU /6 CPU. Aucun changement spontané du modèle pendant une séparation.
- `ModelComparisonPanel.js` dans Change model/settings : barres CPU/GPU, total/premier bloc, filtre backend, chiffres/nombre d'essais, recommandation explicite avec Valider/Annuler, Actualiser les mesures sans recharger/perdre le projet en RAM. MVSep distinct, snapshot du23octobre : SW9.012dB et Demucs6 5.2489dB, autres références externes identifiées. Pas de votes ou de SDR revendiqué pour nos propres exports.
- **451 tests passent**, dont20 nouveaux pour protocole, métriques, choix, cache/erreurs, FT positionnel, annulation/visibilité et rendu. Logs `/tmp/nam-model-comparison-tests.log` et `/tmp/nam-model-comparison-ui-tests.log`. Dist `npm run dist -- --no-regenerate --no-build`, log `/tmp/nam-model-comparison-dist.log`. Tous les nouveaux modules requis dans le constructeur de dist.
- JSON exporté réellement dans `/Users/michelbuffa/Downloads/model-comparison.json` (16résultats, vérifié) ; le mécanisme du navigateur n'a pas remonté l'événement de téléchargement au contrôle automatisé, le fichier a été vérifié directement. Annulation du laboratoire vérifiée : boutons relançables et statut Annulé. Aucune piste personnelle importée/sauvegardée dans ce tour.
- Régression de démarrage corrigée : ouvrir Settings attend désormais application.ready avant de capturer le modèle/backend initial. Annuler ne peut plus restaurer un modèle vide si le bouton est cliqué tôt. beginWhenReady testé (initialisation différée, invalide et ouverture répétée).
- Vérification finale Chrome/dist : graphiques huit configurations et MVSep, filtres CPU/GPU et premier bloc, recommandation Aperçu puis Annuler → Qualité conservée, recommandation vitesse rétablit GPU, Actualiser garde le modèle. Clic Settings précoce vérifié après correctif. Capture `/tmp/nam-model-comparison-ui.jpg`. Les13 fichiers source/dist modifiés comparés et identiques.
- Branche **multitracks**, aucun commit/push. Préserver modifications utilisateur NAM/other_wam_host. Serveur8765. **Suite : P4.12 MDX-Net Inst HQ4/5**, non démarrée. Ne pas relancer les 16 essais lourds pour une simple modification graphique.

## 22 octobre 2026 — RAM par défaut, sauvegarde uniquement explicite

- L'utilisateur valide la suppression de la sauvegarde automatique de PCM. `MultitrackPlayerElement.onSeparated` appelle maintenant separationComplete (notice RAM), jamais saveProject. Export MP3 ne déclenche plus saveProject : seul le MP3 demandé est persisté dans Tracks. Les modèles gardent leur cache. API getState/SaveState restent des actions explicites de sauvegarde, pas de nouveau changement du contrat du host.
- Bouton Enregistrer le projet déplacé des Settings vers la barre principale, statut En RAM · projet non enregistré / Projet enregistré. Disabled sans résultat séparé, pendant séparation/restauration/sauvegarde. La liste de gauche reste celle des projets enregistrés, chargés à la demande ; nouveau texte d'aide vide adapté.
- `ProjectSaveState.js` suit génération/révision/token de sauvegarde (aucun PCM ni stockage). Évite double clic, protège edits pendant sauvegarde et changement de source contre completion obsolète. Source importée nouvelle=non enregistrée, projet chargé=propre. Notifications onProjectChange dans main pour mix/normalisation/global/zoom/vue/boucles/nouvelle séparation/reset modèle et bascule original/résultat ; restauration ignore ces notifications. Pas de dirty sur play/pause. Échec de sauvegarde garde RAM/dirty.
-431 tests passent (`/tmp/nam-ram-tests.log`),9 nouveaux tests dans ram-projects.test.mjs. Après deux notifications supplémentaires de bascule original/résultat, suite ciblée RAM/workflow/session passée (`/tmp/nam-ram-final-targeted.log`). Test réel Chrome5s Roformer/6pistes :14 projets avant/après séparation et export,0 sessionIndexedDbPut ; lecture RAM confirmée. Export MP3 arrive dans Tracks, retour Multitracks toujours non enregistré. Save explicite :1 put PCM et15 projets, statut enregistré. Mute Piano remet non enregistré ; chargement du nouveau projet5s rétablit Piano non muté et lecture en pause, Playenabled ; play/pause seul conserve enregistré.
- Rapport `benchmarks/ram-projects-2026-10-22.json`. Screenshot état RAM `/tmp/nam-multitracks-ram.png`. Spécification [DONE] et README à jour. Dist reconstruite (`/tmp/nam-ram-dist.log`) ; ProjectSaveState, élément, contrôleur et HTML comparés aux sources et identiques. Nouvelle dépendance ProjectSaveState exigée par le script. Branche multitracks, aucun commit/push. Préserver modifications utilisateur NAM/other_wam_host. Serveur8765 ; test en pause.
- Prochaine tâche catalogue : MDX-Net Inst HQ4/5. Aucune intégration de ce modèle dans ce tour. Anciennes mesures de sauvegarde dans les entrées suivantes décrivent les sauvegardes désormais explicites.

## 22 octobre 2026 — Débit Roformer18 étapes et sauvegarde Blob réactive

- Suite au « ok » : optimisation du débit GPU et identification/correction de la pause de sauvegarde, puis validation du host. Aucun nouveau modèle intégré ; MDX-Net Inst HQ4/5 reste la suite du catalogue.
- Cinq plans comparés sur même mix6s/deux fenêtres :100/72étapes10,22s ;200/36=10,81s ;400/18=9,24s ;alignéTransformer38=9,54s ;800/9=9,52s. Douze canaux respectent individuellement les seuils pour TOUTES les variantes. Plan400/18 retenu. Même PCM, checkpoint et DSP ; queue drainée puis pause4ms toujours présente. `tools/prepare-roformer-stage-plan.py` accepte --nodes-per-stage (400 défaut), --alignment uniform|transformer ; plan production régénéré deux fois identique via cmp. Pas de patch ORT.
- Benchmark brut : `benchmarks/roformer-throughput-storage-2026-10-22.json`. Nouveau rapport `ROFORMER_THROUGHPUT_AND_STORAGE.md` ; précédent diagnostic conserve l'historique72 étapes. Le plan18 réduit le temps court~9,5%, pas de garantie statistique ni temps réel universel.
- Cause de la pause : appel synchrone IndexedDB.put doit sérialiser tout le PCM. Test isolé~203Mo (original214,9s +6stems60s) : ancien put357ms /maxRAF342ms ; Blob put12,9ms/maxRAF41,7ms. Temps TOTAL sauvegarde augmente591→1234ms, ne pas annoncer une écriture plus rapide. Gros contrôle navigateur vérifie longueur+premier/milieu/dernier échantillon par canal ; identité binaire exhaustive sur fixtures unitaires, pas un hash203Mo.
- `SessionAudioEncoding.js` encode en Blobs avec copies<=65536frames/256Kio, cède une tâche après budget~4ms cumulé (pas une garantie de durée native<4ms). Blobs composés AVANT transaction, puis un put atomique avec pcmStorageVersion1, longueur/endian/canal. PCM du lecteur ni modifié ni détaché. get décode Blobs en Float32Array ; anciens enregistrements typed PCM lisibles, aucune migration DB/modèles. Tests signedzero/sous-vue/bits, endian, blocs/partiel, vieuxformat, malformed, yield, copie annulée et quota/atomicité.
- Instrumentation optionnelle : MultitrackState.saveSession accepte measure, transmet au store ; main branche UiFrameMetrics. sessionPackAudio /sessionBlobCopy /sessionBlobCompose /sessionIndexedDbPut séparés. Pas d'instrumentation dans URL normale.
- Host Jet60s : premier bloc3366ms,20fenêtres, total62416ms (ancien test72étapes67890ms ; sessions/conditions différentes, gain observé~8%). Lecture original puis6stems, scroll bas/haut et mute Piano on/off rétabli. Projet sauvegardé automatiquement dans formatBlob puis restauré,6pistes en pause, Playenabled. Vue instruments conservée. Savehost : pack1,02ms ;maxcopy1,38ms ;compose4,4ms ;put3,67ms. MaxRAF cumulé115,8ms,p95~9,4ms ; LongTask80ms existait avant fin pendant interactions. Ne pas dire zéro pause ni objectif calcul<durée atteint (62,4>60). Restauration valide encore tout PCM sur UI, coût distinct futur.
-422 tests réussis (`/tmp/nam-throughput-tests.log`), nouveaux5testscodec ; sous-vue ajoutée puis suite ciblée5tests réussis (`/tmp/nam-blob-tests.log`). Dist reconstruite (`/tmp/nam-throughput-dist.log`), modules/plan comparés aux sources et identiques. Spec [DONE], README et diagnostic mis à jour. Screenshot `/tmp/nam-roformer-throughput-storage.png`. Lecteur test en pause,serveur8765 ; branche multitracks, aucun commit/push. Préserver changements utilisateur NAM/other_wam_host.

## 22 octobre 2026 — Roformer GPU coopératif : correction des gels répétés

- Demande utilisateur : trouver une solution pour une GUI réactive pendant BS Roformer SW. Implémenté et testé dans le host. `CooperativeOnnxSession.js` reconstruit72 graphes (max100 nœuds non constants) depuis les poids cachés vérifiés et `research/roformer-stage-plan.json` (~1,3Mo sans poids). SHA-256 du modèle vérifié avant toute création. Plan généré par `tools/prepare-roformer-stage-plan.py` avec onnx1.19.1, `/tmp/nam-latency-export/bin/python` ; formes inférées mais nœuds/poids originaux conservés.
- Les float/float16 intermédiaires compatibles restent GPU via preferredOutputLocation ; autres types/opérateurs hybrides peuvent transférer. Après chaque étape : `await device.queue.onSubmittedWorkDone()` puis4ms de pause Worker, limitant la file GPU pendant une fenêtre. Tenseurs vivants jusqu'à dernier consommateur (dépendances multistages conservées) ; nettoyage erreurs et préparation partielle. ORT vendored et checkpoint intacts ; CPU/WASM monolithique inchangé. Sessions conservées par PreparedDemucsRunner, annulation/model switch terminent Worker. Progression compilation72 étapes puis chauffe affichée (messages, pas polling).
- Tests417 réussis (`/tmp/nam-cooperative-full-tests.log`). Nouveaux tests dépendances, plages invalides, ordre drain/yield, tenseurs/durée de vie, erreurs, exclusivité, release, hash, préparation partielle/progression bornée. Validation audio référence4s prototype et code intégré sur mix6s/two windows/raccord : douze canaux dans tolérances ; max1,384e-4/RMS relative6,47e-5 sur musique. Aucune modification de DSP, taille fenêtre4s/overlap1s/publication3s, ni ring paquets1s.
- `benchmarks/roformer-cooperative-2026-10-22.json` : comparaison isolée même page4s original4026ms/RAFmax82ms vs prototype4655ms/max17ms (ne PAS comparer directement ce test court au gel2s du host précédent). Intégré musique6s9979ms/RAFmax58ms.
- Host Jet60s, original puis lecture6stems pendant séparation : relevé actif jusqu'à57s disponibles, p95RAF9,36ms/max67,67ms ; snapshot à42s dispo : pas LongTasks, heartbeatmax13,9ms. Scroll page bas/haut (scrollTop0 vérifié), mute Piano on/off confirmé et rétabli. FirstReady3919ms ;20fenêtres, total67890ms. Dernier relevé inclut finalisation/sauvegarde : LongTask148ms/maxRAF158ms. Cause interne de cette pause finale pas attribuée précisément ; ne pas annoncer zéro blocage ou associer à un appel précis. Les gels périodiques2s ne sont pas reproduits pendant l'inférence coopérative.
- Compromis : débit inférieur possible, ce test60s prend~68s (ancien essai~50s, pas conditions strictement identiques). Préparation et pertes d'optimisations globales plus coûteuses. Prochaine optimisation utile : améliorer frontières/cadence sans perdre réactivité/validation audio, et isoler pause finale de sauvegarde. Ne pas promettre production plus rapide que lecture ni FPS garanti sur tout GPU.
- Documentation : SPEC [DONE], README source-separation, ROFORMER_UI_DIAGNOSIS complétés. Dist reconstruite et vérifiée (`/tmp/nam-cooperative-dist.log`), module et plan inclus. Régénération du plan reproduite octet pour octet (`cmp` sur sortie temporaire). Screenshot host après le calcul `/tmp/nam-roformer-responsive-host.png`. Lecteur test remis en pause. Serveur8765. Branche multitracks ; aucun commit/push. Préserver modifications utilisateur NAM/other_wam_host.

## 22 octobre 2026 — Diagnostic Roformer : thread JS vivant, rendu retardé pendant réseau

- L'utilisateur demande ce qui bloque réellement l'UI/scroll avec BS Roformer. Ajouter un Worker/ring n'a pas isolé le GPU. Nouvelle instrumentation conditionnelle ?uiMetrics=1 : timer UI50ms indépendant de RAF, Long Animation Frames (attribution scripts), phases STFT/network/iSTFT du Worker horodatées Date.now + réception main, gaps RAF bornés40, phases80. Cleanup des observers/timers à destroy. Pas d'effet PCM/inférence en production.
- PreparedDemucsRunner passe diagnostics/onDiagnostic seulement si demandés. RoformerCoreModel.onPhase entoure STFT, session.run, iSTFT ; roformer-worker envoie ces marqueurs seulement pendant un run diagnostic, pas de polling ni trace permanente.
- Reproduction Jet60s Roformer WebGPU, lecture simultanée, snapshot actif à39s disponibles. RAFmax2006ms ; heartbeat50ms retardmax15,35ms ; LongTask0 ; maxpublicationaudio10,805ms/waveform1,745ms/contrôles0,225ms. LoAF19, plusieurs sans scripts et blockingDuration0, renderStart très tardif. Phases réseau2130–2163ms, STFT34–35ms, iSTFT265–271ms. Cinq trous RAF593–1965ms recouvrent100% phase réseau.
- Conclusion précise : le thread JS UI n'est pas immobilisé2s par nos publications, mais le rendu s'interrompt pendant le chemin ONNX/WebGPU. Contention/attente GPU/compositeur cause principale probable. Ce n'est PAS une trace GPU/driver : ne pas nommer un shader ou prétendre prouver la saturation/mémoire. session.run inclut CPU hybride et téléchargements. Effets de composition/automation possibles. Documentation ROFORMER_UI_DIAGNOSIS.md ; brut benchmarks/roformer-ui-blocking-2026-10-22.json.
- 408 tests passent /tmp/nam-freeze-tests.log. Tests heartbeat vsRAF, limites traces/attribution, diagnostic runner séparé de PCM ; anciens tests audio conservés. Dist reconstruite (/tmp/nam-freeze-dist.log). Après fin, un autre LongTask162ms est attribué à la chaîne de callback StreamTransport ; ne pas le confondre avec les gels réseau2s où heartbeat reste réactif.
- Prochaine optimisation doit cibler exécution GPU à l'intérieur de session.run : profil GPU/DevTools et budget de soumission si réellement supporté, ou modèle/export différent, avec validation audio inchangée. Pause entre fenêtres ne supprime pas stall interne. Ne pas promettre encore une suppression des saccades.
- Branche multitracks ; aucun commit/push. Préserver fichiers NAM/other_wam_host sans rapport.

## 22 octobre 2026 — Horizon audio8s et instrumentation par étape

- Suite à « étape suivante », diagnostic de la régression poursuivi. Un épisode d'indisponibilité auto-review a empêché l'ancien npm test de démarrer ; après « continue », relancé avec succès :405 tests passent (/tmp/nam-lookahead-suite.log).
- ProgressiveMultitrackEngine : horizon8s par défaut, remplissage toutes250ms uniquement pendant lecture, évite de préparer tous les BufferSource/Gain/Panner de l'audio d'avance. scheduledFrames empêche les doublons ; releaseVoices annule timer et set. Seek/pause/destroy propres ; rattrapage d'un bloc en retard en sautant PCM écoulé sur horloge commune. A/B natif déjà assemblé inchangé. Tests de graph borné, retard, seek/stale timer et référence Infinity.
- UiFrameMetrics.measure mesure les appels synchrones de publication audio, publication waveform, contrôles, plus scheduledVoices/audioLookAheadSeconds dans JSON. Ne pas attribuer le temps de GPU différé à ces durées JS. Référence diagnostic ?uiMetrics=1&audioSchedule=all ; jamais utiliser cette URL comme URL utilisateur normale. Valeur default8, aucun changement PCM/inférence/Auto.
- Navigateur comparatif sur Jet60s, modèle4GPU qualité, test de référence non borné :144 sources encore planifiées, p95RAF9,35ms/max122,8ms/2frames>50ms, LongTask116ms ; coûts synchrones maxpublicationaudio0,7ms/waveform1,365ms/contrôles0,17ms. Snapshot après fenêtre14s, pas de benchmark CPU.
- Deuxième test borné terminé ; rapport benchmarks/audio-scheduling-2026-10-22.json. Avant reset :36 voix, horizon8, disponible17,55s/position7,94s, calcul actif. Relevé final :32voix/position53,14, p95RAF9,36ms/max145,6ms/1frame>50ms, LongTask136ms, maxaudio0,35ms/waveform1,56ms/contrôles0,21ms. Fenêtres différentes : ne pas présenter les nombres144→32 comme une comparaison contrôlée au même instant ni annoncer gain FPS/CPU. Bornage prouvé par tests et observation. Dist reconstruite (/tmp/nam-lookahead-dist.log). Lecteur test remis en pause, screenshot /tmp/audio-lookahead-tested.png. Ne pas annoncer de fluidité parfaite sur ces chiffres.
- Serveur local8765 relancé après refus connexion. Branche multitracks, aucun commit/push. Préserver fichiers NAM/other_wam_host sans rapport.

## 22 octobre 2026 — Correction du slider et des rafraîchissements par paquet

- L'utilisateur signale thumb qui avance/recule et régression de fluidité, y compris ONNX4GPU. Cause certaine du recul visuel : main tick fixait seek.max à availableDuration, donc changement de dénominateur à chaque paquet. Corrigé via TransportTimeline (max=duration totale ; seek clamp disponible). Autre bug de focus : activeElement===range bloquait l'animation indéfiniment après clic ; ProgressSlider suspend seulement pendant drag effectif, pas focus.
- Cadence après ring : renderProgressiveTracks déclenchait peaks/règle/rendu à chaque paquet1s, plusieurs paquets par résultat neural. WaveformRefreshGate regroupe à250ms (4Hz max), audio et RAF inchangés ; refresh final forcé. Pas de modification d'inférence/raccords.
- Auto toujours segmentSeconds0. Qualité ONNX7,8s/overlap25%/~5,85s publish ; Aperçu2s/overlap1s ; SW4s/overlap1s. Ring découpe seulement la sortie<=1s. Ne pas dire que les modèles sont devenus1s.
- Tests :400 réussis, /tmp/nam-timeline-tests.log. Dist reconstruite (/tmp/nam-timeline-dist.log). Documenté RINGBUFFER_PLAN et spécification. Navigateur ONNX4GPU Qualité, extrait60s : lecture+calcul vérifiés, slider max60 alors que41s disponibles et position8,45s (axe stable, pas de normalisation sur disponibilité). À la fin :60s disponibles, slider max60/position28,38. Premier calcul GPU :input7,8s/publication5,85s, donc Auto inchangé. Rapport benchmarks/timeline-slider-2026-10-22.json.
- Les stalls RAF auparavant mesurés ne prouvent pas à eux seuls une cause GPU. Ces deux bugs UI sont certains ; ne pas promettre toute la fluidité rétablie ni baisse CPU sans profil comparatif. Source conserve un diagnostic ?uiMetrics=1.

## 22 octobre 2026 — Ringbuf.js intégré ; saccades résiduelles mesurées

- Branche multitracks, aucun commit/push. Conserver fichiers NAM manifest/madhatter et other_wam_host sans rapport.
- Bibliothèque officielle ringbuf.js0.4.0 vendored inchangée, MPL-2.0 + SHA/notice. StreamTransport.js : StreamPublisher produit PCM planar + peaks validés dans chacun des quatre Workers progressifs (Roformer, Aperçu, ONNX, six-stems WASM). StreamingWorker adapte leur protocole ; SAB SPSC trois secondes, packets<=1s, 65 536 float32 max/tâche, événements bornés, pas de drainage idle, attente atomique sur queue pleine (pas busy-spin), fallback transférable. done après dernière consommation, cancel termine worker + queue.
- Runners conservent validation structure/continuité, mais PCM marqué via WeakSet évite double scan UI ; AudioData attache les peaks aux AudioBuffer via WeakMap. WaveformAnalysis réutilise ces peaks, aucun aller-retour PCM pour les nouveaux instruments. Mix à réglages variables/restauration restent sur Worker waveform distinct ; aucune double consommation du ring.
- Serveur Node local en-têtes COOP/COEP/CORP, alignés sur Rails déjà configuré. Serveur8765 redémarré. Serveur temporaire8767 utilisé pour audit puis arrêté. Dist génère _headers pour hôtes compatibles ; ailleurs config HTTP nécessaire, fallback si non isolé. Pas de bypass CORS/CORP.
- UiFrameMetrics optionnel ?uiMetrics=1, Settings → Mesures ONNX → UI performance → Reset. Compteurs RAF bornés, Long Tasks, mode réel et isolation ; reset après warmup pour mesurer lecture stable. Visibilitychange remet l'origine de temps à zéro ; aucune instrumentation par défaut.
- Validation navigateur Roformer musique6s : shared-ringbuffer effectif, 12 canaux PASS aux anciens seuils ; RMSrel6,45e-5/max1,38e-4. benchmarks/ringbuf-audio-2026-10-22.json. Pas de dégradation PCM détectée.
- Test host Jet214,9s terminé et sauvegardé, 72 fenêtres neurales, premier paquet3369ms ; lecture+calcul et vue mix vérifiés, isolated=true/shared-ringbuffer : RAFp95~11,9ms mais MAX~2630ms, 91 intervalles>50ms/2435, LongTasks0. benchmarks/ringbuf-ui-2026-10-22.json. **NE PAS annoncer toute la fluidité résolue ou baisse CPU**. Cela oriente vers profilage GPU/compositeur, pas une preuve de cause. Pas de baseline avant ni profil CPU machine. L'utilisateur souhaitait intégrer le ringbuf et espérait fluidité complète : intégration réalisée mais limites à signaler franchement.
- Tests finaux :395 réussis, log /tmp/nam-ring-suite.log. Couverture vrai Worker Node, 12 canaux bit-exact, wrap/full/backpressure, tail, mode transférable, nonfini, metadata, cancel, peaks sans scan, métriques. Refactor Roformer worker test adapté aux packets<=1s. Dist reconstruite après les dernières éditions (/tmp/nam-ring-dist.log).
- Prochaines actions éventuelles : profiler rendu/queue GPU ONNX et compilation/input/cache ; continuer MDX-Net seulement après stabilisation selon priorité utilisateur. Ne pas confondre coût inférence avec transport ring.

## 22 octobre 2026 — Retour utilisateur fluidité et changement de modèle

- L'utilisateur signale encore des freezes et une forte charge CPU après la correction précédente. Ne pas annoncer que la fluidité est résolue ; aucun profil FPS/CPU avant-après disponible.
- Proposition ringbuf.js étudiée, PAS intégrée. RINGBUFFER_PLAN.md contient le pipeline proposé, les références wam-studio lues au commit 4c268f7b5791bcb11be3c1cf510b1a4a7728dd02, l'état actuel des transferts, COOP/COEP absents sur serveur local, SPSC/backpressure/générations, tests et mesures à réaliser. Réduire scans PCM UI et aller-retour waveform en calculant les peaks côté producteur. postMessage actuel transfère déjà sans clone ; SAB seul ne réduit pas l'inférence.
- Implémenté : ModelSelectionTransaction, draft Settings Annuler/Valider/Escape ; changement confirmé modèle/backend invalide ancienne génération, termine les runners et réinitialise quatre/six pistes vides via SeparationWorkflow.resetResult, original conservé. Même sélection = opération conservée. Ancien catch/finally/chunks ignorés ; préparation nouveau modèle en arrière-plan. Sauvegarde exclut un résultat vide.
- Tests : 385 réussis, log /tmp/nam-model-switch-tests.log. Navigateur : séparation Roformer du morceau Jet lancée, ouverture Settings pendant calcul, sélection Aperçu quatre pistes puis Valider => ancienne séparation annulée, quatre lanes vides, position0, Play disabled. Dist reconstruite après les derniers libellés (/tmp/nam-model-switch-dist.log).
- Branche multitracks, aucun commit/push. Préserver changements NAM manifest/madhatter et other_wam_host.

## 22 octobre 2026 — Fluidité pendant la séparation

- Branche multitracks, sans commit/push. Inférence et DSP déjà dans Workers ; le lecteur recalculait les peaks de tout le PCM publié sur le thread principal à chaque nouveau bloc.
- WaveformAnalysis.js / WaveformWorkerCore.js / waveform-worker.js : calcul des enveloppes instruments et mix dans un Worker dédié, copies natives copyFromChannel par blocs de 16 384 frames maximum ; mémoire AudioBuffer audible jamais transférée. Cache WeakMap par buffer et paramètres ; seuls les nouveaux blocs sont lus à réglages constants. Le mix somme le PCM avec gain/pan avant extraction des peaks (conserve annulations de phase).
- Annulation latest-wins sur changement de projet ; aucun résultat ancien ne repeint la nouvelle session. Worker terminé à destruction ; erreurs propagées. Fallback sans Worker réservé aux tests Node.
- Playhead unique partagé via translate3d, aucune lecture de géométrie ni renderProgress par piste à chaque frame. Position/slider restent RAF ; statuts et synchronisation de contrôles à 10 Hz ; boucle A/B inchangée ne réécrit plus son DOM.
- 378 tests passent (/tmp/nam-waveform-tests.log), dont cache incrémental, copies bornées, calcul exact du mix, invalidation des réglages, annulations, transferts, destruction et 1 000 déplacements sans redessiner les waveforms.
- Dist reconstruite avec les trois nouveaux modules. Test navigateur source : projet Jet six pistes restauré, nouvelle séparation GPU du morceau entier lancée, Play activé pendant les publications. Pas de mesure FPS/long tasks avant-après : ne pas annoncer une garantie 60 FPS. GPU chargé, transferts AudioBuffer et rendu canvas peuvent toujours avoir un coût ; profilage à poursuivre si des saccades persistent.


## 22 octobre 2026 — P4.9 BS Roformer SW intégré et validé (expérimental)

- Toujours branche `multitracks`, aucun commit/push. Ne pas toucher aux changements NAM models-manifest/madhatter et other_wam_host sans rapport.
- Catalogue exécutable : 5 modèles, nouveau `bs_roformer_sw_6s`, runtime `bs-roformer-onnx`, six sources dans l’ordre basse/batterie/autres/voix/guitare/piano. GPU préféré pour isoler la guitare si disponible. Demucs 6s GPU n’est PAS activé : son ancien diagnostic en échec reste distinct de SW.
- Sources/poids épinglés dans research/bs-roformer-sw.json. Installer `node tools/install-roformer-model.mjs` (utilise l’artefact local vérifié sinon download HF immuable), puis dist habituelle. Poids 352 778 874 octets ignorés par Git, servis depuis model-assets et inclus dans dist ; navigateur télécharge/cache/vérifie sur demande. Droits checkpoint d’origine non précisés, notice explicite ; MIT du code FFT/export ne prouve pas une licence des poids.
- Nouveaux RoformerDSP.js, RoformerCoreModel.js, roformer-worker.js. FFT2048/hop512/Hann périodique/réflexion/non normalisée ; fixe4s, zéro-pad queue puis crop, overlap1s / publication3s. FFT primitive MIT vendored, reconstruction indépendante corrige le bin négatif F écrasé dans la démo tierce.
- PreparedDemucsRunner partagé : Worker factory selon runtime, 4 ou 6 sources validées, session unique persistante, chauffe sur silence. Libération sur changement/cancel/destroy ; fallback CPU avant première publication seulement, jamais après un paquet ni après AbortError. main affiche le backend réellement utilisé après fallback.
- Diagnostic roformer-benchmark.html/.js, artefacts lourds dans third_party/bs-roformer-audit (ne pas les requérir pour le lecteur principal). Comparaison de chaque canal (12) avec les seuils préexistants inchangés. Référence déterministe = PyTorch fourni par l’exporteur ; musique6s = poids CPU ORT natif + DSP PyTorch et mêmes raccords. Pas de SDR musical ni d’écoute humaine revendiquée.
- GPU déterministe4s : 2,9735 s, max8,32e-6 / RMS relative5,74e-5 ; CPU/WASM navigateur4s : 34,6764 s, max9,31e-9 / RMS relative3,38e-7. GPU musique6s : 5,6172 s, premier bloc3,0702 s, max1,38e-4 / RMS relative6,45e-5. CPU est un secours lent. Rapport roformer-browser-2026-10-22.json et ROFORMER_VALIDATION.md.
- Test host10s à48kHz : premier bloc2,7152 s, total7,7201 s /3blocs, six pistes jouées, solo guitare togglé, sauvegarde projet et export MP3 vers Tracks terminés. Test entier214,9s terminé : 72blocs, premier3,1936s / total228,3175s, lecture avec avance pendant calcul, sauvegarde réussie. Ne pas garantir lecture continue dès3s : légèrement plus lent que réel. Rapport roformer-browser-2026-10-22.json.
- Suite finale : **371 tests réussis**, voir /tmp/nam-roformer-tests.log. Dist reconstruite ; poids Aperçu et SW vérifiés taille/SHA-256 dans dist. Projet entier six pistes restauré dans la dist, prêt en pause, Play activé. Préparation de session en arrière-plan au démarrage/restauration : les stems en cache peuvent se lire sans attendre le préchauffage. isPreparing évite de relancer une préparation identique.
- Prochaine tâche après SW : MDX-Net Inst HQ4/5. Ne pas annoncer les autres variantes Roformer/SCNet intégrées.


## 22 octobre 2026 — P4.11 Aperçu rapide intégré ; début P4.9 SW

- Branche multitracks, aucun commit/push demandé. Conserver les changements NAM manifest/madhatter et other_wam_host sans rapport.
- Modèle `htdemucs_4s_preview` : vrai ONNX court 88200 frames, 4 sources, contexte 2 s / publication 1 s avec recouvrement 50 %. Choix explicite dans Change model / settings → Model. Qualité reste le modèle recommandé par défaut. Aperçu modifie le rendu ; guitare dans Autres.
- `PreparedDemucsRunner.js` / `preview-worker.js` : cache normal taille+SHA-256, préparation automatique sur silence avant Separate, session réutilisable. Changement modèle/backend, annulation, destruction : Worker terminé, générations obsolètes ignorées. Erreur de préparation GPU : repli CPU si option autorisée ; aucun redémarrage CPU après publication. Pas de polling.
- Export généré ignoré par Git : `examples/wam/source-separation/model-assets/htdemucs-2s-core.onnx`. Déjà installé ici et inclus dans la dist. Nouvelle machine : exporter/valider avec l’environnement de LOW_LATENCY.md puis `node tools/install-demucs-preview.mjs` ; le script refuse un hash différent de celui validé. Build vérifie l’existence du modèle. Les 162,2 Mio sont servis depuis la dist, sans dépendance au laboratoire third_party après déploiement. Licence MIT officielle dans model-assets/LICENSE, notice et provenance.
- Modèle/profil sélectionnés enregistrés dans separation ; provenance du rendu effectif dans `resultRender` et les métadonnées du MP3, suffixe « aperçu rapide » pour son export vers Tracks. Pas de recalcul Qualité implicite.
- Essais réels : prototype 10 s, premier bloc 642,5 ms ; host 48 kHz, 10 s, 802,9 ms. Host morceau entier 214,9 s, 214 blocs, premier bloc 1113,8 ms, total 115,10 s, lecture pendant calcul et sauvegarde terminées. La copie/validation PCM complète ralentit le départ sur fichier long ; ne pas garantir 1 s. Rapport `benchmarks/preview-integration-2026-10-22.json`. Pas de pic mémoire mesuré ni guitare physique testée.
- Dist testée aussi sur CPU/WASM : signal réel 1 s, premier bloc 2323,9 ms, export MP3 vers Tracks sélectionné, suffixe « aperçu rapide » confirmé. Le CPU reste un secours et ne garantit pas une lecture progressive temps réel.
- Validation finale : **363 tests réussis** (`/tmp/nam-preview-tests.log`), dist reconstruite et modèle inclus vérifié taille/SHA-256. Restauration du projet entier en pause testée depuis la dist.
- Tampon existant = pause/reprise quand les données manquent. Tampon prédictif et réduction des copies initiales = suite possible ; aperçu reste expérimental.
- **P4.9 SW-1** : sources GitHub et modèles HF épinglés dans `research/bs-roformer-sw.json`, FP16 + reference.npz téléchargés/hash vérifiés dans third_party/bs-roformer-audit. `tools/validate-roformer-reference.py`, ORT CPU 1.22.0 : comparaison des deux branches et six sources réussie (<1e-3), chargement 2.87 s / inférence seule 11.04 s. Rapport roformer-cpu-reference-2026-10-22.json. Ce sont des spectrogrammes comparés à la référence tierce fournie, pas une validation du navigateur ni une mesure de qualité musicale.
- **Prochaine étape SW-2** : DSP FFT2048/hop512/Hann/reflection non normalisée, nouveau contrat réel/imag `[1,2,1025,345]`, sorties six sources ordre basse,batterie,autres,voix,guitare,piano. Export figé 4 s. Adaptateur + diagnostic CPU/GPU douze canaux / première et dernière fenêtre avant menu, téléchargement/cache et morceau entier. Ne pas utiliser OnnxCoreModel Demucs. Licence des poids d’origine toujours non déclarée ; ne pas confondre avec MIT du pipeline.
- Priorité ensuite : MDX-Net Inst HQ4/5, MelBand/ViperX, MDX23C, SCNet XL, MDX Extra Q, restauration vocale. Voir MODEL_CANDIDATES.md.

# NAM A2 WAM — Next-session handoff

## 2026-10-22 — P4.10 short-model low-latency feasibility proven, main integration still TODO

Remain on multitracks, no commit/push. Real official htdemucs core exports at1s and2s generated in ignored third_party/nam-latency-probe/ (~169MB each). tools/export-demucs-short-probe.py exposes installed Demucs4.0.1 forward real-valued branches via AST, disables use_train_segment and MHA fast path, exports fixed shapes and compares CPU/PyTorch. tools/validate-demucs-short-audio.py generates6s public-fixture references, validates reconstructed CPU audio, compares short vs full7.8s context and emits paired WAVs. Python3.12 temp env /private/tmp/nam-latency-export with torch/torchaudio2.6.0,onnx1.19.1,ort1.22.0. See LOW_LATENCY.md for reproduction.

New separate lab low-latency-benchmark.html/js + low-latency-worker.js, linked in Settings diagnostic paragraph. Not a new production model; original catalogue/Auto remain unchanged. Core adapter accepts explicit44100/88200/176400 frames for lab, defaults343980 untouched. Worker holds one session, warms on zeros before Separate; true audio only begins on Separate. 1s neural window publishes0.75s;2s window publishes1s with overlap. Same ProgressiveMultitrackEngine and four stereo stems, first-ready timing from click before context resume, optional automatic diagnostic Play and underrun counting. Cancel/stale loads handled. FP32 GPU device requested without shader-f16 for explicit precision. Keep this separate from production until preview/quality integration validated.

IMPORTANT DSP FIX: vendor/demucs-js/apply.js padReflect left side previously read destination zeros (result[srcIdx]) rather than source(arr[srcIdx]). Corrected, MIT notice appended and independent DFT regression test added. Spec relative error vs torch1.70e−7 afterfix vs0.001796 before. Same correction benefits production7.8s; saved PCM not recalculated.

Validated Chrome/WebGPU on6s CC-BY fixture:1s warm first435.8ms;2s warm first767.7ms,repeat951.4ms; actual scheduled diagnostic Play797.9/981.7ms,0underruns. New cold session1s1684ms,2s2284ms (browser/driver caches not cleared); first2s preparation6.89s. Fourstems/all8channels match PyTorch SAME short context: max2.64e−6 /3.02e−6. Short output differs from full7.8context ~20–40% relativeRMS(1s),~15–23%(2s), not a perceptual quality score or proven loss. No isolated studio truth/human listening claim. Main fast mode still TODO P4.11; do not claim one-second cold-start guarantee or identical audio to full context. Final: 357 automated tests pass, full dist rebuilt, browser console errors none. Lab left paused with automatic playback checkbox unchecked. Screenshot /tmp/nam-low-latency-proof.png. Metrics benchmarks/low-latency-browser-2026-10-22.json.


## 2026-10-22 — P4.8 user correction: remove segment menu, research model shortlist

Stay on multitracks; no commit/push. UI segment selector and hint removed from host and standalone. main always uses segmentSeconds=0, ignores saved manual sizes, saves0. Internal SegmentSettings/tests remain for diagnostics. Duration/excerpt and model/backend summary unchanged. 7.8s is HTDemucs/export contract, not ONNX format limit; true short-window re-export is a separate experiment.

New ModelResearchCatalog.js has 8 references shown in Settings details Autres modèles · étude de compatibilité. Separate from models.json and download manager: no fake inference/download controls. New MODEL_CANDIDATES.md sources/evidence/priority/next tasks. SW has concrete third-party ONNX/browser demo elicwhite/bs-roformer-web, 336MB FP16/669MB FP32, six-stem spec-mask contract requiring new DSP/adapter. Source checkpoint license unknown while export labels MIT; preserve uncertainty. MVSep guitar table consulted has SW first9.012, not evidence of universal quality or export parity. InstHQ4/5 .onnx second candidate; MDX23C CKPT, MelBand/Kim/ViperX CKPT, SCNetXL fourstems CKPT (Large ONNX differs), MDX Extra Q is Demucs3 bag not MDX-Net, DeEcho .pth postprocessing. No new runnable engine integrated in this research task. Next P4.9 SW feasibility/adapter with allsixstems validation before enabling.

Final validation: 353/353 automated tests pass. Rebuilt dist. Chrome confirms no segment selector, main duration/model/backend preserved, Settings research accordion has eight entries and only three runnable Model options, no candidate download actions, no console errors. Evidence benchmarks/model-research-ui-2026-10-22.json and screenshot /tmp/nam-multitracks-model-research.png. Preserve all unrelated NAM imports and other_wam_host files.


## 2026-10-22 — P4.7 configurable segment duration + parallelism feasibility

Remain on multitracks. No commit/push requested. Main workspace now shows segmentSeconds menu (0 Auto,1,2,3,5,7.8), adjacent to excerpt duration; segmentHint explains fixed ONNX neural window 7.8s, overlap and context cost. SegmentSettings.js shared by all workers: Auto preserves 7.8s/25% ONNX,5s/20% WASM; classic short <=10s retains its direct inference only in Auto. Explicit sizes force windows even on short sources. Runners forward setting including GPU→CPU fallback; save state stores separation.segmentSeconds and old states restore Auto. Disabled while busy.

Study SEGMENTS_AND_PARALLELISM.md: independent windows can be inferred in parallel then reordered before overlap; CPU pool memory expensive (~2.3GiB per legacy heap), GPU sessions share resources and gain unproven, hybrid CPU FFT/GPU pipeline worth profiling first. Official ONNX sources linked. No pool enabled, no speedup promised. Validation: 350 tests pass. Actual Chrome GPU runs on the same first10s of Slow Motion Dream: 1s segments13blocks/27.4s,2s7blocks/16.4s,Auto2blocks/5.5s Worker elapsed. All return full10s/fourstems, save locally, stay paused; console errors none. Evidence benchmarks/segment-size-browser-2026-10-22.json. Final dist rebuilt; keep UI setting Auto recommended. No benchmark of actual parallelism or musical quality equivalence. Existing unrelated NAM models/examples remain untouched.


## 2026-10-22 — P4.6 whole song by default; visible duration/model

Remain on multitracks, no commit/push requested. Main UI now contains excerptSeconds label moved out of Settings and activeModelSummary (selected label + CPU/WASM or GPU/WebGPU). Button renamed Change model / settings. Range 0 means entire source; new imports reset to 0, saved projects restore their explicit old choice. SeparationRange.js owns frame selection and label formatting. No silent 10/60 s truncation in any runner/worker; max validation 24h consistent with saved sessions. File input limit raised 32→512 MiB, source-state validator matches.

ONNX and progressive6s keep bounded overlapping windows. Classic/FT demucs-worker retains direct inference <=10s, otherwise processes 5s windows/1s overlap with ChunkTools; one specialist per Worker as before. All output frames and last tail retained. DemucsRunner carries block metadata into callbacks; SeparationProgress weights blocks across all four FT specialists. Complete outputs still use RAM/IndexedDB; this is not disk streaming. Whole-song menu 0 is JSON-safe, old 1/5/10/30/60 states supported. Models catalogue duration metadata updated, six-stem GPU remains disabled.

Final validation: 344/344 tests passed. Chrome distribution performed real ONNX WebGPU separation of Are You Gonna Be My Girl - Jet, full 214.9 s, four stems, 75.9 s Worker elapsed; result 214.9/214.9 s complete, saved locally, stayed paused, console errors none. Evidence source-separation/benchmarks/full-song-browser-2026-10-22.json. Distribution rebuilt after final UI text/reset/CSS changes. No other NAM imports or unrelated host examples modified.


## 2026-10-21 — User correction: original Tracks restored; new Multitracks + MP3 bridge

This supersedes the earlier P4.4 replacement UI. Stay on multitracks; changes remain uncommitted. Tracks must remain the ORIGINAL BackingTrackPlayerElement with cards, library, speed/time-stretch, auto-normalize and original layout. Only add a right-click waveform popover action Separate Stems (top-layer popover avoids the old reader container containment/clipping). Third topbar workspace Multitracks holds the simplified player with left separated-project catalogue, import/search, human song title, Separate, Play/Stop/A-B/zoom, detailed or reduced mix, Export mix to Tracks. Model/cache/test/normalization/save controls live in a real Settings dialog closed by default; progress/errors stay visible.

IMPORTANT AUDIO: one WorkspaceAudioRouter gates the two backing outputs into ONE BackingTrackMix(context,rack.output,router). Never instantiate a second rack/guitar final mixer. Embedded SeparationMixer uses a mixFactory adapter attaching its backing bus to the router; it does not route guitar or destination. Crossing Tracks/Multitracks pauses previous backing, keeps settings; Tone retains active backing. Real host context reused. Separate Stems copies/resamples raw original buffer offline to 44.1 kHz, never mutates Tracks.

MediaRepository is an injectable async repository boundary. IndexedDB nam-media-library has entries (light metadata/project state) and assets (MP3 Blobs); list reads only entries, getTrackFile fetches ONE Blob. Project PCM remains in SessionAudioStore, one selected project's key at a time. Neither list eagerly loads PCM. Successful separation creates a project; Settings Save and export update it. Local storage only, no backend upload; future HTTP adapter can replace repository/audioStore (both injectable).

MP3 export: Mp3ExportCore + Mp3Exporter + classic mp3-export-worker.js, pinned unmodified lamejs 1.2.1 from npm (integrity verified), LGPL provenance in vendor/lamejs. Stereo 192 kb/s, per-stem volume/pan/mute/solo + common normalization/internal gain, no live guitar/global monitoring balance. Over-range mix attenuated before int16. Worker cancellable, transfers COPIES so playback PCM is never detached. Exports complete current deck, not A/B only. Save Blob/metadata, refresh original Tracks library via ExportTrackLibrary, select new MP3 in pause. Export also stores project edits. Original reader supports generated IDs lazily via library.loadFile(id), with old static catalogue/import/time-stretch intact.

Final validation: 340/340 automated tests passed. Distribution rebuilt with npm run dist -- --no-regenerate --no-build. Chrome verified original Tracks controls, right-click Separate Stems switching automatically to Multitracks, real ONNX GPU four-stem/5s project, detailed/mix views and A/B 1–4 s. Export generated a real MP3 decoded by the original reader (0:05 duration, selected in pause); exported entries survive reload. Multitracks reload lists project metadata with zero wave rows until selection; the selected project restores in pause. Settings is closed by default and test controls are invisible until opened. Final dist console errors: none. Evidence: source-separation/benchmarks/workspace-transfer-browser-2026-10-21.json; screenshot /tmp/nam-tracks-multitracks.png. Six-stem GPU remains CPU-only; source separation excerpt limits unchanged. Do not stage unrelated NAM model imports or examples/other_wam_host.


## 2026-10-21 — P4.4 delivered on multitracks: real Tracks integration + local sessions

Stay on `multitracks`; no merge to main. P4.4 changes are currently uncommitted; no commit/push was requested in this turn. Main checkpoint remains faa52c8. P1–P4 are now delivered. The actual host `/examples/wam/`, workspace Tracks, uses `<multitrack-player>` instead of the old backing player. Static host `/dist/NAM_A2_WAM/` contains the same integration. The standalone prototype remains `/examples/wam/source-separation/`. Next: phase 5a session/model cache maintenance, longer inference/export and broader UVR/GPU quality validation; six-stem GPU stays unvalidated/CPU-only.

`source-separation/main.js` exports `mountSeparationPlayer(root, options)`. Standalone auto-mount is guarded; the host element mounts the exact same controller in Shadow DOM using the local prototype HTML as an inert template. Inject host AudioContext + `rack.output`; SeparationMixer creates the ONE final output. Never instantiate an additional BackingTrackMix in host main or connect rack.output to destination separately. Preserve real guitar pan/balance and Tone/Tracks switching; default host backing volume −12 dB. Model-cache checks run independently of the live-guitar host startup. Library loads/imports use generation tokens; stale reads do not overwrite a newer selection. Missing models can be configured through Separate instruments without auto-download.

`MultitrackState.js`: lightweight version 2 metadata, validated ranges/source identity, deck mode, individual mixes/positions/regions/view/zoom, normalization target + analyzed/enabled state, global mix and backend/model choices. `SessionAudioStore.js`: separate IndexedDB `nam-multitrack-sessions`, one atomic original+result PCM record per snapshot, no weights or PCM in localStorage. Explicit Save only; latest metadata in `nam-host-multitrack.v2` (host) or `nam-multitrack-prototype.v2` (standalone). Host Save/Restore state awaits backing getState/setState. Restore builds valid staged decks, recomputes enabled/bypassed normalization, then publishes and stays paused. Empty state clears backing but retains global settings. Missing PCM prompts matching file reimport or catalogue re-selection; missing stems fall back to original with explicit recalculation notice. Invalid metadata/PCM and quota failures do not publish corrupt decks. Full and cancelled partial progressive results are supported; ongoing inference must finish/cancel before saving. v1 library/local-file migration supported; older non-unit playback speed explicitly warned and restored at speed 1. Multipiste time-stretch and auto-normalize-at-load are not implemented.

Storage is local to profile/origin; snapshot keys are distinct and old snapshots are not garbage-collected yet. Complete original PCM is stored as well as short separated PCM: a long original can exceed quota. No portable project export or backend upload. Build: npm run dist -- --no-regenerate --no-build. Tests: 329 automated; native offline rack+backing render after restore at balance 0/.5/1 max error 4.86e−9, results source-separation/benchmarks/host-routing-native-2026-10-21.json. Chrome verified library original (324.9 s), WebGPU 4-stem separation (5 s), mix view, A/B 1–4 s and modified stem volume .15, explicit save, full host reload and restoration without playback. Standalone demo save/restore also passed. Dist restored the shared-origin cached session, stayed paused and re-enabled Separate instruments. Results in source-separation/benchmarks/host-session-browser-2026-10-21.json.

Pre-existing unrelated changes remain untouched: src/nam-wam/models-manifest.json, src/nam-wam/models/tone3000/madhatteramplab/, examples/other_wam_host/. Do not stage them. This task does not authorize a new merge to main.


## 2026-10-20 — multitracks: P4.3 peak normalization delivered

Current development branch: `multitracks`, tracking `origin/multitracks`. Main was checkpointed/pushed at `faa52c8`; first branch commit `ee968ec` shades outside A/B. Do not merge into main without user instruction. Prototype route stays `/examples/wam/source-separation/`; distribution `/dist/NAM_A2_WAM/source-separation/` on port 8765. Next implementation: **P4.4 actual host Tracks integration and state restoration**. P4.1–P4.3 are complete in the separate prototype; the main host UI is not yet replaced.

`PeakNormalization.js` reuses the cooperative stereo PCM-sum analysis from `MixWaveform.js`, bins=1, to measure the complete current mix after per-stem volume/pan/mute/solo and fixed engine output gain. Targets −1/−3/−6 dBFS, maximum boost +24 dB, silence threshold 1e−8 -> unity. A dedicated engine normalization GainNode sits between voice pans and outputNode; all native/progressive/A-B sources pass through it. Never modify PCM, normalize stems independently, create another AudioContext or route another destination. Paused corrections are applied immediately, playing corrections ramp over 10 ms; no voice restart. Guitar and user master/balance are downstream, so this is not a final-output limiter or a LUFS/true-peak normalizer.

Each deck owns target/result/enabled state. Mix/PCM edits invalidate and cancel analysis and remove gain with an explicit UI prompt; view, zoom, loop and transport do not. Complete progressive streams and retained partial results may be normalized, incomplete streams may not. Stale async results never apply to a new input/deck. Mix waveform uses effective normalization gain; raw stem peaks remain raw. UI offers Analyze/Cancel, target, Active bypass, Remove. No automatic playback. Persistent restore remains P4.4.

Validation: 318 automated tests passed. Chrome verified real ONNX/WebGPU separation, original +2.1 dB at −1 dBFS versus instrument −0.1 dB at −3 dBFS, independent targets/corrections restored on deck switch, bypass, stale-mix invalidation, grayed outside region and mix view. Rebuilt dist verified on demo normalization (+14.2 dB at −1 dBFS). Native Web Audio reference page `tests/phase6/browser/peak-normalization-reference.html`, six cases passed with maximum absolute peak error 8.94e−8. Results in `examples/wam/source-separation/benchmarks/peak-normalization-native-2026-10-20.json`. Outside-loop gray overlays are pointer-transparent, scale with zoom and hide when Loop is unchecked. Build command `npm run dist -- --no-regenerate --no-build`. Unrelated pre-existing working changes remain excluded: other_wam_host and Mad Hatter NAM import/manifest.


## 2026-10-20 — multitracks branch: outside-loop shading; P4.3 next

Main checkpoint `faa52c8` pushed to origin/main. Further prototype changes are on `multitracks`; do not merge them into main without instruction. Waveform-only overlays lightly gray areas outside A/B when Loop is enabled, disappear when disabled, follow zoom and instrument/mix views, and never intercept pointer input. Regression test added (307 total). Next work in this branch: P4.3 reversible peak normalization using a common gain for the complete current backing mix; no per-stem normalization, no modification of PCM, no automatic playback. Update docs, tests and dist before delivery.

## 2026-10-20 — Source separation checkpoint; development moving to multitracks

Prototype: `examples/wam/source-separation/`, URL `http://127.0.0.1:8765/examples/wam/source-separation/`; static build `dist/NAM_A2_WAM/source-separation/`. Specification: `SPECIFICATION_SOURCE_SEPARATION_MULTITRACK.md`. P1–P3, P4.1 (shared host mixer) and P4.2 (A/B loops) are delivered. 306 tests pass; source and dist verified in Chrome with real music; dist rebuilt with `npm run dist -- --no-regenerate --no-build`.

WebGPU-capable machines prefer the validated ONNX four-stem model; guitar is in Other. Explicit CPU choices remain valid, with CPU fallback before the first published block. No automatic weight download. 6s and FT remain CPU/WASM: six-stem GPU diagnostic produces audio but fails numeric agreement on real music (7.317% RMS). See `examples/wam/source-separation/SIX_STEMS_GPU.md`; do not enable this experimental graph in the catalogue.

A/B regions are editable via handles, keyboard, numeric inputs and position buttons; shared across stems and mix view, zoom independent. Progressive playback waits for unpublished B. Available selected windows loop natively; one window per track is cached. If B arrives during playback, the first return retains the existing 30 ms scheduling latency. Original/instrument switching copies compatible regions in seconds; an original region outside a shorter excerpt remains on the original deck.

User requests this checkpoint on main then further development on branch `multitracks` to protect the main UI. Next: shade areas outside A/B, then P4.3 reversible common-gain audio normalization. P4.4 (actual Tracks host integration and state restore) remains pending: the prototype currently reuses the host mixer but is not the main host's multitrack player. Preserve one AudioContext, one destination, one shared clock; never sum original and separated output. Unit tests for each feature, full suite before user testing. Keep HANDOFF current.

Unrelated pre-existing local changes excluded from this checkpoint: `examples/other_wam_host/`, `src/nam-wam/models-manifest.json`, `src/nam-wam/models/tone3000/madhatteramplab/`. Do not remove or accidentally stage them.


## 2026-10-09 — Guitar-reference calibration

Calibrate level now measures the bundled 8–20 s Funky-Guitar excerpt in an isolated Worker/WASM instance, without interrupting or injecting audio into the live graph. Fixed −18 dB reference trim plus NAM input gain; −24 dBFS RMS target, −1 dBFS reference peak ceiling, ±36 dB measured correction (metadata still ±12 dB). Results replace metadata correction, retain per-capture/variant WAM state and cancel on supersession/model changes. Inline progress/errors/limits. Real WASM validation: Bogner m689735 −4.19 dB and Deluxe Room m383454 +27.00 dB both reach −24 dBFS on the excerpt without peak limiting. 149 Node tests passed; static distribution rebuilt. Resumed validation: browser Worker completed on Deluxe Room (+27.0 dB) and rebuilt distribution Bogner m689735 (−4.2 dB); metadata reset clears measured status. Corrected details target display to use the measured target. Final 149 tests passed and distribution rebuilt.

## 2026-10-09 — Button contrast and guitar-sample level comparison

Back to rack now explicitly retains light background/dark text on hover and keyboard focus. Distribution rebuilt. Real WASM render of the full bundled Funky-Guitar.mp3 at −18 dB trim confirms a 19.98 dB RMS difference between Bogner m689735 and Deluxe Room m383454 after metadata normalization. This CAN be compensated using output correction measured on that sample; reference-sine calibration is insufficient. See docs/model-level-comparison-2026-10-09.md for peaks, protocol and balanced-gain example. No DSP policy or user settings changed.

## 2026-10-09 — Finish model selection and diagnose unequal levels

Added Back to rack below grouped Factory/Favorites capture lists (enabled on the loaded model) and below generic/downloaded lists. Uses the same host return event as TONE3000 success. Calibration copy now explains reference-level normalization and clean/driven differences. Real WASM probe comparison reproduced a 24.49 dB gap at low input between first Bogner and Deluxe Room captures, versus 0.84 dB at reference input; see docs/model-level-comparison-2026-10-09.md. No DSP/gain policy change. Validation: 147 Node tests passed; distribution rebuilt.

## 2026-10-08 — Rack capture selector and TONE3000 return

Successful TONE3000 capture loading requests closing its own host editor and returns to the rack. Failed loads keep the editor open. NAM cards now have a capture dropdown between previous/next arrows below the photo; Factory discovery works without creating a GUI, while an existing editor supplies its remote TONE3000 collection. Capture selection stays instance-local, with loading/boundary disabling. Rack rows reserve the selector height to keep cards aligned. Validation: 147 Node tests passed (including mocked TONE3000 success/failure navigation), browser verified Factory next/dropdown selection and card layout; distribution rebuilt. Live authenticated TONE3000 callback not exercised.

## 2026-10-08 — Highlight only the loaded model and capture

Factory cards now mark the loaded model with an accent border and Current model badge. Capture highlights follow the loaded asset identity, not each card’s preview index. TONE3000 uses the same loaded-only capture rule. Regression tests cover inactive cards, switching loaded identity and failed loads. Validation: 147 Node tests passed; distribution rebuilt.

## 2026-10-08 — Direct amp calibration and simpler model navigation

Amp settings now contains automatic model-level normalization, calibration, metadata reset and correction display. A collapsed Model details disclosure combines artwork/capture navigation and metadata. Change amp model opens the catalogue directly, with Back to amp settings; the overview/models/details tab bar is removed. Preferences retains A2 rendering mode. Validation: 146 Node tests passed; in-app browser verified measured calibration, metadata reset, catalogue/return navigation and details expansion; compact viewport visually inspected. Distribution rebuilt.

## 2026-10-08 — Stable per-chain volume

Removed the automatic −6 dB mix attenuation when both lanes are enabled. The shared mix now stays at unity for independent inputs and splits, so showing, enabling or muting one lane does not alter the other lane’s contribution. Updated the specification and regression coverage for visibility, mute, UI mode, source loss, routing and state restoration. Validation: 146 Node tests passed; static distribution rebuilt. Physical guitar listening remains untested.

## 2026-10-07 — Model-only navigation

Preferences and Help are standalone buttons beside Change amp model in Amp settings, not model-browser tabs. Models navigation now contains Model overview, Models and Model details only. Overview keeps model artwork/captures/calibration and omits audio meters/gain/flow; Amp settings is reached with Back to amp settings. Global views retain that return action and accessible pressed buttons. Validation: 145 Node tests and 8 Chrome checks passed; desktop screenshot inspected. Distribution rebuilt.

## 2026-10-07 — Backing-track loading progress

Added a transfer progress bar and an explicit engine loading state. Play is greyed out/disabled through download, decode and peak analysis, including when a previous buffer exists; engine play() also guards pending loads. Unknown sizes and audio preparation use indeterminate progress. Superseded downloads cannot update current progress. Errors hide the bar and retain the previous playable buffer. Existing playback continuation behavior is preserved. Validation: 145 Node tests and 6 browser checks with throttled transfer/decode and network failure passed. Distribution rebuilt.

## 2026-10-07 — Gate in Amp settings and model CTA

Moved the single NAM noise-gate control (enable + threshold) from Main artwork to Amp settings before the tone-stack knobs. Existing WAM parameter/automation bindings are unchanged. Change model is now Change amp model, centered below the model name with a larger accent-colored button. Help updated. Validation: 145 Node tests and 9 Chrome checks including gate enable/threshold parameters and model-browser navigation; desktop screenshot inspected. Distribution rebuilt.

## 2026-10-07 — Audio toolbar placement

Enable/Disable live input now shares the device-selection toolbar. Change audio source appears only in full mode; switching to beginner closes the sidebar. The 1 / 2 chains toggle bolds only the current count, with an accessible label describing current and target counts; updates also follow state restoration.

## 2026-10-07 — Hide route action at connected junction

The small route action is hidden at the active A→B junction (and at the preview junction), including on hover/focus. Other insertion points retain the 700 ms hover grace. Moving/removing the route restores the old action; the existing route label remains the edit/remove control. Focus moves to the adjacent + when its route action becomes hidden.

## 2026-10-07 — Main-host tuner popup

- Added top-bar Tuner with SVG tuning fork, available in both UI modes. `TunerView.js` lazily instantiates the catalogue tuner on a silent parallel tap of chain A input (after source trim, before effects). No microphone activation, backing-track analysis or insert-menu entry.
- Existing tuner GUI mounts after dialog visibility and powers on automatically. Close/Escape cancels pitch animation, disconnects/destroys the instance, and restores focus. Async opening is guarded against close/reopen; errors appear in the dialog. Static build now includes TunerView.js.
- Validation: 145 Node tests; 10 Chrome checks passed without exceptions, including detection of synthetic 220 Hz as A, nonzero canvas dimensions, silent output branch, unchanged rack, close/reopen and cancellation during loading. Physical instrument/microphone not exercised. Desktop screenshot inspected. Distribution rebuilt.
- Compact inline tuner UI remains deferred as requested.

## 2026-10-07 — Detail editor header

Removed the host-level Bypass ON/OFF button from all detailed card editors. The header retains Replace, Remove and Close. Card-level bypass and plugin-native controls remain available.

## 2026-10-07 — Direct live-input shortcut

- The existing Enable live input toggle moved from the sidebar to the rack header. It remains enabled in file-source mode and immediately selects Live input, stops the dry player and activates the selected input. It becomes Disable live input while monitoring. Busy clicks are disabled; capture errors open the sidebar to expose the status.
- The adjacent panel icon now has the visible label Change audio source, retaining its expand/collapse behavior.
- Validation: 145 Node tests and 10 Chrome checks passed, including file-to-live, stop, and permission failure using a simulated MediaStream (no physical microphone). Distribution rebuilt.

## 2026-10-07 — Beginner/full UI and compact NAM editor

- Host sidebar starts fully collapsed, toggled by the accessible panel icon in the rack header; Escape from inside closes it. Source selection and diagnostics remain there; live-input activation is now directly in the rack header.
- Host defaults to beginner on every page load. Header toggle enables full mode. Beginner hides B and every dual-chain routing control. `FxRack.activeB` gates B’s physical/tap input, output connection and mix contribution, independently of the saved `visible`/mute/routing configuration. Returning to full restores the previous layout without recreating B. UI mode is not serialized; restoring a two-chain state while beginner keeps B disconnected. Core rack defaults to full for existing API consumers; host explicitly selects beginner before creating the view.
- NAM GUI opens Amp settings when a model is loaded, with model name and Change model. Management UI is retained behind Change model; Back to amp settings returns to the compact view. Every reopening resets to amp (or Models if empty). Spectrum monitoring follows the active view. Other WAM GUIs unchanged.
- Validation: 145 Node tests passed, including B isolation, restore under beginner, split recovery, independent-input mute preservation. 13 desktop Chrome interaction checks and 14 checks against the rebuilt distribution at 390 px passed with no exceptions or horizontal page overflow. Desktop and narrow screenshots inspected. Static distribution rebuilt. No live TONE3000 authentication or physical audio listening tested in this change.
- Scope/spec: `SPECIFICATION_FX_CHAIN.md`, section Interface simplifiée. Presets 7.2 remains deferred.

## 2026-10-06 — TONE3000 accordion correction after screenshot

The screenshot showed the generic `.modelBrowser` asset-tree group “Downloaded on this device”, not only the separate `.tone3000Downloads` section. `buildAssetTree` automatically expands ancestors of the selected model on every render, which defeated the previous fix. NAM now overrides this specific group's open state in the TONE3000 source, resets it when presenting a new remote selection, and preserves explicit manual reopening through rerenders. Search can still expand matching results; Factory/Favorites behavior is unchanged. Validation: 143 Node tests and 13 browser checks with a mocked callback, seeded downloaded model and repeated browser renders; no browser exceptions. Distribution rebuilt.

## 2026-10-06 — Accordion, route-hover grace and TONE3000 return

- Backing player now has a full-width accordion heading. Collapsing hides transport, status and library/waveform controls; audio playback continues. This supersedes the previous compact transport layout.
- Chain A route buttons remain clickable for 700 ms after pointer/focus leaves their slot. Reentry cancels the timer; keyboard focus and touch visibility remain supported. Single-chain mode still hides routing actions.
- NAM's “Downloaded on this device” section is now a native details/summary accordion. A successful TONE3000 selection closes it and brings the selected-tone card into view; it remains manually reopenable. Error/cancel callbacks do not close it.
- Validation: 143 Node tests passed, static distribution rebuilt, 9 browser interaction checks passed without exceptions. TONE3000 callback was mocked; no authenticated live flow was exercised.


## 2026-10-05 — Backing track player (latest handoff)

- Implemented the approved `ADD_BACKING_TRACK_PLAYER.md`: reusable `<backing-track-player>`, independent engine/library and final guitar/backing mixer in `examples/wam/backing-track-player/`.
- 29 original MP3s copied unchanged into `examples/wam/assets/backingTracks/` (~170.5 MB compressed). Only selected media is fetched/decoded. Run `npm run backing-tracks` after additions/deletions, then `npm run dist`; `npm run backing-tracks -- --check` is read-only. Provenance hashes in the component's `SOURCE_MANIFEST.json`.
- Panel below rack: searchable library, waveform, local import/drop, play/pause/stop, A–B loops, 70–130% pitch-preserving speed, non-destructive normalization, volume/mute, global guitar pan, balance and mix meter. Compact mode keeps playback. CSS responds to component width, tested at 360 px.
- `BackingTrackMix` replaces the direct rack-to-destination connection. Accompaniment bypasses all guitar effects; the existing AudioContext/output-device selection serves both. Per-chain pans/gains stay independent. Guitar mix gain is unity when accompaniment is stopped/paused.
- Session state keeps the existing rack format plus optional `backingTrack`. Restore never autoplays or activates input. Missing local media asks for reselecting the same file; pending settings then restore by filename/size/mtime identity. Local media is not persisted or uploaded.
- Validation: **143 Node tests**, **60 real-audio browser checks** at 44.1/48 kHz plus **9 host UI/session checks**, no browser exceptions. Desktop/narrow UI inspected; distribution rebuilt. Reproducible page: `backing-track-player/validation.html`; numeric results in `VALIDATION.json`.
- Still manual: physical interface listening, musical stretching artifacts and CPU/latency profiling. Native A–B loops do not have a dedicated endpoint crossfade. Backend, multitrack, ML separation and rack preset phase 7.2 remain out of scope.
- Active branch remains **New-UI**. Prior implementation was committed/pushed as `be152ca`, merged/pushed to main as `7613551`, then New-UI reactivated. This backing-player work is uncommitted. Reference folders `examples/other_wam_host/` and `examples/WAP_amp_sims/` remain untouched and untracked.


## Current handoff — 2026-09-24

### Per-plugin meters, gains and Replace — latest update

- Every existing-size card now has 4 px input/output meters; the detailed editor has 5 px meters flanking the GUI. Input is measured after input trim, output after output gain; existing input-driven halos remain. Output analysers are disposed with their entries.
- Click each editor-side gain icon to reveal its −48…+12 dB slider and Reset (0 dB). Gains are smoothed, instance-local and saved as `inputDb` / `outputDb` in chain entries. Legacy entries restore unity. These are host wrapper controls, separate from plugin-internal preset state.
- Replace opens the existing catalogue over the editor and opens the new GUI immediately after success. It preserves slot ID, position, gains and split location. Loading is completed before retiring the old plugin; failed instantiation leaves the original intact. New plugin settings start from defaults.
- Latest validation: **137 Node tests passed**, static distribution rebuilt, **22 browser checks passed** for metering, measured gain, reset, replacement, split preservation and rack save/restore. Desktop editor screenshot inspected; physical-interface listening remains pending.
- Details: section 15 of `SPECIFICATION_FX_CHAIN.md`. Rack preset phase 7.2 is still on hold.

### Added WAM catalogue — preceding update

- `npm run wam-plugins` scans plugin root / `plugin/` / `src/` entry points and updates `plugins.json`, preserving manual metadata and external/core entries. Deleted internal entrypoints are removed; `-- --check` is read-only. Guide: `examples/wam/wamPlugins/HOW_TO_ADD_WAM_PLUGINS.md`.
- 17 additions, 31 catalogue entries / 30 active. VintageAmp60s remains disabled (`enabled: false`): its supplied WASM traps at 44.1/48 kHz even without a GUI. The 16 other additions passed import, GUI, state round trip and finite/non-silent audio checks in both source and relocated distribution; no browser errors in the active distribution test.
- Validation at this checkpoint: 135 Node tests passed; distribution rebuilt. Existing uncommitted user input folders remain untouched.


This section supersedes older milestone, Git, test-count and scope notes below. Earlier sections are retained as historical records; the host now supports editable two-chain routing, not just the original fixed NAM → Cabinet graph.

### Confirmed amplifier integration

- User confirmed the names **WAM•FAUST TubeLab** for EndUserAmp1 (gold/anthracite, 30 parameters) and **WAM•FAUST ShredLab** for EndUserAmp2 (petrol blue/copper, 47 parameters). These are no longer provisional names.
- Autonomous runtime copies live in `examples/wam/wamPlugins/EndUserAmp1/` and `examples/wam/wamPlugins/EndUserAmp2/`. Each includes descriptor-referenced GUI artwork, source hashes in `SOURCE_MANIFEST.json`, and browser measurements in `VALIDATION.json`. ShredLab also requires `ampProfiles.js`.
- The original files under `examples/other_wam_host/` remain unchanged. This untracked source tree is user-supplied input, not part of the extracted packages; do not add the whole tree when committing the integration. Adapting the other host is still a separate task.
- Both plugins model preamp, tone stack, power amp, cabinet and reverb. DSP binaries, parameter addresses and default DSP values are preserved. The “grey box” classification has not been verified from modeling/calibration sources.
- TubeLab retains its original WAM identifier; ShredLab uses `fr.grame.faust.ifc2026.amp2` to avoid the originals' duplicate identifier. Controls and GUI classes are isolated between variants and other WAMs.
- Both use the generic effect wrapper, not the NAM-specific API. Their internal cabinets do not trigger NAM metadata-based Cabinet AUTO. They can be inserted, removed and repeated in either rack chain.
- Runtime fixes include awaited initial state, lazy GUI loading, visibility-aware polling, safe detach/reattach, idempotent destruction and ParamMgr destruction acknowledgement before port closure. ShredLab no longer writes a default profile when opening its editor; explicit profile selection still works and restored DSP state drives the displayed profile.
- The `+` menu places amplifiers and cabinets/speakers side by side at the top, with effect pedals below. The laboratory also lists these categories first. WAM URI buttons copy each plugin's resolved entry URI.

### Validation and next checks

- Last implementation validation: **133 Node tests passed**, `npm run dist` succeeded, and **130 browser checks passed** (65 per amp at 44.1/48 kHz, including factory presets) against the relocated static distribution, with no browser errors.
- Reproduce browser checks with `examples/wam/fx-test/ifc-validation.html?variant=1` or `?variant=2`; the same page ships in `dist/NAM_A2_WAM/fx-test/`. Coverage includes real DSP signal processing, stereo input handling, independent instances, parameter/state restoration, bypass and GUI lifecycle. The Node integration test is `tests/phase4b/ifc-integration.test.mjs`.
- Rack checks covered both variants together, catalogue insertion, artwork/URI, editor reopening without state changes, ShredLab profiles, and B fed from a split after TubeLab in A. Narrow ShredLab layout was inspected at 360 px.
- Audio validation used muted Chromium without microphone capture. Live guitar listening, physical device switching and hardware latency/CPU checks remain pending. No deployment of the new integration is claimed.
- **Do not start rack preset phase 7.2.** ShredLab's internal model/profile controls are part of the plugin and are separate from rack preset management.
- Current specifications: [AMP_SIM_IFC2026_INTEGRATION.md](AMP_SIM_IFC2026_INTEGRATION.md) and [SPECIFICATION_FX_CHAIN.md](SPECIFICATION_FX_CHAIN.md).

### Internal factory presets — 2026-09-24 follow-up

- Both WAM editors now offer Default, Clean, Crunch, Disto / Hi gain, Jazzy and Jordan. Only `state.amp` was extracted from the corresponding original host; pedal states are excluded. ShredLab's seven missing Post EQ controls use DSP defaults, so all presets fully determine the sound.
- Portable package files: `factory-presets.js` and `preset-state.js`. Audio-node APIs: `getFactoryPresets()`, `loadFactoryPreset(id)`, `getFactoryPresetStatus()`.
- WAM state remains flat parameter values plus `__wamFactoryPreset: {version: 1, id}`. Restore exact saved controls, not the factory snapshot: edited presets retain their selection and “Modified” indication. Legacy parameter-only states still restore and display “Current settings”. No GUI is required for loading/restoration; opening an editor never applies a preset.
- Validation after this addition: 133 Node tests and 130 browser checks passed; static distribution rebuilt. Regression coverage is in `tests/phase4b/ifc-presets.test.mjs` and the extended browser validation page. This is plugin-local functionality explicitly requested by the user; rack preset phase 7.2 remains on hold.

### Git checkpoint

- Previous rack work was committed as `77163b8`, merged with updated main, and pushed to `origin/main` as `0a2feab` before the amplifier integration.
- Active branch: **New-UI**, returned to the merge result. The new amplifier integration, catalogue changes and latest documentation are currently uncommitted; they were not included in that earlier main push.

## 2026-09-22 — Serial FX chain (spec through 7.1)

- Main host now displays model/IR photo cards, insertion buttons and categorized bundled effects. `FxChain.js` owns serial routing, per-instance dry/wet bypass, insertion/removal, missing-plugin placeholders and versioned full-chain state. `FxChainView.js` owns reusable lazy editors and card state/artwork.
- NAM/Cabinet default assets load without GUI creation, supplied state takes precedence, and worklet registration is cached per AudioContext/module for multiple instances. GUI initialization hydrates node state rather than overwriting it from global preferences. Measured calibration history is now per NAM instance and serialized, keyed by model content and variant.
- Core nodes expose metadata snapshots; Cabinet routing mode is nonvisual and serialized. Host AUTO works before any editor exists. Shared source trim/device selection remain outside chain state.
- TONE3000 callback sessions have per-instance ownership and a nonvisual fallback. Cached editors retain selection/maintainer workflows. A real authenticated external callback still needs manual testing; mocked ownership/deduplication tests pass.
- Session & diagnostics save/restore now covers the full chain in memory. No factory/user preset UI or IndexedDB preset storage yet (section 7.2).
- Browser validation: `examples/wam/fx-test/chain-validation.html` (also in dist). Runs muted real DSP, headless defaults, repeated NAM/Cabinet and effect instances, distinct restored settings, all nine insert effects, reusable editors and first-open state invariance. No microphone is used.
- `skills-lock.json` remains unrelated and untracked. No commit/push requested for this implementation.
- Validation: 109 Node tests passed. The in-app browser completed the real-audio headless test for all nine insert effects, repeated-instance state restore and first-editor-open invariance. Main distribution startup and NAM modal were visually checked. Physical audio-interface switching and authenticated TONE3000 callbacks were not retested in this phase.

## 2026-09-22 — Cabinet Settings tab

- Cabinet routing/status, Level Match, IR Trim and Output Gain now live in a separate Settings tab. Main remains the default tab and retains the current IR artwork, metadata chips and active/bypassed indicator.
- Host Source trim is independent: it adjusts audio before NAM, defaults to 0 dB for live input and -18 dB for files, with separate in-session values. Cabinet IR Trim is a per-IR level adjustment instead.

## 2026-09-22 — Cabinet AUTO during default model loading

- Register the host NAM model listener before creating the NAM GUI, which autoloads the default factory capture. Previously this event was missed and AUTO used null metadata, leaving the Cabinet active for an amp+cab capture.
- `amp_cab`, `amp-cab` and `full-rig` already qualify for automatic Cabinet bypass. Manual ON remains an explicit override.
- Regression tests cover startup GUI autoload and switching back to an amp-only capture.

Updated: 2026-09-04

## Current milestone

Phase 4b.2 — GUI/UX Redesign for Host + NAM + Cabinet WAMs is implemented and validated locally.

Phases 1 through 4b.1 remain in place. Phase 4b.2 changed presentation and host/GUI coordination only; the NAM and Cabinet DSP architectures, audio graph, gain semantics, model loading, IR processing, Level Match, and Cabinet AUTO policy were not redesigned.

The generated deployment artifact is:

`dist/NAM_A2_WAM/`

The next session should start by reviewing or deploying this artifact, not by reconstructing the Phase 4b.2 work.

## Phase 4b.2 implementation

### Host

- `examples/wam/index.html` now uses an EndUserAmp2-inspired application shell: fixed/sticky dark sidebar and a dark rack workspace.
- `examples/wam/host.css` owns all host layout and responsive styling.
- Host-owned controls remain in the sidebar: source/device selection, source trim, player, output device, save/restore, and diagnostics.
- NAM and Cabinet plugin controls are not duplicated in the host.
- The desktop rack presents NAM and Cabinet side by side; the modules stack at narrower widths.
- The signal-chain map remains Input -> NAM -> Cabinet -> Output.
- `examples/wam/main.js` still connects `sourceTrim -> NAM -> Cabinet -> destination`.

### NAM WAM GUI

- `src/nam-wam/gui.js` is now a compact, container-friendly rack module.
- It shows the current model, source, A2 subtype/mode metadata, narrow input/output meters, exact input/output gain values, and bypass.
- Model sources are Factory, Favorites, External, and TONE3000.
- Model browser and model details are native collapsible drawers, closed by default.
- Browser results scroll inside the module instead of expanding the page indefinitely.
- External `.nam` loading and Factory selection use the existing model-loading path.
- TONE3000 Select Flow and its callback relay architecture are preserved.
- The important Phase 4b.1 callback fix remains: the relayed callback URL is passed to `completeAuthorization(location)`.
- The first URL returned in the TONE3000 `tone.images` metadata is displayed in the selected-tone panel and in the current-model block after loading.
- The normalized image URL is stored in model provenance, so save/restore can redisplay it without another TONE3000 metadata request; missing or failed images fall back to the text-only layout.
- Clicking the TONE3000 source tab now checks for an in-memory OAuth access token. Without one, it shows a TONE3000 partnership/authentication splash with the official local full logo and a Continue button; the existing Select Flow starts only after Continue.

### Cabinet WAM GUI

- `src/cabinet-wam/gui.js` is now a matching compact rack module.
- It shows the current IR, source, sample rate/details, Level Match, compensation, per-IR Trim, output gain, and bypass.
- AUTO / ON / BYPASS routing is visible in the Cabinet module, while the host remains responsible for applying the policy.
- Routing status explicitly reports whether Cabinet is active or bypassed and why.
- Factory/External IR browser and details are collapsible and closed by default.
- External `.wav` data is retained safely for in-session reload/state behavior.

### Host/plugin coordination

- `examples/wam/main.js` listens for the cancelable `cabinet-routing-mode` event and applies the existing host-owned AUTO/ON/BYPASS policy.
- Cabinet receives a display-only routing status through `setRoutingStatus()`.
- AUTO still detects full-rig captures from trusted NAM metadata and constrained fallback labels.
- Host duplicate NAM gain/bypass controls and the old host Cabinet mode selector were removed.

## Responsive and accessibility behavior

- Desktop: sidebar plus two-column rack.
- Medium widths: NAM and Cabinet stack in the rack while the sidebar remains available.
- Small widths: sidebar becomes the top section and the rack follows without horizontal clipping.
- Plugin styles are scoped to their custom elements; there are no plugin-level `body`, `position: fixed`, or `100vw` assumptions.
- Interactive controls have labels, visible focus treatment, button semantics, and `aria-pressed` source tabs.
- Escape closes open model/IR drawers.

## Files modified

- `examples/wam/index.html`
- `examples/wam/config.js`
- `examples/wam/main.js`
- `src/nam-wam/gui.js`
- `src/nam-wam/NamNode.js`
- `src/nam-wam/models-manifest.json`
- `src/nam-wam/tone3000/Tone3000Auth.js`
- `src/nam-wam/tone3000/Tone3000Client.js`
- `src/cabinet-wam/gui.js`
- `src/cabinet-wam/irs-manifest.json`
- `src/shared/assetBrowser.js`
- `tools/generate-factory-manifests.mjs`
- `tools/build-static-dist.mjs`
- `tests/phase4a3/distribution.test.mjs`
- `tests/phase4a2/manifest.test.mjs`
- `tests/phase4b/tone3000.test.mjs`
- `README.md`
- `HANDOFF.md`

## Files created

- `examples/wam/host.css`
- `src/nam-wam/tone3000/Tone3000Downloads.js`
- `src/nam-wam/tone3000/FactoryBundle.js`
- `docs/FACTORY_LIBRARY.md`
- `tests/phase4b/gui-redesign.test.mjs`

The generated files under `dist/NAM_A2_WAM/` were rebuilt from these sources.

## Automated validation

- `node --check` passes for the modified JavaScript modules and the new GUI contract test.
- `npm run dist` succeeds.
- Distribution contains 63 NAM models and 43 Cabinet IRs.
- `npm test` passes 60/60 tests.
- The distribution contract now requires `host.css`.
- Phase 4b GUI contract tests check host ownership, scoped plugin CSS, drawers, source tabs, AUTO controls, TONE3000 callback forwarding, and forbidden viewport/global CSS assumptions.

## Browser validation completed

Source host tested at:

`http://127.0.0.1:8765/examples/wam/index.html?phase4b2=1`

Static distribution tested at:

`http://127.0.0.1:8765/dist/NAM_A2_WAM/?phase4b2=1`

Validated manually:

- no console errors or warnings on startup;
- desktop, 900 px, and 640 px responsive layouts;
- Factory NAM and Factory IR loading;
- Factory, External, and TONE3000 source panels;
- supported External NAM loading;
- External WAV IR loading and displayed sample details;
- file-source selection and enabled player;
- Cabinet manual ON and BYPASS;
- Cabinet AUTO active for amp-only NAM metadata;
- Cabinet AUTO bypassed for full-rig NAM metadata;
- save/change/restore returned to the saved model and IR in the static build.

## TONE3000 status

Follow-up implementation on 2026-09-02: the browser host now follows the two-stage architecture used by the official TONE3000 plugin. The first authentication action uses a no-prompt OAuth/PKCE login and returns to the WAM page; after authentication, the TONE3000 source panel exposes an in-plugin catalog with Trending, Latest, Downloaded, Favorites, and Created streams, gear filters, cards, and pagination. Selecting a card resolves the tone metadata and compatible NAM A2 models in the existing model-selection panel. The Browse TONE3000 button continues to use the official `prompt=select_tone` flow for the full external catalog.

The example host configuration is now in `examples/wam/config.js`. Its public client ID is shared by the local and Mainline deployments, while `redirectUri` is derived from the page URL at runtime. Consequently, `examples/wam/index.html` does not need environment-specific edits; the generated static distribution contains the same `config.js` mechanism.

`Tone3000Client` now persists the browser access/refresh token in local storage, provides the catalog stream methods, and keeps the Window-bound fetch behavior. Model downloads remain JavaScript-side in this WAM host because there is no JUCE/native token bridge; the official plugin instead passes the token to native C++ and downloads/caches the model off the audio thread. The WAM still keeps all network and DOM work outside audio processing.

The example host now explicitly requests a 48 kHz `AudioContext`, matching the sample rate of the
bundled and TONE3000 NAM A2 models. If the browser returns another rate, the host reports it in
the status area because the NAM core rejects mismatched models.

OAuth callback follow-up on 2026-09-03: a same-tab Select Flow return now explicitly restores the
TONE3000 source tab, opens the model drawer, and automatically loads the first compatible A2 model.
Previously the callback metadata was resolved after reload while the GUI remained on the closed
Factory view, making the successful callback appear inert.

Audio-session follow-up on 2026-09-03: login and Select Flow now open in a named popup and relay the
callback through same-origin storage/BroadcastChannel messaging. This keeps the main host page,
AudioContext, live-input stream, and selected input/output devices alive while TONE3000 is open.
Same-tab callback handling remains as a fallback for embedded browsers that collapse popups.

TONE3000 AUTO-routing follow-up on 2026-09-03: selected-tone provenance now retains the canonical
API `gear` value. Cabinet AUTO treats `amp-cab` (and deprecated `full-rig`) as including a speaker
capture and bypasses the external Cabinet, while `amp` keeps Cabinet active. This provenance is
also serialized with WAM state, so routing remains correct after state restoration.

Cabinet default/status follow-up on 2026-09-03: a fresh session automatically loads the Factory IR
`tone3000/outmodedelectronics/Celestion Vintage 30 - 2002 Mesa Boogie 4x12 - SM57--t45023/captures/V30 LL 4FB 4x12 SM57 0.50in 0--m239290.wav`; restored sessions retain their saved IR instead. The Current IR panel,
activity badge, and routing-status message are green when convolution is active and red when the
loaded IR is bypassed.

The Phase 4b.1 integration and callback fix are preserved. Phase 4b.2 verified that the TONE3000 source panel, button, status, and callback contract are present without introducing startup requests.

### Local TONE3000 downloads and Factory metadata — 2026-09-03

- Models downloaded after an explicit user selection are now stored in the browser's IndexedDB by `src/nam-wam/tone3000/Tone3000Downloads.js`.
- Only the selected NAM file and its attribution metadata are stored. Catalog feeds and expiring download URLs are not cached, in accordance with the TONE3000 API terms.
- The TONE3000 panel has a persistent "Downloaded on this device" section available even while signed out. Each entry can be loaded or deleted, and a guarded "Delete all" action clears every local TONE3000 download.
- Deleting a download removes its persistent copy. If it is the model currently running in the AudioWorklet, that in-memory model remains active until another model is loaded.
- IndexedDB storage is browser-profile and origin scoped. Localhost and `https://mainline.i3s.unice.fr` therefore have separate download libraries.
- Stored records preserve tone/model identity, filename, model data, title, creator, gear, format, license, image URL, and download date. The app does not store the temporary `model_url`.
- The Factory manifest now preserves gain, loudness, input/output dBu, trainer, and capture date in addition to gear/type/creator metadata.
- Factory browsing now uses metadata-rich cards, and the current-model/details panels show the same available attribution and capture information.
- Factory `.nam` files contain no reliable image URL or TONE3000 tone ID. Manifest generation therefore supports local sidecar images named after the `.nam` file (`.jpg`, `.jpeg`, `.png`, `.webp`) or `cover.*` in its folder. When none exists, the GUI displays an explicitly generated metadata tile rather than guessing a remote image.
- `NamNode` now respects `provenance.source`, allowing Factory provenance to carry artwork/metadata without being mislabeled as TONE3000. Cabinet AUTO reasons also report the correct provenance source.
- Browser validation loaded `A1vsA2-JVM-OD1-OR-A2.nam` and confirmed Factory source, A2 subtype, 48 kHz sample rate, creator, gear type, trainer, date, and input/output levels.
- `npm run dist` rebuilt `dist/NAM_A2_WAM/`; the distribution includes the IndexedDB module and regenerated 58-model Factory manifest.
- Factory browser follow-up: after selecting a model inside a nested folder, every ancestor accordion on the selected path remains open and the selected card stays highlighted. This avoids reopening the same folder to audition adjacent captures.
- Factory cards now display the original filename as a separate monospace line because filenames often encode channel, gain, EQ, microphone, and cabinet settings.
- `docs/FACTORY_LIBRARY.md` defines the implemented rich bundle format for NAM and IR collections (`tone.json`, local cover image, stable tone/model IDs, creator/license metadata, and hashes).
- Opening the host with `?maintainer=1` reveals a Factory maintainer panel in the TONE3000 tab. It can launch an explicit NAM A2 or IR Select Flow, list the files in the selected tone, download only checked files, retain the first tone image, generate hashes and `tone.json`, and export a repository-ready ZIP without temporary model URLs or OAuth tokens.
- `tools/generate-factory-manifests.mjs` now reads the nearest `tone.json` for both `.nam` and `.wav`, validates its schema, file membership and SHA-256 hashes, rejects duplicate provider identities, and merges provenance/artwork into manifest version 2. Existing loose Factory files remain compatible.
- Factory NAM and Cabinet IR cards consume the richer manifest fields and show filenames, tone title, creator, license, image, and technical metadata when available.
- Rich TONE3000 Factory bundles keep their collision-safe `tone3000/creator/tone/captures` layout on disk, while the GUI renders one compact card per tone: one image/title/attribution header plus a scrollable list of capture filenames. There is no surrounding tone accordion. Legacy loose assets retain their physical folder grouping.
- Factory asset URLs now percent-encode every path segment before fetching models, IRs, or cover images. This fixes TONE3000 filenames containing URL-reserved characters such as `#` or `?`; previously `BLEND #1` was interpreted as a URL fragment and the request path was truncated. Traversal and empty path segments are rejected. All 184 current TONE3000 Factory NAM files were independently parsed and loaded by the WASM engine, and a real `BLEND #1` capture was then loaded successfully through the browser GUI.
- NAM Factory manifests now assign every capture a `guitar`, `bass`, or `pedal` category. An explicit `tone.category` in rich bundles has priority, followed by TONE3000 bass tags, pedal gear metadata, strict pedal filename prefixes, and the legacy exact `Bass` directory; otherwise captures default to guitar. The maintainer exporter writes a derived category into new NAM bundles, and `docs/FACTORY_LIBRARY.md` documents manual correction for ambiguous sets. The Factory GUI provides counted `All`, `Guitar`, `Bass`, and `Pedals` pills. Current generated counts are 242 total: 219 guitar, 23 bass, and 0 dedicated pedal captures. Browser validation confirmed that `Bass 23` shows the Ampeg and Hartke collections and excludes guitar packs.
- The maintainer workflow does not bypass TONE3000 restrictions: whole-tone API ZIPs remain partner-only, and any exported content must be checked for redistribution permission before it is committed or deployed.

### A2 rendering preference and cross-source favorites — 2026-09-04

- A `SlimmableContainer` previously rendered its last submodel by Core default, which is A2 Full. The old `A2 Lite + Full` label described file contents and did not mean both networks were evaluated.
- The WASM wrapper now exports `nam_set_slimmable_size`. The AudioWorklet can switch the current container between Full (`1.0`) and Lite (`0.0`) without re-downloading or reparsing the model.
- Preferences exposes Full (default/higher fidelity) and Lite (lower CPU). The choice persists per origin in local storage, is included in WAM state version 2, and the current-model badge/details report the network actually active.
- The NAM source tabs now include Favorites. Stars can add or remove individual Factory, External, or downloaded TONE3000 model captures.
- Favorites are stored per origin in a dedicated IndexedDB database. Complete data is retained for External and TONE3000 favorites, so they remain loadable after a browser restart; Factory favorites retain their stable manifest identity.
- Browser validation confirmed Full loading, live switching to Lite, favorite add/remove, and persistence across reload. The temporary validation favorite and Lite preference were removed/reset afterward.

### Automatic NAM model level — 2026-09-04

- NAM capture loudness metadata now drives an independent output compensation stage after model inference. The target is −18 dB and correction is clamped to ±12 dB to avoid unsafe boosts from unusual or corrupt metadata.
- Automatic model level is enabled by default, persists per browser origin, is included in WAM state, and can be disabled under Preferences without changing the user's manual Output gain.
- Gain transitions are smoothed sample by sample in the AudioWorklet, including preference changes, to avoid abrupt discontinuities. Loading a new model initializes its correction immediately before audio resumes.
- Model details report both the capture loudness and the applied correction. Missing or non-finite loudness values result in 0 dB compensation.
- Browser validation measured the intended metadata-derived corrections: Fender Super Reverb SM57 (`-23.4 dB`) receives `+5.4 dB`; Full Rig Peavey 5150 Maxon Mesa OS SM57 (`-15.7 dB`) receives `-2.3 dB`. Disabling the preference displayed `Auto level: off`, and it was restored afterward.
- `tests/phase4a/model-level.test.mjs` covers representative Fender/Peavey values, disabled mode, invalid metadata, and the ±12 dB bounds.
- Follow-up: the current-model card now carries a permanent green `LEVEL ±x.x dB` badge with a tooltip containing model loudness, target, and applied NAM correction. Disabled or unavailable correction is displayed in red as `LEVEL OFF` or `LEVEL N/A`.
- A missing loudness value previously became numeric zero through JavaScript's `Number(null)`, accidentally requesting the maximum `-12 dB` attenuation. Missing/non-numeric metadata is now strictly treated as unavailable and applies `0 dB`.
- `SlimmableContainer` models now read loudness from the active Full/Lite submodel first, falling back to container metadata. Switching Full/Lite also recalculates and applies the matching correction.
- Loudness-metadata limitation confirmed with a native controlled render: the same 997 Hz, 0.15-peak reference produced `-28.13 dBFS RMS` through `Fender Super Reverb_ EQ Flat, Volume 3, sm57 and AKG 414.nam` but `-18.14 dBFS RMS` through the Peavey 5150 Maxon SM57 capture. Their metadata reports `-20.25 dB` and `-15.66 dB`; after metadata normalization to `-18 dB`, the measured outputs would still differ by about `5.4 dB`.
- The official `tone-3000/tone3000-plugin` implementation was checked at `plugin/src/Processor.cpp`: it also applies `targetLoudness - modelLoudness`, clamped to ±12 dB, with a default target of `-18 dB`. The current WAM behavior therefore matches the official algorithm; remaining perceptual/output mismatch comes from trainer-defined loudness metadata and source-dependent model response.
- The recommended non-pumping calibration is now implemented as an optional **Calibrate level** button. It renders a private 997 Hz reference at 0.15 peak through the active model, discards a 4096-frame warmup, measures the following 16384 frames, derives a static correction toward `-18 dBFS RMS`, clamps it to ±12 dB, and also limits predicted peak to `-1 dBFS`.
- Calibration runs only on explicit user action. The probe is not copied to the WAM output, NAM is reset both before and after measurement, and no adaptive gain runs during normal playing. **Use metadata** restores the default metadata-derived correction.
- The badge reports `MEASURED ±x.x dB`; Model details includes measured probe RMS and whether safety limiting occurred. The measured calibration is carried in WAM state version 3 for state restoration.
- Measurements are also stored per stable model identity and Full/Lite variant in origin-scoped local storage. Selecting the same capture restores its measured static gain; **Use metadata** deletes that stored measurement. Browser validation confirmed restoration after a full page reload, then removed the temporary validation entry.
- Browser validation produced `MEASURED +10.1 dB` from `-28.1 dBFS` for the problematic Fender capture, versus `MEASURED +0.1 dB` from `-18.1 dBFS` for the Peavey Maxon SM57 capture. Returning to metadata restored the Peavey `LEVEL -2.3 dB` state.
- Unit/contract coverage includes measured correction limits, peak protection, explicit calibration routing, model reset, and GUI controls. The full suite passes 60/60 tests.

### Official-style NAM tone controls — 2026-09-04

- NAM Input Gain and Output Gain are now rotary controls. Every rotary control keeps a native range input for keyboard/accessibility support; double-click restores its declared default (0 dB for both gain knobs).
- Added the official plugin's input Noise Gate, with threshold `-100..0 dB` (default `-80 dB`), detector sidechain HP/LP filtering, fast attack, 25 ms detector decay, 5 dB hysteresis, 50 ms hold, 100 ms gain release, and cubic downward expansion to a `-80 dB` floor.
- Added the global post-NAM Bass/Middle/Treble stack with official mappings: low shelf 150 Hz at ±20 dB, bell 425 Hz at ±15 dB, and high shelf 1.8 kHz at ±10 dB. Knob value 5 is flat.
- Added a hidden-by-default six-band parametric EQ drawer. The EQ itself defaults disabled and POST NAM; users can select PRE NAM. Defaults mirror `BlockEq`: low shelf 100 Hz, bells at 250/650/1600/3500 Hz, high shelf 8 kHz, each with frequency, ±15 dB gain, and Q controls.
- Exact WAM routing is `Input Gain -> Noise Gate -> optional PRE EQ -> NAM -> model-level normalization -> optional POST EQ -> Tone Stack -> Output Gain`. Whole-plugin bypass remains a coherent dry bypass.
- NAM and Cabinet faceplates now receive a prominent red-tinted state when bypassed, in addition to their existing checkboxes/status text.
- Headless browser validation initially confirmed the rotary controls, EQ reveal behavior, Input Gain double-click reset to 0 dB, WAM parameter synchronization, and the NAM bypass faceplate class. DSP and contract tests cover gate attenuation, tone/EQ shaping, routing, GUI controls, and Cabinet bypass styling.

### Vertical knobs and graphical EQ — 2026-09-04

- The six faceplate knobs now own pointer gestures instead of using the browser's horizontal range behavior. Vertical upward drag increases the value, downward drag decreases it, horizontal-only movement leaves it unchanged, Shift gives 8x finer control, keyboard range behavior remains available, and double-click still restores the declared default.
- The 18 EQ knobs were replaced by one interactive logarithmic SVG response graph with six draggable band nodes. Horizontal movement changes frequency, vertical movement changes gain, the wheel changes Q, Shift enables fine movement, and double-click neutralizes the selected band's gain.
- The selected band exposes exact numeric Frequency, Gain, and Q fields. The six bands remain ordered in frequency while dragging, and Reset EQ restores all official defaults.
- The plotted combined response uses the same RBJ coefficient and magnitude-response equations as the official `eqMath.ts`/`BlockEq.cpp`, at the active AudioContext sample rate. It therefore visualizes the actual EQ transfer function rather than a decorative approximation.
- EQ updates are batched into one WAM parameter call per gesture event and complete parameter synchronizations redraw the graph only once, avoiding redundant UI-thread response calculations during a drag.
- Chrome validation confirmed six knobs and six EQ nodes, zero change after a 100 px horizontal-only knob drag, Input Gain change from 0 to +18 dB after a 45 px upward drag, synchronized WAM values, graphical band movement from 250 Hz/0 dB to approximately 499 Hz/+3.6 dB, updated numeric readout, and a changed response path.
- The full suite passes 63/63 tests after the interaction redesign.

### TONE3000 C++/WAM DSP parity measurement — 2026-09-04

- A native reference executable was built against the official `tone-3000/tone3000-plugin` commit `1572f20a9a9a0a22e902aade9292a7e86c98b7e1` and its declared JUCE 9.0.1 revision `e18f7f506c0b96f2c738a0bcd7fe6467a5005ad8`.
- The reference compiled `BlockEq.cpp` and `NoiseGate.h` directly from the official repository. The tone-stack reference instantiated JUCE's actual `makeLowShelf`, `makePeakFilter`, and `makeHighShelf` filters using the exact code and order from `Processor.cpp`.
- Each comparison processed 96,000 identical 32-bit input samples at 48 kHz. The tone test used deliberately non-neutral `Bass 8.3 / Middle 2.1 / Treble 7.4`; all six parametric-EQ bands used non-zero, mixed boost/cut settings; the gate input crossed a `-38 dB` threshold repeatedly to exercise open, hold, and release behavior.
- Tone stack: correlation `0.9999996746`, output-level difference `+0.00345 dB`, peak difference `+0.00318 dB`, RMS null/error `-74.87 dBFS`, and error-to-signal SNR `60.92 dB`.
- Six-band EQ: correlation `0.9999999590`, output-level difference `-0.00101 dB`, peak difference `-0.00086 dB`, RMS null/error `-91.66 dBFS`, and error-to-signal SNR `70.20 dB`.
- Noise gate: correlation `0.99999999999994`, output-level difference `+0.0000026 dB`, peak difference `+0.0000027 dB`, RMS null/error `-155.89 dBFS`, and error-to-signal SNR `129.27 dB`.
- Conclusion: the gate is effectively numerically identical. EQ and tone-stack level/peak differences are a few thousandths of a dB or less; their residual null is consistent with C++ `float` filter coefficients/state versus JavaScript `double` arithmetic and is not a material tonal discrepancy. No DSP correction was warranted from this test.

Follow-up completed on 2026-08-31: selected TONE3000 tone images are now supported through the documented `Tone.images` array. Both image placements are present in the rebuilt static distribution and remain hidden until a valid image URL is available.

New-UI branch follow-up on 2026-09-14:

- The NAM `Models & sources` drawer opens by default on Factory with the Guitar category selected. Other categories remain available.
- TONE3000 no longer requires a separate `Load selected model` button: choosing a tone loads its first compatible A2 capture, and changing the model selector loads the newly chosen capture. Downloaded models load when their row is selected; Delete remains a separate control.
- Multi-capture Factory groups, including legacy folders, now use one image/metadata card. The capture filename is shown beneath the image, with previous/next arrows that load the adjacent capture; arrows are disabled at the first and last entries. The artwork itself loads the currently shown capture, and the star toggles its favorite state.
- The Factory card now places a larger, uncropped image and its arrows on the left, with a separately scrollable, clickable filename list and tone metadata on the right. Clicking a filename loads that capture immediately, highlights it, and synchronizes the arrows, counter, filename, and favorite star. The browser preserves its scroll position when a capture loads.
- The top Current model panel uses a larger, contained photo on the left, with the full model title, source/mode/level badges, and calibration controls to the right. This keeps long filenames readable and avoids cropping the artwork.
- The Current model photo and details share one top row with the IN and OUT meters at the edges. The Noise gate controls sit immediately left of the photo; `noiseEnabled` starts off for new instances and remains a standard WAM parameter restored from saved state.
- The small Noise gate threshold knob sits above its checkbox to the left of the photo and dims/disables when the gate is off. Matching small input/output gain knobs now sit directly below their respective IN/OUT meters; the accordion holds Bass, Middle, Treble, Tone and EQ. New instances start with EQ enabled (`eqEnabled=1`), while saved WAM state still overrides the default. When EQ is bypassed its signal-flow stage, button, and graph visibly indicate the bypass.
- Factory and the selected TONE3000 tone now share the two-column capture card: title/metadata above the uncropped image with adjacent previous/next arrows, and a separately scrollable `Captures disponibles` button list on the right. The TONE3000 list replaces the old dropdown; selecting an entry loads it immediately and keeps arrows, counter, and loaded highlight synchronized.
- The main photo/meter frame adds a smoothed green-to-amber-to-red neon border driven by the output RMS/peak meter callback. It decays to the idle border at silence and never adds audio-processing work to the AudioWorklet.
- The selected TONE3000 detail view now offers `Back to TONE3000 main view` beside Browse. Returning keeps the existing catalog cards, feed, filter and page without refetching. Both Factory and TONE3000 capture-list headers show the actual singular/plural count (`1 capture disponible`, `N captures disponibles`).
- `docs/screenshots/ImageNAM_A2_WAM.jpeg` is copied into `src/nam-wam/` and referenced as the plugin descriptor `thumbnail`. The static distribution includes an identical copy.

Graphical-EQ/spectrum follow-up completed on 2026-09-04:

- The NAM GUI now uses a compact top-level tab bar instead of stacking four accordions. `Main` is selected by default and contains the signal-flow strip, meters, gain/noise controls, current-model artwork, and status. The other tabs are `Models`, `Amp settings`, `Model details`, and `Preferences`; only the selected panel occupies vertical space. Left/right arrows plus Home/End provide keyboard tab navigation.
- A sixth `Help` tab explains NeuralWAMp's AudioWorklet/WAM architecture, signal path, each functional tab, vertical-drag/double-click knob gestures, hover metadata cards, WAM state, browser-local favorites/downloads, and the separate Cabinet WAM. It starts with a six-step **Getting started with your guitar** guide covering Live input, input/output device selection and browser fallback, enabling live audio, Factory/TONE3000 capture loading and persistence, Amp settings, and the optional high-gain noise gate, and links to the public GitHub repository. Its compact two-column cards become one column on narrow layouts and the content scrolls within the panel.
- The module header and signal-flow row were compacted further: the header uses 7 px vertical padding with a 78 × 25 px logo and smaller identity/bypass typography, while the processing-chain pills use 4 px row padding, 7 px labels, smaller dots, arrows, and gaps.
- In the default `Main` tab, the compact signal-flow row is placed below the complete current-model/meter frame rather than above it, giving the processing order a continuous full-width reading line.
- Model artwork now exposes a delayed rich tooltip after one second of hover. The shared tooltip covers the current model, Factory cards, TONE3000 catalog/selection/download images, and follows the capture selected with card arrows. It presents the available filename, architecture/rendering modes, sample rate, creator, NAM format/loudness, source, gear/capture/tone metadata, date, license/provider, and Tone ID; it disappears on pointer exit or tab changes.
- Opening a TONE3000 popup or completing its callback automatically selects the `Models` tab. The real-time spectrum analyzer is enabled only while `Amp settings` is the active tab and is disabled when another tab is selected.

- The NAM plugin's user-facing name is now `NeuralWAMp` (descriptor, GUI heading, and TONE3000 partnership copy). Its stable WAM identifier remains `org.webaudiomodules.nam-a2` for compatibility.
- The temporary square `N` badge in the module header has been replaced by the native `neuralwamp-logo.svg` lockup: a neural audio waveform and nodes paired with an emphasized `WAM` monogram. The same paths are embedded inline in the GUI, avoiding broken-image behavior caused by strict MIME/CSP handling while retaining the standalone asset for reuse. The SVG remains sharp at any display density, has an accessible label, and shifts toward the bypass color treatment when the WAM is disabled. The development server also serves SVG and model artwork with explicit image MIME types.
- The header uses three equal edge columns around a flexible center: the logo occupies the left 94 px, Bypass the right 94 px, and the identity block is centered independently between them. Its lines are ordered `NeuralWAMp`, `NAM A2 neural amplifier`, then `by @micbuffa`.
- The module heading now credits `by @micbuffa` with a link to the author's GitHub profile. A compact, accessible signal-flow strip sits directly below the heading and reflects the active DSP order. PRE shows `Input -> Gate -> EQ PRE -> Amp sim NAM -> Tone stack -> Output`; POST moves `EQ POST` after the amp. Gate, EQ, and tone-stack pills visibly dim and strike through when their corresponding stages are disabled. The strip fits the normal 509 px module width and remains horizontally scrollable on narrower containers.
- The six filter responses now have stable per-band colors; the selected response is emphasized while the exact combined transfer curve remains white.
- The graph now compares three real spectra: a dashed blue-gray `Input` trace at the EQ insertion point, an orange `Filtered` trace immediately after the EQ, and a green `Final output` trace after NAM, EQ, tone stack, and output gain. In PRE mode the first two are captured before NAM inference; in POST mode they are captured after NAM inference. The third trace makes Bass/Middle/Treble changes visible while preserving a direct input-versus-EQ comparison. All three use a 2048-point Hann-windowed FFT, 64 logarithmic bins from 20 Hz to 20 kHz, a `-100..0 dBFS` range, and fast-attack/slow-release smoothing.
- FFT storage, the Hann window, bit reversal, and twiddle tables are allocated/precomputed in the AudioWorklet constructor. Analysis runs at about 30 Hz only while the `Amp settings` tab is visible, and it does not add another `AudioWorkletNode`.
- The left vertical labels show EQ gain in dB; the right labels show analyzer level in dBFS. The selected-band readout and accessible label explicitly identify `Low shelf`, `Bell`, or `High shelf`.
- Gate, EQ, and tone-stack processing now remain active when no NAM capture is loaded. Previously, the no-model pass-through branch bypassed all tone shaping, which made a correctly enabled EQ inaudible and left its spectrum unchanged.
- PRE and POST routing are now explicit in the processing loop and covered independently. PRE filters the gate output before it is copied to the NAM WASM input; POST filters the normalized NAM output. Browser validation with a real Factory Peavey 5150 capture confirmed that the two PRE spectra diverge under a +12 dB bell boost and reported no console errors.
- The host sidebar now keeps the audio player completely hidden while `Live input` is selected and reveals it immediately below the Source selector only for a discovered audio-file source. Input and output device selectors are adjacent, with Output directly below Input; the separate Player and Output cards were removed. The former `Automated validation output` drawer is labelled `Automated test results` and explains that its JSON diagnostic report is produced only by the `?auto=1` validation run.
- Live-input selection follow-up on 2026-09-16: **Enable live input** no longer opens a preliminary unconstrained `getUserMedia()` stream on the operating-system default microphone when a concrete input is already selected. The chosen device is requested directly with `deviceId: {exact: ...}`; concurrent device changes are serialized so a late default-microphone permission response cannot replace a newer Scarlett/USB request. The returned track settings are checked against the requested physical device, and the host status reports the label of the track Chrome actually opened.
- Multichannel-interface follow-up on 2026-09-16: live capture no longer relies on Web Audio's implicit multichannel-to-mono downmix. A `ChannelSplitterNode` routes exactly one chosen interface channel into the mono WAM chain, with physical Input 1 selected by default and an Input channel selector shown when Chrome reports multiple channels. This prevents Scarlett 2i2 4th Gen loopback channels 3–4 from being mixed back into the processed output and creating a digital feedback loop.
- Live monitoring is now an explicit two-state control: green **Enable live input** starts the selected device/channel, while red **Disable live input** disconnects the source node and stops all `MediaStreamTrack`s. Merely changing an input device/channel no longer opens monitoring while the control is disabled, and switching back from file playback leaves live monitoring off until the user enables it.
- Feedback investigation note (2026-09-16): USB id `1235:8210` identifies a Scarlett 2i2 3rd Gen, which does not expose Focusrite loopback channels, so loopback is not the explanation for that report. A 10-second zero-input render of the default Bogner Uberschall capture remained at a tiny constant model bias (about `-82.9 dBFS`, peak `0.0000715`) rather than self-oscillating. The next physical test should compare the NAM input meter with the guitar volume at zero and then press **Disable live input**: if the tone stops immediately, it is present in the captured interface signal/acoustic setup; if input is silent while output remains loud, investigate the live browser graph further.
- The six NeuralWAMp top-level tabs now keep their natural button widths and distribute the remaining space evenly with flex `space-between`. This makes the visible edge-to-edge gaps between `Main`, `Models`, `Amp settings`, `Model details`, `Preferences`, and `Help` regular and avoids an oversized active background around short labels. Below 620 px, the bar switches to left-aligned horizontal scrolling.
- `NamNode` state is now version 4. All 29 WAM parameters (gain, bypass, gate threshold/enabled, bass/middle/treble/tone enabled, EQ enabled/PRE-POST, and frequency/gain/Q for all six bands) continue through the SDK's standard `parameterValues` state round trip. The host's `?auto=1` validation now changes every one of these values before restoring the saved state and checks them all.
- Automated coverage includes spectrum enable/disable behavior, 1 kHz FFT-bin detection across all three traces, comparative input/filtered spectra, visible spectrum change after a +12 dB band boost, final-output response to tone-stack changes, independent audible PRE routing, audible EQ with no NAM loaded, full parameter registration/state wiring, and GUI contracts. The complete suite passes 72/72.

Image rendering follow-up: TONE3000 images use `object-fit: contain` and intrinsic dimensions (preview capped at 320 px high), so the complete source image is visible instead of being cropped into a 160 px `cover` banner.

Cross-browser OAuth/API follow-up on 2026-09-01: `Tone3000Client` now binds the native browser `fetch` function to `window`. This fixes `Can only call Window.fetch on instances of Window` on strict WebKit/Safari-style implementations after a remote user completes Select Flow. A behavioral regression test verifies the Window receiver; the full suite now passes 43/43 and `dist/NAM_A2_WAM/` was rebuilt.

Deployed-image follow-up on 2026-09-01: the VPS sends `Cross-Origin-Embedder-Policy: require-corp`, while TONE3000 image storage sends `Access-Control-Allow-Origin: *` but no `Cross-Origin-Resource-Policy`. Images therefore worked on localhost but were blocked in the deployed page when requested in no-CORS image mode. Both TONE3000 `<img>` elements now use `crossorigin="anonymous"`, selecting CORS mode and making them compatible with the existing COEP header. Contract tests cover the attribute; the suite passes 43/43 and the static distribution was rebuilt.

Design-guideline follow-up on 2026-09-01: the TONE3000 source tab now presents the required partnership splash before authentication, using the official `TONE3000-logo.svg` asset packaged inside the NAM plugin. The Continue action then opens the existing PKCE Select Flow; no OAuth request is made merely by opening the tab.

A fresh authenticated end-to-end Select Flow was not repeated during the Phase 4b.2 visual pass. It still requires:

- the publishable client ID injected as deployment configuration;
- exact registered redirect URIs;
- a normal browser session with the TONE3000 login/selection flow.

Do not put the TONE3000 secret key in client-side code. The publishable key is deployment configuration, not a secret.

## NeuralWAMp Cabinet library redesign — 2026-09-15

- The Cabinet WAM is now presented as **NeuralWAMp Cabinet**, with its own SVG speaker logo and the same compact visual family as the amp WAM.
- Its top-level views are Main, IRs, IR details, and Help. The Main view keeps routing, bypass, Level Match, IR Trim, output gain, current artwork, provenance chips, and activity status together.
- The IR browser now exposes Factory, Favorites, External, and TONE3000 sources. Selecting an IR loads it immediately; grouped Factory/TONE3000 bundles use an artwork-and-capture-list card with previous/next controls.
- IR categories are `speaker`, `space`, `outboard`, `experimental`, and `other`. Rich bundles prefer canonical TONE3000 gear metadata (`cab`, `space`, `outboard`, `experimental`), with conservative filename/tag fallbacks for legacy loose WAV files.
- Factory manifest generation writes the category for every IR. Speaker/cabinet detection has priority over the word `reverb` for names such as Fender Twin Reverb.
- Favorites and explicitly downloaded TONE3000 WAV files persist per browser profile and origin in IndexedDB. Downloaded files can be removed individually or cleared; a favorite keeps its own complete snapshot.
- TONE3000 browsing uses the official `/tones/search` catalog with `format=ir`, optional gear filtering, pagination, sorting, detail selection, authenticated per-file downloads, local persistence, and full provenance/artwork display.
- Amp and Cabinet share the same OAuth token storage but tag each popup flow with an owner, so only the initiating WAM consumes the callback. Both clients reload shared tokens when their TONE3000 source opens.
- `?maintainer=1` reveals the Cabinet Factory maintainer. It selects one IR tone, lets the maintainer choose its WAV files, fetches artwork/metadata, and creates a repository-ready local ZIP using the existing rich `tone.json` format. It does not use the partner-only whole-tone ZIP endpoint.
- Cabinet state now includes the selected IR provenance metadata, preserving source/category/details after restoration. Existing convolution, Level Match, per-IR Trim, output gain, and AUTO routing semantics are unchanged.
- TONE3000 actions are rendered above the local downloaded-IR cards, so Browse/Continue remains visible for `All` and `Cabinets / speakers`. With `?maintainer=1`, the maintainer box is the first block in the TONE3000 panel; after a tone is selected it shows the WAV checkboxes and then reveals **Download selected Factory IR bundle (.zip)** in that same box.

## WAM FX plugin registry — Phase 1 completed 2026-09-16

- A reusable registry now loads `examples/wam/wamPlugins/plugins.json`, resolves relative and absolute plugin URIs, validates allowed URL protocols, imports each WAM independently, normalizes its descriptor, infers categories from descriptor tags, and records every compatibility stage without letting one broken plugin block the others.
- Ten bundled WAMs are registered: DeathGate, TS9, AutoWah, SweetWah, Chorus, StonePhaser, PingPongDelay, GreyHole, StereoEnhancer, and TunerMachine. Compatibility fixes were limited to relocated SDK, GUI dependency, dynamic-module, and thumbnail paths.
- The compact `wam-plugin-card` component displays descriptor artwork, identity, category, tags, and validation state with a generated fallback thumbnail when needed.
- The standalone test host is available during development at `http://127.0.0.1:8765/examples/wam/fx-test/` and in a static build at `dist/NAM_A2_WAM/fx-test/`. It provides test-tone, live-input, and local-file sources; input/output meters; plugin loading and host-level bypass; GUI open/close; parameter inspection; state save/restore; diagnostics; and sequential validation of the complete catalogue.
- TunerMachine runs on a parallel analysis branch connected through a zero-gain sink, so opening the tuner does not replace or mute the main effect route. Its GUI is available from the tuner control in the test host header.
- The distribution builder copies the registry, card component, test host, catalogue, and bundled plugins, rewrites the development-only SDK path, and verifies required files and forbidden source references.
- Registry authoring, catalogue fields, category rules, remote URI constraints, and compatibility stages are documented in `docs/WAM_PLUGIN_REGISTRY.md`.
- Validation completed successfully in both the development host and the generated static distribution: all ten real plugins reached descriptor, import, instantiation, GUI, audio, and state validation. The full automated suite passes 91/91.
- This phase deliberately does not modify the production guitar signal chain. It establishes the registry and compatibility laboratory that the later routing/pedalboard phases will consume.
- Every catalogue card is now directly clickable (and keyboard accessible). It loads the effect and opens its real plugin GUI in a modal window. The window header carries the plugin title, a synchronized host-level `BYPASS ON/OFF` control with explicit color states, and a close control; closing the window keeps the effect loaded and audible. Clicking the loaded card reopens its GUI without reinstantiating it. The tuner uses the same window but omits the unrelated effect-bypass control.
- Effects now start with host bypass OFF whenever a new catalogue plugin is loaded. GUI elements are mounted only after the modal becomes layout-visible; this is required by plugins such as TunerMachine that size their canvas in `connectedCallback()`, and restores the complete tuner scale, centered needle, and pivot instead of a clipped red fragment.

## Critical invariants — do not regress

Audio preferences (2026-09-22): explicit input device/channel and successful output selections persist under `neuralwamp.audio-devices.v1` in localStorage. Startup resolves saved IDs against enumerated hardware, resets the channel for a replacement input, clamps it after probing, and restores an available output with system-default fallback. Missing devices do not erase stored preferences, so reconnecting them for a later session can restore the user's choices. Monitoring is never enabled by restoration. Storage failures and invalid JSON are tolerated. Device identity remains browser/origin-dependent.

Initial input follow-up (2026-09-22): after host initialization the initially selected device is now probed without monitoring, using the same channel-discovery function as a manual selection. The channel menu shows a disabled “Detecting channels…” placeholder until the result arrives, instead of implying a mono device. Failure displays “Channels unavailable” and the capture error; normal live activation re-enables the selector. Automated `?auto=1` runs skip the initial microphone probe.

UI follow-up (2026-09-21): choosing an input device with monitoring disabled now briefly opens a capture to negotiate its channel count, stops all tracks, and updates the channel menu without an audio connection. The NAM Main view now includes previous/next capture arrows around its photo, the selected filename and position beneath it, and boundary/loading disabled states. Navigation groups Factory and locally stored captures by tone identity and uses the active TONE3000 tone list for remote captures.

AudioBox follow-up (2026-09-21): capture now requests exact stereo when opening the selected device, rather than relying on an ideal constraint or reported capability maximum. Only an explicit channelCount overconstraint permits fallback on the same device; device/permission failures propagate. Stereo renegotiation is also attempted when capability data is missing or reports mono. The UI reports requested versus supplied channels and the negotiation error when capture remains mono. This is covered by simulated browser tests; physical AudioBox verification remains pending.

Device handling follow-up (2026-09-21): the main host clears stale channel choices on input changes and reports the actual negotiated channel count. SourceManager retries an exact stereo constraint when a mono stream exposes stereo capabilities, while retaining selected-channel-only routing. Output selections are serialized; devicechange errors are caught and interrupted audio attempts system-default sink selection followed by resume. A bounded recovery attempt exposes a Recover audio button if needed. If Chrome has permanently closed the context, the UI explicitly requests a page reload; automatic graph reconstruction is not implemented. Removing the selected input stops monitoring instead of opening an unrelated microphone. Tests pass 96/96, including mocked stereo renegotiation, mono devices, ordered sink changes, interrupted recovery and terminal closure. Actual PreSonus hardware hot-unplug verification is still needed.

### NAM

- A2 inference remains directly in the existing WAM AudioWorklet.
- Exactly one production AudioWorkletNode belongs to the NAM WAM.
- Preserve the WAM SDK `_process()` architecture and existing gain semantics.
- Keep catalog/network/DOM work outside the real-time process path.

### Cabinet

- Cabinet remains a separate reusable WAM.
- Exactly one production AudioWorkletNode belongs to Cabinet.
- Production convolution remains NeuralAmpModelerCore `nam::Linear`, not Web Audio `ConvolverNode`.
- IR decode/resampling and analysis stay outside the AudioWorklet.
- Level Match remains L2-based; per-IR Trim and Cabinet Output Gain remain independent.

### AUTO routing

- AUTO belongs to the host; Cabinet must remain NAM-independent.
- Manual ON/BYPASS overrides remain authoritative.
- Trusted detection is case-insensitive `metadata.gear_type === "full-rig"`, with only constrained full-rig label fallbacks.
- Model selection and state restoration must reevaluate AUTO.

## Intentional Phase 4b.2 limitations

- No Cabinet meter was invented because Cabinet currently exposes no corresponding meter signal; adding one would be DSP/API work.
- No new host master-output gain was added because the current graph has no master gain node and adding one would alter gain staging. Existing source trim and plugin output gains remain available.
- Real microphone permission, physical input/output switching, and listening tests were not exercised by the automated browser pass.
- The workspace is now a Git repository on branch `main`; no initial commit has been created yet. `.gitignore` excludes generated output, `dist`, third-party trees, unrelated prototypes, and local agent/editor metadata.

## Recommended next actions

1. Deploy the rebuilt `dist/NAM_A2_WAM/` to the VPS and hard-refresh the deployed page.
2. Verify the Phase 4b.2 layout and responsive behavior in Chrome/Firefox/Safari on the deployment URL.
3. Run the real TONE3000 Select Flow using the configured publishable client ID and exact redirect URI; verify callback, selected model download, cancellation, token refresh/error handling, and AUTO reevaluation.
4. Test live guitar, microphone/device switching, audible gain behavior, bypass, Level Match, clicks/dropouts, and rapid model/IR changes.
5. Before EndUserAmp2 integration, decide explicitly whether a Cabinet meter or a true host master gain requires new plugin/DSP APIs.
6. Integrate the reusable WAM modules into EndUserAmp2 only after the standalone static package remains stable.

## Explicitly out of scope unless requested

- Replacing the official TONE3000 API and OAuth flow with a custom catalog backend.
- Additional effects, pedalboard, tuner, delay, or reverb.
- Cabinet DSP redesign or extra AudioWorkletNodes.
- Service-worker/offline catalog mirroring. Only explicitly downloaded TONE3000 model files are persisted locally.
- Server-side credential handling in this static client.

## Phase 4b.3 limitations and validation notes

- The integrated catalog is implemented against the official TONE3000 endpoints, but a fresh authenticated live catalog test still requires the deployment client ID, registered redirect URI, and a normal browser session.
- The browser host does not reproduce the official JUCE native model cache; it downloads the selected model in the page, persists that requested file in IndexedDB, and passes its text to `NamNode.loadModelText`.
- TONE3000's full Select Flow opens in a popup and relays the callback to the unchanged host page; same-tab handling remains as a fallback. The post-login catalog itself is rendered inside the WAM GUI.
- Run `npm test` and `npm run dist` after changes. The new contract coverage checks the no-prompt login URL, official catalog endpoint/query shapes, Bearer authorization, and catalog GUI controls.
