# Import d’un morceau depuis YouTube — proposition d’intégration

25 octobre2026 · branche multitracks · **prototype local implémenté et testé ; mode d’emploi en fin de document**.

## Objectif et parcours

Dans Multitracks, proposer «Importer depuis YouTube» à côté de l’import de fichier. Coller l’URL d’une seule vidéo, récupérer sa piste audio, puis l’utiliser avec le même lecteur et le même bouton Separate que pour un fichier local. La séparation reste locale CPU/WASM/WebGPU ; le service d’import ne devient pas un service d’inférence.

```mermaid
flowchart LR
 U[URL YouTube] --> J[Service local ou backend : tâche d’import]
 J --> M[Métadonnées : titre, durée, format]
 M --> A[Récupération de la piste audio]
 A --> B[Blob ou fichier audio reçu dans le navigateur]
 B --> D[Décodage et validation audio]
 D --> P[loadFile : lecteur original prêt]
 P --> S[Separate : modèle choisi et options existantes]
 S --> T[Lecteur multipiste]
```

L’import et la séparation sont deux opérations distinctes, avec progression et annulation propres. À terme, l’URL d’origine sera conservée dans les métadonnées du projet, sans exiger de télécharger à nouveau un projet audio déjà enregistré.

## Faisabilité et dépendances

Le lecteur embarqué officiel YouTube permet la lecture vidéo, pas un export PCM/audio utilisable par notre séparateur. L’API YouTube ne constitue pas une API de téléchargement de pistes audio et les politiques officielles restreignent expressément ces usages. Une simple URL watch/youtu.be n’est pas une URL de fichier audio directement décodable par Web Audio.

Pour un prototype technique d’import de contenus autorisés, privilégier un service exécuté sur l’ordinateur de l’utilisateur, intégré au serveur de développement ou à un compagnon local. Il pourra utiliser **yt-dlp**, avec **ffmpeg/ffprobe** selon les formats et traitements nécessaires. Le projet yt-dlp recommande également un runtime JavaScript et son support EJS pour sa prise en charge actuelle de YouTube. Les versions seront figées et rapportées lors des essais, sans modification du runtime de séparation.

Une distribution statique seule ne peut pas lancer yt-dlp sur le serveur : import YouTube optionnel, disponible seulement si un service configuré répond. Le chargement de fichiers locaux et la séparation restent utilisables sans lui. Un backend hébergé pourra ultérieurement exposer le même contrat ; pas de dépendance à un service public de conversion tiers.

