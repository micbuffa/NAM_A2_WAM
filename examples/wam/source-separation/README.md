# Laboratoire de séparation

`npm start`, puis <http://127.0.0.1:8765/examples/wam/source-separation/>.
Distribution : `dist/NAM_A2_WAM/source-separation/` après `npm run dist`.

Ne pas ouvrir `index.html` directement avec `file://` : les modules et le catalogue nécessitent HTTP(S). Dans ce cas, la page affiche un lien vers l’URL du serveur local au lieu de proposer des commandes inutilisables. Sous HTTP, une aide sous « Séparer l’extrait » indique si le catalogue charge encore, si le modèle doit être téléchargé ou si un fichier audio manque. Les modèles en cache sont propres à l’adresse et au port utilisés (`localhost` et `127.0.0.1` ont des caches distincts).

## Original → instruments (P2)

Importer un fichier ou choisir un exemple prépare maintenant **le morceau original complet**, immédiatement écoutable avec Play, sans devoir télécharger un modèle. La lecture ne démarre pas toute seule. Si le navigateur suspend l’audio, utiliser « Activer la lecture audio ».

Depuis le lecteur, cliquer **Separate instruments** après avoir choisi/installé le modèle. L’original reste écoutable pendant le calcul ; sa séparation a une progression et un bouton d’annulation dans le lecteur. Le candidat partage le même AudioContext mais sa sortie reste déconnectée jusqu’à la bascule : aucune addition original + stems.

Quand la zone calculée couvre la position courante, le lecteur passe aux instruments en gardant position, lecture/pause, boucle, zoom et gain de sortie. Volume, pan et mute de l’original sont appliqués aux stems lors de cette première bascule ; les éditions ultérieures des stems sont conservées. Si le mixeur a le focus, la bascule automatique attend pour préserver l’interaction. « Écouter les instruments » reste disponible explicitement. L’audio reprend avec la latence planifiée existante de 30 ms ; ce n’est pas une transition sans interruption à l’échantillon près.

Le prototype sépare toujours **le début du morceau**, selon la durée choisie. Il affiche distinctement durée originale et extrait séparé. Si la position est après cet extrait, l’original reste en place : cliquer « Écouter l’extrait séparé depuis le début » pour choisir ce retour au début. « Écouter l’original complet » revient à l’original et empêche une nouvelle bascule automatique à l’arrivée des blocs suivants. Les pistes déjà calculées restent accessibles.

Échec ou annulation : l’original reste ou redevient actif avec son état de lecture courant ; les stems partiels prêts peuvent être sélectionnés explicitement. Un nouvel import remplace la session sans lecture automatique ; un décodage invalide ne détruit pas l’original précédent. Le bouton du lecteur reste désactivé avec une aide lorsque le modèle manque. La balance globale guitare/backing, les boucles A/B et la normalisation sont disponibles ; P4.4 les intègre aussi dans Tracks sur la branche multitracks.

## Essayer une séparation réelle

1. Choisir `htdemucs_6s` (guitare dédiée, CPU), `htdemucs_ft` (CPU, guitare généralement dans « Autres »), ou **4 pistes ONNX · GPU expérimental** (guitare dans « Autres »).
2. Cliquer **Télécharger le modèle** dans le panneau juste sous les sélecteurs (ou dans le gestionnaire) : environ 38,7 Mio pour 6s, 207,8 Mio pour les quatre spécialistes FT, 166,2 Mio pour ONNX. Une barre et le pourcentage suivent le transfert ; la vérification SHA-256 et l’enregistrement sont indiqués séparément. Les deux emplacements partagent la même tâche. Les téléchargements sont uniquement déclenchés par l’utilisateur.
3. Choisir un fichier audio local (32 Mio maximum), ou **Utiliser CleanChords.mp3** pour l’exemple guitare fourni, ou **Utiliser un mix multi-instruments (10 s)** pour un extrait stéréo musical fourni avec ses crédits. Durées : 1, 5 ou 10 secondes ; **30 et 60 secondes** avec 6s en mode progressif ou ONNX. Le début du fichier est traité à 44,1 kHz. Un fichier mono est dupliqué en stéréo ; seuls les deux premiers canaux d’un fichier multicanal sont utilisés.
4. Cliquer **Séparer l’extrait**. Le calcul est local, dans un Worker avec le backend choisi. **Annuler la séparation** termine le Worker.
5. Lire les stems synchronisés, utiliser mute/solo, volume et pan. Position permet de se déplacer dans l’extrait. Les bornes A/B permettent de boucler une partie de l’extrait une fois le calcul terminé. Avant cela, le lecteur attend les blocs manquants. Les formes d’onde représentent les stems réels ; zoom et défilement sont synchronisés.

**Load demo stems** crée un exemple synthétique sans IA. **Utiliser le signal de test (1 s)** prépare un signal 220 Hz à soumettre au vrai modèle. Ces commandes ont des rôles différents.

Le runtime est fourni localement et figé. Les poids sont téléchargés depuis GitHub puis conservés en IndexedDB avec vérification SHA-256. Les tailles, hashes et URL de révision sont dans `models.json`. Les poids ne sont pas copiés dans la dist. Pour un déploiement sans GitHub, héberger ces mêmes fichiers puis adapter le manifeste et l’origine autorisée.

## Essayer WebGPU

