// A project owns its sound. Library presets initialize a copy; the immutable
// recording.capturePresetSnapshot remains the provenance of the original take.
export function copiedTrackSound(state, id=crypto.randomUUID()) {
  const snapshot=structuredClone(state);
  if(snapshot.version!==2||!snapshot.a?.entries)throw Error('This preset is not a complete effect chain.');
  if(snapshot.enabledB&&!snapshot.route)throw Error('A mono DI cannot play independent dual inputs. Choose one chain or route A to B.');
  if(new TextEncoder().encode(JSON.stringify(snapshot)).length>8*1024**2)throw Error('This track sound exceeds the 8 MiB project limit.');
  return {presetSnapshot:snapshot,snapshotId:id,presetId:null,factoryPreset:null};
}
