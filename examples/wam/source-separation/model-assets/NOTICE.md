# Aperçu rapide : Demucs 2 secondes

Export local de `get_model("htdemucs").models[0]`, Demucs 4.0.1, PyTorch 2.6.0, opset 17. Source et licence MIT : https://github.com/facebookresearch/demucs .

Reproduction : `python tools/export-demucs-short-probe.py 2`, puis `node tools/install-demucs-preview.mjs`. Le fichier ONNX généré est ignoré par Git et inclus dans la distribution statique. Le déploiement doit conserver ce fichier à côté du manifeste. Aucun service extérieur n’est requis pour le télécharger dans le cache du navigateur. La taille et le SHA-256 sont vérifiés par le gestionnaire habituel.

Le réseau a un contexte de 2 secondes, différent de la version Qualité 7,8 secondes. Il publie par seconde (recouvrement 50 %). Voir ../LOW_LATENCY.md pour les validations et limites.
