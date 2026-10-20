export const modelSize = bytes => `${(bytes / 1024 ** 2).toFixed(1)} Mio`;

export function describeModelStatus(status = {state:'checking'}, model) {
  const total = status.total || model?.files?.reduce((sum, file) => sum + file.size, 0) || 0;
  const percent = total ? Math.min(100, Math.floor((status.received || 0) / total * 100)) : 0;
  const pending = ['checking','downloading','verifying','saving'].includes(status.state);
  const labels = {
    checking:'Vérification du cache local…', missing:'Modèle non téléchargé',
    downloading:`Téléchargement · ${percent}%`, verifying:'Vérification SHA-256…', saving:'Enregistrement dans le cache…',
    installed:'Disponible en cache · prêt à séparer', corrupt:'Cache corrompu · téléchargement nécessaire',
    cancelled:'Téléchargement annulé', error:'Échec du téléchargement',
    loading:'Chargement du modèle en mémoire…', inference:'Modèle chargé · séparation en cours',
  };
  return {
    label:labels[status.state] || 'Chargement du catalogue…',
    detail:status.state === 'installed' ? 'Le chargement en mémoire commencera quand vous lancerez la séparation.' :
      status.state === 'missing' ? `Téléchargez ce modèle (${modelSize(total)}) avec le bouton ci-contre. Il sera conservé pour les prochaines utilisations.` :
      status.message || (status.state === 'downloading' ? `${modelSize(status.received || 0)} / ${modelSize(total)}` : ''),
    percent:['installed','saving','inference'].includes(status.state) ? 100 : percent,
    indeterminate:status.state === 'checking' || status.state === 'loading',
    pending,
    canDownload:['missing','corrupt','cancelled','error'].includes(status.state),
    ready:status.state === 'installed',
    tone:['error','corrupt'].includes(status.state) ? 'error' : status.state === 'installed' ? 'ready' : 'waiting',
  };
}

// The model indicator is latched after its first real load. FT loads its
// specialists sequentially, but those events must not restart this indicator.
export class ModelLoadIndicator {
  select(identity) {
    if (this.identity !== identity) { this.identity = identity; this.loaded = false; return true; }
    return false;
  }
  update(phase) {
    if (phase === 'inference' || phase === 'track-complete') this.loaded = true;
    return this.loaded ? 'inference' : 'loading';
  }
}

export function separationEligibility({modelState, audioReady, decoding = false, busy = false}) {
  if (busy) return {enabled:false,reason:'Séparation en cours…'};
  if (decoding) return {enabled:false,reason:'Attendez la fin du décodage du fichier audio.'};
  if (modelState !== 'installed') {
    const reasons = {checking:'Vérification du modèle en cours…',downloading:'Téléchargement du modèle en cours…',verifying:'Vérification SHA-256 du modèle en cours…',saving:'Enregistrement du modèle en cours…',error:'Le téléchargement a échoué : réessayez avec le bouton du modèle.',corrupt:'Le modèle doit être téléchargé à nouveau.'};
    return {enabled:false,reason:reasons[modelState] || 'Le fichier seul ne suffit pas : téléchargez le modèle sélectionné ci-dessus.'};
  }
  return audioReady ? {enabled:true,reason:'Fichier audio et modèle disponibles : vous pouvez séparer l’extrait.'} : {enabled:false,reason:'Modèle disponible. Choisissez maintenant un fichier audio.'};
}
