# Enregistrer une guitare ou une basse dans Studio

Date : 27 octobre 2026. **Spécification : enregistrement non implémenté.**

## Décisions et périmètre

Un projet reste une liste nommée de pistes. Les pistes issues d’une séparation sont des accompagnements, sans preset associé. Une nouvelle piste personnelle de guitare/basse pourra recevoir une prise, en synchronisation avec les autres pistes.

Décisions confirmées par Michel :

- Conserver **la DI brute et une copie complète du preset**, pour changer le son après la prise.
- Sur une piste contenant déjà de l’audio, **demander confirmation avant remplacement**. Une annulation ou une prise échouée conserve l’ancien audio.
- Entendre son instrument traité avant d’enregistrer ; armer explicitement la piste avant Record.
- Aucune région, édition par découpage, prise en boucle ou gestion de plusieurs takes dans cette première version.

Hypothèses de première livraison : une seule piste armée à la fois, entrée mono sélectionnable, enregistrement depuis le playhead courant et jusqu’à Stop. Les pistes d’accompagnement continuent à jouer. Le compte propriétaire peut enregistrer ; le partage reste en lecture seule tant qu’un modèle de collaboration avec droits d’écriture n’a pas été spécifié.

## Analyse de wam-studio : code réellement consulté

Référence étudiée : [Brotherta/wam-studio](https://github.com/Brotherta/wam-studio), branche `main`, commit **`4c268f7b5791bcb11be3c1cf510b1a4a7728dd02`**. Cette analyse est statique : aucun test de boucle physique audio n’a été réalisé ici. Les comportements ci-dessous concernent cette révision, pas toutes les versions du DAW.

### Capture, armement et monitoring

[SampleRegionRecorder.ts](https://github.com/Brotherta/wam-studio/blob/4c268f7b5791bcb11be3c1cf510b1a4a7728dd02/public/src/Controllers/Recording/Recorders/SampleRegionRecorder.ts) construit splitter/merger à partir de `settingsController.soundInputNode`, puis un `SampleRecorderWAM`. La capture est branchée sur l’entrée, avant l’effet de piste. Le merger peut aussi être connecté au WAM destinataire pour écouter l’entrée. Les choix mono/stéréo et gauche/droite sont gérés par le routage.

[RegionRecorderManager.ts](https://github.com/Brotherta/wam-studio/blob/4c268f7b5791bcb11be3c1cf510b1a4a7728dd02/public/src/Controllers/Recording/Recorders/RegionRecorderManager.ts) conserve l’ensemble des recorders armés et connecte/déconnecte leur sortie de monitoring. [RecorderController.ts](https://github.com/Brotherta/wam-studio/blob/4c268f7b5791bcb11be3c1cf510b1a4a7728dd02/public/src/Controllers/Recording/RecorderController.ts) orchestre armement, monitoring, début et fin des prises. `startRecordingWith()` mémorise le playhead, crée une première région puis fusionne les ajouts à sa suite.

À reprendre : séparation entre capturer la DI et écouter la chaîne d’effets. À adapter : notre Studio n’aura ni région ni manager de recorders MIDI. Monitoring et armement seront deux états explicites ; il sera possible d’écouter avant d’armer.

### Transport PCM et waveform

[SampleRecorderProcessor.ts](https://github.com/Brotherta/wam-studio/blob/4c268f7b5791bcb11be3c1cf510b1a4a7728dd02/public/src/Audio/WAM/SampleRecorderProcessor.ts) intercale le PCM stéréo dans un tableau réutilisé de 256 valeurs pour les blocs de 128 frames, puis écrit dans un ring buffer SPSC partagé. Il détecte une écriture incomplète, mais se contente de journaliser le problème.

Le `SharedArrayBuffer` de `SampleRegionRecorder` a une capacité de `sampleRate * 2` valeurs Float32 : environ **une seconde stéréo**, et non deux secondes stéréo. Le [worker wav-writer.js](https://github.com/Brotherta/wam-studio/blob/4c268f7b5791bcb11be3c1cf510b1a4a7728dd02/public/src/Audio/Utils/wav-writer.js) vide la queue toutes les 100 ms. Toutes les 500 ms il envoie les nouveaux échantillons dans `audioBufferCurrentUpdated` et remet sa collection temporaire à zéro. `audioBufferFinal` contient le reliquat après drainage à l’arrêt : ce message n’est pas à lui seul la prise complète. Le main thread reconstruit des AudioBuffers, et le contrôleur assemble les ajouts en région.

À reprendre : AudioWorklet producteur → ring buffer → worker consommateur, indépendamment du rafraîchissement visuel. À améliorer : envoi de peaks incrémentaux plutôt que reconstruction de l’audio à chaque mise à jour ; blocs PCM transférables ; compteur d’overflow exploitable ; protocole Stop avec acquittement du producteur avant drainage final. Les commandes Stop séparées vers le worker et le processor ne constituent pas à elles seules cette garantie d’ordre.

### Mesure et compensation de latence

[LatencyProcessor.js](https://github.com/Brotherta/wam-studio/blob/4c268f7b5791bcb11be3c1cf510b1a4a7728dd02/public/src/Audio/LatencyProcessor.js) émet périodiquement une courte salve carrée de 64 frames, période de 16 frames, amplitude 0,8, puis détecte son retour au-dessus d’un seuil. Un historique circulaire local permet de rechercher le début du retour. Le délai est calculé en frames avec `currentFrame`, puis converti en secondes. Ce tampon d’analyse local n’est pas le ring buffer inter-thread de la capture. Le commentaire du code reconnaît que la détection devrait bénéficier d’une corrélation ; le code consulté n’en réalise pas une complète.

[LatencyController.ts](https://github.com/Brotherta/wam-studio/blob/4c268f7b5791bcb11be3c1cf510b1a4a7728dd02/public/src/Controllers/LatencyController.ts) crée un **autre AudioContext** de calibration, demande l’entrée et relie son worklet à la sortie. Il calcule `roundtripMs`, en soustrait `audioCtx.outputLatency * 1000` du contexte principal, affecte le résultat à `host.latency`, et le stocke sous `latency-compensation` dans localStorage. Le code prévoit aussi un réglage manuel. La valeur n’est pas indexée par configuration matérielle.

Dans `SampleRegionRecorder.start()`, `toIgnore` reçoit `host.latency`. Lors de la réception du PCM, le recorder supprime le début de l’audio, avec une conversion `toIgnore * sampleRate / 1000`. **Il ne déplace pas simplement la région finale après Stop** : la correction est appliquée lors de l’intégration des données.

Points à ne pas recopier sans validation :

- `toIgnore`, en millisecondes, est comparé à `audioBuffer.duration`, en secondes ; la branche qui ignore un buffer entier soustrait également des secondes à cette valeur. Cette incohérence peut fausser une compensation répartie sur plusieurs chunks.
- Soustraire la latence de sortie d’un autre contexte peut donner une estimation incohérente. Une valeur absente de `outputLatency` doit être gérée explicitement.
- Les commandes par `postMessage` ne fixent pas précisément le frame de début. La réception d’un message JS n’est pas une horloge musicale.
- La détection par seuil est sensible au bruit, au gain et au trajet acoustique. Une mesure unique ne permet pas d’annoncer une précision à l’échantillon.
- Les tailles 128/256 sont codées en dur ; le futur processor utilisera la taille effective des tableaux.

Ces observations sont des limites du code inspecté, pas des mesures de désynchronisation de l’application déployée.

## Parcours utilisateur proposé

1. Créer une piste personnelle guitare/basse, ou en sélectionner une existante. Le preset initial est une **copie de l’état courant de Tone**, y compris s’il n’a pas encore été sauvegardé.
2. Choisir l’entrée, activer Monitor et régler le niveau en jouant. Entendre uniquement la chaîne de cette piste, avec vumètre entrée/écrêtage.
3. Choisir un autre preset via un sélecteur simple ou « Edit in Tone ». Le retour retrouve le même projet et la même piste. Changer le preset ne modifie jamais la DI.
4. Armer la piste : bouton R distinct de Monitor. Afficher le preset et la calibration applicable. Désactiver Record tant que l’entrée, le rack et le recorder ne sont pas prêts.
5. Positionner le playhead puis Record. Si l’audio doit être remplacé, demander confirmation avec le nom de la piste, avant le départ. Pas de suppression anticipée.
6. Pendant la prise : écouter le backing et son instrument, afficher waveform, durée et vumètre. Le playhead suit l’horloge audio. La waveform représente la DI.
7. Stop : finaliser les derniers frames, appliquer une seule compensation, encoder hors UI, puis proposer/assurer la sauvegarde explicite. La lecture de la prise traverse la copie du preset.
8. Save project sauvegarde DI, snapshot et métadonnées. Recharger doit retrouver le même son ou signaler précisément une ressource manquante.

L’utilisateur doit distinguer « prise disponible localement » et « sauvegardée sur le serveur ». Une prise non envoyée est signalée avant navigation/rechargement. Un échec réseau offre Réessayer ou Exporter la DI, sans effacer l’ancienne version sauvegardée.

## Architecture prévue

```mermaid
flowchart LR
  IN[Entrée choisie] --> DI[Bus DI avant preset]
  DI --> REC[WAM recorder producteur]
  REC --> RB[Ring buffer PCM partagé]
  RB --> WK[Worker consommateur / stockage temporaire]
  WK --> PEAKS[Peaks incrémentaux vers UI]
  WK --> FILE[DI WAV + métadonnées]
  DI --> MON[Monitor de la piste]
  MON --> FX[Rack / copie du preset]
  PLAY[Lecture DI sauvegardée] --> FX
  FX --> MIX[Mixer Studio]
  BACK[Autres pistes] --> MIX
  MIX --> OUT[Sortie]
  FILE --> API[Publication Rails atomique]
```

Réutiliser `ProjectPlayer`, le mixer et `TrackTones` : un AudioContext commun avec Tone et Studio, un transport de référence, pas un nouveau lecteur concurrent. La route Tone live doit être désactivée/transférée pendant le monitoring Studio pour éviter un doublage sec/traité. La capture reste avant les trims du preset ; les éventuels gains d’entrée matériels/digitaux sont documentés. Les gains de monitoring et du mix ne sont pas imprimés dans la DI.

Le matériel peut offrir un monitoring direct : indiquer de le couper si l’on veut entendre uniquement le preset logiciel. Aucun retour du mix ou du monitoring ne doit rentrer dans le bus DI.

### Contrat des données et threads

Préparer un `RecordingSession` propriétaire du cycle de vie, un WAM processor de capture et un worker dédiés. Ne pas réutiliser le ring buffer d’inférence : producteur, consommateur, format et durée de vie sont différents. Garder le principe [ringbuf.js de Paul Adenot](https://github.com/padenot/ringbuf.js/) : une queue a un seul producteur et un seul consommateur.

- PCM Float32 ; `sampleRate`, nombre de canaux et canal choisi explicites. La première version mono ne duplique pas inutilement la DI.
- Unité interne du temps : **frames entiers** à la fréquence effective du contexte. `currentFrame` donne le repère du worklet ; conversions ms/secondes limitées aux frontières UI/API. Voir la [spécification Web Audio](https://webaudio.github.io/web-audio-api/#AudioWorkletGlobalScope).
- Messages de contrôle versionnés : sessionId, trackId, startFrame, stopFrame, sequence, firstFrame, frames, statut final. Un message d’une ancienne session ne peut écrire dans un autre projet.
- Départ et fin planifiés à des frames communs à la lecture et à la capture, avec acquittement. Le worklet capture exactement l’intervalle accepté. Après StopAck, le worker draine jusqu’au dernier frame et publie une seule fin.
- Taille de queue proposée : deux secondes de PCM, calculée en **frames × canaux**, à qualifier sous charge. Mémoire allouée avant Record ; pas d’encodage, DOM, `fetch`, attente bloquante ou allocation par bloc dans le processor.
- Compteurs atomiques d’échantillons écrits/perdus, séquences et saturation. En cas de dépassement, invalider la prise et conserver l’ancienne ; ne pas compresser silencieusement le temps en sautant des échantillons.
- Worker : conserver le PCM par chunks, produire les peaks par fenêtres, envoyer seulement les nouveaux peaks à une cadence visuelle bornée (par exemple 10–20 Hz). Ne jamais retransmettre/reconstruire toute la prise à chaque update.
- RAM tant que raisonnable ; stockage temporaire local par blocs pour prises longues selon budget mémoire, avec échec de quota explicite. Pas d’upload sur le chemin temps réel. Encoder/finaliser dans le worker.
- `crossOriginIsolated`/SharedArrayBuffer vérifiés avant armement. Vérifier COOP/COEP et compatibilité des ressources WAM sur le déploiement Rails. Pas de fallback annoncé comme fiable sans qualification.
- Lecture et monitoring prioritaires : première version interdit une séparation en cours pendant Record. UI de sauvegarde, suppression, navigation, seek et changement de modèle/preset bloquée pendant la capture/finalisation ; arrêter proprement avant de changer de périphérique.

## Synchronisation et calibration

### Ce que l’on compense

Il faut différencier le retard physique du geste entendu, l’entrée ADC, la sortie DAC, le délai du graphe, et la position temporelle des données capturées. `baseLatency` ou `outputLatency` seuls ne décrivent pas le trajet aller-retour. Voir les définitions normatives de [latence dans Web Audio](https://webaudio.github.io/web-audio-api/#latency).

Pour notre contrat, une boucle matérielle entre sortie et entrée mesure un délai `D` entre un probe émis au frame `F` et son retour capturé au frame `F + D`. Cette mesure qualifie **ce routage et cette horloge**. On aligne les données DI sur le transport en retirant ce retard une fois, selon le protocole mesuré. Il faudra démontrer expérimentalement si le retard applicable est le RTL complet ou sa composante d’entrée pour le point d’horodatage retenu ; ne pas décider en soustrayant aveuglément une estimation navigateur. Une performance humaine ne se mesure pas comme un câble : le musicien peut anticiper le backing, ce que la compensation ne doit pas « corriger » automatiquement.

Contrat initial à qualifier : capture commençant au frame de départ du transport, restitution test en loopback et correction par `D` frames. Pour une capture brute d’index `k`, `projectFrame = startProjectFrame + k - compensationFrames`. Les frames avant zéro sont tronquées ; pour un départ plus tardif, padding silencieux jusqu’au placement corrigé. Ne pas appliquer en plus un décalage de lecture de la même valeur. Conserver le PCM de travail et les métadonnées nécessaires jusqu’à validation pour pouvoir corriger une estimation sans doubler le traitement.

### Assistant de mesure

Un écran avancé « Calibrate input latency » explique le câblage sortie → entrée et empêche une boucle de monitoring. Utiliser le **même AudioContext et le même chemin matériel** que la prise, bypass des effets non linéaires et de la réverbération ; signal bref à niveau modéré et fenêtre d’écoute bornée. Préférer corrélation d’une séquence connue plutôt que seuil seul, avec niveau de confiance et rejet du clipping/bruit/absence de retour.

Effectuer plusieurs probes, calculer médiane et dispersion, afficher RTL en frames et ms, correction appliquée, configuration et date. Une estimation variable n’est pas présentée comme calibrée. Permettre réglage manuel et remise à zéro, avec statut « manuel / non mesuré ». Sans câble, ne pas annoncer une mesure exacte de l’interface : l’acoustique ajoute propagation et réflexions.

Indexer le profil local par périphérique entrée, sortie quand identifiable, sampleRate, canaux, navigateur/version pertinente et configuration du contexte. Invalider/revalider sur changement matériel, fréquence ou routage. Déconnexion : arrêter, finaliser ou signaler l’échec sans écraser l’ancienne piste. Le profil personnel mesuré reste prioritaire ; les estimations communautaires décrites ci-dessous ne sont pas une calibration universelle.

La latence du preset est séparée : la DI étant enregistrée avant le rack, ne pas imprimer son retard dans la compensation de capture. Si un effet ajoute du délai, qualifier le playback/monitoring et l’éventuelle compensation du mixer. Copier le preset ne garantit pas que tous les WAM exposent correctement leur latence. Une première qualification utilisera une interface filaire ; Bluetooth ne reçoit pas de garantie de synchronisation stable.

### Identification de la carte son et calibration communautaire [SPECIFIED / NOT IMPLEMENTED]

Après une mesure fiable, proposer **« Contribuer cette calibration »**, sans conditionner l’enregistrement à cette contribution. Présenter la mesure, son contexte et les champs à publier avant validation. Demander marque, modèle, génération et référence ; exemple de saisie : « Focusrite Scarlett 2i2, 2e génération — compensation 11 ms ». **11 ms est un exemple, pas une mesure ni une valeur recommandée pour cette carte.**

#### Ce que permet le navigateur

`MediaDeviceInfo.label` peut aider à préremplir le modèle après autorisation de capture, mais son contenu n’est pas normalisé et peut être vide. La spécification interdit de présumer qu’il contient un modèle précis. `deviceId` identifie un périphérique dans le contexte de l’origine, peut changer et n’est pas une référence constructeur ; `groupId` aide à grouper des périphériques dans un document. Il n’existe pas de champ standard marque/modèle/génération dans cette interface. Identifier l’entrée réellement ouverte via `MediaStreamTrack.getSettings().deviceId`, puis proposer son libellé localement, avec confirmation manuelle. Un périphérique « default », virtuel ou ambigu exige un choix explicite. Sources : [MediaDeviceInfo.label](https://w3c.github.io/mediacapture-main/#dom-mediadeviceinfo-label), [deviceId](https://w3c.github.io/mediacapture-main/#dom-mediadeviceinfo-deviceid), [exposition des informations](https://w3c.github.io/mediacapture-main/#device-information-exposure).

Ne pas ajouter de sondage matériel pour contourner ces protections. Associer localement le périphérique courant au modèle confirmé ; ne jamais utiliser les identifiants navigateur comme clés publiques du catalogue.

#### Une mesure dépend de sa configuration

Une seule valeur par carte serait trompeuse. Chaque contribution contient :

- modèle canonique et génération de l’interface d’entrée, sortie utilisée (qui peut être différente), routage et canaux ;
- plateforme, famille/version du navigateur, fréquence effective du contexte, options de latence demandées et effectives lorsqu’exposées, traitements d’entrée activés ;
- pilote et taille de buffer uniquement s’ils sont connus et déclarés, sinon « inconnus » : ne pas les déduire du navigateur ;
- version du protocole et de l’application, date, nombre de probes, médiane, dispersion et confiance ;
- RTL mesuré **et** correction appliquée, chacun en frames et ms, avec fréquence et `compensationKind` explicitant le point d’horodatage. Ne pas mélanger retard d’entrée, aller-retour et retard du preset.

Les valeurs Web Audio de latence ne constituent pas à elles seules une identification ou une calibration matérielle : voir [Web Audio — latency](https://webaudio.github.io/web-audio-api/#latency). Le protocole physique décrit plus haut reste nécessaire pour qualifier l’alignement.

#### Réutilisation et confidentialité

Dans l’assistant, permettre de choisir son interface dans un catalogue avec alias, génération et option « autre / modèle inconnu ». Présenter une **estimation communautaire compatible** : médiane, dispersion, nombre de contributeurs distincts, date et configuration. Une mesure personnelle valide prévaut ; sinon l’utilisateur peut appliquer explicitement cette estimation ou faire une calibration. Afficher « estimation communautaire », sans promettre un alignement à l’échantillon. Un changement d’entrée, sortie, fréquence ou routage invalide/requalifie le profil. Exclure des agrégats les configurations incompatibles et les protocoles de compensation différents.

Ne publier ni audio de calibration, ni libellé matériel brut, ni deviceId/groupId, numéro de série ou identité personnelle. Le libellé peut contenir des informations privées : l’analyser localement puis envoyer uniquement les champs autorisés confirmés. Contribution facultative, liée au compte côté serveur, modifiable/supprimable par son auteur ; seules les statistiques agrégées sont publiques. Limiter les contributions répétées par utilisateur/configuration, distinguer répétitions de probes et contributeurs indépendants, modérer les alias et valeurs aberrantes. Une contribution ne devient pas « vérifiée » par son simple envoi.

Préparer côté Rails un catalogue `AudioInterfaceModel`, des `LatencyContribution` et agrégats recalculables (noms indicatifs), recherche publique et consultation filtrée, création authentifiée avec CSRF, modification/suppression limitée à l’auteur. Valider unités, bornes et protocole côté serveur, limiter le débit et les champs acceptés. Aucun de ces endpoints n’est implémenté ici.

```mermaid
flowchart LR
  A[Mesure loopback fiable] --> B[Profil personnel local]
  B --> C{Contribution volontaire ?}
  C -->|Oui| D[Confirmer modèle et configuration]
  D --> E[Validation et agrégation Rails]
  E --> F[Catalogue de profils compatibles]
  F --> G[Estimation choisie par un autre utilisateur]
  G --> A
```

Tests à prévoir : permissions refusées/libellés absents, entrée réelle différente du périphérique par défaut, alias et générations ambiguës, identifiants renouvelés, unités et protocole de compensation, filtrage des configurations, priorité du profil personnel, valeurs aberrantes et faux doublons, retrait d’une contribution et recalcul, contrôle d’accès, absence d’identifiants privés dans les payloads et agrégats. Valider ensuite sur plusieurs interfaces physiques ; aucun résultat matériel n’est revendiqué à ce stade.

## Undo / Redo et rétention des prises

Voir [UNDO_REDO_SPECIFICATION.md](UNDO_REDO_SPECIFICATION.md). Le mécanisme de session Studio est implémenté : 30 commandes au maximum, dont deux opérations audio. Le raccordement de la prise et les limites de récupération côté serveur restent à implémenter. Le remplacement confirmé d’une prise formera une commande unique après publication réussie : ancienne/nouvelle DI, snapshots et placement. Undo restaure une version déjà compensée sans appliquer une seconde correction ; Redo ne relance pas la capture. Ne pas garder toutes les anciennes prises ni supprimer leur audio tant qu’une référence courante ou une récupération valide en dépend. Les limites sont proposées, pas encore confirmées par l’utilisateur.

## Persistance Rails et preset

Modèle futur : audio DI sans perte, snapshot immuable du preset de la prise, métadonnées de session. Le snapshot doit inclure ordre/état des WAM, paramètres, versions et identifiants des ressources NAM/IR, plus les ressources privées ou leurs références persistantes avec droits d’accès. Une simple clé vers un preset modifiable ne suffit pas. Changer le son après prise crée/met à jour l’état de lecture de la piste sans réécrire la DI ni perdre la provenance de capture.

Champs proposés à préciser lors de l’implémentation : `recordingId`, `version`, `sampleRate`, `channels`, `frames`, `startProjectFrame`, `compensationFrames`, `calibrationProfileId`, `measuredRoundTripFrames`, `presetSnapshot`, `capturePresetSnapshot`, checksum DI et état de publication. Le snapshot de capture est immuable ; le snapshot utilisé pour la lecture peut évoluer. Éviter d’exposer les IDs matériels dans les projets partagés.

Une piste = un fichier audio plein démarrant au zéro du projet ; le padding matérialise un départ plus tardif. Le remplacement remplace **toute** la prise précédente, même si la nouvelle est plus courte : pas de conservation implicite de la fin ancienne. Le délai du snapshot peut évoluer sans devenir une région.

API future de publication en staging avec token idempotent : upload et validation de la DI + snapshot, puis publication atomique avec version attendue de piste. L’ancien blob n’est purgé qu’après publication réussie et politique de rétention ; conflit multi-onglets = demande explicite, jamais écrasement silencieux. Un cancel/erreur conserve l’ancienne prise. Droits propriétaire, CSRF, validation formats/durées/quota, nettoyage du staging et restrictions de partage comme les pistes actuelles. L’upload commence après la capture, indépendamment du rafraîchissement de la waveform.

Le MP3 reste pertinent pour **Use mix in Tone**, pas pour la DI d’édition : délai d’encodeur et pertes exigeraient une qualification supplémentaire. Le premier enregistrement sauvegardera un WAV sans perte. L’export du mix traité par les presets devra être qualifié avant d’être activé : le code actuel refuse justement un export DI qui prétendrait contenir un rendu WAM.

## États et interactions

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Monitoring: Monitor + entrée et preset prêts
  Monitoring --> Armed: Arm
  Armed --> Recording: Record / confirmation remplacement / frame planifié
  Recording --> Finalizing: StopAck / dernier frame
  Finalizing --> LocalTake: drainage + compensation + encodage
  LocalTake --> Uploading: Save project
  Uploading --> Saved: publication atomique
  Uploading --> LocalTake: échec / retry
  Armed --> Monitoring: Disarm
  Monitoring --> Idle: Monitor off
  Recording --> Failed: overflow / périphérique perdu
  Failed --> Idle: conserver ancienne prise
```

Monitor peut rester actif après Stop, sans laisser le recorder écrire. Arm n’est pas persisté comme une autorisation de rouvrir le micro au rechargement. Le navigateur demande l’accès uniquement suite à une action utilisateur. Quitter Studio arrête/libère les ressources de capture selon la route de monitoring choisie ; aucun accès micro fantôme.

## Tâches incrémentales à venir

| Étape | Livraison | Validation avant essai utilisateur |
|---|---|---|
| R1 | Modèle DI + snapshot, piste personnelle et remplacement confirmé | snapshot indépendant de Tone, ressources privées, autorisations et publication atomique |
| R2 | Monitoring avant armement, sélection entrée/preset, transfert vers Tone | absence de doublage et de recapture du mix ; écoute du preset courant non sauvegardé |
| R3 | Capture WAM/ring buffer/worker, waveform incrémentale et StopAck | ordre, conservation exacte du PCM, débordement visible, fermeture propre |
| R4 | Transport commun, calibration loopback et compensation | alignement synthétique puis matériel, unités et dérive longue |
| R4b | Catalogue matériel, contribution volontaire et profils communautaires | permissions, confidentialité, compatibilité des configurations, agrégats et validation sur interfaces réelles |
| R5 | Sauvegarde/reprise, remplacement et lecture avec autre son | échec réseau/quota, ancien audio conservé, rechargement et partage |
| R6 | Qualification de performance et export traité vers Tone | plusieurs accompagnements, rack NAM, UI fluide, rendu preset réellement présent |

Chaque étape nécessite ses tests automatisés avant de demander un essai. Les tests de calibration matérielle complètent les tests unitaires ; ils ne peuvent pas être remplacés par des mocks de `outputLatency`.

## Plan de tests et critères d’acceptation

- Unités : conversion ms↔frames, arrondis à 44,1/48/96 kHz, compensation traversant plusieurs chunks, départ zéro/non-zéro, fins exactes et aucune double compensation.
- PCM : mono/stéréo et ordre des canaux, durée égale aux frames acquittés, ring wrap, fin partielle, Stop avant premier bloc, suites de prises sans reliquat, overflow provoqué.
- Horloge : retard synthétique connu corrigé à ±1 frame ; produire des probes en début/milieu/fin. Une tâche UI artificiellement longue ne modifie pas le placement audio.
- Matériel : boucle filaire avec signaux connus, au moins cinq mesures par configuration, médiane/dispersion et résidu publiés. Objectif initial résidu ≤2 ms sur matériel validé, sans le confondre avec une garantie universelle à l’échantillon. Répéter sur prise de dix minutes pour mesurer la dérive ; si elle est significative, ne pas masquer le problème par une correction fixe.
- Son : DI identique indépendamment du preset de monitoring ; changer le preset change la lecture, jamais la DI. Aucun doubling, larsen logiciel, backing ou effets imprimés dans la capture.
- UI : monitor avant arm, Record réellement désactivé pendant préparation, confirmation remplaçable/annulable, waveform append-only, boutons clavier accessibles, erreur audio lisible, aucune publication d’une session périmée.
- Serveur : propriétaire/partage/CSRF, formats et quotas, retries idempotents, conflits de version, maintien de l’ancien blob pendant échec/cancel, réouverture du même projet/preset.
- Performance : long backing + rack de guitare + waveform ; journaliser frames perdus, mémoire, temps de finalisation et longs blocages UI. La queue n’est pas une solution aux DSP trop coûteux : surveiller aussi les underruns de rendu et la charge des WAM.

Aucun enregistrement ni résultat de calibration matérielle n’est revendiqué par ce document. Cette livraison implémente uniquement le retrait confirmé/restaurable des pistes ; les étapes R1–R6 restent à faire.
