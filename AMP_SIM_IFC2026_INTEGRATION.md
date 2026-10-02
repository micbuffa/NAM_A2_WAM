# Intégration du simulateur d’amplificateur IFC2026

Date : 2026-09-24
Statut : intégration implémentée et validée dans le navigateur pour EndUserAmp1 et EndUserAmp2. La spécification initiale est conservée ci-dessous ; les sections 9–11 décrivent la livraison et son extension.

## 1. Objectif

Extraire le WAM d’amplificateur utilisé par l’autre hôte, le rendre autonome dans `examples/wam/wamPlugins/EndUserAmp1/`, puis le proposer dans la catégorie Amplifier du menu `+` de notre rack. Son ajout au catalogue intervient seulement après validation de la copie isolée. Le plugin doit aussi être utilisable par son URI dans un autre hôte WAM compatible.

Ne pas démarrer la gestion des presets du rack (phase 7.2). Les états WAM et leurs tests de restauration font partie de cette intégration.

## 2. Source effectivement trouvée

Le chemin présent dans le dépôt est `examples/other_wam_host/EndUserAmp1/host/`, et non directement `examples/other_wam_host/host/`.

Son `index.js` importe l’amplificateur depuis `../index.js`, soit :

`examples/other_wam_host/EndUserAmp1/index.js`

Le descripteur indique :

- Nom : `guitar tube amp sim 100% FAUST`.
- Identifiant : `fr.grame.faust.guitar tube amp sim 100% faust`.
- Auteurs/vendor : Michel Buffa & Jerome Lebrun.
- Version : 0.1 ; API WAM : 2.0.0.
- Effet audio avec entrée/sortie audio et entrée MIDI.
- Faust mono, sans FFT ni module d’effet séparé (`poly: false`, `fft: false`, `effect: null`).

Le DSP annonce **une entrée et deux sorties**. Il comprend un préampli Guitarix, un tone stack, un étage de puissance, une réverbération et un simulateur de cabinet. Le README rattache le préampli à `IFCPreampGuitarix.dsp` ; le binaire livré est la référence pour cette extraction, sans recompilation DSP prévue.

**Écart concernant la vignette :** le `descriptor.json` inspecté ne contient actuellement aucun champ `thumbnail`, et aucune image n’a été trouvée dans le package hors sous-dossier `host`. Ne pas attribuer au plugin une vignette appartenant à un autre effet. Pendant l’implémentation, vérifier si une nouvelle version du descripteur ou une image a été fournie ; sinon capturer son interface réelle, livrer `thumbnail.png` dans sa copie et référencer ce fichier depuis le descripteur. Le fallback du registre reste un secours, pas la vignette finale prévue.

## 3. Contenu à extraire

Destination : `examples/wam/wamPlugins/EndUserAmp1/`.

| Fichier ou dossier | Motif |
| --- | --- |
| `index.js` | Entrée WAM, création du DSP et du gestionnaire de paramètres |
| `descriptor.json` | Identité WAM et référence de vignette |
| `dsp-module.wasm` | DSP compilé existant |
| `dsp-meta.json` | Canaux, paramètres et métadonnées Faust |
| `gui.js` | Interface spécifique pour guitariste |
| `sdk/index.js` | SDK importé par l’entrée WAM |
| `sdk-parammgr/index.js` | CompositeAudioNode et ParamMgrFactory |
| `faustwasm/index.js` | Construction de l’AudioWorklet Faust |
| `utils/webaudio-controls.js` | Contrôles utilisés par l’interface |
| `README.md` et notices de licence applicables | Provenance, auteurs et adaptations |
| Vignette référencée dans le descripteur | Présentation dans le catalogue et la chaîne |

L’inventaire définitif sera confirmé par les imports transitifs et les requêtes réseau réellement effectuées. Conserver les dépendances du package initial avant d’envisager une mutualisation avec celles du rack.

