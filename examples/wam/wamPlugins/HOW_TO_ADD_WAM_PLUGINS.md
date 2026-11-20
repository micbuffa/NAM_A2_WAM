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

La détection cherche `index.js` accompagné de `descriptor.json`, dans cet ordre : racine du dossier du plugin, sous-dossier `plugin/`, sous-dossier `src/`. Les dossiers utilitaires (`utils/`) et cachés sont ignorés. Un seul point d’entrée est ajouté par dossier ; les entrées déjà déclarées sont préservées. Pour une structure différente, déclarer manuellement `uri` et éventuellement `descriptor` dans `plugins.json`. Le script lit les fichiers, sans exécuter le code des plugins.

## Champs du catalogue

Une entrée peut être une URI courte ou un objet avec des propriétés explicites.

```json
{
  "version": 1,
  "plugins": [
    "./my-effect/index.js",
    {
      "uri": "./my-tuner/src/index.js",
      "descriptor": "./my-tuner/src/descriptor.json",
      "category": "tuner",
      "role": "tuner",
      "thumbnail": "./Gui/tuner.png"
    }
  ]
}
```

Les URI de module et de descripteur sont résolues depuis `plugins.json`.
Les chemins de vignette du descripteur et les surcharges du catalogue sont
résolus depuis le descripteur. L’hôte génère une vignette de remplacement
si nécessaire.

Catégories prises en charge par le [registre](../WamPluginRegistry.js) :
`amplifier`, `cabinet`, `tuner`, `dynamics`, `drive`, `filter-wah`,
`modulation`, `delay`, `reverb`, `stereo-utility`, `other`.
Les mots-clés restent recherchables. Les termes techniques comme `faust`
ne déterminent pas la catégorie musicale.

Les modules distants exécutent du JavaScript dans la page de l’hôte. Ajouter
uniquement des sources de confiance. Prévoir des URL HTTPS et des réponses
CORS compatibles pour le module, ses imports, ses AudioWorklets, ses fichiers
WASM et ses ressources GUI. HTTP est accepté pour les hôtes locaux.

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

Le laboratoire charge un effet à la fois et vérifie séparément descripteur,
import, instance, audio, GUI et restauration d’état. Une erreur reste visible
sur l’effet concerné et la validation du catalogue continue. Le tuner reste
sur une branche d’analyse distincte.

Pour les captures d’écran du rack, lancer `npm start` puis
`npm run thumbnails`. On peut limiter la commande à certains dossiers,
par exemple `npm run thumbnails -- BigMuff temper`.

Le bilan du 24 septembre 2026 reste disponible avec
`git show 58338d7:examples/wam/wamPlugins/HOW_TO_ADD_WAM_PLUGINS.md`.
