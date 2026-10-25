# Références locales et revue exploratoire en aveugle

P4.12d.2a : outillage de validation. L’acquisition de références plus indépendantes et la collecte d’avis humains restent P4.12d.2b, non réalisés par le simple fait d’exécuter ce banc.

## Utilisation

Ouvrir `reference-evaluation.html` dans le prototype `multitracks`, depuis un serveur HTTP. Dans le worktree de cette session : `http://127.0.0.1:8765/test-data/evaluation-worktree/examples/wam/source-separation/reference-evaluation.html` (alias local vers le worktree, non portable). Lien également disponible depuis les conseils instrumentaux de Settings.

1. Importer deux exports audio de même durée, même origine temporelle : cible guitare/basse, puis somme de tous les autres instruments. Le banc reconstruit son mix exact ; ce n’est pas le mix master artistique, éventuellement traité autrement.
2. Indiquer titre, droits, origine commune, instrument et provenance. Les prises originales exigent une date réelle. Les indications d’entraînement restent des déclarations utilisateur non auditées ; aucun label ne constitue une preuve automatique de non-exposition.
3. Choisir début et durée1/6/15/30s. Les deux fichiers complets doivent avoir la même longueur décodée. Pas de padding ni de recherche de délai. Le mono est dupliqué explicitement ; décodage/rééchantillonnage44,1kHz par Web Audio. Deux canaux maximum, dix minutes et300Mio maximum par fichier : limite du laboratoire, pas promesse de faible pic mémoire pendant décodage.
4. Préparer : contrôle de finitude, énergie, alignement de longueur, reconstruction. Gain commun éventuel pour pic≤0,9, jamais de normalisation individuelle. Hashes du fichier compressé ET du PCM sélectionné (Float32 little-endian, canaux successifs) enregistrés.
5. Choisir des modèles déjà présents dans le cache. Auto préfère GPU si compatible, sinon CPU, sans repli au cours du test. Les modèles non installés restent en erreur ; pas de téléchargement implicite. Pour noter Other comme guitare, il faut déclarer explicitement qu’il ne contient aucun autre instrument hors les catégories basse/batterie/voix. Cette déclaration doit être vérifiée musicalement : le logiciel ne détecte pas les instruments.
6. Lancer la comparaison. SI-SDR/SNR/gain/polarité/amélioration et métriques du backing suivent InstrumentQuality.js. Une seule fenêtre d’un morceau ne produit pas un classement général. Les dates de début/fin servent à tracer la campagne ; ce n’est pas le protocole de benchmark T1 et `timeComparisonEligible:false` l’explicite.

## Écoute

La revue comprend les résultats plus une référence cachée ; une référence explicite reste disponible. Ordre aléatoire par tirage cryptographique, permutation enregistrée uniquement après validation explicite. Les noms de modèles, mesures et détails JSON sont masqués dans la vue de notation. Cela masque la correspondance dans l’interface, pas face à un participant inspectant volontairement le code ou les exports.

Instrument et backing sont sélectionnables, même lecteur et volume commun (25% initial), position/état lecture conservés. Une seule URL Blob active ; les anciennes sont révoquées, les callbacks tardifs ne peuvent relancer une ancienne piste. Les notes sont toutes vides au départ, entre0et100, sens «plus haut=meilleur» : absence de repisse, absence d’artefacts, attaques/sustain, timbre, utilité du backing. Pseudonyme et chaîne d’écoute requis. «Terminer et révéler» exige toutes les notes et verrouille la revue. Les événements de lecture ne prouvent ni attention ni écoute complète.

**Ce n’est pas une étude MUSHRA/ABX standardisée ni une étude de population.** Aucun avis humain n’est créé pendant les tests automatiques. Un export avant validation explicite porte seulement un état non terminé, sans notes ni correspondance anonyme/modèle. Les tests unitaires emploient des notes fictives en mémoire pour vérifier la validation ; elles ne sont pas publiées comme observations humaines.

## Traçabilité et confidentialité

`local-reference-evaluation-v1` et `exploratory-blind-review-v1`, distincts des corpus précédents. Le rapport conserve fichiers/hashes, recette, déclaration de provenance, source de code hachée (périmètre indiqué, pas tout le graphe de dépendances), navigateur, visibilité, processeurs logiques, mémoire rapportée et informations GPU si exposées. Le CPU physique et la configuration matérielle complète ne sont pas inventés depuis ces API. Poids/version/backend exacts de chaque essai.

Rapport exporté localement en JSON sur demande ; aucune API distante d’inférence, pas de sauvegarde de PCM/projet en IndexedDB ni de modification des recommandations Settings. Recharger/fermer ou changer les références perd l’audio et la campagne en RAM. Les URL de fichiers et les chemins privés complets ne sont pas enregistrés, seuls les noms choisis par le navigateur le sont.

## Validation de développement du24octobre2026

Deux sinusoïdes mono1s générées localement (220Hz cible,73Hz backing), provenance `development-fixture`, testent import/duplication/gain/hash, séparation SWGPU et lecture. Il ne s’agit ni de prises originales de guitare, ni d’une nouvelle validation indépendante, ni d’une mesure de qualité exploitable pour un classement. Rapport technique archivé séparément dans `benchmarks/reference-evaluation-technical-2026-10-24.json` ; aucune note humaine, revue non terminée.

Un second contrôle de la version finale et de la distribution complète ce test. Les résultats et limites sont consignés dans le fichier racine MODEL_EVALUATIONS.MD. Ne pas compléter la campagne P4.12d.2b sans vrais fichiers autorisés et observations humaines explicites.
