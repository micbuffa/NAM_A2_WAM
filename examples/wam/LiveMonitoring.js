// Tone owns its live rack only in Tone. Studio monitoring is exclusively
// controlled by each track, without disconnecting the DI/meter capture taps.
export function toneMonitoringGain({workspace, editingAudio = false, calibrationMuted = false}) {
  return workspace === 'tone' && !editingAudio && !calibrationMuted ? 1 : 0;
}
