// Tracks workspace cards, as in the TONELAB mockup: "Active tone" (the preset
// the guitar plays through, with "Edit in Tone") and "Guitar" (the source
// feeding the rack and its levels). main.js pushes the state; the buttons
// call back into it (switch workspace, toggle live input).
const decibels = (value) => `${value > 0 ? '+' : ''}${(Number(value) || 0).toFixed(1)} dB`;

// {name, meta, chains} -> what the Active tone card shows.
export function describeTone({name = '', meta = '', chains = 1} = {}) {
  return {name: name || 'Untitled rack', meta: [meta || 'Not saved as a preset', chains === 2 ? '2 chains' : '1 chain'].join(' · ')};
}

// source: 'live' or a dry file name; live: monitoring on; input: {label,
// channelIndex, channelCount} once live; levels in dB.
export function describeGuitar({source = 'live', live = false, input = null, inputDb = 0, outputDb = 0} = {}) {
  const levels = `Input ${decibels(inputDb)} · Output ${decibels(outputDb)}`;
  if (source !== 'live') return {name: 'Dry guitar file', detail: source, levels, state: 'file', action: null};
  if (!live) return {name: 'Live input', detail: 'Monitoring is off', levels, state: 'off', action: 'Enable live input'};
  const channel = input?.channelCount > 1 ? ` · input ${Number(input.channelIndex || 0) + 1}/${input.channelCount}` : '';
  return {name: 'Live input', detail: `Listening through the active tone${input?.label ? ` · ${input.label}` : ''}${channel}`,
    levels, state: 'live', action: 'Disable live input'};
}

export class TracksPanel {
  constructor({onEditTone, onToggleLive, root = document}) {
    this.$ = (id) => root.getElementById(id);
    this.$('editInTone').onclick = () => onEditTone();
    this.$('guitarMonitor').onclick = () => onToggleLive();
  }

  setTone(tone) {
    const {name, meta} = describeTone(tone);
    this.$('activeToneName').textContent = name;
    this.$('activeToneMeta').textContent = meta;
  }

  setGuitar(guitar) {
    const {name, detail, levels, state, action} = describeGuitar(guitar);
    this.$('guitarCard').dataset.state = state;
    this.$('guitarSourceName').textContent = name;
    this.$('guitarSourceDetail').textContent = detail;
    this.$('guitarLevels').textContent = levels;
    const button = this.$('guitarMonitor');
    button.hidden = !action;
    if (action) button.textContent = action;
    button.setAttribute('aria-pressed', String(state === 'live'));
  }
}
