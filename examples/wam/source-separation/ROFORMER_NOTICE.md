# BS Roformer SW six sources — expérimental

Export ONNX : https://huggingface.co/elicwhite/bs-roformer-sw-6stem-onnx/tree/a744f80957374e1735ad70fa122670b7961da8cc . FP16 stocké, calcul FP32 sur le device sans shader-f16 de nos validations. Taille 352 778 874 octets, SHA-256 d3d2bac77a7023282cb5f35a5807179e34076b60589867b572275f1a8ec36444.

Le dépôt de conversion et son code déclarent MIT : https://github.com/elicwhite/bs-roformer-web/tree/c6047cd28c41f803339e9b8a5775a56932de7157 . La licence du checkpoint d’origine n’est pas précisée par son réhébergeur, comme le souligne le dépôt de conversion. La licence MIT du code ne constitue pas une clarification indépendante des droits des poids. Ce modèle est proposé comme essai technique expérimental ; vérifier les droits des poids avant toute redistribution commerciale. Les poids d’origine ne sont pas entraînés dans ce projet.

Le fichier ONNX est ignoré par Git et absent de la distribution produit. Le gestionnaire Studio le télécharge depuis la révision Hugging Face épinglée. Téléchargement dans le navigateur uniquement sur demande, via le gestionnaire habituel qui vérifie taille et SHA-256. Aucun audio utilisateur n’est envoyé au fournisseur du modèle.

Le réseau a quatre secondes de contexte et publie trois secondes à chaque bloc (recouvrement d’une seconde). Les six sources sont, dans cet ordre : basse, batterie, autres, voix, guitare, piano. Voir ROFORMER_VALIDATION.md pour les mesures et leurs limites ; la précision numérique ne mesure pas la qualité de séparation musicale.
