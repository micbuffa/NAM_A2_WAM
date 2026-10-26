# Validation d’intégration Studio — P5.2

Date : 26 octobre 2026. Branche : `codex/studio-integration`, socle `main` `f7ffec6b`.
Les moteurs viennent du checkpoint `multitracks` `467f07f`, avec intégration au Studio Rails, validation des entrées dans les Workers et réutilisation optionnelle du Worker qualité Demucs. Les empreintes de code ci-dessous identifient le code testé avant commit.

## Portée et méthode

Cette validation porte sur l’intégration, les contrats audio et l’interface, **pas sur une nouvelle mesure de qualité de séparation ou un benchmark de performances**. Les évaluations de références, protocoles et résultats scientifiques restent dans [MODEL_EVALUATIONS.MD sur multitracks](https://github.com/micbuffa/NAM_A2_WAM/blob/multitracks/MODEL_EVALUATIONS.MD).

Tests de navigateur effectués dans Chrome normal sur cette machine macOS, via `http://localhost:3001/rack/`, compte déjà connecté et conteneur `nam-rails-main`. Projet de test distinct : **Studio P5.2 — real audio validation**. Aucun projet préexistant modifié. Import réel via le sélecteur de fichiers, puis choix de modèle/moteur par la UI. Les en-têtes Rails conservent l’isolation cross-origin nécessaire au ring buffer. Le contexte audio du host est à 48 kHz ; le décodage de séparation est à 44,1 kHz.

Fichier : `examples/wam/source-separation/fixtures/music/slow-motion-dream.mp3`, provenant du fixture public Spleeter, CC BY 3.0. Mix musical stéréo, 44 100 Hz, 262 867 octets. Durée conteneur mesurée avec ffprobe : **10,880544 s** (le décodage MP3 peut retirer le délai/padding). SHA-256 : `4b431d535d235bd81b62f816f08c3f1afb6679d2706d84b3b75903b7df909507`. Provenance et crédits : `fixtures/music/slow-motion-dream.json` et `NOTICE.md`. Ce fichier n’a pas de stems studio de référence ; l’apparition des formes d’onde et la lecture ne constituent pas une évaluation perceptuelle ni un score d’isolation.

## Contrôles réels du navigateur

| Configuration | Entrée | Observation |
| --- | --- | --- |
| Demucs 4, WebGPU | Début 5 s | Calcul terminé ; 4 pistes dans l’ordre attendu, formes d’onde, lecture et fader Bass fonctionnels. |
| Demucs 4, WebGPU | Morceau entier | Calcul terminé sur deux fenêtres ; Play était activé avec 5,8 s disponibles alors que le second segment était encore calculé. |
| Demucs 4, CPU/WASM | Début 5 s | Calcul terminé, moteur effectif CPU affiché et Play activé. |
| BS Roformer SW 6, WebGPU | Début 5 s | Calcul terminé ; 6 pistes, dont Guitar/Piano ; solo Guitar et boucle A/B opérationnels. |
| BS Roformer SW 6, WebGPU | Morceau entier | Calcul terminé sur la version finale, six pistes disponibles ; aperçu laissé ouvert dans Chrome. |
| BS Roformer SW 6, CPU/WASM | Début 5 s | Calcul terminé, 6 pistes lisibles. Cette vérification ne mesure pas le débit ni n’annonce un temps réel CPU. |
| BS Roformer SW 6, CPU/WASM | Morceau entier, interrompu | Stop pendant le calcul ; aperçu partiel conservé en RAM, Play fonctionne après l’arrêt ; contrôles immédiatement réactivés. |

Le passage Original / project → Instruments a été vérifié. Une tentative de changer de projet montre l’avertissement RAM ; son annulation conserve les six stems et rétablit la sélection du projet courant. Le changement de modèle et celui du backend demandent confirmation et retirent l’aperçu précédent. Rechargement : original et projet Rails retrouvent leur audio ; l’aperçu RAM est volontairement absent. Les contrôles de modèle, settings et défilement restent utilisables pendant le calcul. **Aucun relevé instrumenté de latence UI, long tasks ou consommation mémoire n’a été effectué ici** ; ne pas transformer ce constat manuel en chiffre de performance.

Le premier téléchargement SW a révélé un CDN absent de l’allowlist. Domaine de redirection observé : `https://us.aws.cdn.hf.co` ; autorisation explicite ajoutée, sans ouverture générale des redirections. Le téléchargement navigateur a ensuite abouti et ses taille/SHA-256 ont été vérifiés par le gestionnaire avant l’inférence. Les poids restent hors de Git et de la distribution.

## Tests automatisés

- Contrats du catalogue produit : deux modèles seulement, ordres de sources explicites, versions/hashes ; plan coopératif correspondant au fichier SW épinglé.
- Origines de pistes, absence de preset/monitoring sur les stems, conservation des pistes historiques, migration non destructive et accès Rails.
- Publication 4/6 sources stéréo, longueur totale, canaux gauche/droite et enveloppes ; rejet d’enveloppes invalides avant publication.
- Annulation pendant décodage et pendant inférence, changement de configuration, messages tardifs, conservation d’un résultat partiel.
- Play au premier bloc, durée fixe du playhead, buffering/reprise, Pause pendant l’attente, seek, A/B, exclusivité des deux decks, faders/pan/mute/solo, notification du monitoring live.
- Sessions : réutilisation uniquement à identité modèle/backend égale ; libération sur Stop/changement ; aucun mélange GPU/CPU après publication.
- Ring buffer : vrai producteur Node Worker, douze canaux, sept secondes plus trois frames, contenu PCM vérifié bit à bit, contre-pression et ordre des paquets ; même contrôle pour le fallback par transfert.
- DSP SW : STFT comparée à une DFT indépendante, reconstruction des bords et proches de Nyquist, contrat 4 s, libération des tenseurs, six sources jusqu’au dernier échantillon de recouvrement.
- Exécution coopérative : ordre des étapes, attente GPU et yield, durée de vie des tenseurs, rejet des plans invalides et des poids non conformes, libération en cas d’échec.
- Distribution : présence de toutes les dépendances produit/licences, absence des pages du laboratoire/corpus/poids locaux ; génération Rails des contrôles attendus.

**Résultat final : 378 tests JavaScript réussis ; 88 tests Rails / 572 assertions, aucun échec ni test ignoré.** Distribution produit reconstruite et synchronisée avec le conteneur. Commandes :

```sh
npm test
docker exec -e RAILS_ENV=test nam-rails-main bin/rails test
docker exec nam-rails-main bin/rack-sync
```

## Identités des modèles et du code

- **htdemucs_4s_onnx** — version `45f990170d9571379a9dbd3bbdd1c7591b26864c`, 174263526 octets, SHA-256 `da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748`. Sources : drums, bass, other, vocals.
- **bs_roformer_sw_6s** — version `a744f80957374e1735ad70fa122670b7961da8cc`, 352778874 octets, SHA-256 `d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444`. Sources : bass, drums, other, vocals, guitar, piano.

| Fichier | SHA-256 |
| --- | --- |
| `onnx-worker.js` | `25033d8b5d0278ee89dcef649ac8da7157d23384c569642a1a4540b39a3cfa63` |
| `roformer-worker.js` | `fcb982a57a180b36e22ed2c0b69dc5be6a0dd0406926d236a9f93863cae17047` |
| `CooperativeOnnxSession.js` | `0965bffdf86d86944902c7745c72fa1962cd981a576212ffc7136653a4d75b35` |
| `roformer-stage-plan.json` | `ed7708fa674f4fa8c0c2fbdeb2aee24af49151868b1375576b5b936225cd22da` |
| `StreamTransport.js` | `e46e76077cf17be51d552693f7ab3ae993b48242b54d8f74bb756340680f356c` |
| `vendor/demucs-js/apply.js` | `814c4b775a9a557ec2f83a2b757611ad0c135eda83a3d94f3793116c981d0bfe` |
| `RoformerDSP.js` | `b1173294122f92babba65192074b673ef2033cfab4ab02a58d4ecc6e71d2dee2` |

## Limites et suite

Aperçu local, sans upload des stems ni sauvegarde du mix. Les contributions personnelles sont préservées et écoutables dans Original / project ; l’aperçu Instruments ne les inclut pas. Un rechargement ferme les Workers et perd ce PCM. La garde de durée 24 h n’est pas une admission de mémoire pour un morceau de 24 h. Les tests courts ci-dessus ne qualifient pas tous les appareils, morceaux longs, navigations arrière-plan ou configurations mobiles.

La parité complète avec une référence Python/UVR et l’étude perceptuelle n’ont pas été répétées dans cet incrément d’intégration. Les licences/limitations des poids conservent les notices épinglées. La prochaine étape **P5.3** ajoute le stockage atomique des originaux/stems et des métadonnées dans les projets Rails, avec reprise après reconnexion. P5.4 traitera le mix vers Tone ; YouTube et WebNN restent leurs incréments distincts.


## P5.3 — Sauvegarde et réouverture (26 octobre 2026)

Les limites RAM de P5.2 ci-dessus sont historiques. P5.3 stocke les instruments explicitement avec Save project. Même fixture musicale CC-BY, projet local de validation id4, Demucs4 GPU puis SW6 GPU, premiers5s : sauvegarde de4 puis6 fichiers WAVFloat32 stéréo, réouverture après reload, lecture sans relancer l'inférence, volume Bass57 et pan Guitar−35 conservés. Les lots sont indépendants et l'original est préservé. La durée/historique sont affichés dans Studio.

Tests ajoutés : WAVexact (y compris amplitudes>1 et signes), rejet non-fini/désaligné/limite taille, encodage paquet par paquet sans détacher le PCM lecteur, sauvegarde4/6sources et reprise sans réenvoyer les fichiers, métadonnées moteur demandé/effectif/partiel, API authentifiée/CSRF/multipart, restauration sélective et attente de tous les stems. Rails : publication atomique, retry idempotent, nouvelle authentification, accès partagé/étranger, checksumsource périmé, WAV tronqué, quotas projet/compte, panne de stockage sans blob/piste publié, mix sans réupload, impossibilité d'altérer les audios sauvegardés, suppression de projet cohérente.

**386 tests JavaScript ;96 tests Rails /715 assertions, zéro échec.** Distribution produit reconstruite et synchronisée. Pas de mesure de performance longue durée ni nouveau score de séparation dans cet incrément.

### Migration SQLite et conservation des données

Une première migration reconstruisait projects avec les clés étrangères actives à l'intérieur de la transaction du migrateur ; ONDELETECASCADE a retiré cinq lignes Track existantes. Détecté avant livraison lors de la validation Chrome. Les fichiers et attachements étant intacts, restauration ciblée des cinq lignes depuis la sauvegarde préalable, sans remplacer la base ou les projets. Contrôle de clés étrangères sans erreur. Migration corrigée pour opérer sans transaction externe, ce qui permet à SQLite de désactiver ses contraintes pendant la reconstruction. Test unitaire sur projet/DI/partage/attachement existants et répétition du vrai migrateur Rails sur une copie de la base préexistante : cinq pistes conservées avec leurs métadonnées et auteurs. Les sauvegardes de sécurité restent dans web/tmp ignoré.

Le stockage est privé, sauvegarde atomique par lot, reprise de fichiers dans la page active. Après perte du PCM/reload, un lot intégralement reçu est publiable ; un lot incomplet est nettoyable, les fichiers manquants nécessitent un nouveau calcul. Aucune reprise d'inférence après fermeture de page n'est annoncée. Quotas d'envoi séparation512MiB/stem,2GiB/projet,5GiB/compte. Les anciens imports gardent100MiB/fichier. Les contributions personnelles restent dans leur deck et ne sont pas encore combinées aux stems ; export vers Tone = P5.4.


## P5.4 — Mix d’accompagnement vers Tone (26 octobre 2026)

Portée livrée : stems sauvegardés et pistes enregistrées sèches. Les prises avec preset et le monitoring sont refusés explicitement ; aucun test ci-dessous ne qualifie le rendu WAM, qui reste P5.4b. Le rendu utilise le même gain Studio et le StereoPanner natif dans un OfflineAudioContext isolé, avec rééchantillonnage natif vers44,1kHz. Aucun bus live/listening du host n’entre dans le graphe. MP3stéréo192kbit/s, encodeur LAME épinglé du prototype, notices conservées. Mesure PCM et atténuation commune jusqu’à−1dBFS si nécessaire, sans amplification des petits signaux. Ce plafond PCM avant MP3 ne constitue pas une mesure de true peak du signal décodé.

### Validation native reproductible

Harness `tests/phase7/fixtures/studio-mix-validation.html`, servi depuis la racine (`python3 -m http.server 8779 --bind 127.0.0.1`) puis bouton Run native mix validation dans Chrome. Aucun accès au microphone, aucun rendu envoyé aux haut-parleurs par ce test.

| Contrôle | Données et critère | Résultat observé |
| --- | --- | --- |
| Pan/stéréo/mix/mute/solo | Piste stéréo:440Hz à0,2 gauche,880Hz à0,1 droite ; mono220Hz à0,15. Pans−100/−50/0/+35/+100, gain60(−6dB), modesmix/mute/solo, plage0,1–0,8s. Comparaison indépendante au calcul analytique, seuil2e−5. |15casPASS ; erreur max2,2446375813611752e−8. |
| Rééchantillonnage | Sinus440Hz à0,2, buffer48kHz1s ; rendu44,1kHz ; calcul analytique hors bords (échantillons500–43499), seuil0,001. |44100frames ; erreur max0,00008281430078460605. |
| MP3 Worker réel | Stereo440/880Hz niveaux0,2/0,1,1s, décodage natif44,1kHz ; rapportRMS≈2 et durée±0,1s. |25077octets ;1,0448979591836736s (padding) ;RMS0,13419819933114951 /0,0670920471330489 ; atténuation1. |
| Écrêtage PCM | Test Node avec même encodeur LAME réel, sinus amplitude2 gauche/1 droite. |Un gain commun ramène la crête à10^(−1/20), sans modifier le PCM source ni le rapport stéréo. |

### Parcours Rails et Chrome

Projet de validationid4, fixture CC-BYslow-motion-dream, séparation SW6sauvegardéeP5.3, début5s ; Guitar volume70/pan−35 et autres réglages courants. Use mix in Tone crée un backing privéidstudio-17 lié au projet ; le lecteur Tone est arrêté au chargement puis lit sur clicPlay. Reload restaure sélection et réglages sans autoplay, Open in Studio revient au même projet et aux6stems. Sélection d’une boucle via la règle, export A/B4s : backingidstudio-18 ; téléchargement réel,97175octets ;ffprobe4,048958s (padding). Deux rendus conservés, avec durées/heure dans la bibliothèque. Les autres morceaux ne sont pas préchargés. Les projets utilisateur n’ont pas été modifiés par ces essais ; l’aperçu non sauvegardé d’un autre onglet a été conservé.

**393 tests JavaScript ;100 tests Rails /776 assertions**, zéro échec. Couverture nouvelle : graphe/pans/volume/solo/plage, refusDItraitée/monitoring/RAM, vrai encodeur, paquets non détachés et fermetureWorker, retryidentique sans rerendu, catalogue privé/réponses périmées/arbitrage sansautoplay ; APIpublication/réauthentification/partage/ranges/idempotence/provenance/sourcepérimée/quotas/stockagedéfaillant. FichierMP3de fixture Rails synthétique,0,1s, décrit dans `web/test/fixtures/files/studio-mix.README.md`.

Distribution produit reconstruite et synchronisée. Migration additive20261026160000, sauvegardeSQLitepréalable, nombre de pistes préexistantes conservé et contrôleFKsans erreur. Aucune nouvelle étude perceptuelle ni mesure de performances sur morceaux longs. LimitePCM512MiB, MP3upload100MiB, quotas projet/compte identiquesP5.3. Une perte de page après échec perd le MP3local non publié ; les versions déjà publiées restent accessibles.


## Correction du chargement après sauvegarde

Incident utilisateur : publication de quatre stems réussie (HTTP200) puis relecture Bass en erreurHTTP500, causée par SQLite3::IOException lors de PRAGMAjournal_mode=wal. Le bouton d’export attendait ce fichier mais n’indiquait pas la cause. Les trois autres fichiers étaient disponibles. Après réinitialisation des connexions du conteneur Rails, quick_check=ok et quatre fichiers de1764044octets présents. Aucun audio effacé ni séparation refaite. La cause initiale du problèmeWAL n’est pas établie ; les accès administratifs à la base vivante doivent se faire depuis le conteneur, sans ouvrir ses sidecarsWAL/SHM depuis macOS.

Correction : état loading/error par canal, au plus trois essais automatiques pour les erreurs transitoires, reprise manuelle ciblée, invalidation des requêtes périmées. Les messages à côté de Use mix in Tone distinguent stockage, préparation audio, erreur nommée et lecteur Tone encore en démarrage. Tests simulant500puis succès, échec persistant puis retry sans recharger Drums, changement de projet pendant l’attente, et états d’aide. **397 tests JavaScript ;100 tests Rails/778 assertions**, zéro échec. Chrome : même projet sauvegardé rouvert, quatre pistes disponibles et Play/export activés. Aucun nouveau mix créé sur le projet utilisateur ; il est laissé prêt pour tester le bouton lui-même.


## 26 octobre — imports Tone/YouTube et garde WebNN

**406 tests JavaScript ;114 tests Rails/893 assertions**, tous réussis, zéro skip. Distribution reconstruite puis synchronisée avec le container Rails sur3001. `git diff --check` sans erreur. Les nouveaux tests couvrent l'import Tone privé/réutilisation du blob/fichier local/quota/réponse de compte périmée ; URL YouTube stricte, CSRF et propriété des tâches, reprise après fermeture, erreurs/annulation/quotas/absence de publication partielle/nettoyage temporaire, sous-processus avec stderr, timeout même après fermeture des pipes, limites disque/live/durée/fichier absent ; garde WebNN par rôle, évidence/manifestes/runtime SHA, repli avant publication et absence de repli après.

Chrome/Rails réel : depuis le mix musical5s de validationstudio-17, Separate instruments a créé le projet10 et l'original27 en réutilisant son blob, sans upload audio. Source conservée. YouTube9rPbKNMjuzI (démonstration publique de l'utilisateur) : job1 prêt, durée136s,3268845octets MP3,136,176s après décodage ; projet9/original26 privé avec URL/id/titre/durée/horodatage. Réouverture après reload, ouverture explicite dans Studio, séparation5s par Demucs4/WebGPU, lecture et sauvegarde des4instruments, puis reload avec batch sauvegardé. Cette vidéo parlée valide le flux d'import et non la qualité musicale du modèle. Job2 annulé, sans autre projet publié. Les projets utilisateur existants et l'aperçu RAM d'un autre onglet ont été préservés.

