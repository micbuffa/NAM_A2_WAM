// Song presets: the rack preset each library track plays through in Play.
// The user's choice for a track ({trackId: presetId}) is kept in the account
// preferences when signed in (songPresets), in this browser otherwise. A track
// without a choice uses its own preset (an optional `preset` in the library,
// e.g. tracks.json for Factory tracks), then the default one. Files opened from
// this device have no lasting id: they always get the default.
export const STORAGE_KEY = 'nam-a2-wam.songPresets';
export const PREFERENCE_KEY = 'songPresets';
export const DEFAULT_SONG_PRESET = 'factory:twin-clean';
// The most recent choices are kept; older ones fall back to the defaults.
export const MAX_CHOICES = 500;

export class SongPresets {
  constructor({account = null, storage = globalThis.localStorage} = {}) {
    Object.assign(this, {account, storage});
  }

  // The account's choices when signed in, else this browser's.
  read() {
    if (this.account?.signedIn) {
      const remote = this.account.user?.preferences?.[PREFERENCE_KEY];
      return remote && typeof remote === 'object' ? remote : {};
    }
    try {
      const local = JSON.parse(this.storage?.getItem(STORAGE_KEY));
      return local && typeof local === 'object' ? local : {};
    } catch { return {}; }
  }

  // The preset chosen for a track, or null.
  choice(track) { return remembered(track) ? this.read()[track.id] ?? null : null; }

  // The preset to load for a track; exists(id) tells whether a preset is still there.
  presetFor(track, exists = () => true) {
    for (const id of [this.choice(track), track?.preset ?? null]) if (id !== null && exists(id)) return id;
    return DEFAULT_SONG_PRESET;
  }

  // Remembers the preset chosen while a track is open; resolves once saved.
  remember(track, presetId) {
    if (!remembered(track) || presetId === null || presetId === undefined) return Promise.resolve();
    const choices = this.read();
    if (String(choices[track.id]) === String(presetId)) return Promise.resolve();
    // The newest choice goes last; the oldest go beyond MAX_CHOICES.
    const next = Object.fromEntries([...Object.entries(choices).filter(([id]) => id !== track.id), [track.id, presetId]].slice(-MAX_CHOICES));
    if (this.account?.signedIn) return this.account.updatePreference(PREFERENCE_KEY, next);
    try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Not remembered in this browser. */ }
    return Promise.resolve();
  }
}

const remembered = (track) => Boolean(track?.id) && !track.local;

// In Play, a track that starts loading brings its preset into the rack and opens
// the rack dock. Unsaved rack changes are never overwritten: they stay, and the
// song's preset is not loaded (report says so, except while the page opens).
// A preset the user picks or creates while a track is open in Play becomes that
// track's preset. Studio (an external editor in the rack) is left alone.
export function linkSongPresets({player, presets, songs, dock, isPlay, report = () => {}}) {
  const libraryTrack = ({id, local}) => (!local && player.library?.tracks?.find((track) => track.id === id)) || {id, local};
  let open = null; // the track last opened in Play, even while it loads
  const apply = async (track, {quiet = false} = {}) => {
    if (!track?.id || !isPlay() || presets.externalEditor) return;
    open = {id: track.id, local: !!track.local};
    dock?.setCollapsed(false);
    const id = songs.presetFor(libraryTrack(track), (candidate) => Boolean(presets.find(candidate)));
    if (String(id) === String(presets.activeId)) return;
    if (await presets.isModified()) {
      if (!quiet) report(`Unsaved rack changes kept: “${presets.find(id)?.name ?? 'the song preset'}” was not loaded.`);
      return;
    }
    await presets.load(id);
  };
  presets.addEventListener?.('preset-chosen', ({detail}) => {
    if (!open || !isPlay() || presets.externalEditor) return;
    songs.remember(libraryTrack(open), detail.id).catch((error) => report(`Song preset not remembered: ${error.message}`, true));
  });
  player.addEventListener('load-progress', ({detail}) => { if (detail?.phase === 'transfer' && detail.progress === 0 && detail.id) void apply(detail); });
  // Once loaded (already applied when it started, unless the page was still opening).
  player.addEventListener('track-change', ({detail}) => { if (!detail) open = null; else void apply(detail, {quiet: true}); });
  // The track restored with the page, once the presets are attached.
  const track = player.engine?.track;
  return track ? apply(track, {quiet: true}) : Promise.resolve();
}