Sources vérifiées le24/10/2026 : [documentation officielle yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/README.md), [politiques YouTube API](https://developers.google.com/youtube/terms/developer-policies), [conditions YouTube](https://www.youtube.com/static?template=terms). Les droits sur le morceau et les autorisations prévues par la plateforme sont distincts ; posséder une URL ou voir une vidéo publique ne les établit pas. Ne pas présenter une case déclarative dans notre UI comme une autorisation juridique suffisante.

## Découpage incrémental

### P4.13a — [DONE, étude documentaire] Contrat et faisabilité

Architecture ci-dessus, service optionnel et réutilisation du chemin existant `loadFile(file)` de `examples/wam/source-separation/main.js`. Aucun accès à une vidéo ni essai d’extraction n’a été réalisé pour cette étude. Aucune garantie de disponibilité de toutes les vidéos : changements YouTube, formats et restrictions réseau peuvent faire échouer un import.

### P4.13b — [TODO, prochaine implémentation proposée] Prototype d’import local

- Accepter les URL watch/youtu.be/shorts d’une seule vidéo, en extraire un identifiant valide puis construire une URL canonique. Ignorer la playlist comme source de téléchargement multiple.
- Détecter explicitement la disponibilité du service et de ses dépendances. Indiquer «service local requis» si absent ; ne pas laisser un bouton qui semble fonctionner alors qu’aucun service n’est configuré.
- Tâche asynchrone avec états `inspecting`, `downloading`, `converting` si nécessaire, `ready`, `error`, `cancelled`. Progression liée aux octets/étapes réels ; indéterminée si la taille n’est pas connue, jamais de faux pourcentage.
- Récupérer une piste audio seule, en conservant AAC/M4A ou Opus/WebM natif lorsque le navigateur peut le décoder. Éviter une conversion MP3 supplémentaire avant séparation. Une conversion de compatibilité doit être explicite, identifiée et testée ; elle ne doit pas être décrite comme améliorant la qualité.
- Première version : vidéos accessibles sans connexion, une vidéo à la fois ; pas de cookies extraits du navigateur, de comptes, de playlists, de lives ou de gestion de contenus protégés.
- Limites configurables de durée, taille, concurrence et durée de vie des fichiers temporaires. Annuler arrête le sous-processus, nettoie les données partielles et empêche une réponse tardive de remplacer le morceau sélectionné.
- Service lié au loopback pour le prototype. Validation des URL et séparation des arguments de processus, sans shell ni acceptation de chemins/arguments arbitraires. Un hébergement public demandera en plus ses propres contrôles d’accès et quotas.

### P4.13c — [TODO] Intégration Multitracks

- Champ URL dans un petit panneau «Importer depuis YouTube» : titre/durée, états, progression et Annuler. Ne pas encombrer le lecteur avec les options techniques de l’extracteur.
- Réception d’un Blob/File audio et appel au flux existant `loadFile(file)`, plutôt qu’une seconde implémentation du lecteur ou du décodage.
- Conserver URL canonique, identifiant vidéo, titre/auteur si disponibles, date d’import, format/codec, hash du fichier et éventuelle conversion ; ces métadonnées ne remplacent pas un justificatif des droits.
- Séparer reste désactivé pendant le transfert et le décodage. Il devient disponible seulement quand l’entrée audio est prête et que le modèle choisi est disponible. L’import n’entraîne ni changement spontané de modèle ni séparation automatique.
- Préserver le morceau courant tant que l’import n’a pas réussi. Une erreur ou une annulation ne le remplace pas par un résultat incomplet. Les fichiers temporaires du service restent distincts des projets explicitement enregistrés.

### P4.13d — [TODO] Tests et validation avant essai utilisateur

Tests unitaires : URL autorisées/interdites, identifiant vidéo, playlist non parcourue, arguments de processus, métadonnées/tailles, états/progression, échecs réseau, durée limite, annulation et réponses tardives, nettoyage, service absent, intégration Blob/File et activation réelle des commandes.

Tests d’intégration avec un faux extracteur contrôlé et un fichier audio dont on possède les droits. Puis essai réel sur une vidéo explicitement autorisée, en enregistrant versions, URL/id, date, codec, taille, hash, durée, décodage et résultat. Une extraction échouée est documentée comme telle ; pas de contournement silencieux ni de réussite simulée. Vérifier ensuite séparation/lecture/export sur le fichier réellement importé, suite complète et dist avant de proposer l’essai.

## Contrat de service proposé

- `GET /api/media-imports/capabilities` : disponibilité et versions ; détection à l’ouverture du panneau, pas de polling permanent.
- `POST /api/media-imports` : URL canonique et options limitées ; retourne un identifiant opaque de tâche.
- Événements de progression (SSE ou équivalent), avec état terminal explicite. Pas de vérification répétée de modèles déjà préparés.
- `GET /api/media-imports/:id/audio` : audio final seulement ; aucun chemin serveur exposé.
- `DELETE /api/media-imports/:id` : annulation/libération ; nettoyage automatique après échéance.

Ce contrat est une proposition à implémenter et tester, pas une API actuellement disponible.

## Place dans l’évaluation scientifique

Une chanson YouTube sans stems originaux peut servir aux essais de workflow, performances et écoute exploratoire. **Elle ne permet pas de calculer un SI-SDR de séparation avec vérité terrain**. Ne pas traiter Other comme une référence guitare et ne pas attribuer de notes humaines à un test automatique.

Les flux sont généralement compressés ; codec, génération de transcodage connue et éventuelles transformations doivent accompagner les mesures. L’absence d’exposition à l’entraînement n’est pas établie par une URL YouTube. Toute campagne utilisant cette entrée devra être ajoutée à MODEL_EVALUATIONS.MD avec ses limites et son rapport brut.

## Implémentation et validation — 25 octobre 2026

**P4.13a/b/c/d : prototype local implémenté et validé.** Le texte de proposition ci-dessus décrit les objectifs initiaux ; les détails effectifs suivent.

Installation (une fois) :

```sh
./tools/setup-youtube-import.sh
```

Démarrage :

```sh
PORT=8767 ./tools/start-youtube-host.sh
```

Ouvrir `http://127.0.0.1:8767/rack/`, onglet **Multitracks**, puis **Importer depuis YouTube** dans la colonne des morceaux. L’environnement isolé `tools/.youtube-runtime` contient yt-dlp **2026.10.21**, EJS **0.8.0** ; aucun cookie ni compte navigateur n’est utilisé. Python >=3.10 et Node >=22 sont nécessaires. Les scripts acceptent `PYTHON` et le service `YT_DLP_PATH` (chemin absolu). Un Node/Python embarqué Codex sert de solution de secours si le runtime système est absent ou cassé.

`tools/YouTubeImportService.mjs` est branché au serveur Node existant. API `/api/media-imports` : capacités, création de tâche, événements SSE lus une seule fois, téléchargement audio, suppression. Aucun polling. Le prototype accepte uniquement le serveur loopback et son origine ; il n’expose pas un convertisseur public. Une future version backend distant nécessitera authentification, autorisations et quotas propres au déploiement. Une dist statique ou le serveur Rails actuel sans cette API affiche explicitement l’indisponibilité de l’import ; le chargement de fichiers reste utilisable.

Limites effectives : **une tâche active**, vidéo unique hors direct, **30 min**, **200 Mio** audio, délai de **180 s par processus** de métadonnées/téléchargement, au plus12 tâches conservées et expiration **15 min sans activité**. Le refus d’un direct, d’une durée/taille excessive ou d’une URL externe est explicite. Un binaire lancé sans shell, configuration utilisateur ignorée et plugins désactivés reçoit seulement une URL YouTube canonique. Annulation et arrêt propre du serveur interrompent le processus et effacent les temporaires. Une interruption brutale du système peut laisser un répertoire temporaire dans le répertoire temporaire OS ; pas de persistance applicative de ces fichiers.

`YouTubeImportClient.js` gère téléchargement, SSE, annulation, erreurs et générations périmées. Le panneau existe dans le prototype et dans la colonne de gauche du host compact. Le fichier reçu passe par `loadFile` et `OfflineAudioContext` ; titre, URL, identifiant vidéo, date, extension, taille et SHA-256 audio restent dans `source.provenance`, donc avec le projet sauvegardé. Le morceau précédent reste chargé jusqu’à la réussite du décodage. Un choix de fichier/projet ou une autre opération commencé entre-temps empêche un import tardif de remplacer le morceau. L’import ne lance pas la séparation automatiquement.

Le format audio natif accepté est M4A, WebM, Opus, Ogg, MP3 ou WAV. Pas de conversion MP3 supplémentaire. Si le navigateur ne décode pas le format reçu, l’erreur est affichée et l’ancien morceau est conservé ; la conversion automatique de compatibilité reste une extension éventuelle.

Validation :14 tests unitaires/intégration dédiés (URL, octets/progression, limites, expiration, annulation, concurrence, erreur SSE, service absent, origine étrangère). Import réel de **Big Buck Bunny**, vidéo de Blender : M4A **28 914 898 octets**, métadonnées597s, décodage observé596,5s ; cinq premières secondes séparées avec Demucs Qualité GPU en quatre pistes puis transport Play vérifié. L’ancienne vidéo de test `BaW_jenozKc` est indisponible : cet échec figure aussi au registre. Une URL invalide conserve le résultat précédent. Ce test valide le workflow, **pas la fidélité instrumentale**, et n’ajoute aucune note d’écoute humaine. Résultats : `benchmarks/youtube-import-2026-10-25.json` et MODEL_EVALUATIONS.MD.
