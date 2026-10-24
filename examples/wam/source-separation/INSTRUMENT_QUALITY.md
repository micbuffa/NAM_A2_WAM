# Évaluation guitare / basse — pilote contrôlé

## Ce qui est mesuré

Le banc `instrument-quality.html` utilise les cinq modèles intégrés, leurs poids et leurs adaptateurs de production, sans repli de backend. Trois extraits stéréo de six secondes à44,1kHz :

| Cas | Guitare existante dans le projet | Traitement |
| --- | --- | --- |
| Clair | CleanChords.mp3 | RMS0,08 |
| Acoustique | FolkAcousticDI.mp3 | RMS0,08 |
| Riff saturé | ClassicRockRiff.mp3 | tanh(3x), puis RMS0,08 |

Les SHA-256 des fichiers figurent dans `QUALITY_CASES`. Basse harmonique synthétique (fondamentale55–82Hz, notes0,375s, RMS0,07) et batterie synthétique (kick/bruit, RMS0,055) générées avec une graine fixe par cas. Un gain commun éventuel limite le pic du mix à0,9 et conserve les proportions des références. Les différences de décodeurs MP3 entre navigateurs peuvent modifier très légèrement les échantillons ; le même mix est construit une seule fois par cas et transmis identiquement à chaque moteur dans une campagne. Aucun fichier musical externe n’est téléchargé, aucun nouveau droit de redistribution des enregistrements n’est présumé. Les mélanges et références sont construits en RAM à partir des actifs existants.

Les sources s’additionnent pour produire exactement le mix, à la précision Float32 près. Sans piano ni voix dans ces mélanges, Autres des modèles quatre pistes est comparé à la référence guitare. Cela mesure une récupération de guitare **dans ce cas particulier**, pas une guitare séparée sur une chanson comportant du piano ou d’autres instruments.

## Métriques

Calcul stéréo concaténé, retrait des moyennes, projection par un gain scalaire commun aux deux canaux, aucun recalage temporel ni filtre correcteur :

