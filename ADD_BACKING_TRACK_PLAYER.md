# Import du lecteur de backing tracks dans NAM_A2_WAM

Date : 5 octobre 2026. Statut : **première version implémentée et validée automatiquement**. Les sections 1–10 conservent la proposition approuvée ; le bilan de livraison ci-dessous précise les résultats et limites.

## 1. Objectif et décision proposée

Importer le lecteur de `examples/other_wam_host/EndUserAmp2/host` dans notre hôte, avec sa bibliothèque, son interface de navigation, sa forme d’onde, ses boucles, son import local et son time stretching.

**Recommandation : extraire d’abord un WebComponent `<backing-track-player>` et un moteur audio indépendant, puis intégrer ce composant sous le rack.** Le lecteur est un outil d’accompagnement de l’hôte, pas un effet WAM inséré avec `+`. Son signal rejoint la sortie après les chaînes A/B.

Le composant utilise l’AudioContext existant et expose une sortie audio. Il ne crée pas de second contexte et ne choisit pas lui-même le périphérique de sortie. Son moteur sera réutilisable pour un futur lecteur multipiste, sans réécrire la bibliothèque ni l’interface entière.

Les presets du rack (phase 7.2) restent hors périmètre. L’état de transport du lecteur est indépendant des presets des WAMs.

## 2. Inventaire vérifié dans les sources

| Élément | Source | Fonction |
| --- | --- | --- |
| Lecteur et UI | `examples/other_wam_host/EndUserAmp2/host/backingTrackPlayer.js` | Classe de 910 lignes, DOM, styles, chargement, transport, waveform et mix |
| Traitement audio | `examples/other_wam_host/EndUserAmp2/host/phaze-processor.js` | AudioWorklet avec FFT embarquée et traitement overlap-add ; aucun import externe dans ce fichier |
| Catalogue | `examples/other_wam_host/EndUserAmp2/host/backingTracks/tracks.json` | Liste de 29 noms de fichiers |
| Médias | Dossier `host/backingTracks/` ci-dessus | 29 MP3 présents, environ 170,5 Mo au total |
| Intégration d’origine | `host/index.js` et `host/index.html` | Construction du lecteur et exposition de contrôles audio via `window` |

Fonctions réellement présentes :

- Liste de morceaux, sélection, indicateur de chargement, import d’un fichier local par bouton ou glisser-déposer.
- Waveform canvas, tête de lecture, temps courant/durée, sélection d’une zone A–B à la souris, boucle activable.
- Bouton lecture/arrêt. Ce n’est pas actuellement une véritable pause/reprise : `play()` redémarre au début de la zone sélectionnée.
- Vitesse de **0,70 à 1,30**, par pas de 0,01, avec Reset. La source change de vitesse et le vocodeur compense la hauteur avec `pitchFactor = 1 / playbackRate`. À 100 %, le traitement est contourné.
- Normalisation crête, manuelle ou automatique au chargement, appliquée actuellement en modifiant les échantillons du buffer.
- Pan global guitare et balance guitare/accompagnement, avec Reset.

Cette inspection est statique. La qualité sonore du stretching, les transitions et la précision des boucles n’ont pas été mesurées pour cette proposition. Le vocabulaire et les crédits du traitement existant seront conservés ; aucune qualité « studio » ou séparation instrumentale n’est revendiquée.

## 3. UI proposée

### Emplacement et présentation

Un panneau **Backing tracks** dans le workspace, immédiatement sous les chaînes A/B. Il conserve l’organisation de l’exemple :

- **Gauche : bibliothèque** défilante, titre du morceau actif, nombre de morceaux et bouton d’import local. Ajouter un champ de filtre textuel pour retrouver facilement un morceau parmi les 29.
- **Centre : waveform** avec zone A–B colorée, tête de lecture et temps courant/durée. Le glisser-déposer local reste disponible sur cette zone.
- **Sous la waveform : transport et réglages** : lecture/pause, arrêt, boucle, vitesse et Reset, normalisation avec option automatique, balance guitare/backing et pan guitare global.
- Volume/mute de la backing track accessibles, avec un petit indicateur de niveau du mix final pour repérer le clipping.

L’identité visuelle et les gestes de l’exemple sont repris, en harmonisant les couleurs et boutons avec l’hôte. La hauteur cible sur bureau reste proche des 240 px de l’exemple, sans l’imposer si les contrôles doivent revenir à la ligne. Sur petite largeur, la bibliothèque passe au-dessus de la waveform et la barre d’outils se répartit sur plusieurs lignes.

