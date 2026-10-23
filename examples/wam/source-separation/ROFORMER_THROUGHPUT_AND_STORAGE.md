# Débit GPU et sauvegarde PCM sans grosse tâche UI

Validation du22 octobre2026, Chrome local. Rapport brut : [roformer-throughput-storage-2026-10-22.json](benchmarks/roformer-throughput-storage-2026-10-22.json). Les résultats sont ceux de cette machine, avec une mesure par variante ; ce n'est pas une garantie de performance sur tout GPU.

## Choix du découpage

Même checkpoint, mêmes fenêtres4s et raccords, même mix musical6s, deux fenêtres calculées. Chaque variante est compilée puis préchauffée avant le relevé. File GPU drainée et pause Worker4ms entre étapes, comme dans la correction précédente.

| Variante | Étapes | Calcul6s | RAF p95 | Plus grand intervalle RAF |
|---|---:|---:|---:|---:|
|100 nœuds, référence précédente |72 |10,22s |~9ms |33,7ms |
|200 nœuds |36 |10,81s |~9ms |9,3ms |
|400 nœuds, retenu |18 |9,24s |~9ms |25,1ms |
|Frontières des blocs Transformer |38 |9,54s |~9ms |25,3ms |
|800 nœuds |9 |9,52s |~9ms |34,0ms |

Réduire arbitrairement le nombre d'étapes n'accélère donc pas toujours. Le plan400 est le meilleur de ce relevé court (~9,5% devant100), et800 n'apporte pas de gain supplémentaire. Les douze canaux de **chaque variante** respectent individuellement les seuils de la référence CPU/PyTorch ; les seuils n'ont pas été modifiés. Le DSP et les poids n'ont pas changé.

Le générateur `tools/prepare-roformer-stage-plan.py` accepte `--nodes-per-stage` (400 par défaut) et `--alignment uniform|transformer`. Le plan de production contient18 étapes. Il se régénère depuis le checkpoint épinglé avec onnx1.19.1, par exemple `/tmp/nam-latency-export/bin/python tools/prepare-roformer-stage-plan.py`. Une seconde génération est comparée octet pour octet. Les sessions et le mécanisme de barrière GPU restent ceux de `CooperativeOnnxSession` ; aucun patch ORT.

## Cause de la pause de sauvegarde et correction

`packAudio` exposait les canaux Float32Array du lecteur, puis un unique `objectStore.put(record)` devait sérialiser tout le PCM avant de rendre la main. Une API IndexedDB asynchrone ne rend pas ce coût de sérialisation initial automatiquement asynchrone.

Un test isolé crée le volume de données d'un original stéréo214,9s et de six stems stéréo60s (~203Mo), hors thread UI, puis le transfère pour la sauvegarde :

| Mesure | Ancien Float32Array | Nouveau Blob |
|---|---:|---:|
|Appel synchrone `IndexedDB.put` |357ms |12,9ms |
|Plus grand intervalle RAF pendant sauvegarde |342ms |41,7ms |
|Temps total, attente de mesure incluse |591ms |1234ms |

**La sauvegarde totale est plus lente dans ce test ; son gros blocage UI est réduit.**

`SessionAudioEncoding.js` prépare les canaux dans des Blobs en copiant au maximum65536 frames (256Kio) à chaque opération. Après environ4ms de travail cumulé, elle cède à une nouvelle tâche avant de continuer. C'est un budget coopératif, pas une garantie qu'un appel natif prendra moins de4ms : le plus gros appel de copie du test isolé est11,6ms. Les Blobs sont composés avant d'ouvrir la transaction d'écriture, puis un seul enregistrement est publié atomiquement. Aucun AudioBuffer/ArrayBuffer du lecteur n'est transféré, détaché ni modifié.

Le format interne porte `pcmStorageVersion:1`, la longueur, l'ordre des octets et un Blob par canal. La lecture reconstruit les Float32Array via `Blob.arrayBuffer()` avant la validation PCM existante. Les anciens enregistrements sans marqueur restent lisibles ; pas de changement de version de la base ni du cache des modèles. Un échec de préparation ou de quota ne publie pas une réussite ni un enregistrement partiel. Les tests vérifient l'identité binaire, les sous-vues, zéro signé, blocs/partiel/stéréo, endian différent, format invalide et quota. Le gros test navigateur contrôle longueur et premier/milieu/dernier échantillons de chaque canal après restauration ; ne pas le présenter comme un hash intégral de203Mo.

Références API : [Blob accepte TypedArray et Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob/Blob), [lecture asynchrone du contenu](https://developer.mozilla.org/en-US/docs/Web/API/Blob/arrayBuffer).

## Validation dans le host

Jet, extrait60s, original214,9s conservé. Lecture de l'original, puis six stems pendant la séparation ; mute Piano activé puis rétabli, scroll bas/haut, projet sauvegardé automatiquement et restauré en pause avec Play disponible.

- Premier bloc :3,37s ;20 fenêtres ; traitement62,42s. Essai précédent à72 étapes :3,92s /67,89s. Gain observé d'environ8% sur cet essai long, mais sessions/conditions temporelles différentes : pas un benchmark statistique contrôlé.
- RAF p95~9,4ms. Maximum cumulé115,8ms ; Long Task maximale80ms déjà présente avant la fin, pendant la fenêtre d'interactions. Des pauses ponctuelles demeurent. Ne pas annoncer une fluidité parfaite ni un retour à une garantie stricte de frame16ms.
- Finalisation : `sessionPackAudio`1,02ms ; plus grosse copie Blob1,38ms ; composition4,4ms ; `sessionIndexedDbPut`3,67ms. Le gros coût synchrone de sérialisation identifié est supprimé sur cet essai. Les métriques mesurent les appels JS/native synchrones, pas le temps disque complet.
- Les métriques optionnelles `?uiMetrics=1` affichent ces étapes dans UI performance. Elles sont désactivées dans l'URL utilisateur normale.

L'objectif d'un calcul systématiquement plus rapide que la durée audio n'est **pas atteint** ici :60s demandent62,4s. La disponibilité progressive conserve une avance initiale, mais une lecture sans attente dépend de la machine. Le prochain portage de modèle reste MDX-Net Inst HQ4/5 ; des optimisations supplémentaires pourront viser le réseau et le DSP, en conservant les comparaisons audio. La restauration valide encore le PCM sur le thread principal : elle reste un coût distinct à optimiser si nécessaire.
