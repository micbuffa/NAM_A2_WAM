> **Périmètre révisé le 23 octobre 2026** : guitare et basse uniquement. Les recommandations de portage vocal ci-dessous sont historiques et annulées. MDX-Net Inst HQ4/5, MDX23C InstVoc, MelBand vocal, ViperX vocal et restauration vocale sont retirés du catalogue de recherche visible. Prochaine étape : évaluation comparée des pistes guitare/basse des modèles intégrés ; de nouveaux candidats instrumentaux seront retenus selon le bénéfice mesuré, leur compatibilité navigateur et leurs droits. SCNet et MDX Extra Q restent à étudier, sans priorité de portage arrêtée.

# Nouveaux modèles et fenêtres ONNX — étude du 22 octobre 2026

**Statut actualisé : BS Roformer SW est porté et disponible en expérimental ; les sections d’audit initiales ci-dessous conservent leur contexte. Voir ROFORMER_VALIDATION.md.**

L’interface reste un lecteur pour guitaristes : le choix manuel de segments a été retiré. Le host utilise automatiquement les fenêtres adaptées au moteur. Le menu **durée du morceau / extrait** reste disponible et indépendant.

Les huit familles demandées figurent dans **Change model / settings → Autres modèles · étude de compatibilité**. Ce panneau contient des usages, états et sources ; il ne présente aucun modèle non testé comme téléchargeable ou exécutable. Les trois modèles de production expérimentale existants restent les seuls choix du menu Model. La priorité de portage proposée est **BS Roformer SW six sources**, puis **MDX-Net Inst HQ**, puis les variantes vocales Roformer.

## D’où viennent les 7,8 secondes ?

Ce n’est pas une limite du format ONNX. Dans notre adaptateur `OnnxCoreModel.js`, `validLength()` impose **343 980 échantillons à 44,1 kHz**, soit 7,8 s. Le DSP en amont complète les entrées courtes à cette fenêtre, puis recadre les sorties. Un segment extérieur de 1 s fait donc encore calculer cette grande fenêtre. Les mesures locales sur le même extrait de 10 s ont donné 27,4 s à segments 1 s, 16,4 s à 2 s et 5,5 s en Auto.