Exclure le sous-dossier `host/`, ses plugins, backing tracks et presets ; exclure aussi les fichiers de démonstration `assets/audio/`, `.DS_Store`, sources maps et déclarations TypeScript non nécessaires au runtime. `faust-ui/` n’est pas importé par l’interface personnalisée inspectée ; `fftw/` ne sert qu’à la branche FFT désactivée du descripteur. Les exclure seulement après confirmation de l’absence de chargement dans les tests. Aucune dépendance vers `other_wam_host` ne doit subsister dans la copie.

## 4. Vérification et adaptations du plugin avant référencement

Tester d’abord le plugin original par son URI avec le SDK de notre hôte, puis sa copie isolée, sans ajouter encore d’entrée au catalogue public.

Points à vérifier ou corriger dans la copie, avec trace dans son README :

1. **Initialisation sans GUI.** Le DSP doit traiter le signal dès `createInstance`, sans ouverture de l’éditeur. Vérifier les valeurs par défaut, le chargement WASM et les erreurs de fetch.
2. **État initial attendu.** `createAudioNode` appelle actuellement `node.setState(initialState)` sans `await` ; s’assurer que la restauration est terminée avant utilisation. Préserver les identifiants de paramètres Faust.
3. **Cycle de vie de la GUI.** La boucle `handleAnimationFrame` relance actuellement une lecture asynchrone des paramètres sans mécanisme d’arrêt visible. Prévoir arrêt, reprise et destruction explicites compatibles avec l’éditeur conservé hors écran par le rack ; éviter lectures après destruction, rejets non gérés et multiplication des boucles lors des réouvertures.
4. **Plusieurs instances.** Vérifier enregistrement du custom element, du processeur Faust et du SDK dans le même AudioContext. Deux instances doivent garder des états et des contrôles indépendants, y compris en présence de NAM et des autres effets Faust.
5. **Libération des ressources.** Fermer les ports, arrêter les processeurs et nettoyer GUI/listeners lors de la suppression. Prévoir `destroyGui` si nécessaire pour le contrat attendu par notre hôte.
6. **Relocalisation.** Tous les chemins se résolvent depuis le module copié. Vérifier les chargements de worklets, les blobs éventuels et le type MIME WASM sous serveur local puis distribution statique.

Ne pas réécrire la modélisation ni changer arbitrairement les valeurs sonores par défaut pendant cette extraction. Toute correction sonore nécessaire doit être identifiée et justifiée séparément.

## 5. Contrat d’intégration dans le rack

Après succès des validations isolées, ajouter à `examples/wam/wamPlugins/plugins.json` une entrée :

```json
{
  "uri": "./EndUserAmp1/index.js",
  "name": "IFC2026 — Guitar Tube Amp (Faust)",
  "category": "amplifier",
  "tags": ["faust", "guitarix", "tube", "amp", "cabinet"]
}
```

Ce nom est un libellé de catalogue proposé, pas un changement de l’identifiant WAM historique. La vignette est lue depuis `descriptor.json`, sans chemin dupliqué dans le catalogue.

- Utiliser le traitement générique des effets du rack (`kind: effect`), sans rôle `nam` : le plugin ne fournit pas l’API de modèle Neural Amp Modeler.
- Conserver le bypass dry/wet du rack, indépendant des bypass internes du préampli, de l’étage de puissance et du cabinet.
- Ne pas adapter l’entrée avec un downmix supplémentaire sans mesure préalable : tester précisément le comportement 1 entrée / 2 sorties, avec une source stéréo et un effet stéréo placé après.
- Permettre insertion, suppression, déplacement, instances multiples, état de diagnostic et branches A/B comme pour tout autre effet.
- Le bouton existant **WAM URI** copie l’URL absolue du module relocalisé, également correcte sous un préfixe de déploiement.
- Le script de distribution copie déjà le dossier `wamPlugins` ; ajouter les vérifications nécessaires pour garantir la présence du WASM, des métadonnées, des dépendances et de la vignette dans le résultat.

### Cabinet interne et Cabinet externe

Ce WAM intègre déjà un cabinet. Ne pas lui inventer des métadonnées NAM, et ne pas désactiver silencieusement un Cabinet externe. Le mode AUTO actuel ne connaît que les NAM : documenter cette limite et tester explicitement les combinaisons. Pour une sortie IFC vers un Cabinet externe, désactiver le cabinet interne ou bypasser le Cabinet externe selon le son recherché. Toute extension future d’AUTO aux autres simulateurs exige un contrat explicite sur leurs paramètres, hors de cette extraction.