Le panneau est repliable. Le replier laisse la lecture continuer et conserve une barre compacte : morceau, lecture/pause, arrêt et volume. Il ne masque pas les contrôles d’entrée/sortie du rack.

### Comportements précisés pour la première version

- Cliquer un titre charge le morceau ; aucun démarrage automatique à l’ouverture de l’application. Si un morceau est déjà en lecture, le choix d’un autre remplace la lecture après chargement réussi.
- Lecture reprend la position courante ; pause la conserve ; arrêt revient au début de la zone A–B, ou à zéro sans boucle. À la fin sans boucle, la lecture et son indicateur s’arrêtent réellement.
- Cliquer la waveform déplace la position ; glisser définit A–B. Ajouter des champs A/B en secondes pour un réglage précis au clavier et au tactile. Les positions sont bornées à la durée ; les zones nulles sont refusées.
- Une modification de vitesse conserve la position musicale. Les limites de boucle sont exprimées en secondes du média original, pas dans une durée recalculée selon la vitesse.
- La sélection de boucle doit fonctionner dans les deux directions. Utiliser Pointer Events et capture du pointeur plutôt que des gestionnaires souris globaux.
- Si le stretching est indisponible, la lecture à 100 % reste utilisable ; afficher l’erreur et désactiver la vitesse, sans changer silencieusement la hauteur.

## 4. Routage audio proposé

```text
Entrées guitare / fichier DI → chaînes A/B → sortie du rack
                                            ↓
                                   pan guitare global
                                            ↓
                                     gain du mix guitare ──┐
                                                          ├→ bus de sortie commun → destination
Backing track → vitesse + correction de hauteur            │                         du contexte
              → normalisation → volume/mute → gain du mix ─┘
```

- Le lecteur de fichiers DI actuel reste une **source pour les effets**. Le nouveau lecteur est un **accompagnement en parallèle**, utilisable avec une guitare live ou cette source DI.
- Ne jamais brancher la backing track sur `chain.input` : distorsion, cabinets et effets de guitare ne doivent pas la traiter.
- Remplacer l’unique connexion directe `rack.output → context.destination` par le bus commun. Ne pas conserver une seconde connexion parallèle qui doublerait le son.
- Le pan guitare du lecteur est un contrôle **global après la somme A/B**, libellé « Guitar global pan ». Il ne réécrit pas les pans individuels A/B. Valeur initiale : centre.
- Le crossfader agit sur deux gains dédiés. Il ne réécrit ni les faders des chaînes, ni les gains des WAMs, ni le trim d’entrée.
- Proposition de loi : balance linéaire normalisée, `guitare = min(1, 2 × (1 − mix))`, `backing = min(1, 2 × mix)` ; centre = gains unitaires, extrêmes = une branche seule. Le volume backing reste indépendant, initialement à −12 dB pour garder de la marge avec une piste normalisée. Ne pas recopier le facteur ×1,5 arbitraire de l’exemple.
- Tant qu’aucune backing track ne joue (pause/arrêt inclus), le gain de mix guitare reste à 1 ; le crossfader reprend sa valeur lors de la lecture. Le chargement du composant seul ne modifie donc pas le niveau actuel de guitare.
- Lisser les changements de gain. Le niveau du mix commun est affiché ; aucun limiteur modifiant le son n’est ajouté implicitement.
- La sortie physique reste gérée par `OutputDeviceManager` et `AudioContext.setSinkId`. Les deux branches suivent le même périphérique. Lecture de backing track et restauration de son état n’activent jamais le microphone.
- Les changements de topologie A/B, bypass, remplacement de plugin et fermeture d’éditeur ne doivent pas arrêter la backing track.

## 5. Extraction en WebComponent

### Fichiers proposés

```text
examples/wam/backing-track-player/
  BackingTrackPlayerElement.js   # Custom element et Shadow DOM
  BackingTrackEngine.js          # Transport, buffers, boucle, vitesse et sortie
  BackingTrackLibrary.js         # Catalogue statique et fichiers temporaires
  backing-track-player.css       # Styles internes au composant
  phaze-processor.js             # Copie adaptée du worklet existant
examples/wam/assets/backingTracks/
  tracks.json                   # Catalogue portable, identifiants stables
  ...29 MP3...
```

