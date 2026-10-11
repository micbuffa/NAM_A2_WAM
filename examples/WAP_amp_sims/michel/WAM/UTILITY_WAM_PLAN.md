# Wasabi Ampsim Utility : faisabilité et plan de portage WAM v2

## Conclusion

Le portage est faisable en composant un nouveau module WAM v2 avec **la DeathGate WAM existante**, chargée sans appeler `createGui()`. Il n’est pas nécessaire de porter ou de recompiler le DSP de la noise gate WAP.

Une sonde temporaire a testé la DeathGate actuelle sans modification à 44 100 et 48 000 Hz. Elle confirme le chargement headless, un signal fini et non silencieux, la fermeture du gate, la restauration explicite de l’état et la création d’une seconde instance dans le même AudioContext. Son code temporaire a été retiré ; les mesures et empreintes des fichiers testés sont conservées dans `UTILITY_FEASIBILITY_PROBE.json`.

**Mise à jour du 11 octobre 2026 : le portage est implémenté.** Voir [la documentation Utility](utility/README.md), `UTILITY_VALIDATION.json` et `UTILITY_VALIDATION_DIST.json`. Le reste du document conserve l’analyse et le plan ayant guidé l’implémentation.

## Sources examinées

- WAP : `../utility/main.js`, `../utility/main.html`, `../utility/main.json`.
- Ancienne gate embarquée : `../utility/deadgate/main.js`, `FaustDeadGate.dsp` et WASM associé.
- WAM existante : `../../../wam/wamPlugins/deathgate/index.js`, `Node.js`, `deathgate.wasm`, `deathgate.dsp`, `descriptor.json`, `Gui/`.
- SDK/ParamMgr de DeathGate : `../../../wam/wamPlugins/utils/sdk/` et `sdk-parammgr/`.
- Infrastructure réutilisable du portage des amplis : `shared/`, scripts de build et d’installation.
- Routage et mesures du host : `../../../wam/FxChain.js`, `FxRack.js`, `AudioLevel.js`.

Les chemins de cette liste sont relatifs au présent dossier `michel/WAM/`.

## Ce que fait réellement le WAP

Le traitement est :

```text
Entrée → splitter L/R → activation indépendante L et R
       → merger stéréo → gain d’entrée → DeathGate Faust → sortie
```

La sélection conserve la position des canaux : désactiver L ne déplace pas R vers L. Dans le DSP DeathGate, les deux canaux sont ensuite **additionnés en mono**, filtrés, traités par la dead zone et le gate multibande, puis le résultat est dupliqué sur les deux sorties. Il faut conserver cette somme et ses niveaux : aucune moyenne L/R ni normalisation supplémentaire.

L’interface Utility montre deux knobs (Input Gain et Noise Gate), des lettres L/R cliquables et deux ensembles de meters. Le contrôle Dead Zone est masqué. Le WAP ne présente pas de switch de bypass actif dans son template.

Le meter d’entrée lit `_input`, donc avant le gain et avant la sélection des canaux ; les indicateurs des canaux désactivés sont masqués. Le meter de sortie mesure après DeathGate. Ne pas changer silencieusement ces points de mesure.

L’utilitaire est un plugin de traitement audio. Il ne doit ni demander le microphone, ni choisir les périphériques, ni gérer le lecteur audio : ces responsabilités restent dans le host.

## Correspondance des paramètres

| Utility | Domaine et valeur initiale | Destination |
|---|---|---|
| `inputGain` | Gain linéaire 0,01–2 ; initial 1 | GainNode avant DeathGate |
| `noiseGate` | −120–0 dB ; initial −120 | `/deathgate/NoiseGate` |
| `leftInput` | Booléen ; initial activé | Activation du canal L avant le merger |
| `rightInput` | Booléen ; initial activé | Activation du canal R avant le merger |

L’ancienne gate utilisait `/kpp_deadgate/Noise_Gate`, tandis que la WAM utilise **`/deathgate/NoiseGate`**. La dead zone correspond désormais à **`/deathgate/DeadZone`**, de −120 à 0 dB, initialement **−100 dB**. La valeur −110 inscrite dans le knob WAP caché n’est pas appliquée par défaut : conserver −100 pour ne pas modifier le son.

