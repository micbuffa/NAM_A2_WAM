// Play owns its live rack only in Play. Studio monitoring is exclusively
// controlled by each track, without disconnecting the DI/meter capture taps.
// A track shown in the rack dock is heard through Studio (its insert), never here.
export function toneMonitoringGain({workspace, editingAudio = false, calibrationMuted = false}) {
  return workspace === 'tone' && !editingAudio && !calibrationMuted ? 1 : 0;
}