Le moteur expose son `outputNode`. L’adaptateur dans `main.js` possède les gains du mix commun et le pan guitare global. Le composant communique les demandes de mix et de pan par événements ; il ne cherche jamais de nœud audio dans `window`.

API indicative à fixer lors de l’implémentation :

- `initialize({audioContext, library})` ; chargement du worklet mémorisé par contexte.
- `loadTrack(id)`, `loadFile(file)`, `play()`, `pause()`, `stop()`, `seek(seconds)`.
- `setLoop({enabled, startSeconds, endSeconds})`, `setRate(rate)`, `setVolumeDb(db)`.
- `getState()` / `setState(state)` pour un état JSON versionné, sans AudioBuffer ni nœuds Web Audio.
- `destroy()` idempotent pour libérer les ressources ; ne ferme jamais le contexte de l’hôte.
- Événements `track-change`, `transport-change`, `load-progress`, `mix-change`, `guitar-pan-change`, `player-error`, avec `detail` documenté et propagation hors Shadow DOM.

Shadow DOM pour isoler les sélecteurs actuels tels que `input[type=range]` et les identifiants du lecteur. Toutes les URLs de modules, styles, worklet et médias sont résolues explicitement relativement au module ou au manifeste, sans dépendre de l’URL de la page ni de `#main-area`.

## 6. Corrections nécessaires pendant l’extraction

Ne pas encapsuler la classe actuelle sans traiter les points suivants :

1. **Couplage à l’ancien hôte** : supprimer les accès à `window.outputGainNode`, `window.pluginPannerNode`, les variables globales du lecteur et l’insertion automatique dans `#main-area`.
2. **Chargements concurrents** : annuler les requêtes précédentes et vérifier un identifiant de génération après le décodage. Une ancienne sélection lente ne doit jamais remplacer la nouvelle. Conserver le morceau courant en cas d’échec.
3. **Transport** : gérer `onended`, pause/reprise, seeking, bornes et changement de vitesse. Ignorer les événements de fin des sources déjà remplacées.
4. **Worklet** : contrôler les messages/réinitialisations au changement de morceau ou de position pour éviter les queues du morceau précédent. Valider la latence et les transitions autour de 100 % ; prévoir une courte transition entre chemins si nécessaire plutôt qu’une commutation abrupte.
5. **Normalisation** : conserver le buffer original. Mesurer la crête multicanal puis appliquer un gain non destructif, réversible et sérialisable. Ne pas empiler des normalisations sur le même buffer ni bloquer longuement le thread UI ; analyse hors rendu audio.
6. **Boucles** : éviter les longueurs nulles et les modulo par zéro ; vérifier les raccords audibles, y compris avec stretching. Prévoir une courte transition de raccord si les essais révèlent des clics, sans annoncer des boucles parfaitement transparentes avant validation.
7. **Cycle de vie** : libérer buffers, sources, worklets, timers, listeners et URLs temporaires ; suspendre le dessin lorsque l’UI est masquée. Un simple déplacement du composant dans le DOM ne doit pas détruire le transport.
8. **Canvas et fichiers** : redimensionnement via ResizeObserver, adaptation au DPR, pas de calcul sur une largeur nulle ; erreurs de décodage affichées dans l’UI plutôt que simples logs ou alertes.

## 7. Bibliothèque, état et distribution

Copier les **29 MP3 et le catalogue** dans les assets du nouvel hôte, en conservant les noms et la provenance disponibles. Les sources sous `other_wam_host` restent intactes et aucune dépendance vers elles ne subsiste dans le lecteur livré.

Faire évoluer le manifeste de la liste de noms vers des objets avec `id`, `title`, `url` et métadonnées optionnelles (artiste, durée, BPM, tonalité, provenance). Ne pas inventer BPM, tonalités ou attribution absents. Les identifiants doivent rester stables si un titre affiché change ; les noms avec accents, espaces et apostrophes doivent être correctement résolus.

