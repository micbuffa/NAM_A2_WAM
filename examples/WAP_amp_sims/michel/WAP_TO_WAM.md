# Migration des amplis WAP vers WAM v2

Analyse du 10 octobre 2026. Périmètre : `utility`, `blues`, `cleanfull` et `modernmetal` dans ce dossier, confrontés aux SDK et plugins WAM v2 présents dans le projet. Le nom réel du dernier dossier est **`modernmetal`**, et non `modermetal`.

Ce document repose sur une lecture statique des sources et un inventaire des ressources. Aucun ampli n'a été modifié, aucun portage n'a été commencé, aucun test audio ou essai de l'ancien host dans un navigateur n'a été effectué. Les anomalies décrites sont des constats de code ; leur impact audible reste à mesurer.

## 1. Conclusion et approche recommandée

**Les trois amplis peuvent devenir des plugins WAM v2 en conservant leurs graphes Web Audio natifs.** Leur DSP utilise principalement `GainNode`, `BiquadFilterNode`, `WaveShaperNode` et `ConvolverNode`. Modern Metal ajoute notamment un `DelayNode` dans sa contre-réaction. Il n'est pas nécessaire de réécrire ce DSP en Faust, en WASM ou dans un AudioWorklet pour effectuer cette migration.

Je recommande trois plugins indépendants, chacun avec un module `WebAudioModule`, un nœud composite conforme à WAM v2 et un `ParamMgr` pour les paramètres et événements. Un petit socle commun peut gérer le chargement des IR, l'état, les presets et le cycle de vie. Les graphes et fonctions de transfert propres à chaque ampli doivent rester séparés au départ.

Le travail principal porte sur le **contrat avec le host** : chargement en modules ES, paramètres décrits et automatisables, état complet, initialisation asynchrone attendue, interface indépendante du DSP et destruction explicite. Un simple adaptateur autour de `setParam()` serait insuffisant : l'API WAP actuelle ne décrit pas et ne sauvegarde pas tout ce qui détermine le son.

Pour établir une référence sonore, il faudra distinguer deux objectifs : reproduire le **comportement effectif actuel**, ou rétablir l'intention de certains presets contredite par leur ordre d'application. Le premier est le meilleur point de départ pour une migration vérifiable ; les corrections sonores doivent ensuite être identifiées séparément.

## 2. Ce que fait réellement le host `utility/index.html`

### Chargement et graphe audio

Le host charge d'abord des scripts classiques : le polyfill Web Components, `WebAudioSDK.js`, l'utilitaire, plusieurs variantes d'amplis, puis le noise gate. Les scripts inutilisés ne sont pas instanciés par `loadAmps()`, mais leurs déclarations globales sont tout de même exécutées.

L'utilitaire est créé avec `WasabiAmpsimUtility`, puis `load()` et `loadGui()`. Dans `loadAmps()`, les trois amplis actifs sont **Modern Metal, Clean Full et Blues**, ainsi que `FaustDeadGateWithParams`. Le chemin audio est :

```text
GuitarRiffDry.mp3 ─┐
                  ├─ AmpsimUtility ─ Noise gate externe ─ Modern Metal ─ Clean Full ─ Blues ─ destination
Entrée guitare ───┘
```

À l'intérieur d'`AmpsimUtility`, on trouve déjà : sélection des canaux par splitter/merger, gain d'entrée, **un autre deadgate Faust**, puis sortie. Il y a donc deux étages de gate sur ce chemin lorsque les chargements aboutissent. Les trois simulations ne sont pas trois alternatives écoutées séparément : elles sont câblées en série. Leurs positions de bypass déterminent ce qu'on entend.

L'ordre d'affichage des GUI est différent : gate externe, Blues, Modern Metal, Clean Full. Comparer le rendu visuel au son sans tenir compte du câblage serait trompeur.

### État et entrée live

- Les boutons Save/Load appellent `getState()`/`setState()` sur **l'utilitaire uniquement**. Ils ne sauvegardent ni les trois amplis, ni le gate externe, ni le graphe complet.
- La sauvegarde est une variable en mémoire, sans persistance. Charger avant la première sauvegarde n'est pas protégé.
- `getUserMedia()` est demandé au chargement de la page ; le bouton connecte ou déconnecte ensuite la source. Le host n'attend pas explicitement sa disponibilité avant un clic et ne présente pas de gestion d'échec.
- `setup()` du SDK appelle `connectNodes()` sans attendre son résultat. Or l'utilitaire construit son graphe après un chargement asynchrone du deadgate : la résolution de `load()` ne garantit donc pas que ce graphe soit prêt.
- Le helper `loadPluginWithGUI()` ne propage pas correctement les rejets des promesses internes. Certains échecs peuvent laisser le chargement en attente.

