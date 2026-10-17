// Simulates a fresh permission: anonymous inputs until getUserMedia succeeds,
// the user picks the 2-channel sound card in the prompt, the system default is a mono mic.
(() => {
  const md = navigator.mediaDevices; let granted = false; window.__gum = [];
  let dismissFirstPrompt = window.name === 'dismiss-first-prompt';
  const devices = () => granted
    ? [{deviceId: 'default', kind: 'audioinput', label: 'Default - MacBook Pro Microphone', groupId: 'g1'},
       {deviceId: 'mac-mic', kind: 'audioinput', label: 'MacBook Pro Microphone', groupId: 'g1'},
       {deviceId: 'card', kind: 'audioinput', label: 'Scarlett Solo USB', groupId: 'g2'}]
    : [{deviceId: '', kind: 'audioinput', label: '', groupId: ''}];
  md.enumerateDevices = async () => devices();
  md.getUserMedia = async (constraints) => {
    if (dismissFirstPrompt) { dismissFirstPrompt = false; throw new DOMException('Permission dismissed', 'NotAllowedError'); }
    const audio = constraints.audio || {}; const asked = audio.deviceId?.exact ?? audio.deviceId ?? '';
    // No device requested yet -> the permission prompt, where the user picks the card.
    const opened = asked === '' ? 'card' : asked === 'default' ? 'mac-mic' : asked;
    const channels = opened === 'card' ? 2 : 1;
    window.__gum.push(`${JSON.stringify(asked)} -> ${opened} (${channels} ch)`);
    const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination(); dest.channelCount = channels;
    const osc = ctx.createOscillator(); osc.connect(dest); osc.start();
    const track = dest.stream.getAudioTracks()[0];
    track.getSettings = () => ({deviceId: opened, channelCount: channels});
    track.applyConstraints = async () => {};
    if (!granted) { granted = true; setTimeout(() => md.dispatchEvent(new Event('devicechange')), 50); }
    return dest.stream;
  };
})();
