# Collection locale Guitar Hero / Rock Band — reconnaissance et sélection

25 octobre 2026 · branche `multitracks` · **préqualification initiale ; campagne automatisée G1 décrite en fin de fichier**.

## Périmètre réellement inspecté

Inventaire des noms, extensions, tailles et organisation de la collection fournie par l’utilisateur. Les originaux restent en place et ne sont pas modifiés. L’inventaire porte sur toute la collection, mais les contrôles audio sont volontairement limités à **six candidats** : trois dossiers GHA, trois MOGG Rock Band. Aucun balayage acoustique ou passage de modèle sur les autres morceaux.

| Ensemble | Contenu inventorié | Contrôle effectué |
|---|---|---|
| Musiques Multipistes gha | 41 dossiers, environ 553,5 Mo avec fichiers annexes | Métadonnées de neuf fichiers audio dans trois dossiers ; deux fenêtres de 6 s par fichier |
| Musiques multipistes rock band | 306 fichiers `.mogg`, environ 8,496 Go | En-tête et métadonnées de trois fichiers seulement |

GHA : **39 dossiers** ont `guitar.ogg` + `rhythm.ogg` + `song.ogg` ; un dossier, Run DMC Featuring Aerosmith — Walk This Way, a ces trois fichiers en MP3 ; le dossier `32 Aerosmith - Walk This Way` ne contient pas de fichier audio dans l’inventaire. Au total :117 OGG et3 MP3, plus MIDI, INI et images. Aucun mix master distinct nommé explicitement n’a été identifié dans les trois dossiers sélectionnés.

## Sélection principale : trois morceaux GHA

Le choix est fixé **avant de regarder les sorties des modèles**. Il vise une variété de situations musicales, sans prétention de représentativité du rock ou de la population des guitaristes. Les motifs musicaux ci-dessous sont des hypothèses de sélection, pas des observations issues d’une écoute instrumentale documentée.

| Ordre | Morceau / dossier | Durée commune déclarée | Motif du choix | Fenêtres prévues |
|---|---|---:|---|---|
| 1 | Aerosmith — Dream On (`25 Aerosmith - Dream On`) | 277,153379 s | Contrastes de ballade et de registre de guitare | 20–26 s et 90–96 s |
| 2 | Lenny Kravitz — Always On The Run (`22 Lenny Kravitz - Always On The Run`) | 239,258413 s | Riff rythmique ; cas utile pour examiner guitare et basse | 20–26 s et 90–96 s |
| 3 | The Cult — She Sells Sanctuary (`16 The Cult - She Sells Sanctuary`) | 256,534059 s | Textures de guitare et sustain ; autre cas de basse active | 20–26 s et 90–96 s |

Les neuf fichiers sont Vorbis, stéréo,44100 Hz, début déclaré0 ; les trois stems d’un même morceau ont exactement la même durée déclarée. Les six fenêtres contiennent264600 échantillons par canal et des valeurs finies. Tous les stems ont une énergie non nulle dans ces fenêtres.

Les MIDI de ces trois dossiers contiennent notamment `PART GUITAR`, `PART BASS` et `PART GUITAR COOP`. Les INI portent `tags=master`, `icon=gha`. **Ces métadonnées ne certifient ni l’origine studio exacte ni le contenu isolé de chaque fichier.** Des versions jeu, edits, regroupements ou traitements peuvent différer du disque commercial.

### Résultats numériques limités aux fenêtres

| Morceau | RMS guitare à20s /90s | RMS rhythm à20s /90s | Énergie de rhythm sous250 Hz | Gain commun maximal pour pic du mix≤0,9, à20s /90s |
|---|---:|---:|---:|---:|
| Dream On | 0,0534 /0,1066 | 0,0606 /0,0698 | 94,7–97,0 % | 1 /1 |
| Always On The Run | 0,1306 /0,1301 | 0,1283 /0,1461 | 93,9–96,1 % | 0,7131 /0,6556 |
| She Sells Sanctuary | 0,1226 /0,1178 | 0,1109 /0,1079 | 94,6–95,9 % | 0,7140 /0,6992 |

