// Metadata only: research audio lives in ignored /test-data/source-separation.
export const REAL_CORPUS = {
  "protocol": "real-instrument-corpus-v1",
  "sampleRate": 44100,
  "frames": 264600,
  "redistributeAudio": false,
  "ffmpeg": "ffmpeg version 8.1.2 Copyright (c) 2000-2026 the FFmpeg developers",
  "sources": {
    "musdb": {
      "url": "https://github.com/sigsep/sigsep-mus-db/releases/download/v0.4.0/MUSDB18-7-STEMS.zip",
      "sha256": "365f66acffc57282e474a4c24b32afec3678258c50b8d45646ac849b0a287df3"
    },
    "medley": {
      "url": "https://zenodo.org/record/1438309/files/MedleyDB_Sample.tar.gz?download=1",
      "sha256": "603fa6cc6fc8d6dd0f5ffcc5bd97b8b2c74820e2498b1e44a285308e772d7910"
    },
    "coefficients": {
      "url": "https://raw.githubusercontent.com/marl/medleydb/master/medleydb/resources/mixing_coefficients.yaml",
      "sha256": "6a3d737e26cfc05c117212261ff4bb69e71e7b64ca10d217e953969706925c83"
    },
    "licenses": {
      "url": "https://raw.githubusercontent.com/sigsep/website/master/content/datasets/assets/tracklist.csv",
      "sha256": "5e0a9252774412be23971ebfb7d384c0b2f29842eed2fa16aab69cf825b332b1"
    }
  },
  "cases": [
    {
      "id": "musdb-falcon",
      "dataset": "MUSDB18-7s",
      "track": "The Easton Ellises - Falcon 69",
      "group": "The Easton Ellises - Falcon 69",
      "split": "test",
      "offsetSeconds": 0,
      "target": "bass",
      "otherIsGuitar": false,
      "license": "CC BY-NC-SA 3.0",
      "genre": "Pop/Rock",
      "sourceMember": "test/The Easton Ellises - Falcon 69.stem.mp4",
      "sourceSha256": "1edfa8b5abac9a7b962b33d9b3f65c9e0f4e6490567fd5bc51af313fedecc0b5",
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 0.9972442584969263,
      "files": {
        "mix": {
          "path": "musdb-falcon/mix.wav",
          "sha256": "229f72ea5cce679cf0e388641fa576318a0d4435325b65a88fcfd421f62f164a"
        },
        "reference": {
          "path": "musdb-falcon/reference.wav",
          "sha256": "943cafc1870021002f9106f2a5d78a5c24d3efacfae44c546a2ef561a32aec4f"
        },
        "backing": {
          "path": "musdb-falcon/backing.wav",
          "sha256": "01b271d4ebd0a455ff14ff233a11d2ea6fc4765d47bb5b4f960c1d05b97863f2"
        }
      }
    },
    {
      "id": "musdb-reggae",
      "dataset": "MUSDB18-7s",
      "track": "Arise - Run Run Run",
      "group": "Arise - Run Run Run",
      "split": "test",
      "offsetSeconds": 0,
      "target": "bass",
      "otherIsGuitar": false,
      "license": "Restricted",
      "genre": "Reggae",
      "sourceMember": "test/Arise - Run Run Run.stem.mp4",
      "sourceSha256": "2717258e43d6feb260bcbd7f60ab0ff65818dc6c65f5eedc5291084d553fe75d",
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "musdb-reggae/mix.wav",
          "sha256": "fb4ba61d765e351fa7656c76861e39612f6b2fd70b6208354cc63fb4b8fe1d7a"
        },
        "reference": {
          "path": "musdb-reggae/reference.wav",
          "sha256": "06b27cfedf14945ac89bf935834254bd6f621dbc22cb9b54b4f40d3bda17d0cf"
        },
        "backing": {
          "path": "musdb-reggae/backing.wav",
          "sha256": "a4276028d3378c31409ce6a6dd41285af5e3d16bd7b5a0d81cfc0d3d70753a89"
        }
      }
    },
    {
      "id": "musdb-metal",
      "dataset": "MUSDB18-7s",
      "track": "We Fell From The Sky - Not You",
      "group": "We Fell From The Sky - Not You",
      "split": "test",
      "offsetSeconds": 0,
      "target": "bass",
      "otherIsGuitar": false,
      "license": "Restricted",
      "genre": "Heavy Metal",
      "sourceMember": "test/We Fell From The Sky - Not You.stem.mp4",
      "sourceSha256": "01f97821e9985e0469244b37f28294b2d9074084f4bcbff422c7fa52b726ef2d",
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "musdb-metal/mix.wav",
          "sha256": "719cbaebff496c00432f8e5bec36ad083d7c5e47fc8f2e02b7c444557e98cdbc"
        },
        "reference": {
          "path": "musdb-metal/reference.wav",
          "sha256": "8a417cd5481d92550da21bd2eee2024a62c55a232a005aa18ea7e9a9c8cbd85e"
        },
        "backing": {
          "path": "musdb-metal/backing.wav",
          "sha256": "847a59a03097782c83bdfce391149bfad5f988528c766193f50adf5374e60038"
        }
      }
    },
    {
      "id": "medley-rainfall-20",
      "dataset": "MedleyDB sample",
      "track": "Liz Nelson & Jennifer Davies \u2014 Rainfall",
      "group": "LizNelson_Rainfall",
      "split": "sample",
      "offsetSeconds": 20,
      "target": "guitar",
      "otherIsGuitar": true,
      "hasBleed": false,
      "license": "CC BY-NC-SA 4.0",
      "guitarStemIndices": [
        4,
        5
      ],
      "mixingCoefficients": {
        "1": 0.6354871509502455,
        "2": 0.12610504621272442,
        "3": 0.0624147327727016,
        "4": 0.8433924607944484,
        "5": 0.29222231756693756
      },
      "sourceStems": {
        "LizNelson_Rainfall_STEM_01.wav": "9bd7c8cf27e9b191ce1aa036d7dc1787f662cccc7817d6675b8cbd938a77041b",
        "LizNelson_Rainfall_STEM_02.wav": "ae86f0e41d1e1d57b2c0daeb250ac1fe7536c6df743eda7d140bffd6ce8ac92d",
        "LizNelson_Rainfall_STEM_03.wav": "6e9be1254c4e513b0f3ae3709a7de35f39b56a84fa6c42b7b3bb46a32dfefde5",
        "LizNelson_Rainfall_STEM_04.wav": "a7be6dab2d1e61cd144cf335ffae400940005b352cea286c490c345ae9c9752c",
        "LizNelson_Rainfall_STEM_05.wav": "c3b8d0e47c2a050699f4f3a0bc5c47d11d6a8d539801060c12cc8cbf1dfb8684"
      },
      "metadataSha256": "ea5d97db36aedcb00c1863932bc2da7270c419607502d9ac0ef609210d78cf9c",
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "medley-rainfall-20/mix.wav",
          "sha256": "0602b916f99a1748925295a09d10ed3e70a2cfa0e559a4fc3aaf6c07661ad886"
        },
        "reference": {
          "path": "medley-rainfall-20/reference.wav",
          "sha256": "8903d2e5c1172e5799c17c14780ecb683a243fbb4ab0b5aeb58b32b2b950efe1"
        },
        "backing": {
          "path": "medley-rainfall-20/backing.wav",
          "sha256": "cb7f854c28790503ace3ed6db1993434c1068b3986706db912d92d78bee83481"
        }
      }
    },
    {
      "id": "medley-rainfall-65",
      "dataset": "MedleyDB sample",
      "track": "Liz Nelson & Jennifer Davies \u2014 Rainfall",
      "group": "LizNelson_Rainfall",
      "split": "sample",
      "offsetSeconds": 65,
      "target": "guitar",
      "otherIsGuitar": true,
      "hasBleed": false,
      "license": "CC BY-NC-SA 4.0",
      "guitarStemIndices": [
        4,
        5
      ],
      "mixingCoefficients": {
        "1": 0.6354871509502455,
        "2": 0.12610504621272442,
        "3": 0.0624147327727016,
        "4": 0.8433924607944484,
        "5": 0.29222231756693756
      },
      "sourceStems": {
        "LizNelson_Rainfall_STEM_01.wav": "9bd7c8cf27e9b191ce1aa036d7dc1787f662cccc7817d6675b8cbd938a77041b",
        "LizNelson_Rainfall_STEM_02.wav": "ae86f0e41d1e1d57b2c0daeb250ac1fe7536c6df743eda7d140bffd6ce8ac92d",
        "LizNelson_Rainfall_STEM_03.wav": "6e9be1254c4e513b0f3ae3709a7de35f39b56a84fa6c42b7b3bb46a32dfefde5",
        "LizNelson_Rainfall_STEM_04.wav": "a7be6dab2d1e61cd144cf335ffae400940005b352cea286c490c345ae9c9752c",
        "LizNelson_Rainfall_STEM_05.wav": "c3b8d0e47c2a050699f4f3a0bc5c47d11d6a8d539801060c12cc8cbf1dfb8684"
      },
      "metadataSha256": "ea5d97db36aedcb00c1863932bc2da7270c419607502d9ac0ef609210d78cf9c",
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "medley-rainfall-65/mix.wav",
          "sha256": "327d4165a9642a0478e601b04ae0bcc7b6cb8b3a388b11314800dfbc9bdcfcc4"
        },
        "reference": {
          "path": "medley-rainfall-65/reference.wav",
          "sha256": "d381a7c8decd5289477c77c06a20064ecdc632515f3ddfefabb020cab71462ed"
        },
        "backing": {
          "path": "medley-rainfall-65/backing.wav",
          "sha256": "928769685589a6bcd884662e6e409009a7d3df6e289dfa1072856654f7bf8558"
        }
      }
    },
    {
      "id": "medley-rainfall-120",
      "dataset": "MedleyDB sample",
      "track": "Liz Nelson & Jennifer Davies \u2014 Rainfall",
      "group": "LizNelson_Rainfall",
      "split": "sample",
      "offsetSeconds": 120,
      "target": "guitar",
      "otherIsGuitar": true,
      "hasBleed": false,
      "license": "CC BY-NC-SA 4.0",
      "guitarStemIndices": [
        4,
        5
      ],
      "mixingCoefficients": {
        "1": 0.6354871509502455,
        "2": 0.12610504621272442,
        "3": 0.0624147327727016,
        "4": 0.8433924607944484,
        "5": 0.29222231756693756
      },
      "sourceStems": {
        "LizNelson_Rainfall_STEM_01.wav": "9bd7c8cf27e9b191ce1aa036d7dc1787f662cccc7817d6675b8cbd938a77041b",
        "LizNelson_Rainfall_STEM_02.wav": "ae86f0e41d1e1d57b2c0daeb250ac1fe7536c6df743eda7d140bffd6ce8ac92d",
        "LizNelson_Rainfall_STEM_03.wav": "6e9be1254c4e513b0f3ae3709a7de35f39b56a84fa6c42b7b3bb46a32dfefde5",
        "LizNelson_Rainfall_STEM_04.wav": "a7be6dab2d1e61cd144cf335ffae400940005b352cea286c490c345ae9c9752c",
        "LizNelson_Rainfall_STEM_05.wav": "c3b8d0e47c2a050699f4f3a0bc5c47d11d6a8d539801060c12cc8cbf1dfb8684"
      },
      "metadataSha256": "ea5d97db36aedcb00c1863932bc2da7270c419607502d9ac0ef609210d78cf9c",
      "frames": 264600,
      "sampleRate": 44100,
      "commonGain": 1,
      "files": {
        "mix": {
          "path": "medley-rainfall-120/mix.wav",
          "sha256": "8d38ac698642b5a39b4f36e7d3df8ccd3c76513b53d69de2c57259300fdf3178"
        },
        "reference": {
          "path": "medley-rainfall-120/reference.wav",
          "sha256": "28b1f083f6e7f7fc534efa8fd23889eae0a0f8ecfdc2fd32114bda17d88f81f3"
        },
        "backing": {
          "path": "medley-rainfall-120/backing.wav",
          "sha256": "b7e1105a09771682dbb9ee3ec99051eb9a49d1e3b883df9a2850da05f00b4a5d"
        }
      }
    }
  ],
  "medleyPresentInMusdbPreview": false
};
