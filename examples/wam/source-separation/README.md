# Laboratoire de séparation

`npm start`, puis <http://127.0.0.1:8765/examples/wam/source-separation/>.
Distribution : `dist/NAM_A2_WAM/source-separation/` après `npm run dist`.

Ne pas ouvrir `index.html` directement avec `file://` : les modules et le catalogue nécessitent HTTP(S). Dans ce cas, la page affiche un lien vers l’URL du serveur local au lieu de proposer des commandes inutilisables. Sous HTTP, une aide sous « Séparer l’extrait » indique si le catalogue charge encore, si le modèle doit être téléchargé ou si un fichier audio manque. Les modèles en cache sont propres à l’adresse et au port utilisés (`localhost` et `127.0.0.1` ont des caches distincts).

## Original → instruments (P2)

Importer un fichier ou choisir un exemple prépare maintenant **le morceau original complet**, immédiatement écoutable avec Play, sans devoir télécharger un modèle. La lecture ne démarre pas toute seule. Si le navigateur suspend l’audio, utiliser « Activer la lecture audio ».

Depuis le lecteur, cliquer **Separate instruments** après avoir choisi/installé le modèle. L’original reste écoutable pendant le calcul ; sa séparation a une progression et un bouton d’annulation dans le lecteur. Le candidat partage le même AudioContext mais sa sortie reste déconnectée jusqu’à la bascule : aucune addition original + stems.

Quand la zone calculée couvre la position courante, le lecteur passe aux instruments en gardant position, lecture/pause, boucle, zoom et gain de sortie. Volume, pan et mute de l’original sont appliqués aux stems lors de cette première bascule ; les éditions ultérieures des stems sont conservées. Si le mixeur a le focus, la bascule automatique attend pour préserver l’interaction. « Écouter les instruments » reste disponible explicitement. L’audio reprend avec la latence planifiée existante de 30 ms ; ce n’est pas une transition sans interruption à l’échantillon près.

Le prototype sépare toujours **le début du morceau**, selon la durée choisie. Il affiche distinctement durée originale et extrait séparé. Si la position est après cet extrait, l’original reste en place : cliquer « Écouter l’extrait séparé depuis le début » pour choisir ce retour au début. « Écouter l’original complet » revient à l’original et empêche une nouvelle bascule automatique à l’arrivée des blocs suivants. Les pistes déjà calculées restent accessibles.

Échec ou annulation : l’original reste ou redevient actif avec son état de lecture courant ; les stems partiels prêts peuvent être sélectionnés explicitement. Un nouvel import remplace la session sans lecture automatique ; un décodage invalide ne détruit pas l’original précédent. Le bouton du lecteur reste désactivé avec une aide lorsque le modèle manque. La balance globale guitare/backing et les boucles A/B sont disponibles ; normalisation disponible en P4.3 ; intégration dans Tracks à venir en P4.4.

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

Pour écouter la balance dans le laboratoire, ouvrir **Guitare de test pour essayer la balance**, charger CleanChords, puis utiliser **Jouer la guitare**. La lecture est indépendante de celle du backing, avec le même AudioContext. **Stop guitare** arrête ce signal. Aucune capture micro n’est ouverte. Cette guitare de test est un fichier sec ; dans le host, l’entrée correspondante recevra la sortie traitée du rack. L’intégration dans Tracks et sa restauration d’état restent P4.4.

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
