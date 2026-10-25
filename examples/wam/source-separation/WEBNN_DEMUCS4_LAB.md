# Laboratoire WebNN — Demucs4

25 octobre2026. Source : `http://127.0.0.1:8765/examples/wam/source-separation/webnn-demucs4.html` dans **Chrome Canary**. Ce banc expérimental ne change ni le catalogue ni le runtime du host.

## Préparation reproductible

```sh
python3 tools/prepare-webnn-lab.py
# Environnement Python avec onnx installé :
python tools/audit-webnn-demucs.py
```

Le premier script télécharge le paquet npm officiel **onnxruntime-web1.30.0**, contrôle son SRI SHA-512 exact puis extrait uniquement trois assets statiques autorisés. Aucun script d’installation npm exécuté. Bundle `ort.all.min.mjs`, JSEP mjs/wasm, licence MIT et table d’opérateurs de la version épinglée. Tout reste sous `third_party/nam-webnn-probe/`, ignoré. Manifeste reproductible : `research/webnn-runtime.json`. Ne pas substituer ce bundle au runtime1.22 de production.

Les poids attendus sont les mêmes Demucs4 que le catalogue,174263526octets, SHA-256 `da9e5101ee0804d04933974b59d8aae9c862e80e14f2f24e7c74cae76bdbe748`, fichier local `third_party/nam-webgpu-probe/htdemucs-core.onnx`. Le banc refuse un autre hash. Le générateur d’audit ne télécharge pas les poids ; il inspecte cette copie locale existante. Restriction du fournisseur personnel/recherche conservée, distincte de la licence MIT du runtime/DSP.

Les WAV de G1 et Q2 doivent être déjà préparés. Aucun téléchargement de modèle dans Canary n’est requis : lecture locale du fichier haché. Les références de jeu restent une somme construite ; leur rôle instrumental n’est pas certifié. Ici, le but est la parité d’un même graphe, pas un nouveau score de séparation.

## Mesure

Deux jeux de contrôle disponibles : synthèse stéréo1s+DreamOn20–26s, ou Falcon6s (Q2) en contrôle supplémentaire. Ordre par entrée : WASM ORT1.22, WASM ORT1.30, WebNN ORT1.30. Même modèle,44100Hz, mêmes fonctions `separateTracks`, padding/contexte7,8s et overlap0 ; aucun changement de poids, de gain ou de DSP entre les configurations. Une session et un Worker par essai ; les sorties sont comparées dans le Worker. Référence CPU = même ONNX dans ORT Web WASM1.22, **pas une nouvelle exécution PyTorch**.

Seuils fixés avant essais : erreur RMS relative globale≤1e−3, max absolu≤0,005, et RMS relatif≤1e−3 par source lorsque RMS de référence≥1e−5. Les sources sous ce plancher restent affichées avec contrôle absolu ; la condition globale reste obligatoire. Les échecs sur des pistes faibles ne sont pas supprimés après observation. Aucun gain optimisé, EQ ou recalage des sorties.

Les préférences CPU/GPU/NPU sont proposées mais le matériel physique demeure inconnu. Un MLContext réel est fourni à ORT ; son appel natif `dispatch` et la compilation des graphes sont instrumentés par des wrappers de délégation. Le rapport donne leur nombre. Un appel prouve l’exécution d’un graphe WebNN, **pas une couverture100% ou un GPU/NPU effectif**. Le fallback WASM reste déclaré ; sa proportion n’est pas mesurée. Le contexte et la session sont libérés avant publication du résultat. Annuler termine le Worker courant ; les générations empêchent l’ajout d’un résultat tardif.

Le temps `sessionMilliseconds` commence après vérification locale des fichiers ; `audioMilliseconds` inclut inférence+DSP, éventuellement coûts paresseux de première exécution. `totalMilliseconds` comprend aussi les vérifications/chargements locaux. Sessions recréées, caches OS non contrôlés, pas de lecture concurrente ou série répétée de débit ; ne pas appeler ces valeurs un benchmark complet ni un temps de premier son.

## Résultats de cette session

15 exécutions finies/alignées : six synthétiques, neuf musicales, trois entrées distinctes et des répétitions. Cinq candidates WebNN, chacune avec un graphe construit et un dispatch observé. Toutes passent le seuil global, mais quatre échouent au garde relatif par source faible. Falcon passe aussi ce garde : tous ses RMS de sources sont compris entre0,0618 et0,0928, contre certaines sorties de DreamOn/synthèse proches de1e−4. L’ajout de Falcon est un diagnostic exploratoire après les premiers résultats, pas un holdout préenregistré. Aucun seuil initial n’a été changé pour le faire passer.

Sur Falcon : RMS relatif WebNN global0,0611%, max absolu0,000735 ; session12,225s, exécution+DSP2,442s. Référence WASM1.22 : session0,690s, exécution+DSP10,713s. **La compilation domine le premier essai WebNN** ; ces valeurs ne justifient pas un défaut WebNN ni un facteur d’accélération général. La réutilisation de session et la latence progressive restent à mesurer.

[Résumé et rapports bruts](benchmarks/webnn-demucs4-summary-2026-10-25.json). MODEL_EVALUATIONS.MD§21 décrit les chiffres complets, limites et SHA. Les snapshots de code CPU et Falcon sont hachés dans `research/webnn-demucs4-code*.json` et copiés localement sous third_party. La première série GPU utilisait une préférence fixe avant ajout du sélecteur : pas de snapshot complet antérieur à cette série, limite conservée explicitement.

## Suite

WNN-2 runtime/audit terminé ; WNN-3 reste en validation pour la politique de tolérance sur sorties quasi silencieuses et sa stabilité. Définir et justifier une éventuelle tolérance absolue+relative dans **un nouveau protocole prospectif**, sans réétiqueter les échecs v1. Puis davantage d’entrées, répétitions, réutilisation de session, flux progressif/ring buffer et lecture pendant calcul. Aucun modèle musical WebNN n’est encore ajouté au host ; Demucs6 GPU n’est pas résolu par ces essais.

## Choix du processeur préféré

Le menu **Processeur préféré pour WebNN** propose **WebNN / CPU**, **WebNN / GPU**, **WebNN / NPU**. La sélection est mémorisée pour cette origine dans ce navigateur. WebNN/CPU est distinct du contrôle WASM/CPU. Si l’accès au stockage est interdit, la sélection reste utilisable pour l’essai courant. Les erreurs de contexte restent visibles ; une préférence acceptée n’identifie pas nécessairement le matériel effectivement choisi par le navigateur.

Préférence NPU essayée sur Falcon : trois exécutions supplémentaires, parité réussie, un dispatch WebNN natif. Résultat identique au GPU demandé ; ne pas conclure à l’utilisation du NPU. Rapport W3 et limites dans MODEL_EVALUATIONS.MD§22. Le host principal reprendra ces choix lors de l’intégration WebNN, encore à venir.
