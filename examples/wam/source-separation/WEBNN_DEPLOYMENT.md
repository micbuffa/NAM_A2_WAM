> **2026-10-30 — Direct WebNN:** the benchmark now defaults to direct graph recipes/raw weights for WebNN, with no browser ONNX Runtime. WASM/WebGPU retain ORT; the previous ORT→WebNN mode remains selectable. Deploy the new `model-assets/direct-webnn/` assets too. Native parity/performance are pending. See [DIRECT_WEBNN_BENCHMARK.md](./DIRECT_WEBNN_BENCHMARK.md). Older protocol notes below describe the ORT-mediated baseline.

# Déployer et tester WebNN : mesures ET écoute multipiste

29 octobre 2026 · branche `multitracks`. Le build Firefox expérimental est chez Paul ; il n’est pas disponible sur la machine de développement. Les résultats WebNN Firefox seront ceux de ses essais.

## Quel dossier publier ?

Pour **les deux usages**, publier tout le contenu de **`dist/NAM_A2_WAM/`** dans un répertoire HTTPS, par exemple `https://mon-serveur/nam-test/`. Conserver l’arborescence. Ne pas copier seulement les fichiers HTML ou le dossier `tests`.

Cette distribution complète contient :

- L’hôte avec onglet **Multitracks**, l’import d’un fichier local, les backends WebNN CPU/GPU/NPU et le lecteur multipiste existant.
- Le **nouveau banc de performance** `source-separation/webnn-diagnostics.html`.
- Les deux modèles WebNN compatibles (Demucs4 qualité ONNX et BS Roformer SW6), le runtime ORT1.30 et les dépendances DSP, servis depuis cette origine. Le téléchargement dans le cache du navigateur reste une action utilisateur dans le gestionnaire de modèles.

`dist/WebNN_Benchmark/` est l’autre distribution, **mesures seules**, sans lecteur multipiste. Elle reste utile si Paul veut un petit site dédié aux mesures, mais il n’est pas nécessaire de publier les deux dossiers : la dist complète contient aussi le banc. Les tests unitaires Node/Python restent dans le dépôt ; ils ne sont pas exécutables par le navigateur et ne sont pas nécessaires au déploiement.

## URLs après publication

En supposant la base `https://mon-serveur/nam-test/` :

| URL | Usage |
|---|---|
| `https://mon-serveur/nam-test/` | Hôte complet → onglet **Multitracks** |
| `https://mon-serveur/nam-test/source-separation/` | Même moteur et lecteur, page directe avec choix modèle/backend et import fichier visibles |
| `https://mon-serveur/nam-test/source-separation/webnn-diagnostics.html` | Mesures détaillées, répétitions, exports JSON/CSV |
| `https://mon-serveur/nam-test/WEBNN_TESTING.md` | Ce guide dans la distribution |

Localement, serveur du projet sur8765 :

- `http://127.0.0.1:8765/dist/NAM_A2_WAM/`
- `http://127.0.0.1:8765/dist/NAM_A2_WAM/source-separation/`
- `http://127.0.0.1:8765/dist/NAM_A2_WAM/source-separation/webnn-diagnostics.html`

## Importer son fichier, séparer avec WebNN, écouter

1. Ouvrir l’hôte dans le Firefox expérimental, choisir **Multitracks**, puis **Importer audio → Depuis un fichier audio**. Le fichier est lu localement : aucun upload serveur. La page directe `source-separation/` permet également de sélectionner le fichier.
2. Ouvrir **Change model / settings**. Choisir **Qualité · Demucs v4 · 4 pistes ONNX** ou **BS Roformer SW · 6 instruments**. Le modèle « Aperçu rapide / preview2s » et les modèles ORT6s/FT ne sont pas pris en charge par ce chemin WebNN.
3. Choisir **WebNN / CPU**, **WebNN / GPU** ou **WebNN / NPU**. Si les options sont grisées, l’API n’est pas détectée dans cette version du navigateur. Le Worker vérifie aussi son propre accès à l’API ; une présence dans Window ne garantit pas la présence dans Worker.
4. **Pour qualifier WebNN, décocher le repli automatique CPU/WASM.** Sinon un échec avant le premier bloc peut lancer WASM, avec statut/backend mis à jour : ce résultat ne doit pas être présenté comme une séparation WebNN. Ce repli de pipeline est distinct des replis internes d’opérateurs ORT, de couverture inconnue.
5. Dans le gestionnaire de modèles, cliquer **Télécharger** pour le modèle choisi et attendre la vérification, puis la compilation/préparation en mémoire. Les poids sont inclus sur le serveur publié, mais doivent encore être installés dans le cache de cette origine/navigateur. Cela peut prendre du temps à la première utilisation. Valider les paramètres.
6. Choisir au besoin un extrait court (6–10s pour un premier essai), cliquer **Separate**, puis **Play** quand les premiers blocs sont disponibles. Le lecteur permet mute/solo, volume, pan, boucle et zoom ; Stop conserve les blocs déjà produits. Le son dépend du volume global/backing et des réglages navigateur/OS.
7. Vérifier le backend annoncé dans le statut/mesures. Les préférences CPU/GPU/NPU acceptées ne certifient pas le matériel physique. Pour les mesures comparables d’initialisation/processing, utiliser l’autre page du banc, avec les mêmes empreintes de modèle et PCM.