### Rôle de l'utilitaire dans la migration

Il faut séparer le portage des amplis de celui de l'utilitaire. Le rack WAM v2 du projet fournit déjà entrée live, gains, routage et mesure ; les amplis n'ont pas à embarquer cet ancien host ni à demander un microphone ou créer leur propre `AudioContext`.

Les meters de l'utilitaire utilisent `ScriptProcessorNode` et des connexions directes à `context.destination`. Ce chemin de mesure mérite un audit avant réutilisation ; il ne doit pas être recopié dans un plugin censé n'émettre que par sa sortie. On trouve aussi des incohérences `leftInput`/`inputLeft` et `rightInput`/`inputRight`, avec `inputRight` qui écrit `params.inputLeft`. Elles concernent l'utilitaire, pas le DSP des trois amplis.

## 3. Architecture WAP actuelle

`WebAudioSDK.js` définit trois couches :

| Couche | Responsabilité actuelle | Conséquence pour WAM v2 |
| --- | --- | --- |
| `CompositeAudioNode` | Objet JavaScript contenant `_input` et `_output` | À remplacer par le composite du SDK WAM v2, qui dérive de `GainNode` |
| `WebAudioPluginCompositeNode` | `params`, setters, état et `setup()` | À remplacer par une gestion explicite des paramètres et de l'état |
| `WebAudioPluginFactory` | Métadonnées, instanciation globale et GUI par HTML Import | À remplacer par `WebAudioModule`, modules ES et `createGui()` |

Le SDK modifie globalement `AudioNode.prototype.connect` pour reconnaître ses objets composites. Les amplis ajoutent également des méthodes aux prototypes d'`AudioContext` et `OfflineAudioContext`. Ces mécanismes ne doivent pas accompagner les versions WAM v2 : ils peuvent interférer avec les autres plugins du host.

`load()` lit `main.json`, récupère une classe dans `window[metadata.name]` puis l'instancie. `loadGui()` impose d'abord `status = "disable"`, importe `main.html` avec `<link rel="import">`, puis appelle une factory globale `create…`. Les GUI se réactivent ensuite dans leur constructeur. Le chargement de l'interface fait donc partie du comportement audio actuel.

`setParam(key, value)` délègue à `this[key] = value` sans liste blanche ni validation. Une clé inconnue peut devenir une propriété ordinaire sans modifier le son. Les trois amplis n'appellent pas `addParam()` : leurs descripteurs de paramètres restent incomplets malgré les nombreux setters disponibles. `getPatch()` renvoie `null` ; `setPatch()` n'est pas un gestionnaire de presets fonctionnel dans le SDK fourni.

Enfin, l'état WAP est une copie superficielle de `params`. La présence d'une méthode DSP ou d'une propriété assignée dans un preset ne garantit pas sa présence dans cet état.

## 4. Les trois moteurs audio

### Blues

Classes/fonctions principales : `BluesMachine`, `AmpBlues`, `EqualizerBlues`, `ConvolverBlues`, `BoostBlues`, `WaveShapersDisto`.

```text
Entrée → gain → boost
       → low shelf 1 → low shelf 2 → gain étage 1 → waveshaper 1
       → high pass → low shelf 3 → gain étage 2 → waveshaper 2
       → volume → treble → bass → middle → presence
       → filtres de correction → EQ 6 bandes / branche de bypass EQ
       → master → réverbération → cabinet → sortie
```

Le moteur possède deux étages de saturation en série, un boost optionnel, une égalisation graphique à 60, 170, 350, 1000, 3500 et 10000 Hz, ainsi que deux convolutions. `volume` agit avant le tone stack ; `master` après l'EQ. Réverbération et cabinet utilisent un mélange direct/convolué, et non une simple convolution entièrement wet.

Il existe **10 presets internes, indexés de 0 à 9**. La GUI n'en expose que six et impose l'index 8 à chaque connexion au DOM. Les noms GUI ne sont pas toujours ceux des objets : « Clean » pointe sur « Another Clean Sound », « Crunchy » sur « Clean and Warm ». Ces libellés doivent être conservés ou renommés par décision explicite, pas déduits des noms internes.

### Clean Full

Classes/fonctions principales : `CleanMachineFull`, `CleanAmpFull`, `EqualizerClean`, `ConvolverClean`, `BoostClean`, `WaveShapers`.