1. Choisir **Demucs v4 · 4 pistes ONNX · GPU expérimental**. Le backend GPU est sélectionné si un device est disponible ; il reste désactivé pour les anciens poids ORT de 6s/FT.
2. Télécharger ces poids séparés (166,2 Mio). La révision, le SHA-256 et la taille sont épinglés dans `models.json`. Les poids de ce fournisseur sont indiqués **usage personnel/recherche** ; voir [sa licence](vendor/demucs-js/LICENSE.md). Le code et le runtime sont sous MIT. Ce modèle n’est pas FT et n’a pas de sortie guitare dédiée.
3. Charger un fichier ou CleanChords, choisir 30 s et séparer. Les fenêtres ONNX font 7,8 s, avec recouvrement de 1,95 s ; le premier bloc publié fait 5,85 s. Le même lecteur progressif reste disponible pendant le calcul.
4. La case de repli autorise un nouvel essai CPU avec les mêmes poids si le GPU échoue **avant tout audio publié**. Le motif et le backend effectif restent affichés. Après publication d’un bloc, un échec arrête le traitement et conserve l’extrait prêt ; il ne mélange pas deux backends. Annuler ne déclenche jamais un repli. Le sélecteur permet aussi un essai CPU direct.

Le pipeline est hybride : réseau neuronal sur WebGPU, FFT/reconstruction en JavaScript, certains opérateurs éventuellement sur CPU. ONNX Runtime Web est livré localement en **1.22.0** ; le CPU fonctionne en un thread sans imposer COOP/COEP au host. Une échéance de 120 s sans événement de calcul arrête le Worker ; aucune interrogation périodique de disponibilité n’est ajoutée.

Le lien **Diagnostic WebGPU** ouvre [la comparaison reproductible](webgpu-benchmark.html) des mêmes poids sur GPU et CPU. Le choix par défaut est un vrai mix stéréo de 10,88 s : *Slow Motion Dream*, Steven M Bryant et collaborateurs, CC BY 3.0 ([crédits](fixtures/music/NOTICE.md)). CleanChords reste disponible comme diagnostic guitare seule. Le test nécessite le modèle en cache sur la même origine ; aucun poids supplémentaire n’est téléchargé. Le JSON contient temps, profilage GPU, écarts sur les huit canaux, énergie et différence stéréo des pistes, et résidu de leur somme face au mix d’origine.

[Mesure sur le mix dans Chrome](benchmarks/webgpu-real-mix-chrome-2026-10-20.json) : GPU 15,85 s / CPU 71,45 s pour 10,88 s d’audio ; écart RMS relatif 0,077 %, maximum absolu 0,00127. Le GPU est plus rapide mais ne suit pas le temps réel dans cet essai. Les [mesures précédentes sur CleanChords](benchmarks/webgpu-2026-10-20.json) étaient plus rapides ; le débit dépend de l’environnement. Sans pistes isolées de référence, ces tests ne constituent pas une comparaison de qualité avec UVR. Les essais 6s GPU ne produisent pas encore de PCM validé : voir [la recherche](benchmarks/6s-compatibility-2026-10-20.json).

La première étape du lecteur compact est livrée : **WaveSurfer 7.12.4 utilisé uniquement pour dessiner**, fichiers locaux et licence BSD-3-Clause dans `vendor/wavesurfer/`. Les pistes font 56 px sur ordinateur (88 px en disposition étroite), avec couleur par instrument, boutons M/S, volume/pan et valeurs. Une seule règle et un seul défilement servent toutes les pistes ; zoom commun et reset. Les peaks intègrent les deux canaux sans recopier tout le PCM ni normaliser le son. Aucun lecteur, décodeur ou AudioContext WaveSurfer n’est créé.

Cliquer une waveform pour se déplacer ; une waveform focalisée accepte ←/→ (une seconde) et Home/End (début/limite disponible). Le viewport partagé focalisé accepte ←/→ pour défiler horizontalement et Home/End pour atteindre ses extrémités. Les contrôles et le focus sont conservés à l’arrivée des blocs. Le gestionnaire des modèles est repliable sous le lecteur. L’ancien moteur audio conserve transport, synchronisation, boucle, gain et pan.

Le parcours original → instruments (P2) et la vue mix réduit (P3) sont livrés dans ce prototype. La parité host complète/intégration Tracks (P4) reste à implémenter, selon la spécification § 6.1.

## Réduire au mix (P3)

Depuis les instruments (ou la démo synthétique), cliquer **Réduire au mix** : les lignes sont remplacées visuellement par une seule waveform **Mix courant**. **Afficher les instruments** retrouve les mêmes réglages. Aucun redémarrage, nouvelle source, nouveau contexte ou changement de route audio : c’est une réduction d’affichage. La lecture, la pause, le zoom, le défilement, la boucle et le seek restent ceux du moteur actif. Le mode est conservé si l’on écoute l’original puis revient aux pistes séparées.

