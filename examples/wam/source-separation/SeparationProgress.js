// Percentage of weighted pipeline stages, never a timer pretending inference
// has completed. Within inference only actual WASM segment callbacks advance it.
export class SeparationProgress {
  constructor() { this.percent = 0; }
  update({phase, modelIndex = 0, totalModels = 1, progress, chunkIndex=0,totalChunks,completedFrames,totalFrames} = {}) {
    const total = Math.max(1, totalModels), index = Math.max(0, Math.min(total - 1, modelIndex));
    let fraction = 0;
    if (phase === 'load') fraction = .05 + .9 * index / total;
    if (phase === 'inference') fraction = .05 + .9 * (index + .1 + .9 * Math.max(0, Math.min(1, Number(progress) || 0))) / total;
    if (phase === 'model-complete' || phase === 'track-complete') fraction = .05 + .9 * (index + 1) / total;
    if (phase === 'audio') fraction = .96;
    if (phase === 'ready') fraction = 1;
    if(totalChunks&&phase==='inference')fraction=.05+.9*(index+(chunkIndex+Math.max(0,Math.min(1,Number(progress)||0)))/totalChunks)/total;
    if(phase==='chunk-ready')fraction=.05+.9*completedFrames/totalFrames;
    this.percent = Math.max(this.percent, Math.min(phase === 'ready' ? 100 : 99, Math.floor(fraction * 100)));
    return this.percent;
  }
}

const trackNames = {drums:'Batterie', bass:'Basse', other:'Autres', vocals:'Voix', guitar:'Guitare', piano:'Piano'};
export function separationMessage(data) {
  const name = trackNames[data.trackRole] || data.trackRole;
  const track = name ? `piste ${data.trackIndex + 1}/${data.totalTracks} — ${name}` : `${data.totalTracks || ''} pistes ensemble`.trim();
  if (data.phase === 'track-complete') return `Séparation — ${track}, terminée !`;
  if (data.phase === 'inference') return `Séparation — ${data.totalChunks?`bloc ${data.chunkIndex+1}/${data.totalChunks} — `:''}${track}, en cours…`;
  if (data.phase === 'chunk-ready') return `Bloc ${data.chunkIndex+1}/${data.totalChunks} prêt — ${(data.completedFrames/44100).toFixed(1)} s écoutables`;
  if (data.phase === 'load') return `Préparation — ${track}`;
  return {fallback:'GPU indisponible — démarrage du repli CPU',cache:'Vérification du cache',audio:'Préparation du lecteur',ready:'Prêt à écouter'}[data.phase] || 'Préparation';
}

export function transportState(engine, {busy = false, installing = false} = {}) {
  const waiting = (busy&&!engine?.progressive) || installing || engine?.preparing || engine?.starting;
  const hasTracks = !!engine?.tracks.length;
  return {
    disabled: !hasTracks || !!waiting || !engine.ready,
    label: busy&&!engine?.progressive ? 'Séparation…' : installing || engine?.preparing ? 'Préparation audio…' : engine?.starting ? 'Démarrage…' : engine?.waiting ? 'Pause — mise en tampon…' : engine?.playing ? 'Pause' : 'Play',
    canActivate: hasTracks && !waiting && !engine.ready && !engine.destroyed,
  };
}
