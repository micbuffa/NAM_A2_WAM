# Enregistrement et historique de Studio

## Capture et monitoring

Studio enregistre la DI mono avant trim et effets. Le clic, les autres pistes et le
monitoring restent hors de la capture. Une seule piste personnelle guitare ou basse
peut être armée. L’armement et la sélection du son restent silencieux. Seul le
monitoring explicite de la piste rend l’entrée audible dans Studio, sans doubler
le rack de Play. Si la piste n’a pas de preset, la prise utilise le son courant du rack.

Le décompte et le placement se fondent sur l’horloge audio commune. Un arrêt
pendant le décompte ne crée aucune prise. Après le début de la capture, une
rupture du flux, la perte de l’entrée ou un échec de finalisation conservent
l’audio et la waveform précédents.

## Zone A/B et remplacement

Une sélection A/B valide borne la prise, quel que soit l’état de Loop.

- **Punch, Loop décoché.** Un départ avant A lance l’accompagnement et
  conserve la DI à partir de A. Un départ dans la plage commence au playhead.
  À B, la prise se termine et l’accompagnement continue. Un arrêt entre A et B
  conserve le fragment enregistré. Un arrêt avant A ne crée aucune prise.
  Un départ à partir de B est refusé.
- **Prises successives, Loop coché.** Départ à A après un seul décompte.
  L’accompagnement et la grille de clic se répètent. À Stop, Studio sélectionne
  la dernière prise complète, ou le fragment incomplet en l’absence de prise
  complète. Les alternatives sont bornées en mémoire. Choisir un fragment
  incomplet préserve le reste de l’original. L’ancienne DI ne joue pas sous la
  nouvelle pendant la capture.
- **Sans plage valide.** La prise démarre au playhead et se termine à Stop.

Un arrêt manuel draine le retour retardé de la DI avant de finaliser. Le punch
garde sa borne B exacte. L’audition attend le chargement du nouveau WAV et
conserve la position choisie.

La compensation s’applique une seule fois. Le découpage s’effectue en frames et
préserve exactement le préfixe et le suffixe hors de l’intervalle écrit. Une
prise qui dépasse la fin prolonge la piste. Un départ plus tardif insère du
silence si nécessaire. L’écrasement partiel exige une DI mono WAV Float32 à la
fréquence de capture courante. Un format incompatible laisse la piste intacte.
Studio utilise un fichier par piste. Régions, comping, crossfades automatiques
et overdub additif restent hors de ce contrat.

## Undo, Save et réouverture

L’historique de session garde des références aux WAV et aux snapshots. Une prise
ou une session de prises en boucle crée une seule commande audio. Les boutons
Before/After et le choix de passage réutilisent la commande lorsqu’elle est
adjacente au curseur. Undo/Redo restaure le WAV exact sans relancer la capture,
sans recalculer la compensation et en préservant les réglages de mixage courants.

Une modification continue du mixage forme une seule commande. Les imports dans
le projet ouvert et les séparations publiées s’annulent en groupe, avec les
fichiers existants. Les préécoutes RAM non publiées relèvent de Stop/Cancel.
Charger ou recharger le projet réinitialise le journal. La sauvegarde seule le
conserve dans la session ouverte.

Préparer un passage alternatif avant de remplacer la sélection. Si la
préparation échoue, garder la sélection courante. Si la réapplication échoue,
restaurer la référence précédente et signaler l’échec. Une réponse tardive
ne modifie pas le projet ouvert entre-temps.

Save conserve la version affichée. Libérer les alternatives seulement après la
réussite complète de Save, y compris l’export facultatif d’un preset réutilisable.
Si une étape ultérieure échoue après l’upload, garder les alternatives et
permettre un retry sans renvoyer la même prise. À la réouverture, retrouver
l’audio choisi, son preset et son mix. Les alternatives en RAM et le journal
de session ne sont pas restaurés.

Le serveur vérifie les droits, les quotas et la version attendue. Les retries
sont idempotents. Les versions inactives des prises ont une rétention bornée.
Un blob reste protégé tant qu’une autre référence le retient. Les plafonds
sont définis par [le journal Studio](examples/wam/projects/StudioHistory.js) et
[la rétention Rails](web/app/models/recording_revision.rb). Une récupération
générale des archives après rechargement reste à définir.

## Son de lecture et calibration

Le snapshot de capture reste la provenance de la prise. Modifier le son de
lecture ne réécrit ni la DI, ni son placement. Un preset de bibliothèque sert
de point de départ à une copie de piste. La création d’un preset réutilisable
est facultative et peut être réessayée séparément. Voir le
[contrat du rendu de mix](docs/PROCESSED_MIX_EXPORT.md).

La compensation corrige le trajet de capture. Le retard du preset relève du
playback et du monitoring. La mesure coupe les routes de monitoring avant
d’activer l’entrée. En mode filaire, couper aussi le monitoring direct matériel,
puis retirer le câble avant de réactiver l’entrée. Appliquer le résultat
explicitement. Un profil rechargé demande confirmation pour la même configuration.
Les identifiants matériels locaux et l’audio du probe restent côté navigateur.
Le mode acoustique est une estimation manuelle distincte.

## Vérification

- [Tests A/B](tests/phase7/range-recording.test.mjs) et [récupération](tests/phase7/loop-review-recovery.test.mjs).
- [Journal Studio](tests/phase7/studio-history.test.mjs) et [remplacement Rails](web/test/integration/api/recording_replacements_test.rb).
- [Calibration synthétique](tests/phase7/recording-latency.test.mjs). La qualification filaire réelle, multi-interface et sous charge reste ouverte.
- Rapports datés sur [le punch](docs/RANGE_RECORDING_VALIDATION.md), [le remplacement](docs/RECORDING_REPLACEMENT_VALIDATION.md) et [la reprise après échec](docs/LOOP_TAKE_RECOVERY_VALIDATION.md).

La [proposition tempo variable](TEMPO_MAP_SPECIFICATION.md) est indépendante.
Les détails historiques de calibration, de portage et de validation sont
consultables avec `git show 58338d7:RECORD_TRACKS_SPECIFICATION.md`.