```text
Entrée → gain → boost → low cut → high cut
       ├─ lowpass  → waveshaper 1 → gain 1 ─┐
       ├─ bandpass → waveshaper 2 → gain 2 ─┤
       ├─ bandpass → waveshaper 3 → gain 3 ─┤→ somme / volume
       └─ highpass → waveshaper 4 → gain 4 ─┘
       → bass → middle → treble → presence → EQ / bypass EQ
       → master → réverbération → cabinet → sortie
```

La différence structurante est une **saturation multibande à quatre branches parallèles**, avec fréquences et Q propres. Il ne faut pas la remplacer par le préampli série de Blues sous prétexte que les huit contrôles principaux sont identiques.

Il existe **13 presets, indexés de 0 à 12**, dont six visibles dans la GUI : Clean 1, Clean 2, Clean 3, Light My Knob, Folk Metal String et Electro Acoustic. La GUI impose l'index 11 à chaque connexion.

### Modern Metal

Classes/fonctions principales : `ModernMetalMachine`, `AmpModernMetal`, `PreAmpModernMetal`, `ToneStackModernMetal`, `PowerAmp`, `PresenceFilter3`, `FilterBankModernMetal`, `EqualizerModernMetal`, `ConvolverModernMetal` et `WaveShapersModernMetal`.

Le chemin initial suit : entrée/gain/boost → préampli à deux étages → volume → tone stack → correction/EQ → master → power amp → réverbération → cabinet → sortie. Le préampli peut passer **avant ou après le tone stack**. Des presets ajoutent des étages de saturation supplémentaires.

Le power amp contient une saturation, une banque de filtres de présence et une boucle de contre-réaction négative avec un délai réglé à **128 / sampleRate secondes**. Ce délai participe au modèle : ce n'est pas une latence de transport que l'on peut simplement supprimer ou déclarer comme délai global du plugin. Modern Metal possède aussi un gain final fixe de 0,35 et un gain après cabinet piloté par certains presets.

Il existe **14 presets, indexés de 0 à 13**, construits à partir d'objets nommés `preset1` à `preset14`. L'index d'un menu n'est donc pas le suffixe de la variable. La GUI expose douze choix et impose l'index 8, libellé « Warm Clean », qui correspond à l'objet `preset9` (« Clean 1 »). Le constructeur commence pourtant avec `preset: 1`.

Modern Metal est le portage le plus complexe : topologie variable, saturation supplémentaire, power amp à mémoire et état étendu. Il doit venir après la validation d'un premier ampli.

### Ressources inventoriées

| Ampli | Réverbérations référencées | Cabinets référencés | Volume approximatif du dossier assets |
| --- | ---: | ---: | ---: |
| Blues | 3 | 12 | 3,25 Mo |
| Clean Full | 3 | 12 | 3,65 Mo |
| Modern Metal | 3 | 30 | 5,10 Mo |

Les ressources référencées par les listes d'IR existent sur disque après décodage des espaces `%20`. Cela ne garantit pas que les URL construites soient correctes. **Blues omet un `/`** dans l'URL du cabinet Fender Champ : `this.URL + "assets/…"`. Avec l'URL `../blues` utilisée par le host, le chemin devient incorrect.

## 5. Anomalies et risques à traiter

### Bloquants pour un portage fiable

| Constat vérifié dans les sources | Effet / action à prévoir |
| --- | --- |
| Clean Full assigne `preset1` à `preset12` sans déclaration locale (`main.js`, dès la ligne 585) | Les scripts classiques créent des globals ; un module ES autonome en mode strict peut lever `ReferenceError`. Déclarer les presets dans le module ou les extraire en données |
| Les scripts partagent des noms globaux : `WaveShapers`, `WaveShapersDisto`, `BoostClean`, `PowerAmp`, `tanh`, `sign` | L'ordre de chargement peut substituer une implémentation à une autre. Isoler les moteurs en modules ; comparer les versions avant mutualisation |
| Blues : le setter `LS3Freq` assigne `this.amp.changeLowShelf3FrequencyValue = val` au lieu d'appeler la fonction (`main.js:214`) | Il écrase la méthode publique et ne pilote pas le filtre par cette voie. Le preset appelle aussi la fonction interne directement : son effet n'est donc pas identique à celui du setter |
| Les GUI appliquent un preset dans `connectedCallback()` | Ouvrir ou rattacher un éditeur peut écraser un état restauré. Initialiser le son dans le nœud, une seule fois, avant la création éventuelle du GUI |
| `getState()` ne capture que `params` | Certains réglages des IR, courbes, boost, étages supplémentaires et power amp sont perdus. Définir un état canonique complet |
| Les chargements d'IR ne sont ni retournés ni attendus jusqu'au bout | Une promesse d'initialisation ou restauration peut réussir avant que le son soit prêt. Fournir et attendre une préparation complète |
| Modern Metal sauvegarde `preampPos` en chaîne `"before"`/`"after"`, mais son setter ne reconnaît `"after"` qu'à travers la valeur numérique `1` | Restaurer `"after"` par `setState()` peut remettre le préampli avant le tone stack. Normaliser et convertir explicitement l'ancien état |
| Modern Metal : `attributeChangedCallback()` écrit `preampPos` et `filterstate` vers le DSP | La synchronisation d'affichage modifie l'état. Le test strict `filterstate === 1` ne reconnaît pas `true`. Rendre ce rafraîchissement purement visuel |

