# Blues, Clean Full et Modern Metal — WAM v2

Les trois plugins sont disponibles dans `blues/index.js`, `cleanfull/index.js` et `modernmetal/index.js`. Chacun exporte une classe `WebAudioModule` et possède un `descriptor.json`. Les fichiers WAP d'origine restent inchangés.

## Essayer les amplis

Depuis la racine du dépôt :

```sh
PORT=8766 node examples/wam/server.mjs
```

Ouvrir <http://localhost:8766/examples/WAP_amp_sims/michel/WAM/>. Choisir un ampli, cliquer **Load amplifier**, puis lancer le lecteur. Le riff sec de `utility/GuitarRiffDry.mp3` est sélectionné par défaut ; un fichier local peut le remplacer. Le réglage **Listening volume** est un gain de sortie du host, initialement à −18 dB. Les fichiers locaux restent dans le navigateur.

Les interfaces reprennent les graphismes et contrôles des WAP. Les menus reprennent exactement les presets, noms et ordre des WAP d’origine : 6 pour Blues, 6 pour Clean Full et 12 pour Modern Metal. Les autres blueprints restent internes pour la compatibilité des états déjà sauvegardés et la comparaison DSP. Le knob Reverb affiche 0–10 et pilote 0–4 dans le moteur (valeur affichée × 0,4). Les presets, valeurs initiales, états et paramètres WAM conservent leurs valeurs internes et leur plage historique 0–10. L’interface n’écrit aucune valeur lors du chargement ou de la réouverture ; un état ancien supérieur à 4 reste intact, avec le knob visuellement en butée jusqu’à une nouvelle manipulation. Les knobs utilisent un curseur vertical à deux flèches. Menu, titre et switch partagent une ligne alignée ; le titre est centré dans l’espace entre les deux contrôles.

Les presets initiaux reproduisent ceux des anciennes interfaces (indices 8, 11 et 8). **Save state / Restore saved state** conservent les réglages en mémoire dans la page. Masquer ou recréer l'interface ne recharge pas le son.

## Intégration WAM

```js
import {initializeWamHost} from './shared/sdk.js';
import Blues from './blues/index.js';

const context = new AudioContext();
const [groupId] = await initializeWamHost(context);
const plugin = await Blues.createInstance(groupId, context);
source.connect(plugin.audioNode);
plugin.audioNode.connect(context.destination);
document.body.append(await plugin.createGui());

await plugin.audioNode.loadFactoryPreset('factory-0');
const state = await plugin.audioNode.getState();
await plugin.audioNode.setState(state);
// Au retrait :
await plugin.audioNode.destroy();
```

Le module expose les API WAM v2 via le SDK et ParamMgr du dépôt : informations et valeurs des paramètres, automation, état, création et destruction de GUI. Les huit contrôles principaux, six bandes EQ, réglages avancés disponibles dans chaque moteur et bypass sont exposés. `getFactoryPresets()` renvoie uniquement les identifiants et noms du menu WAP d’origine, dans le même ordre. Les opérations de preset/état sont sérialisées ; les réponses impulsionnelles sont préparées avant de changer le preset.

L'état version 1 contient le plugin, le preset de base et les valeurs des paramètres. Il reconstruit aussi les choix cachés du preset (courbes de distorsion, étages, cabinet et réverbération). Le blueprint doit correspondre à un preset fourni ; l'import arbitraire de presets WAP et l'édition des courbes/étages cachés ne sont pas proposés dans cette première version. L'automation des paramètres natifs est relayée par les callbacks ParamMgr, à sa cadence de contrôle ; elle n'est pas une modulation DSP à l'échantillon près.

## Préservation du DSP

`tools/import-wap.py` génère les moteurs ES modules, templates, descripteurs et copies des ressources depuis les WAP. Il peut être relancé depuis n'importe quel répertoire :

```sh
python3 examples/WAP_amp_sims/michel/WAM/tools/import-wap.py
```

Les wrappers dans `shared/engine.js`, `shared/plugin.js` et `shared/gui.js` sont maintenus séparément. Les ressources sont locales, sans CDN. `SOURCE_MANIFEST.json` identifie les sources importées par SHA-256. Les notices et attributions des sources sont conservées dans les fichiers importés.

Les chaînes Web Audio natives, courbes, oversampling, gains, filtres, boucle de puissance de Modern Metal, réponses impulsionnelles et lois dry/wet sont conservés. Le SDK WAP, les imports HTML et les modifications globales de `AudioNode.prototype` ne sont pas utilisés par les nouveaux plugins. Les contrôles graphiques sont enregistrés sous des noms propres à ce portage pour permettre la coexistence avec d'autres interfaces.