La waveform est extraite de la **somme des échantillons audio**, après volume, panoramique stéréo, mute/solo de chaque stem et gain de sortie commun (actuellement 0,7). Des signaux opposés peuvent donc s’annuler ; additionner leurs enveloppes visuelles donnerait un résultat faux. Les deux canaux sont pris en compte, selon les [matrices StereoPannerNode du W3C, § 6.3.3](https://www.w3.org/TR/webaudio/). Le calcul décrit les réglages stabilisés ; il ne simule pas les brèves rampes de gain de 10 ms lors d’une édition. Il n’effectue aucune normalisation automatique et ne modifie pas le PCM. Le pic est indiqué en dBFS ; un pic positif peut nécessiter de baisser le mix. La normalisation et les contrôles du bus global sont prévus en P4.

Les recalculs rendent régulièrement la main à l’interface et sont annulés lorsqu’un résultat devient périmé. Seuls des tableaux de peaks sont alloués ; aucune copie du morceau complet ni fichier remixé n’est créée. Pendant une séparation progressive, la forme d’onde se remplit à l’arrivée des blocs, sur la même durée totale. La zone future reste vide et le seek reste borné à l’audio disponible. Les instruments masqués gardent leurs commandes ; réafficher puis modifier le mix et réduire relance le calcul correspondant.

## Mix global guitare / backing (P4.1)

Le panneau **Mix guitare / backing** règle le volume global du backing (−60 à +6 dB), son mute, la balance entre guitare et backing et le pan global de la guitare. Le mute ne change pas le transport ni les volumes des instruments. Le réglage backing à 0 dB conserve la marge interne du prototype (gain 0,7). La vue réduite inclut ces réglages pour le backing ; elle n’intègre pas la guitare live dans sa waveform.

Le mixeur réutilise `BackingTrackMix`, celui du host après le rack : au centre les deux bus sont à gain unitaire ; en pause du backing, la guitare retrouve son niveau normal. La mesure de sortie porte sur les deux bus et les deux canaux ; l’indication de saturation reste visible une seconde après un pic détecté. La normalisation automatique n’est pas encore implémentée.

Pour écouter la balance dans le laboratoire, ouvrir **Guitare de test pour essayer la balance**, charger CleanChords, puis utiliser **Jouer la guitare**. La lecture est indépendante de celle du backing, avec le même AudioContext. **Stop guitare** arrête ce signal. Aucune capture micro n’est ouverte. Cette guitare de test est un fichier sec ; dans le host, cette entrée reçoit la sortie traitée du rack. P4.4 intègre ce routage dans Tracks avec la restauration d’état.

`SeparationMixer(context,{guitarSource:rack.output})` expose `backingInput` pour les sorties original/stems et conserve les réglages globaux via `getState()` / `update()`. Le workflow accepte cette entrée par l’option `destination`. Le prototype a maintenant une seule destination finale, possédée par le mixeur du host réutilisé. Le module ne crée aucun nouveau contexte.

## Point sur le modèle six stems

Une variante de diagnostic termine maintenant sur GPU grâce au remplacement de l’inverse STFT ONNX par une reconstruction JS. Sur un vrai mix, elle garde toutefois **7,317 % d’écart RMS** face au CPU : elle n’est pas activée dans le catalogue. Le 6s existant reste disponible en CPU/WASM. Voir [SIX_STEMS_GPU.md](SIX_STEMS_GPU.md) pour les résultats synthétiques/réels, l’outil d’extraction reproductible et la suite du diagnostic.

## Limites

La séparation affiche maintenant une barre et un pourcentage par étapes (cache, chargement, segments calculés, préparation audio). Les callbacks WASM ne sont émis qu’à la fin d’un segment : le pourcentage peut donc rester immobile pendant un calcul. 100 % est réservé au lecteur préparé. Le transport de l’original reste utilisable pendant la séparation classique ; les stems classiques sont disponibles une fois le calcul terminé. Une reprise audio lente affiche « Préparation audio… ». Si le navigateur suspend l’audio, « Activer la lecture audio » permet une nouvelle activation explicite. Les répétitions de clic pendant un démarrage n’empilent pas les demandes.

**Lecture progressive (6s, cochée par défaut)** : un Worker conserve le modèle chargé et calcule des fenêtres de 5 s avec 1 s de recouvrement. Le premier résultat publie 4 s de chacune des six pistes ; le reste est publié au fil du calcul, avec fondu linéaire commun aux stems. Play devient actif dès le premier bloc, sans attendre la fin. « Audio prêt » indique la durée disponible et les formes d’onde se remplissent progressivement. Le seek reste dans cette zone ; si la lecture rattrape le calcul, le lecteur attend puis reprend automatiquement. Pause ou Stop annulent cette reprise. Annuler conserve les blocs prêts comme extrait écoutable.

Le modèle FT et le mode classique restent limités à 10 s. Ce prototype progressif est limité à 60 s ; l’import décode encore le fichier entier et les blocs publiés restent en mémoire. Sur CPU, le calcul peut être plus lent que l’audio : la lecture continue sans attente n’est pas garantie. Une petite latence de redémarrage (30 ms) existe lors d’une reprise et au bouclage progressif ; la boucle sans interruption reste à améliorer. Les raccords sont alignés, mais la qualité musicale doit encore être comparée au traitement complet et à UVR.

Mémoire WASM supérieure à 2 Gio : ordinateur de bureau conseillé pour ces essais. FT exécute quatre spécialistes successivement, en terminant chaque Worker avant le suivant. WebGPU est limité au modèle ONNX expérimental. Pas de morceau complet, de boucle A/B, d’export, de normalisation ou de time-stretch multipiste pour le moment. Pas encore de comparaison des conversions et réglages avec UVR. Voir [FEASIBILITY.md](FEASIBILITY.md).

Le cache publie chaque version complète dans une transaction. **Vérifier** relit les octets et contrôle le hash ; **Supprimer du cache** retire la version choisie. Les kits « sans IA » permettent toujours de diagnostiquer le cache sans gros modèle. Pas de pause/reprise Range : les nouvelles tentatives repartent de zéro. Pas de Service Worker : l’ouverture de la page hors ligne n’est pas garantie. Supprimer un modèle du cache n’interrompt pas un calcul déjà lancé avec sa copie des poids.

## Tests

Le suivi du modèle est événementiel, sans interrogation périodique. Une fois le premier chargement terminé, son indicateur reste fixe à 100 %, même lorsque FT prépare les spécialistes suivants. Seul un changement d’identité/version du modèle réinitialise cet indicateur. Choisir un autre fichier audio avec le même modèle déjà disponible ne relance pas la vérification du cache. Les chargements réels des Workers restent nécessaires et sont indiqués dans la préparation des pistes.

Le mode progressif affiche le bloc courant et sa disponibilité ; les pistes 6s ne sont terminées qu’après le dernier bloc. La progression nomme les pistes FT : « Séparation — piste 2/4 — Basse, en cours… », puis « terminée ! ». Une liste conserve les confirmations. Pour 6s, les six pistes sont calculées ensemble ; elles ne sont annoncées terminées qu’à réception du résultat commun. La liste est vidée au prochain traitement ou changement de modèle.

`npm test` : 299 tests, dont six pour le mix multi-instruments (stéréo distincte, extrait plus court que la fenêtre, mono, formats invalides, somme des stems, intégrité et licence du fichier). Cache, catalogue, intégrité du runtime, Workers, sélection des spécialistes FT, validation des sorties, transport et mixage. `webgpu.test.mjs` couvre politique backend, repli/annulation/timeout, messages invalides et tardifs, intégrité du runtime, libération des tenseurs et reconstruction FFT stéréo complète. La correction locale du DSP amont est documentée dans sa notice. `progressive.test.mjs` couvre le découpage, les fondus sans modification rétroactive, les frontières synchronisées, le manque de données et la reprise, les commandes pendant le calcul, l’annulation et les messages tardifs.

Test facultatif avec vrais poids, sans réseau :

```sh
npm run test:separation:wasm -- /chemin/htdemucs_6s.ort.gzipped
```

Il exécute le véritable Worker/WASM, contrôle les six sorties stéréo de 44 100 échantillons, finies et non toutes silencieuses, et rapporte le temps, la heap WASM et les statistiques audio. Il est séparé de `npm test` pour éviter de gros téléchargements et allocations en CI.

Dernière vérification de la dist sous Chrome : bouton « Utiliser un mix multi-instruments (10 s) », quatre pistes prêtes en **5,4 s**, lecture démarrée puis arrêtée. [Mesures de cet essai](benchmarks/webgpu-real-mix-dist-2026-10-20.json). Le diagnostic GPU/CPU active aussi le profilage ; ses durées ne sont pas directement celles du lecteur sans profilage. Ces résultats montrent la variabilité et ne garantissent pas le débit sur une autre machine.

`compact-player.test.mjs` : dix tests du rendu stéréo/progressif, positions sur la durée totale, absence de seconde lecture, mixage immédiat, DOM/focus/scroll stables, seek limité à l’audio publié, dessins asynchrones et destruction, clavier et intégrité des dépendances. Vérification Chrome : quatre stems de 10 s en GPU, zoom 200 %, volume modifié pendant le calcul conservé à 99 %, lecture/arrêt et absence d’élément audio/vidéo.

`separation-workflow.test.mjs` : treize tests, avec vrais moteurs et contexte simulé : route unique, candidat silencieux, transfert de position/mix/zoom/boucle, lecture/pause, extrait trop court, annulation avant/après publication, retour manuel, remplacement de source, contexte incompatible, démarrage tardif, fin de morceau en boucle et focus. Tests Chrome : original 10,88 s, séparation 10 s via le bouton du lecteur, volume 99 % et zoom 200 % conservés, lecture maintenue, annulation, position 10,88 s conservée jusqu’au choix explicite de l’extrait.

P3 ajoute treize tests dans `mix-waveform.test.mjs` et trois dans `compact-player.test.mjs` : annulation de phase, volumes/gain, mute/solo, pan mono/stéréo, PCM non fini, alignement progressif, annulation et résultats tardifs, changements de session et retour de vue. Comparaison native reproductible : ouvrir `/tests/phase6/browser/mix-waveform-reference.html` sur le serveur du dépôt puis cliquer Compare (ce diagnostic reste hors dist). [Résultats Chrome](benchmarks/mix-waveform-native-2026-10-20.json) : 20 cas, erreur maximale 7,45e-9. Test navigateur : mix réduit pendant la lecture et à 5,8 puis 23,4 s disponibles sur 30 s, paramètres et zoom restaurés au retour.

P4.1 et diagnostic 6s : cinq tests du mixeur partagé/routage, un test de recalcul des peaks après gain global et trois tests de reconstruction FFT six stems. Total : 299 tests. Les modèles de recherche restent hors dist et hors cache utilisateur.

## Choix GPU et boucles A/B (P4.2)

Sur une machine compatible WebGPU, le modèle ONNX 4 pistes est sélectionné par défaut. La guitare est dans « Autres ». Le choix CPU reste disponible, ainsi que 6s et FT (CPU seulement). Sans WebGPU, la recommandation guitare revient à 6s CPU. Le téléchargement reste manuel ; un échec GPU peut utiliser le repli CPU avant le premier bloc.

Régler A et B en secondes, utiliser « A = position » / « B = position », ou déplacer les poignées A et B sur la timeline. Les flèches déplacent une borne de 0,1 s (Maj : 1 s). Décocher Loop conserve les bornes ; « Toute la piste » réinitialise la région. Zoom et reset du zoom gardent A/B. La région est identique dans les vues instruments et mix.

Les pistes bouclent ensemble via Web Audio. En mode progressif, une région pas encore calculée attend les prochains blocs. Une région prête est assemblée une fois par piste en mémoire puis bouclée nativement ; seule cette fenêtre est copiée, avec un cache remplacé lors de l’édition. Si sa fin devient disponible pendant la lecture, le premier retour garde la reprise planifiée de 30 ms ; les suivants sont natifs. Une région compatible suit le changement original/instruments en secondes. Si elle dépasse la durée de l’extrait, chaque lecteur conserve sa région propre, visible dans les champs.

P4.2 ajoute sept tests (préférence GPU, horloge et validation des bornes, boucle stéréo sur plusieurs blocs, attente de B, gestes de poignées, transfert original/instruments), soit **306 tests réussis**. Vérification Chrome du prototype et de la distribution : choix GPU à l’ouverture, maintien d’un choix CPU explicite, champs numériques et clavier, boucle réelle 3–7 s après séparation ONNX, vue mix et zoom/reset sans perte des bornes.

## Normalisation du backing (P4.3, branche multitracks)

Cliquer **Normaliser le mix** une fois le fichier prêt ou la séparation terminée. L’analyse prend le morceau backing complet (pas uniquement A/B), avec ses réglages volume/pan/mute/solo et sa marge interne. Choisir une cible de −1, −3 ou −6 dBFS. Le même gain est appliqué à toutes les pistes ; aucune modification du fichier ou des proportions entre instruments. **Actif** permet de comparer avant/après, **Retirer** remet le gain à 1. Le bouton devient **Annuler l’analyse** pendant le calcul. Pas de lecture automatique.

Le silence reste inchangé, l’amplification est limitée à +24 dB. Un changement du mix retire la correction et demande une nouvelle analyse ; vue, zoom et A/B la conservent. Original et instruments gardent chacun leur correction et leur cible. Le volume global backing et la balance guitare sont après ce gain : ils ne sont pas réinitialisés et ne déclenchent pas d’analyse. L’addition de guitare ou une hausse du master peut dépasser 0 dBFS ; le vumètre conserve son alerte de saturation. Cette fonction mesure les pics échantillonnés, pas les LUFS ou les pics inter-échantillons ; elle ne compresse ni ne limite le signal.

La région hors A/B est légèrement grisée lorsque Loop est actif, dans les deux vues, sans empêcher le seek. Désactiver Loop retire ce grisé en gardant les bornes.

Validation : 318 tests automatisés (11 nouveaux pour la normalisation, 1 pour le grisé). Diagnostic natif reproductible : `/tests/phase6/browser/peak-normalization-reference.html`, bouton Comparer, six cas rendus par le vrai moteur dans OfflineAudioContext. [Mesures natives](benchmarks/peak-normalization-native-2026-10-20.json) : erreur maximale 8,94e−8. La normalisation et sa mesure suivent le backend de lecture Web Audio, indépendamment du moteur CPU/WebGPU utilisé pour la séparation.

## Tracks et sauvegarde locale (P4.4)

Ouvrir le **host principal**, workspace **Tracks** : `/examples/wam/` ou `/dist/NAM_A2_WAM/`. P4.5 a annulé ce remplacement : le lecteur historique reste dans Tracks et le nouveau lecteur est dans Multitracks. Choisir une piste dans la bibliothèque ou **Importer un fichier audio…** (le drop est aussi disponible). Le morceau original est écoutable immédiatement après décodage. Le bouton **Separate instruments** ouvre les options ; si le modèle est disponible, il démarre aussi la séparation. Sans modèle, télécharger depuis ce panneau puis relancer. Les extraits restent limités à 10 s en classique, 60 s en progressif ; le morceau original complet est conservé.

Le lecteur reçoit le même AudioContext que le host et la vraie sortie du rack NAM/FX/Cabinet. Un seul mixeur post-rack et une seule destination finale, aucune guitare de test ajoutée dans Tracks. Le volume initial du host reste −12 dB. Changer entre Tone et Tracks ne détruit pas le lecteur.

**Sauvegarder la session** enregistre explicitement original et stems dans IndexedDB (`nam-multitrack-sessions`), puis les petites métadonnées v2 dans localStorage. **Restaurer la session** fonctionne après rechargement de la page, sans téléchargement du modèle ni nouveau calcul de séparation, et **reste toujours en pause**. Les boutons Save/Restore state du host utilisent le même état v2. Mix, vue, zoom, position, A/B, modèle/backend et réglages globaux sont conservés ; la normalisation est re-mesurée avant réactivation plutôt que de croire un gain arbitraire enregistré.

Le cache audio dépend du navigateur, profil, origine et quota. S’il manque, réimporter le même fichier (nom/taille/date identiques) ou choisir la même piste de bibliothèque restaure les réglages de l’original. Les instruments absents doivent être recalculés. Les snapshots occupent la taille PCM de l’original et des stems ; ce n’est pas une sauvegarde serveur ou un fichier projet portable. Les sauvegardes successives ont des clés distinctes ; le nettoyage explicite du cache de sessions reste à ajouter en phase 5a. Un manque de quota est signalé, sans remplacer les métadonnées du dernier enregistrement réussi.

Les états v1 de l’ancien lecteur sont migrables, avec re-sélection du fichier local si nécessaire. Le time-stretch de l’ancien lecteur n’est pas encore appliqué aux multipistes : lecture à vitesse 1, avertissement si l’état v1 demandait une autre vitesse. La normalisation automatique au chargement n’est pas activée par défaut ; utiliser le bouton Normaliser.

Validation : **329 tests réussis** et essais Chrome sur backing réelle avec séparation WebGPU, réglage du mix, A/B et restauration après reload. Diagnostic audio natif : `/tests/phase6/browser/multitrack-routing-reference.html`, bouton Comparer, vérifie la somme rack/backing pour les trois balances après sauvegarde/restauration ; [mesures](benchmarks/host-routing-native-2026-10-21.json), erreur maximale 4,86e−9. Le lecteur historique est de nouveau instancié par le host dans Tracks, avec ses fonctions initiales.

## P4.5 — Deux lecteurs, deux onglets

**Tracks** reste le lecteur d’origine. Charger une piste, puis faire **clic droit sur la waveform → Separate Stems** pour l’envoyer à **Multitracks**. L’original et ses réglages restent dans Tracks.

Dans **Multitracks**, cliquer **Separate instruments**, mixer les instruments ou réduire l’affichage à une seule piste de mix, régler la boucle et écouter. Les réglages de modèles, téléchargements, tests, normalisation et sauvegarde sont rangés dans **Settings**. La liste de gauche conserve les projets séparés : ouvrir l’onglet ne charge que les métadonnées ; cliquer un morceau charge son audio, en pause. Les éditions peuvent être enregistrées avec Settings → Enregistrer le projet.

**Export mix to Tracks** encode le mix actuel en **MP3 stéréo 192 kb/s** dans un Worker local. Le fichier apparaît dans la bibliothèque Tracks, est sélectionné et reste en pause. L’export inclut les réglages des instruments et la normalisation commune, sans guitare live ni volume global d’écoute. Il exporte le morceau/extrait courant complet, pas seulement la boucle A/B. Un niveau au-delà de 0 dBFS est atténué avant encodage. L’export met aussi à jour le projet ; on peut annuler l’encodage. L’export et les projets survivent au reload de cette origine via IndexedDB.

`MediaRepository` sépare les métadonnées `entries` des fichiers MP3 `assets`. Le PCM des projets reste dans `SessionAudioStore`. Ni la bibliothèque Tracks ni la liste Multitracks ne décode les fichiers non sélectionnés. Ces deux interfaces sont injectables pour un backend futur ; pour le moment rien n’est envoyé à un serveur. Les snapshots audio successifs occupent du disque local ; leur maintenance reste à venir.

Le routage final appartient à un unique `BackingTrackMix` après le rack. `WorkspaceAudioRouter` commute les sorties des backing players. Changer de lecteur met l’ancien en pause ; passer dans Tone conserve le backing actif. Le lecteur Tracks garde notamment son time-stretch d’origine. Les extraits de séparation restent limités selon les modèles (10/60 s) ; les projets ne prétendent pas être des séparations intégrales si seul un extrait a été calculé.

Encodeur : [lamejs 1.2.1](https://github.com/zhuker/lamejs), build séparé non modifié, SHA-256 et provenance dans `vendor/lamejs/`.

Validation P4.5 : **340 tests réussis**, distribution reconstruite, aller-retour Tracks → séparation WebGPU → MP3 → Tracks vérifié dans Chrome. Après rechargement, la liste de projets ne charge aucune waveform avant sélection ; le projet sélectionné est restauré en pause. Les contrôles de test restent cachés dans Settings. [Compte rendu navigateur](benchmarks/workspace-transfer-browser-2026-10-21.json).

## Durée et modèle visibles (P4.6)

Dans Multitracks, **Durée à séparer** est accessible directement : **Morceau entier** par défaut, ou un extrait de 1/5/10/30/60 s. Le nom du modèle et CPU/WASM ou GPU/WebGPU sont affichés à côté. **Change model / settings** ouvre les modèles et réglages avancés. Les anciennes limites de calcul 10/60 s sont retirées ; la durée complète est calculée par blocs. Le mode FT reste CPU et restitue les résultats après ses quatre spécialistes. Les exemples de diagnostic peuvent sélectionner explicitement leur propre durée ; un nouvel import revient au morceau entier.

Le découpage borne le travail du DSP ; les stems complets restent en RAM et dans le cache local. L’import est limité à 512 Mio et les sessions à 24 h de validation, sans garantie de mémoire suffisante pour ces plafonds. Les limites d’extrait mentionnées dans les étapes historiques ci-dessus sont remplacées par ce comportement.

Validation P4.6 : **344 tests réussis**. Chrome a séparé les **214,9 s** du morceau Jet en quatre stems WebGPU, **75,9 s** de calcul Worker sur cette machine, sauvegarde locale sans lecture automatique et sans erreur console. [Mesure](benchmarks/full-song-browser-2026-10-22.json). Ce temps ne garantit pas les performances d’une autre machine ; un nouveau benchmark de morceau entier CPU/FT reste à faire.

## Historique : taille des segments (P4.7, retirée en P4.8)

Le menu **Taille des segments**, dans l’écran principal, propose Auto recommandé, 1/2/3/5/7,8 s. Il règle le découpage interne, sans changer la durée totale sélectionnée. Conservé dans le projet et verrouillé pendant le calcul. Les recouvrements restent 25 % pour ONNX, 20 % pour WASM.

Le réseau ONNX calcule toujours 7,8 s : les segments courts sont complétés puis recadrés, et peuvent donc être plus lents. Le mode Auto préserve les choix existants. La lecture progressive reste disponible ; FT restitue ses pistes après les quatre spécialistes. [Analyse du parallélisme et expérience proposée](SEGMENTS_AND_PARALLELISM.md). Aucun pool parallèle activé : cette étape ajoute le réglage, son explication et l’étude de faisabilité.

Validation P4.7 : **350 tests réussis**. Même extrait musical de 10 s, WebGPU : segments 1 s → 27,4 s ; 2 s → 16,4 s ; Auto → 5,5 s. Chaque essai restitue quatre pistes complètes ; aucun gain parallèle mesuré puisque le moteur reste séquentiel. [Mesures et limites](benchmarks/segment-size-browser-2026-10-22.json).

## Modèles à étudier et segmentation automatique (P4.8)

Le réglage manuel des segments est retiré : **Auto est imposé**, y compris à la restauration d’un ancien réglage 1/2 s. Le choix **Morceau entier / extrait** reste disponible. Les 7,8 s sont le contrat de notre modèle/export Demucs, pas une limite ONNX générale ; un export réellement plus court constitue une nouvelle expérience à valider.

Dans **Change model / settings → Autres modèles · étude de compatibilité**, retrouver les huit familles demandées, avec usages, état de portage et sources. Elles sont séparées du menu des modèles exécutables : cette étape ne prétend pas les avoir intégrées. Priorité : **BS Roformer SW six sources**, dont un export ONNX et une démonstration navigateur existent ; puis MDX-Net Inst HQ 4/5. [Étude complète et tâches de portage](MODEL_CANDIDATES.md).

Validation P4.8 : **353 tests réussis**, distribution reconstruite, vérification Chrome du retrait du menu des segments et des huit références dans Settings ; aucune erreur console. Les modèles candidats n’ont pas encore été exécutés dans le host. [Compte rendu UI](benchmarks/model-research-ui-2026-10-22.json).

## Départ rapide : laboratoire (P4.10)

[Laboratoire d’écoute rapide](low-latency-benchmark.html), aussi accessible dans Settings. De vrais exports neuronaux courts permettent ici de rendre quatre pistes prêtes en ~0,44 s (1 s de contexte) ou ~0,77–0,95 s (2 s de contexte), modèle **déjà préparé**. Le second publie une seconde par bloc. Validation de tous les canaux contre PyTorch court, sans sous-alimentation sur l’extrait testé. Une session froide reste plus lente ; le rendu n’est pas identique au contexte7,8s. La correction du padding FFT trouvée pendant ce test bénéficie au moteur normal. Ce profil rapide n’est pas encore intégré aux projets du lecteur principal.

Les artefacts lourds sont locaux/ignorés, pas embarqués dans la dist ; [protocole, génération des poids, écarts audio et limites](LOW_LATENCY.md). **357 tests réussis**.

### Aperçu rapide intégré

Change model / settings → Model → **Aperçu rapide**. Télécharger une fois, attendre l’état prêt en mémoire, puis Separate. Contexte réduit 2 s : rendu différent de Qualité (défaut), guitare dans Autres. Voir [LOW_LATENCY.md](LOW_LATENCY.md). Déploiement : générer/valider l’export et exécuter `node tools/install-demucs-preview.mjs` avant `npm run dist -- --no-regenerate --no-build` ; les poids sont servis par la dist et gardés dans le cache du navigateur.

### BS Roformer SW six instruments

Modèle expérimental disponible dans Change model / settings → Model, GPU conseillé, guitare et piano dédiés. Download/cache/SHA-256 et session préparée utilisent le workflow habituel ; quatre secondes de contexte, publication par blocs de trois secondes. Le CPU est fonctionnel mais très lent. Voir [ROFORMER_VALIDATION.md](ROFORMER_VALIDATION.md) pour les références, la précision numérique, les tests et les droits des poids non précisés. Avant la dist, `node tools/install-roformer-model.mjs` installe l’export épinglé ; le navigateur n’a pas besoin des références du laboratoire.

### Transport audio progressif et isolation

La séparation progressive utilise `ringbuf.js` 0.4.0 (MPL-2.0, notice dans `vendor/ringbuf`) avec un SharedArrayBuffer SPSC borné. Le producteur calcule les peaks, publie des tranches <=1s, et attend une notification si la queue est pleine. Le consommateur UI travaille par tâches bornées. Sans isolation, repli sur les mêmes tranches transférables.

`npm start` envoie désormais COOP `same-origin`, COEP `require-corp` et CORP `same-origin`, comme le serveur Rails. Redémarrer un ancien processus Node pour appliquer ces en-têtes puis recharger la page. Le serveur statique de déploiement doit envoyer les mêmes en-têtes ; `_headers` est généré dans la dist pour les hébergeurs compatibles. Les ressources externes doivent respecter CORS/CORP. Pas de chemin partagé avec `file://`.

Pour diagnostiquer : `http://127.0.0.1:8765/examples/wam/?uiMetrics=1` → Change model / settings → Mesures du dernier traitement ONNX → UI performance. Le mode effectif (`shared-ringbuffer` ou `transfer`) apparaît dans les mesures. Détails, tests et limites de fluidité observées dans [RINGBUFFER_PLAN.md](RINGBUFFER_PLAN.md).

BS Roformer SW/WebGPU utilise désormais une exécution coopérative :18 étapes reconstruites dans le Worker depuis les poids du cache, avec une barrière GPU et une courte pause entre étapes. Cela conserve les calculs et raccords audio tout en évitant d'accumuler tout le réseau dans la file GPU. Le traitement peut être plus lent. CPU/WASM conserve le graphe original. Mesures, limites et régénération du plan : [ROFORMER_UI_DIAGNOSIS.md](ROFORMER_UI_DIAGNOSIS.md).

La sauvegarde PCM prépare désormais des Blobs par copies bornées à256Kio, avec des pauses entre les tâches, puis publie un seul enregistrement IndexedDB atomique. Les anciennes sessions Float32Array restent lisibles. Le PCM du lecteur n’est ni modifié ni détaché. `?uiMetrics=1` mesure séparément `sessionPackAudio`, `sessionBlobCopy`, `sessionBlobCompose` et `sessionIndexedDbPut`.

Comparaison des plans GPU, format Blob et résultats/limites de la sauvegarde : [ROFORMER_THROUGHPUT_AND_STORAGE.md](ROFORMER_THROUGHPUT_AND_STORAGE.md).

## RAM par défaut et enregistrement d'un projet

Dans **Multitracks**, importer, séparer, écouter et mixer un morceau ne sauvegarde plus automatiquement son audio. Le résultat reste en RAM et affiche **En RAM · projet non enregistré**. Pour le retrouver après fermeture/rechargement, cliquez sur **Enregistrer le projet**, désormais visible dans l'écran principal. Les projets déjà enregistrés restent dans la liste de gauche ; leur audio est chargé uniquement à la sélection.

Un projet enregistré affiche **Projet enregistré**. Modifier son mix, sa normalisation, sa vue/son zoom, sa boucle ou relancer une séparation le marque à nouveau comme non enregistré. Les changements effectués pendant une sauvegarde restent non enregistrés. La lecture seule ne modifie pas ce statut. Un échec de sauvegarde laisse l'audio utilisable en RAM.

**Export mix to Tracks** crée le MP3 demandé sans sauvegarder le projet ni ses stems. Le cache des modèles n'est pas concerné par ce changement. La commande explicite de sauvegarde de session du prototype et Save State du host restent compatibles avec leurs anciennes sessions. Sans enregistrement explicite, le résultat courant est perdu si l'onglet est fermé/rechargé ou si le morceau est remplacé.

## Comparaison des modèles et recommandation

**Change model / settings → Choisir selon votre priorité** propose terminer vite (défaut), écouter tôt ou obtenir une piste guitare dédiée. Le graphique compare les backends sur **les mêmes six secondes de Slow Motion Dream**, en affichant la médiane et le nombre d'essais. Il inclut cache/initialisation/compilation/préchauffage et calcul, mais exclut téléchargement et décodage. Le délai du premier bloc inclut aussi la préparation. Un extrait court favorise les modèles peu coûteux à préparer ; cela ne garantit pas le même classement sur un morceau entier ou avec une session déjà préparée.

Le lien **Comparer sur cette machine** ouvre `model-benchmark.html`. Le benchmark complet peut prendre plus de vingt minutes sur CPU ; filtrez un modèle ou GPU uniquement pour une comparaison ciblée. Chaque essai utilise une session neuve, sans vider les caches du driver/navigateur ; les configurations passent successivement, sans lecture audio. Installez d'abord les modèles via le gestionnaire ; aucun téléchargement n'est déclenché par le benchmark. Les modèles manquants et les erreurs restent indiqués. CPU et GPU sont explicitement testés, sans repli automatique. Annuler termine le Worker actif. Les mesures JSON sont téléchargeables ; aucun PCM ni morceau personnel n'est sauvegardé ou envoyé. Seuls les petits résultats chronométriques sont conservés dans localStorage après un benchmark complet.

Réouvrez Settings ou cliquez sur Actualiser les mesures pour afficher les mesures locales sans recharger ni perdre le projet en RAM. Au prochain chargement du lecteur, elles servent aussi au choix initial du modèle. La recommandation de vitesse utilise les mesures seulement si tous les modèles du backend ont été testés avec les mêmes poids/version et le même protocole (les configurations en échec sont exclues du choix). Sinon le choix reste provisoire (Qualité 4 pistes GPU, 6 pistes CPU). Le bouton **Utiliser la recommandation** applique explicitement une autre priorité ; dans la fenêtre Settings, le changement reste soumis à Valider / Annuler comme les autres choix de modèle. Le résultat d'un benchmark ne change pas une séparation en cours.

Le second graphique est un extrait **daté et sourcé du classement SDR guitare MVSep**, avec références externes identifiées. Il ne représente pas des votes ni une mesure de notre propre export Roformer à fenêtres 4 s. Aucun score n'est inventé pour les modèles dont la guitare reste dans « Autres ».

La [comparaison documentée](MODEL_COMPARISON.md) fournit le protocole, les huit configurations et les essais bruts du23octobre2026. Sur la série de référence, Demucs Qualité4 termine le plus vite sur GPU et CPU ; Aperçu4 publie son premier bloc plus tôt. Un contrôle ultérieur avec onglet visible confirme le classement, avec des durées variables entre sessions. Le laboratoire annule désormais une mesure si son onglet est masqué. Validation : 451 tests unitaires/intégration réussis et16 séparations réelles complètes, puis4 essais de contrôle CPU/GPU.

### Comparaison guitare et basse

Depuis Change model / settings, le lien **Comparer à l’écoute · guitare et basse** ouvre `instrument-comparison.html`. Modèles installés uniquement, extraits communs 6/15/30 s, original/instrument/backing, lecteur commun et exports WAV/notes JSON. Pas de normalisation ni de score de qualité sans stems originaux. Voir [le protocole](INSTRUMENT_COMPARISON.md).

Validation du comparateur : neuf nouveaux tests, suite complète460/460 réussie ; essais CPU/GPU réels, décodage et commutation des WAV vérifiés dans la distribution.

### Conseils instrumentaux et banc contrôlé

Settings affiche des profils Guitariste/Bassiste distincts des temps de calcul. Le lien `instrument-quality.html` exécute les modèles installés sur trois mélanges à références connues (guitare enregistrée, basse/batterie synthétiques). Les résultats sont des mesures pilotes SI-SDR/SNR, avec source et limites explicites ; ce n’est pas un classement perceptuel universel. Le modèle n’est modifié que via « Utiliser ce conseil instrumental » puis validation de Settings. Voir [INSTRUMENT_QUALITY.md](INSTRUMENT_QUALITY.md).

Campagne du23octobre2026 : 15/15 séparations valides sur trois mélanges contrôlés ; SW6 est le conseil GPU expérimental des deux profils. 477 tests passent. Le détail et les limites (basse/batterie synthétiques, pas d’écoute humaine ni de classement universel) sont dans INSTRUMENT_QUALITY.md. Le lecteur A/B propose maintenant les trois mélanges et leurs références audibles.


### Corpus enregistré guitare/basse

Le banc `real-instrument-quality.html` utilise six extraits locaux : trois morceaux basse MUSDB18 test et trois passages guitare d’une seule composition MedleyDB. Les 24 séparations des quatre configurations sont archivées, sans audio. Settings préfère ces mesures réelles : conseil expérimental SW GPU pour la guitare, Qualité4 GPU pour la basse (meilleure médiane). Le sélecteur de corpus permet de retrouver le pilote contrôlé, séparément. FT reste non mesuré dans cette campagne. Aucun changement de modèle sans application explicite et validation.

Sources, droits, préparation reproductible et résultats : [REAL_INSTRUMENT_CORPUS.md](REAL_INSTRUMENT_CORPUS.md). Les WAV de `test-data/source-separation/` restent locaux et sont exclus de Git et de la distribution. 489 tests réussis ; les résultats ne remplacent pas une écoute humaine ni un corpus guitare plus diversifié.

Le [diagnostic guitare multi-styles](GUITAR_DIAGNOSTIC.md), accessible par `real-instrument-quality.html?corpus=guitar-diagnostic`, compare trois nouvelles compositions acoustiques/électriques enregistrées. Elles sont issues de MUSDB train et restent **hors des conseils Settings**. Le banc permet désormais l’écoute A/B de la référence, de l’instrument séparé et du backing de chaque modèle, à position conservée et volume commun. Les résultats audio restent uniquement en RAM (128Mio maximum), contrairement aux petits rapports numériques exportables.
