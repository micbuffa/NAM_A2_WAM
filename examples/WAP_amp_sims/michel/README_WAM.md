# Portage des amplificateurs Wasabi vers WAM v2

Les trois amplificateurs **Blues Machine**, **Clean Machine Full** et **Modern Metal Machine** ont été portés du format WAP vers **WAM v2**. Les nouveaux plugins se trouvent dans `WAM/`. Les versions WAP originales dans `blues/`, `cleanfull/` et `modernmetal/` restent inchangées.

## Ce qui a été réalisé

Le portage conserve les moteurs DSP Web Audio natifs : chaînes de traitement, distorsions, filtres, gains, cabinets et réverbérations à convolution. Ils sont intégrés à des modules WAM v2 avec le SDK et ParamMgr du dépôt, pour exposer les paramètres, l’automation et la sauvegarde/restauration de l’état.

Les nouveaux plugins fonctionnent sans le SDK WAP, les imports HTML ni les modifications globales de `AudioNode.prototype`. Le chargement des réponses impulsionnelles est attendu avant l’utilisation du plugin. Les opérations de changement de preset et de restauration d’état sont sérialisées, et les nœuds audio sont déconnectés à la destruction.

Les interfaces reprennent les images et polices originales, les bordures arrondies et les contrôles des WAP, avec les ajustements suivants :

- **Presets** : uniquement ceux proposés dans les menus WAP originaux, dans le même ordre et avec les mêmes noms — 6 pour Blues, 6 pour Clean Full et 12 pour Modern Metal.
- **Réverbération** : le knob affiche une plage de 0 à 10, correspondant à une valeur interne de 0 à 4. Les valeurs initiales, les presets et les états sauvegardés restent inchangés. Le paramètre WAM conserve sa plage interne historique de 0 à 10 pour la compatibilité.
- **Interaction** : un curseur à deux flèches verticales indique le geste de réglage des knobs.
- **Alignement** : le titre est centré entre le menu des presets et le switch, sur une ligne commune.
- **Polices** : les fontes originales sont chargées explicitement, avec des noms propres à chaque plugin pour éviter les collisions avec d’autres interfaces.

Le code commun est maintenu dans `WAM/shared/`. Un script d’import reproductible, `WAM/tools/import-wap.py`, génère les moteurs ES modules, templates, descripteurs et copies des ressources à partir des WAP.

## Host de test

`WAM/index.html` est un petit host qui charge un ampli à la fois. Il propose un lecteur avec un riff de guitare sec fourni, ou un fichier audio local, ainsi que des commandes de sauvegarde/restauration de l’état et de masquage de l’éditeur.

Depuis la racine du dépôt :

```sh
PORT=8766 node examples/wam/server.mjs
```

Ouvrir ensuite :

<http://localhost:8766/examples/WAP_amp_sims/michel/WAM/>

Choisir un ampli, cliquer sur **Load amplifier**, puis lancer le lecteur. Le gain de sortie du host est initialement réglé à −18 dB. Les fichiers locaux restent dans le navigateur.

L’entrée guitare/micro en direct et le portage de `WasabiAmpsimUtility` ne font pas partie de cette étape.

## Générer une distribution autonome

Depuis la racine du dépôt :

```sh
npm run dist:wasabi-amps
```

Cette commande exécute `WAM/tools/build-dist.mjs` et génère :

```text
dist/wasabi-amps/
├── blues/
├── cleanfull/
├── modernmetal/
├── index.html
├── host.js
├── host.css
├── GuitarRiffDry.mp3
├── plugins.json
└── README.md
```

**Chaque dossier de plugin est autonome.** Il contient notamment :

```text
blues/
├── index.js             # Point d’entrée WAM v2
├── descriptor.json
├── Engine.js
├── template.js
├── preset-menu.js
├── assets/              # Images, polices et réponses impulsionnelles
├── shared/              # Copie locale du SDK, ParamMgr et code commun
├── README.md
├── SOURCE_MANIFEST.json
└── MANIFEST.json
```

Le build duplique les dépendances communes dans chaque dossier et adapte les imports. Aucun plugin distribué ne dépend des deux autres dossiers, du host de démonstration ni des sources du dépôt.

Les ressources copiées restent identiques aux sources. `SOURCE_MANIFEST.json` identifie les sources importées ; `MANIFEST.json` contient les empreintes SHA-256 des fichiers distribués. Le build vérifie que les imports JS relatifs restent dans le dossier du plugin et pointent vers des fichiers présents.

La commande remplace uniquement `dist/wasabi-amps/`, sans modifier la distribution du rack NAM. Le contenu de `dist/` est généré et ignoré par Git ; les scripts et sources permettent de le reconstruire.