Corrections locales nécessaires : déclarations de presets Clean Full compatibles avec les modules stricts ; chemin du cabinet Fender Champ de Blues ; setter `LS3Freq` de Blues ; référence de secours au cabinet Modern Metal. Les chargements d'IR sont attendus et protégés contre les réponses obsolètes. Les étages supplémentaires Modern Metal sont déconnectés lors des changements de topologie, et les nœuds possédés sont déconnectés à la destruction. L'ordre original d'application des paramètres est conservé, y compris les macros drive qui peuvent remplacer des valeurs d'étages du preset.

## Vérification sonore et fonctionnelle

Ouvrir <http://localhost:8766/examples/WAP_amp_sims/michel/WAM/validation.html> et cliquer **Run validation**. La sortie de cette page est silencieuse. Le bouton de téléchargement exporte les mesures ; `VALIDATION.json` contient le dernier résultat enregistré.

- **74 comparaisons DSP** : les 37 presets à 44 100 et 48 000 Hz, en stéréo, dans deux `OfflineAudioContext` distincts. Même extrait de guitare (2 s), gain d'entrée −18 dB, départ à 1,1 s après les rampes d'IR, rendu de 4 s incluant la queue. Seuil d'erreur absolue : 10⁻⁶ ; sorties finies et non silencieuses exigées.
- **6 comparaisons de graphe complet** : une vraie instance WAM par ampli et fréquence, incluant le wrapper et ParamMgr, comparée simultanément au WAP original sur 1 s du même extrait. Seuil absolu : 10⁻⁵.
- Tests des valeurs de chacun des 37 presets, paramètres normalisés, automation programmée qui change effectivement le master, restauration et initialisation avec état, isolation de deux instances, réouverture et recréation de GUI, bypass, rejet d'état invalide et destruction répétée.

Les scripts WAP de référence s'exécutent dans des iframes isolées. Une exception explicite est nécessaire pour Blues : le harnais redirige le chemin erroné `bluesassets/...` vers `blues/assets/...` pour comparer le cabinet Fender Champ réellement prévu. Le JavaScript original n'est pas modifié. Les redirections sont consignées dans les résultats.

Ces mesures vérifient l'équivalence numérique dans le navigateur testé, sur cet extrait et ces presets. Elles ne constituent pas une écoute comparative humaine ni une validation de tous les navigateurs, fichiers audio, signaux ou transitions de réglages. Le son Clean Full peut présenter de très faibles différences d'arrondi flottant ; les valeurs détaillées figurent dans le JSON.

## Périmètre

Le host charge un seul ampli à la fois. Pas d'entrée micro/guitare live, pas de portage de `WasabiAmpsimUtility`, pas de chaîne externe de noise gates ni d'ajout au catalogue du rack principal. Les modules sont destinés à être chargés depuis leur dossier avec ses ressources `shared` et `assets`.

### Résultat enregistré

Validation terminée avec succès : **74 comparaisons DSP, 6 comparaisons du graphe WAM complet et 146 contrôles WAM** (les 6 comparaisons complètes sont incluses dans les 146 contrôles). Les résultats sont dans `VALIDATION.json`.

| Ampli | Erreur absolue maximale DSP | Erreur maximale graphe WAM complet |
|---|---:|---:|
| blues | 0.000e+00 | 2.235e-08 |
| cleanfull | 5.960e-07 | 1.173e-07 |
| modernmetal | 0.000e+00 | 1.863e-09 |

Exécution : 2026-10-10T16:36:26.719Z ; Chromium du navigateur intégré Codex sur macOS. Les erreurs portent sur des amplitudes audio flottantes, sans normalisation du signal avant comparaison.

### Contrôles de l’interface

`gui-validation.html` vérifie les menus contre les templates WAP originaux, les valeurs de chaque preset conservé, le remappage Reverb (0→0, 5→2, 10→4), la restauration, la compatibilité avec une ancienne valeur supérieure à 4, le curseur et la géométrie de la ligne inférieure. Les 66 contrôles ont réussi ; les résultats sont enregistrés dans `VALIDATION_UI.json`. Le rapport audio précédent reste valable : les moteurs DSP et les valeurs des presets n’ont pas été modifiés par ces ajustements d’interface.

### Fidélité visuelle WAP

