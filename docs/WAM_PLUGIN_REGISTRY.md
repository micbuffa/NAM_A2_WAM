# WAM Plugin Registry

The development registry and isolated FX test host live beside the main example host:

```text
examples/wam/WamPluginRegistry.js
examples/wam/PluginCard.js
examples/wam/fx-test/
examples/wam/wamPlugins/plugins.json
```

Start the project with `npm start`, then open:

```text
http://127.0.0.1:8765/examples/wam/fx-test/
```

The lab loads one insert effect at a time, provides host-level bypass, meters, GUI and state controls, and keeps the tuner on a separate analysis branch. **Validate all plugins** runs the import/instance/GUI/state lifecycle sequentially and reports failures without stopping the catalogue.

## Add a bundled plugin

1. Copy the complete runtime plugin directory below `examples/wam/wamPlugins/`.
2. Preserve its relative JavaScript, AudioWorklet, WASM, CSS, and image layout.
3. Add its exact JavaScript entry URI to `plugins.json`.
4. Prefer `<folder>/index.js`; nested entry points such as `<folder>/src/index.js` and `<folder>/plugin/index.js` are supported when declared explicitly.
5. Ensure that `descriptor.json` is beside the entry point, or set the catalogue entry's `descriptor` property.
6. Add a `category`, `role`, tags, or thumbnail override when the third-party descriptor is incomplete.
7. Open the FX Registry Lab and run **Validate all plugins**.
8. Run `npm test` and `npm run dist`.

The catalogue accepts short strings and extended entries:

```json
{
  "version": 1,
  "plugins": [
    "./my-effect/index.js",
    {
      "uri": "./my-tuner/src/index.js",
      "descriptor": "./my-tuner/src/descriptor.json",
      "category": "tuner",
      "role": "tuner",
      "thumbnail": "./Gui/tuner.png"
    }
  ]
}
```

Relative URLs are resolved from `plugins.json`. Descriptor thumbnails and catalogue thumbnail overrides are resolved from the descriptor location. Missing artwork receives generated fallback artwork.

## Categories

Use one of:

```text
tuner, dynamics, drive, filter-wah, modulation, delay, reverb,
stereo-utility, amplifier, cabinet, other
```

Descriptor keywords remain searchable tags. Generic implementation words such as `faust` do not determine the musical category.

## Remote plugins

The registry accepts absolute HTTPS entry and descriptor URLs, but remote plugins execute trusted JavaScript in the host page. A remote server must provide CORS-compatible ES modules and expose every secondary import, AudioWorklet module, WASM binary, stylesheet, and image. Phase 1 does not provide persistent user installation or a remote trust UI.

## Compatibility diagnostics

Registry stages are reported separately:

```text
catalogued → descriptor-valid → importable → instantiable
           → audio-valid → GUI-valid → state-valid
```

A broken plugin remains visible with its diagnostic and does not prevent other plugins from loading. A descriptor is metadata only: successful descriptor loading does not guarantee that module-relative imports or worklets are valid.
