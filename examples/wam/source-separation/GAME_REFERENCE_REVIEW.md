# Qualification et préparation d’écoute GHA

25 octobre2026. Six fenêtres fixées, trois compositions, fichiers locaux uniquement. Le contenu exact des stems est **inconnu de l’utilisateur**, confirmé pendant cette session. Il reste donc à qualifier à l’écoute. Aucun nom de fichier, tag master ou score neuronal ne le certifie.

## 1. Écouter les références

Ouvrir [le lecteur local](http://127.0.0.1:8765/examples/wam/source-separation/game-reference-review.html). Sélectionner un extrait puis Charger. Comparer Guitare assignée, Rhythm, Backing et Mix construit. Un volume commun et une position conservée facilitent les changements. Toutes les empreintes sont vérifiées avant écoute. Les autres morceaux de la collection ne sont pas chargés.

Noter si guitar.ogg contient uniquement des guitares, toutes les guitares de cette fenêtre, si rhythm est une basse, si le backing contient d’autres guitares et si les sources sont musicalement synchronisées. « Incertain » est une vraie réponse, sans résultat implicite. Enregistrer avec pseudonyme et chaîne d’écoute puis exporter le JSON. Les observations restent locales ; leur lecture attentive ne peut pas être prouvée par un événement Play. Une qualification par un auditeur n’établit pas l’indépendance de l’entraînement ou une vérité studio auditée.

## 2. Comparer SW et Demucs

Le bouton Préparer la comparaison charge la même paire référence/backing dans le banc existant, sans lancer l’inférence. SW6 et Demucs6 sont présélectionnés ; cliquer Comparer, puis Commencer la revue en aveugle. Comparer instrument et backing aux références explicite et cachée, à volume commun. Aucun gain par candidat. Notes non préremplies, révélation après saisie complète. Ce n’est pas un protocole MUSHRA/ABX standardisé ; les personnes ayant vu les sorties ne sont pas considérées naïves.

Les estimations restent en RAM dans cet onglet : ne pas le recharger avant l’écoute. Une nouvelle fenêtre requiert un nouveau calcul ; aucun cache persistant d’audio n’a été ajouté au host. La préparation peut appliquer un nouveau gain commun de protection ; celui-ci et les empreintes PCM sont consignés, sans prétendre à une normalisation par modèle.

## 3. Préparer la comparaison UVR

```sh
python3 tools/prepare-uvr-review-inputs.py
```

Entrées créées dans `test-data/source-separation/uvr-review/inputs/`, nommées `gha-1-20.wav` à `gha-3-90.wav`. Copies **identiques octet pour octet** des mix G1 ; les noms distincts évitent que des exports tous nommés mix se remplacent. Manifeste avec cas, offsets et SHA. Aucun audio dans Git/dist.

Importer ces six WAV dans UVR. Utiliser d’abord Demucs v4 **htdemucs_6s**, toutes les sources, sortie WAV sans compression ; conserver44100Hz et stéréo. Ne pas normaliser indépendamment les sources, ne pas étirer/recaler. Consigner version UVR, checkpoint exact, device réel, précision, segment, overlap, shifts, éventuel ensemble et paramètres de sauvegarde. Ne pas supposer que « Default » égale les raccords de notre Worker. Conserver les logs et sorties originales sous un dossier de configuration distinct. Pour htdemucs_ft quatre sources, **Autres n’est pas assimilé automatiquement à guitar.ogg**.

Pour SW, utiliser le checkpoint d’origine réellement correspondant au modèle du navigateur seulement s’il est disponible dans l’installation UVR ; vérifier son identité et sa précision. Un autre SW/Roformer est une autre configuration, jamais une parité du même modèle par simple nom. Les scores/comparaisons à publier attendent ces sorties et leurs paramètres. Une comparaison UVR d’un morceau complet et celle d’une fenêtre isolée de6s n’ont pas le même contexte : les distinguer.

État actuel : entrées UVR préparées et hachées ; **aucune inférence UVR exécutée**, aucun jugement humain collecté. Import des sorties UVR dans la revue aveugle reste à connecter après leur production et vérification. Les captures/contrôles logiciels du lecteur ne valent pas une écoute scientifique.