### Cohérence des presets et du son

Blues et Modern Metal appliquent d'abord les saturations indépendantes `K1` et `K2`, puis exécutent `parent.drive = p.K1`. Ce setter modifie **les deux étages** : une différence K1/K2 peut être écrasée. Clean Full applique K1…K4 puis `drive = K3`, qui impose son profil à quatre bandes ; le changement de type de distorsion relance aussi `changeDrive(currentK)`.

Il faut donc relever **l'état effectif final** de chaque preset pour la référence, et ne pas supposer que les données du preset sont exactement le son rendu. Une restauration WAM ne doit pas réappliquer arbitrairement un macro-paramètre `drive` après des valeurs indépendantes sauvegardées.

Dans Blues et Modern Metal, `parent.boost` et `parent.distoName1/2` sont assignés par les presets sans setters correspondants dans la classe WAP. Cela n'alimente pas automatiquement `params`. Dans Blues, `parent.boost` remplace même la référence publique au module de boost créée au départ ; le moteur continue à utiliser sa référence capturée dans une closure.

Plusieurs fonctions anciennes consultent `document.querySelector()` ou des contrôles de page absents des GUI encapsulées. Certaines ne sont pas sur le chemin normal, mais doivent être isolées ou retirées du moteur pour permettre une instanciation sans interface. Exemple : `changeInputGain()` dans Blues appelle `setValue()` sur un knob global.

### IR, transitions et stabilité

- Les loaders ne vérifient pas `response.ok` et ne propagent pas systématiquement les échecs de fetch/décodage. Une erreur peut laisser une promesse pendante.
- Il n'y a pas de protection contre deux changements de preset concurrents : une ancienne IR peut terminer après la nouvelle et la remplacer.
- Blues et Clean Full chargent une IR par défaut dès la construction du convolver, puis une autre à l'application d'un preset. Modern Metal a commenté le chargement par défaut et dépend des appels de preset.
- Le remplacement de buffer est accompagné d'une modification du gain d'entrée et d'une rampe de 0,5 s ou 1 s. Il faut conserver cette référence lors de la comparaison, puis décider d'une transition plus robuste ; ce n'est pas déjà un crossfade entre deux convolvers.
- Le mélange direct/wet est trigonométrique (`cos`) ; `CG` pilote ce mélange du cabinet. Il ne faut pas le remplacer silencieusement par un gain linéaire ni forcer wet à 100 %.
- Le `ConvolverNode` conserve sa normalisation par défaut : la désactiver changerait les niveaux. L'oversampling des waveshapers et les gains fixes doivent également être conservés au premier portage.
- Modern Metal référence `cabinet.IRs` au lieu de `cabinetSim.IRs` dans la branche de valeur de cabinet absente. Les presets examinés utilisent des noms, mais cette branche de secours est incorrecte.
- Les réglages `PA_*`, `PREAMP_EXTRA_STAGES`, `CAB_OUTPUT_GAIN` et la banque de présence ne sont pas représentés intégralement dans `params`. La boucle de power amp impose des essais de stabilité sur silence, impulsion et signaux soutenus.

Aucune méthode de destruction complète n'est définie pour les trois amplis WAP. La migration devra prévoir les connexions internes, les GUI et les tâches asynchrones, pas seulement la déconnexion de la sortie.

## 6. Cible WAM v2 et références du projet