Recommandation pour la première version : exposer les quatre paramètres Utility ci-dessus, garder la dead zone dans l’état interne de la gate et ne pas ajouter de contrôle visible. Le rack possède déjà son bypass externe ; ne pas ajouter un second switch à la GUI pendant ce portage.

## Mesures de faisabilité déjà réalisées

Signal de test : oscillateur 220 Hz, gain 0,02, entrée mono vers DeathGate ; sortie mesurée mais écoute coupée. Les niveaux ci-dessous sont des amplitudes crête flottantes, après 400 ms de stabilisation.

| Fréquence | Headless sans GUI créée | Gate à −120 dB | Gate à 0 dB | État restauré | Deuxième instance créée |
|---|---|---:|---:|---|---|
| 44 100 Hz | Oui | 0,039951 | 1,195 × 10⁻⁷ | Oui | Oui |
| 48 000 Hz | Oui | 0,039961 | 9,641 × 10⁻⁸ | Oui | Oui |

Le niveau proche de 0,04 avec une source mono à 0,02 est cohérent avec l’upmix stéréo de l’entrée directe de DeathGate et sa somme interne. Dans Utility, le splitter/merger doit être testé séparément : une entrée mono n’a pas nécessairement la même distribution L/R à ce point.

La sonde ne valide pas encore l’isolation audio et l’automation de deux Utility, puisqu’elles n’existent pas. Elle n’établit pas non plus l’équivalence numérique avec le WAP original.

## Corrections préparatoires nécessaires

### 1. Rendre DeathGate réellement headless à l’import

`deathgate/index.js` importe actuellement `Gui/index.js` statiquement. Cette dépendance importe les anciens `webaudio-controls`, enregistre un élément graphique et ajoute des éléments/styles au document, même si aucune GUI n’est créée. Elle peut aussi consulter les options MIDI globales.

Déplacer l’import de la GUI dans `createGui()`. Le chargement audio headless doit uniquement charger le module WAM, ses SDK, `Node.js` et le WASM. Cela réutilise bien le plugin WAM existant ; on ne remplace pas son DSP par une nouvelle gate.

### 2. Fiabiliser la destruction

Le `ParamMgrProcessor.destroy()` utilisé par DeathGate ferme son port avant que le gestionnaire RPC puisse renvoyer l’accusé de réception. À 44,1 comme à 48 kHz, la sonde n’a reçu aucune confirmation de destruction dans les 300 ms testées. Le source explique ce résultat.

Appliquer la correction déjà utilisée dans le ParamMgr des trois amplis : laisser le processeur répondre, puis fermer le port côté nœud. Choisir explicitement le périmètre : correction ciblée du SDK utilisé par DeathGate, ou adoption pour DeathGate de la version locale déjà corrigée, sans modifier son WASM. Si le SDK commun du host est corrigé, rejouer les tests des autres plugins qui le partagent.

Rendre la destruction du nœud DeathGate idempotente et attendable, avec déconnexion de son entrée native, de sa sortie et de ses liaisons ParamMgr. Le parent doit détruire son enfant exactement une fois, y compris après échec partiel d’initialisation.

### 3. Initialisation et erreurs

Le SDK de DeathGate ne transmet pas actuellement `initialState` depuis `initialize()` vers `createAudioNode()`. Ne pas compter sur `createInstance(group, context, state)` sans correction : créer l’enfant puis appeler explicitement et attendre `setState()`, ou corriger cette transmission et la tester.

`Node.js` peut retourner `null` après un échec de chargement. Le module doit rejeter clairement l’initialisation, avant de connecter quoi que ce soit. Les URL Blob créées pour enregistrer l’AudioWorklet doivent être révoquées après `addModule()`.

Le chargeur possède un cache d’enregistrement fragile, local à la factory, avec une référence non qualifiée à `name`. Le processeur tolère les réenregistrements avec un `try/catch`, et la seconde instance fonctionne dans la sonde. Ce n’est donc **pas un blocage confirmé** ; remplacer ce mécanisme par un cache de Promise par AudioContext est néanmoins recommandé pour les créations répétées ou concurrentes.

### 4. Métadonnées

Le descripteur DeathGate indique `apiVersion: "1.0.0"`, alors que son implémentation utilise le SDK WAM v2. Corriger cette métadonnée. Ne pas renommer ses paramètres ou modifier ses valeurs par défaut : son usage autonome dans le host doit rester compatible.

## Architecture proposée

