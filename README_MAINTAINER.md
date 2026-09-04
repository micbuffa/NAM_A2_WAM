C’est implémenté.
Le mode mainteneur est accessible avec :
- Local : http://127.0.0.1:8765/examples/wam/index.html?maintainer=1
- Distribution : http://127.0.0.1:8765/dist/NAM_A2_WAM/?maintainer=1
- Mainline, après redéploiement : https://mainline.i3s.unice.fr/NAM_A2_WAM/?maintainer=1
Dans Models & sources → TONE3000, un panneau caché propose :
- Select NAM A2 tone
- Select IR tone
- sélection individuelle des fichiers du tone ;
- téléchargement des captures choisies ;
- récupération de la première image ;
- génération des hashes SHA-256 ;
- génération de tone.json ;
- export d’un ZIP structuré, sans token ni model_url temporaire.
Le ZIP contient directement :
tone3000/creator/tone-title--t12345/
  tone.json
  cover.jpg
  captures/
    Capture name--m67890.nam
ou l’équivalent .wav pour les IR.
Après téléchargement :
# Pour un bundle NAM, décompresser tone3000/ dans :
src/nam-wam/models/

# Pour un bundle IR :
src/cabinet-wam/IRs/

npm run factory-assets
npm test
npm run dist
Les générateurs produisent maintenant des manifests v2 et savent :
- trouver le tone.json parent ;
- vérifier que chaque capture est déclarée ;
- vérifier son hash ;
- détecter les doublons TONE3000 ;
- associer image, créateur, licence, tone ID et model ID ;
- préserver les anciens fichiers Factory non encore migrés.
Les cartes Factory NAM et IR exploitent également ces informations enrichies.
Fichiers principaux :
- [FactoryBundle.js](/Users/michelbuffa/Documents/Recherche/WAMs/WAM_NAM2_PROTO/src/nam-wam/tone3000/FactoryBundle.js)
- [gui.js](/Users/michelbuffa/Documents/Recherche/WAMs/WAM_NAM2_PROTO/src/nam-wam/gui.js)
- [generate-factory-manifests.mjs](/Users/michelbuffa/Documents/Recherche/WAMs/WAM_NAM2_PROTO/tools/generate-factory-manifests.mjs)
- [FACTORY_LIBRARY.md](/Users/michelbuffa/Documents/Recherche/WAMs/WAM_NAM2_PROTO/docs/FACTORY_LIBRARY.md)
- [HANDOFF.md](/Users/michelbuffa/Documents/Recherche/WAMs/WAM_NAM2_PROTO/HANDOFF.md)
Validation : mode mainteneur visible avec ?maintainer=1, masqué sans ce paramètre, version dist vérifiée, 52/52 tests réussis.
Je n’ai pas exécuté le dernier parcours OAuth réel, puisqu’il nécessite votre connexion TONE3000. Avant d’ajouter un bundle au dépôt public, il faut vérifier sa licence et les droits de redistribution, conformément à la documentation API et aux conditions TONE3000. Aucun commit ni push n’a été effectué.


Ok, je viens de tester. Une fois le bundle téléchargé, je le copie où ? DOis-je supprimer les anciens fichiers dans "models" ?







9:58






Ne supprimez pas les anciens fichiers de models. Le système accepte simultanément l’ancienne organisation et les nouveaux bundles enrichis.
Pour un bundle NAM, décompressez le ZIP dans :
src/nam-wam/models/
Le résultat attendu est :
src/nam-wam/models/
  anciens-modeles.nam
  tone3000/
    creator/
      tone-title--t12345/
        tone.json
        cover.jpg
        captures/
          capture--m67890.nam
En ligne de commande depuis la racine du projet :
unzip ~/Downloads/nom-du-bundle.zip -d src/nam-wam/models
npm run factory-assets
npm test
npm run dist
Pour un bundle IR, utilisez plutôt :
unzip ~/Downloads/nom-du-bundle.zip -d src/cabinet-wam/IRs
npm run factory-assets
npm test
npm run dist
Si vous réexportez exactement le même tone, remplacez uniquement son dossier tone-title--t<ID>, pas tout models. Le générateur signalera un doublon d’identifiant ou un hash incohérent.
Vous pouvez vérifier que l’installation est correcte en cherchant :
src/nam-wam/models/tone3000/.../tone.json
Il faut ensuite tester la version source avec npm start, ou la version finale reconstruite dans dist/NAM_A2_WAM/