L’import YouTube nécessite toujours le service serveur existant ; il ne devient pas fonctionnel sur un hébergement purement statique. Pour cette qualification, utiliser l’import local de fichier.

Le lecteur conserve les backends ONNX de production (ORT1.22 pour WebGPU/WASM) et utilise ORT1.30 pour WebNN. Le banc de performance, lui, emploie ORT1.30 pour les cinq configurations afin de contrôler cette variable. Ne pas mélanger les temps de l’interface produit avec ceux du protocole du banc : le lecteur prépare/préchauffe et diffuse progressivement, tandis que le banc isole ses intervalles et répétitions.

## Construire

Les assets C++ et modèles locaux du projet doivent être préparés comme habituellement. Pour reconstruire la distribution complète :

```sh
npm run build-static
```

Si les assets Factory et binaires WASM sont déjà à jour, sans changement C++ :

```sh
npm run build-static -- --no-regenerate --no-build
```

Le runtime optionnel WebNN doit avoir été préparé par `python3 tools/prepare-webnn-lab.py`. Le modèle Demucs4 original local est sous `third_party/nam-webgpu-probe/htdemucs-core.onnx`. La construction recopie ces assets dans la dist, adapte les imports et le catalogue Demucs à des URLs locales. `source-separation/build-info.json` indique les empreintes et les assets éventuellement absents. Ne pas publier une qualification WebNN avec ces assets manquants.

Pour le banc seul : `npm run dist:webnn-benchmark` (construction autonome avec vérification d’intégrité avant remplacement de la sortie).

## Serveur statique

Utiliser HTTPS, types MIME JavaScript pour `.js/.mjs` et `application/wasm` pour `.wasm`. Appliquer les headers suivants sur la page et les assets :

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
```

`_headers` et `.htaccess` sont fournis pour les hébergeurs compatibles, mais ne configurent pas automatiquement nginx/autres serveurs. Adapter leur configuration. L’isolation est nécessaire au chemin ring buffer SharedArrayBuffer et au WASM multithread ; `crossOriginIsolated:true` est affiché sur le banc. Ne pas tester via `file://`.

Guide de méthodologie : [WEBNN_FIREFOX_BENCHMARK.md](source-separation/WEBNN_FIREFOX_BENCHMARK.md) dans la dist complète (ou ce même nom à la racine du banc autonome).

### Node static servers without `.mjs` MIME support (2026-10-29)

Generated distributions now package ONNX Runtime modules as **`.js`** (both ORT1.30 WebNN/benchmark and ORT1.22 player WebGPU). Internal lazy-loader filenames, worker imports and runtime validator allowlists are rewritten together. Source/vendor checkouts stay untouched. Original upstream bytes are verified before transformation; delivered runtime manifests contain recomputed SHA-256/byte counts and retain upstream hashes separately. Binary WASM and model weights are unchanged.

Replace the deployed distribution with the newly built folder, including runtime files, JavaScript, `research/webnn-runtime.json` and build-info together, then force-reload/disable cache. Renaming just `ort.all.min.mjs` manually is insufficient. A Node server that already serves `.js` correctly needs no `.mjs` configuration change. HTTPS/localhost and any required cross-origin isolation headers still apply.