La documentation du [SDK WAM](https://github.com/webaudiomodules/sdk) confirme qu'un plugin peut exposer un graphe composite ou un AudioWorklet. Le [SDK ParamMgr](https://github.com/webaudiomodules/sdk-parammgr) est la référence complémentaire pour sa gestion des paramètres. Pour les signatures et comportements précis, les **sources locales réellement utilisées par le host** doivent faire foi : certains exemples en ligne et certaines copies du SDK ne sont pas synchronisés.

Références locales utiles, à partir de la racine du dépôt :

| Source | Ce qu'il faut en retenir |
| --- | --- |
| `examples/wam/wamPlugins/utils/sdk/src/WebAudioModule.js` | `createInstance(groupId, audioContext, initialState)`, descripteur, initialisation et GUI |
| `examples/wam/wamPlugins/utils/sdk-parammgr/src/CompositeAudioNode.js` | Entrée native `GainNode`, sortie `_output`, délégation WAM à `_wamNode` |
| `examples/wam/wamPlugins/utils/sdk-parammgr/src/ParamMgrFactory.js` et `ParamConfigurator.js` | Paramètres publics, paramètres internes et mapping |
| `examples/wam/wamPlugins/utils/sdk-parammgr/src/ParamMgrNode.js` | Connexions aux `AudioParam`, callbacks et cycle de vie |
| `examples/wam/wamPlugins/tuner_machine/src/index.js` | Exemple local de graphe natif avec paramètre à callback |
| `examples/wam/wamPlugins/EndUserAmp1/index.js`, `gui.js`, `preset-state.js` et `README.md` | GUI chargée à la demande, presets, nettoyage et précautions de réouverture déjà traités |
| `examples/wam/WamPluginRegistry.js` | Contrat d'instanciation du rack et validation par étapes |

**Attention à deux détails d'intégration :**

1. Dans le composite WAM v2, `connect()` redirige vers `_output` une fois cette propriété définie. Il faut raccorder l'entrée native au premier nœud par une méthode explicite avant cette redirection, ou appeler la connexion native de façon maîtrisée. Copier le câblage WAP sans tenir compte de cette différence peut connecter la sortie à elle-même ou manquer l'entrée.
2. Dans la copie locale `utils/sdk/src/WebAudioModule.js`, `initialize(state)` crée le nœud avec `createAudioNode()` **sans transmettre ni appliquer `state`**. Mettre uniquement un `if (initialState)` dans `createAudioNode()` ne garantit donc pas la restauration via `createInstance()`. La future classe devra explicitement attendre l'application de l'état initial, avec la copie de SDK choisie, et le vérifier dans un test dédié.

### Répartition des responsabilités proposée

| Élément futur | Responsabilité |
| --- | --- |
| `index.js` | Classe exportée par défaut, descripteur, création du nœud, application attendue de l'état initial, GUI et destruction GUI |
| `Node.js` | Composite WAM, ParamMgr, état, commande de presets, readiness et destruction |
| Moteur propre à l'ampli | Graphe natif, transformations des contrôles, saturations et topologie |
| Données de presets | IDs stables, libellés GUI historiques, réglages complets et références IR |
| Gestion des IR | URL relatives au module, cache, chargement attendu, protection contre résultats obsolètes |
| `Gui.js` / module de création | DOM, styles, gestes utilisateur et affichage synchronisé |
| `descriptor.json` et `assets/` | Métadonnées WAM v2 et ressources nécessaires à l'ampli |

Trois dossiers autonomes sont préférables pour la distribution. Le code commun peut être partagé dans les sources puis embarqué lors du packaging. Une première étape raisonnable consiste à produire les versions WAM à côté des versions WAP, sans transformer les originaux en place.

## 7. Paramètres, automation et état

### Contrôles publics

Les huit knobs communs sont `volume`, `master`, `drive`, `bass`, `middle`, `treble`, `presence` et `reverb`. Les GUI les présentent sur **0…10** avec un pas de 0,1. Conserver cette échelle évite de casser leur ergonomie ; les valeurs normalisées WAM doivent être converties par le gestionnaire de paramètres, pas interprétées directement comme des valeurs 0…10.

| Contrôle / famille | Sens et traitement recommandés |
| --- | --- |
| `volume` | Gain avant tone stack, généralement valeur / 10 ; conserver la position et la loi |
| `master` | Gain linéaire direct dans Blues/Clean Full ; Modern Metal remappe 0…10 vers 0…3 avant le power amp |
| `bass`, `middle`, `treble`, `presence` | Macros de filtres avec lois propres ; Modern Metal déplace l'action de présence selon l'état du power amp |
| `drive` | Macro de reconstruction des courbes ; callback contrôlé, pas reconstruction de tables à chaque échantillon |
| `reverb` et `CG` | Mélanges de convolution, avec conversion / 10 puis loi trigonométrique |
| `status` WAP | Convertir vers un booléen/paramètre discret WAM `bypass` : 0 actif, 1 bypass, avec conversion explicite des anciennes chaînes |
| `EQ` WAP | Exposer six paramètres numériques stables, par exemple `eq60`…`eq10000`, plutôt qu'un tableau comme paramètre WAM |
| `preampPos` | Paramètre discret Modern Metal, 0 avant / 1 après ; convertir les chaînes anciennes |
| `filterstate` | Paramètre booléen cohérent, 0/1 côté WAM ; conversion vers le moteur |
| Sélection IR / courbe | IDs stables dans l'état ; si exposés en paramètres, utiliser des choix discrets et un catalogue stable |
| Sélection de preset | Commande explicite de chargement + métadonnée de sélection ; éviter un callback de paramètre qui recharge le preset pendant toute restauration |

Les contrôles avancés existent déjà dans les setters : LS1/2/3 fréquence/gain, gains d'étage, HP1 fréquence/Q pour Blues et Modern Metal ; LCF/HCF, F1…F4 et Q1…Q4 pour Clean Full. Ils doivent au minimum être sauvegardés. Leur exposition intégrale dans la première GUI peut attendre.

Les bornes avancées ne doivent pas être inventées à partir des huit knobs. Les presets Modern Metal contiennent par exemple un étage supplémentaire avec `k = -3.2` ; les Q peuvent être nuls ou très élevés. Inventorier les valeurs et les contraintes des nœuds avant de fixer les descripteurs, sans clamp silencieux des presets historiques.

### Précision et limite d'automation

Le ParamMgr local peut piloter les `AudioParam` natifs via ses sorties de contrôle. Pour les transformations non linéaires, le recâblage et les waveshapers, il propose des callbacks `onChange` vérifiés par timers sur le thread principal, à 30 Hz par défaut dans `ParamConfigurator.js`. **Ces callbacks ne sont pas sample accurate** et peuvent être retardés lorsque l'interface est occupée.

Le premier portage peut utiliser ces callbacks pour les macros et choix discrets. Il faudra gérer les changements de courbe sans calcul excessif, et les paramètres de topologie/IR comme des opérations lentes. Si l'objectif ultérieur exige une automation rapide et précise du drive, cela justifiera une évolution du moteur ; WAM v2 seul ne résout pas ce problème.

### État canonique proposé

L'état devrait distinguer : version du schéma, identité de l'ampli, valeurs publiques WAM, sélection du preset et état « modifié », références des IR, réglages avancés et topologie. Il doit représenter le **son final actuel**, pas seulement l'index du preset.

Modern Metal exige en plus : power amp activé, courbe et drive du power amp, gain de contre-réaction, plage et filtres de présence, boost de puissance, filtres de coupure, gain après cabinet et liste ordonnée des étages supplémentaires. Les courbes calculées et les AudioBuffers peuvent être reconstruits ; les données qui permettent cette reconstruction doivent être présentes.

Ordre de restauration recommandé : valider/versionner les données → établir la topologie → préparer les IR → appliquer les réglages structurels et valeurs finales selon leurs dépendances → appliquer le bypass → synchroniser l'affichage. Si un ancien état n'a qu'un index de preset et quelques knobs, l'importateur pourra reconstruire une base de preset puis appliquer ces réglages ; cette compatibilité sera nécessairement partielle pour les données jamais sauvegardées.

Les valeurs du moteur et du ParamMgr doivent rester cohérentes après tout chargement de preset. Modifier seulement le DSP laisserait au host et au GUI d'anciennes valeurs ; modifier seulement une sélection ferait perdre les ajustements manuels. Une action de preset doit être transactionnelle, puis publiée à tous les observateurs sans réentrer dans son propre chargement.

## 8. GUI, ressources et cycle de vie

Les graphismes et le contenu des templates peuvent être conservés. Le mécanisme HTML Import, `document.currentScript.ownerDocument`, les factories globales `create…` et le polyfill sont à remplacer par des modules ES. Les styles, polices et sprites devront résoudre leurs URL depuis `import.meta.url` ou une base explicite.

Les GUI utilisent déjà un Shadow DOM, mais les contrôles `webaudio-knob` et `webaudio-switch` restent des custom elements enregistrés globalement. Leur chargement doit être unique et compatible avec les autres versions embarquées par le rack ; des tags propres à cette famille d'amplis éviteraient les collisions, comme dans l'adaptation TubeLab.

Une GUI WAM doit lire l'état à son ouverture et transmettre uniquement les gestes utilisateur. Elle ne doit ni appliquer le preset par défaut à chaque rattachement, ni activer l'ampli dans son constructeur, ni écrire dans le DSP en rafraîchissant ses switches. Le switch bypass doit dériver du véritable état courant, plutôt que d'un `isOn` initialement indéfini.

Prévoir un chargement GUI à la demande, la suppression des listeners et animations à la destruction, la réouverture sans changement de son et l'isolation de plusieurs instances. Le module audio doit fonctionner sans GUI. Les requêtes IR encore en cours doivent être annulées ou leurs résultats ignorés après destruction.

Les huit knobs portent `midilearn="1"` et les pages activent globalement `WebAudioControlsOptions.useMidi`. Cela ne constitue pas une implémentation du routage MIDI WAM. Les `onMidi()` des amplis renvoient simplement le message. Le premier descripteur peut annoncer l'absence de MIDI tant qu'un mapping WAM explicite n'est pas implémenté ; éviter que les widgets demandent eux-mêmes une connexion MIDI globale au chargement.

Pour les assets, utiliser des IDs d'IR indépendants des URL de déploiement, conserver les WAV et leur politique de normalisation, puis gérer les chemins avec des URL de module. La présence de ces fichiers ne prouve pas leurs droits de redistribution : conserver les notices existantes et vérifier la provenance des IR, polices et images avant une publication autonome.

## 9. Intégration future dans le rack et la distribution

Le rack instancie les plugins par `Plugin.createInstance(groupId, audioContext)` puis utilise `plugin.audioNode`. Les futurs amplis doivent satisfaire ce contrat et permettre la création du GUI séparément.

Leurs descripteurs devront annoncer WAM v2, une identité unique et stable, des noms distincts, les capacités audio et une catégorie `amplifier`. Il faut explicitement déclarer les capacités réellement supportées : le SDK local initialise plusieurs indicateurs MIDI/OSC/MPE à `true` par défaut.

La commande de découverte `tools/update-wam-plugins.mjs` scanne `examples/wam/wamPlugins/`, pas le dossier WAP. Conserver les nouveaux plugins seulement dans ce dossier d'étude ne les fera pas apparaître automatiquement. Le packaging/catalogue devra être décidé lors de l'implémentation, puis validé dans la distribution déplacée.

Les trois amplis embarquent déjà leur cabinet et leur réverbération. L'insertion dans la chaîne NAM/Cabinet existante peut donc cumuler deux cabinets. Le premier portage devrait conserver le cabinet interne pour préserver les presets, avec une possibilité explicite de le neutraliser ultérieurement ; le host ne doit pas supposer que ces amplis fournissent les métadonnées NAM nécessaires à Cabinet AUTO.

La configuration des canaux doit être explicitée et mesurée : les graphes natifs et IR peuvent traiter ou produire de la stéréo. Le nombre de ports audio n'est pas le nombre de canaux. Ne pas imposer le comportement mono de NAM aux trois amplis sans comparer entrée mono, entrée stéréo et sortie de convolution.

## 10. Déroulement proposé et critères de validation

### Étape A — Figer les références

Conserver les sources WAP, inventorier tous les presets et leurs index/libellés, capturer les réglages effectivement appliqués, et préparer une comparaison isolée de chaque ampli. Le host en série ne suffit pas à produire cette référence. Vérifier l'effet des collisions globales avant de considérer l'ancien host comme référence définitive.

Mesurer à 44,1 et 48 kHz, avec le même DI et niveau d'entrée, les crêtes/RMS, les sorties sur silence/impulsion et le comportement de bypass. Attendre les IR et les rampes avant de comparer les portions stationnaires.

### Étape B — Premier portage : Blues

Isoler le moteur, retirer les mécanismes globaux, corriger les erreurs empêchant le contrat WAM, implémenter des paramètres et un état complets, puis adapter le GUI. Conserver les lois de gain, courbes, filtres, cabinet et réverbération pour comparer les sons. Documenter séparément l'effet de la correction `LS3Freq` et de toute modification de l'ordre des presets.

### Étape C — Clean Full

Réutiliser uniquement l'infrastructure validée. Garder les quatre branches de saturation, déclarer localement les presets et préserver leur ordre d'application de référence. Tester les gains/fréquences/Q et la restauration des réglages multibandes.

### Étape D — Modern Metal

Porter le préampli et le tone stack, puis le power amp, sa banque de présence et les étages supplémentaires. Vérifier chaque preset, les permutations avant/après, les transitions entre topologies et le comportement sur silence prolongé. Ce portage ne peut pas se limiter aux dix contrôles visibles.

### Étape E — Packaging et validation WAM

| Domaine | Critère de réussite |
| --- | --- |
| Import/instance | Chargement ES sans anciens SDK WAP, prototype patches ou dépendance au host utility ; création sans GUI |
| État initial | `createInstance(..., initialState)` restaure réellement tout l'état, IR comprises |
| Paramètres | Descripteurs complets, conversions normalisées correctes, automation reçue et valeurs DSP/host/GUI cohérentes |
| État/presets | Round trip fidèle d'un preset modifié ; aucun reset à l'ouverture du GUI ; sélection et réglages avancés conservés |
| Audio | Sorties finies, comparaison WAP/WAM après préparation identique ; mono/stéréo et 44,1/48 kHz vérifiés |
| Bypass | Un seul chemin dry audible, comportement interne et bypass du rack cohérents, transitions définies |
| Asynchronisme | Échec IR visible, pas de promesse pendante, changements rapides sans retour à une ancienne IR |
| Isolation | Deux instances du même ampli et les trois familles simultanément, sans globals ni état partagé mutable |
| Cycle de vie | Ouvrir/fermer/rattacher le GUI conserve le son ; supprimer l'instance libère nœuds, timers et tâches |
| Distribution | Déploiement à un autre chemin sans 404, assets et SDK nécessaires inclus, catalogue et miniatures corrects |

Une écoute comparative sur guitare et interface physique restera nécessaire après les mesures. La précision des callbacks d'automation, les transitions de topologie et la stabilité du power amp sont des points à valider pendant le portage, pas des propriétés déjà démontrées par cette analyse.

## 11. Choix recommandés pour démarrer

1. **Trois plugins WAM v2 distincts**, avec les moteurs Web Audio natifs conservés.
2. **Blues en premier**, Clean Full ensuite, Modern Metal en dernier.
3. **Préservation des sons effectifs avant amélioration des presets**, avec traces des corrections qui changent le rendu.
4. **État canonique complet dès le départ**, même si la première GUI reste simple.
5. **Cabinet/réverbération internes conservés**, entrée live et utilitaire laissés au host.
6. **Aucune réécriture Faust/WASM au premier portage** ; la décider seulement si les mesures ou exigences d'automation le justifient.

## 12. Repères dans les sources analysées

Les numéros ci-dessous correspondent aux fichiers au moment de l'analyse et servent à retrouver les constats.

| Fichier local | Repère |
| --- | --- |
| `utility/index.html` | Scripts, `loadAmps()`, sauvegarde de l'utilitaire et entrée live |
| `utility/main.js:70` | Construction asynchrone du graphe avec deadgate interne |
| `utility/main.js:153` | Setters de canaux incohérents |
| `utility/main.js:235` | Meter avec ScriptProcessor et connexion à destination |
| `WebAudioSDK.js` | Composite WAP, patch `connect`, état et factory HTML Import |
| `blues/main.js:1` | Classe WAP et liste des IR |
| `blues/main.js:214` | Setter `LS3Freq` incorrect |
| `blues/main.js:374` | Graphe audio Blues |
| `blues/main.js:1060` | Application des réglages de preset et valeurs recopiées vers le parent |
| `blues/main.js:1260` | Convolver Blues et chargement asynchrone |
| `blues/main.html` | Menu partiel, preset 8 au rattachement et contrôle du bypass |
| `cleanfull/main.js:340` | Graphe parallèle quatre bandes |
| `cleanfull/main.js:434` | Type de distorsion et macro drive |
| `cleanfull/main.js:585` | Premier preset assigné sans déclaration locale |
| `cleanfull/main.js:949` | Ordre d'application des presets |
| `cleanfull/main.html` | Menu partiel et preset 11 au rattachement |
| `modernmetal/main.js:307` | Setters EQ, position du préampli et filtre power amp |
| `modernmetal/main.js:410` | Graphe et changement de position préampli/tone stack |
| `modernmetal/main.js:1363` | Presets, IR, power amp et étages supplémentaires |
| `modernmetal/main.js:2150` | Power amp et boucle de contre-réaction |
| `modernmetal/main.js:2682` | Convolver et gain après cabinet |
| `modernmetal/main.html:329` | Preset au rattachement et écritures DSP pendant le rafraîchissement |

Ce document est le seul livrable de cette étape. Les versions WAP restent intactes.
