# Corpus réel guitare/basse

Le corpus est préparé localement dans `test-data/source-separation/`, ignoré par Git et hors des arbres copiés dans `dist`. Seules les métadonnées/hashes (`RealCorpusDefinition.js`) et les mesures numériques sont distribuées. Aucun fichier de recherche audio n’est ajouté aux exemples de production.

## Sources officielles et sélection

- [MUSDB18](https://sigsep.github.io/datasets/musdb.html) : [échantillon officiel de sept secondes](https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip), archive147209385octets. Les flux1/2/3/4 des STEMS MP4 correspondent à batterie/basse/autres/voix. Le flux0 du mix AAC est ignoré : on reconstruit le mix depuis les références décodées pour éviter l’écart de compression avec le mix encodé séparément.
- [Liste des licences MUSDB18](https://github.com/sigsep/website/blob/master/content/datasets/assets/tracklist.csv) : les morceaux restent réservés aux conditions académiques du corpus, avec conditions spécifiques selon la provenance.
- [MedleyDB, téléchargement et conditions](https://medleydb.weebly.com/downloads.html) : [échantillon public officiel](https://zenodo.org/record/1438309/files/MedleyDB_Sample.tar.gz?download=1), archive415502011octets. CC BY-NC-SA4.0, recherche non commerciale, attribution aux auteurs/artistes. Les auteurs demandent de ne pas republier les données sans leur accord ; nous gardons les WAV locaux.
- [Coefficients de mixage officiels MedleyDB](https://github.com/marl/medleydb/blob/master/medleydb/resources/mixing_coefficients.yaml), coefficients de LizNelson_Rainfall conservés. Les archives, coefficients, métadonnées et fichiers préparés sont identifiés par SHA256.

| Cas | Source / partie | Référence cible | Découpage | Conditions indiquées |
| --- | --- | --- | --- | --- |
| Pop/rock | The Easton Ellises — Falcon69, MUSDB test | Basse | Six premières secondes de l’extrait7s | CC BY-NC-SA3.0 |
| Reggae | Arise — Run Run Run, MUSDB test | Basse | Idem | Restricted / usage académique du corpus |
| Metal | We Fell From The Sky — Not You, MUSDB test | Basse | Idem | Restricted / usage académique du corpus |
| Rainfall20 | Liz Nelson & Jennifer Davies, MedleyDB sample | Somme des guitares acoustique/électrique claire | 20–26s | CC BY-NC-SA4.0 |
| Rainfall65 | Même morceau | Idem | 65–71s | Idem |
| Rainfall120 | Même morceau | Idem | 120–126s | Idem |

Le sample MedleyDB inclut aussi Phoenix_ScotchMorris. Il est exclu de ce premier banc : métadonnées `has_bleed: yes`, flûte/violon et micros d’ensemble, ce qui compromet une référence guitare isolée stricte. Rainfall déclare `has_bleed: no`, trois voix et deux guitares. Dans ce cas vérifié, la sortie Autres des modèles quatre pistes peut être comparée à la somme guitare ; ce serait incorrect avec du piano ou d’autres instruments dans Autres.

Les six clips ne sont pas six compositions indépendantes : **trois morceaux pour la basse, un seul pour la guitare**. Le split MUSDB `test` est respecté, mais le recouvrement réel de chaque modèle avec les données d’entraînement n’est pas connu. Rainfall n’apparaît pas dans l’archive MUSDB de prévisualisation ; cela ne prouve pas son absence des corpus d’entraînement des modèles.

## Préparation reproductible

Prérequis : Python3 (bibliothèque standard) et `ffmpeg` accessible dans PATH. Aucun téléchargement n’est déclenché par le script de préparation.

```sh
curl -L --fail 'https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip' -o /tmp/MUSDB18-7-STEMS.zip
curl -L --fail 'https://zenodo.org/record/1438309/files/MedleyDB_Sample.tar.gz?download=1' -o /tmp/MedleyDB_Sample.tar.gz
curl -L --fail 'https://raw.githubusercontent.com/marl/medleydb/master/medleydb/resources/mixing_coefficients.yaml' -o /tmp/medley-mix-coeff.yaml
curl -L --fail 'https://raw.githubusercontent.com/sigsep/website/master/content/datasets/assets/tracklist.csv' -o /tmp/musdb-tracklist.csv
python3 tools/prepare-real-instrument-corpus.py --musdb /tmp/MUSDB18-7-STEMS.zip --medley /tmp/MedleyDB_Sample.tar.gz --coefficients /tmp/medley-mix-coeff.yaml --licenses /tmp/musdb-tracklist.csv --output test-data/source-separation
```

Les chemins d’extraction sont des noms connus, sans extraction générale d’archives. Les voix/guitares de Rainfall sont pondérées par les coefficients officiels, puis regroupées en cible/backing. Pour tous les cas, un seul gain commun éventuel limite le pic du mix à0,9. Les trois fichiers générés (`mix.wav`, `reference.wav`, `backing.wav`) sont stéréo44,1kHz flottant32bits,264600frames. Aucune normalisation indépendante. `mix = référence + backing` est contrôlé à1e-6 près ; cible active, finitude et alignement contrôlés avant inférence.

Le navigateur compare le manifeste local et chaque SHA256 aux références épinglées. Si une autre version de FFmpeg ou des archives modifie les échantillons, ne pas ignorer cette erreur : documenter la nouvelle préparation, mettre à jour les empreintes et refaire la campagne.

## Banc et affichage

`http://127.0.0.1:8765/examples/wam/source-separation/real-instrument-quality.html`

Le bouton charge le corpus local, vérifie les trois WAV de chaque cas puis utilise les adaptateurs de production. GPU si compatible, CPU sinon, sans repli. Par défaut : Demucs6 CPU, Qualité4/Aperçu4/SW6 GPU. FT reste facultatif, explicitement non mesuré s’il n’est pas coché. Pas de score pour un modèle incomplet/en échec, ni de valeur CPU inventée depuis une mesure GPU.

Le panneau d’écoute charge un seul extrait à la demande et donne le mix reconstruit, la référence et le backing connu. Volume initial25%, pas de lecture automatique. Aucune donnée audio n’est enregistrée dans le stockage navigateur.

Mêmes métriques que le pilote : SI-SDR à projection stéréo globale, SNR conservant le niveau, gain/polarité et métriques du backing. Rapports réels et synthétiques ont des protocoles/stockages séparés. Les résultats réels s’affichent dans Settings sous « Validation sur enregistrements réels », selon le profil Guitariste/Bassiste. Le menu « Base du conseil » privilégie les enregistrements réels lorsqu’un rapport complet compatible est disponible ; le pilote contrôlé reste consultable séparément. Pas de mélange des scores. Les contrôles restent passifs et le bouton de conseil ne modifie que le brouillon Settings. Ce corpus réduit ne constitue pas un verdict général.

## Reprise et exécution

Les scores terminés sont sauvegardés dans un checkpoint JSON distinct de la dernière campagne complète. « Reprendre les essais manquants » vérifie corpus, poids, backend, rôle et scores avant de conserver les réussites. Échecs ou poids obsolètes sont recalculés ; les doublons sont rejetés. Un rapport exporté peut également être importé pour reprise. Le banc qualité peut continuer quand l’onglet passe en arrière-plan ; aucune durée issue de ce banc n’est utilisée dans le classement de vitesse. Les WAV ne sont jamais placés dans ce checkpoint.

Vérifications de téléchargement : MD5 du fournisseur MUSDB18 `3CvfrFtGznQr1gAJhmdYpQ==` (base64) et MD5 publié Zenodo MedleyDB `dbb5b4ff5122233915d04cab4486ead1` contrôlés ; SHA256 des archives et de chaque fichier dérivé enregistrés dans le manifeste.

## Résultats

**24/24 séparations valides**, quatre configurations × six clips. Onze observations ont été conservées à l’identique après interruption, treize essais manquants exécutés lors de la reprise. FT non mesuré : aucun classement ne lui est attribué. [Rapport brut](benchmarks/real-instrument-quality-2026-10-23.json).

| Configuration | Basse médiane / minimum SI-SDR (3 morceaux) | Guitare médiane / minimum SI-SDR (3 passages, 1 morceau) |
| --- | --- | --- |
| Demucs6 CPU | 2.04 / 2.03 dB | 15.08 / 5.43 dB |
| Demucs Qualité4 GPU | 6.61 / 1.41 dB | 16.19 / 14.32 dB |
| Demucs Aperçu4 GPU | 5.99 / -0.12 dB | 16.68 / 8.94 dB |
| SW6 GPU | 2.29 / 0.76 dB | 23.61 / 18.01 dB |

### Détail des cas

| Extrait / cible | Demucs6 CPU | Qualité4 GPU | Aperçu4 GPU | SW6 GPU |
| --- | --- | --- | --- | --- |
| musdb-falcon / bass | 5.40 | 6.61 | 5.99 | 5.15 |
| musdb-reggae / bass | 2.04 | 11.86 | 10.70 | 0.76 |
| musdb-metal / bass | 2.03 | 1.41 | -0.12 | 2.29 |
| medley-rainfall-20 / guitar | 17.64 | 18.96 | 18.83 | 26.93 |
| medley-rainfall-65 / guitar | 5.43 | 14.32 | 8.94 | 18.01 |
| medley-rainfall-120 / guitar | 15.08 | 16.19 | 16.68 | 23.61 |

### Interprétation limitée à ces exports et extraits

- **Basse : Qualité4 est premier en médiane** (6,61dB), devant Aperçu (5,99), SW (2,29) et Demucs6 (2,04). SW reste meilleur que Qualité sur le cas metal (2,29 contre1,41), ce qui interdit de conclure à un gagnant sur tout morceau. Les trois compositions et styles sont différents, mais le corpus reste petit.
- **Guitare : SW est premier sur les trois passages de Rainfall**, médiane23,61dB. Ce sont trois passages d’un seul morceau : pas trois validations de styles indépendants. Qualité/Aperçu sont évalués via Autres seulement parce que les métadonnées indiquent guitares et voix exclusivement.
- **Le conseil dépend du corpus.** Sur le pilote synthétique, SW était premier pour la basse ; sur ces morceaux, Qualité4 est meilleur en médiane. Settings privilégie maintenant la base réelle disponible, avec option pour revenir au pilote. Les tableaux ne mélangent pas les deux protocoles.
- **Les valeurs concernent nos runtimes navigateur**, fenêtres courtes et exports actuels. Elles ne démontrent pas que le checkpoint SW original/UVR est globalement inférieur : corpus, découpage et pipeline diffèrent de MVSep. Aucune cause précise de l’écart n’est établie dans ce tour.
- Les scores ne remplacent pas une écoute humaine des attaques, repisses et artefacts. Le lecteur de références permet d’écouter les données utilisées. Enregistrement complet/artistic mix, stem regroupé et variante AAC doivent être distingués ; ici le mix est toujours reconstruit à partir des mêmes références.
- Pour confirmer un conseil général, obtenir davantage de compositions guitare indépendantes et comparer éventuellement les exports navigateur avec UVR sur ces mêmes extraits. Les autres backends CPU et FT ne sont pas inventés à partir des mesures présentes.


## Extension multi-styles distincte

Un [diagnostic acoustique/électrique](GUITAR_DIAGNOSTIC.md) ajoute trois compositions enregistrées, avec écoute A/B des résultats en RAM. Ces morceaux appartiennent à MUSDB **train** : résultats séparés, aucun changement des conseils et aucune validation indépendante revendiquée. L’extension vers des enregistrements hors entraînement connu reste ouverte.
