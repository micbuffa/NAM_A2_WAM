# Comparaison WebNN, WebGPU et CPU/WASM — protocole W4

**29 octobre 2026 :** le nouveau banc **déployable** pour Firefox expérimental utilise
un protocole distinct : [WEBNN_FIREFOX_BENCHMARK.md](WEBNN_FIREFOX_BENCHMARK.md),
`npm run dist:webnn-benchmark` → `dist/WebNN_Benchmark/`. Les résultats W4 ci-dessous
restent historiques et ne deviennent pas des mesures Firefox.

Page source : `http://127.0.0.1:8765/examples/wam/source-separation/webnn-performance.html`.
Préparer les poids et le runtime local selon `WEBNN_DEMUCS4_LAB.md`. Aucun changement du runtime du host.

## Protocole fixé avant exécution

- Canary158, même origine, Worker dédié par configuration ; ORT1.30.0 pour les cinq backends comparés. Contrôle supplémentaire WebGPU avec ORT1.22.0 de production.
- Deux modèles : Demucs4 ONNX original (contexte343980frames /7,8s), BS Roformer SW6 FP16 stocké (176400frames /4s). Les modes de précision et architectures sont différents : comparaison de pipelines applicatifs.
- Même PCM Falcon6s stéréo44100Hz pour les douze configurations ; SHA WAV/PCM dans le rapport. Extrait existant Q2, aucune nouvelle référence indépendante de qualité.
- Une première exécution puis deux répétitions **dans la même session**, sans préchauffage synthétique caché. Médiane des deux dernières, minimum/maximum et RTF = durée/6s. Ces répétitions ne sont pas de nouvelles sessions indépendantes.
- Fetch, intégrité et import chronométrés séparément. Session inclut création du contexte WebNN et compilation. Temps de séparation inclut DSP, réseau et raccords ; validation, métriques et transfert final exclus. Premier PCM = disponible dans le Worker, pas preuve de lecture audible.
- Demucs : une fenêtre avec remplissage. SW : deux fenêtres4s, recouvrement1s et assemblage existant. GPU SW conserve les neuf étapes coopératives de production pour toutes les versions ; WebNN/WASM emploient le graphe monolithique. Ne pas attribuer toute différence au seul accélérateur.
- Vérification longueur, canaux et valeurs finies hors chronométrage. Comparaison des répétitions et, quand disponible, de la première sortie avec la référence ORT1.30 WASM du même modèle. Aucun classement perceptuel déduit.
- Réglages GPU identiques à la production (device sans shader-f16 activé), WASM un thread, proxy désactivé. WebNN demande cpu/gpu/npu avec contexte réel et compte les dispatchs ; les opérateurs en repli WASM ne sont pas quantifiés. Le nom demandé ne prouve pas le matériel utilisé.
- Exécution séquentielle, journal de visibilité, pas de suite de tests ni de build simultanés aux mesures. Pas de purge des caches OS/disque ni contrôle thermique ou instrumentation de charge globale. Conserver les erreurs et délais dépassés, sans repli implicite.
- Empreintes des sources avant lancement : `research/webnn-performance-code.json` ; copies locales ignorées sous `third_party/nam-webnn-probe/code-performance/`.

## Gestion des essais interrompus

La tentative initiale SW WebNN CPU a affiché dans la console native : `MLGraphBuilder: Context is lost`, puis ORT a laissé sa création de session pendante. Annulation par le bouton du banc et export initial conservé. Une reprise munie de `MLContext.lost` a reproduit l’erreur CPU et est passée au GPU. Pendant cette reprise, le contrôle ordinateur est devenu indisponible ; au retour, Canary présentait sa fenêtre de restauration après arrêt incorrect et le serveur8765 était arrêté. **La cause de cette interruption globale n’est pas déterminée**. Le résultat GPU de cette tentative n’a pas été exporté ; aucune vitesse ni réussite ne lui est attribuée.

Après relance du serveur et reprise du navigateur, essais isolés par processeur. Snapshot `research/webnn-performance-code-recovery2.json` : Worker identique à la reprise précédente, choix d’un seul processeur et sauvegarde du JSON dans localStorage. Le bouton Exporter permet de récupérer les mesures avant l’essai suivant. Une restauration retrouve le rapport, mais ne reprend jamais automatiquement un calcul.

La détection utilise la promesse publique [MLContext.lost du W3C](https://www.w3.org/TR/2026/CRD-webnn-20261021/#dom-mlcontext-lost). Elle interrompt l’attente d’ORT sans transformer l’essai en WASM. Des tests unitaires simulent le contexte perdu et le fonctionnement normal.

Machine : Apple M3 Max,14cœurs physiques/logiques,38654705664octets de RAM (36Gio), macOS14.4.1/23E224. Les flags du navigateur n’ont pas été modifiés par l’agent ; au retour après interruption, le bandeau Canary mentionnait le flag préexistant `WebMachineLearningNeuralNetwork`.

Les séries avant/après interruption forment deux sessions d’observation distinctes. L’ordre n’est pas contrebalancé ; le nombre d’onglets ouverts et l’état des caches système ne sont pas contrôlés. Les mesures restent exploratoires, même si l’entrée, les poids et le Worker sont identifiés.


## Résultats archivés

[Tableau](benchmarks/webnn-performance-results-2026-10-25.html) · [Synthèse JSON](benchmarks/webnn-performance-falcon-summary-2026-10-25.json). Douze configurations,11réussies et33séparations complètes ; WebNN CPU SW échoue avant inférence. Voir MODEL_EVALUATIONS.MD§23 pour l’interprétation, la dispersion et les limites. Les deux reprises SW GPU/NPU ne comportent pas de référence PCM WASM après interruption : parité inter-backend encore à valider.

Le statut global historique `completed` de certains exports signifie campagne achevée, pas tous les essais réussis. Les lignes `status:error` restent l’autorité. Le frontend actuel affiche désormais `completed-with-failures` dans ce cas. Les exports précédents restent inchangés.