- Charger le manifeste au démarrage, **pas les 170,5 Mo d’audio**. Ne télécharger/décoder que le morceau choisi ; limiter le cache de buffers. Un décodage PCM peut occuper beaucoup plus que le MP3 compressé.
- Les fichiers importés localement restent temporaires dans cette première version. À la restauration, demander de sélectionner à nouveau un fichier manquant ; ne pas sérialiser un faux chemin local ou une URL blob comme référence durable.
- État JSON : version, ID du morceau, position, boucle A–B, vitesse, normalisation, volume/mute backing, balance et pan global. La restauration ne relance jamais la lecture automatiquement.
- Ajouter cet état à la sauvegarde de session/diagnostic existante dans un champ distinct de l’état du rack. Un ancien état sans lecteur demeure valide. Cela ne crée ni catalogue de presets du rack ni backend.
- Adapter `tools/build-static-dist.mjs` pour copier composant, styles, worklet, manifeste et médias. Valider un déploiement sous un sous-chemin arbitraire.
- Ajouter une commande dédiée de régénération du manifeste des backing tracks, distincte de `npm run wam-plugins`. Elle conserve les IDs et métadonnées existants, détecte ajouts/suppressions et ne suppose pas de listing HTTP du répertoire.

## 8. Étapes d’implémentation proposées

1. **Référence** : essayer le lecteur source, noter les comportements et capturer l’UI ; établir des mesures de référence du worklet.
2. **Extraction isolée** : moteur + WebComponent + petite page de démonstration, réutilisant d’abord les mêmes sons et le même algorithme.
3. **Fiabilisation** : transport, boucles, changements de vitesse, normalisation non destructive, annulations de chargement, nettoyage et erreurs.
4. **Intégration hôte** : panneau sous le rack, bus de mix commun, pan global et balance sans toucher aux contrôles A/B.
5. **Assets et état** : copie des 29 pistes, manifeste stable, commande de mise à jour, sauvegarde/restauration de session et distribution portable.
6. **Validation et documentation** : tests, écoute comparative, mise à jour de `HANDOFF.md` et du présent document avec résultats et limites.

Ne pas commencer une implémentation backend, multipiste ou ML dans cette livraison.

## 9. Critères de validation

- Les 29 références du manifeste correspondent à des fichiers présents dans la distribution ; import et chemins fonctionnent hors du dossier source.
- Lecture guitare et backing simultanée, avec une chaîne, deux chaînes indépendantes et une dérivation A → B. Les effets ne traitent jamais la backing track.
- Aucun changement de niveau guitare au montage du composant. Vérifier mix, pan global, pans A/B, mute backing et reset, sans double connexion à la destination.
- Transport, fin naturelle, pause/reprise, seek, boucles normales/inversées/très courtes ; absence de sources fantômes après changement rapide ou destruction.
- Stretching à 70/100/130 %, à 44,1/48 kHz : durée conforme au ratio, hauteur stable sur signaux connus, sorties finies, stéréo préservée. Mesurer latence et CPU ; écouter les attaques, batteries et artefacts. Fixer les tolérances à partir des mesures de référence, sans valider uniquement la présence d’un signal.
- Erreurs réseau, manifeste invalide, fichier indécodable, worklet indisponible et changements de sélection rapides correctement gérés.
- Normalisation silencieuse/stéréo/répétée ; original inchangé et réglage conservé dans l’état. Vérifier le mix pour les dépassements de crête.
- Test de deux composants isolés pour repérer collisions de DOM ou de worklet, même si l’hôte n’en affiche qu’un.
- UI bureau/étroite, clavier/tactile, lecteurs d’écran, panneau replié ; sauvegarde/restauration sans autoplay ni activation du micro.
- Tests Node pertinents, scénarios navigateur sur la distribution et écoute réelle sur interface audio avant de déclarer la parité sonore.

## 10. Préparer les évolutions futures sans les implémenter

### Bibliothèque persistante avec backend

Définir une interface de fournisseur de bibliothèque (`list`, `resolve`, puis ultérieurement `upload`, `update`, `delete`). Le premier fournisseur lit le manifeste statique ; un futur fournisseur distant renverra les mêmes identifiants et métadonnées.

Séparer métadonnées des médias, références durables des URLs de téléchargement temporaires, et état de lecture des données audio. Le choix du stockage, de l’authentification, des quotas et de l’hébergement sera fait dans une spécification dédiée. Pas de dépendance réseau obligatoire introduite maintenant.

### Sessions multipistes / stems

Prévoir qu’un morceau puisse référencer un ensemble d’assets synchronisés. La première version ne lit qu’un asset mono/stéréo. Une future session aura une horloge commune, un transport et une boucle partagés, des offsets explicites, volume/pan/mute/solo par stem.

Le moteur multipiste devra démarrer et repositionner les stems sur la même horloge audio, aligner leurs latences et leur appliquer des variations de vitesse cohérentes. Ce n’est pas un simple assemblage de lecteurs indépendants. Ne pas créer aujourd’hui une instance de vocodeur par stem par anticipation.

