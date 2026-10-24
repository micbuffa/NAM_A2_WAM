# Comparer la guitare et la basse

Application destinée aux guitaristes et bassistes. Les séparateurs voix/instrumental ne font plus partie des prochains portages.

## Utilisation

Depuis **Multitracks → Change model / settings → Comparer à l’écoute · guitare et basse**, ou directement :

`http://127.0.0.1:8765/examples/wam/source-separation/instrument-comparison.html`

1. Télécharger au préalable les modèles souhaités dans Settings. Le comparateur ne les télécharge jamais automatiquement.
2. Garder la démo musicale, choisir un fichier local ou sélectionner un mélange du banc contrôlé (clair/acoustique/saturé, fixé à6s). Dans ces derniers cas, les boutons Référence guitare et Référence basse permettent d’écouter les pistes connues avant séparation. Choisir les mêmes 6, 15 ou 30 premières secondes pour tous les moteurs. Le décodage est stéréo à 44,1 kHz, mono dupliqué si nécessaire.
3. Cocher les modèles. Qualité4 et SW6 sont présélectionnés ; ajouter Demucs6 pour comparer deux sorties guitare dédiées. FT et Aperçu restent accessibles. Auto utilise le GPU si compatible, sinon le CPU ; une erreur ne déclenche pas de repli.
4. Préparer la comparaison. Les moteurs sont exécutés l’un après l’autre avec leurs adaptateurs de production et leurs fenêtres Auto. Tous les canaux, l’ordre, la longueur et les valeurs finies sont vérifiés avant de proposer une écoute. Annuler arrête le moteur courant ; les résultats terminés restent accessibles.
5. Choisir Original, Basse, Guitare ou Autres, puis utiliser le lecteur commun. Changer de piste conserve la position et l’état lecture/pause après chargement du nouveau WAV. La commutation peut avoir une courte interruption : ce n’est pas un test ABX aveugle ni une commutation audio sans coupure.
6. Écouter également le backing sans la piste correspondante : somme de toutes les autres sorties du modèle. Pour un modèle quatre pistes, retirer Autres enlève aussi les autres instruments qu’il contient ; cela ne mesure pas une suppression sélective de guitare.
7. Noter ses observations par modèle ; exporter le JSON et, si utile, les WAV. Aucun audio/projet n’est sauvegardé automatiquement. Les notes restent dans la page jusqu’à la prochaine comparaison ou sa fermeture.

## Grille d’écoute

| Critère | Guitare | Basse |
| --- | --- | --- |
| Conservation | Accords, notes tenues, solos présents ? | Ligne complète, notes graves présentes ? |
| Attaques | Médiator et transitoires conservés ? | Attaques distinctes du kick ? |
| Repisse | Voix, piano ou batterie audibles ? | Kick ou autres instruments dans la basse ? |
| Artefacts | Son métallique, modulation, trous ? | Graves instables, pompage, notes tronquées ? |
| Backing | Guitare restante et instruments perdus ? | Basse restante et kick altéré ? |
| Utilité | Travail de partie, remix ou export DAW ? | Travail de ligne, backing ou export DAW ? |

Comparer à volume de lecteur identique. Les gains du modèle sont conservés : pas de normalisation individuelle qui pourrait masquer une piste trop faible. Les WAV d’écoute/export sont flottants 32 bits et préservent les crêtes au-delà de ±1 ; leur pic et le nombre d’échantillons concernés sont affichés. Le volume commun du lecteur commence à 25 % pour laisser de la marge aux sommes de pistes. Baisser davantage si nécessaire : une sortie physique peut saturer malgré un fichier flottant intact. Aucun gain individuel ne change entre les modèles.

## Mesures et limites

Le JSON contient l’identité des poids, le backend réellement utilisé, le SHA-256 du fichier source, la longueur, les pics/écrêtages et les notes personnelles. Ce n’est pas le protocole de vitesse : aucune durée de ce laboratoire ne modifie les graphiques de performances ni les recommandations par défaut.

Le mix Slow Motion Dream fourni n’a **pas de stems de vérité terrain**. Une énergie élevée, une faible énergie résiduelle ou une concordance CPU/GPU ne prouve pas une meilleure séparation. Aucun SDR/SI-SDR, score communautaire ou classement de qualité n’est inventé. Les valeurs MVSep affichées dans Settings restent des références externes datées, distinctes de cet export navigateur et de cette écoute.

Une future campagne objective exige des stems originaux dont les droits permettent l’utilisation : même mix, même découpage et alignement temporel exact, protocole documenté, évaluation séparée guitare/basse et plusieurs morceaux/styles. Les sorties « Autres » ne doivent pas recevoir artificiellement un score de guitare dédiée. Choisir de nouveaux modèles instrumentaux après ces observations, pas sur le seul nom de leur architecture.

## Validation technique du 23 octobre 2026

Même extrait musical6s : Demucs6 CPU, Qualité4 GPU et SW6 GPU ont produit tous leurs canaux avec la bonne longueur. Après passage aux WAV flottants, deux séries GPU supplémentaires ont réussi. Dans la dist, les WAV ont été décodés avec une durée6s et sans erreur ; la commutation en lecture a conservé la position (0,218s avant /0,419s après) et celle en pause a conservé l’état pause. Compte rendu exporté depuis l’interface : [instrument-comparison-2026-10-23.json](benchmarks/instrument-comparison-2026-10-23.json). Ces contrôles valident l’outil et les sorties numériques ; ils ne remplacent pas une écoute critique ni une évaluation avec stems originaux.