L’énergie grave de `rhythm.ogg`, avec la présence de PART BASS, est **compatible avec une piste basse**, sans le prouver à elle seule. Le code [FoFiX](https://github.com/fofix/fofix/blob/master/fofix/game/song/song.py) associe d’ailleurs le même nom rhythm aux parties Bass et Rhythm : ne pas convertir ce nom en vérité terrain automatique.

Les corrélations instantanées entre fichiers sont faibles sur les fenêtres (|r|≤0,028) ; cela ne prouve ni absence de repisse ni exhaustivité des guitares. Les sommes peuvent dépasser1 : aucun écrêtage ni normalisation individuelle ne sera appliqué ; il faudra un **gain commun** identique au mix et à toutes les références.

### Précaution de découpage réellement rencontrée

Un premier essai de recherche rapide par `ffmpeg -ss` avant l’entrée a renvoyé265048 échantillons au lieu de264600 pour Dream On / rhythm à20s. Cet essai a été écarté. Pour le contrôle retenu, les **96 premières secondes** des neuf fichiers sélectionnés ont été décodées depuis leur origine, puis les fenêtres exactes ont été prises par indices d’échantillons20×44100 et90×44100. Aucune correction de délai ni recherche d’alignement optimisant un score n’a été effectuée. Hors de ces fenêtres, aucun calcul d’énergie/corrélation n’a été réalisé.

Même grille d’échantillons et mêmes métadonnées ne prouvent pas la synchronisation musicale d’origine : une écoute reste nécessaire. L’échec de seek n’est pas imputé aux modèles.

## Rock Band : un complément retenu, deux réserves

Les trois fichiers testés sont de type MOGG0x0A, avec signature `OggS` à l’offset indiqué par l’en-tête. Une copie de travail du **flux Vorbis déjà lisible** a suffi pour ffprobe ; aucune transformation des échantillons, aucun déchiffrement. Le format de ce préambule est décrit dans le [code Onyx](https://github.com/mtolly/onyx/blob/master/haskell/packages/onyx-lib/src/Onyx/Harmonix/MOGG.hs).

| Candidat | Canaux | Fréquence | Durée déclarée | Décision |
|---|---:|---:|---:|---|
| Muse — Hysteria | 12 | 44100 Hz | 231,074104 s | **Premier complément souhaité**, pour élargir le cas basse ; attente de correspondance des canaux |
| Police — Roxanne | 12 | 44100 Hz | 178,878753 s | Réserve, contraste musical après qualification |
| Metallica — Enter Sandman | 13 | **36000 Hz** | 336,321028 s | Réserve dense ; mapping et rééchantillonnage commun supplémentaires nécessaires |

La collection Rock Band ne contient ici que les306 MOGG, **sans `songs.dta`, groupes de canaux, panoramiques ni gains d’origine**. Les positions des canaux ne sont donc pas étiquetées batterie/basse/guitare/voix dans notre analyse. Aucun downmix automatique12/13→2 canaux n’est utilisé comme référence : il pourrait supprimer des pistes ou appliquer une matrice incorrecte. L’ordre canonique d’un système multicanal domestique n’est pas une description des stems du jeu.

Muse reste une **réserve conditionnelle**, pas un quatrième morceau prêt pour les scores. La correspondance doit venir des métadonnées du jeu, d’un projet d’extraction documenté ou d’une identification auditive explicite, conservée dans le protocole.

## Plan d’évaluation retenu

1. **Premier lot : trois morceaux GHA, six fenêtres de6s.** Vérifier à l’écoute les fichiers seuls et leur somme, la continuité temporelle et la présence éventuelle d’autres guitares dans le backing. Confirmer le rôle de rhythm avant toute mesure basse.
2. Reconstituer un mix contrôlé avec les stems réellement complémentaires, à gains fixes documentés. `song.ogg` n’est pas supposé être le mix complet : le lecteur FoFiX distingue [song, guitar et rhythm](https://github.com/fofix/fofix/blob/master/doc/source/users/songs.rst). Si song contient déjà les guitares recherchées, ne pas additionner aveuglément la cible et ce fichier.
3. Construire une référence **guitare totale** si toutes les guitares sont identifiées. Sinon déclarer «stem guitare partiel» et ne pas pénaliser une sortie du modèle pour avoir correctement récupéré une autre guitare absente de la référence. Même exigence pour les sources basse.
4. Passer exactement les mêmes fenêtres aux modèles et backends retenus, avec hachages des originaux, références et recette. Un offset préenregistré ne sera remplacé pour silence/problème de référence qu’avant examen des sorties et avec justification consignée.
5. Comparer fidélité instrumentale et écoute du backing, puis revue humaine en aveugle avec le banc existant. Le catalogue de recommandations ne change pas sur la seule base de cette reconnaissance.
6. Ajouter Muse seulement après identification et regroupement documentés des canaux. Aucun besoin de traiter les306 MOGG.

## Traçabilité et limites pour l’article

[Rapport de préqualification](benchmarks/local-stems-preflight-2026-10-25.json) : inventaire synthétique, empreintes SHA-256 des12 fichiers sélectionnés, codecs/durées, MIDI/INI des trois GHA, énergie/corrélation des fenêtres et recette de gain. Le rapport ne publie pas le chemin privé absolu ni de PCM. Copies MOGG de travail dans le dossier ignoré `test-data/source-separation/rockband-inspection/` ; aucun fichier audio de cette collection n’est ajouté à Git ou à la dist.

- Vorbis et MP3 sont des sources avec compression avec pertes : on étudiera la reproduction de **ces exports de jeu**, pas une équivalence aux bandes studio non compressées.
- Disponibilité locale et `tags=master` ne prouvent pas la provenance complète, les possibilités de redistribution ou une exclusion de l’entraînement. Exposition des morceaux aux corpus d’entraînement **inconnue**.
- La préqualification seule ne donnait aucun score. La campagne G1 ajoutée ci-dessous ne constitue toujours ni un classement général ni une certification de pureté ni une étude humaine.
- Limite volontaire : trois morceaux prêts à être qualifiés pour le premier lot, un complément MOGG en attente, deux réserves ; aucun traitement exhaustif.

## Campagne automatisée sur stems assignés (25 octobre)

Le complément opérationnel emploie une **somme construite explicitement**, `guitar + (rhythm + song)`, et mesure la récupération de `guitar.ogg` dans ce mélange. Il ne prétend pas reconstruire le mix commercial, certifier l’absence de guitare dans song ni fournir une référence « toutes guitares ». Cette distinction permet de terminer les contrôles numériques tout en conservant les réserves de qualification ci-dessus. La comparaison rhythm/basse demeure étiquetée provisoire. `Autres` n’est jamais substitué à la guitare.

Préparation reproductible (Python avec NumPy et FFmpeg disponibles) :

```sh
python tools/prepare-local-game-corpus.py '/chemin/vers/Multipistes rock band etc.'
```

Seuls les neuf fichiers GHA sélectionnés sont lus et confrontés aux SHA du préflight ; fenêtres inchangées20–26s/90–96s. Les WAV float32 et le manifeste restent dans `test-data/source-separation/local-game-stems/`, ignoré par Git. Un gain unique est appliqué à la cible, au backing et au stem rhythm. Aucun gain ajusté au modèle, EQ, recherche de délai ou normalisation individuelle.

Banc source : `http://127.0.0.1:8765/examples/wam/source-separation/local-game-evaluation.html` lorsque le serveur de ce dépôt écoute sur8765. Les modèles doivent être déjà installés **sur cette origine** ; pas de téléchargement automatique. Matrice fixée : BS Roformer SW6 WebGPU et Demucs6 WASM, six fenêtres chacun, exécution séquentielle. Les poids sont rechargés entre essais ; `jobSeconds` comprend vérification du cache, préparation et séparation, sans téléchargement ni décodage des WAV. Ce n’est pas le benchmark réseau seul ou un temps de première lecture.

Le rapport de campagne complétera `MODEL_EVALUATIONS.MD` ; les sources exactes sont identifiées dans [l’empreinte du code](benchmarks/local-game-code-2026-10-25.json). Aucun score humain ni validation des MOGG sans carte de canaux n’est ajouté par ce banc.

**Résultat final G1 :12/12 séparations réussies**, aucun échec. Médiane SI-SDR guitar.ogg :7,55dB SW GPU et6,55dB Demucs6 WASM, sur six fenêtres dépendantes de trois compositions. [Rapport complet](benchmarks/local-game-evaluation-2026-10-25.json), méthodes/interprétation dans `MODEL_EVALUATIONS.MD`§18. Aucun nouveau classement conseillé ; étude humaine et qualification des instruments toujours ouvertes. Les MOGG conditionnels restent non évalués faute de carte des canaux.