## Déployer un plugin par son URI

Copier le dossier complet du plugin souhaité sur un serveur statique, en conservant son arborescence. Le dossier peut être renommé ou déplacé.

Par exemple, après avoir déposé `blues/` à l’adresse :

```text
https://example.org/plugins/blues/
```

l’URI à fournir à un host WAM est :

```text
https://example.org/plugins/blues/index.js
```

Aucune installation npm ni compilation n’est nécessaire sur le serveur. Servir les fichiers `.js` avec un type MIME JavaScript correct. Si le host est sur un autre domaine, configurer les en-têtes CORS pour les modules et ressources du plugin. AudioWorklet nécessite HTTPS ou localhost.

Le `index.html` à la racine de la distribution est un host de démonstration facultatif pour les trois amplis. Avec le serveur local indiqué plus haut, il est accessible à :

<http://localhost:8766/dist/wasabi-amps/>

## Vérifications réalisées

- **74 comparaisons audio** : les 37 presets internes des moteurs WAP/WAM, à 44,1 et 48 kHz, avec le même extrait de guitare. Blues et Modern Metal sont identiques numériquement dans ces rendus ; l’écart absolu maximal pour Clean Full est de **5,96 × 10⁻⁷**.
- **146 contrôles WAM**, incluant 6 comparaisons du graphe WAM complet avec le WAP original, les paramètres, l’automation, les états, l’isolation des instances et le cycle de vie des interfaces.
- **66 contrôles d’interface** : menus d’origine, réverbération remappée, conservation des presets, polices effectivement chargées, arrondis, curseur et alignement.
- **69 contrôles sur la distribution**, incluant la production d’un signal audio fini et non silencieux par chaque plugin distribué.
- Vérification de la reproductibilité du build, des empreintes des fichiers et de l’identité des ressources copiées.

Les 37 presets internes restent disponibles au moteur pour la compatibilité des anciens états et les comparaisons ; seuls les 24 presets des menus WAP sont proposés à l’utilisateur.

La référence WAP Blues contient un chemin erroné pour le cabinet Fender Champ. Le harnais de comparaison redirige ce chemin vers la ressource prévue, sans modifier le script WAP original. Cette exception est consignée dans les résultats.

Les mesures attestent de l’équivalence numérique sur les signaux et configurations testés dans le navigateur utilisé. Elles ne remplacent pas une écoute comparative ni une validation sur tous les navigateurs.

Les rapports détaillés sont dans :

- `WAM/VALIDATION.json`
- `WAM/VALIDATION_UI.json`
- `WAM/VALIDATION_DIST.json`

Pour rejouer les vérifications, utiliser `WAM/validation.html`, `WAM/gui-validation.html` et `WAM/gui-validation.html?dist`. La documentation technique complémentaire se trouve dans `WAM/README.md`, et l’analyse initiale du portage dans `WAP_TO_WAM.md`.

## Intégration dans le host NAM A2

Les trois plugins distribués sont copiés dans le catalogue du host principal :

| Plugin | Dossier dans `examples/wam/wamPlugins/` |
|---|---|
| Blues Machine | `bluesmachine/` |
| Clean Machine Full | `cleanmachine/` |
| Modern Metal Machine | `metalmachine/` |

Le menu **+** des chaînes les propose dans la catégorie **Amplifiers**. Chaque descripteur référence `assets/thumbnail.png`, une capture réelle de son interface WAM avec les polices originales, utilisée dans le menu et les cartes du rack.

Pour reconstruire la distribution, remplacer ces trois copies et synchroniser le catalogue :

```sh
npm run install:wasabi-amps
```

Cette commande appelle le même build que `npm run dist:wasabi-amps`, puis copie les dossiers générés dans les emplacements ci-dessus. Les sources à modifier restent dans `examples/WAP_amp_sims/michel/WAM/` ; les copies du host sont des artefacts installés. Le catalogue est mis à jour sans changer les métadonnées des autres plugins.

### Reconstruire aussi la distribution du host

L’installation dans `examples/wam/wamPlugins` ne met pas à jour une ancienne copie du host dans `dist/NAM_A2_WAM`. Pour préparer le host complet à déployer, exécuter depuis la racine :

```sh
npm run install:wasabi-amps
npm run dist
```

`npm run dist:wasabi-amps` génère uniquement les trois plugins autonomes. `npm run install:wasabi-amps` les installe dans le host de développement. **`npm run dist` reconstruit le host complet**, avec son catalogue et ses plugins, dans `dist/NAM_A2_WAM/`. Le point d’entrée à servir est alors `dist/NAM_A2_WAM/index.html`.