Dans [HTDemucs amont](https://github.com/facebookresearch/demucs/blob/main/demucs/htdemucs.py), le mode `use_train_segment` réutilise la longueur d’entraînement, complète les entrées courtes et refuse les plus longues. Le [README Demucs](https://github.com/facebookresearch/demucs#separating-tracks) signale le maximum de 7,8 s des modèles Hybrid Transformer. Il faut distinguer cette configuration Demucs, les formes de l’export et les capacités générales d’ONNX.

### Peut-on réellement calculer moins ?

**Oui, c’est une piste d’export à tester**, pas un changement du menu actuel. Une expérience serait de préparer des exports statiques 2 s et 4 s, ou un export à axe temporel dynamique, en maîtrisant le mode de longueur d’inférence du modèle. Il faudrait adapter ensemble les branches audio/spectrogramme, les FFT et les formes internes ; changer seulement `validLength()` ou la métadonnée d’une entrée ne suffit pas.

Protocole proposé : référence PyTorch avec exactement le même mode d’inférence et la même durée ; comparaison de tous les stems après export sur CPU, puis WebGPU ; contrôle des derniers échantillons, raccords, énergie et finitude ; écoute comparative contre la configuration 7,8 s ; mesure durée totale/premier bloc/mémoire. Le contexte musical change : une référence courte ne sera pas nécessairement identique à l’inférence 7,8 s. La réduction de calcul attendue est une hypothèse à mesurer, pas un résultat acquis. Cette tâche ne produit pas de nouvel export Demucs.

## Priorité 1 : BS Roformer SW six sources

L’[export ONNX d’elicwhite](https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx) expose six sources dans l’ordre **basse, batterie, autres, voix, guitare, piano**, avec variantes de poids FP16 (~336 Mo) et FP32 (~669 Mo). Il prend et retourne des spectrogrammes ; notre adaptateur HTDemucs n’est donc pas réutilisable tel quel.

Le [projet navigateur associé](https://github.com/elicwhite/bs-roformer-web) fournit export, corrections de graphe pour WebGPU et DSP JavaScript. Son script d’export utilise par défaut des fenêtres de **4 s** : autre preuve que 7,8 s n’est pas une limite ONNX. Cette démonstration rend le portage plausible, mais ne valide ni notre runtime épinglé ni la qualité des six pistes dans notre host.

Le [classement guitare MVSep consulté](https://www.mvsep.com/quality_checker/leaderboard/guitar) place **BS Roformer SW (UVR5.6)** en tête, SDR guitare 9,0120. C’est un résultat sur ce classement et ce jeu ; il ne prouve pas une supériorité universelle, ni l’identité de l’export tiers avec le calcul de cette soumission. Cela justifie bien la priorité pour notre usage guitare.

La fiche de l’export annonce MIT, tandis que le [checkpoint source réhébergé](https://huggingface.co/enerjazzer/BS-ROFO-SW-Fixed) indique une licence inconnue. Le projet d’export explicite lui-même cette incertitude de provenance. Ne pas assimiler automatiquement licence du code et droits des poids ; clarifier cette provenance avant une redistribution publique. Rien n’est téléchargé automatiquement par le panneau d’étude.

### Travail de portage nécessaire

1. Épingler révisions, fichiers, tailles, SHA-256 et références de provenance ; contrôler compatibilité de notre ORT et de ses opérateurs WebGPU.
2. Adapter le contrat six sources, le DSP spectrogramme, normalisation, padding et overlap-add. Le lecteur et la sauvegarde acceptent déjà six stems.
3. Valider un signal court puis un extrait musical de 5–10 s sur CPU de référence et GPU, en comparant tous les stems ; ne pas conclure sur la seule batterie.
4. Réutiliser le téléchargement avec progression, intégrité et cache du host ; ajouter les origines requises de manière explicite. Aucun chemin CKPT/PyTorch dans le navigateur.
5. Étendre à un morceau entier, lecture progressive, annulation, cache, sauvegarde et export. Vérifier mémoire et réactivité avec guitare live.
6. Ajouter au menu exécutable seulement après ces validations. En cas d’opérateurs GPU incompatibles, indiquer clairement un repli CPU ou conserver la référence en étude.

## Toute la sélection

| Modèle / variante précise | Sorties et intérêt | Artefact repéré | Faisabilité pour ce host et priorité |
|---|---|---|---|
| **BS Roformer SW six sources** | Six instruments, guitare dédiée | Export ONNX WebGPU et démonstration navigateur ci-dessus | **Premier test de portage** ; nouveau DSP/adaptateur, provenance des poids à clarifier |
| **MDX-Net Inst HQ 4 / 5** | Instrumental sans voix et voix complémentaires | `UVR-MDX-NET-Inst_HQ_4.onnx` / `_5.onnx` dans le [catalogue UVR](https://raw.githubusercontent.com/TRvlvr/application_data/main/filelists/download_checks.json) | **Deuxième portage pragmatique** : ONNX existant, mais contrat MDX, FFT/normalisation/reconstruction distincts ; CPU/GPU à valider |
| **MDX23C-InstVoc HQ** | Deux sources voix/instrumental | `MDX23C-8KFFT-InstVoc_HQ.ckpt` + `model_2_stem_full_band_8k.yaml`, référencés par UVR | CKPT non exécutable par ORT Web ; export MDX23C ou futur backend. Ne pas confondre avec MDX-Net ONNX |
| **MelBand Roformer**, choisir un checkpoint Kim ou ViperX | Voix/instrumental | Le [dépôt de Kim](https://github.com/KimberleyJensen/Mel-Band-Roformer-Vocal-Model) publie checkpoint et configuration ; UVR référence plusieurs variantes ViperX | Le nom désigne une famille. Figer une variante, exporter/valider son graphe et son DSP ; travail commun possible avec SW sans supposer les mêmes bandes ni tenseurs |
| **BS-Roformer ViperX 1297** | Voix/instrumental | `model_bs_roformer_ep_317_sdr_12.9755.ckpt` + YAML dans le catalogue UVR | Bon candidat vocal après SW ; la parenté d’architecture ne rend pas les checkpoints interchangeables |
| **SCNet XL** | **Quatre sources** basse/batterie/voix/autres, pas seulement batterie/instrumental | SCNet XL et XL IHF avec configs/checkpoints dans la [liste MSST](https://github.com/ZFTurbo/Music-Source-Separation-Training/blob/main/docs/pretrained_models.md) | Nouvelle architecture et export à valider. Choisir XL exact. Un [export ONNX SCNet Large](https://huggingface.co/audiojs/scnet-large) existe aussi : variante différente, à évaluer séparément |
| **MDX Extra Q** | Quatre sources ; alternative quantifiée Demucs v3 | [Configuration officielle `mdx_extra_q`](https://github.com/facebookresearch/demucs/blob/main/demucs/remote/mdx_extra_q.yaml), ensemble de quatre modèles | Ce n’est pas MDX-Net. Pipeline de quantification/chargement et architecture distincts du HTDemucs actuel ; export ou backend nécessaire |
| **UVR-DeEcho-DeReverb** | Piste vocale plus sèche et composante retirée ; post-traitement | `UVR-DeEcho-DeReverb.pth` dans le catalogue VR d’UVR | Étape de restauration sur le stem choisi après séparation ; adaptateur VR ou backend. Ne remplace pas un démixeur multi-instruments |

Les appréciations de qualité de la sélection utilisateur constituent des pistes de comparaison. Cette étude n’a pas mesuré la repisse ou la qualité musicale de ces huit familles dans notre host. Ni « récent », ni « HQ », ni le format ONNX ne garantit leur compatibilité avec WebGPU.

## Organisation des réglages et architecture future

`ModelResearchCatalog.js` conserve les références séparément de `models.json`, qui reste le manifeste des moteurs exécutables avec fichiers vérifiés. Aucun bouton Télécharger ou Séparer n’est ajouté pour les candidats. Un modèle validé migrera vers ce manifeste avec son runtime spécialisé ; éviter de forcer tous les modèles dans le Worker Demucs.

Les futurs adaptateurs doivent publier le même contrat audio du host : sources identifiées, PCM stéréo aligné à 44,1 kHz, blocs ordonnés, progression, annulation et libération du runtime. Un backend optionnel pourra traiter les checkpoints natifs et la restauration vocale via une interface asynchrone similaire, avec choix explicite local/serveur. Aucun audio n’est envoyé à un serveur par ce changement.

## Prochaines tâches

- **[DONE] SW-1** : audit reproductible de l’export SW, provenance et référence audio six sources.
- **[DONE] SW-2** : adaptateur navigateur et test court, comparaison CPU/GPU, puis téléchargement/cache intégrés.
- **[DONE] SW-3** : morceau entier, lecture progressive, sauvegarde/export, comparaison musicale avec Demucs 6s.
- **[TODO] MDX-1** : adapter Inst HQ 4/5 et comparer instrumental/voix au même extrait.
- **[TODO] EXPORT-1** : étude Demucs export 2/4 s avec métriques audio et temps ; sans réintroduire un réglage qui ne change que le padding.

Le choix des modèles et leurs états dans Settings est une étude datée, pas une annonce de compatibilité validée. Les modifications de cette étape se limitent au retrait du réglage trompeur, à l’étude et à sa présentation dans Settings.

## SW-1 : audit et référence CPU effectués le 22 octobre 2026

Sources épinglées dans [research/bs-roformer-sw.json](research/bs-roformer-sw.json) : GitHub `c6047cd28c41f803339e9b8a5775a56932de7157`, poids Hugging Face `a744f80957374e1735ad70fa122670b7961da8cc`. Tailles **réelles de l’API LFS** : FP16 352 778 874 octets, FP32 701 010 313 octets, référence **49 486 196 octets** (et non les 12 MB annoncés par la fiche). Les SHA-256 sont épinglés ; FP16 et référence téléchargés et vérifiés localement dans `third_party/bs-roformer-audit/` (ignoré par Git). Aucun de ces fichiers n’est encore offert comme modèle exécutable par le host.

`tools/validate-roformer-reference.py` compare les deux branches et **les six sources**, deux canaux, à la référence PyTorch fournie par l’exporteur ; pas de chargement pickle. ORT CPU 1.22.0 : chargement 2.87 s, inférence seule de 4 s 11.04 s, seuil absolu 1e−3 réussi. [Résultat complet](benchmarks/roformer-cpu-reference-2026-10-22.json). Cette validation porte sur le spectrogramme, **pas sur une référence musicale indépendante**, le DSP JS ni WebGPU.

Contrat confirmé : réel/imaginaire `[1,2,1025,345]`, six spectrogrammes `[1,6,2,1025,345]`, ordre basse/batterie/autres/voix/guitare/piano ; FFT 2048, hop 512, Hann périodique, réflexion centrée, non normalisée. Réseau figé à 4 s. Il ne réutilise pas directement notre `OnnxCoreModel` Demucs (FFT 4096 normalisée et branche temporelle) : prévoir `RoformerCoreModel` et DSP dédiés, puis un Runner qui publie le contrat PCM commun au lecteur.

Le pipeline tiers utilise deux Workers STFT/iSTFT autour de la session GPU et alloue les sorties de tout le morceau : reprendre ses principes, mais publier des blocs et gérer explicitement annulation, générations périmées, erreurs, temps limite et libération pour notre host. Vérifier aussi le premier/dernier bloc et tous les stems, pas seulement la batterie. Tester d’abord ORT Web **1.22.0** déjà embarqué avant de changer sa version.

**Prochaine priorité SW-2** : adaptateur DSP avec tests FFT/iFFT indépendants et parité sur douze canaux, diagnostic GPU court, puis seulement cache/téléchargement/menu, morceau entier et export. Les droits des poids d’origine restent non déclarés selon le dépôt exporteur ; son MIT déclaré pour le pipeline ne résout pas automatiquement la provenance du checkpoint. Cela ne bloque pas les essais techniques locaux.

Ordre après SW : **MDX-Net Inst HQ 4/5**, puis **MelBand Roformer (checkpoint précis) / BS-Roformer ViperX**, **MDX23C InstVoc HQ**, **SCNet XL**, **MDX Extra Q**, **UVR-DeEcho-DeReverb** comme post-traitement. Le second choix privilégie un artefact ONNX existant ; les autres nécessitent un export validé ou un backend.

## Portage navigateur SW-2 effectué

Le modèle SW est maintenant dans `models.json`, avec runtime `bs-roformer-onnx` et adaptateur distinct de Demucs. STFT/iSTFT et douze canaux comparés réellement à la référence PyTorch et à un extrait musical ORT CPU + DSP PyTorch : seuils existants respectés. CPU/WASM navigateur également validé, mais ~35 s pour une fenêtre de 4 s. Téléchargement, cache, préparation, lecteur six pistes et MP3 vers Tracks testés dans le host ; validation longue terminée : 214,9 s séparées en 228,32 s, 72 blocs, premier bloc 3,19 s et sauvegarde réussie. Protocole et résultats : [ROFORMER_VALIDATION.md](ROFORMER_VALIDATION.md). MDX-Net Inst HQ4/5 reste le prochain portage prioritaire.

## Actualisation du 25 octobre 2026 — périmètre guitare/basse

Cette section remplace les priorités historiques vocales ci-dessus. Les modèles de voix/instrumental seuls restent hors périmètre.

- **SCNet compact** : audit checkpoint natif / export int8 sur quatre extraits Q2, puis même graphe sur CPU/WASM et WebGPU. Contrat numérique vérifié ; pas de piste guitare dédiée, pas d’avantage instrumental établi. Petit modèle10,1M, **pas XL ni Large**. Statut : candidat, pas d’entrée Model ni de téléchargement production. Préparation `python tools/prepare-scnet-candidate.py`, vérification `python tools/validate-scnet-candidate.py` dans l’environnement scientifique ; diagnostic source `scnet-feasibility.html`. Révisions, licences, SHA et résultats dans MODEL_EVALUATIONS.MD§16 et `research/scnet-candidate.json`.
- **MDX Extra Q** : quatre checkpoints officiels, DiffQ0.2.4, référence native Rainfall6s terminée. Résultat exploratoire, pas d’export navigateur. L’entraînement comprend MUSDB test ; exclure ce split des conclusions de généralisation. Aucune extension des histogrammes ou des conseils existants à partir de ce seul essai.
- **Demucs6 GPU** : pas de nouvelle inférence validée ; le blocage ancien conserve son statut. Une session créée n’est pas une validation. Le runtime production reste inchangé.

Avant tout portage supplémentaire : justifier le bénéfice pour guitare/basse puis valider sortie audio, canaux, ordre des sources, contexte/padding, raccords, mémoire, annulation et communication progressive au lecteur. Un export ONNX compatible ne suffit pas. L’écoute des prises originales et les autres machines restent des validations distinctes.
