# Ajouter ou supprimer des plugins WAM

Depuis la **racine du dépôt**, exécuter après chaque ajout ou suppression :

```sh
npm run wam-plugins
```

Cette commande Node.js met à jour `examples/wam/wamPlugins/plugins.json`, le catalogue utilisé par le menu **+** de l’hôte et le laboratoire FX. Aucun script Python n’est nécessaire.

## Ajouter un plugin

1. Copier son dossier complet dans `examples/wam/wamPlugins/`, en conservant les fichiers JavaScript, AudioWorklet, WASM, GUI et images et leurs chemins relatifs.
2. Exécuter `npm run wam-plugins` à la racine du dépôt.
3. Vérifier le nom et la catégorie dans `plugins.json`. Les propriétés existantes (`name`, `category`, `role`, `tags`, `thumbnail`, etc.) sont conservées lors des mises à jour suivantes. Les nouveaux plugins utilisent la catégorie connue ou celle déduite du descripteur ; corriger `other` si nécessaire.
4. Recharger l’hôte. Avec `npm start`, le laboratoire est accessible à `http://127.0.0.1:8765/examples/wam/fx-test/`. Utiliser **Validate all plugins**, puis vérifier le fonctionnement dans la chaîne et écouter à niveau modéré.

La détection cherche `index.js` accompagné de `descriptor.json`, dans cet ordre : racine du dossier du plugin, sous-dossier `plugin/`, sous-dossier `src/`. Les dossiers utilitaires (`utils/`) et cachés sont ignorés. Un seul point d’entrée est ajouté par dossier ; les entrées déjà déclarées sont préservées. Pour une structure différente, déclarer manuellement `uri` et éventuellement `descriptor` dans `plugins.json` (voir `docs/WAM_PLUGIN_REGISTRY.md`). Le script lit les fichiers, sans exécuter le code des plugins.

La vignette est normalement déclarée par `thumbnail` dans `descriptor.json`, relativement à ce descripteur. Sans vignette, l’hôte affiche une image de remplacement.

## Supprimer un plugin

Supprimer son dossier puis relancer :

```sh
npm run wam-plugins
```

Les entrées internes dont le fichier d’entrée a disparu sont retirées. Pour conserver les fichiers d’un plugin mais le masquer dans l’hôte et le laboratoire, ajouter `"enabled": false` à son entrée dans `plugins.json` ; cette propriété est préservée par le script.

Les références externes au dossier (notamment NAM et Cabinet dans `src/`) et les URL distantes restent conservées. Pour retirer une référence distante, modifier directement `plugins.json`. Retirer seulement une entrée sans supprimer son dossier la fera réapparaître à la prochaine détection.

## Vérifier et reconstruire la distribution

```sh
npm run wam-plugins -- --check
npm test
npm run dist
```

`--check` ne modifie aucun fichier et renvoie un code d’erreur si le catalogue doit être mis à jour. `npm run dist` reconstruit `dist/NAM_A2_WAM/` pour un hébergement statique ; il ne redétecte pas les plugins et ne publie rien. Relancer la commande de catalogue **avant** la reconstruction, puis déployer le dossier généré et recharger la page.

L’inscription au catalogue ne garantit pas la compatibilité : des dépendances absentes, des chemins incorrects ou des erreurs de GUI/DSP doivent être corrigés dans le plugin.

## État de validation au 24 septembre 2026

17 plugins ajoutés au catalogue, dont 16 validés dans Chromium (import, instanciation, GUI, getState/setState et signal audio fini/non silencieux). `VintageAmp60s` reste déclaré mais désactivé : son WASM déclenche `float unrepresentable in integer range` à 44,1 et 48 kHz, même sans GUI. Corriger et revalider son DSP avant de retirer `enabled: false`. Les autres plugins sont proposés dans le menu +. Le catalogue contient 31 entrées, dont 30 actives.
