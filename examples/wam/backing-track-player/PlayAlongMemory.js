// Play along memory: the last bundled backing track and its settings (speed,
// loop, balance, pan, volume, level) plus whether the dock is expanded. Kept in
// this browser, and in the account preferences when signed in, so the dock
// comes back as it was on every device. Restoring never starts playback;
// files imported from the device are not remembered.
export const STORAGE_KEY = 'nam-a2-wam.playAlong';
const SAVE_DELAY = 800;

// What is remembered, from the engine state and the dock.
export function playAlongSettings(state, expanded) {
  return {trackId: state.track && !state.track.local ? state.track.id : null, rate: state.rate, volumeDb: state.volumeDb,
    muted: state.muted, normalized: state.normalized, autoNormalize: state.autoNormalize, mix: state.mix, guitarPan: state.guitarPan,
    loop: {...state.loop}, expanded: !!expanded};
}

export class PlayAlongMemory {
  constructor({player, account = null, storage = globalThis.localStorage, delay = SAVE_DELAY}) {
    Object.assign(this, {player, account, storage, delay});
    this.saved = JSON.stringify(this.read());
  }

  // The account's settings when signed in, else this browser's.
  read() {
    const remote = this.account?.user?.preferences?.playAlong;
    if (remote && typeof remote === 'object') return remote;
    try { return JSON.parse(this.storage?.getItem(STORAGE_KEY)) || null; } catch { return null; }
  }

  // Applies the remembered settings, then saves every later change.
  async restore() {
    const settings = this.read();
    if (settings) {
      this.player.setExpanded?.(settings.expanded === true);
      const engine = this.player.engine, current = engine.getState();
      const loop = {...current.loop, ...settings.loop};
      const state = {...current, ...pick(settings, ['rate', 'volumeDb', 'muted', 'normalized', 'autoNormalize', 'mix', 'guitarPan']),
        loop, position: loop.enabled ? loop.startSeconds : 0, track: settings.trackId ? {id: settings.trackId} : null};
      // A track no longer in the library, or a speed without time stretch, keeps the defaults.
      try { await engine.setState(state); } catch (error) { console.warn('Play along settings not restored', error); }
    }
    this.watch();
  }

  watch() {
    const schedule = () => { clearTimeout(this.timer); this.timer = setTimeout(() => this.save(), this.delay); };
    for (const type of ['transport-change', 'expand-change']) this.player.addEventListener(type, schedule);
  }

  save() {
    // While a track loads, the engine still reports the previous one.
    if (this.player.engine.loading) return;
    const settings = playAlongSettings(this.player.engine.getState(), this.player.expanded);
    const json = JSON.stringify(settings);
    if (json === this.saved) return;
    this.saved = json;
    try { this.storage?.setItem(STORAGE_KEY, json); } catch { /* Not remembered in this browser. */ }
    if (this.account?.signedIn) this.account.updatePreference('playAlong', settings).catch((error) => console.warn('Play along settings not saved', error));
  }
}

const pick = (values, keys) => Object.fromEntries(keys.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]));
