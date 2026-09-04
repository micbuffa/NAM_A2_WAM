# Factory Library Format and Maintainer Import

The Factory library is treated as a curated, versioned collection rather than as a loose directory of NAM and WAV files. This document defines the implemented on-disk format shared by the NAM and Cabinet WAMs and the TONE3000 maintainer workflow.

## Rights and TONE3000 constraints

TONE3000 permits downloading models requested by an authenticated user, but its API terms prohibit bulk catalog downloads, mirrors, and bundling catalog content with a product without written permission. Creator attribution, tone metadata, and license information must be retained.

Before committing an imported tone to the public Factory library, verify that its license permits redistribution in this repository or obtain permission from TONE3000 and the creator. The maintainer importer must never contain a secret API key; it should use the existing publishable client ID and OAuth/PKCE flow.

## Directory layout

Use one self-contained bundle per TONE3000 tone. The same layout works under `src/nam-wam/models` and `src/cabinet-wam/IRs`.

```text
models/
  tone3000/
    creator-name/
      tone-title--t12345/
        tone.json
        cover.webp
        captures/
          Clean V4 T6 M5 B4--m67890.nam
          Crunch V7 T6 M5 B4--m67891.nam

IRs/
  tone3000/
    creator-name/
      cabinet-title--t23456/
        tone.json
        cover.webp
        captures/
          V30 M160 CapEdge--m78901.wav
          V30 SM57 CapCenter--m78902.wav
```

The stable TONE3000 tone and model IDs in directory/file names prevent collisions. Human-readable filenames remain visible in the GUI and may retain useful amp, channel, gain, EQ, microphone, position, and cabinet information.

This physical layout is deliberately not reproduced in the plugin browser. A rich bundle is rendered as one compact tone card containing its artwork, title, creator attribution, license, and a scrollable list of capture filenames. There is no folder/accordion around that card. The `tone3000`, creator, tone, and `captures` directories remain implementation details. Legacy loose files without a `tone.json` keep their directory-based grouping.

## `tone.json`

`tone.json` is the authoritative provenance record for every capture in its bundle. Expiring `model_url` values and OAuth tokens must never be written to it.

```json
{
  "schemaVersion": 1,
  "source": "TONE3000",
  "importedAt": "2026-09-03T12:00:00Z",
  "tone": {
    "id": 12345,
    "title": "5150 Stealth Studio Set",
    "description": "Amp captures at several gain settings.",
    "url": "https://www.tone3000.com/tones/12345",
    "format": "nam",
    "category": "guitar",
    "gear": "amp",
    "license": "cc-by",
    "creator": {
      "username": "creator-name",
      "displayName": "Creator Name",
      "url": "https://www.tone3000.com/users/creator-name"
    },
    "makes": ["EVH"],
    "tags": ["high gain"],
    "image": "cover.webp"
  },
  "assets": [
    {
      "id": 67890,
      "file": "captures/Clean V4 T6 M5 B4--m67890.nam",
      "name": "Clean",
      "architecture": "2",
      "size": "standard",
      "sha256": "replace-with-download-hash"
    }
  ]
}
```

For NAM bundles, `tone.category` may be `guitar`, `bass`, or `pedal`. It is the authoritative classification used by the Factory browser. The generated exporter derives it from TONE3000 tags and gear when possible; maintainers should correct the value before committing an ambiguous bundle. Legacy loose files remain supported: an exact `Bass` directory classifies them as bass, pedal metadata or an initial `[OD]`, `[PEDAL]`, `[DIST]`, or `[FUZZ]` filename marker classifies them as pedals, and otherwise they default to guitar. A pedal used inside a full-rig bass or guitar capture does not make that capture a pedal model.

For IR bundles, set `tone.format` to `ir`; asset files are WAV files and `architecture` is omitted. Audio properties such as sample rate, channel count, bit depth, frame count, and level-match analysis remain generated locally from the WAV content.

## Maintainer-only exporter

The NAM GUI contains a hidden panel enabled only by `?maintainer=1`; hiding it is a UX choice, not an access-control mechanism. Open one of these URLs and then open **Models & sources → TONE3000**:

```text
http://127.0.0.1:8765/examples/wam/index.html?maintainer=1
https://mainline.i3s.unice.fr/NAM_A2_WAM/?maintainer=1
```

1. Authenticate through the existing OAuth/PKCE integration.
2. Use `prompt=select_tone` so the maintainer explicitly chooses one tone.
3. Fetch that tone's metadata and model list.
4. Let the maintainer select individual models, or all models in that explicitly selected tone when permitted.
5. Download each selected `model_url` immediately; never persist the temporary URL.
6. Download the first available tone image and preserve its supported JPEG, PNG, or WebP format.
7. Generate `tone.json`, SHA-256 hashes, and sanitized paths while preserving the original model names.
8. Download a ZIP containing the complete `tone3000/creator/tone--id/` subtree.
9. Unzip that subtree into `src/nam-wam/models` for NAM or `src/cabinet-wam/IRs` for IR.
10. Run `npm run factory-assets`, inspect the generated manifest, test the application, and only then commit the curated bundle.

The NAM Factory browser exposes **All**, **Guitar**, **Bass**, and **Pedals** filters with generated capture counts. Classification is stored per asset in `models-manifest.json`; the runtime does not repeat filename heuristics.

The whole-tone ZIP endpoint is partner-only and normally returns HTTP 403. The importer should therefore use the model list and individual `model_url` fields unless TONE3000 has approved this project for archive access.

## Manifest generation

The runtime continues consuming generated manifests, not scanning directories. The generator merges data in this order:

1. binary/embedded file metadata (`.nam` JSON or WAV headers);
2. per-asset entry from the nearest `tone.json`;
3. computed properties such as hashes and relative paths.

Invalid manifests, missing files, hash mismatches, and duplicate TONE3000 model identities fail the build. Existing loose files remain supported during migration and use their embedded metadata plus optional same-name images or `cover.*`.

## Remaining improvements

1. Add image resizing/normalization and maximum dimensions before ZIP generation.
2. Add a repository policy file that lists licenses approved for Factory redistribution.
3. Add a visual pre-commit report for imported tones and duplicate content hashes.
4. Migrate the current Factory files incrementally; do not require a disruptive all-at-once rename.
