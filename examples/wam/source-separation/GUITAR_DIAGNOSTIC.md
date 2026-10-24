# Diagnostic guitare acoustique et électrique

Cette extension sert à explorer des styles absents du premier corpus. Elle **ne constitue pas une validation indépendante** : les trois morceaux appartiennent explicitement au split **train de MUSDB18**. Leur mémorisation par les modèles est possible. Les conseils Settings restent fondés sur le corpus initial, sans fusionner ces scores.

## Références enregistrées

| Composition | Artiste | Guitares déclarées | Source |
| --- | --- | --- | --- |
| Country1 | Music Delta | Deux guitares acoustiques | MUSDB train, preview7s |
| Grunge | Music Delta | Deux guitares électriques saturées | Idem |
| Take A Step | Meaxic | Guitare électrique claire et guitare saturée | Idem |

Trois compositions, **deux artistes**, six secondes par composition. Les labels des [métadonnées officielles MedleyDB](https://github.com/marl/medleydb/tree/master/medleydb/data/Metadata) déclarent `has_bleed: no` et uniquement guitares, basse, batterie et voix dans les stems. Ici, le flux `Other` constitue une référence guitare regroupée. Sweet Lights et The So So Glos ont été écartés : synthés/pianos/percussions ou effets supplémentaires rendraient ce raccourci invalide. Ce choix ne garantit pas l’absence de repisse réelle à l’écoute.

Sources : [MUSDB18 et format des flux](https://sigsep.github.io/datasets/musdb.html), [preview officiel](https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip), [licences par morceau](https://github.com/sigsep/website/blob/master/content/datasets/assets/tracklist.csv). Audio de recherche non commerciale, attribution et conditions MedleyDB/MUSDB applicables ; aucune redistribution des WAV. SHA256 de chaque source, inventaire instrumental et split conservés dans `GuitarDiagnosticDefinition.js`.

Cambridge Mixing Secrets a également été examiné : sa [FAQ officielle](https://www.cambridge-mt.com/ms3/mtk-faq/) demande un accord direct des contributeurs pour un projet de recherche. Aucun de ces fichiers supplémentaires n’a été téléchargé ni aucun artiste contacté pour cette campagne.

## Préparation

L’archive MUSDB et le CSV de licences sont ceux du [corpus initial](REAL_INSTRUMENT_CORPUS.md). Télécharger également ces trois fichiers officiels :

```sh
curl -L --fail https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/MusicDelta_Country1_METADATA.yaml -o /tmp/MusicDelta_Country1_METADATA.yaml
curl -L --fail https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/MusicDelta_Grunge_METADATA.yaml -o /tmp/MusicDelta_Grunge_METADATA.yaml
curl -L --fail https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/Meaxic_TakeAStep_METADATA.yaml -o /tmp/Meaxic_TakeAStep_METADATA.yaml
python3 tools/prepare-guitar-diagnostic-corpus.py --musdb /tmp/MUSDB18-7-STEMS.zip --metadata /tmp --licenses /tmp/musdb-tracklist.csv --output test-data/source-separation/guitar-diagnostic
```

Le préparateur vérifie les empreintes et labels officiels, ne fait aucun accès réseau et n’extrait que les membres connus. Flux3 = guitare ; backing = flux1+2+4 ; mix reconstruit depuis ces mêmes références. Stéréo44,1kHz flottant32bits,264600frames, un gain commun si nécessaire. Vérification navigateur des hashes, du format et de la reconstruction avant inférence. Audio local sous `test-data/`, ignoré Git et exclu de dist.

## Exécution et écoute

[Ouvrir le diagnostic local](http://127.0.0.1:8765/examples/wam/source-separation/real-instrument-quality.html?corpus=guitar-diagnostic).

Quatre configurations par défaut : Demucs6 CPU ; Qualité4, Aperçu4 et SW6 GPU si disponible, sinon CPU sans repli. FT est facultatif et non mesuré tant qu’il n’est pas exécuté. Résultats objectifs SI-SDR/SNR/niveau et backing ; ces mesures ne sont pas des notes perceptuelles.

Rapports `guitar-diagnostic-quality-v1`, manifeste `guitar-diagnostic-corpus-v1`, clés navigateur `nam-guitar-diagnostic-quality.v1` et checkpoint `.partial.v1`. Une reprise ne peut pas mélanger ce corpus avec le corpus initial ou le pilote synthétique. Aucun nouveau conseil Settings ni choix automatique issu de ces données train.

Après calcul, choisir un extrait et « Charger cet extrait local » pour comparer mix, référence, backing et résultats des modèles. Même lecteur, même volume initial25%, position et état lecture/pause conservés au changement de piste. Résultats audio en RAM bornée à128Mio ; les plus anciens sont évincés si nécessaire. Aucun PCM dans les rapports JSON : après rechargement/reprise, seuls les résultats effectivement recalculés restent audibles. Références chargées à la demande, URL Blob libérées au changement/fermeture.

## Résultats

**12/12 séparations valides**, trois nouvelles compositions × quatre configurations de production. FT non mesuré. [Rapport brut](benchmarks/guitar-diagnostic-quality-2026-10-23.json).

| Composition | Demucs6 CPU | Qualité4 GPU (Autres) | Aperçu4 GPU (Autres) | SW6 GPU |
| --- | --- | --- | --- | --- |
| Music Delta - Country1 | 5.43 dB | 5.31 dB | 5.32 dB | 8.88 dB |
| Music Delta - Grunge | 3.56 dB | 4.47 dB | 4.24 dB | 6.91 dB |
| Meaxic - Take A Step | 0.66 dB | 0.01 dB | 0.41 dB | 2.64 dB |

SW a le meilleur SI-SDR sur chacun de ces extraits, avec une médiane de6,91dB ; Qualité4 médiane4,47dB ; Aperçu4 4,24dB ; Demucs6 3,56dB. Le cas Meaxic reste difficile (SW2,64dB, autres0,01–0,66dB). Cela décrit uniquement la fidélité mesurée des exports navigateur sur ces fenêtres courtes, sans jugement perceptuel inventé. Le score faible justifie une écoute de la guitare et du backing, pas une affirmation de rendu excellent.

Les trois nouvelles compositions s’ajoutent à Rainfall dans les ressources de diagnostic : quatre compositions guitare disponibles au total, trois artistes/projets, mais des protocoles et statuts d’entraînement distincts. Ne pas calculer une médiane mélangeant les trois passages Rainfall et ces trois morceaux comme s’il s’agissait de six compositions indépendantes.

Contrôles audio : références et sorties6s décodées sans erreur. Bascule référence→SW en lecture0,190→0,433s, sans retour au début ; bascule backing en pause conservée à4,534s. Ce contrôle de lecture ne constitue pas une appréciation humaine des artefacts.

Validation logicielle : **496 tests Node réussis**, dont huit tests Python des deux préparateurs exécutés dans deux tests Node ; définition, séparation des protocoles, exclusion des conseils, reprise, limites RAM, copies et éviction testées. Dist reconstruite, fichiers audio de recherche exclus.

La validation générale reste ouverte : davantage d’artistes, compositions indépendantes d’entraînement connu, contextes plus longs et écoute humaine des attaques/artefacts. SCNet et MDX Extra Q seront étudiés après cette étape, sans promesse de portage avant vérification des droits, contrat de tenseurs et parité audio.