- **SI-SDR** : rapport énergie de la projection de la référence / énergie de l’erreur restante. Plus haut = meilleure fidélité selon cette définition. Définition inspirée de [Le Roux et al., SDR — Half-Baked or Well Done?](https://www.merl.com/publications/TR2019-013). Ne pas confondre avec BSS Eval SDR ou avec les scores MVSep.
- **Amélioration** : SI-SDR de l’estimation moins celui du mix non séparé face à la même référence. Peut être négative.
- **SNR** : niveau conservé, mesure également les erreurs de gain. Complète le SI-SDR qui accepte une remise à niveau.
- **Gain projeté** et polarité : une bonne forme avec une piste trop faible ou inversée reste visible dans le JSON.
- **Backing** : mêmes mesures sur la somme des autres sorties face à mix moins la référence de l’instrument. Ne pas utiliser le seul résidu de remix comme note d’isolation.

Silence de référence ou de sortie, données non finies, mauvaise longueur/backend, poids modifiés ou cas manquant invalident le score correspondant. Valeurs extrêmes bornées à±120dB pour sérialisation ; ce plafond numérique ne représente pas une précision de mesure. Trois cas exactement requis, sans doublon. Médiane des trois cas et plus faible cas affichés ; ce ne sont pas trois répétitions ni un intervalle de confiance.

## Conseils dans Settings

**Guitariste / Bassiste** choisit le tableau de l’instrument. Un modèle dont au moins un extrait n’améliore pas le SI-SDR du mix brut est écarté du conseil automatique : une bonne médiane ne doit pas masquer cette régression. Ce garde-fou propre au pilote n’est pas un seuil perceptuel universel. Parmi les candidats restants, le conseil du banc retient la médiane SI-SDR la plus élevée parmi les modèles disponibles sur GPU si possible, sinon CPU. Pour le conseil Guitariste destiné aux vrais morceaux, seuls les modèles avec une sortie guitare dédiée sont éligibles ; Autres reste visible dans le tableau du pilote. Les mesures sont propres au backend : une campagne GPU ne fabrique pas de chiffres CPU ; sans couverture du backend disponible, aucun conseil automatique de qualité n’est donné. Une campagne complète et des identités de poids correspondantes sont nécessaires ; pas de classement des candidats non évalués. Un modèle en échec sur tous les cas est exclu, jamais promu.

Ce choix est **expérimental et propre aux mélanges de ce banc**. Aucun changement du modèle en cours lors d’un résultat, d’une ouverture de Settings ou du changement de profil. « Utiliser ce conseil instrumental » reste une action explicite, soumise au Valider/Annuler habituel de Settings. Les priorités vitesse et premier audio existantes restent séparées et utilisent leur propre protocole de temps.

Les résultats ne conservent que des métadonnées dans `nam-instrument-quality.v1` ; pas de PCM ni de projet. Une campagne annulée n’écrase pas la dernière campagne terminée. Le JSON exporté contient sources, poids, backend et scores ; aucun classement subjectif n’est inventé.

## Références externes et suite

Le [classement guitare MVSep](https://www.mvsep.com/quality_checker/leaderboard/guitar) et sa [page basse](https://www.mvsep.com/algorithms/37) sont des observations externes distinctes : SW guitare9,012 et basse14,62dB à la consultation du23octobre2026. Les réglages, fenêtres et jeux de données diffèrent de nos exports ; aucun score externe n’est attribué à nos résultats.

Le [jeu guitare MVSep](https://www.mvsep.com/quality_checker/custom_leaderboards) ne distribue pas ses références originales publiquement. [MUSDB18](https://sigsep.github.io/datasets/musdb.html) propose bass/drums/vocals/other, sans guitare dédiée systématique, avec conditions par morceau. Ces corpus ne remplacent pas automatiquement des références guitare accessibles.

**Limites du pilote** : provenance d’entraînement/non-recouvrement non vérifiée pour ces enregistrements, trois guitares du projet, notes de basse/batterie artificielles, absence de voix/piano, extraits courts, pas d’écoute humaine réalisée ni de notation psychoacoustique. Les mesures combinent erreurs de contenu, repisse et artefacts ; elles ne les isolent pas en catégories perceptuelles. Aucune garantie sur la conservation des attaques ou des graves de toutes les musiques. La recommandation définitive pour les vrais morceaux reste à confirmer sur davantage de styles et des pistes originales autorisées. En attendant, garder les modèles manuellement sélectionnables et distinguer la préférence de qualité de la vitesse.

## Reproduire l’écoute

Les trois mélanges et leurs références sont également accessibles dans le lecteur A/B : [clair](instrument-comparison.html?fixture=clean), [acoustique](instrument-comparison.html?fixture=acoustic), [riff saturé](instrument-comparison.html?fixture=driven). Le menu « Extrait de comparaison » permet de passer de l’un à l’autre ; ces cas sont fixés à6s. « Référence guitare » et « Référence basse » donnent les pistes connues, sans séparation. Comparer ensuite les sorties et backings avec le même lecteur et volume. Les actifs sont vérifiés par leur SHA256 et la recette est partagée avec le banc numérique. Le SHA du JSON d’écoute correspond au fichier guitare source ; `recipeId`/`controlledProtocol` identifient le mélange généré.

## Résultats

Campagne terminée : **15/15 séparations valides**, cinq modèles × trois extraits. Rapport brut exporté depuis l’interface : [instrument-quality-2026-10-23.json](benchmarks/instrument-quality-2026-10-23.json).

| Modèle | Backend testé | Guitare médiane / minimum (dB) | Basse médiane / minimum (dB) |
| --- | --- | --- | --- |
| Roformer SW6 | webgpu | 23.53 / 21.37 | 22.10 / 20.19 |
| Demucs Qualité4 | webgpu | 20.51 / 18.78 | 18.99 / 14.44 |
| DemucsFT | wasm | 19.52 / 14.37 | 18.95 / 15.04 |
| Demucs Aperçu4 | webgpu | 18.88 / 7.98 | 17.86 / 6.36 |
| Demucs6 | wasm | 10.76 / -8.24 | 9.49 / -0.65 |

### Détail par extrait (SI-SDR dB)

| Modèle | Clair guitare / basse | Acoustique guitare / basse | Saturé guitare / basse |
| --- | --- | --- | --- |
| Demucs6 | 18.61 / 17.89 | -8.24 / -0.65 | 10.76 / 9.49 |
| DemucsFT | 19.52 / 18.95 | 14.37 / 15.04 | 21.49 / 21.14 |
| Demucs Qualité4 | 20.51 / 18.99 | 18.78 / 14.44 | 22.31 / 19.75 |
| Demucs Aperçu4 | 18.88 / 17.86 | 7.98 / 6.36 | 21.03 / 19.31 |
| Roformer SW6 | 23.53 / 22.10 | 21.37 / 20.19 | 24.60 / 23.32 |

### Ce que ces mesures permettent de conclure

- **SW6** est le meilleur des cinq sur les six comparaisons instrument/extrait de ce pilote. Son plus faible cas reste supérieur aux minima des autres. Le conseil GPU des deux profils pointe donc vers SW6, avec une piste guitare dédiée pour le profil guitariste.
- **Qualité4** offre ici une récupération proche de FT et reste le choix de vitesse sur le benchmark séparé. La différence médiane de basse Qualité/FT (~0,04dB) est trop faible pour en tirer une préférence sonore sur ce corpus minuscule. La guitare dans Autres demeure mélangée aux autres instruments sur une vraie chanson.
- **FT** conserve une bonne récupération sur les trois mélanges, mais ses quatre spécialistes sont coûteux ; ce pilote ne prouve aucun gain de qualité systématique justifiant ce surcoût face à Qualité4.
- **Aperçu4** est moins régulier : le cas acoustique réduit nettement son score. Son intérêt reste l’écoute précoce, mesurée séparément, et non la meilleure fidélité de ce pilote.
- **Demucs6** échoue sur la guitare acoustique de ce mélange : gain projeté−20,02dB, SI-SDR−8,24dB, amélioration−7,00dB face au mix. Les deux autres cas sont meilleurs : ce n’est pas un résultat universel sur les guitares acoustiques. Il est exclu du conseil guitare de ce banc par le garde-fou contre une régression cachée par la médiane.
- **CPU seul** : Demucs6 et FT ont été mesurés sur CPU, les trois autres sur GPU. Une machine sans GPU n’obtient pas de conseil automatique de qualité tant que ses candidats CPU n’ont pas tous été évalués ; les mesures CPU de vitesse et la sélection manuelle restent disponibles.

Ces observations décrivent une fidélité numérique à des références contrôlées. Elles ne sont pas une appréciation d’écoute des attaques, de la repisse ou des artefacts, et n’établissent pas un classement définitif pour les vrais backing tracks. Le comparateur A/B et les références sont proposés pour cette écoute complémentaire.


### Complément du 23 octobre : corpus enregistré

Les résultats ci-dessus restent ceux du pilote contrôlé. Settings préfère désormais le [corpus réel limité](REAL_INSTRUMENT_CORPUS.md), avec choix explicite du pilote pour comparaison, sans mélange de scores. Sur les enregistrements réels mesurés, SW conserve le meilleur résultat guitare, tandis que Qualité4 a la meilleure médiane basse. Ce changement illustre pourquoi le pilote synthétique ne suffisait pas à généraliser les conseils.
