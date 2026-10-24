// Recorded MUSDB train diagnostics. Never use as independent validation.
export const GUITAR_DIAGNOSTIC_CORPUS = {
  "protocol": "guitar-diagnostic-corpus-v1",
  "purpose": "training-split-diagnostic",
  "sampleRate": 44100,
  "frames": 264600,
  "redistributeAudio": false,
  "trainingOverlap": "MUSDB train: known training-set membership, not independent validation",
  "sources": {
    "musdb": {
      "url": "https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip",
      "sha256": "365f66acffc57282e474a4c24b32afec3678258c50b8d45646ac849b0a287df3"
    },
    "licenses": {
      "url": "https://raw.githubusercontent.com/sigsep/website/master/content/datasets/assets/tracklist.csv",
      "sha256": "5e0a9252774412be23971ebfb7d384c0b2f29842eed2fa16aab69cf825b332b1"
    }
  },
  "cases": [
    {
      "id": "guitar-country",
      "dataset": "MUSDB18-7s / MedleyDB metadata",
      "track": "Music Delta - Country1",
      "group": "MusicDelta_Country1",
      "split": "train",
      "offsetSeconds": 0,
      "target": "guitar",
      "otherIsGuitar": true,
      "hasBleed": false,
      "style": "acoustic",
      "license": "CC BY-NC-SA",
      "genre": "Country",
      "sourceMember": "train/Music Delta - Country1.stem.mp4",
      "sourceSha256": "02187fa4dd9be3bf9d87b948210a20b1f9ef00011486374df566c29253bda6fc",
      "metadataSha256": "7c049a9d4fde92a57f888ae99b8da92e420764b3e670f6f82eb30d469a672b5c",
      "metadataURL": "https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/MusicDelta_Country1_METADATA.yaml",
      "stemInstruments": [
        "drum set",
        "electric bass",
        "acoustic guitar",
        "acoustic guitar",
        "male singer"
      ],
      "referenceStream": 3,
      "trainingSetDiagnostic": true,
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "guitar-country/mix.wav",
          "sha256": "a1c3e1b84ebdd49e760be2b130a6bafbe55787c525a1ed120b7335ccb4ad8800"
        },
        "reference": {
          "path": "guitar-country/reference.wav",
          "sha256": "e3a894a5eac3c60459e8462b236951ccddad5053ba4da8de2eae1192908569f4"
        },
        "backing": {
          "path": "guitar-country/backing.wav",
          "sha256": "9dae2aef60d086e8362c87142ed85b194ac48b808a931a34d49b6e49a79fcfe6"
        }
      }
    },
    {
      "id": "guitar-grunge",
      "dataset": "MUSDB18-7s / MedleyDB metadata",
      "track": "Music Delta - Grunge",
      "group": "MusicDelta_Grunge",
      "split": "train",
      "offsetSeconds": 0,
      "target": "guitar",
      "otherIsGuitar": true,
      "hasBleed": false,
      "style": "distorted",
      "license": "CC BY-NC-SA",
      "genre": "Rock",
      "sourceMember": "train/Music Delta - Grunge.stem.mp4",
      "sourceSha256": "f5b64e67025fbcec4418b6bbb0634c75c4d61625f7544a4c2900f52db47fe23d",
      "metadataSha256": "fc0bc0524be54e030ae181d5c0faba5583596a0e9946314bad38ef83208f1a50",
      "metadataURL": "https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/MusicDelta_Grunge_METADATA.yaml",
      "stemInstruments": [
        "drum set",
        "electric bass",
        "distorted electric guitar",
        "distorted electric guitar",
        "male singer"
      ],
      "referenceStream": 3,
      "trainingSetDiagnostic": true,
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "guitar-grunge/mix.wav",
          "sha256": "de53109c22eff8025524dac0ca20df106d894816b6864caf4063ff484f2dbf19"
        },
        "reference": {
          "path": "guitar-grunge/reference.wav",
          "sha256": "85ca5f2f57d825ac8f945a02431ea19c4b2814eb96bb424ca7497b8923412b70"
        },
        "backing": {
          "path": "guitar-grunge/backing.wav",
          "sha256": "235f4973f2b64aec569da846cb4c2c7e79c59aa6d7687abadc026f1b8c9f2566"
        }
      }
    },
    {
      "id": "guitar-meaxic",
      "dataset": "MUSDB18-7s / MedleyDB metadata",
      "track": "Meaxic - Take A Step",
      "group": "Meaxic_TakeAStep",
      "split": "train",
      "offsetSeconds": 0,
      "target": "guitar",
      "otherIsGuitar": true,
      "hasBleed": false,
      "style": "clean and distorted",
      "license": "CC BY-NC-SA",
      "genre": "Rock",
      "sourceMember": "train/Meaxic - Take A Step.stem.mp4",
      "sourceSha256": "d61db7686459fa4687645edede0c6c64aad3011d742464bf6330e53a79a489ff",
      "metadataSha256": "c20cc8af7b06a1378612c0682d6789157b260ada2e0298fa5f25ec5afbb64dd2",
      "metadataURL": "https://raw.githubusercontent.com/marl/medleydb/master/medleydb/data/Metadata/Meaxic_TakeAStep_METADATA.yaml",
      "stemInstruments": [
        "electric bass",
        "clean electric guitar",
        "distorted electric guitar",
        "male singer",
        "drum set",
        "vocalists",
        "vocalists",
        "vocalists"
      ],
      "referenceStream": 3,
      "trainingSetDiagnostic": true,
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "guitar-meaxic/mix.wav",
          "sha256": "518f17d0a1e88b96f8e20c5da8775363c5993522a621b3e759e4665c0000ffab"
        },
        "reference": {
          "path": "guitar-meaxic/reference.wav",
          "sha256": "9a6d4cf4910206d5c1191ab2411e1be45b95c83ae1cb9016f71c0b8f51c2b6bd"
        },
        "backing": {
          "path": "guitar-meaxic/backing.wav",
          "sha256": "3c4b2bc0c974f0a7338971f8ba8957586bd656b0e3bfe56046bbb9d63cd255e2"
        }
      }
    }
  ]
};
