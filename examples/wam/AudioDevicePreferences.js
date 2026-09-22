const key = 'neuralwamp.audio-devices.v1';

export function readAudioDevicePreferences() {
  try {
    const value = JSON.parse(localStorage.getItem(key)) || {};
    return {
      inputDeviceId: typeof value.inputDeviceId === 'string' ? value.inputDeviceId : '',
      inputChannel: Number.isInteger(value.inputChannel) && value.inputChannel >= 0 && value.inputChannel < 32 ? value.inputChannel : 0,
      outputDeviceId: typeof value.outputDeviceId === 'string' ? value.outputDeviceId : '',
    };
  } catch { return {inputDeviceId:'', inputChannel:0, outputDeviceId:''}; }
}

export function saveAudioDevicePreferences(values) {
  try { localStorage.setItem(key, JSON.stringify({...readAudioDevicePreferences(), ...values})); }
  catch { /* Storage can be disabled; keep the current session working. */ }
}

export function resolveInputPreference(devices, deviceId, channel) {
  const available = devices.some(device => device.deviceId === deviceId);
  const fallback = devices.find(device => device.deviceId === 'default') || devices[0];
  return {deviceId: available ? deviceId : fallback?.deviceId || '', channel: available ? channel : 0};
}