## 6. Plan de tests et critères d’acceptation

### A. Intégrité du package

- Résoudre tous les imports et assets depuis la copie ; compilation du WASM réussie.
- Descripteur valide, vignette existante et affichée sans erreur.
- Aucune requête vers `other_wam_host`, aucun fichier audio de démonstration requis.
- Conserver une liste des fichiers copiés et des adaptations ; vérifier le binaire copié par empreinte.

### B. Fonctionnement audio réel dans le navigateur

- Créer le WAM sans GUI dans le groupe WAM de l’hôte, en 44,1 et 48 kHz lorsque l’environnement le permet.
- Injecter à niveau prudent un sinus, une impulsion et un extrait de guitare DI. Mesurer les deux sorties : signal non nul, uniquement valeurs finies, absence d’erreur de processeur. Ne pas confondre silence après un preset ou une mauvaise source avec un échec du DSP.
- Modifier gain/EQ/master : vérifier un changement mesurable et cohérent du signal.
- Vérifier bypass du rack : signal dry sans double chemin ; retour au signal traité.
- Tester entrée gauche seule, droite seule et stéréo ; établir le comportement de downmix et de sortie sans supposer qu’il est identique à NAM.
- Effectuer une écoute de contrôle et distinguer dans le rapport mesures automatisées et écoute réellement réalisée.

### C. État, UI et cycle de vie

- Modifier les paramètres, sauvegarder/restaurer et comparer valeurs et son avec tolérance, après stabilisation des effets à mémoire.
- Deux instances A/B : réglages et GUI indépendants.
- Ouvrir/fermer/réouvrir plusieurs fois, restaurer avant GUI, supprimer l’instance avec son éditeur ouvert ; aucune boucle ou lecture de paramètres après destruction.
- Contrôler les dimensions de l’interface de 850 px dans le dialogue du rack et les contrôles sur fenêtre étroite.

### D. Intégration finale, seulement après B et C

- Référencer le plugin dans Amplifier, insérer depuis `+`, afficher sa vignette et copier son URI sans insérer une seconde instance.
- Vérifier coexistence avec NAM, Cabinet et effets Faust, déplacement, branche après l’ampli, suppression et réinsertion.
- Tester l’URI copiée dans le laboratoire WAM ou un second hôte, depuis la distribution placée sous un sous-chemin.
- Exécuter `npm test`, `npm run dist`, les contrôles de fichiers distribués et les scénarios navigateur. Consigner les résultats effectifs ; une inspection statique seule ne permet pas de déclarer le WAM fonctionnel.

En cas d’échec audio ou de dépendance irrésolue : ne pas référencer le plugin comme utilisable dans le menu `+` avant correction et nouvelle validation.

## 7. Suite éventuelle pour l’autre hôte

La proposition de « modifier le other_wam » ne décrit pas encore le changement souhaité. Option proposée après intégration : faire charger à `EndUserAmp1/host` le plugin depuis le nouvel emplacement commun, afin d’éviter deux copies divergentes. Avant cette modification, préciser si le but est seulement de partager le WAM ou aussi de remanier cet hôte. Elle ne fait pas partie de la première extraction et ne sera pas effectuée implicitement.

## 8. Ordre de réalisation

1. Spécification et explication du plan (présente étape, sans code).
2. Validation de référence du WAM original.
3. Copie minimale, adaptations de lifecycle/état nécessaires, vignette.
4. Validation audio et multi-instance de la copie isolée.
5. Ajout au catalogue, tests du rack et de la distribution ; mise à jour de la trace.
6. Éventuelle adaptation de l’autre hôte, selon le périmètre retenu.

## 9. Livraison Amp1 — résultats du 2026-09-24

Le plugin original a été instancié dans Chromium avec le SDK de notre hôte : 30 paramètres, deux instances distinctes, sortie finie et non nulle sur sinus à 48 kHz (pic mesuré 0,000567 pour cette excitation). Cette mesure a précédé l’ajout du WAM copié au catalogue.

