// A project owns its sound. Library presets initialize a copy; the immutable
// recording.capturePresetSnapshot remains the provenance of the original take.
export function copiedTrackSound(state, id=crypto.randomUUID()) {
  const snapshot=structuredClone(state);
  if(snapshot.version!==2||!snapshot.a?.entries)throw Error('This preset is not a complete effect chain.');
  if(snapshot.enabledB&&!snapshot.route)throw Error('A mono DI cannot play independent dual inputs. Choose one chain or route A to B.');
  if(new TextEncoder().encode(JSON.stringify(snapshot)).length>8*1024**2)throw Error('This track sound exceeds the 8 MiB project limit.');
  return {presetSnapshot:snapshot,snapshotId:id,presetId:null,factoryPreset:null};
}

// Where a track's own sound comes from, kept inside its snapshot as
// {origin: {name, modified}} (the rack ignores it): the library preset it was
// loaded from, and whether it was changed since. No origin: "Own sound".
export function withOrigin(state, origin) {
  const value = structuredClone(state);
  delete value.origin;
  if (origin?.name) value.origin = {name: String(origin.name).slice(0, 100), modified: !!origin.modified};
  return value;
}
export function soundLabel(snapshot) {
  const origin = snapshot?.origin;
  return origin?.name ? `${origin.name}${origin.modified ? ' (modified)' : ''}` : 'Own sound';
}