Un problème de timer navigateur (`setTimeout` appelé avec un receiver incorrect) détecté à l'essai réel a été corrigé par wrapper avant validation finale. Le téléchargement serveur avait réussi ; rouvrir le dialogue a récupéré son état prêt sans nouveau téléchargement.

WebNN : interface avancée CPU/GPU/NPU + Worker isolé ORT1.30, Demucs4 uniquement. Garde globale et par rôle contre WASM1.30 sur **chaque** bloc avant publication (pas contre ORT1.22, pas une mesure de qualité des stems). Dans Chrome actuel, préférenceNPU→repliWASM production annoncé ;4pistes5s lisibles. Les tests contrôlent la garde numérique, les dispatchs déclarés, le refusSW6 et les limites du repli. **Pas de validation native ou comparaison de performances CPU/GPU/NPU dans ce passage** : Canary non exposé au connecteur, prise en main native expirée. P5.6 reste CURRENT ; ne pas convertir ce repli réussi en prétendu succèsNPU. Banc natif prêt dans `tests/phase7/fixtures/studio-webnn-validation.html`, serveur local limité `tools/serve-studio-webnn-validation.mjs` (arrêté après essais). Les poids ne sont pas livrés avec la dist. Reste à mesurer préparation/premier-audio/débit et parité avec le runtime de production.