La copie autonome est `examples/wam/wamPlugins/EndUserAmp1`. Son WASM et ses métadonnées DSP sont identiques aux fichiers fournis (SHA-256 conservés dans `SOURCE_MANIFEST.json`). Nom public validé par l’utilisateur le 24 septembre 2026 : **WAM•FAUST TubeLab**, interface or/anthracite. L’identifiant WAM historique est préservé. La vignette provient d’une capture de la GUI réelle.

Corrections nécessaires : état initial attendu, GUI chargée à la demande, arrêt/reprise du polling selon visibilité, destruction idempotente, contrôles `ifc-webaudio-*` initialisés une seule fois. Le ParamMgr fourni fermait son port avant de répondre à `destroy`, bloquant l’attente côté hôte : l’accusé de réception précède maintenant la fermeture. Aucun changement de l’algorithme DSP ou de ses valeurs par défaut.

## 10. Extension Amp2 — ShredLab

Source : `examples/other_wam_host/EndUserAmp2`, chargée par son `host/index.js` via `../index.js`. Version du descripteur : 0.3. Le WAM original a produit une sortie finie et non nulle à 48 kHz et supporté deux instances. Il expose **47 paramètres**, dont les contrôles Preamp_v6 : placement du gain, filtres, trim inter-étages, sag, biais et égalisation post-préampli.

Copie autonome : `examples/wam/wamPlugins/EndUserAmp2`, avec le fichier supplémentaire `ampProfiles.js`. Nom public validé par l’utilisateur le 24 septembre 2026 : **WAM•FAUST ShredLab**, palette bleu pétrole/cuivre. La paire WAM•FAUST TubeLab / WAM•FAUST ShredLab est confirmée par l’utilisateur (choix 1).

Les sources partageaient le même identifiant malgré des DSP différents. Amp2 reçoit `fr.grame.faust.ifc2026.amp2` : worklets et classe de GUI distincts de ceux d’Amp1. Les adresses de paramètres Faust, le binaire et les valeurs DSP par défaut sont conservés. Ses contrôles sont préfixés `ifc2-webaudio-*`.

Le constructeur original de sa GUI appliquait un profil puis écrivait les valeurs de tous les boutons après un délai. Cela écrasait un état fourni par l’hôte et modifiait le son à l’ouverture. Ces écritures automatiques sont retirées : la GUI lit le DSP. La sélection explicite d’un profil applique toujours `AMP_PROFILES`; son libellé est retrouvé depuis les paramètres courants lors d’une réouverture/restauration. Ces choix internes appartiennent au plugin, pas à la phase presets du rack.

Les deux interfaces décrivent les étages Preamp / Tone stack / Power amp / Cabinet / Reverb et s’adaptent aux petites largeurs. « Modélisation paramétrique par étages » est une description vérifiée. L’étiquette méthodologique « grey box » reste à confirmer avec les sources DSP et leur démarche de calibration ; la copie ne présente pas cette classification comme un résultat établi.

## 11. Catalogue et bilan de validation

- Dans `+`, **Amplifiers** et **Cabinets / Speakers** forment les deux colonnes du premier groupe. Les pédales suivent en dessous. Les boutons WAM URI restent indépendants de l’insertion. Le laboratoire place aussi amplis et cabinets en premier dans ses filtres et cartes.
- Chaque descripteur référence sa propre capture `thumbnail.png`. La distribution vérifie les deux packages et `ampProfiles.js`.
- `npm test` : **129 tests réussis**, notamment compilation des binaires, empreintes, ressources, URIs relocalisées et identifiants distincts.
- `npm run dist` : réussi. Tests navigateur sous `/dist/NAM_A2_WAM/`, sans dépendance à l’ancien hôte.
- Page reproductible : `examples/wam/fx-test/ifc-validation.html`, variante 1 par défaut, variante 2 avec `?variant=2`. **41 vérifications par plugin**, soit **82**, réussies dans la distribution à 44,1/48 kHz : traitement sans GUI, instances indépendantes, canaux gauche/droite, master, état, bypass dry, impulsion, guitare DI, état préservé à l’ouverture, pause/reprise/détachement/suppression de GUI. Aucune erreur navigateur ni promesse rejetée non gérée. Mesures conservées dans les fichiers `VALIDATION.json` des deux plugins.
- Parcours automatisé du rack : les deux DSP coexistent avec leurs paramètres corrects ; ajout via `+`, vignette/URI, choix explicite de modèle ShredLab, réouverture sans changement d’état, éditeurs distincts, sauvegarde/restauration de ShredLab dans B alimentée après TubeLab dans A. Confirmation de suppression et réinsertion d’Amp1 vérifiées également.
- Inspection visuelle : dialogue du rack, menu à deux colonnes, ShredLab à 360 px ; les cartes de chaîne ne sont pas agrandies.
- **Limite :** mesures dans Chromium avec haut-parleur coupé, sans microphone. Aucune écoute matérielle ni mesure de latence/CPU sur une véritable interface guitare n’est revendiquée.