Créer `michel/WAM/utility/` avec un module `WebAudioModule`, un nœud composite, une GUI et des ressources locales. Réutiliser le SDK et les contrôles du portage précédent, sans forcer Utility dans la classe spécialisée des amplificateurs.

Initialisation du module :

1. Charger le descripteur Utility et importer la classe DeathGate WAM.
2. Créer **une instance DeathGate propre à cette Utility**, avec le même AudioContext et le groupId WAM reçu du host. Ne pas réinitialiser l’environnement WAM du contexte et ne pas partager l’instance DeathGate avec une autre Utility ou la carte DeathGate autonome du rack.
3. Attendre sa création ; valider les deux identifiants de paramètres attendus.
4. Construire le splitter, les gains d’activation L/R, le merger et le gain d’entrée ; connecter la sortie de la gate à la sortie Utility.
5. Appliquer les valeurs initiales ou restaurées, puis seulement résoudre l’initialisation du parent. La création de la GUI n’intervient jamais dans cette séquence.

Deux GainNodes 0/1 après le splitter permettent d’activer les canaux sans reconnecter le graphe à chaque clic. Conserver strictement L→L et R→R, et tester les transitions pour choisir une éventuelle rampe très courte sans modifier les niveaux stabilisés. Préserver le comportement mono du WAP ; ne pas imposer aveuglément un upmix stéréo avant son splitter.

Le parent expose uniquement son propre nœud et son ParamMgr au host. La gate enfant reste privée. Aucun câble du plugin ne doit aller directement à `context.destination`.

### Paramètres, automation et état

Utiliser les API WAM de l’enfant pour transmettre `noiseGate`, via un adaptateur qui traduit son identifiant. Pour la première version, un relais à la cadence de contrôle ParamMgr est suffisant pour un seuil de noise gate, comme pour les paramètres natifs des amplis portés. Documenter cette cadence : ce n’est pas une promesse d’automation à l’échantillon près. Le gain d’entrée peut être relié directement à son AudioParam natif.

Éviter de brancher naïvement un second ParamMgr sur l’AudioParam exposé par le ParamMgr enfant : les offsets et valeurs de base peuvent alors rendre l’état de l’enfant incohérent avec la modulation effective. Si une automation plus précise devient nécessaire, prévoir un relais d’événements WAM horodatés distinct, testé sans double application.

L’état versionné contiendra les quatre paramètres Utility et l’état de la gate, notamment sa dead zone. À la restauration : valider l’ensemble, restaurer l’enfant, puis appliquer les paramètres du parent ; **`noiseGate` du parent fait autorité** si le snapshot de l’enfant contient aussi cette valeur. Annuler les automations antérieures lors d’une restauration complète.

Importer les anciens états en acceptant les noms canoniques `leftInput` et `rightInput`, avec une migration explicite si les alias défectueux `inputLeft`/`inputRight` sont rencontrés. Les setters WAP sont incohérents et l’un écrit dans le mauvais champ ; ne pas recopier ce défaut.

### GUI et meters

Reprendre l’aspect du WAP : panneau 232 × 272, texture `utility.png`, knobs Jambalaya, police Metalfont, coins arrondis, boutons L/R et meters. Charger la police explicitement avec un nom propre à Utility. Conserver le curseur vertical des knobs et rendre les commandes L/R accessibles au clavier.

Remplacer les ScriptProcessorNodes et les boucles RAF permanentes du WAP par des taps AnalyserNode séparés par canal et une boucle d’affichage suspendue lorsque la GUI est fermée. Le principe de `AudioLevel.js` du host est réutilisable, mais le plugin distribué doit embarquer son propre petit module de mesure.

Les meters ne doivent pas changer le son, créer une seconde route vers la sortie audio ou s’accumuler à chaque réouverture. La création, fermeture et recréation de la GUI ne doivent modifier aucun paramètre.

## Distribution et intégration dans le host

Conserver la règle **un plugin / un dossier autonome**. Une dépendance codée en dur vers `../deathgate/index.js` dans le dossier distribué casserait cette règle.

Recommandation : maintenir DeathGate dans son dossier source actuel et en embarquer une copie versionnée lors du build Utility, avec ses dépendances réellement nécessaires, par exemple :

```text
utility/
  index.js
  descriptor.json
  Node.js
  gui.js
  assets/
  shared/
  vendor/
    deathgate/   # Le WAM existant, DSP inchangé
    utils/       # Dépendances locales de cette copie si cette organisation est retenue
```

