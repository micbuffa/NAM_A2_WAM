// Deterministic visual fixture: these are demo peaks, not decoded audio.
export function demoWaveform(index, zoom = 1, duration = 16) {
  const peaks = Array.from({length: 240}, (_, i) => {
    const envelope = .12 + .75 * Math.abs(Math.sin(i * .071 + index) * Math.cos(i * .023 + index));
    return `M${i * 4 + 2},${40 - envelope * 19}v${envelope * 38}`;
  }).join(' ');
  const ticks = Array.from({length: duration + 1}, (_, second) => ({second, x: second / duration * 960}));
  return {widthPercent: Math.max(1, Math.min(16, zoom)) * 100, peaks, ticks};
}