La migration additive20261026180000 a été appliquée puis le container redémarré. Dépendances yt-dlp/Node/FFmpeg validées dans le container de développement. Dockerfile production modifié, mais image production complète non construite/déployée ici. Le mode développement utilise ActiveJob async ; la reprise durable en production utilise SolidQueue et son volume persistant. Pas de score perceptuel ou de performance inventé.

## Qualification WebNN du26octobre — native encore bloquée

Banc étendu : matrice séquentielle, référenceWASMproduction1.22, parité par rôle dansWorker, chronométrages séparés, visibilité/timerUI, exportJSON, Stop et échéances. WorkerWebNN instrumenté, garde corrigée pour exiger un dispatch **sur chaque bloc**. Tests de perte de contexte et limites de qualification ajoutés. **410testsJavaScriptPASS**, zéro skip/échec ; dist/publicrack reconstruits. Aucun codeRailsmodifié, suiteRailsnon répétée dans cet incrément.

Essai réel Chrome155 sur Slow Motion Dream6s, session neuve, pas de build/tests simultanés : WASM36,240s / WebGPU7,781s ; comparaison stricte GPU/CPU échoue légèrement sur la basse (RMSrelatif0,0010157745 >0,001), sans changer le seuil. WebNNCPU/GPU/NPU : API indisponible dansWorker, aucun résultat natif. TimerUIglobal max2,2011s incluantpréparation/assets, cause non localisée ; ce n'est pas une validation de fluiditéStudio. ClicStop pendantinférenceWASM accepté. Premier smoke conservé mais exclu des conclusions temporelles pour buildconcurrent.