Les fichiers de polices originaux sont chargés explicitement avec `FontFace` et enregistrés dans `document.fonts` : Henny Penny et Bellerose (Blues), Shady Lane (Clean Full), Frijole et Metalfont (Modern Metal). Les noms sont propres à chaque WAM pour éviter les collisions avec les autres plugins. Cette inscription corrige le chargement non fiable des règles `@font-face` à l’intérieur du Shadow DOM et supprime la dépendance de Modern Metal à la police déclarée par l’ancien utility. Le fond retrouve son arrondi de 10 px, les titres leurs tailles WAP et les menus leurs largeurs 70/120/100 px. Les tests vérifient aussi le chargement réel des fontes, leur application aux titres/libellés et les arrondis.

## Distribution autonome : un plugin / un dossier

Depuis la racine du dépôt :

```sh
npm run dist:wasabi-amps
```

Le résultat est généré dans `dist/wasabi-amps/` (ignoré par Git, reproductible depuis les sources) :

```text
wasabi-amps/
  blues/             # autonome : index.js, descriptor.json, Engine.js,
  cleanfull/         # template.js, preset-menu.js, assets/, shared/,
  modernmetal/       # README.md, SOURCE_MANIFEST.json, MANIFEST.json
  index.html         # host de démonstration facultatif
  host.js
  host.css
  GuitarRiffDry.mp3
  plugins.json       # liste simple des trois URI relatives
```

Copier **uniquement le dossier du plugin souhaité** suffit. Par exemple, si `blues/` est déposé sur `https://example.org/plugins/blues/`, l'URI WAM à donner à un host est `https://example.org/plugins/blues/index.js`. Le dossier peut être renommé ou déplacé, les chemins sont relatifs au module. Aucun accès aux sources, aux deux autres plugins ou au host de démonstration n'est requis.

Les sources conservent leur code commun ; le build le duplique dans `shared/` à l'intérieur de chaque dossier et adapte les imports. Les ressources audio et graphiques restent identiques aux sources. `MANIFEST.json` fournit les empreintes SHA-256 des fichiers distribués. Le build vérifie que les imports JS relatifs restent dans le dossier du plugin et pointent sur des fichiers présents. Il remplace uniquement `dist/wasabi-amps`, indépendamment de la distribution du rack NAM.

Déploiement : servir les fichiers en HTTP(S), avec un type MIME JavaScript correct pour `.js`. Pour un host hébergé sur un autre domaine, configurer CORS pour les modules et ressources du plugin. AudioWorklet requiert HTTPS ou localhost. Aucun build ni installation npm n'est nécessaire sur le serveur.

Pour essayer la distribution avec le serveur local du dépôt : <http://localhost:8766/dist/wasabi-amps/>. Pour rejouer les contrôles sur les modules **distribués**, ouvrir `gui-validation.html?dist` depuis le dossier WAM ; les résultats se téléchargent sous `VALIDATION_DIST.json`.

Validation de la distribution : **69 contrôles réussis**, dont production audio finie et non silencieuse pour chaque instance distribuée. Rapport : `VALIDATION_DIST.json`. Deux builds successifs produisent des fichiers identiques ; empreintes, ressources et imports locaux vérifiés.

### Installation dans le rack NAM A2

`npm run install:wasabi-amps` reconstruit la distribution, copie `modernmetal`, `cleanfull` et `blues` respectivement dans `examples/wam/wamPlugins/metalmachine`, `cleanmachine` et `bluesmachine`, puis synchronise `plugins.json`. Ils apparaissent comme amplificateurs dans le menu **+** des chaînes. Les descripteurs utilisent `assets/thumbnail.png`, une capture réelle de chaque interface. Les fichiers de ces trois dossiers doivent être mis à jour via cette commande, à partir des sources WAM.

### Reconstruire aussi la distribution du host

L’installation dans `examples/wam/wamPlugins` ne met pas à jour une ancienne copie du host dans `dist/NAM_A2_WAM`. Pour préparer le host complet à déployer, exécuter depuis la racine :

```sh
npm run install:wasabi-amps
npm run dist
```

`npm run dist:wasabi-amps` génère uniquement les trois plugins autonomes. `npm run install:wasabi-amps` les installe dans le host de développement. **`npm run dist` reconstruit le host complet**, avec son catalogue et ses plugins, dans `dist/NAM_A2_WAM/`. Le point d’entrée à servir est alors `dist/NAM_A2_WAM/index.html`.