L’ancien hôte et les deux sources restent inchangés. Leur éventuelle redirection vers les copies communes demeure une étape séparée. Aucune gestion des presets du rack n’a été commencée.

### Trace Git

Avant l’implémentation, les changements précédents ont été enregistrés (`77163b8`), fusionnés avec le main distant puis poussés sur `origin/main` (`0a2feab`). L’intégration a ensuite été réalisée sur **New-UI**, revenue au résultat de cette fusion. Les nouvelles intégrations ne sont pas incluses dans le push initial de main.

## 12. Presets d’usine internes aux WAMs — 2026-09-24

Demande utilisateur : proposer des sons prêts à jouer dans chaque plugin, indépendamment des presets du rack (phase 7.2 toujours reportée).

- Chaque GUI propose **Default, Clean, Crunch, Disto / Hi gain, Jazzy, Jordan**. Le choix ne concerne que l’instance courante.
- Les cinq sons sont extraits exclusivement de `state.amp` dans le `host/presets.js` de la variante correspondante. Contrairement à l’hypothèse initiale, ces fichiers contiennent aussi des pédales : leurs états ne sont pas importés. Leur provenance et leur SHA-256 sont consignés dans `SOURCE_MANIFEST.json`.
- `factory-presets.js` contient des snapshots complets : 30 paramètres TubeLab, 47 ShredLab. Les sept contrôles Post EQ manquants des anciens presets ShredLab prennent les valeurs initiales de `dsp-meta.json`. Default représente les valeurs initiales du DSP, sans modifier le son au chargement du plugin.
- API non visuelle : `audioNode.getFactoryPresets()`, `loadFactoryPreset(id)` et `getFactoryPresetStatus()`. Le catalogue est embarqué dans le WAM, sans stockage local ni dépendance à l’ancien hôte.
- `getState()` conserve les paramètres à plat et ajoute `__wamFactoryPreset: {version: 1, id}`. `setState()` retire ces métadonnées avant ParamMgr, restaure les valeurs exactes puis l’identifiant sélectionné. Un preset retouché n’est jamais remplacé par sa version d’usine lors de la restauration.
- Le menu affiche **Modified** lorsque les paramètres diffèrent du preset choisi, y compris après une modification par l’hôte. Les anciens états sans métadonnées, ou avec un identifiant inconnu, restent utilisables et s’affichent comme **Current settings**. Un état initial fonctionne sans GUI ; ouvrir ou rouvrir l’éditeur n’applique aucun preset.
- Les profils de préampli ShredLab restent distincts : un preset d’usine couvre l’ensemble de l’ampli ; un profil modifie seulement ses paramètres propres.
- Tests : couverture Node du catalogue complet, plages, indépendance des instances, presets retouchés, anciens états et identifiants inconnus. La page `ifc-validation.html` vérifie aussi la sélection par la GUI, le DSP réel pour chaque son et les restaurations à 44,1/48 kHz.

Validation finale de cette extension : **133 tests Node**, **130 vérifications navigateur** (65 par variante), aucune erreur navigateur ; distribution statique reconstruite. Les mesures restent automatisées et muettes, sans écoute sur matériel physique.