Canaryabsent du connecteur ; tentative d'accès natif expirée. P5.6CURRENT, connexion demandée. VoirMODEL_EVALUATIONS.MD§24 etdocs/evaluations pour méthodologie/JSON/empreintes. Banc local8779préparé pour reprendre les essais natifs. Aucun scoreNPU/qualité/écoute inventé, aucun onglet utilisateur rechargé.

## Rapport natif Canary reçu — admission numérique refusée

Le26octobre, rapport utilisateur`studio-webnn-2026-10-26T15-22-35.648Z.json`, UA158, cinq configurations6s/session neuve. Rawcopié sans modification dansdocs/evaluations/studio-webnn-canary-2026-10-26.json (12843octets, SHA2568593224f323094e182414c0cd043256188e9ebd4871335741c70a6eaa2bfb53b). L'analyse séparée consigne provenance, limites et empreintes après réception ; seul l'affichageUAduHTMLdiffère du manifeste précontrôleChrome155. LePCMestidentique au contrôle précédent.

Les trois préférencesWebNN exécutent un dispatch, mais aucune ne publie de bloc : seule la basse échoue au seuilstrict0,001 deRMSrelatif, à0,00100623(CPU) et0,00101603(GPU/NPU). Global et trois autres rôles passent. Les commandesCPU/GPU/NPUne prouvent pas le matérielphysique ; l'APIfonctionne, l'admissionéchoue. WebGPUproductionprésente aussi un léger dépassement strict surbass ; aucun seuil relâché ou critèrehistorique réécrit.

TotalWASM11,384s,WebGPU4,302s ; WebNN24,100/33,143/25,580s jusqu'au refus, dont5,432/9,265/1,958s de calculcandidat et≈10,7–10,9s de référenceWASM. Une seule répétition, ordre fixe, pas de classementgénéralNPU. Pas de paritédirecteWebNNcontreproduction1.22 puisque lePCMnon admis n'a pas été publié. TimerUIdu banc max180,3ms, distinct d'une validationplayhead/scrollStudio. Pas d'annulationnative ni d'écoutehumainenouvelle.

Correction postrapport : validationMs est mesuré dans un finally même si la garde refuse ; l'ancien zéro dans le raw reste intact et documenté comme omission d'instrumentation. Tests du vrairapport : nativeobserved=true mais nativeréussi=0, aucune framepubliée, échec bassseul et conservationSHA. **412testsJavaScriptPASS**, zéro skip/échec ; hostreconstruit/synchronisé. Aucun codeRailsmodifié. MODEL_EVALUATIONS.MD§24.7, spec§12.17 et handoff actualisés. P5.6resteCURRENT pour diagnostic/reprises/qualificationcomplète ; plus de blocage d'accès à l'API dans l'essaimanuel.