### Séparation d’instruments par ML

Prévoir un service asynchrone de jobs : média source → soumission → progression/annulation/erreur → assets de stems et métadonnées. Le navigateur reste client de ce service, avec identifiants de jobs et provenance du résultat ; aucune clé de service dans le lecteur.

Démarrer ultérieurement par l’envoi d’un fichier audio. Une URL YouTube devra passer par un adaptateur d’import côté serveur et un mécanisme d’accès autorisé, pas par l’hypothèse qu’une page YouTube est directement un flux MP3 lisible par Web Audio. Faisabilité, limites du fournisseur et modes d’accès restent à étudier dans cette future phase. Aucun fournisseur ni modèle ML n’est choisi ici.

### Ordre envisagé

1. Lecteur stéréo local fiable et portable (cette proposition).
2. Bibliothèque persistante et projets sauvegardés.
3. Moteur de lecture multipiste synchronisé.
4. Service de séparation alimentant cette bibliothèque et ces projets.

## 11. Livraison — 5 octobre 2026

- WebComponent, moteur, fournisseur de bibliothèque et mixeur extraits dans `examples/wam/backing-track-player/`. UI isolée par Shadow DOM et container queries ; rendu vérifié sur bureau et à 360 px.
- Les 29 MP3 sont copiés sans modification dans `examples/wam/assets/backingTracks/`. Les empreintes des sources sont consignées dans `SOURCE_MANIFEST.json`. Commande d’entretien : `npm run backing-tracks` (`-- --check` pour vérifier sans écrire).
- Le panneau sous le rack propose filtre, sélection, waveform, import/glisser-déposer, lecture/pause/arrêt, boucle A–B réglable au pointeur et au clavier, vitesse 70–130 %, normalisation réversible, volume/mute, balance, pan global et mesure du mix. Replier le panneau conserve le transport et les contrôles principaux.
- La guitare et l’accompagnement rejoignent un bus commun après le rack ; sortie physique partagée. Pas de changement des niveaux A/B. Les changements de routage n’interrompent pas le lecteur.
- Le champ `backingTrack` complète la sauvegarde de session existante ; la restauration reste silencieuse. Si un fichier local est absent, la restauration attend la resélection du même fichier (identité nom/taille/date de modification, sans fichier audio sérialisé). Pas de backend ni persistance automatique de fichiers locaux.
- Module worklet enregistré une seule fois par contexte. Pendant une variation de vitesse hors 100 %, la même instance est conservée. Changement de piste/position et passage par 100 % recréent le chemin avec une rampe courte pour éviter les anciennes queues ; la sortie du worklet peut encore présenter son transitoire de remplissage.
- **143 tests Node passent**. Page `backing-track-player/validation.html` : **60 contrôles navigateur** à 44,1 et 48 kHz, sans exception, sur la distribution. Tests de fréquences stéréo 440/660 Hz (tolérance d’analyse FFT 20 Hz), ratios de durée (tolérance 180 ms incluant polling/vidage), boucles, pause/reprise, mono, états, fichier MP3 réel, concurrence, erreurs et indépendance de deux composants.
- **9 contrôles supplémentaires dans l’hôte** : bibliothèque et filtre, absence d’autoplay, niveau guitare initial, piste réelle, vitesse, split A/B sans interruption, panneau replié et restauration de session. Résultats numériques conservés dans `VALIDATION.json`.
- Distribution `dist/NAM_A2_WAM/` reconstruite avec les médias et ressources ; aucune publication ni commit effectués pour cette livraison.

Limites mesurées/non mesurées : les validations audio sont muettes et ne remplacent pas une écoute. Pas encore de mesure CPU/latence sur interface physique ni de garantie de transparence musicale du phase vocoder hérité. Les raccords A–B utilisent les boucles natives du buffer, sans crossfade dédié entre extrémités arbitraires ; des clics peuvent rester audibles sur des coupes mal alignées. Aucun moteur ML, multipiste ou backend n’a été ajouté.

### Ajustement du 6 octobre 2026

À la demande de l’utilisateur, l’en-tête devient un bouton d’accordéon pleine largeur. Replier masque tous les contrôles, y compris la barre de transport, et laisse uniquement l’en-tête ; le transport audio continue. Ce comportement remplace le mode compact décrit initialement.
