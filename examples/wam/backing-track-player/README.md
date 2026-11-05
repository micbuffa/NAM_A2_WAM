# Backing track player

In the rack it is the **Play along** panel at the top of Play (`main.js`, `placement="top"`): `PlayAlong.js` keeps one player at a time (it and the open project pause each other; leaving Play pauses it) and `PlayAlongMemory.js` remembers the last bundled track, its settings and its view (browser, plus the `playAlong` account preference when signed in). It does not collapse: a transport row (track name, transport, clock, volume, mute) sits above one view at a time (`setView('library'|'track')`, `view-change` event): the **library**, a table of My tracks (YouTube imports, Studio mixes, temporary mixes, this device's file) then Factory, with Title, Origin, Added, Time, BPM and Key; or the **track**, with the full-width waveform, the actions (Separate instruments, Download MP3) and the mix tools; there, a Library button sits before the track name in the transport row, which shows the name only once. A row opens its track; the transport row keeps playing in both views; clicking the title switches views. Tracks sent from Studio or YouTube, and imported or dropped files, open the track view.

In the panel, Space plays/pauses and the arrows move 5 s (1 s on the waveform) when focus is not on a control.

`<backing-track-player>` is a host-independent WebComponent. Initialize it with the host AudioContext and optionally a `BackingTrackLibrary` provider. Its engine exposes `outputNode`; it never connects itself to the destination. `BackingTrackMix` owns the host's final guitar/backing sum, after the A/B rack.

The source UI/features and phase-vocoder algorithm came from `examples/other_wam_host/EndUserAmp2/host`. Source worklet credits (olvb/phaze and FFT inspiration) are retained. The copied source files remain unchanged in that reference host. The extracted worklet has a namespaced processor registration and an explicit disposal message.

Factory MP3s are in `../assets/backingTracks/`. They are downloaded only on selection; only the current decoded buffer is retained. Files imported from the device are temporary. Saved state contains references and settings, not audio bytes. A missing local track requests the same file again; its name/size/modification-time identity allows restoration of pending settings. This identity is not a content hash or backend asset ID.

After adding or deleting bundled audio, run from the repository root:

```
npm run backing-tracks
npm run backing-tracks -- --check
npm run dist
```

The manifest updater preserves IDs and metadata of existing filenames. It fills in a missing `duration` (seconds, read with `ffprobe`) and `createdAt` (the date the file was first committed to git; a file not committed yet gets none until the next run). `bpm` and `key` are optional fields written by hand; their columns stay empty without them. To rename a file while preserving its identity, update the existing record's URL before regeneration. Do not use `npm run wam-plugins` for this library.

Open `backing-track-player/validation.html` in the source host or static distribution to run muted real-audio checks. `VALIDATION.json` records the last measured result. Physical interface listening, musical transient quality and CPU/latency benchmarking are still manual checks; the inherited phase-vocoder is not a claimed studio-quality stretcher. A/B loop joins are native buffer loops, without a dedicated crossfade between arbitrary endpoints.

Public engine methods: `loadTrack`, `loadFile`, `play`, `pause`, `stop`, `seek`, `setLoop`, `setRate`, `setVolumeDb`, `setMuted`, `setNormalized`, `setMix`, `setGuitarPan`, `getState`, `setState`, `destroy`. State is version 1; restoring never starts playback. UI forwards transport, track, progress, mix, pan and error events through the shadow boundary. Removing the element stops visual updates; explicit `destroy()` releases audio resources without closing the shared context.