L’entrée Utility importe le **module WAM DeathGate**, pas seulement son WASM. Le build adapte les chemins et vérifie qu’ils restent dans le dossier autonome. Éviter de copier aveuglément tout `utils/` : sélectionner le graphe de dépendances runtime. Conserver les attributions et notices des composants Faust et WebAudioControls, et identifier la version embarquée par empreintes.

Cette copie permet de déposer Utility seul sur un serveur et d’utiliser simultanément la DeathGate autonome déjà présente dans le rack. Ajouter aussi un test de coexistence des deux versions dans le même contexte.

Ajouter Utility au build et à l’installation existants **sans retirer les trois amplis**. Cible du host proposée : `examples/wam/wamPlugins/ampsimutility/`. Catégorie retenue : `amplifier` (avec les simulations d’amplis, à la demande de Michel), avec tags gain, input et noisegate. Le descripteur doit référencer une capture réelle de sa GUI.

Enfin, reconstruire **la distribution du host** avec `npm run dist`, après la génération et l’installation de Utility. Vérifier le menu + dans `dist/NAM_A2_WAM/`, pas uniquement dans `examples/wam/`.

## Plan d’implémentation et critères d’acceptation

### Étape 1 — Stabiliser la DeathGate WAM utilisée comme enfant

Import GUI différé, destruction acquittée/idempotente, état initial et erreurs fiables ; cache par contexte si nécessaire. Conserver le WASM et les identifiants. Tester le mode autonome et headless, deux instances et leur recréation dans un même contexte.

### Étape 2 — Implémenter le nœud Utility headless

Routage L/R, gain, instance DeathGate privée, mapping des quatre paramètres, état et nettoyage. Tester sans GUI et sans entrée live. Une erreur d’initialisation doit rejeter proprement et laisser la chaîne précédente du host intacte.

### Étape 3 — Porter l’interface et les mesures

Fidélité graphique, polices réellement chargées, knobs et commandes L/R, meters sans dépendance au DOM dans le moteur. Vérifier que fermer/réouvrir l’éditeur conserve l’état et un nombre borné de nœuds/listeners.

### Étape 4 — Valider le son et la composition

À 44,1 et 48 kHz, comparer :

- Utility WAP avec sa gate d’origine ↔ Utility WAM avec la DeathGate WAM demandée.
- Utility WAM ↔ routage Web Audio de référence suivi de **la même DeathGate WAM**. Cette seconde comparaison sépare les erreurs du wrapper des différences éventuelles entre les deux DSP Faust.

Utiliser guitare sèche, sinusoïdes, bruit faible et silences ; gain minimal/unitaire/maximal, plusieurs seuils, quatre combinaisons L/R, mono, gauche seule, droite seule et stéréo en opposition de phase. Mesurer erreur crête/RMS, atténuation, attaque/hold/release et décalage temporel éventuel ; ne pas attribuer aveuglément la valeur de compensation ParamMgr à une latence DSP mesurée.

Les compilations Faust diffèrent : **2.28.6 pour la gate WAP, 2.40.12 pour la WAM**, avec des versions de bibliothèques différentes. Leur source de traitement est très proche, mais l’identité bit à bit n’est pas acquise. Ne pas modifier le DSP demandé pour masquer un écart : mesurer et documenter la différence.

Tester aussi l’automation normalisée, l’état initial, la restauration, le rejet d’états invalides, deux Utility aux seuils différents, la coexistence avec DeathGate autonome, la destruction pendant un chargement et les échecs de fetch/WASM.

### Étape 5 — Distribuer et intégrer

Générer Utility autonome, vérifier les imports et empreintes, copier la version distribuée dans le host, actualiser le catalogue et la miniature, puis reconstruire `dist/NAM_A2_WAM`. Vérifier ajout, ouverture, bypass externe, suppression et restauration dans les chaînes A/B. Rejouer les tests du host et ceux des trois amplis si des fichiers communs ont changé.

## Décision recommandée

Procéder à ce portage en réutilisant la DeathGate WAM existante comme enfant privé, avec les corrections de cycle de vie identifiées et une copie embarquée à la distribution. Le fonctionnement headless est déjà vérifié ; la fidélité sonore WAP/WAM complète et le cycle de vie du futur parent restent les objectifs des tests d’implémentation.
